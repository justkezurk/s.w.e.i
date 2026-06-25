let modelPipeline = null;
let modelLoading = false;
let modelReady = false;

// Auto-load the fallback model when the page starts
async function initFallbackModel() {
    if (modelPipeline || modelLoading) return;
    modelLoading = true;

    try {
        console.log('Loading neural fallback model...');
        modelPipeline = await window.transformers.pipeline(
            'text-generation',
            'Xenova/Phi-3-mini-4k-instruct',
            { quantized: true }
        );
        modelReady = true;
        console.log('Neural fallback model ready (Phi-3 mini)');
    } catch (error) {
        console.error('Failed to load fallback model:', error);
        modelPipeline = null;
    }
    modelLoading = false;
}

// Load model on page load
window.addEventListener('load', () => {
    // Start loading in background
    initFallbackModel();
});

// Neural fallback when symbolic system has low confidence
async function getNeuralFallback(prompt, options = {}) {
    try {
        if (!modelPipeline) {
            await initFallbackModel();
        }

        if (!modelPipeline) {
            return "I'm still developing my understanding in that area. Could you give me a bit more detail?";
        }

        const systemPrompt = `You are S.W.E.I, a helpful and direct AI assistant. 
Give clear, concise answers. Avoid asking too many clarifying questions unless absolutely necessary. 
Be helpful even with partial information.`;

        const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`;

        const result = await modelPipeline(fullPrompt, {
            max_new_tokens: options.maxTokens || 160,
            temperature: options.temperature || 0.65,
            do_sample: true,
            top_p: 0.9,
            repetition_penalty: 1.1
        });

        let response = result[0].generated_text.trim();

        // Clean up the response
        if (response.includes('Assistant:')) {
            response = response.split('Assistant:').pop().trim();
        }
        if (response.startsWith(prompt)) {
            response = response.slice(prompt.length).trim();
        }

        // Remove common bad patterns
        response = response.replace(/^(Sure|Okay|Alright|Here you go)[,.]?\s*/i, '');

        return response || "Let me approach that from another angle...";
    } catch (error) {
        console.error('Neural fallback error:', error);
        return "I'm having some trouble processing that right now. Can you try rephrasing your question?";
    }
}

// Basic math evaluation
function evaluateMath(input) {
    try {
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
    if (lower.length < 4) return true;
    if (lower.includes('what do you') || lower.includes('how do you')) return true;
    if (['hi', 'hello', 'hey'].includes(lower)) return false;
    return false;
}

async function sendMessage() {
    const input = document.getElementById('userInput').value.trim();
    if (!input) return;

    const messagesDiv = document.getElementById('messages');
    
    messagesDiv.innerHTML += `<div class="message user">${input}</div>`;
    document.getElementById('userInput').value = '';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    const thinkingId = 'thinking-' + Date.now();
    messagesDiv.innerHTML += `<div id="${thinkingId}" class="message assistant" style="opacity:0.6">Thinking...</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    let response = '';

    const mathResult = evaluateMath(input);
    if (mathResult !== null) {
        response = `The answer is ${mathResult}`;
    } else if (needsClarification(input)) {
        response = await getNeuralFallback(`User asked: "${input}". Give a direct, helpful answer. Avoid asking many questions back.`, { maxTokens: 140, temperature: 0.6 });
    } else {
        // Main path: use neural fallback for now
        response = await getNeuralFallback(input, { maxTokens: 180, temperature: 0.7 });
    }

    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) thinkingEl.remove();

    messagesDiv.innerHTML += `<div class="message assistant">${response}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Ensure model is loaded for next time
    if (!modelReady && !modelLoading) {
        initFallbackModel();
    }
}