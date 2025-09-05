// API endpoints
const OPENAI_API_URL = 'https://api.a4f.co/v1/chat/completions';
const GEMINI_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const ESSENCA_API_URL = 'https://essenca-admin.vercel.app/api/essenca/v1';

// ===== SIMPLIFIED API KEY AUTH FUNCTIONS =====

// Get API key from storage
async function getApiKey() {
    const { essenca_api_key } = await chrome.storage.local.get('essenca_api_key');
    return essenca_api_key;
}

// Check if user has valid API key
async function ensureAuthenticated() {
    const apiKey = await getApiKey();
    if (!apiKey || !apiKey.startsWith('ESN_')) {
        throw new Error('API key not configured. Please set your Essenca API key in the extension options.');
    }
    return apiKey;
}

// Simplified settings retrieval
async function getSettings() {
    const syncPromise = new Promise((resolve) => {
        chrome.storage.sync.get({
            provider: 'essenca_api',
            openaiApiKey: '',
            geminiApiKey: '',
            model: 'gpt-3.5-turbo',
            systemPrompt: '',
            userProfileInfo: ''
        }, (items) => resolve(items));
    });

    const localPromise = new Promise((resolve) => {
        chrome.storage.local.get({
            essenca_api_key: null
        }, (items) => resolve(items));
    });

    const [syncSettings, localSettings] = await Promise.all([syncPromise, localPromise]);
    return { ...syncSettings, ...localSettings };
}

