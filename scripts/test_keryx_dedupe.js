const fs = require('fs');
const path = require('path');

// Set up mock DB path
const TEST_DB = './data/test_keryx.db';
process.env.DB_PATH = TEST_DB;

// Stub feed scanner BEFORE requiring poller
const feedScanner = require('../dist/modules/feed-scanner');
let mockGuid = 'mock-episode-guid-1111';
feedScanner.scanFeed = async (url) => {
  return {
    title: 'Mock Show',
    image: 'https://example.com/show.png',
    link: 'https://example.com/show',
    tags: { value: true, transcript: false },
    latestEpisode: {
      guid: mockGuid,
      title: 'Hardening the Core',
      pubDate: '2026-06-29T12:00:00Z',
      enclosureUrl: 'https://example.com/audio.mp3',
      duration: 1800,
      image: null
    }
  };
};

const db = require('../dist/db/database');
const poller = require('../dist/pollers/episode-poller');

function assert(condition, message) {
  if (!condition) {
    console.error('Assertion Failed:', message);
    process.exit(1);
  }
}

async function run() {
  console.log('--- Keryx Announcer Hardening Replay Tests ---');

  // Clean old DB if left over
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }

  // 1. Init Database
  console.log('1. Initializing test database...');
  await db.initDb();

  // 2. Setup subscription
  console.log('2. Configuring watched podcast and alert channel...');
  db.addSubscription('mock-guild-1', 'https://example.com/feed.xml', 'channel-1', 'NEW_EPISODE');

  // 3. Mock Discord client
  let sentCount = 0;
  const mockClient = {
    guilds: { cache: { size: 0, has: () => false, get: () => null } },
    channels: {
      fetch: async (id) => ({
        isTextBased: () => true,
        send: async (payload) => {
          sentCount++;
          return payload;
        }
      })
    }
  };

  // 4. Run first poll
  console.log('3. Running poller check 1 (should send 1 embed)...');
  let interval = poller.startEpisodePoller(mockClient);
  clearInterval(interval); // Stop repeating
  
  await new Promise(resolve => setTimeout(resolve, 800));
  assert(sentCount === 1, `Should have sent exactly 1 announcement, got ${sentCount}`);
  
  const announced = db.isEpisodeAnnounced('channel-1', 'https://example.com/feed.xml', 'mock-episode-guid-1111');
  assert(announced === true, 'Episode should be marked announced in cursor DB');
  console.log('   [PASS] First run processed and saved announcement cursor.');

  // 5. Run second poll (replay should deduplicate)
  console.log('4. Replaying poller check 2 (should NOT send again)...');
  interval = poller.startEpisodePoller(mockClient);
  clearInterval(interval);

  await new Promise(resolve => setTimeout(resolve, 800));
  assert(sentCount === 1, `Should still be 1 announcement (deduplication failed, sentCount: ${sentCount})`);
  console.log('   [PASS] Replay test did not double-announce.');

  // 6. Test cursor persistence after mock bot restart
  console.log('5. Simulating system restart and reloading database from file...');
  // Force reload DB file
  await db.initDb();
  
  const announcedAfterRestart = db.isEpisodeAnnounced('channel-1', 'https://example.com/feed.xml', 'mock-episode-guid-1111');
  assert(announcedAfterRestart === true, 'Announcement cursor should survive DB reload/restart');
  console.log('   [PASS] Cursor survived restart.');

  console.log('\n--- ALL KERYX HARDENING TESTS PASSED ---');
  
  // Cleanup test DB files
  try {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  } catch (e) {}
  
  process.exit(0);
}

run().catch(err => {
  console.error('Keryx test failed:', err);
  process.exit(1);
});
