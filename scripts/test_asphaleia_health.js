const { startDashboardServer } = require('../dist/dashboard/server');
const { telemetry } = require('../dist/modules/telemetry');

function assert(condition, message) {
  if (!condition) {
    console.error('Assertion Failed:', message);
    process.exit(1);
  }
}

async function tryFetch(path, port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return res;
  } catch (err) {
    return null;
  }
}

async function run() {
  console.log('--- Asphaleia Health Observability Tests ---');

  // 1. Mock Discord client
  const mockClient = {
    guilds: { cache: { size: 0, has: () => false, get: () => null } },
    channels: { fetch: async () => null }
  };

  // 2. Start server
  console.log('2. Starting dashboard server...');
  const app = startDashboardServer(mockClient);

  // We wait a brief moment for the server to bind
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Determine port
  let port = '3099';
  let res = await tryFetch('/health', '3099');
  if (!res) {
    console.log('Port 3099 failed, trying fallback port 3050...');
    port = '3050';
    res = await tryFetch('/health', '3050');
  }

  assert(res !== null, 'Server should be reachable on port 3099 or 3050');
  assert(res.status === 200, 'Healthy server status should be 200');
  
  const initialReport = await res.json();
  assert(initialReport.status === 'HEALTHY', 'Initial status should be HEALTHY');
  assert(initialReport.modules['episode-poller'].status === 'UP', 'episode-poller should be UP');
  console.log('   [PASS] GET /health returned 200 with HEALTHY status and UP pollers.');

  // 3. Force a module failure
  console.log('3. Forcing a poller failure in telemetry (episode-poller)...');
  telemetry.recordModuleFailure('episode-poller', new Error('Failed to resolve RSS feed DNS address'), 'DEGRADED');

  res = await tryFetch('/health', port);
  assert(res !== null, 'Health query failed to fetch');
  assert(res.status === 503, 'Degraded server status should return 503 Service Unavailable');
  
  const degradedReport = await res.json();
  assert(degradedReport.status === 'DEGRADED', 'Status should be DEGRADED');
  assert(degradedReport.modules['episode-poller'].status === 'DEGRADED', 'episode-poller should report DEGRADED');
  assert(degradedReport.modules['episode-poller'].lastError.includes('DNS address'), 'Should log last error message');
  
  console.log('   [PASS] GET /health returned 503 with DEGRADED status and detailed error message.');
  console.log('\n--- ALL ASPHALEIA HEALTH TESTS PASSED ---');
  
  // Clean up active handles
  if (typeof process._getActiveHandles === 'function') {
    process._getActiveHandles().forEach(handle => {
      if (handle && typeof handle.close === 'function') {
        try {
          handle.close();
        } catch (e) {}
      }
    });
  }
}

run().catch(err => {
  console.error('Asphaleia test failed:', err.message);
  process.exit(1);
});
