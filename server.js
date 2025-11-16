const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const costCalculator = require('./public/cost-calculator.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3322;

// Initialize SQLite database
const db = new Database('sessions.db');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    extracted_text TEXT,
    text_language TEXT,
    english_translation TEXT
  );

  CREATE TABLE IF NOT EXISTS generated_images (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    language TEXT,
    variation INTEGER,
    style TEXT,
    font_style TEXT,
    orientation TEXT,
    resolution TEXT,
    file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
`);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/generated', express.static('generated'));
app.use('/generated/watermarked', express.static('generated/watermarked'));
app.use('/generated/videos', express.static('generated/videos'));

// Create necessary directories
async function createDirectories() {
  const dirs = ['uploads', 'generated'];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// API Endpoints for Sessions

// Get all sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT s.*, COUNT(g.id) as image_count
      FROM sessions s
      LEFT JOIN generated_images g ON s.id = g.session_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 50
    `).all();

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session details
app.get('/api/sessions/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const images = db.prepare('SELECT * FROM generated_images WHERE session_id = ? ORDER BY language, variation').all(req.params.id);

    res.json({ ...session, images });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    // Get images to delete files
    const images = db.prepare('SELECT file_path FROM generated_images WHERE session_id = ?').all(req.params.id);

    // Delete files
    for (const img of images) {
      try {
        await fs.unlink(img.file_path);
      } catch (e) {
        console.warn('Could not delete file:', img.file_path);
      }
    }

    // Delete from database
    db.prepare('DELETE FROM generated_images WHERE session_id = ?').run(req.params.id);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to load image from URL
app.post('/api/load-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'No URL provided' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log('Fetching image from URL:', url);

    // Fetch the image
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('URL does not point to an image');
    }

    const buffer = await response.buffer();

    // Send the image back to the client
    res.set('Content-Type', contentType);
    res.send(buffer);

  } catch (error) {
    console.error('URL loading error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to analyze image (description and text extraction)
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    console.log('Analyzing image...');

    // Use gemini-2.0-flash-exp for vision capabilities
    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Convert image to base64
    const base64Image = req.file.buffer.toString('base64');

    // Prepare the image for Gemini
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: req.file.mimetype
      }
    };

    // Ask Gemini to describe the image and extract/translate text
    const prompt = `Please analyze this image and provide:
1. A detailed description of what you see in the image (IMPORTANT: Do NOT include or mention any logos, watermarks, brand names, copyright marks, or URLs in the description - focus only on the main subject matter and content)
2. Extract the main meaningful text found in the image (in its original language), but EXCLUDE:
   - Watermarks
   - Logos or brand text
   - URLs or website addresses
   - Copyright notices
3. If the main text is not in English, provide an English translation
4. Identify the language of the main text found

Format your response as JSON with the following structure:
{
  "description": "detailed description of the image content (without logos, watermarks, or URLs)",
  "extracted_text": "main meaningful text from the image (excluding watermarks, URLs, logos)",
  "text_language": "language of the text",
  "english_translation": "English translation if needed, or null if text is already in English"
}`;

    const result = await visionModel.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();

    // Try to parse as JSON
    let analysisResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        analysisResult = { raw_response: text };
      }
    } catch (e) {
      analysisResult = { raw_response: text };
    }

    // Create a new session
    const sessionId = uuidv4();
    const uploadPath = path.join('uploads', `${sessionId}.png`);
    await sharp(req.file.buffer).png().toFile(uploadPath);

    // Save session to database
    const title = analysisResult.extracted_text ?
      analysisResult.extracted_text.substring(0, 50) :
      'Image Analysis ' + new Date().toLocaleDateString();

    db.prepare(`
      INSERT INTO sessions (id, title, description, extracted_text, text_language, english_translation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      title,
      analysisResult.description,
      analysisResult.extracted_text,
      analysisResult.text_language,
      analysisResult.english_translation
    );

    analysisResult.sessionId = sessionId;
    analysisResult.uploadId = sessionId;

    // Add cost tracking information
    const costInfo = costCalculator.calculateAnalysisCost();
    analysisResult.costInfo = {
      model: costInfo.model,
      estimatedCost: costInfo.displayCost,
      breakdown: costCalculator.getCostBreakdown(costInfo)
    };

    res.json(analysisResult);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to generate variations
app.post('/api/generate-variations', async (req, res) => {
  try {
    const {
      description,
      originalText,
      languages = ['english', 'french', 'german', 'portuguese'],
      variationsPerLanguage = 5,
      uploadId,
      sessionId,
      fontStyle = 'sans-serif',
      fontFamily = 'Inter, sans-serif',
      textSize = 'large',
      orientation = 'portrait',
      resolution = '1024x1024',
      watermarkText = 'Gardening Tips and Trick'
    } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'No description provided' });
    }

    console.log(`Generating ${languages.length * variationsPerLanguage} variations...`);

    // Use gemini-2.5-flash-image for image generation
    const imageGenModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    const results = [];
    const batchId = uuidv4();

    // Translation templates
    const translations = {
      english: originalText ? await translateText(originalText, 'English') : "Everything in life is a matter of time. I learned that no matter how difficult, one day... The pain passes, the longing calms, the disappointment teaches, and life goes on...",
      french: originalText ? await translateText(originalText, 'French') : "Tout dans la vie est une question de temps. J'ai appris que peu importe la difficulté, un jour... La douleur passe, le désir s'apaise, la déception enseigne, et la vie continue...",
      german: originalText ? await translateText(originalText, 'German') : "Alles im Leben ist eine Frage der Zeit. Ich habe gelernt, dass egal wie schwierig, eines Tages... Der Schmerz vergeht, die Sehnsucht beruhigt sich, die Enttäuschung lehrt, und das Leben geht weiter...",
      portuguese: originalText ? await translateText(originalText, 'Portuguese') : "Tudo na vida é questão de tempo. Aprendi que por mais difícil, um dia... A dor passa, a saudade acalma, a decepção ensina, e a vida continua..."
    };

    // Translate watermark text for each language
    const watermarkTranslations = {
      english: watermarkText,
      french: await translateText(watermarkText, 'French'),
      german: await translateText(watermarkText, 'German'),
      portuguese: await translateText(watermarkText, 'Portuguese')
    };

    // Style variations
    const styleVariations = [
      'soft morning light with dew drops',
      'golden hour lighting with warm tones',
      'bright daylight with sharp details',
      'romantic sunset lighting',
      'ethereal backlighting with lens flare'
    ];

    // Prepare all image generation tasks
    const imageGenerationTasks = [];
    for (const language of languages) {
      for (let variation = 1; variation <= variationsPerLanguage; variation++) {
        imageGenerationTasks.push({
          language,
          variation,
          style: styleVariations[variation - 1] || styleVariations[0],
          textToOverlay: translations[language]
        });
      }
    }

    // Process images in parallel batches
    const PARALLEL_LIMIT = 10;

    // Helper function to generate a single image
    async function generateSingleImage(task) {
      const { language, variation, style, textToOverlay } = task;

      try {
        // Map font styles to descriptive prompts
        const fontDescriptions = {
          'sans-serif': 'modern clean sans-serif font',
          'serif': 'elegant classic serif font',
          'mono': 'technical monospace font',
          'script': 'flowing script handwriting font',
          'display': 'bold display font',
          'condensed': 'tall condensed font'
        };

        const fontDescription = fontDescriptions[fontStyle] || 'elegant font';

        // Map text sizes to descriptive prompts
        const textSizeDescriptions = {
          'small': 'small, subtle text',
          'medium': 'medium-sized text',
          'large': 'large, prominent text',
          'extra-large': 'very large, bold text'
        };

        const textSizeDescription = textSizeDescriptions[textSize] || 'large, prominent text';

        // Create prompt with orientation and aspect ratio
        const orientationPrompts = {
          portrait: 'vertical orientation, tall aspect ratio',
          landscape: 'horizontal orientation, wide aspect ratio',
          square: 'square format, 1:1 aspect ratio'
        };

        const prompt = `Create a photorealistic image based on: ${description}.
        ${originalText ? `Include this text overlay in ${fontDescription} with ${textSizeDescription}: "${textToOverlay}"` : ''}
        Style: ${style}.
        Format: ${orientationPrompts[orientation] || orientationPrompts.square}.
        Resolution preference: ${resolution}.
        Make it highly detailed, professional quality, with realistic lighting and textures.
        IMPORTANT: Do not add any logos, watermarks, URLs, or brand names to the generated image.`;

        console.log(`Generating ${language} variation ${variation}...`);

        const result = await imageGenModel.generateContent(prompt);
        const response = result.response;

        // Extract image data
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
                // Save the generated image
                const filename = `${batchId}_${language}_v${variation}.png`;
                const outputPath = path.join('generated', filename);
                const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                await fs.writeFile(outputPath, imageBuffer);

                // Save to database
                if (sessionId) {
                  db.prepare(`
                    INSERT INTO generated_images (id, session_id, language, variation, style, font_style, orientation, resolution, file_path)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).run(
                    uuidv4(),
                    sessionId,
                    language,
                    variation,
                    style,
                    fontStyle,
                    orientation,
                    resolution,
                    outputPath
                  );
                }

                return {
                  language,
                  variation,
                  filename,
                  url: `/generated/${filename}`,
                  style,
                  watermarkText: watermarkTranslations[language]
                };
              }
            }
          }
        }

        throw new Error('No image data in response');

      } catch (error) {
        console.error(`Error generating ${language} variation ${variation}:`, error.message);
        return {
          language,
          variation,
          error: error.message
        };
      }
    }

    // Process tasks in batches
    for (let i = 0; i < imageGenerationTasks.length; i += PARALLEL_LIMIT) {
      const batch = imageGenerationTasks.slice(i, i + PARALLEL_LIMIT);
      console.log(`Processing batch ${Math.floor(i / PARALLEL_LIMIT) + 1} of ${Math.ceil(imageGenerationTasks.length / PARALLEL_LIMIT)} (${batch.length} images)...`);

      const batchResults = await Promise.all(
        batch.map(task => generateSingleImage(task))
      );

      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + PARALLEL_LIMIT < imageGenerationTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Calculate cost for image generation
    const costInfo = costCalculator.calculateImageGenerationCost(languages.length, variationsPerLanguage);

    res.json({
      batchId,
      totalRequested: languages.length * variationsPerLanguage,
      successful: results.filter(r => !r.error).length,
      results,
      costInfo: {
        model: costInfo.model,
        estimatedCost: costInfo.displayCost,
        actualGenerations: results.filter(r => !r.error).length,
        breakdown: costCalculator.getCostBreakdown(costInfo)
      }
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to translate text
async function translateText(text, targetLanguage) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const prompt = `Translate the following text to ${targetLanguage}. Return only the translation, nothing else: "${text}"`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error(`Translation error for ${targetLanguage}:`, error);
    return text; // Return original if translation fails
  }
}

// Endpoint to download all generated images as zip
app.get('/api/download-batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const archiver = require('archiver');

    res.attachment(`variations_${batchId}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Find all files for this batch
    const files = await fs.readdir('generated');
    const batchFiles = files.filter(f => f.startsWith(batchId));

    for (const file of batchFiles) {
      const filePath = path.join('generated', file);
      archive.file(filePath, { name: file });
    }

    await archive.finalize();

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to apply watermark to an image
app.post('/api/apply-watermark', async (req, res) => {
  try {
    const { imagePath, watermarkText, opacity = 40, regenerate = false } = req.body;

    if (!imagePath || !watermarkText) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Load the image
    const fullPath = path.join(__dirname, imagePath.startsWith('/') ? imagePath.slice(1) : imagePath);
    const image = await loadImage(fullPath);

    // Create canvas
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw original image
    ctx.drawImage(image, 0, 0);

    // Set watermark style
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;

    // Calculate font size based on image dimensions
    const fontSize = Math.min(image.width, image.height) * 0.04;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Generate random positions for 3 watermarks
    const positions = [];
    for (let i = 0; i < 3; i++) {
      // Ensure watermarks are not too close to edges
      const x = Math.random() * (image.width * 0.8) + (image.width * 0.1);
      const y = Math.random() * (image.height * 0.8) + (image.height * 0.1);

      // Add slight rotation for visual interest
      const rotation = (Math.random() - 0.5) * 0.3; // -0.15 to 0.15 radians

      positions.push({ x, y, rotation });
    }

    // Draw watermarks
    positions.forEach(pos => {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(pos.rotation);

      // Draw text with outline for better visibility
      ctx.strokeText(watermarkText, 0, 0);
      ctx.fillText(watermarkText, 0, 0);

      ctx.restore();
    });

    // Create watermarked file path
    const originalName = path.basename(fullPath, '.png');
    const watermarkedName = `${originalName}_watermarked_${Date.now()}.png`;
    const watermarkedPath = path.join('generated', 'watermarked', watermarkedName);

    // Ensure watermarked directory exists
    await fs.mkdir(path.join('generated', 'watermarked'), { recursive: true });

    // Save watermarked image
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(watermarkedPath, buffer);

    res.json({
      success: true,
      watermarkedUrl: `/generated/watermarked/${watermarkedName}`,
      positions: positions
    });

  } catch (error) {
    console.error('Watermark error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to generate videos using Veo 3
app.post('/api/generate-videos', async (req, res) => {
  try {
    const {
      description,
      originalText,
      languages = ['english', 'french', 'german', 'portuguese'],
      variationsPerLanguage = 1, // For videos, we generate 1 per language due to cost
      uploadId,
      sessionId,
      orientation = 'landscape',
      resolution = '1280x720',
      watermarkText = 'Gardening Tips and Trick',
      mediaType = 'video'
    } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'No description provided' });
    }

    console.log(`Generating ${languages.length * variationsPerLanguage} videos using Veo 3...`);

    // Create batch ID
    const batchId = uuidv4();
    const results = [];

    // Translate text for each language
    const translations = {};
    for (const language of languages) {
      if (originalText) {
        translations[language] = language === 'english' ?
          originalText :
          await translateText(originalText, language.charAt(0).toUpperCase() + language.slice(1));
      }
    }

    // Translate watermark text for each language
    const watermarkTranslations = {};
    for (const language of languages) {
      watermarkTranslations[language] = language === 'english' ?
        watermarkText :
        await translateText(watermarkText, language.charAt(0).toUpperCase() + language.slice(1));
    }

    // Generate videos for each language using Veo 3.1's predictLongRunning endpoint
    for (const language of languages) {
      try {
        // Create video generation prompt
        const videoPrompt = `Create a high-quality video based on: ${description}.
        ${originalText ? `Include overlay text: "${translations[language]}"` : ''}
        Style: Cinematic, professional quality video with smooth camera movements.
        Language context: ${language}
        Duration: 8 seconds
        Orientation: ${orientation}
        Include natural ambient sounds and audio effects that match the scene.`;

        console.log(`Starting ${language} video generation...`);

        // Use direct API call for Veo 3.1 predictLongRunning
        const apiKey = process.env.GEMINI_API_KEY;
        const fetch = require('node-fetch');

        // Start video generation operation
        const startResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              instances: [{
                prompt: videoPrompt
              }],
              parameters: {
                aspectRatio: orientation === 'landscape' ? '16:9' : orientation === 'portrait' ? '9:16' : '1:1'
              }
            })
          }
        );

        if (!startResponse.ok) {
          const error = await startResponse.json();
          throw new Error(error.error?.message || 'Failed to start video generation');
        }

        const operationData = await startResponse.json();
        console.log(`Video generation operation started for ${language}: ${operationData.name}`);

        // Poll for completion (simplified for now - in production would need better polling)
        let videoData = null;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes with 5-second intervals

        while (attempts < maxAttempts && !videoData) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

          const statusResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationData.name}?key=${apiKey}`
          );
          const status = await statusResponse.json();

          if (status.done) {
            if (status.response) {
              // Handle the actual generateVideoResponse format
              if (status.response.generateVideoResponse &&
                  status.response.generateVideoResponse.generatedSamples &&
                  status.response.generateVideoResponse.generatedSamples.length > 0) {
                // Store the video object which contains the URI
                videoData = status.response.generateVideoResponse.generatedSamples[0].video;
              }
            }

            if (status.error) {
              throw new Error(status.error.message || 'Video generation failed');
            }
            break;
          }
          attempts++;
          console.log(`Polling ${language} video (attempt ${attempts}/${maxAttempts})...`);
        }

        if (!videoData) {
          throw new Error('Video generation timed out or no video data returned');
        }

        // Save video file
        const filename = `${batchId}_${language}.mp4`;
        const outputPath = path.join('generated', 'videos', filename);

        // Ensure videos directory exists
        await fs.mkdir(path.join('generated', 'videos'), { recursive: true });

        // Save video data - the video object contains a uri property
        if (videoData.uri) {
          // Download from the provided URI (includes API key for authentication)
          const videoUrl = videoData.uri.includes('?') ?
            `${videoData.uri}&key=${apiKey}` :
            `${videoData.uri}?key=${apiKey}`;

          const videoResponse = await fetch(videoUrl);
          if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
          }
          const videoBuffer = await videoResponse.buffer();
          await fs.writeFile(outputPath, videoBuffer);
          console.log(`Video downloaded and saved for ${language}`);
        } else if (videoData.bytesBase64Encoded) {
          // Fallback for base64 encoded data
          const videoBuffer = Buffer.from(videoData.bytesBase64Encoded, 'base64');
          await fs.writeFile(outputPath, videoBuffer);
          console.log(`Video saved for ${language}`);
        } else {
          console.log('Video data structure:', Object.keys(videoData));
          throw new Error('No video URI or data in expected format');
        }

        // Apply watermark using ffmpeg if needed
        let finalFilename = filename;
        let finalPath = outputPath;

        if (watermarkText) {
          const watermarkedFilename = `${batchId}_${language}_watermarked.mp4`;
          const watermarkedPath = path.join('generated', 'videos', watermarkedFilename);

          // FFmpeg command to add watermark text
          const ffmpegCommand = `ffmpeg -i "${outputPath}" -vf "drawtext=text='${watermarkTranslations[language]}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=h-50" -codec:a copy "${watermarkedPath}" -y`;

          try {
            // Execute ffmpeg command
            await execPromise(ffmpegCommand);
            console.log(`Watermark applied to ${language} video`);
            finalFilename = watermarkedFilename;
            finalPath = watermarkedPath;
          } catch (ffmpegError) {
            console.error(`FFmpeg error for ${language} video:`, ffmpegError.message);
            // Continue without watermark if ffmpeg fails
          }
        }

        results.push({
          language,
          filename: finalFilename,
          url: `/generated/videos/${finalFilename}`,
          watermarkText: watermarkTranslations[language]
        });

      } catch (error) {
        console.error(`Error generating ${language} video:`, error.message);
        results.push({
          language,
          error: error.message
        });
      }

      // Add delay between video generations to avoid rate limiting
      if (languages.indexOf(language) < languages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Calculate cost for video generation
    const costInfo = costCalculator.calculateVideoGenerationCost(languages.length, variationsPerLanguage);

    res.json({
      batchId,
      mediaType: 'video',
      totalRequested: languages.length * variationsPerLanguage,
      successful: results.filter(r => !r.error).length,
      results,
      costInfo: {
        model: costInfo.model,
        estimatedCost: costInfo.displayCost,
        actualGenerations: results.filter(r => !r.error).length,
        breakdown: costCalculator.getCostBreakdown(costInfo)
      }
    });

  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extend videos from 8 seconds to 10 seconds
app.post('/api/extend-videos', async (req, res) => {
  try {
    const { batchId } = req.body;

    if (!batchId) {
      return res.status(400).json({ error: 'Batch ID is required' });
    }

    // Find all video files for this batch
    const videosDir = path.join('generated', 'videos');
    const files = await fs.readdir(videosDir);
    const batchVideos = files.filter(f => f.startsWith(batchId) && f.endsWith('.mp4'));

    if (batchVideos.length === 0) {
      return res.status(404).json({ error: 'No videos found for this batch' });
    }

    const results = [];

    for (const videoFile of batchVideos) {
      const inputPath = path.join(videosDir, videoFile);
      const outputFilename = videoFile.replace('.mp4', '_extended.mp4');
      const outputPath = path.join(videosDir, outputFilename);

      try {
        console.log(`Extending video: ${videoFile}`);

        // FFmpeg command to extend video from 8 to 10 seconds
        // Using setpts to slow down video by 1.25x (8 * 1.25 = 10)
        // atempo filter to slow audio from 8s to 10s (factor 0.8 = 8/10)
        // Force exact 10 second duration with -t 10
        const ffmpegCommand = `ffmpeg -i "${inputPath}" -filter_complex "[0:v]setpts=1.25*PTS,fps=30[v];[0:a]atempo=0.8,apad=whole_dur=10[a]" -map "[v]" -map "[a]" -t 10 -r 30 "${outputPath}" -y`;

        await execPromise(ffmpegCommand);
        console.log(`Successfully extended ${videoFile} to 10 seconds`);

        results.push({
          original: videoFile,
          extended: outputFilename,
          url: `/generated/videos/${outputFilename}`,
          success: true
        });

      } catch (error) {
        console.error(`Error extending ${videoFile}:`, error.message);

        // Fallback: Try simpler method without audio if complex filter fails
        try {
          console.log(`Trying simpler extension method for ${videoFile}`);
          // Use setpts to slow down to 1.25x, then force exact 10 second duration
          const simpleFfmpegCommand = `ffmpeg -i "${inputPath}" -filter:v "setpts=1.25*PTS" -an -t 10 -r 30 "${outputPath}" -y`;
          await execPromise(simpleFfmpegCommand);

          results.push({
            original: videoFile,
            extended: outputFilename,
            url: `/generated/videos/${outputFilename}`,
            success: true,
            note: 'Extended without audio processing'
          });
        } catch (fallbackError) {
          results.push({
            original: videoFile,
            error: error.message,
            success: false
          });
        }
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      batchId,
      totalVideos: batchVideos.length,
      successful,
      failed,
      results
    });

  } catch (error) {
    console.error('Video extension error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to translate text
async function translateText(text, targetLanguage) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const prompt = `Translate the following text to ${targetLanguage}: "${text}"
    Return only the translated text without any explanation or quotes.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text().trim();
  } catch (error) {
    console.error(`Translation error:`, error);
    return text; // Return original if translation fails
  }
}

// Start server
async function startServer() {
  await createDirectories();
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 Upload images to analyze and generate variations`);
    console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? '✓ Configured' : '✗ Missing'}`);
    console.log(`🎬 Video generation with Veo 3: Enabled`);
  });
}

startServer().catch(console.error);