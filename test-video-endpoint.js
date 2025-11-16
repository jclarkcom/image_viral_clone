// Simple test for video generation endpoint
const fetch = require('node-fetch');

async function testVideoEndpoint() {
    const serverUrl = 'http://localhost:3322';

    console.log('Testing video generation endpoint...');

    try {
        // Test that the endpoint exists
        const response = await fetch(`${serverUrl}/api/generate-videos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'Test video generation',
                languages: ['english'],
                variationsPerLanguage: 1,
                orientation: 'landscape',
                resolution: '1280x720'
            })
        });

        if (response.status === 404) {
            console.error('❌ Video endpoint not found (404)');
            return false;
        }

        // The endpoint exists if we get any response other than 404
        console.log(`✅ Video endpoint exists (Status: ${response.status})`);

        // Try to parse the response
        try {
            const data = await response.json();
            console.log('Response:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('Could not parse response as JSON');
        }

        return true;

    } catch (error) {
        console.error('❌ Failed to reach server:', error.message);
        return false;
    }
}

testVideoEndpoint().then(success => {
    process.exit(success ? 0 : 1);
});