const { testCases } = require('./test-suite.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Quick test configuration - focusing on new features
const quickTestCases = [
  'serverHealth',
  'geminiConnectivity',
  'imageAnalysis',
  'invalidUrlHandling',
  'imageGeneration',
  'missingParameters',
  'staticFiles',
  'fileCleanup',
  // New database and session tests
  'databaseConnection',
  'sessionListing',
  'sessionRetrieval',
  'sessionDeletion',
  'orientationResolution',
  'fontStyleParameter',
  'sessionWithImages',
  // New watermark tests
  'watermarkApplication',
  'watermarkCustomText',
  'watermarkRegeneration',
  'watermarkWithTranslation'
];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name, status, error = null) {
  const icon = status === 'passed' ? '✓' : status === 'failed' ? '✗' : '○';
  const color = status === 'passed' ? colors.green : status === 'failed' ? colors.red : colors.yellow;

  log(`  ${icon} ${name}`, color);
  if (error) {
    log(`    Error: ${error}`, colors.red);
  }
}

async function runQuickTests() {
  log('\n🚀 Quick Test Suite - Focus on New Features\n', colors.cyan);
  log(`Server: http://localhost:3322`, colors.blue);
  log(`Starting quick tests...\n`, colors.blue);

  const testResults = {
    passed: [],
    failed: [],
    skipped: [],
    startTime: Date.now(),
    endTime: null
  };

  // Run selected tests
  for (const testName of quickTestCases) {
    if (!testCases[testName]) {
      log(`  ⚠️  Test '${testName}' not found`, colors.yellow);
      continue;
    }

    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout after 30s')), 30000)
      );

      const result = await Promise.race([
        testCases[testName](),
        timeoutPromise
      ]);

      if (result === 'skipped') {
        testResults.skipped.push(testName);
        logTest(testName, 'skipped');
      } else {
        testResults.passed.push(testName);
        logTest(testName, 'passed');
      }
    } catch (error) {
      testResults.failed.push({ name: testName, error: error.message });
      logTest(testName, 'failed', error.message);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  testResults.endTime = Date.now();

  // Display results summary
  const duration = ((testResults.endTime - testResults.startTime) / 1000).toFixed(2);
  const total = quickTestCases.length;
  const passRate = ((testResults.passed.length / total) * 100).toFixed(1);

  log('\n' + '='.repeat(50), colors.cyan);
  log('📊 Quick Test Results Summary', colors.cyan);
  log('='.repeat(50), colors.cyan);

  log(`\n✓ Passed: ${testResults.passed.length}/${total}`, colors.green);
  log(`✗ Failed: ${testResults.failed.length}/${total}`, colors.red);
  log(`○ Skipped: ${testResults.skipped.length}/${total}`, colors.yellow);
  log(`\n⏱️  Duration: ${duration}s`, colors.blue);
  log(`📈 Pass Rate: ${passRate}%`, colors.blue);

  // List failed tests if any
  if (testResults.failed.length > 0) {
    log('\n❌ Failed Tests:', colors.red);
    for (const { name, error } of testResults.failed) {
      log(`  • ${name}: ${error}`, colors.red);
    }
  }

  // List new feature tests that passed
  const newFeatureTests = [
    'databaseConnection',
    'sessionListing',
    'sessionRetrieval',
    'sessionDeletion',
    'orientationResolution',
    'fontStyleParameter',
    'sessionWithImages',
    'watermarkApplication',
    'watermarkCustomText',
    'watermarkRegeneration',
    'watermarkWithTranslation'
  ];

  const passedNewFeatures = newFeatureTests.filter(t => testResults.passed.includes(t));
  if (passedNewFeatures.length > 0) {
    log('\n✨ New Feature Tests Passed:', colors.green);
    for (const test of passedNewFeatures) {
      log(`  • ${test}`, colors.green);
    }
  }

  // Exit with appropriate code
  const exitCode = testResults.failed.length > 0 ? 1 : 0;

  if (exitCode === 0) {
    log('\n✅ All selected tests passed!\n', colors.green);
  } else {
    log('\n⚠️  Some tests failed. Please review and fix.\n', colors.yellow);
  }

  process.exit(exitCode);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runQuickTests().catch(error => {
    log(`\n💥 Test suite crashed: ${error.message}\n`, colors.red);
    console.error(error.stack);
    process.exit(1);
  });
}
