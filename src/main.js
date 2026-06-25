let modelPipeline = null;
let modelLoading = false;
let modelReady = false;

// Parameter system
let parameters = {
    routers: [],
    atomics: []
};

async function loadParameters() {
    try {
        const routerFiles = [
            'src/parameters/stable/routing/conversation-routers.json',
            'src/parameters/stable/routing/capabilities-routers.json'
        ];
        const atomicFiles = [
            'src/parameters/stable/atomic/conversation-atomic.json',
            'src/parameters/stable/atomic/capability-atomic.json'
        ];

        for (const file of routerFiles) {
            try {
                const res = await fetch(file);
                const data = await res.json();
                parameters.routers.push(...data);
            } catch (e) {}
        }
        for (const file of atomicFiles) {
            try {
                const res = await fetch(file);
                const data = await res.json();
                parameters.atomics.push(...data);
            } catch (e) {}
        }
    } catch (error) {
        console.warn('Parameter loading issue:', error);
    }
}

window.addEventListener('load', () => {
    initFallbackModel();
    loadParameters();
});

// === GREETING SYSTEM ===
const greetingTriggers = [
    'hey', 'hello', 'hi', 'yo', 'sup', 'what\'s up', 'what up', 'watup', 'wadup',
    'sup tho', 'what\'s good', 'whats good', 'aye', 'oi', 'how are you', 'how you doing',
    'how you doin', 'wassup', 'wassgood', 'good morning', 'good afternoon', 'good evening'
];

const greetingResponses = [
    "What's good.",
    "What it do.",
    "Chillen. What's up with you?",
    "Not much, what you on?",
    "I'm good, how you feeling?",
    "Sup tho.",
    "Chillen. You tryna get into something?",
    "I'm straight. What's on your mind?",
    "Yo. What's good with you?",
    "Nothin' heavy. What you got going on?"
];

const conversationSeeds = [
    "Is there anything you tryna talk about?",
    "You got something specific on your mind?",
    "You tryna get some shit done or just vibing?",
    "Anything I can help you with?",
    "What you got going on?"
];

function isGreeting(input) {
    const lower = input.toLowerCase().trim();
    return greetingTriggers.some(trigger => lower.includes(trigger));
}

function getGreetingResponse() {
    let response = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
    
    // Occasionally add a light conversation seed
    if (Math.random() < 0.45) {
        const seed = conversationSeeds[Math.floor(Math.random() * conversationSeeds.length)];
        response += " " + seed;
    }
    
    return response;
}

// === NEURAL FALLBACK ===
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
Give clear, concise answers. Avoid asking too many clarifying questions unless truly necessary.`;

        const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`;

        const result = await modelPipeline(fullPrompt, {
            max_new_tokens: options.maxTokens || 160,
            temperature: options.temperature || 0.65,
            do_sample: true,
            top_p: 0.9
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
        return "I'm having trouble with that right now. Try rephrasing?";
    }
}

// === CONFIDENCE + MAIN LOGIC ===
function getConfidence(input) {
    const lower = input.toLowerCase().trim();
    let bestScore = 0.35;

    for (const router of parameters.routers) {
        if (!router.triggers) continue;
        for (const trigger of router.triggers) {
            if (lower.includes(trigger.toLowerCase())) {
                bestScore = Math.max(bestScore, (router.activation_threshold || 0.6) + 0.1);
            }
        }
    }

    for (const atomic of parameters.atomics) {
        if (!atomic.triggers) continue;
        for (const trigger of atomic.triggers) {
            if (lower.includes(trigger.toLowerCase())) {
                bestScore = Math.max(bestScore, (atomic.activation_threshold || 0.65) + 0.08);
            }
        }
    }

    if (lower.length > 18) bestScore += 0.07;
    return Math.max(0.2, Math.min(0.95, bestScore));
}

function evaluateMath(input) {
    try {
        if (/^[0-9\s+\-*/().]+$/.test(input)) return eval(input);
        return null;
    } catch { return null; }
}

function needsClarification(input) {
    const lower = input.toLowerCase().trim();
    if (lower.length < 4) return true;
    if (lower.includes('what do you') || lower.includes('how do you')) return true;
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

    // 1. Handle greetings directly with natural responses
    if (isGreeting(input)) {
        response = getGreetingResponse();
    }
    // 2. Math
    else if (evaluateMath(input) !== null) {
        response = `The answer is ${evaluateMath(input)}`;
    }
    // 3. Low confidence or needs clarification → neural fallback
    else {
        const confidence = getConfidence(input);
        if (confidence < 0.52 || needsClarification(input)) {
            response = await getNeuralFallback(input);
        } else {
            response = await getNeuralFallback(input, { maxTokens: 140, temperature: 0.6 });
        }
    }

    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) thinkingEl.remove();

    messagesDiv.innerHTML += `<div class="message assistant">${response}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}