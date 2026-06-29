const agoraCmd = require('../dist/commands/agora');
const { agoraRoomManager } = require('../dist/modules/agora-room');
const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error('Assertion Failed:', message);
    process.exit(1);
  }
}

async function run() {
  console.log('--- Agora Commands Smoke / Mock Tests ---');
  
  const guildId = 'test-guild-commands-123';
  
  // Helper to construct a mock interaction
  const createMockInteraction = (subcommand, options = {}, user = { id: 'host-user', username: 'HostUser' }) => {
    let replyPromiseResolve;
    const replyPromise = new Promise(resolve => {
      replyPromiseResolve = resolve;
    });

    return {
      guildId,
      user,
      options: {
        getSubcommand: () => subcommand,
        getString: (name) => options[name] || null,
        getInteger: (name) => options[name] !== undefined ? options[name] : null
      },
      reply: async (payload) => {
        replyPromiseResolve(payload);
        return payload;
      }
    };
  };

  // Test 1: /agora join with wallet details
  console.log('\nTest 1: Mocking /agora join (first user becomes host)...');
  const joinInteraction = createMockInteraction('join', {
    nostr_pubkey: 'npub1wallettest',
    wallet_address: 'host@getalby.com'
  });
  
  await agoraCmd.execute(joinInteraction);
  const room = agoraRoomManager.getRoom(guildId);
  assert(room !== null, 'Room should be active after join');
  assert(room.hostUserId === 'host-user', 'Host should be host-user');
  assert(room.listeners.length === 1, 'Room should have 1 listener');
  console.log('   [PASS] /agora join mock execution completed successfully.');

  // Test 2: /agora status
  console.log('\nTest 2: Mocking /agora status...');
  const statusPayload = await new Promise(async resolve => {
    const interaction = createMockInteraction('status');
    interaction.reply = async (payload) => {
      resolve(payload);
      return payload;
    };
    await agoraCmd.execute(interaction);
  });
  
  assert(statusPayload.embeds && statusPayload.embeds.length === 1, 'Status response should contain 1 embed');
  const embedData = statusPayload.embeds[0].data;
  assert(embedData.title.includes('Agora Room'), 'Embed title should match');
  console.log('   [PASS] /agora status returned embed data successfully.');

  // Test 3: /agora start (by host)
  console.log('\nTest 3: Mocking /agora start (by host)...');
  const startPayload = await new Promise(async resolve => {
    const interaction = createMockInteraction('start');
    interaction.reply = async (payload) => {
      resolve(payload);
      return payload;
    };
    await agoraCmd.execute(interaction);
  });
  
  assert(startPayload.content.includes('Started room playback'), 'Start playback confirmation failed');
  assert(agoraRoomManager.getRoom(guildId).isPlaying === true, 'Room should be playing');
  console.log('   [PASS] /agora start succeeded for host.');

  // Test 4: /agora start (by non-host, should fail)
  console.log('\nTest 4: Mocking /agora start (unauthorized)...');
  const startBadPayload = await new Promise(async resolve => {
    const interaction = createMockInteraction('start', {}, { id: 'other-user', username: 'Guest' });
    // Join other user first as listener
    agoraRoomManager.joinRoom(guildId, { userId: 'other-user', username: 'Guest' });
    interaction.reply = async (payload) => {
      resolve(payload);
      return payload;
    };
    await agoraCmd.execute(interaction);
  });
  
  assert(startBadPayload.content.includes('Only the host'), 'Should block non-host start');
  console.log('   [PASS] Unauthorized /agora start properly blocked.');

  // Test 5: /agora seek (by host)
  console.log('\nTest 5: Mocking /agora seek...');
  const seekPayload = await new Promise(async resolve => {
    const interaction = createMockInteraction('seek', { position_seconds: 120 });
    interaction.reply = async (payload) => {
      resolve(payload);
      return payload;
    };
    await agoraCmd.execute(interaction);
  });
  
  assert(seekPayload.content.includes('Seeked to'), 'Seek confirmation failed');
  assert(agoraRoomManager.getRoom(guildId).playbackPositionMs === 120000, 'Seek position failed to update');
  console.log('   [PASS] /agora seek succeeded for host.');

  // Test 6: Verify deploy-commands contains agoraCmd
  console.log('\nTest 6: Verifying deploy-commands lists /agora...');
  const deployPath = path.join(__dirname, '../src/deploy-commands.ts');
  const deploySrc = fs.readFileSync(deployPath, 'utf8');
  assert(deploySrc.includes('agoraCmd'), 'deploy-commands.ts should import and list agoraCmd');
  console.log('   [PASS] deploy-commands.ts statically verified to contain /agora.');

  console.log('\n--- ALL COMMANDS SMOKE TESTS PASSED ---');
}

run().catch(err => {
  console.error('Smoke tests failed:', err.message);
  process.exit(1);
});
