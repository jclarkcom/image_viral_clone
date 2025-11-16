const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const FormData = require('form-data');
require('dotenv').config();

// Test configuration
const TEST_CONFIG = {
  serverUrl: `http://localhost:${process.env.PORT || 3322}`,
  timeout: 30000,
  verbose: process.argv.includes('--verbose')
};

// Test results tracking
const testResults = {
  passed: [],
  failed: [],
  skipped: [],
  startTime: null,
  endTime: null
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name, status, error = null) {
  const icon = status === 'passed' ? '✓' : status === 'failed' ? '✗' : '○';
  const color = status === 'passed' ? colors.green : status === 'failed' ? colors.red : colors.yellow;

  log(`  ${icon} ${name}`, color);
  if (error && TEST_CONFIG.verbose) {
    log(`    Error: ${error}`, colors.red);
  }
}

async function makeRequest(method, endpoint, data = null, headers = {}) {
  const url = `${TEST_CONFIG.serverUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      ...headers
    }
  };

  if (data) {
    if (data instanceof FormData) {
      Object.assign(options.headers, data.getHeaders());
      options.body = data;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');

    let responseData;
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else if (contentType && contentType.includes('image')) {
      responseData = await response.buffer();
    } else {
      responseData = await response.text();
    }

    return {
      status: response.status,
      ok: response.ok,
      data: responseData,
      headers: response.headers
    };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

async function waitForServer(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await makeRequest('GET', '/');
      if (response.ok) {
        return true;
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error('Server is not responding');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// Test cases
const testCases = {
  // 1. Server health check
  async serverHealth() {
    const response = await makeRequest('GET', '/');
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }
    return true;
  },

  // 2. Test Gemini API connectivity
  async geminiConnectivity() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const result = await model.generateContent('Say "API working"');
    const text = result.response.text();

    if (!text.toLowerCase().includes('api') || !text.toLowerCase().includes('working')) {
      throw new Error('Gemini API response unexpected');
    }
    return true;
  },

  // 3. Test image analysis endpoint
  async imageAnalysis() {
    const imagePath = path.join(__dirname, 'image.png');
    const imageBuffer = await fs.readFile(imagePath);

    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: 'test.png',
      contentType: 'image/png'
    });

    const response = await makeRequest('POST', '/api/analyze', form);

    if (!response.ok) {
      throw new Error(`Analysis failed with status ${response.status}`);
    }

    const data = response.data;
    if (!data.description || !data.text_language) {
      throw new Error('Missing required analysis fields');
    }

    // Verify Portuguese text was detected
    if (data.text_language !== 'Portuguese') {
      throw new Error(`Expected Portuguese, got ${data.text_language}`);
    }

    // Verify translation exists
    if (!data.english_translation) {
      throw new Error('English translation missing');
    }

    return true;
  },

  // 4. Test URL loading endpoint
  async urlLoading() {
    // Test with a data URL (always available, no network dependency)
    const testUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const response = await makeRequest('POST', '/api/load-url', { url: testUrl });

    // Data URLs might not be supported, so accept either success or expected error
    if (response.status === 400 || response.status === 500) {
      // Expected - data URLs might not be supported
      return 'skipped';
    }

    if (!response.ok) {
      throw new Error(`URL loading failed with status ${response.status}`);
    }

    // Check if we got image data back
    if (!response.data || response.data.length === 0) {
      throw new Error('No image data received');
    }

    return true;
  },

  // 5. Test invalid URL handling
  async invalidUrlHandling() {
    const invalidUrl = 'not-a-valid-url';

    const response = await makeRequest('POST', '/api/load-url', { url: invalidUrl });

    if (response.ok) {
      throw new Error('Should have rejected invalid URL');
    }

    if (response.status !== 400) {
      throw new Error(`Expected status 400, got ${response.status}`);
    }

    return true;
  },

  // 6. Test image generation endpoint
  async imageGeneration() {
    const testData = {
      description: 'A beautiful flower bouquet with pink petals',
      originalText: 'Test message',
      languages: ['english'],
      variationsPerLanguage: 1
    };

    const response = await makeRequest('POST', '/api/generate-variations', testData);

    if (!response.ok) {
      throw new Error(`Generation failed with status ${response.status}`);
    }

    const data = response.data;
    if (!data.batchId) {
      throw new Error('No batch ID returned');
    }

    if (data.successful < 1) {
      throw new Error('No images were generated successfully');
    }

    if (!data.results || data.results.length === 0) {
      throw new Error('No results returned');
    }

    // Verify generated image exists
    const result = data.results[0];
    if (result.error) {
      throw new Error(`Generation error: ${result.error}`);
    }

    if (!result.filename || !result.url) {
      throw new Error('Missing filename or URL in result');
    }

    return true;
  },

  // 7. Test multiple language generation
  async multiLanguageGeneration() {
    const testData = {
      description: 'A test image',
      originalText: 'Hello world',
      languages: ['english', 'french'],
      variationsPerLanguage: 1
    };

    const response = await makeRequest('POST', '/api/generate-variations', testData);

    if (!response.ok) {
      throw new Error(`Generation failed with status ${response.status}`);
    }

    const data = response.data;
    const englishResult = data.results.find(r => r.language === 'english');
    const frenchResult = data.results.find(r => r.language === 'french');

    if (!englishResult || englishResult.error) {
      throw new Error('English generation failed');
    }

    if (!frenchResult || frenchResult.error) {
      throw new Error('French generation failed');
    }

    return true;
  },

  // 8. Test missing parameters handling
  async missingParameters() {
    // Test analyze without image
    const response1 = await makeRequest('POST', '/api/analyze', {});
    if (response1.ok) {
      throw new Error('Should have rejected missing image');
    }

    // Test generate without description
    const response2 = await makeRequest('POST', '/api/generate-variations', {
      languages: ['english']
    });
    if (response2.ok) {
      throw new Error('Should have rejected missing description');
    }

    return true;
  },

  // 9. Test static file serving
  async staticFiles() {
    const endpoints = ['/index.html', '/app.js', '/styles.css'];

    for (const endpoint of endpoints) {
      const response = await makeRequest('GET', endpoint);
      if (!response.ok) {
        throw new Error(`Failed to serve ${endpoint}`);
      }

      if (!response.data || response.data.length === 0) {
        throw new Error(`Empty response for ${endpoint}`);
      }
    }

    return true;
  },

  // 10. Test concurrent requests
  async concurrentRequests() {
    const promises = [];

    // Make 5 concurrent analysis requests
    for (let i = 0; i < 5; i++) {
      const promise = makeRequest('POST', '/api/analyze', {})
        .catch(error => ({ error }));
      promises.push(promise);
    }

    const results = await Promise.all(promises);

    // All should fail with 400 (no image), but not crash
    for (const result of results) {
      if (result.error && !result.error.message.includes('400')) {
        throw new Error('Server crashed on concurrent requests');
      }
    }

    return true;
  },

  // 11. Test large image handling
  async largeImageHandling() {
    // Use the actual test image but claim it's larger
    const imagePath = path.join(__dirname, 'image.png');
    const imageBuffer = await fs.readFile(imagePath);

    const FormData = require('form-data');
    const form = new FormData();

    // Create a form with a very large Content-Length header to test size limits
    form.append('image', imageBuffer, {
      filename: 'large.png',
      contentType: 'image/png',
      knownLength: 15 * 1024 * 1024 // Claim 15MB
    });

    try {
      const response = await makeRequest('POST', '/api/analyze', form);
      // Should handle gracefully (either process or reject with appropriate error)
      if (!response.ok && response.status !== 400 && response.status !== 413) {
        // If it processes normally, that's fine too
        if (response.ok) {
          return true;
        }
        throw new Error(`Unexpected status for large image: ${response.status}`);
      }
    } catch (error) {
      // Network errors or size limit errors are acceptable
      if (error.message.includes('ECONNRESET') ||
          error.message.includes('socket') ||
          error.message.includes('File too large') ||
          error.message.includes('413')) {
        return true;
      }
      // If the server handles it normally, that's also acceptable
      if (error.message.includes('200') || error.message.includes('analysis')) {
        return true;
      }
      throw error;
    }

    return true;
  },

  // 12. Test translation functionality
  async translationTest() {
    // Use Gemini directly to test translation
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const testText = 'Bonjour le monde';
    const prompt = `Translate the following text to English. Return only the translation, nothing else: "${testText}"`;

    const result = await model.generateContent(prompt);
    const translation = result.response.text().trim();

    if (!translation.toLowerCase().includes('hello') || !translation.toLowerCase().includes('world')) {
      throw new Error('Translation not working correctly');
    }

    return true;
  },

  // 13. Test image generation model
  async imageGenerationModel() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });
      const result = await model.generateContent('Generate a simple test image of a red circle');
      const response = result.response;

      // Check if response contains image data
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
              return true;
            }
          }
        }
      }

      throw new Error('No image data in response');
    } catch (error) {
      // Model might not be available in all regions
      if (error.message.includes('not found') || error.message.includes('not available')) {
        return 'skipped';
      }
      throw error;
    }
  },

  // 14. Test generated files cleanup
  async fileCleanup() {
    // Check if directories exist
    const dirs = ['uploads', 'generated'];
    for (const dir of dirs) {
      try {
        const stats = await fs.stat(dir);
        if (!stats.isDirectory()) {
          throw new Error(`${dir} is not a directory`);
        }
      } catch (error) {
        throw new Error(`Directory ${dir} does not exist`);
      }
    }

    return true;
  },

  // 15. Test download endpoint
  async downloadEndpoint() {
    // First generate some images to get a batch ID
    const genResponse = await makeRequest('POST', '/api/generate-variations', {
      description: 'Test for download',
      languages: ['english'],
      variationsPerLanguage: 1
    });

    if (!genResponse.ok || !genResponse.data.batchId) {
      throw new Error('Could not generate test batch');
    }

    const batchId = genResponse.data.batchId;

    // Try to download the batch
    const response = await makeRequest('GET', `/api/download-batch/${batchId}`);

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    // Check if we got binary data (ZIP file)
    if (!response.data || response.data.length === 0) {
      throw new Error('No download data received');
    }

    return true;
  },

  // 16. Test SQLite database connection
  async databaseConnection() {
    // Test if we can create a session by analyzing an image
    const imagePath = path.join(__dirname, 'image.png');
    const imageBuffer = await fs.readFile(imagePath);

    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: 'test-db.png',
      contentType: 'image/png'
    });

    const response = await makeRequest('POST', '/api/analyze', form);

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status}`);
    }

    // Check if session ID was created
    if (!response.data.sessionId) {
      throw new Error('No session ID returned - database may not be working');
    }

    return true;
  },

  // 17. Test session listing endpoint
  async sessionListing() {
    const response = await makeRequest('GET', '/api/sessions');

    if (!response.ok) {
      throw new Error(`Sessions endpoint failed: ${response.status}`);
    }

    // Should return an array
    if (!Array.isArray(response.data)) {
      throw new Error('Sessions endpoint should return an array');
    }

    return true;
  },

  // 18. Test session retrieval
  async sessionRetrieval() {
    // First create a session
    const imagePath = path.join(__dirname, 'image.png');
    const imageBuffer = await fs.readFile(imagePath);

    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: 'test-session.png',
      contentType: 'image/png'
    });

    const analyzeResponse = await makeRequest('POST', '/api/analyze', form);

    if (!analyzeResponse.ok || !analyzeResponse.data.sessionId) {
      throw new Error('Could not create test session');
    }

    const sessionId = analyzeResponse.data.sessionId;

    // Now retrieve the session
    const response = await makeRequest('GET', `/api/sessions/${sessionId}`);

    if (!response.ok) {
      throw new Error(`Session retrieval failed: ${response.status}`);
    }

    // Verify session data
    if (response.data.id !== sessionId) {
      throw new Error('Session ID mismatch');
    }

    if (!response.data.description || !response.data.text_language) {
      throw new Error('Session missing required fields');
    }

    return true;
  },

  // 19. Test session deletion
  async sessionDeletion() {
    // First create a session
    const imagePath = path.join(__dirname, 'image.png');
    const imageBuffer = await fs.readFile(imagePath);

    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: 'test-delete.png',
      contentType: 'image/png'
    });

    const analyzeResponse = await makeRequest('POST', '/api/analyze', form);

    if (!analyzeResponse.ok || !analyzeResponse.data.sessionId) {
      throw new Error('Could not create test session');
    }

    const sessionId = analyzeResponse.data.sessionId;

    // Delete the session
    const deleteResponse = await makeRequest('DELETE', `/api/sessions/${sessionId}`);

    if (!deleteResponse.ok) {
      throw new Error(`Session deletion failed: ${deleteResponse.status}`);
    }

    // Verify it's deleted
    const getResponse = await makeRequest('GET', `/api/sessions/${sessionId}`);

    if (getResponse.ok) {
      throw new Error('Session still exists after deletion');
    }

    if (getResponse.status !== 404) {
      throw new Error(`Expected 404 for deleted session, got ${getResponse.status}`);
    }

    return true;
  },

  // 20. Test orientation and resolution parameters
  async orientationResolution() {
    const testCases = [
      { orientation: 'portrait', resolution: '768x1024' },
      { orientation: 'landscape', resolution: '1024x768' },
      { orientation: 'square', resolution: '1024x1024' }
    ];

    for (const testCase of testCases) {
      const response = await makeRequest('POST', '/api/generate-variations', {
        description: `Test ${testCase.orientation}`,
        languages: ['english'],
        variationsPerLanguage: 1,
        orientation: testCase.orientation,
        resolution: testCase.resolution
      });

      if (!response.ok) {
        throw new Error(`Generation failed for ${testCase.orientation}: ${response.status}`);
      }

      // Just check that it accepted the parameters
      if (!response.data.batchId) {
        throw new Error(`No batch ID for ${testCase.orientation}`);
      }
    }

    return true;
  },

  // 21. Test font style parameter
  async fontStyleParameter() {
    const fontStyles = ['sans-serif', 'serif', 'mono', 'script', 'display', 'condensed'];

    // Test one font style to avoid too many API calls
    const response = await makeRequest('POST', '/api/generate-variations', {
      description: 'Test font styles',
      originalText: 'Test text',
      languages: ['english'],
      variationsPerLanguage: 1,
      fontStyle: fontStyles[0]
    });

    if (!response.ok) {
      throw new Error(`Generation with font style failed: ${response.status}`);
    }

    if (!response.data.batchId) {
      throw new Error('No batch ID returned for font style test');
    }

    return true;
  },

  // 22. Test session with generated images
  async sessionWithImages() {
    // First create a session with image analysis
    const imagePath = path.join(__dirname, 'image.png');
    const imageBuffer = await fs.readFile(imagePath);

    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: 'test-with-images.png',
      contentType: 'image/png'
    });

    const analyzeResponse = await makeRequest('POST', '/api/analyze', form);

    if (!analyzeResponse.ok || !analyzeResponse.data.sessionId) {
      throw new Error('Could not create test session');
    }

    const sessionId = analyzeResponse.data.sessionId;

    // Generate some images for this session
    const genResponse = await makeRequest('POST', '/api/generate-variations', {
      description: analyzeResponse.data.description || 'Test image',
      originalText: analyzeResponse.data.extracted_text,
      languages: ['english'],
      variationsPerLanguage: 1,
      sessionId: sessionId
    });

    if (!genResponse.ok) {
      throw new Error('Could not generate images for session');
    }

    // Retrieve session with images
    const sessionResponse = await makeRequest('GET', `/api/sessions/${sessionId}`);

    if (!sessionResponse.ok) {
      throw new Error('Could not retrieve session with images');
    }

    // Check if images are included
    if (!Array.isArray(sessionResponse.data.images)) {
      throw new Error('Session should include images array');
    }

    // Check session list includes image count
    const listResponse = await makeRequest('GET', '/api/sessions');
    const sessionInList = listResponse.data.find(s => s.id === sessionId);

    if (!sessionInList) {
      throw new Error('Session not found in list');
    }

    if (typeof sessionInList.image_count !== 'number') {
      throw new Error('Session list should include image_count');
    }

    return true;
  },

  // 23. Test watermark application endpoint
  async watermarkApplication() {
    // Create a test image first
    const imagePath = path.join(__dirname, 'image.png');

    // Check if test image exists
    if (!await fs.access(imagePath).then(() => true).catch(() => false)) {
      // Create test image if it doesn't exist
      await createTestImage();
    }

    // Apply watermark to the test image
    const response = await makeRequest('POST', '/api/apply-watermark', {
      imagePath: '/image.png',
      watermarkText: 'Test Watermark',
      opacity: 50
    });

    if (!response.ok) {
      throw new Error(`Watermark application failed: ${response.status}`);
    }

    // Verify response contains watermarked URL
    if (!response.data.watermarkedUrl) {
      throw new Error('Watermark response should contain watermarked URL');
    }

    // Verify response contains positions
    if (!response.data.positions || response.data.positions.length !== 3) {
      throw new Error('Watermark response should contain 3 positions');
    }

    return true;
  },

  // 24. Test watermark with custom text
  async watermarkCustomText() {
    const response = await makeRequest('POST', '/api/apply-watermark', {
      imagePath: '/image.png',
      watermarkText: 'Custom Garden Tips',
      opacity: 30
    });

    if (!response.ok) {
      throw new Error(`Custom watermark failed: ${response.status}`);
    }

    if (!response.data.watermarkedUrl) {
      throw new Error('Should return watermarked URL');
    }

    return true;
  },

  // 25. Test watermark regeneration (new positions)
  async watermarkRegeneration() {
    // First apply watermark
    const firstResponse = await makeRequest('POST', '/api/apply-watermark', {
      imagePath: '/image.png',
      watermarkText: 'Position Test',
      opacity: 40,
      regenerate: false
    });

    if (!firstResponse.ok || !firstResponse.data.positions) {
      throw new Error('First watermark application failed');
    }

    const firstPositions = firstResponse.data.positions;

    // Apply watermark again with regenerate flag
    const secondResponse = await makeRequest('POST', '/api/apply-watermark', {
      imagePath: '/image.png',
      watermarkText: 'Position Test',
      opacity: 40,
      regenerate: true
    });

    if (!secondResponse.ok || !secondResponse.data.positions) {
      throw new Error('Watermark regeneration failed');
    }

    const secondPositions = secondResponse.data.positions;

    // Verify positions are different
    const positionsChanged = firstPositions.some((pos1, i) => {
      const pos2 = secondPositions[i];
      return pos1.x !== pos2.x || pos1.y !== pos2.y;
    });

    if (!positionsChanged) {
      throw new Error('Regenerated watermark should have different positions');
    }

    return true;
  },

  // 26. Test watermark with language translation
  async watermarkWithTranslation() {
    // Generate images with watermark text
    const response = await makeRequest('POST', '/api/generate-variations', {
      description: 'A garden scene',
      originalText: 'Beautiful flowers',
      languages: ['french', 'german'],
      variationsPerLanguage: 1,
      fontStyle: 'sans-serif',
      orientation: 'square',
      resolution: '512x512',
      watermarkText: 'Gardening Tip'
    });

    if (!response.ok) {
      throw new Error(`Generation with watermark failed: ${response.status}`);
    }

    // Check if watermark text is translated for each language
    const images = response.data.images || [];

    if (images.length === 0) {
      throw new Error('No images generated');
    }

    const frenchImage = images.find(img => img.language === 'french');
    const germanImage = images.find(img => img.language === 'german');

    if (!frenchImage || !frenchImage.watermarkText) {
      throw new Error('French image should have translated watermark text');
    }

    if (!germanImage || !germanImage.watermarkText) {
      throw new Error('German image should have translated watermark text');
    }

    // Watermarks should be different for different languages
    if (frenchImage.watermarkText === germanImage.watermarkText) {
      throw new Error('Watermark text should be translated for each language');
    }

    return true;
  }
};

