// Test to understand the exact Veo 3.1 response structure
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function testVeoResponseStructure() {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('Testing Veo 3.1 response structure...\n');

    try {
        // Start video generation
        console.log('Starting video generation...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    instances: [{
                        prompt: "A simple 3-second test video of a bouncing ball"
                    }],
                    parameters: {
                        aspectRatio: "16:9"
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            console.error('Error:', error);
            return;
        }

        const data = await response.json();
        console.log('Operation started:', data.name);

        // Poll for completion
        console.log('\nPolling for completion...');
        let attempts = 0;
        const maxAttempts = 120;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));

            const statusResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${data.name}?key=${apiKey}`
            );
            const status = await statusResponse.json();

            if (status.done) {
                console.log('\n✅ Operation completed!');
                console.log('\nFull response structure:');
                console.log(JSON.stringify(status, null, 2));

                // Try to extract video
                if (status.response) {
                    console.log('\n\nResponse keys:', Object.keys(status.response));

                    // Check for generateVideoResponse
                    if (status.response.generateVideoResponse) {
                        const videoResponse = status.response.generateVideoResponse;
                        console.log('\ngenerateVideoResponse keys:', Object.keys(videoResponse));

                        if (videoResponse.generatedVideos) {
                            console.log('\nFound videos:', videoResponse.generatedVideos.length);

                            for (let i = 0; i < videoResponse.generatedVideos.length; i++) {
                                const video = videoResponse.generatedVideos[i];
                                console.log(`\nVideo ${i + 1}:`, Object.keys(video));

                                // Try to save the video
                                if (video.video) {
                                    if (video.video.videoUri) {
                                        console.log('Video URI:', video.video.videoUri);

                                        // Download and save
                                        const videoResponse = await fetch(video.video.videoUri);
                                        if (videoResponse.ok) {
                                            const buffer = await videoResponse.buffer();
                                            const filename = `test-veo-video-${i + 1}.mp4`;
                                            await fs.mkdir('generated/videos', { recursive: true });
                                            await fs.writeFile(path.join('generated/videos', filename), buffer);
                                            console.log(`Saved to generated/videos/${filename}`);
                                        }
                                    } else if (video.video.bytesBase64Encoded) {
                                        console.log('Found base64 video data');
                                        const buffer = Buffer.from(video.video.bytesBase64Encoded, 'base64');
                                        const filename = `test-veo-video-${i + 1}.mp4`;
                                        await fs.mkdir('generated/videos', { recursive: true });
                                        await fs.writeFile(path.join('generated/videos', filename), buffer);
                                        console.log(`Saved to generated/videos/${filename}`);
                                    }
                                }
                            }
                        }
                    }

                    // Check for old format
                    if (status.response.predictions) {
                        console.log('\nPredictions format found');
                        console.log('Predictions:', JSON.stringify(status.response.predictions, null, 2));
                    }
                }

                break;
            }

            attempts++;
            process.stdout.write(`\rAttempt ${attempts}/${maxAttempts}...`);
        }

        if (attempts >= maxAttempts) {
            console.log('\nTimeout reached');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testVeoResponseStructure();