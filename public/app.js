// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const previewContainer = document.getElementById('preview-container');
const previewImage = document.getElementById('preview-image');
const removeImageBtn = document.getElementById('remove-image');

const analysisSection = document.getElementById('analysis-section');
const settingsSection = document.getElementById('settings-section');
const resultsSection = document.getElementById('results-section');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

const generateBtn = document.getElementById('generate-btn');
const downloadAllBtn = document.getElementById('download-all');
const totalImagesSpan = document.getElementById('total-images');
const imagesGrid = document.getElementById('images-grid');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// State
let currentFile = null;
let analysisData = null;
let currentBatchId = null;
let currentSessionId = null;
let generatedImages = [];

// Sidebar elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sessionsList = document.getElementById('sessions-list');
const container = document.querySelector('.container');

// Modal elements
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const modalClose = document.querySelector('.modal-close');
const modalDownload = document.getElementById('modal-download');

// Font selection
const fontSelect = document.getElementById('font-select');
const fontPreviewText = document.getElementById('font-preview-text');

// Initialize
function init() {
    setupEventListeners();
    updateTotalImages();
    setupFontPreview();
    setupModal();
    setupSidebar();
    loadSessions();
    setupOrientationSync();
    setupWatermarkControls();
    setupMediaTypeSelection();

    // Add URL input to upload section
    addUrlInput();
}

// Sidebar Setup
function setupSidebar() {
    // Menu toggle
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        container.classList.toggle('sidebar-open');
        menuToggle.classList.toggle('active');
    });

    // Close sidebar button
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.remove('open');
        container.classList.remove('sidebar-open');
        menuToggle.classList.remove('active');
    });
}

// Load sessions from database
async function loadSessions() {
    try {
        const response = await fetch('/api/sessions');
        if (response.ok) {
            const sessions = await response.json();
            displaySessions(sessions);
        }
    } catch (error) {
        console.error('Failed to load sessions:', error);
    }
}

// Display sessions in sidebar
function displaySessions(sessions) {
    sessionsList.innerHTML = '';

    if (sessions.length === 0) {
        sessionsList.innerHTML = '<p style="text-align: center; color: #6c757d;">No previous sessions</p>';
        return;
    }

    sessions.forEach(session => {
        const sessionItem = document.createElement('div');
        sessionItem.className = 'session-item';
        if (session.id === currentSessionId) {
            sessionItem.classList.add('active');
        }

        const date = new Date(session.created_at).toLocaleDateString();
        sessionItem.innerHTML = `
            <div class="session-title">${session.title || 'Untitled Session'}</div>
            <div class="session-date">${date}</div>
            <div class="session-info">${session.image_count || 0} images</div>
        `;

        sessionItem.addEventListener('click', () => loadSession(session.id));
        sessionsList.appendChild(sessionItem);
    });
}

// Load a specific session
async function loadSession(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (response.ok) {
            const session = await response.json();

            // Update current session
            currentSessionId = sessionId;

            // Display analysis results
            displayAnalysisResults({
                description: session.description,
                extracted_text: session.extracted_text,
                text_language: session.text_language,
                english_translation: session.english_translation,
                sessionId: sessionId
            });

            // Display generated images if any
            if (session.images && session.images.length > 0) {
                resultsSection.classList.remove('hidden');
                const results = session.images.map(img => ({
                    language: img.language,
                    variation: img.variation,
                    style: img.style,
                    url: `/generated/${img.file_path.split('/').pop().split('\\').pop()}`
                }));
                displayGeneratedImages({ results });
            }

            // Update sidebar
            loadSessions();
        }
    } catch (error) {
        console.error('Failed to load session:', error);
    }
}

// Setup orientation and resolution sync
function setupOrientationSync() {
    const orientationRadios = document.querySelectorAll('input[name="orientation"]');
    const resolutionSelect = document.getElementById('resolution-select');

    orientationRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            updateResolutionOptions(radio.value);
        });
    });
}

