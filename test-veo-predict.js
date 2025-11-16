// Test video generation using predictLongRunning method
const fetch = require('node-fetch');
require('dotenv').config();

async function testVeoPredictLongRunning() {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('Testing Veo 3.1 video generation via predictLongRunning...\n');

    try {
        console.log('Attempting to generate video with predictLongRunning...');

        // Using the predictLongRunning endpoint
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [{
                    prompt: "A beautiful garden with blooming flowers, butterflies flying around, 8 seconds, high quality cinematic video"
                }],
                parameters: {
                    duration: 8,
                    resolution: "1280x720",
                    aspectRatio: "16:9"
                }
            })
        });

        const responseText = await response.text();
        console.log('Response status:', response.status);

        try {
            const data = JSON.parse(responseText);
            console.log('Response:', JSON.stringify(data, null, 2));

            // If we get an operation, poll for completion
            if (data.name) {
                console.log('\nOperation started:', data.name);
                console.log('This is a long-running operation. In production, you would poll for completion.');

                // Try to get operation status
                const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${data.name}?key=${apiKey}`);
                const statusData = await statusResponse.json();
                console.log('\nOperation status:', JSON.stringify(statusData, null, 2));
            }
        } catch (e) {
            console.log('Response text:', responseText);
        }
    } catch (error) {
        console.error('Error with video generation:', error.message);
    }

    // Try another format based on Vertex AI documentation
    console.log('\n\nTrying Vertex AI format...');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predict?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [{
                    prompt: "A serene lake at sunset with mountains in the background"
                }],
                parameters: {
                    sampleCount: 1
                }
            })
        });

        console.log('Vertex AI format status:', response.status);
        const responseText = await response.text();

        try {
            const data = JSON.parse(responseText);
            console.log('Vertex AI response:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('Vertex AI response text:', responseText);
        }
    } catch (error) {
        console.error('Error with Vertex AI format:', error.message);
    }
}

testVeoPredictLongRunning();