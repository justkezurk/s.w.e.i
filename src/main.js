let modelPipeline = null;
let modelLoading = false;

// Load a small capable model for fallback
async function loadFallbackModel() {
    if (modelPipeline || modelLoading) return modelPipeline;
    modelLoading = true;
    
    try {
        // Using a small, efficient model good for reasoning
        modelPipeline = await window.transformers.pipeline(
            'text-generation',
            'Xenova/Phi-3-mini-4k-instruct',
            { 
                quantized: true,
                progress_callback: (progress) => {
                    if (progress.status === 'done') {
                        console.log('Fallback model loaded successfully');
                    }
                }
            }
        );
        console.log('Neural fallback model ready');
    } catch (error) {
        console.error('Failed to load fallback model:', error);
        modelPipeline = null;
    }
    
    modelLoading = false;
    return modelPipeline;
}

// Neural fallback when symbolic system has low confidence
async function getNeuralFallback(prompt) {
    try {
        if (!modelPipeline) {
            await loadFallbackModel();
        }
        
        if (!modelPipeline) {
            return "I'm still building my understanding in that area. Could you rephrase or give me a bit more context?";
        }

        const result = await modelPipeline(prompt, {
            max_new_tokens: 180,
            temperature: 0.7,
            do_sample: true,
            top_p: 0.9,
        });

        let response = result[0].generated_text.trim();
        
        // Clean up common artifacts
        if (response.startsWith(prompt)) {
            response = response.slice(prompt.length).trim();
        }
        
        return response || "Let me think about that differently...";
    } catch (error) {
        console.error('Neural fallback error:', error);
        return "I'm having trouble processing that right now. Can you try rephrasing?";
    }
}

// Basic math evaluation (kept from previous version)
function evaluateMath(input) {
    try {
        // Very basic math parser - can be expanded later
        if (/^[0-9\s+\-*/().]+$/.test(input)) {
            return eval(input);
        }
        return null;
    } catch {
        return null;
    }
}

function needsClarification(input) {
    const lower = input.toLowerCase().trim();
    
    // Simple heuristics for now
    if (lower.length < 4) return true;
    if (lower.includes('what do you') || lower.includes('how do you')) return true;
    if (lower === 'hi' || lower === 'hello') return false;
    
    return false;
}

async function sendMessage() {
    const input = document.getElementById('userInput').value.trim();
    if (!input) return;

    const messagesDiv = document.getElementById('messages');
    
    // Add user message
    messagesDiv.innerHTML += `<div class="message user">${input}</div>`;
    document.getElementById('userInput').value = '';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Show thinking indicator
    const thinkingId = 'thinking-' + Date.now();
    messagesDiv.innerHTML += `<div id="${thinkingId}" class="message assistant" style="opacity:0.6">Thinking...</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    let response = '';

    // 1. Try math first
    const mathResult = evaluateMath(input);
    if (mathResult !== null) {
        response = `The answer is ${mathResult}`;
    } 
    // 2. Check if clarification is needed
    else if (needsClarification(input)) {
        // Use neural fallback for clarification cases instead of generic message
        response = await getNeuralFallback(`The user asked: "${input}". Give a helpful, direct response without asking too many questions back.`);
    } 
    // 3. Otherwise use neural fallback for general cases (hybrid approach)
    else {
        // For now, route most things through neural fallback until full router system is wired
        response = await getNeuralFallback(input);
    }

    // Remove thinking indicator
    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) thinkingEl.remove();

    // Add assistant response
    messagesDiv.innerHTML += `<div class="message assistant">${response}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Preload model in background for faster future responses
    if (!modelPipeline && !modelLoading) {
        loadFallbackModel();
    }
}