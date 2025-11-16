# Image Viral Clone

An AI-powered application that analyzes images, extracts and translates text, and generates photorealistic variations in multiple languages using Google Gemini AI.

## Features

### Image Processing
- **AI-Powered Analysis**: Automatically analyzes uploaded images and extracts text
- **Multilingual Support**: Generates variations in English, French, German, and Portuguese
- **Smart Text Extraction**: Uses Google Gemini Vision to extract and translate text from images
- **Batch Generation**: Creates multiple variations per language simultaneously
- **Editable Descriptions**: Modify AI-generated descriptions before generation

### Video Generation (NEW!)
- **Veo 3.1 Integration**: Generates 8-second videos using Google's latest Veo 3.1 API
- **Aspect Ratio Support**: Portrait, landscape, and square video formats
- **Watermark Support**: Automatic watermarking with FFmpeg (when available)

### Customization Options
- **Font Styles**: Multiple font families including Modern Sans, Elegant Serif, Script, and more
- **Text Sizes**: Small, medium, large, and extra-large text options
- **Orientation**: Portrait, landscape, and square formats
- **Resolution Options**: Multiple resolution presets for both images and videos
- **Watermarks**: Customizable watermark text with adjustable opacity and refresh capability

### Session Management
- **Persistent Storage**: SQLite database for session and image history
- **Session History**: Browse and restore previous generation sessions
- **Cost Tracking**: Real-time cost estimation and tracking for API usage

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory with your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3322
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3322
   ```

## Usage

1. **Upload an Image**: Use any of the available input methods (drag/drop, browse, paste, or URL)

2. **View Analysis**: The app will automatically:
   - Describe the image contents
   - Extract any text found
   - Translate non-English text to English

3. **Configure Generation Settings**:
   - Select which languages to generate (default: all 4 languages)
   - Choose number of variations per language (default: 5)
   - Total images = languages × variations

4. **Generate Variations**: Click "Generate Variations" to create photorealistic images with:
   - Different lighting styles (morning, golden hour, daylight, sunset, ethereal)
   - Translated text overlays in selected languages
   - Professional quality and realistic textures

5. **Download Results**:
   - View all generated images in the grid
   - Download individual images by right-clicking
   - Download all as ZIP using the "Download All" button

## Test Commands

- Quick test of image analysis:
  ```bash
  node test-gemini.js
  ```

- Test multilanguage generation (quick - 2 variations × 2 languages):
  ```bash
  node test-multilang.js --quick
  ```

- Full multilanguage test (5 variations × 4 languages):
  ```bash
  node test-multilang.js
  ```

## Project Structure

```
image_viral_clone/
├── server.js           # Express server with API endpoints
├── test-gemini.js      # Test script for Gemini API
├── test-multilang.js   # Test script for multilanguage generation
├── public/
│   ├── index.html      # Main UI
│   ├── styles.css      # Application styles
│   └── app.js          # Frontend JavaScript
├── uploads/            # Temporary uploaded images
├── generated/          # Generated image variations
├── .env               # Environment variables
└── package.json       # Dependencies
```

## API Endpoints

- `POST /api/load-url` - Load image from URL
- `POST /api/analyze` - Analyze uploaded image
- `POST /api/generate-variations` - Generate image variations
- `GET /api/download-batch/:batchId` - Download all images as ZIP

## Technologies Used

- **Backend**: Node.js, Express
- **AI Models**:
  - Google Gemini 2.0 Flash Experimental (vision and text)
  - Google Gemini 2.5 Flash Image (image generation)
- **Image Processing**: Sharp
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## Notes

- The app uses the latest Google Gemini models for best results
- Rate limiting is implemented to avoid API throttling
- Images are temporarily stored and can be downloaded as a batch
- The UI is responsive and works on mobile devices