// Simple API request function for Essenca API
async function makeEssencaRequest(url, body) {
    const apiKey = await ensureAuthenticated();
    
    console.log('🔄 Making Essenca API request to:', url);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed: ${response.status}`);
    }

    console.log('✅ Essenca API request successful');
    return response.json();
}

// Migration helper - clean up old authentication data
async function cleanupOldAuthData() {
    try {
        // Check if chrome.storage is available (service worker context)
        if (!chrome || !chrome.storage || !chrome.storage.local) {
            console.log('⚠️ Chrome storage not available, skipping auth cleanup');
            return;
        }

        const { jwtToken, essenca_session } = await chrome.storage.local.get(['jwtToken', 'essenca_session']);
        
        if (jwtToken || essenca_session) {
            console.log('🔄 Cleaning up old authentication data...');
            await chrome.storage.local.remove(['jwtToken', 'essenca_session', 'userEmail']);
            console.log('✅ Old authentication data cleaned up');
        }
    } catch (error) {
        console.error('❌ Error cleaning up old auth data:', error);
    }
}

// Initialize background script
console.log('🚀 Background script starting...');

// Only run cleanup if we're in a proper service worker context
if (typeof chrome !== 'undefined' && chrome.storage) {
    // Migration helper - clean up old auth data
    cleanupOldAuthData();
} else {
    console.log('⚠️ Service worker context not ready, skipping auth cleanup');
}

console.log('✅ Background script initialized');

// System prompts for different actions
const SYSTEM_PROMPTS = {
    summary: `Read the following page content and create a concise bullet-point summary that captures:
• Main topic and key arguments
• Important facts and statistics
• Key takeaways and conclusions
Format the response as clear, easy-to-read bullet points.`,

    'key-takeaway': `Read the following page content and identify the single most important takeaway or insight.
Focus on the core message or conclusion that the reader should remember.
Provide a concise, impactful response (1-2 sentences) that captures the essence of the content.`,

    chat: `You are a helpful AI assistant that can answer questions about the page the user is viewing.
Use the page content to provide accurate, relevant responses.
If the answer isn't in the content, acknowledge this and provide general knowledge if appropriate.
Keep responses concise, informative, and conversational.`,

    'generate_linkedin_comment': `You are a LinkedIn user. Your persona is defined by the "USER PROFILE" provided below.  
Adopt this persona and write a comment AS THIS PERSON.  
Your response must ONLY be the comment text itself. Do not include any headings or labels.  

Based on your persona and the "POST CONTENT", generate a professional, thoughtful, and **non-generic** comment that fits the style and tone of the post.  
Always use clear and simple words that are easy for anyone to understand.  
The comment should add **real value** to the discussion and feel authentic — like something a sharp, emotionally intelligent professional would post.

---

## ✳️ ADDITIONAL RULES FOR COMMENT QUALITY

• **Comment Length**  
  Keep the comment to **1–2 short sentences** by default.  
  You may write **3 concise sentences only if you are adding real value** (e.g., an extra solution, relevant experience, or micro-insight).  
  Do not exceed 3 sentences under any circumstance.

• **One Core Idea Only**  
  Focus on expressing **a single clear thought** — whether it’s a reaction, suggestion, or brief insight.  
  Avoid covering multiple points in one comment.

• **Comment Types (in order of priority)**  
  When adding value, choose the best form for the situation:
  1. A small additional solution or point not mentioned in the post  
  2. A short, relevant real-world example or personal experience  
  3. A thoughtful and **non-generic** question that deepens the topic  

• **Strict Question Rule**  
  Do **not default to asking questions.**  
  Only include a question if the post invites discussion, raises a challenge, or presents a bold/curious claim.  
  Never ask surface-level or yes/no questions like “What do you think?”

• **Avoid Generic Language**  
  Never use phrases like “Great post!”, “Love this”, “Thanks for sharing”, or “Very insightful.”  
  Your comment must sound natural, personal, and specific to the post.

• **Match the Post’s Tone**  
  Adapt your tone based on the type of post:
  - Professional/Informational → Keep it clear, sharp, and respectful  
  - Personal/Reflective → Be warm, validating, or supportive  
  - Bold/Thought-Leadership → Offer smart, subtle insights or lightly challenge ideas  

• **Do Not Overuse Persona Voice**  
  Your tone should be influenced by the persona, but not overly repetitive across different comments.  
  Avoid sounding like the same voice on every post.

• **Sound Human, Not Scripted**  
  Vary your sentence structure. Use broken or punchy lines where natural.  
  Examples: “You nailed that nuance.” / “This hit home.” / “Seen this play out too.”

• **No Hashtags or Emojis**  
  Do not include hashtags. Only use emojis if one is highly relevant and contextually meaningful.

---

## 🔚 OUTPUT INSTRUCTION

Your output must be the comment text only — no labels, intros, or formatting. The comment should be ready to post directly on LinkedIn.
`,

    'generate_linkedin_comment_generic': `You are a professional social media manager helping a user write a comment on a LinkedIn post.
Based on the post content provided, generate a professional, insightful, conversational starter and engaging comment based on
the type of post or what the post is about so it wont be generic.
Always use simple words so it will be easy for any one to understand.
The comment should add value to the discussion. It can be a thoughtful question, a supplementary insight, or an appreciative remark.
Always know that not all post comment need question and the ones that requires it the questionstion should be a unique and conversation stater ones.
Keep the tone positive. Do not include hashtags and emojis unless the emoji is highly relevant.
The generated comment should be concise and ready to be posted directly.

ADDITIONAL RULES FOR COMMENT QUALITY
Avoid generic LinkedIn phrases and clichés. Make each line sound natural, specific, and personal.
When appropriate, include a personal reaction or small observation.
Ask questions only when they open a new dimension or insight — avoid yes/no or surface-level questions.
Keep the tone curious, warm, smart, and concise.
Comments should be 1 sentenct or 2 short sentences if needed to prove a point and center around a single idea.
Vary sentence structure to make the comment feel human-written.

Focus on One Clear Idea
Each comment should express only one central thought — a reaction, question, or micro-insight.
Avoid trying to say too much or cover multiple angles.

Vary Comment Type (Don’t Force a Question)
Not all comments need a question or conversation starter.
Only ask a question if it opens a deeper layer of the post’s message.
Skip questions when a supportive statement, subtle insight, or warm reaction is enough.

Use Tone That Matches the Post
The tone should adapt based on the post type:

Professional posts → clear, sharp, respectful

Personal posts → warm, thoughtful, validating

Thought-leadership posts → insightful, curious, sometimes challenging
Avoid being overly chatty or robotic — keep the tone flexible, human, and context-aware.
COMMENT VALUE TYPES (Important)
• When the post invites it (e.g., a practical tip, a challenge, or a bold opinion), your comment should provide **real additional value**. That value can come in one of three ways:
   1. A small practical suggestion or solution the author didn’t mention.
   2. A brief personal experience or real-world example that supports or expands the point.
   3. A thoughtful, specific question — but only if it deepens the conversation and isn’t surface-level.

• Do **not** default to asking questions. Only use questions when you truly have something unique to ask. Otherwise, **lean toward adding insights or relevant micro-experiences**.
• In rare cases when needed to give valuable insight or add to the post, the comment can go up to **3 concise sentences**. But keep the response clear and focused on a single idea.
`
};

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Debug auth status for troubleshooting
    if (request.action === 'debug_auth') {
        debugBackgroundAuthStatus();
        sendResponse({ success: true, message: 'Auth debug info logged to console' });
        return true;
    }

    // Handle different action types
    switch (request.action) {
        case 'summary':
            processRequest(request, SYSTEM_PROMPTS.summary, sendResponse);
            break;

        case 'key-takeaway':
            processRequest(request, SYSTEM_PROMPTS['key-takeaway'], sendResponse);
            break;

        case 'chat':
            processChatRequest(request, sendResponse);
            break;

        case 'generate_linkedin_comment':
            processRequest(request, SYSTEM_PROMPTS['generate_linkedin_comment'], sendResponse);
            break;

        default:
            sendResponse({
                success: false,
                error: `Unknown action: ${request.action}`
            });
    }

    return true; // Will respond asynchronously
});

// Process standard requests (summary, key takeaway)
async function processRequest(request, systemPrompt, sendResponse) {
    try {
        const result = await makeAIRequest({
            action: request.action,
            content: request.content,
            systemPrompt: systemPrompt,
            history: request.history || []
        });
        sendResponse({ success: true, result });
    } catch (error) {
        console.error('Request processing error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Process chat requests
async function processChatRequest(request, sendResponse) {
    try {
        // For chat, we include the user's message in the messages array
        const history = request.history || [];
        const result = await makeAIRequest({
            action: request.action,
            content: request.content,
            systemPrompt: SYSTEM_PROMPTS.chat,
            history,
            userMessage: request.message
        });
        sendResponse({ success: true, result });
    } catch (error) {
        console.error('Chat processing error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Settings function is already defined above as getSettings()

// Main AI request dispatcher
async function makeAIRequest({ content, systemPrompt, history = [], userMessage = null, action }) {
    const settings = await getSettings();

    // 1. Determine the final system prompt, especially for LinkedIn comments
    let finalSystemPrompt = systemPrompt;
    if (action === 'generate_linkedin_comment') {
        if (settings.userProfileInfo) {
            finalSystemPrompt = SYSTEM_PROMPTS['generate_linkedin_comment'];
        } else {
            finalSystemPrompt = SYSTEM_PROMPTS['generate_linkedin_comment_generic'];
        }
    }

    // 2. Dispatch based on the selected provider
    if (settings.provider === 'essenca_api') {
        const url = `${ESSENCA_API_URL}/process`;
        const body = {
            action,
            content,
            user_profile: settings.userProfileInfo || null,
            history: history || [],
            message: userMessage || '',
            additional_instructions: settings.systemPrompt || ''
        };

        // Use new simple API key request
        const data = await makeEssencaRequest(url, body);
        return data.result;

    } else if (settings.provider === 'openai') {
        if (!settings.openaiApiKey) {
            throw new Error('OpenAI API key not configured. Please set it in the extension options.');
        }

        let finalContent = content;
        // Special content formatting for persona-based LinkedIn comments
        if (action === 'generate_linkedin_comment' && settings.userProfileInfo) {
            finalContent = `USER PROFILE:\n${settings.userProfileInfo}\n\nPOST CONTENT:\n${content}`;
        }

        // Enhance system prompt with additional instructions if provided
        let enhancedSystemPrompt = finalSystemPrompt;
        if (settings.systemPrompt && settings.systemPrompt.trim()) {
            enhancedSystemPrompt = `${finalSystemPrompt}

IMPORTANT ADDITIONAL INSTRUCTIONS:
${settings.systemPrompt}

Please follow these additional instructions carefully as they are user-specific requirements that must be prioritized.`;
        }

        const messages = [
            { role: 'system', content: enhancedSystemPrompt },
            ...history,
            { role: 'user', content: userMessage ? userMessage : finalContent }
        ];
        return makeOpenAIRequestWithMessages(messages, settings);

    } else if (settings.provider === 'gemini') {
        if (!settings.geminiApiKey) {
            throw new Error('Gemini API key not configured. Please set it in the extension options.');
        }

        let finalContent = `Page content:\n${content}`;
        // Special content formatting for persona-based LinkedIn comments
        if (action === 'generate_linkedin_comment' && settings.userProfileInfo) {
            finalContent = `USER PROFILE:\n${settings.userProfileInfo}\n\nPOST CONTENT:\n${content}`;
        }

        // Enhance system prompt with additional instructions if provided
        let enhancedSystemPrompt = finalSystemPrompt;
        if (settings.systemPrompt && settings.systemPrompt.trim()) {
            enhancedSystemPrompt = `${finalSystemPrompt}

IMPORTANT ADDITIONAL INSTRUCTIONS:
${settings.systemPrompt}

Please follow these additional instructions carefully as they are user-specific requirements that must be prioritized.`;
        }

        let prompt = `${enhancedSystemPrompt}\n\n${finalContent}`;
        if (userMessage) {
            prompt += `\n\nUser question: ${userMessage}`;
        }

        const url = `${GEMINI_API_URL_BASE}${settings.model}:generateContent?key=${settings.geminiApiKey}`;
        const body = JSON.stringify({ contents: [{ parts: [{ text: prompt.trim() }] }] });
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to get response from Gemini');
        }
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Unexpected Gemini response format');
        }
    } else {
        throw new Error('Unknown provider selected.');
    }
}

// Make API call to OpenAI with standard format
async function makeOpenAIRequest(content, systemPrompt, history = []) {
    const settings = await getSettings();

    if (!settings.openaiApiKey) {
        throw new Error('OpenAI API key not configured. Please set it in the extension options.');
    }

    // Enhance system prompt with additional instructions if provided
    let enhancedSystemPrompt = systemPrompt;
    if (settings.systemPrompt && settings.systemPrompt.trim()) {
        enhancedSystemPrompt = `${systemPrompt}

IMPORTANT ADDITIONAL INSTRUCTIONS:
${settings.systemPrompt}

Please follow these additional instructions carefully as they are user-specific requirements.`;
    }

    // Construct messages array
    const messages = [
        { role: 'system', content: enhancedSystemPrompt },
        // Add conversation history if available
        ...history,
        // Add the page content as user message
        { role: 'user', content: "Page content:\n\n" + content }
    ];

    return makeOpenAIRequestWithMessages(messages, settings);
}

// Make API call to OpenAI with custom messages
async function makeOpenAIRequestWithMessages(messages, settings = null) {
    if (!settings) {
        settings = await getSettings();
    }

    if (!settings.openaiApiKey) {
        throw new Error('OpenAI API key not configured. Please set it in the extension options.');
    }

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.openaiApiKey}`
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to get response from OpenAI');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error(`Failed to process request: ${error.message}`);
    }
}
