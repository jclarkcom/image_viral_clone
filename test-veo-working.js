// Test video generation with correct parameters
const fetch = require('node-fetch');
require('dotenv').config();

async function testVeoWithCorrectParams() {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('Testing Veo 3.1 with various parameter formats...\n');

    // Test 1: Without resolution parameter
    console.log('Test 1: Basic prompt without resolution...');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [{
                    prompt: "A beautiful garden with colorful flowers and butterflies, high quality cinematic video"
                }]
            })
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));

        if (data.name) {
            console.log('\n✅ SUCCESS! Operation started:', data.name);

            // Wait a moment then check status
            console.log('Waiting 2 seconds before checking status...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${data.name}?key=${apiKey}`);
            const statusData = await statusResponse.json();
            console.log('Operation status:', JSON.stringify(statusData, null, 2));
        }
    } catch (error) {
        console.error('Error:', error.message);
    }

    // Test 2: Try with aspect ratio
    console.log('\n\nTest 2: With aspectRatio parameter...');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [{
                    prompt: "A serene mountain lake at sunrise"
                }],
                parameters: {
                    aspectRatio: "16:9"
                }
            })
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }

    // Test 3: Try with videoDuration
    console.log('\n\nTest 3: With videoDuration parameter...');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [{
                    prompt: "Ocean waves crashing on a sandy beach"
                }],
                parameters: {
                    videoDuration: "8s"
                }
            })
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Function to poll for operation completion
async function pollOperation(operationName, apiKey) {
    console.log(`\nPolling operation: ${operationName}`);

    let attempts = 0;
    const maxAttempts = 60; // Poll for up to 5 minutes

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`);
            const data = await response.json();

            if (data.done) {
                console.log('Operation completed!');
                console.log('Result:', JSON.stringify(data, null, 2));
                return data;
            } else {
                console.log(`Attempt ${attempts + 1}: Still processing...`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            }
        } catch (error) {
            console.error('Polling error:', error.message);
        }

        attempts++;
    }

    console.log('Operation timed out');
    return null;
}

testVeoWithCorrectParams();