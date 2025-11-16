// Test video generation using direct REST API calls
const fetch = require('node-fetch');
require('dotenv').config();

async function testVideoGenerationAPI() {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('Testing Veo 3.1 video generation via REST API...\n');

    // Test 1: Try to generate video using direct API call
    try {
        console.log('Attempting to generate video with Veo 3.1...');

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateVideos?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: "A beautiful sunrise over mountains, 8 seconds, high quality cinematic video",
                videoConfig: {
                    duration: 8,
                    resolution: "1280x720"
                }
            })
        });

        const responseText = await response.text();
        console.log('Response status:', response.status);

        try {
            const data = JSON.parse(responseText);
            console.log('Response:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('Response text:', responseText);
        }
    } catch (error) {
        console.error('Error with video generation:', error.message);
    }

    // Test 2: Check if the model supports video generation
    console.log('\nChecking model capabilities...');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview?key=${apiKey}`);

        if (response.ok) {
            const data = await response.json();
            console.log('Model info:', JSON.stringify(data, null, 2));
        } else {
            console.log('Could not fetch model info. Status:', response.status);
        }
    } catch (error) {
        console.error('Error fetching model info:', error.message);
    }

    // Test 3: Try alternative endpoint format
    console.log('\nTrying alternative endpoint format...');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Generate an 8-second video of a beautiful sunset"
                    }]
                }],
                generationConfig: {
                    temperature: 0.8
                }
            })
        });

        console.log('Alternative endpoint status:', response.status);
        const responseText = await response.text();

        try {
            const data = JSON.parse(responseText);
            console.log('Alternative response:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('Alternative response text:', responseText);
        }
    } catch (error) {
        console.error('Error with alternative endpoint:', error.message);
    }
}

testVideoGenerationAPI();