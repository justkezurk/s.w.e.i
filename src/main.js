let modelPipeline = null;
let modelLoading = false;
let modelReady = false;

let parameters = { routers: [], atomics: [] };

async function loadParameters() {
    try {
        const routerFiles = ['src/parameters/stable/routing/conversation-routers.json', 'src/parameters/stable/routing/capabilities-routers.json', 'src/parameters/stable/routing/reasoning-routers.json'];
        const atomicFiles = ['src/parameters/stable/atomic/conversation-atomic.json', 'src/parameters/stable/atomic/capability-atomic.json', 'src/parameters/stable/atomic/reasoning-atomic.json'];

        for (const file of routerFiles) { try { const res = await fetch(file); parameters.routers.push(...await res.json()); } catch(e){} }
        for (const file of atomicFiles) { try { const res = await fetch(file); parameters.atomics.push(...await res.json()); } catch(e){} }
    } catch(e) {}
}

window.addEventListener('load', () => { initFallbackModel(); loadParameters(); });

// === GREETING SYSTEM ===
const greetingTriggers = [
    'hey', 'hello', 'hi', 'yo', 'sup', "what's up", 'what up', 'watup', 'wadup', 'wassup',
    'sup tho', "what's good", 'whats good', 'aye', 'oi', 'how are you', 'how you doing', 'how you doin',
    'wassgood', 'good morning', 'good afternoon', 'good evening', 'morning', 'what it do', 'what it is'
];

const greetingResponses = [
    "What's good.", "What it do.", "Chillen. What's up with you?", "Not much, what you on?",
    "I'm good, how you feeling?", "Sup tho.", "Chillen. You tryna get into something?",
    "I'm straight. What's on your mind?", "Yo. What's good with you?", "Nothin' heavy. What you got going on?",
    "I'm cool. What you got?", "Chillen like a villain. What's good?", "I'm good. You?",
    "Sup. You moving or just vibing?", "Not too much. What you into right now?", "I'm straight. How you been?",
    "Yo yo. What's the word?", "Chillen. You got something on your mind?", "I'm good. What it look like?",
    "Sup tho. You tryna talk or what?", "I'm straight. What's the move?",
    "Chillen. You need something or just saying what's up?", "I'm good. You got time or you busy?",
    "Yo. What's the vibe?"
];

const conversationSeeds = [
    "Is there anything you tryna talk about?", "You got something specific on your mind?",
    "You tryna get some shit done or just vibing?", "Anything I can help you with?",
    "What you got going on?", "You need something or we just kicking it?",
    "You got a goal in mind or we just talking?", "What can I do for you?", "You tryna build or just catch up?"
];

function isGreeting(input) {
    const lower = input.toLowerCase().trim();
    return greetingTriggers.some(trigger => lower.includes(trigger));
}

function getGreetingResponse() {
    let response = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
    if (Math.random() < 0.4) {
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
        modelPipeline = await window.transformers.pipeline('text-generation', 'Xenova/Phi-3-mini-4k-instruct', { quantized: true });
        modelReady = true;
    } catch (error) {
        console.error('Failed to load fallback model:', error);
        modelPipeline = null;
    }
    modelLoading = false;
}

async function getNeuralFallback(prompt, options = {}) {
    try {
        if (!modelPipeline) await initFallbackModel();
        if (!modelPipeline) return "I'm still developing my understanding in that area. A bit more context would help.";

        const systemPrompt = `You are S.W.E.I, a helpful and direct AI assistant. Give clear, concise answers. Avoid asking too many clarifying questions unless truly necessary.`;
        const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`;

        const result = await modelPipeline(fullPrompt, {
            max_new_tokens: options.maxTokens || 160,
            temperature: options.temperature || 0.65,
            do_sample: true,
            top_p: 0.9
        });

        let response = result[0].generated_text.trim();
        if (response.includes('Assistant:')) response = response.split('Assistant:').pop().trim();
        if (response.startsWith(prompt)) response = response.slice(prompt.length).trim();
        response = response.replace(/^(Sure|Okay|Alright)[,.]?\s*/i, '');
        return response || "Let me approach that differently...";
    } catch (error) {
        return "I'm having trouble with that right now. Try rephrasing?";
    }
}

// === IMPROVED CONFIDENCE SCORING ===
function getConfidence(input) {
    const lower = input.toLowerCase().trim();
    let score = 0.3;

    // Check routers
    for (const router of parameters.routers) {
        if (!router.triggers || router.triggers.length === 0) continue;
        let routerMatch = false;

        for (const trigger of router.triggers) {
            if (lower.includes(trigger.toLowerCase())) {
                routerMatch = true;
                break;
            }
        }

        if (routerMatch) {
            score = Math.max(score, (router.activation_threshold || 0.55) + 0.15);
        }
    }

    // Check atomics
    for (const atomic of parameters.atomics) {
        if (!atomic.triggers || atomic.triggers.length === 0) continue;
        let atomicMatch = false;

        for (const trigger of atomic.triggers) {
            if (lower.includes(trigger.toLowerCase())) {
                atomicMatch = true;
                break;
            }
        }

        if (atomicMatch) {
            score = Math.max(score, (atomic.activation_threshold || 0.6) + 0.12);
        }
    }

    // Bonus for longer, more specific inputs
    if (lower.length > 20) score += 0.08;
    if (lower.split(' ').length > 7) score += 0.05;

    return Math.max(0.2, Math.min(0.95, score));
}

function evaluateMath(input) {
    try { if (/^[0-9\s+\-*/().]+$/.test(input)) return eval(input); return null; } catch { return null; }
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
    const confidence = getConfidence(input);

    if (isGreeting(input)) {
        response = getGreetingResponse();
    } else if (evaluateMath(input) !== null) {
        response = `The answer is ${evaluateMath(input)}`;
    } else if (confidence < 0.5 || needsClarification(input)) {
        // Neural fallback only when confidence is genuinely low or clarification is needed
        response = await getNeuralFallback(input);
    } else {
        // Higher confidence path - still using neural for now, but threshold is stricter
        response = await getNeuralFallback(input, { maxTokens: 130, temperature: 0.55 });
    }

    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) thinkingEl.remove();

    messagesDiv.innerHTML += `<div class="message assistant">${response}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}