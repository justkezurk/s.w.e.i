const messagesDiv = document.getElementById('messages');
const input = document.getElementById('input');

let conversationHistory = [];

// Simple deterministic math evaluator
function evaluateMath(expression) {
  try {
    // Very basic safe eval for common math
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    if (!sanitized) return null;
    // eslint-disable-next-line no-eval
    const result = eval(sanitized);
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function addMessage(text, isUser = false) {
  const div = document.createElement('div');
  div.className = `message ${isUser ? 'user' : 'swei'}`;
  div.textContent = text;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  conversationHistory.push({ role: isUser ? 'user' : 'swei', content: text });
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'message swei';
  div.id = 'typing';
  div.textContent = 'S.W.E.I is thinking...';
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return div;
}

function removeTyping() {
  const typing = document.getElementById('typing');
  if (typing) typing.remove();
}

// Very basic clarifying question logic
function needsClarification(text) {
  const lower = text.toLowerCase();
  const vagueWords = ['how', 'what', 'why', 'help', 'do', 'make', 'explain'];
  const hasVague = vagueWords.some(w => lower.includes(w));
  const isShort = text.split(' ').length < 5;
  return hasVague && isShort;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, true);
  input.value = '';

  const typing = showTyping();

  setTimeout(() => {
    removeTyping();

    // 1. Check for math first (deterministic)
    const mathResult = evaluateMath(text);
    if (mathResult !== null) {
      addMessage(`The answer is: ${mathResult}`);
      return;
    }

    // 2. Check if we need clarifying questions
    if (needsClarification(text)) {
      addMessage("To give you a better answer, could you tell me a bit more? For example, what are you trying to achieve or what level of detail are you looking for?");
      return;
    }

    // 3. General conversation fallback (will improve with parameters later)
    const responses = [
      "Got it. Can you give me a bit more context so I can help properly?",
      "Interesting. What specifically would you like to know or do with that?",
      "I'm here to help. Could you rephrase or add more details?",
      "Thanks for the question. To respond accurately, I may need to ask a couple of clarifying questions first."
    ];
    const randomReply = responses[Math.floor(Math.random() * responses.length)];
    addMessage(randomReply);

  }, 650);
}

// Initial greeting
addMessage("Hello! I'm S.W.E.I. I can help with general questions, do basic math, and I'll ask clarifying questions when it helps give you a better answer.");