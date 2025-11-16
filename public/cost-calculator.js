// Cost Calculator for API Usage
// Pricing based on Google Cloud AI pricing (as of 2025)

const PRICING = {
    // Gemini API pricing (per 1000 tokens)
    gemini: {
        'gemini-2.0-flash-exp': {
            input: 0.0,  // Free during preview
            output: 0.0  // Free during preview
        },
        'gemini-2.5-flash-image': {
            input: 0.00001875,  // $0.000001875 per token
            output: 0.000075    // $0.0000075 per token
        }
    },

    // Veo 3 API pricing (per video)
    veo3: {
        'veo-3.1-generate-preview': {
            perVideo: 0.0  // Free during preview, normally ~$0.08 per video
        }
    },

    // Token estimation factors
    tokenEstimates: {
        imageAnalysis: {
            inputTokens: 500,   // Image + prompt
            outputTokens: 300   // Description + text extraction
        },
        imageGeneration: {
            inputTokens: 800,   // Prompt with description
            outputTokens: 50    // Response
        },
        videoGeneration: {
            inputTokens: 1000,  // Video prompt
            outputTokens: 100   // Response
        }
    }
};

// Calculate cost for image analysis
function calculateAnalysisCost() {
    const model = 'gemini-2.0-flash-exp';
    const estimates = PRICING.tokenEstimates.imageAnalysis;
    const pricing = PRICING.gemini[model];

    const inputCost = (estimates.inputTokens / 1000) * pricing.input;
    const outputCost = (estimates.outputTokens / 1000) * pricing.output;

    return {
        model,
        inputTokens: estimates.inputTokens,
        outputTokens: estimates.outputTokens,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        displayCost: formatCost(inputCost + outputCost)
    };
}

// Calculate cost for image generation
function calculateImageGenerationCost(numLanguages, numVariations) {
    const model = 'gemini-2.5-flash-image';
    const estimates = PRICING.tokenEstimates.imageGeneration;
    const pricing = PRICING.gemini[model];

    const totalGenerations = numLanguages * numVariations;

    // Each generation has its own API call
    const inputTokensPerCall = estimates.inputTokens;
    const outputTokensPerCall = estimates.outputTokens;

    const totalInputTokens = inputTokensPerCall * totalGenerations;
    const totalOutputTokens = outputTokensPerCall * totalGenerations;

    const inputCost = (totalInputTokens / 1000) * pricing.input;
    const outputCost = (totalOutputTokens / 1000) * pricing.output;

    return {
        model,
        totalGenerations,
        totalInputTokens,
        totalOutputTokens,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        displayCost: formatCost(inputCost + outputCost),
        perImageCost: formatCost((inputCost + outputCost) / totalGenerations)
    };
}

// Calculate cost for video generation
function calculateVideoGenerationCost(numLanguages, numVariations) {
    const model = 'veo-3.1-generate-preview';
    const pricing = PRICING.veo3[model];

    const totalVideos = numLanguages * numVariations;
    const totalCost = pricing.perVideo * totalVideos;

    return {
        model,
        totalVideos,
        perVideoCost: formatCost(pricing.perVideo),
        totalCost,
        displayCost: formatCost(totalCost)
    };
}

// Format cost for display
function formatCost(cost) {
    if (cost === 0) {
        return 'Free (Preview)';
    }
    if (cost < 0.01) {
        return `<$0.01`;
    }
    return `$${cost.toFixed(2)}`;
}

// Get cost breakdown text
function getCostBreakdown(costData) {
    if (costData.totalCost === 0) {
        return `Using ${costData.model} (currently free during preview)`;
    }

    let breakdown = [`Using ${costData.model}`];

    if (costData.totalGenerations) {
        breakdown.push(`${costData.totalGenerations} generations`);
    }
    if (costData.totalVideos) {
        breakdown.push(`${costData.totalVideos} videos`);
    }
    if (costData.totalInputTokens) {
        breakdown.push(`~${costData.totalInputTokens} input tokens`);
    }
    if (costData.totalOutputTokens) {
        breakdown.push(`~${costData.totalOutputTokens} output tokens`);
    }

    return breakdown.join(' • ');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateAnalysisCost,
        calculateImageGenerationCost,
        calculateVideoGenerationCost,
        formatCost,
        getCostBreakdown,
        PRICING
    };
}