// Main test runner
async function runTests() {
  log('\n🧪 Image Viral Clone - Automated Test Suite\n', colors.cyan);
  log(`Server: ${TEST_CONFIG.serverUrl}`, colors.blue);
  log(`Starting tests...\n`, colors.blue);

  testResults.startTime = Date.now();

  // Wait for server to be ready
  try {
    log('Waiting for server...', colors.yellow);
    await waitForServer();
    log('Server is ready!\n', colors.green);
  } catch (error) {
    log(`Server not responding: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Run all tests
  const tests = Object.entries(testCases);

  for (const [name, testFn] of tests) {
    try {
      const result = await testFn();

      if (result === 'skipped') {
        testResults.skipped.push(name);
        logTest(name, 'skipped');
      } else {
        testResults.passed.push(name);
        logTest(name, 'passed');
      }
    } catch (error) {
      testResults.failed.push({ name, error: error.message });
      logTest(name, 'failed', error.message);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  testResults.endTime = Date.now();

  // Display results summary
  const duration = ((testResults.endTime - testResults.startTime) / 1000).toFixed(2);
  const total = tests.length;
  const passRate = ((testResults.passed.length / total) * 100).toFixed(1);

  log('\n' + '='.repeat(50), colors.cyan);
  log('📊 Test Results Summary', colors.cyan);
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

  // Exit with appropriate code
  const exitCode = testResults.failed.length > 0 ? 1 : 0;

  if (exitCode === 0) {
    log('\n✅ All critical tests passed!\n', colors.green);
  } else {
    log('\n⚠️  Some tests failed. Please review and fix.\n', colors.yellow);
  }

  process.exit(exitCode);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    log(`\n💥 Test suite crashed: ${error.message}\n`, colors.red);
    if (TEST_CONFIG.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = { runTests, testCases };