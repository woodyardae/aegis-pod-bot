const { agoraRoomManager } = require('../dist/modules/agora-room');

function assert(condition, message) {
  if (!condition) {
    console.error('Assertion Failed:', message);
    process.exit(1);
  }
}

async function run() {
  console.log('--- Agora Room State Machine Unit Tests ---');
  
  const roomId = 'test-agora-presence-room';
  const feedUrl = 'https://mp3s.nashownotes.com/pc20rss.xml';
  const episodeGuid = 'episode-12345';
  
  // 1. Initialize room
  console.log('1. Initializing Room...');
  agoraRoomManager.initializeEpisodeRoom(roomId, feedUrl, episodeGuid, 'Aegis Aether Launch');
  let room = agoraRoomManager.getRoom(roomId);
  assert(room !== null, 'Room should be initialized');
  assert(room.hostUserId === null, 'Host should be null initially');
  
  // 2. Three listeners join
  console.log('2. Three listeners join...');
  const listener1 = { userId: 'user-1', username: 'Alice', walletAddress: 'alice@alby' };
  const listener2 = { userId: 'user-2', username: 'Bob', walletAddress: 'bob@alby' };
  const listener3 = { userId: 'user-3', username: 'Charlie', walletAddress: 'charlie@alby' };
  
  agoraRoomManager.joinRoom(roomId, listener1);
  agoraRoomManager.joinRoom(roomId, listener2);
  agoraRoomManager.joinRoom(roomId, listener3);
  
  room = agoraRoomManager.getRoom(roomId);
  assert(room.listeners.length === 3, 'Should have 3 listeners in room');
  assert(room.hostUserId === 'user-1', 'First user should be assigned as host');
  console.log('   [PASS] Alice, Bob, and Charlie joined. Alice is host.');
  
  // 3. Playback & position extrapolation
  console.log('3. Host starts playback at 5000ms...');
  agoraRoomManager.updatePlaybackState(roomId, 'user-1', true, 5000);
  
  room = agoraRoomManager.getRoom(roomId);
  assert(room.isPlaying === true, 'Playback state should be playing');
  assert(room.playbackPositionMs === 5000, 'Playback position should be 5000ms');
  
  const initialPos = agoraRoomManager.getExtrapolatedPlaybackPosition(roomId);
  assert(initialPos >= 5000, 'Extrapolated position should be at least 5000ms');
  
  console.log('   Waiting 500ms to test position extrapolation...');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const extraPos = agoraRoomManager.getExtrapolatedPlaybackPosition(roomId);
  console.log(`   Host initial report: 5000ms. Extrapolated position after 500ms: ${extraPos}ms`);
  assert(extraPos > 5400 && extraPos < 5700, 'Position should extrapolate based on time elapsed');
  
  // 4. Host seek
  console.log('4. Host seeks to 20000ms...');
  agoraRoomManager.hostSeek(roomId, 'user-1', 20000);
  const postSeekPos = agoraRoomManager.getExtrapolatedPlaybackPosition(roomId);
  console.log(`   Extrapolated position post-seek: ${postSeekPos}ms`);
  assert(postSeekPos >= 20000 && postSeekPos < 20100, 'Extrapolated position should reset on host seek');
  
  // 5. Unauthorized seek attempt
  console.log('5. Non-host attempts to seek...');
  agoraRoomManager.hostSeek(roomId, 'user-2', 99999); // Bob attempts to seek
  const unchangedPos = agoraRoomManager.getExtrapolatedPlaybackPosition(roomId);
  assert(unchangedPos < 30000, 'Position should NOT change on unauthorized seek');
  console.log('   [PASS] Unauthorized seek was rejected.');
  
  // 6. Listener position convergence
  console.log('6. Listeners synchronize positions to host...');
  const alicePos = agoraRoomManager.getExtrapolatedPlaybackPosition(roomId);
  const bobSynced = agoraRoomManager.syncListenerPosition(roomId, 'user-2');
  const charlieSynced = agoraRoomManager.syncListenerPosition(roomId, 'user-3');
  
  console.log(`   Host: ${alicePos}ms, Bob Synced: ${bobSynced}ms, Charlie Synced: ${charlieSynced}ms`);
  assert(Math.abs(bobSynced - alicePos) < 10, 'Bob should converge to Host');
  assert(Math.abs(charlieSynced - alicePos) < 10, 'Charlie should converge to Host');
  console.log('   [PASS] Listener positions converged to host.');
  
  // 7. Host leaves, promotion occurs
  console.log('7. Host Alice leaves room...');
  agoraRoomManager.leaveRoom(roomId, 'user-1');
  
  room = agoraRoomManager.getRoom(roomId);
  assert(room.listeners.length === 2, 'Presence list should decrease to 2');
  assert(room.hostUserId === 'user-2', 'Bob should be promoted to host');
  console.log('   [PASS] Alice left. Bob successfully promoted to host.');
  
  // 8. New host seek
  console.log('8. New host Bob seeks to 40000ms...');
  agoraRoomManager.hostSeek(roomId, 'user-2', 40000);
  const bobSeekPos = agoraRoomManager.getExtrapolatedPlaybackPosition(roomId);
  assert(bobSeekPos >= 40000 && bobSeekPos < 40100, 'New host should be authorized to seek');
  console.log('   [PASS] New host seek succeeded.');
  
  console.log('\n--- ALL TEST PASSED SUCCESSFULLY ---');
}

run().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
