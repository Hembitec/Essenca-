// Default system prompt
const DEFAULT_SYSTEM_PROMPT = `Read the following page content and create a concise bullet-point summary that captures:
• Main topic and key arguments
• Important facts and statistics
• Key takeaways and conclusions
Format the response as clear, easy-to-read bullet points.`;

// DOM Elements
const apiKeyInput = document.getElementById('apiKey');
const modelInput = document.getElementById('model');
const systemPromptTextarea = document.getElementById('systemPrompt');
const userProfileInfoTextarea = document.getElementById('userProfileInfo');
const userProfileFileInput = document.getElementById('userProfileFile');
const fileUploadBtn = document.getElementById('fileUploadBtn');
const saveButton = document.getElementById('save');
const resetButton = document.getElementById('reset');
const statusDiv = document.getElementById('status');
const modelOptions = document.querySelectorAll('.model-option');
const providerSelect = document.getElementById('provider');
const openaiApiKeyInput = document.getElementById('openaiApiKey');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const modelOptionsOpenAI = document.getElementById('modelOptionsOpenAI');
const modelOptionsGemini = document.getElementById('modelOptionsGemini');
const modelHintOpenAI = document.getElementById('modelHintOpenAI');
const modelHintGemini = document.getElementById('modelHintGemini');
const openaiApiGroup = document.getElementById('openai-api-group');
const geminiApiGroup = document.getElementById('gemini-api-group');
const essencaApiGroup = document.getElementById('essenca-api-group');
const essencaApiKeyInput = document.getElementById('essencaApiKey');
const testEssencaApiIcon = document.getElementById('test-essenca-api');
const essencaBalanceInfo = document.getElementById('essenca-balance-info');
const tokenBalanceSpan = document.getElementById('token-balance');

// API URL
const API_BASE_URL = 'https://essenca-admin.vercel.app/api/essenca/v1';

// Load saved settings
function loadSettings() {
    chrome.storage.local.get(['essenca_api_key'], (localData) => {
        if (localData.essenca_api_key) {
            essencaApiKeyInput.value = localData.essenca_api_key;
            // Fetch balance if API key is available
            fetchTokenBalance(localData.essenca_api_key);
        }
    });

    chrome.storage.sync.get(
        {
            provider: 'essenca_api',
            openaiApiKey: '',
            geminiApiKey: '',
            model: 'gemini-2.5-flash',
            systemPrompt: '',
            userProfileInfo: ''
        },
        (items) => {
            providerSelect.value = items.provider;
            openaiApiKeyInput.value = items.openaiApiKey;
            geminiApiKeyInput.value = items.geminiApiKey;
            modelInput.value = items.model;
            systemPromptTextarea.value = items.systemPrompt;
            userProfileInfoTextarea.value = items.userProfileInfo;
            updateProviderUI(items.provider);
            updateModelOptionSelection(items.model);
        }
    );
}

