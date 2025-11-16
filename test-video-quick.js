// Quick test for video generation endpoint
const fetch = require('node-fetch');

async function testVideoGenerationQuick() {
    const serverUrl = 'http://localhost:3322';

    console.log('Testing video generation with fixed implementation...\n');

    try {
        console.log('Sending video generation request (this will take 30-60 seconds)...');
        const startTime = Date.now();

        const response = await fetch(`${serverUrl}/api/generate-videos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'A simple bouncing ball animation',
                languages: ['english'],
                variationsPerLanguage: 1,
                orientation: 'landscape',
                watermarkText: 'Test Video'
            }),
            timeout: 120000 // 2 minute timeout
        });

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

        if (response.ok) {
            const data = await response.json();
            console.log(`\n✅ Video generation completed in ${elapsedTime} seconds!`);
            console.log('\nResponse summary:');
            console.log('- Batch ID:', data.batchId);
            console.log('- Successful:', data.successful);
            console.log('- Results:', data.results);

            if (data.results && data.results[0]) {
                const result = data.results[0];
                if (result.url) {
                    console.log('\n✅ Video successfully generated!');
                    console.log('Video URL:', result.url);
                    console.log('Filename:', result.filename);
                } else if (result.error) {
                    console.log('\n❌ Generation failed:', result.error);
                }
            }
        } else {
            console.error(`\n❌ Request failed with status ${response.status}`);
            const text = await response.text();
            console.error('Response:', text);
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

testVideoGenerationQuick();