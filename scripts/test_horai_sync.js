const { agoraRoomManager } = require('../dist/modules/agora-room');
const { horaiScheduler } = require('../dist/modules/horai-scheduler');

function assert(condition, message) {
  if (!condition) {
    console.error('Assertion Failed:', message);
    process.exit(1);
  }
}

async function run() {
  console.log('--- Horai ↔ Agora Scheduling Integration Tests ---');
  
  const roomId = 'test-horai-agora-sync-room';
  const feedUrl = 'https://mp3s.nashownotes.com/pc20rss.xml';
  
  // 1. Setup back-to-back scheduled items
  console.log('1. Scheduling back-to-back items...');
  const now = Date.now();
  const slot1Duration = 1000; // 1s
  const slot2Duration = 1000; // 1s
  
  const item1 = {
    id: 'slot-1',
    title: 'Slot 1: Intro Broadcast',
    feedUrl,
    episodeGuid: 'guid-slot-1',
    startTime: now,
    duration: slot1Duration
  };
  
  const item2 = {
    id: 'slot-2',
    title: 'Slot 2: Main Interview',
    feedUrl,
    episodeGuid: 'guid-slot-2',
    startTime: now + slot1Duration,
    duration: slot2Duration
  };
  
  horaiScheduler.addScheduledItem(roomId, item1);
  horaiScheduler.addScheduledItem(roomId, item2);
  
  // 2. Playback start check
  console.log('2. Starting playout at startTime of Slot 1...');
  horaiScheduler.checkPlayout(roomId, now);
  
  let room = agoraRoomManager.getRoom(roomId);
  assert(room !== null, 'Room should be initialized');
  assert(room.isPlaying === true, 'Room should be playing');
  assert(room.episodeGuid === 'guid-slot-1', 'Should be playing Slot 1');
  console.log('   [PASS] Slot 1 playing active.');
  
  // 3. Transition check
  console.log('3. Waiting for transition to Slot 2 (1100ms)...');
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  horaiScheduler.checkPlayout(roomId, Date.now());
  room = agoraRoomManager.getRoom(roomId);
  assert(room.isPlaying === true, 'Room should still be playing');
  assert(room.episodeGuid === 'guid-slot-2', 'Should auto-transition to Slot 2');
  console.log(`   [PASS] Auto-transition succeeded. Now playing: "${room.episodeTitle}"`);
  
  // 4. Expiration check
  console.log('4. Waiting for Slot 2 to finish (1000ms)...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  horaiScheduler.checkPlayout(roomId, Date.now());
  room = agoraRoomManager.getRoom(roomId);
  assert(room.isPlaying === false, 'Playout should stop when no items are active');
  console.log('   [PASS] Playout successfully stopped after final slot expired.');
  
  // 5. Caching check
  console.log('5. Verifying cache hits/misses for upcoming schedule...');
  // Add an item in the future so it appears in upcoming
  horaiScheduler.addScheduledItem(roomId, {
    id: 'slot-future',
    title: 'Future Broadcast',
    feedUrl,
    episodeGuid: 'guid-future',
    startTime: Date.now() + 100000,
    duration: 60000
  });
  
  assert(horaiScheduler.cacheHits === 0, 'Cache hits should be 0');
  assert(horaiScheduler.cacheMisses === 0, 'Cache misses should be 0');
  
  // Query 1: Cache Miss
  const up1 = horaiScheduler.getUpcomingSchedule(roomId, Date.now());
  assert(up1.length === 1, 'Should find 1 upcoming item');
  assert(horaiScheduler.cacheMisses === 1, 'Query 1 should be a cache miss');
  assert(horaiScheduler.cacheHits === 0, 'Query 1 should not trigger cache hit');
  
  // Query 2: Cache Hit
  const up2 = horaiScheduler.getUpcomingSchedule(roomId, Date.now());
  assert(up2.length === 1, 'Should return cached upcoming list');
  assert(horaiScheduler.cacheMisses === 1, 'Cache misses should remain 1');
  assert(horaiScheduler.cacheHits === 1, 'Query 2 should be a cache hit');
  
  console.log(`   [PASS] Caching verified: Hits = ${horaiScheduler.cacheHits}, Misses = ${horaiScheduler.cacheMisses}`);
  console.log('\n--- ALL SCHEDULING INTEGRATION TESTS PASSED ---');
}

run().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