// Update resolution options based on orientation
function updateResolutionOptions(orientation) {
    const resolutionSelect = document.getElementById('resolution-select');
    const currentValue = resolutionSelect.value;

    let options = '';
    if (orientation === 'portrait') {
        options = `
            <option value="768x1024">768×1024 (Standard)</option>
            <option value="720x1280">720×1280 (HD)</option>
            <option value="1080x1920">1080×1920 (Full HD)</option>
            <option value="512x768">512×768 (Small)</option>
        `;
    } else if (orientation === 'landscape') {
        options = `
            <option value="1024x768">1024×768 (Standard)</option>
            <option value="1280x720">1280×720 (HD)</option>
            <option value="1920x1080">1920×1080 (Full HD)</option>
            <option value="768x512">768×512 (Small)</option>
        `;
    } else { // square
        options = `
            <option value="1024x1024">1024×1024 (Large)</option>
            <option value="768x768">768×768 (Medium)</option>
            <option value="512x512">512×512 (Small)</option>
        `;
    }

    resolutionSelect.innerHTML = options;
}

// Add URL input functionality
function addUrlInput() {
    const uploadSection = document.getElementById('upload-section');
    const dropZoneContainer = dropZone.parentElement;

    // Create URL input section
    const urlSection = document.createElement('div');
    urlSection.className = 'url-input-section';
    urlSection.innerHTML = `
        <div class="divider">
            <span>OR</span>
        </div>
        <div class="url-input-container">
            <input type="url" id="url-input" placeholder="Enter image URL (e.g., https://example.com/image.jpg)">
            <button id="url-load-btn" class="btn btn-secondary">Load from URL</button>
        </div>
        <div id="url-error" class="error-message hidden"></div>
    `;

    dropZoneContainer.appendChild(urlSection);

    // Add URL input event listeners
    const urlInput = document.getElementById('url-input');
    const urlLoadBtn = document.getElementById('url-load-btn');
    const urlError = document.getElementById('url-error');

    urlLoadBtn.addEventListener('click', () => loadImageFromUrl(urlInput.value, urlError));
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadImageFromUrl(urlInput.value, urlError);
        }
    });
}

// Load image from URL
async function loadImageFromUrl(url, errorElement) {
    if (!url) {
        showError(errorElement, 'Please enter a URL');
        return;
    }

    try {
        hideError(errorElement);
        showLoading('Loading image from URL...');

        // Fetch the image through our server
        const response = await fetch('/api/load-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load image');
        }

        const blob = await response.blob();
        const file = new File([blob], 'url-image.jpg', { type: blob.type });

        handleFile(file);
        hideLoading();

        // Clear URL input
        document.getElementById('url-input').value = '';

    } catch (error) {
        hideLoading();
        showError(errorElement, error.message);
    }
}

function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.classList.remove('hidden');
        setTimeout(() => hideError(element), 5000);
    }
}

function hideError(element) {
    if (element) {
        element.classList.add('hidden');
    }
}

// Event Listeners
function setupEventListeners() {
    // Drag and drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Paste from clipboard
    document.addEventListener('paste', handlePaste);

    // Remove image
    removeImageBtn.addEventListener('click', removeImage);

    // Language and variation count changes
    document.querySelectorAll('input[name="language"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateTotalImages);
    });
    document.getElementById('variations-count').addEventListener('change', updateTotalImages);

    // Generate button
    generateBtn.addEventListener('click', generateVariations);

    // Download all button
    downloadAllBtn.addEventListener('click', downloadAll);
}

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// File Handlers
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handlePaste(e) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            handleFile(blob);
            break;
        }
    }
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    currentFile = file;
    displayPreview(file);
    showAnalysisCost();  // Show cost and analyze button instead of auto-analyzing
}

function displayPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewContainer.classList.remove('hidden');
        dropZone.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    currentFile = null;
    analysisData = null;
    previewImage.src = '';
    previewContainer.classList.add('hidden');
    dropZone.style.display = 'block';
    analysisSection.classList.add('hidden');
    settingsSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    fileInput.value = '';
}

