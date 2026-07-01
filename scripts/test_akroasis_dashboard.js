const { startDashboardServer } = require('../dist/dashboard/server');
const { agoraRoomManager } = require('../dist/modules/agora-room');
const { horaiScheduler } = require('../dist/modules/horai-scheduler');

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
  console.log('--- Akroasis Dashboard & Public API Integration Tests ---');

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

  // Determine port by trying both 3099 and 3050
  let port = '3099';
  let res = await tryFetch('/api/public/rooms/guild-not-active', '3099');
  if (!res) {
    console.log('Port 3099 failed, trying fallback port 3050...');
    port = '3050';
    res = await tryFetch('/api/public/rooms/guild-not-active', '3050');
  }

  assert(res !== null, 'Server should be reachable on port 3099 or 3050');
  assert(res.status === 404, 'Non-active room should return 404');
  console.log(`   [PASS] Reachable on port ${port}. 404 returned correctly.`);

  // 4. Initialize room and add schedule, then query again (should return 200 with room data)
  console.log('4. Initializing room and schedule details...');
  const roomId = 'guild-active-123';
  agoraRoomManager.initializeEpisodeRoom(roomId, 'https://example.com/rss', 'guid-active', 'Active Show Track');
  agoraRoomManager.startRoomPlayback(roomId);
  
  horaiScheduler.addScheduledItem(roomId, {
    id: 'next-1',
    title: 'Upcoming Segment',
    feedUrl: 'https://example.com/rss',
    episodeGuid: 'guid-upcoming-1',
    startTime: Date.now() + 500000,
    duration: 60000
  });

  res = await tryFetch(`/api/public/rooms/${roomId}`, port);
  assert(res !== null, 'Active room query failed to fetch');
  assert(res.status === 200, 'Active room should return 200');
  
  const roomData = await res.json();
  assert(roomData.episodeTitle === 'Active Show Track', 'Should match active episode title');
  assert(roomData.upcoming && roomData.upcoming.length === 1, 'Should return 1 upcoming scheduled track');
  assert(roomData.upcoming[0].title === 'Upcoming Segment', 'Should return upcoming scheduled item');
  
  console.log('   [PASS] Public room state returned successfully with upcoming schedule!');
  console.log('\n--- ALL AKROASIS PRESENTATION TESTS PASSED ---');
  
  // Clean up all active server sockets to exit naturally
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
  console.error('Integration tests failed:', err.message);
  process.exit(1);
});