// Update model option selection
function updateModelOptionSelection(selectedModel) {
    let options = providerSelect.value === 'openai' ? modelOptionsOpenAI : modelOptionsGemini;
    Array.from(options.querySelectorAll('.model-option')).forEach(option => {
        if (option.dataset.model === selectedModel) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// Save settings
function saveSettings() {
    const provider = providerSelect.value;
    const openaiApiKey = openaiApiKeyInput.value.trim();
    const geminiApiKey = geminiApiKeyInput.value.trim();
    const essencaApiKey = essencaApiKeyInput.value.trim();
    const model = modelInput.value.trim();
    const systemPrompt = systemPromptTextarea.value.trim();
    const userProfileInfo = userProfileInfoTextarea.value.trim();

    if (provider === 'openai' && !openaiApiKey) {
        showStatus('Error: OpenAI API key is required.', 'error');
        return;
    }
    if (provider === 'gemini' && !geminiApiKey) {
        showStatus('Error: Gemini API key is required.', 'error');
        return;
    }
    if (provider === 'essenca_api' && (!essencaApiKey || !essencaApiKey.startsWith('ESN_'))) {
        showStatus('Error: Valid Essenca API key is required (must start with ESN_).', 'error');
        return;
    }
    if (provider !== 'essenca_api' && !model) {
        showStatus('Error: Model name cannot be empty', 'error');
        return;
    }

    // Save sync settings
    chrome.storage.sync.set(
        {
            provider: provider,
            openaiApiKey: openaiApiKey,
            geminiApiKey: geminiApiKey,
            model: model,
            systemPrompt: systemPrompt,
            userProfileInfo: userProfileInfo
        },
        () => {
            if (chrome.runtime.lastError) {
                showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            // Save Essenca API key locally
            if (provider === 'essenca_api') {
                chrome.storage.local.set({ essenca_api_key: essencaApiKey }, () => {
                    if (chrome.runtime.lastError) {
                        showStatus('Error saving API key: ' + chrome.runtime.lastError.message, 'error');
                    } else {
                        showStatus('Settings saved successfully!', 'success');
                    }
                });
            } else {
                showStatus('Settings saved successfully!', 'success');
            }
        }
    );
}

// Reset settings to defaults
function resetSettings() {
    providerSelect.value = 'openai';
    openaiApiKeyInput.value = '';
    geminiApiKeyInput.value = '';
    modelInput.value = 'gpt-3.5-turbo';
    systemPromptTextarea.value = '';
    userProfileInfoTextarea.value = '';
    updateProviderUI('openai');
    updateModelOptionSelection('gpt-3.5-turbo');
    showStatus('Settings reset to defaults. Click Save to apply changes.', 'success');
}

// Show status message
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = 'block';

    // Hide status after 5 seconds
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.dataset.tab;

            tabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            tabContents.forEach(content => {
                if (content.id === tab) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    const toggleApiKeys = document.querySelectorAll('.toggle-api-key');
    toggleApiKeys.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                toggle.classList.remove('fa-eye');
                toggle.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                toggle.classList.remove('fa-eye-slash');
                toggle.classList.add('fa-eye');
            }
        });
    });
});
saveButton.addEventListener('click', saveSettings);
resetButton.addEventListener('click', resetSettings);
userProfileFileInput.addEventListener('change', handleFileSelect);
fileUploadBtn.addEventListener('click', () => userProfileFileInput.click());
testEssencaApiIcon.addEventListener('click', testEssencaApiKey);

// Handle model option selection
Array.from(document.querySelectorAll('.model-option')).forEach(option => {
    option.addEventListener('click', () => {
        const selectedModel = option.dataset.model;
        modelInput.value = selectedModel;
        updateModelOptionSelection(selectedModel);
    });
});

function updateProviderUI(provider) {
    openaiApiGroup.style.display = 'none';
    geminiApiGroup.style.display = 'none';
    essencaApiGroup.style.display = 'none';
    modelInput.parentElement.style.display = 'block';
    modelOptionsOpenAI.style.display = 'none';
    modelOptionsGemini.style.display = 'none';
    modelHintOpenAI.style.display = 'none';
    modelHintGemini.style.display = 'none';


    if (provider === 'openai') {
        openaiApiGroup.style.display = 'block';
        modelOptionsOpenAI.style.display = 'flex';
        modelHintOpenAI.style.display = 'block';
        modelInput.placeholder = 'gpt-3.5-turbo';
    } else if (provider === 'gemini') {
        geminiApiGroup.style.display = 'block';
        modelOptionsGemini.style.display = 'flex';
        modelHintGemini.style.display = 'block';
        modelInput.placeholder = 'gemini-pro';
    } else if (provider === 'essenca_api') {
        essencaApiGroup.style.display = 'block';
        modelInput.parentElement.style.display = 'none'; // Hide model selection
    }
}