// Analysis
async function analyzeImage(file) {
    showLoading('Analyzing image...');

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Analysis failed');
        }

        analysisData = await response.json();
        currentSessionId = analysisData.sessionId;
        displayAnalysisResults(analysisData);

        // Reload sessions to show the new one
        loadSessions();

    } catch (error) {
        console.error('Analysis error:', error);
        alert('Failed to analyze image: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayAnalysisResults(data) {
    document.getElementById('description-text').textContent = data.description || 'No description available';
    document.getElementById('extracted-text').textContent = data.extracted_text || 'No text found';
    document.getElementById('text-language').textContent = data.text_language || 'Unknown';
    document.getElementById('translation-text').textContent = data.english_translation || 'N/A';

    analysisSection.classList.remove('hidden');
    settingsSection.classList.remove('hidden');

    // Setup description edit functionality
    setupDescriptionEdit();
}

// Setup description editing
function setupDescriptionEdit() {
    const descriptionText = document.getElementById('description-text');
    const descriptionEdit = document.getElementById('description-edit');
    const editBtn = document.getElementById('edit-description-btn');
    const saveBtn = document.getElementById('save-description-btn');
    const cancelBtn = document.getElementById('cancel-description-btn');

    if (!editBtn || !saveBtn || !cancelBtn) return;

    // Edit button click
    editBtn.addEventListener('click', () => {
        descriptionEdit.value = descriptionText.textContent;
        descriptionText.classList.add('hidden');
        descriptionEdit.classList.remove('hidden');
        editBtn.classList.add('hidden');
        saveBtn.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
        descriptionEdit.focus();
    });

    // Save button click
    saveBtn.addEventListener('click', () => {
        const newDescription = descriptionEdit.value.trim();
        if (newDescription) {
            descriptionText.textContent = newDescription;
            if (analysisData) {
                analysisData.description = newDescription;
            }
        }
        descriptionText.classList.remove('hidden');
        descriptionEdit.classList.add('hidden');
        editBtn.classList.remove('hidden');
        saveBtn.classList.add('hidden');
        cancelBtn.classList.add('hidden');
    });

    // Cancel button click
    cancelBtn.addEventListener('click', () => {
        descriptionText.classList.remove('hidden');
        descriptionEdit.classList.add('hidden');
        editBtn.classList.remove('hidden');
        saveBtn.classList.add('hidden');
        cancelBtn.classList.add('hidden');
    });
}

// Settings
function updateTotalImages() {
    const selectedLanguages = document.querySelectorAll('input[name="language"]:checked').length;
    const variationsCount = parseInt(document.getElementById('variations-count').value);
    const total = selectedLanguages * variationsCount;
    totalImagesSpan.textContent = total;

    // Update generation cost display
    updateGenerationCost();
}

// Cost Display Functions
function showAnalysisCost() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const costDisplay = document.getElementById('analysis-cost');
    const costAmount = document.getElementById('analysis-cost-amount');
    const costDetails = document.getElementById('analysis-cost-details');

    // Calculate and display cost using the cost calculator
    if (typeof calculateAnalysisCost !== 'undefined') {
        const cost = calculateAnalysisCost();
        costAmount.textContent = cost.displayCost;
        costDetails.textContent = getCostBreakdown(cost);

        // Add appropriate styling based on cost
        if (cost.totalCost === 0) {
            costDisplay.classList.add('cost-free');
            costDisplay.classList.remove('cost-warning');
        }
    }

    // Show the cost display and analyze button
    costDisplay.classList.remove('hidden');
    analyzeBtn.classList.remove('hidden');

    // Add click handler for analyze button if not already added
    if (!analyzeBtn.hasAttribute('data-handler-added')) {
        analyzeBtn.addEventListener('click', () => {
            if (currentFile) {
                analyzeImage(currentFile);
                analyzeBtn.classList.add('hidden');
                costDisplay.classList.add('hidden');
            }
        });
        analyzeBtn.setAttribute('data-handler-added', 'true');
    }
}

