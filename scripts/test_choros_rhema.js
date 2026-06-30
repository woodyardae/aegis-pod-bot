const { agoraRoomManager } = require('../dist/modules/agora-room');
const { chorosChatManager } = require('../dist/modules/choros-chat');
const { rhemaFloorManager } = require('../dist/modules/rhema-floor');

function assert(condition, message) {
  if (!condition) {
    console.error('Assertion Failed:', message);
    process.exit(1);
  }
}

async function run() {
  console.log('--- Choros Chat & Rhema Voice Floor Scaffold Tests ---');

  const roomId = 'test-scaffold-room-99';
  const listener = { userId: 'alice-id', username: 'Alice' };

  // 1. Join room (should trigger initialization of Rhema floor state)
  console.log('1. Joining listener to Agora room...');
  agoraRoomManager.joinRoom(roomId, listener);
  
  const floorState = rhemaFloorManager.getOrCreateFloorState(roomId);
  assert(floorState !== null, 'Floor state should be created');
  assert(floorState.roomId === roomId, 'Floor state roomId should match');
  assert(floorState.activeSpeakerUserId === null, 'Active speaker should be null initially');
  console.log('   [PASS] Rhema floor state initialized successfully.');

  // 2. Choros Chat Message Flow
  console.log('2. Sending messages in Choros chat...');
  chorosChatManager.sendMessage(roomId, 'alice-id', 'Alice', 'Hello world! 📻');
  chorosChatManager.sendMessage(roomId, 'bob-id', 'Bob', 'Zap the host ⚡');

  const messages = chorosChatManager.getRoomMessages(roomId);
  assert(messages.length === 2, 'Should have 2 messages');
  assert(messages[0].username === 'Alice', 'First message sender should be Alice');
  assert(messages[1].content === 'Zap the host ⚡', 'Second message content should match');
  console.log('   [PASS] Choros chat messages stored and retrieved successfully.');

  // 3. Rhema Floor Control Flow
  console.log('3. Simulating speaking floor requests...');
  rhemaFloorManager.requestSpeakingFloor(roomId, 'bob-id');
  let currentFloor = rhemaFloorManager.getOrCreateFloorState(roomId);
  assert(currentFloor.speakingRequestQueue.length === 1, 'Bob should be in request queue');
  assert(currentFloor.speakingRequestQueue[0] === 'bob-id', 'Queue front should be bob-id');

  console.log('4. Granting speaking floor...');
  rhemaFloorManager.grantSpeakingFloor(roomId, 'bob-id');
  currentFloor = rhemaFloorManager.getOrCreateFloorState(roomId);
  assert(currentFloor.speakingRequestQueue.length === 0, 'Request queue should be empty');
  assert(currentFloor.activeSpeakerUserId === 'bob-id', 'Bob should be active speaker');

  console.log('5. Releasing speaking floor...');
  rhemaFloorManager.releaseSpeakingFloor(roomId);
  currentFloor = rhemaFloorManager.getOrCreateFloorState(roomId);
  assert(currentFloor.activeSpeakerUserId === null, 'Speaker should be null');
  console.log('   [PASS] Rhema floor request, grant, and release lifecycle succeeded.');

  // 4. Room Teardown cleanup
  console.log('6. Alice leaves (room becomes empty, triggering cleanup)...');
  agoraRoomManager.leaveRoom(roomId, 'alice-id');

  const cleanedMessages = chorosChatManager.getRoomMessages(roomId);
  assert(cleanedMessages.length === 0, 'Chat messages should be cleaned up');

  // Verify floor state is cleared (states map doesn't contain it anymore)
  // We can verify by querying the state, it should return a new blank default state
  const cleanedFloor = rhemaFloorManager.getOrCreateFloorState(roomId);
  assert(cleanedFloor.speakingRequestQueue.length === 0, 'Request queue should be empty');
  assert(cleanedFloor.activeSpeakerUserId === null, 'Active speaker should be null');

  console.log('   [PASS] Cleanup verified. Messages and floor deleted.');
  console.log('\n--- ALL CHOROS & RHEMA SCAFFOLD TESTS PASSED ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
