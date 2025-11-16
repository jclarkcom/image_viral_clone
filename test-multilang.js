const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Translation of the motivational text
const translations = {
  english: {
    text: "Everything in life is a matter of time. I learned that no matter how difficult, one day... The pain passes, the longing calms, the disappointment teaches, and life goes on...",
    lang: "English"
  },
  french: {
    text: "Tout dans la vie est une question de temps. J'ai appris que peu importe la difficulté, un jour... La douleur passe, le désir s'apaise, la déception enseigne, et la vie continue...",
    lang: "French"
  },
  german: {
    text: "Alles im Leben ist eine Frage der Zeit. Ich habe gelernt, dass egal wie schwierig, eines Tages... Der Schmerz vergeht, die Sehnsucht beruhigt sich, die Enttäuschung lehrt, und das Leben geht weiter...",
    lang: "German"
  },
  portuguese: {
    text: "Tudo na vida é questão de tempo. Aprendi que por mais difícil, um dia... A dor passa, a saudade acalma, a decepção ensina, e a vida continua...",
    lang: "Portuguese"
  }
};

async function generateImageWithText(language, variation = 1) {
  try {
    const translation = translations[language];
    console.log(`\n🎨 Generating image ${variation} with ${translation.lang} text...`);

    // Use gemini-2.5-flash-image for image generation
    const imageGenModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    // Create a prompt for a photorealistic image with the text overlay
    const prompt = `Create a photorealistic image of a close-up bouquet of flowers with pink and white Bougainvillea petals. The background should be soft and blurred with pastel colors creating a dreamy atmosphere. Overlay the following motivational text in elegant sans-serif font: "${translation.text}". Make the image highly detailed, professional quality, with realistic lighting and textures. Style variation ${variation}: ${getStyleVariation(variation)}`;

    const result = await imageGenModel.generateContent(prompt);
    const response = result.response;

    // Check if the response contains image data
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
            // Save the generated image
            const outputDir = path.join(__dirname, 'generated');
            await fs.mkdir(outputDir, { recursive: true });

            const outputPath = path.join(outputDir, `${language}_variation_${variation}.png`);
            const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
            await fs.writeFile(outputPath, imageBuffer);
            console.log(`✅ Saved: ${outputPath}`);

            return true;
          }
        }
      }
    }

    throw new Error('No image data found in response');

  } catch (error) {
    console.error(`❌ Error generating ${language} variation ${variation}:`, error.message);
    return false;
  }
}

function getStyleVariation(variation) {
  const styles = [
    'soft morning light with dew drops on petals',
    'golden hour lighting with warm tones',
    'bright daylight with sharp details',
    'romantic sunset lighting with orange and pink hues',
    'ethereal backlighting with lens flare effects'
  ];
  return styles[variation - 1] || styles[0];
}

async function generateAllVariations(languages = ['english', 'french', 'german', 'portuguese'], variationsPerLanguage = 5) {
  console.log('🚀 Starting Multi-Language Image Generation Test\n');
  console.log(`Languages: ${languages.join(', ')}`);
  console.log(`Variations per language: ${variationsPerLanguage}`);
  console.log(`Total images to generate: ${languages.length * variationsPerLanguage}\n`);

  const results = {
    successful: 0,
    failed: 0
  };

  // Generate images for each language
  for (const language of languages) {
    for (let variation = 1; variation <= variationsPerLanguage; variation++) {
      const success = await generateImageWithText(language, variation);
      if (success) {
        results.successful++;
      } else {
        results.failed++;
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n\n📊 Results:');
  console.log(`✅ Successfully generated: ${results.successful} images`);
  console.log(`❌ Failed: ${results.failed} images`);
  console.log(`📁 Images saved in: ${path.join(__dirname, 'generated')}`);
}

// Test with reduced scope first (2 variations per language)
async function runQuickTest() {
  console.log('🔬 Running quick test with 2 variations per language...\n');
  await generateAllVariations(['english', 'french'], 2);
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--quick')) {
    await runQuickTest();
  } else {
    // Full test with all languages and variations
    await generateAllVariations();
  }
}

// Run the test
main().catch(console.error);