function updateGenerationCost() {
    const costDisplay = document.getElementById('generation-cost');
    const costAmount = document.getElementById('generation-cost-amount');
    const costDetails = document.getElementById('generation-cost-details');

    const selectedLanguages = document.querySelectorAll('input[name="language"]:checked').length;
    const variationsCount = parseInt(document.getElementById('variations-count').value);
    const mediaType = document.querySelector('input[name="media-type"]:checked')?.value || 'image';

    if (typeof calculateImageGenerationCost !== 'undefined' && typeof calculateVideoGenerationCost !== 'undefined') {
        let cost;
        if (mediaType === 'video') {
            cost = calculateVideoGenerationCost(selectedLanguages, variationsCount);
            costDetails.textContent = getCostBreakdown(cost);
        } else {
            cost = calculateImageGenerationCost(selectedLanguages, variationsCount);
            costDetails.textContent = getCostBreakdown(cost);
        }

        costAmount.textContent = cost.displayCost;

        // Add appropriate styling based on cost
        if (cost.totalCost === 0) {
            costDisplay.classList.add('cost-free');
            costDisplay.classList.remove('cost-warning');
        } else if (cost.totalCost > 1.0) {
            costDisplay.classList.add('cost-warning');
            costDisplay.classList.remove('cost-free');
        } else {
            costDisplay.classList.remove('cost-free', 'cost-warning');
        }
    }
}

// Watermark Controls
function setupWatermarkControls() {
    const opacitySlider = document.getElementById('watermark-opacity');
    const opacityValue = document.getElementById('opacity-value');

    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', () => {
            opacityValue.textContent = `${opacitySlider.value}%`;
        });
    }
}

// Media Type Selection
function setupMediaTypeSelection() {
    const mediaTypeRadios = document.querySelectorAll('input[name="media-type"]');
    const fontSelection = document.querySelector('.font-selection');
    const watermarkSettings = document.querySelector('.watermark-settings');
    const formatSettings = document.querySelector('.format-settings');

    mediaTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedType = e.target.value;

            if (selectedType === 'video') {
                // Hide image-specific settings for video mode
                if (fontSelection) fontSelection.style.display = 'none';
                if (watermarkSettings) watermarkSettings.style.display = 'none';
                // Keep format settings for video resolution

                // Default to 1 variation for videos
                const variationsSelect = document.getElementById('variations-count');
                if (variationsSelect) {
                    variationsSelect.value = '1';
                }
            } else {
                // Show all settings for image mode
                if (fontSelection) fontSelection.style.display = 'block';
                if (watermarkSettings) watermarkSettings.style.display = 'block';
                if (formatSettings) formatSettings.style.display = 'grid';
            }

            // Update total count
            updateTotalImages();
        });
    });
}

// Font Preview
function setupFontPreview() {
    // Update preview text when font changes
    fontSelect.addEventListener('change', updateFontPreview);

    // Update preview when text size changes
    const textSizeSelect = document.getElementById('text-size');
    if (textSizeSelect) {
        textSizeSelect.addEventListener('change', updateFontPreview);
    }

    // Update preview text with extracted text when available
    const extractedTextElement = document.getElementById('extracted-text');
    if (extractedTextElement) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const extractedText = extractedTextElement.textContent;
                    if (extractedText && extractedText !== 'No text found') {
                        // Use first 50 characters of extracted text for preview
                        const previewText = extractedText.substring(0, 50) + (extractedText.length > 50 ? '...' : '');
                        fontPreviewText.textContent = previewText;
                    }
                }
            });
        });
        observer.observe(extractedTextElement, { childList: true });
    }

    // Set initial font
    updateFontPreview();
}

function updateFontPreview() {
    const selectedOption = fontSelect.options[fontSelect.selectedIndex];
    const fontFamily = selectedOption.getAttribute('data-font-family');
    fontPreviewText.style.fontFamily = fontFamily;

    // Update text size
    const textSize = document.getElementById('text-size').value;
    const sizeMap = {
        'small': '14px',
        'medium': '18px',
        'large': '24px',
        'extra-large': '32px'
    };
    fontPreviewText.style.fontSize = sizeMap[textSize] || '24px';
}

