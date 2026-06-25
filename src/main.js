let modelPipeline = null;
let modelLoading = false;
let modelReady = false;

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
        console.log('Neural fallback model ready');
    } catch (error) {
        console.error('Failed to load fallback model:', error);
        modelPipeline = null;
    }
    modelLoading = false;
}

window.addEventListener('load', () => {
    initFallbackModel();
});

// Simple confidence scoring (will be replaced by full router system later)
function getConfidence(input) {
    const lower = input.toLowerCase().trim();
    let score = 0.5; // base confidence

    // Boost confidence for clear, specific questions
    if (lower.length > 15) score += 0.15;
    if (lower.includes('how') || lower.includes('what') || lower.includes('why')) score += 0.1;
    if (lower.includes('code') || lower.includes('explain') || lower.includes('calculate')) score += 0.1;

    // Lower confidence for vague or very short inputs
    if (lower.length < 6) score -= 0.25;
    if (lower.split(' ').length < 4) score -= 0.15;
    if (lower.includes('help') || lower.includes('do you') || lower.includes('can you')) score -= 0.1;

    return Math.max(0.1, Math.min(0.95, score));
}

async function getNeuralFallback(prompt, options = {}) {
    try {
        if (!modelPipeline) {
            await initFallbackModel();
        }

        if (!modelPipeline) {
            return "I'm still developing my understanding in that area. A bit more context would help.";
        }

        const systemPrompt = `You are S.W.E.I, a helpful and direct AI assistant.
Give clear, concise answers. Avoid asking too many clarifying questions unless the query is genuinely ambiguous.
Be useful even with incomplete information.`;

        const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`;

        const result = await modelPipeline(fullPrompt, {
            max_new_tokens: options.maxTokens || 160,
            temperature: options.temperature || 0.65,
            do_sample: true,
            top_p: 0.9,
            repetition_penalty: 1.1
        });

        let response = result[0].generated_text.trim();

        if (response.includes('Assistant:')) {
            response = response.split('Assistant:').pop().trim();
        }
        if (response.startsWith(prompt)) {
            response = response.slice(prompt.length).trim();
        }

        response = response.replace(/^(Sure|Okay|Alright|Here you go)[,.]?\s*/i, '');

        return response || "Let me think about that from another angle...";
    } catch (error) {
        console.error('Neural fallback error:', error);
        return "I'm having trouble with that right now. Try rephrasing?";
    }
}

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
    const confidence = getConfidence(input);

    const mathResult = evaluateMath(input);
    if (mathResult !== null) {
        response = `The answer is ${mathResult}`;
    } else if (confidence < 0.55 || needsClarification(input)) {
        // Use neural fallback when confidence is low or clarification is needed
        response = await getNeuralFallback(input, { maxTokens: 160, temperature: 0.65 });
    } else {
        // Higher confidence path - still using neural for now, but could route to symbolic system later
        response = await getNeuralFallback(input, { maxTokens: 140, temperature: 0.6 });
    }

    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) thinkingEl.remove();

    messagesDiv.innerHTML += `<div class="message assistant">${response}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    if (!modelReady && !modelLoading) {
        initFallbackModel();
    }
}