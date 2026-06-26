const { initDb, closeDb, getChapterMetadata, setChapterMetadata, isCommentPushed, markCommentPushed } = require('../dist/db/database');
const { getNostrEventHexId } = require('../dist/modules/nostr-client');

async function runTests() {
  console.log('Starting Chapters & Comments integration checks...\n');

  // Initialize DB
  await initDb();


  // Test 1: Chapter Metadata CRUD
  console.log('Test 1: Saving and retrieving chapter metadata...');
  const testFeed = 'https://example.com/test-feed-rss.xml';
  const testGuid = 'test-episode-guid-12345';
  const testChapterIndex = 2;
  const linkTitle = 'Special Resource';
  const linkUrl = 'https://example.com/resource';
  const notes = 'These are the reference notes for this specific segment.';

  setChapterMetadata(testFeed, testGuid, testChapterIndex, linkTitle, linkUrl, notes);
  const metadata = getChapterMetadata(testFeed, testGuid);
  const matched = metadata.find(m => m.chapter_index === testChapterIndex);

  if (matched && matched.link_title === linkTitle && matched.link_url === linkUrl && matched.notes === notes) {
    console.log('   [PASS] Chapter metadata stored and fetched successfully!');
  } else {
    throw new Error(`Chapter metadata mismatch. Got: ${JSON.stringify(matched)}`);
  }

  // Test 2: Pushed Comments deduplication tracking
  console.log('Test 2: Checking pushed comments DB operations...');
  const guildId = 'test-guild-99999';
  const eventId = 'test-nostr-event-id-abcde';

  const originallyPushed = isCommentPushed(guildId, eventId);
  if (!originallyPushed) {
    markCommentPushed(guildId, eventId);
    if (isCommentPushed(guildId, eventId)) {
      console.log('   [PASS] Comment correctly marked and verified as pushed!');
    } else {
      throw new Error('Comment pushed status was not updated in the database.');
    }
  } else {
    console.log('   [PASS] Comment was already pushed in database (OK).');
  }

  // Test 3: Nostr client event parsing functions
  console.log('Test 3: Checking Bech32/TLV decoding functions...');
  const testNevent = 'nevent1qqsqv6mu5zck0u9d44wx6cv6kythq5zz8cuhn6pm3haqdxvj2vaaeagvsfd05';
  const expectedHex = '066b7ca0b167f0adad5c6d619ab1177050423e3979e83b8dfa069992533bdcf5';
  const decoded = getNostrEventHexId(testNevent);
  
  if (decoded === expectedHex) {
    console.log('   [PASS] TLV nevent1 decoded correctly!');
  } else {
    throw new Error(`nevent1 decoded incorrectly. Expected: ${expectedHex}, Got: ${decoded}`);
  }

  closeDb();
  console.log('\n[SUCCESS] Integration checks completed successfully!');
}

runTests().catch(err => {
  console.error('\n[FAIL] Test encountered error:', err);
});

