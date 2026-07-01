// Pre-authenticate session by mocking express-session in the require cache
const expressSession = require('express-session');
const mockSession = () => (req, res, next) => {
  req.session = {
    userId: 'test-creator-999',
    username: 'HardenedCreator',
    managedGuildIds: ['mock-guild-123']
  };
  next();
};
// Copy original properties (like Store) to the mock function so connect-sqlite3 does not crash
Object.assign(mockSession, expressSession);

require.cache[require.resolve('express-session')] = {
  exports: mockSession
};

const { startDashboardServer } = require('../dist/dashboard/server');

function assert(condition, message) {
  if (!condition) {
    console.error('Assertion Failed:', message);
    process.exit(1);
  }
}

async function tryFetch(path, port, options = {}) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, options);
    return res;
  } catch (err) {
    return null;
  }
}

async function run() {
  console.log('--- Dashboard Hardening & Input Validation Tests ---');

  // 1. Mock Discord client
  const mockClient = {
    guilds: { cache: { size: 1, has: () => true, get: () => ({ channels: { cache: new Map() } }) } },
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
    port = '3050';
    res = await tryFetch('/health', '3050');
  }

  assert(res !== null, 'Server should be reachable');
  console.log(`   Reachable on port ${port}.`);

  // 3. Test Invalid Feed URL input validation (GET /api/guilds/:guildId/episodes)
  console.log('3. Querying episodes list with invalid URL...');
  res = await tryFetch('/api/guilds/mock-guild-123/episodes?feedUrl=not-a-valid-url', port);
  assert(res.status === 400, 'Should return 400 Bad Request for invalid URL');
  let body = await res.json();
  assert(body.error.includes('invalid feedUrl'), 'Error message should flag feedUrl');
  console.log('   [PASS] Invalid feed URL rejected with 400.');

  // 4. Test Invalid sat threshold input validation (POST /api/guilds/:guildId/subscriptions)
  console.log('4. Creating subscription with invalid (negative) minBoostSats...');
  res = await tryFetch('/api/guilds/mock-guild-123/subscriptions', port, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feedUrl: 'https://example.com/podcast.xml',
      channelId: 'channel-123',
      alertType: 'BOOSTAGRAM',
      minBoostSats: -500, // Negative threshold
      theme: 'aegis'
    })
  });
  assert(res.status === 400, 'Should return 400 Bad Request for negative sat threshold');
  body = await res.json();
  assert(body.error.includes('minBoostSats'), 'Error message should flag minBoostSats');
  console.log('   [PASS] Negative sat threshold rejected with 400.');

  // 5. Test Global Error Boundary (triggering route that throws exception)
  console.log('5. Triggering a route that throws an exception...');
  res = await tryFetch('/api/guilds/mock-guild-123/episodes/guid-123/chapters?feedUrl=https://example.com/feed.xml&chaptersUrl=https://127.0.0.1:9999/refused.json', port);
  assert(res.status === 500, 'Axios connection refusal should be caught returning 500');
  body = await res.json();
  assert(body.error !== undefined, 'Should return structured JSON error');
  console.log('   [PASS] Connection failure caught and returned as structured 500 JSON.');

  console.log('\n--- ALL DASHBOARD HARDENING TESTS PASSED ---');
  
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
  console.error('Hardening tests failed:', err.message);
  process.exit(1);
});
