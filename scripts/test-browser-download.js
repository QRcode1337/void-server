#!/usr/bin/env node
/**
 * Test Browser Download Automation
 *
 * This script tests the browser profile system by:
 * 1. Creating a test browser profile
 * 2. Using the headless browser context to download a file
 * 3. Verifying the download completed
 *
 * Usage: node scripts/test-browser-download.js
 */

const path = require('path');
const fs = require('fs');

const PROFILE_ID = 'download-test';
const DOWNLOAD_URL = 'https://raw.githubusercontent.com/ClawedCode/void-server/main/screenshot.png';
const DOWNLOAD_DIR = path.join(__dirname, '../data/downloads');

async function main() {
  console.log('🧪 Browser Download Automation Test\n');

  // Ensure download directory exists
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  // Import services
  const browserService = require('../server/services/browser-service');

  // Step 1: Create test profile if it doesn't exist
  console.log('1️⃣ Creating browser profile...');
  const createResult = await browserService.createBrowser(PROFILE_ID, {
    name: 'Download Test',
    description: 'Profile for testing file downloads',
  });

  if (createResult.success) {
    console.log(`   ✅ Created profile: ${PROFILE_ID}`);
  } else if (createResult.error?.includes('already exists')) {
    console.log(`   ℹ️ Profile already exists: ${PROFILE_ID}`);
  } else {
    console.error(`   ❌ Failed to create profile: ${createResult.error}`);
    process.exit(1);
  }

  // Step 2: Get browser context (headless)
  console.log('\n2️⃣ Getting browser context...');
  let context;
  try {
    context = await browserService.getBrowserContext(PROFILE_ID);
    console.log('   ✅ Got browser context');
  } catch (err) {
    console.error(`   ❌ Failed to get context: ${err.message}`);
    process.exit(1);
  }

  // Step 3: Download file
  console.log('\n3️⃣ Downloading file...');
  console.log(`   URL: ${DOWNLOAD_URL}`);

  const page = await context.newPage();

  // Navigate to the file URL - this will trigger a download
  // For raw GitHub URLs, we need to actually fetch and save
  try {
    const response = await page.goto(DOWNLOAD_URL, { waitUntil: 'networkidle' });

    if (response.ok()) {
      // For images, GitHub serves them directly - save from response
      const buffer = await response.body();
      const filename = path.basename(DOWNLOAD_URL);
      const filepath = path.join(DOWNLOAD_DIR, filename);

      fs.writeFileSync(filepath, buffer);
      console.log(`   ✅ Downloaded: ${filename}`);
      console.log(`   📁 Saved to: ${filepath}`);

      // Verify file exists and has content
      const stats = fs.statSync(filepath);
      console.log(`   📊 File size: ${stats.size} bytes`);

      if (stats.size > 0) {
        console.log('\n✅ Download test PASSED!');
      } else {
        console.log('\n❌ Download test FAILED - file is empty');
        process.exit(1);
      }
    } else {
      console.error(`   ❌ Failed to fetch: ${response.status()}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`   ❌ Download failed: ${err.message}`);
    process.exit(1);
  } finally {
    // Cleanup
    await page.close();
    await context.close();
  }

  // Step 4: Cleanup test profile
  console.log('\n4️⃣ Cleaning up...');
  const deleteResult = await browserService.deleteBrowser(PROFILE_ID);
  if (deleteResult.success) {
    console.log(`   ✅ Deleted profile: ${PROFILE_ID}`);
  }

  console.log('\n🎉 All tests passed!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
