// Complete test for Veo 3.1 video generation with polling
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function generateAndPollVideo() {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('Starting Veo 3.1 video generation with polling...\n');

    try {
        // Start video generation
        console.log('Initiating video generation...');
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [{
                    prompt: "A peaceful garden scene with colorful flowers swaying in a gentle breeze, butterflies flying around, soft sunlight filtering through trees, high quality cinematic video, 8 seconds"
                }],
                parameters: {
                    aspectRatio: "16:9"
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Error starting generation:', error);
            return;
        }

        const data = await response.json();
        console.log('✅ Video generation started!');
        console.log('Operation ID:', data.name);

        // Poll for completion
        const result = await pollOperation(data.name, apiKey);

        if (result && result.response) {
            console.log('\n✅ Video generation complete!');

            // Check what's in the response
            console.log('Response structure:', Object.keys(result.response));

            if (result.response.predictions) {
                console.log('Predictions:', JSON.stringify(result.response.predictions, null, 2));

                // If there's video data, save it
                if (result.response.predictions[0]) {
                    const prediction = result.response.predictions[0];

                    // Check for video URL or base64 data
                    if (prediction.videoUri) {
                        console.log('Video URI:', prediction.videoUri);

                        // Download video
                        await downloadVideo(prediction.videoUri, 'test-video.mp4', apiKey);
                    } else if (prediction.bytesBase64Encoded) {
                        console.log('Found base64 encoded video, saving...');

                        // Save base64 video
                        const videoBuffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
                        await fs.writeFile('generated/videos/test-video.mp4', videoBuffer);
                        console.log('Video saved to generated/videos/test-video.mp4');
                    } else {
                        console.log('Video data format:', Object.keys(prediction));
                    }
                }
            }
        } else if (result && result.error) {
            console.error('Generation failed:', result.error);
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function pollOperation(operationName, apiKey) {
    console.log('\nPolling for completion...');

    let attempts = 0;
    const maxAttempts = 120; // Poll for up to 10 minutes (5 second intervals)

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`);
            const data = await response.json();

            if (data.done) {
                console.log('✅ Operation completed!');
                return data;
            } else {
                // Show progress
                const progress = data.metadata?.progress || 'Processing';
                process.stdout.write(`\rAttempt ${attempts + 1}/${maxAttempts}: ${progress}...`);

                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            }
        } catch (error) {
            console.error('\nPolling error:', error.message);
        }

        attempts++;
    }

    console.log('\n❌ Operation timed out after 10 minutes');
    return null;
}

async function downloadVideo(videoUri, filename, apiKey) {
    try {
        console.log(`Downloading video from ${videoUri}...`);

        // Ensure directory exists
        await fs.mkdir('generated/videos', { recursive: true });

        // If it's a Google Storage URL, we might need authentication
        const response = await fetch(videoUri);

        if (response.ok) {
            const buffer = await response.buffer();
            await fs.writeFile(path.join('generated/videos', filename), buffer);
            console.log(`Video saved to generated/videos/${filename}`);
        } else {
            console.error('Failed to download video:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Download error:', error.message);
    }
}

generateAndPollVideo();