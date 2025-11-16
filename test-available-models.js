// Test to list available models from Google Generative AI
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listAvailableModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    console.log('Checking available models from Google Generative AI...\n');

    try {
        // Test known models
        const modelsToTest = [
            'gemini-pro',
            'gemini-pro-vision',
            'gemini-2.0-flash-exp',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'models/veo-3.1-generate-preview',
            'veo-3.1-generate-preview',
            'imagen-3.0-generate-001',
            'models/imagen-3.0-generate-001'
        ];

        console.log('Testing models:');
        for (const modelName of modelsToTest) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                console.log(`✅ ${modelName} - Available`);
            } catch (error) {
                console.log(`❌ ${modelName} - Not available`);
            }
        }

        // Try to list all models
        console.log('\nAttempting to list all models...');

        // Make a direct API call to list models
        const apiKey = process.env.GEMINI_API_KEY;
        const fetch = require('node-fetch');

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (response.ok) {
            const data = await response.json();
            console.log('\nAvailable models from API:');
            if (data.models) {
                data.models.forEach(model => {
                    console.log(`- ${model.name}`);
                    if (model.supportedGenerationMethods) {
                        console.log(`  Supported methods: ${model.supportedGenerationMethods.join(', ')}`);
                    }
                });
            }
        } else {
            console.log('Could not fetch model list from API');
        }

    } catch (error) {
        console.error('Error listing models:', error.message);
    }
}

listAvailableModels();