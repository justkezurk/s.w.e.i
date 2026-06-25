let modelPipeline = null;
let modelLoading = false;
let modelReady = false;

// Parameter system (loaded dynamically)
let parameters = {
    routers: [],
    atomics: []
};

async function loadParameters() {
    try {
        // Load key parameter files
        const routerFiles = [
            'src/parameters/stable/routing/conversation-routers.json',
            'src/parameters/stable/routing/capabilities-routers.json',
            'src/parameters/stable/routing/reasoning-routers.json'
        ];

        const atomicFiles = [
            'src/parameters/stable/atomic/conversation-atomic.json',
            'src/parameters/stable/atomic/capability-atomic.json',
            'src/parameters/stable/atomic/reasoning-atomic.json'
        ];

        for (const file of routerFiles) {
            try {
                const res = await fetch(file);
                const data = await res.json();
                parameters.routers.push(...data);
            } catch (e) {
                console.warn('Could not load router file:', file);
            }
        }

        for (const file of atomicFiles) {
            try {
                const res = await fetch(file);
                const data = await res.json();
                parameters.atomics.push(...data);
            } catch (e) {
                console.warn('Could not load atomic file:', file);
            }
        }

        console.log(`Loaded ${parameters.routers.length} routers and ${parameters.atomics.length} atomics`);
    } catch (error) {
        console.error('Error loading parameters:', error);
    }
}

window.addEventListener('load', () => {
    initFallbackModel();
    loadParameters();
});

// Improved confidence scoring using parameter system
function getConfidence(input) {
    const lower = input.toLowerCase().trim();
    let bestScore = 0.3; // minimum base

    // Check against loaded routers
    for (const router of parameters.routers) {
        if (!router.triggers || router.triggers.length === 0) continue;

        for (const trigger of router.triggers) {
            if (lower.includes(trigger.toLowerCase())) {
                bestScore = Math.max(bestScore, (router.activation_threshold || 0.6) + 0.15);
            }
        }
    }

    // Check against atomics
    for (const atomic of parameters.atomics) {
        if (!atomic.triggers || atomic.triggers.length === 0) continue;

        for (const trigger of atomic.triggers) {
            if (lower.includes(trigger.toLowerCase())) {
                bestScore = Math.max(bestScore, (atomic.activation_threshold || 0.7) + 0.1);
            }
        }
    }

    // Length and specificity bonuses
    if (lower.length > 20) bestScore += 0.08;
    if (lower.split(' ').length > 6) bestScore += 0.05;

    return Math.max(0.15, Math.min(0.95, bestScore));
}

async function initFallbackModel() {
    if (modelPipeline || modelLoading) return;
    modelLoading = true;

    try {
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

async function getNeuralFallback(prompt, options = {}) {
    try {
        if (!modelPipeline) {
            await initFallbackModel();
        }

        if (!modelPipeline) {
            return "I'm still developing my understanding in that area. A bit more context would help.";
        }

        const systemPrompt = `You are S.W.E.I, a helpful and direct AI assistant.
Give clear, concise answers. Avoid asking too many clarifying questions unless truly necessary.
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

        response = response.replace(/^(Sure|Okay|Alright)[,.]?\s*/i, '');

        return response || "Let me approach that differently...";
    } catch (error) {
        console.error('Neural fallback error:', error);
        return "I'm having trouble processing that. Try rephrasing?";
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
    } else if (confidence < 0.52 || needsClarification(input)) {
        response = await getNeuralFallback(input, { maxTokens: 160, temperature: 0.65 });
    } else {
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