providerSelect.addEventListener('change', function () {
    const newProvider = this.value;
    updateProviderUI(newProvider);

    // When provider changes, auto-save and set a default model for better UX
    let defaultModel = '';
    if (newProvider === 'openai') {
        defaultModel = 'gpt-3.5-turbo';
    } else if (newProvider === 'gemini') {
        defaultModel = 'gemini-2.5-flash'; // A sensible default
    }

    const settingsToSave = { provider: newProvider };

    if (newProvider !== 'essenca_api') {
        modelInput.value = defaultModel;
        updateModelOptionSelection(defaultModel);
        settingsToSave.model = defaultModel;
    } else {
        // For Essenca API, model is not user-configurable, so we can clear it.
        modelInput.value = '';
        updateModelOptionSelection('');
        settingsToSave.model = ''; // Save empty model
    }

    chrome.storage.sync.set(settingsToSave, () => {
        if (chrome.runtime.lastError) {
            console.error(`Error auto-saving provider/model: ${chrome.runtime.lastError.message}`);
        }
    });
});

// Test Essenca API Key
async function testEssencaApiKey() {
    const apiKey = essencaApiKeyInput.value.trim();
    
    if (!apiKey) {
        showStatus('❌ Please enter an API key first.', 'error');
        return;
    }
    
    testEssencaApiIcon.classList.add('testing');
    testEssencaApiIcon.classList.remove('fa-flask');
    testEssencaApiIcon.classList.add('fa-spinner', 'fa-spin');
    
    
    try {
        const response = await fetch(`${API_BASE_URL}/user/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`API key validation failed: ${response.status}`);
        }
        
        const data = await response.json();
        showStatus(`✅ API key test successful! Hello, ${data.username || data.email || 'User'}.`, 'success');
        
        // Fetch and display balance after successful test
        fetchTokenBalance(apiKey);
        
    } catch (error) {
        showStatus(`❌ API key test failed: ${error.message}`, 'error');
        // Hide balance info on error
        essencaBalanceInfo.style.display = 'none';
    } finally {
        testEssencaApiIcon.classList.remove('testing', 'fa-spinner', 'fa-spin');
        testEssencaApiIcon.classList.add('fa-flask');
    }
}

// Fetch and display token balance
async function fetchTokenBalance(apiKey) {
    try {
        const response = await fetch(`${API_BASE_URL}/balance`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch balance: ${response.status}`);
        }
        
        const data = await response.json();
        tokenBalanceSpan.textContent = data.balance || 'N/A';
        essencaBalanceInfo.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching token balance:', error);
        tokenBalanceSpan.textContent = 'Error';
        essencaBalanceInfo.style.display = 'none';
    }
}

// --- REMOVED: All complex authentication functions ---


// Handle file upload for personalization
function handleFileSelect(event) {
    const file = event.target.files[0];
    const fileNameSpan = document.getElementById('fileName');
    
    if (!file) {
        fileNameSpan.textContent = 'No file chosen';
        fileNameSpan.classList.remove('has-file');
        return;
    }
    
    // Allow both .txt and .md files. Note: MIME type for .md can be inconsistent.
    // A simple check for file extension is more reliable here.
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
        showStatus('Error: Please upload a .txt or .md file.', 'error');
        fileNameSpan.textContent = 'No file chosen';
        fileNameSpan.classList.remove('has-file');
        return;
    }

    // Update file name display
    fileNameSpan.textContent = file.name;
    fileNameSpan.classList.add('has-file');

    const reader = new FileReader();
    reader.onload = function (e) {
        userProfileInfoTextarea.value = e.target.result;
        showStatus(`Successfully loaded ${file.name}. Click Save to apply changes.`, 'success');
    };
    reader.onerror = function () {
        showStatus(`Error reading file: ${reader.error}`, 'error');
        fileNameSpan.textContent = 'No file chosen';
        fileNameSpan.classList.remove('has-file');
    };
    reader.readAsText(file);
}