// Modal Setup
function setupModal() {
    // Close modal when X is clicked
    modalClose.addEventListener('click', closeModal);

    // Close modal when clicking outside
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            closeModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !imageModal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // Download button in modal
    modalDownload.addEventListener('click', () => {
        const imageUrl = modalImage.src;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = modalTitle.textContent.replace(/\s+/g, '_') + '.png';
        link.click();
    });

    // Watermark refresh button in modal
    const modalWatermarkBtn = document.getElementById('modal-regenerate-watermark');
    if (modalWatermarkBtn) {
        modalWatermarkBtn.addEventListener('click', async () => {
            const imageIndex = parseInt(modalImage.dataset.imageIndex);
            if (imageIndex >= 0 && generatedImages && generatedImages[imageIndex]) {
                await regenerateWatermark(imageIndex);

                // Update modal image with new watermarked version
                if (generatedImages[imageIndex].watermarkedUrl) {
                    modalImage.src = generatedImages[imageIndex].watermarkedUrl + '?t=' + Date.now();
                }
            }
        });
    }
}

function openModal(imageUrl, title, description, imageIndex) {
    modalImage.src = imageUrl;
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    imageModal.classList.remove('hidden');

    // Store current image index for watermark refresh
    modalImage.dataset.imageIndex = imageIndex !== undefined ? imageIndex : -1;

    // Show/hide watermark refresh button based on if watermarks are enabled
    const watermarkEnabled = document.getElementById('watermark-enabled') &&
                           document.getElementById('watermark-enabled').checked;
    const modalWatermarkBtn = document.getElementById('modal-regenerate-watermark');

    if (modalWatermarkBtn) {
        if (watermarkEnabled && imageIndex !== undefined && imageIndex >= 0) {
            modalWatermarkBtn.classList.remove('hidden');
        } else {
            modalWatermarkBtn.classList.add('hidden');
        }
    }
}

function closeModal() {
    imageModal.classList.add('hidden');
    modalImage.src = '';
}

// Generation
async function generateVariations() {
    if (!analysisData) {
        alert('Please analyze an image first');
        return;
    }

    const selectedLanguages = Array.from(document.querySelectorAll('input[name="language"]:checked'))
        .map(cb => cb.value);

    if (selectedLanguages.length === 0) {
        alert('Please select at least one language');
        return;
    }

    const mediaType = document.querySelector('input[name="media-type"]:checked').value;
    const variationsPerLanguage = parseInt(document.getElementById('variations-count').value);
    const totalImages = selectedLanguages.length * variationsPerLanguage;

    // Show progress
    resultsSection.classList.remove('hidden');
    progressContainer.classList.remove('hidden');
    imagesGrid.innerHTML = '';
    downloadAllBtn.classList.add('hidden');

    // Initialize progress
    updateProgress(0, totalImages);

    showLoading(`Generating ${totalImages} variations...`);

    try {
        // Get selected font
        const selectedFont = fontSelect.value;
        const selectedOption = fontSelect.options[fontSelect.selectedIndex];
        const fontFamily = selectedOption.getAttribute('data-font-family');

        // Get text size
        const textSize = document.getElementById('text-size').value;

        // Get orientation and resolution
        const orientation = document.querySelector('input[name="orientation"]:checked').value;
        const resolution = document.getElementById('resolution-select').value;

        // Get watermark settings
        const watermarkEnabled = document.getElementById('watermark-enabled').checked;
        const watermarkText = document.getElementById('watermark-text').value || 'Gardening Tip and Trick';

        const endpoint = mediaType === 'video' ? '/api/generate-videos' : '/api/generate-variations';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: analysisData.description,
                originalText: analysisData.extracted_text,
                languages: selectedLanguages,
                variationsPerLanguage: variationsPerLanguage,
                uploadId: analysisData.uploadId,
                sessionId: currentSessionId,
                fontStyle: selectedFont,
                fontFamily: fontFamily,
                textSize: textSize,
                orientation: orientation,
                resolution: resolution,
                watermarkText: watermarkText,
                mediaType: mediaType
            })
        });

        if (!response.ok) {
            throw new Error('Generation failed');
        }

        const result = await response.json();
        currentBatchId = result.batchId;

        displayGeneratedImages(result);

        // Update final progress
        updateProgress(result.successful, totalImages);

        if (result.successful > 0) {
            downloadAllBtn.classList.remove('hidden');
        }

        document.getElementById('generation-status').textContent =
            `Generated ${result.successful} of ${result.totalRequested} images`;

    } catch (error) {
        console.error('Generation error:', error);
        alert('Failed to generate variations: ' + error.message);
    } finally {
        hideLoading();
    }
}

