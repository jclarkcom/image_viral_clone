const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testImageDescription() {
  try {
    console.log('🔍 Testing image description and text extraction...\n');

    // Use gemini-2.0-flash-exp for vision capabilities
    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Read the image file
    const imagePath = path.join(__dirname, 'image.png');
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Prepare the image for Gemini
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: 'image/png'
      }
    };

    // Ask Gemini to describe the image and extract/translate text
    const prompt = `Please analyze this image and provide:
1. A detailed description of what you see in the image
2. Extract any text found in the image (in its original language)
3. If the text is not in English, provide an English translation
4. Identify the language of any text found

Format your response as JSON with the following structure:
{
  "description": "detailed description of the image",
  "extracted_text": "original text found in the image",
  "text_language": "language of the text",
  "english_translation": "English translation if needed, or null if text is already in English"
}`;

    console.log('📤 Sending image to Gemini for analysis...\n');
    const result = await visionModel.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();

    console.log('📥 Gemini Response:\n');
    console.log(text);

    // Try to parse as JSON
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('\n✅ Parsed Response:');
        console.log('Description:', parsed.description);
        console.log('Extracted Text:', parsed.extracted_text);
        console.log('Language:', parsed.text_language);
        console.log('Translation:', parsed.english_translation);
        return parsed;
      }
    } catch (e) {
      console.log('\nNote: Response is not in JSON format, but that\'s okay for this test.');
    }

    return { raw_response: text };

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response details:', error.response);
    }
    throw error;
  }
}

async function testImageGeneration(description) {
  try {
    console.log('\n\n🎨 Testing image generation with Gemini 2.5 Flash Image (nano-banana)...\n');

    // Use gemini-2.5-flash-image for image generation
    const imageGenModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    // Create a photorealistic prompt based on the description
    const prompt = `Create a photorealistic image: ${description}. Make it highly detailed, professional quality, with realistic lighting and textures.`;

    console.log('📤 Sending prompt for image generation:', prompt);

    const result = await imageGenModel.generateContent(prompt);
    const response = result.response;

    // Check if the response contains image data
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
            console.log('✅ Image generated successfully!');
            console.log('Image data length:', part.inlineData.data.length);

            // Save the generated image
            const outputPath = path.join(__dirname, 'generated_test.png');
            const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
            await fs.writeFile(outputPath, imageBuffer);
            console.log(`💾 Image saved to: ${outputPath}`);

            return part.inlineData.data;
          }
        }
      }
    }

    // If no image data, check the text response
    const text = response.text();
    console.log('Response text:', text);

    throw new Error('No image data found in response');

  } catch (error) {
    console.error('❌ Image generation error:', error.message);

    // Try with the experimental 2.0 flash model as fallback
    console.log('\n🔄 Trying with gemini-2.0-flash-exp as fallback...\n');

    try {
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `Generate a photorealistic image: ${description}`;
      const result = await fallbackModel.generateContent(prompt);
      const response = result.response;

      // Check for image in response
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
              console.log('✅ Image generated with fallback model!');

              // Save the generated image
              const outputPath = path.join(__dirname, 'generated_test_fallback.png');
              const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
              await fs.writeFile(outputPath, imageBuffer);
              console.log(`💾 Image saved to: ${outputPath}`);

              return part.inlineData.data;
            }
          }
        }
      }

      const text = response.text();
      console.log('Fallback response:', text);

    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
    }

    throw error;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Gemini API Tests\n');
  console.log('API Key:', process.env.GEMINI_API_KEY ? '✓ Found' : '✗ Missing');

  try {
    // Test 1: Image description and text extraction
    const analysisResult = await testImageDescription();

    // Test 2: Image generation
    let description = 'a beautiful landscape with mountains and a lake';
    if (analysisResult && analysisResult.description) {
      description = analysisResult.description;
    }

    await testImageGeneration(description);

    console.log('\n\n✅ All tests completed!');

  } catch (error) {
    console.error('\n\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();