function updateProgress(current, total) {
    const percentage = (current / total) * 100;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${current} / ${total}`;
}

function displayGeneratedImages(result) {
    imagesGrid.innerHTML = '';
    generatedImages = result.results;

    const isVideo = result.mediaType === 'video';

    // Show video extension section if videos were generated
    if (isVideo && result.successful > 0) {
        const extensionSection = document.getElementById('video-extension-section');
        if (extensionSection) {
            extensionSection.classList.remove('hidden');
            extensionSection.dataset.batchId = result.batchId;
        }
    }

    // Display cost summary if available
    if (result.costInfo) {
        const costSummary = document.getElementById('cost-summary');
        const modelEl = document.getElementById('cost-summary-model');
        const countEl = document.getElementById('cost-summary-count');
        const amountEl = document.getElementById('cost-summary-amount');
        const breakdownEl = document.getElementById('cost-summary-breakdown');

        modelEl.textContent = result.costInfo.model;
        countEl.textContent = `${result.costInfo.actualGenerations || result.successful} of ${result.totalRequested}`;
        amountEl.textContent = result.costInfo.estimatedCost;
        breakdownEl.textContent = result.costInfo.breakdown;

        costSummary.classList.remove('hidden');
    }

    result.results.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = isVideo ? 'video-card' : 'image-card';
        card.dataset.index = index;

        if (item.error) {
            card.innerHTML = `
                <div class="image-error">
                    <h4>${item.language} - Variation ${item.variation}</h4>
                    <p>Failed: ${item.error}</p>
                </div>
            `;
        } else {
            // Check if watermarks are enabled
            const watermarkEnabled = document.getElementById('watermark-enabled').checked;

            if (isVideo) {
                // Video card
                card.innerHTML = `
                    <video controls preload="metadata" data-original-url="${item.url}">
                        <source src="${item.url}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                    <div class="video-info">
                        <h4>${item.language.charAt(0).toUpperCase() + item.language.slice(1)}</h4>
                        <p>Video with audio</p>
                    </div>
                `;
            } else {
                // Image card
                // Use watermarked URL if available, otherwise original
                const displayUrl = item.watermarkedUrl || item.url;

                card.innerHTML = `
                    ${watermarkEnabled ? `
                        <button class="regenerate-watermark-btn" data-index="${index}" title="Regenerate watermark positions">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Refresh
                        </button>
                    ` : ''}
                    <img src="${displayUrl}" alt="${item.language} variation ${item.variation}" loading="lazy" data-original-url="${item.url}">
                    <div class="image-info">
                        <h4>${item.language.charAt(0).toUpperCase() + item.language.slice(1)}</h4>
                        <p>Variation ${item.variation} - ${item.style}</p>
                    </div>
                `;
            }

            // Apply watermark if enabled
            if (watermarkEnabled && item.watermarkText && !item.watermarkedUrl) {
                applyWatermark(item, index);
            }

            // Make image clickable to open modal
            const img = card.querySelector('img');
            const info = card.querySelector('.image-info');
            [img, info].forEach(element => {
                if (element) {
                    element.addEventListener('click', () => {
                        const title = `${item.language.charAt(0).toUpperCase() + item.language.slice(1)} - Variation ${item.variation}`;
                        const description = `Style: ${item.style}`;
                        const watermarkedUrl = generatedImages[index].watermarkedUrl || item.url;
                        openModal(watermarkedUrl, title, description, index);
                    });
                }
            });

            // Handle regenerate watermark button
            const regenerateBtn = card.querySelector('.regenerate-watermark-btn');
            if (regenerateBtn) {
                regenerateBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await regenerateWatermark(index);
                });
            }
        }

        imagesGrid.appendChild(card);
    });
}

// Download
async function downloadAll() {
    if (!currentBatchId) {
        alert('No images to download');
        return;
    }

    window.location.href = `/api/download-batch/${currentBatchId}`;
}

// Loading
function showLoading(text = 'Processing...') {
    loadingText.textContent = text;
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// Watermark Functions
async function applyWatermark(item, index) {
    try {
        const opacity = document.getElementById('watermark-opacity').value;

        const response = await fetch('/api/apply-watermark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imagePath: item.url,
                watermarkText: item.watermarkText || 'Gardening Tip and Trick',
                opacity: parseInt(opacity)
            })
        });

        if (response.ok) {
            const result = await response.json();
            generatedImages[index].watermarkedUrl = result.watermarkedUrl;
            generatedImages[index].watermarkPositions = result.positions;

            // Update the image display
            const card = document.querySelector(`.image-card[data-index="${index}"]`);
            if (card) {
                const img = card.querySelector('img');
                if (img) {
                    img.src = result.watermarkedUrl;
                }
            }
        }
    } catch (error) {
        console.error('Error applying watermark:', error);
    }
}

async function regenerateWatermark(index) {
    const item = generatedImages[index];
    if (!item) return;

    try {
        const opacity = document.getElementById('watermark-opacity').value;

        const response = await fetch('/api/apply-watermark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imagePath: item.url,
                watermarkText: item.watermarkText || 'Gardening Tip and Trick',
                opacity: parseInt(opacity),
                regenerate: true
            })
        });

        if (response.ok) {
            const result = await response.json();
            generatedImages[index].watermarkedUrl = result.watermarkedUrl;
            generatedImages[index].watermarkPositions = result.positions;

            // Update the image display
            const card = document.querySelector(`.image-card[data-index="${index}"]`);
            if (card) {
                const img = card.querySelector('img');
                if (img) {
                    // Force reload by adding timestamp
                    img.src = result.watermarkedUrl + '?t=' + Date.now();
                }
            }
        }
    } catch (error) {
        console.error('Error regenerating watermark:', error);
    }
}

// Video Extension Functions
async function extendVideos() {
    const extensionSection = document.getElementById('video-extension-section');
    const batchId = extensionSection.dataset.batchId;

    if (!batchId) {
        alert('No batch ID found. Please generate videos first.');
        return;
    }

    const button = document.getElementById('extend-all-videos');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Extending videos...';

    try {
        const response = await fetch('/api/extend-videos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ batchId })
        });

        const result = await response.json();

        if (response.ok) {
            // Update the video grid with extended videos
            const videoCards = document.querySelectorAll('.video-card');

            result.results.forEach((extResult) => {
                if (extResult.success) {
                    // Find the matching video card and update it
                    videoCards.forEach(card => {
                        const video = card.querySelector('video');
                        if (video) {
                            const currentSrc = video.querySelector('source').src;
                            if (currentSrc.includes(extResult.original)) {
                                // Update to extended video
                                video.querySelector('source').src = extResult.url;
                                video.load();

                                // Update info
                                const info = card.querySelector('.video-info p');
                                if (info) {
                                    info.textContent = 'Extended to 10 seconds';
                                }
                            }
                        }
                    });
                }
            });

            // Show success message
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.textContent = `Successfully extended ${result.successful} of ${result.totalVideos} videos to 10 seconds`;
            extensionSection.appendChild(successMsg);

            // Hide the button after successful extension
            button.style.display = 'none';

            setTimeout(() => {
                if (successMsg.parentNode) {
                    successMsg.remove();
                }
            }, 5000);

        } else {
            alert('Error extending videos: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error extending videos:', error);
        alert('Failed to extend videos. Please try again.');
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

// Initialize event listener for video extension
document.addEventListener('DOMContentLoaded', () => {
    const extendButton = document.getElementById('extend-all-videos');
    if (extendButton) {
        extendButton.addEventListener('click', extendVideos);
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', init);