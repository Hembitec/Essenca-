// DOM Elements
const openOptionsButton = document.getElementById('openOptions');
const activateAssistantButton = document.getElementById('activateAssistant');
const statusDiv = document.getElementById('status');

// Open options page
openOptionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

// Activate the assistant on the current page
activateAssistantButton.addEventListener('click', () => {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            // Send a message to the content script to activate the assistant
            chrome.tabs.sendMessage(tabs[0].id, { action: 'activate_assistant' });

            // Close the popup
            window.close();
        }
    });
});

// Check API configuration status
chrome.storage.sync.get(['provider', 'openaiApiKey', 'geminiApiKey', 'model'], (syncResult) => {
    chrome.storage.local.get(['essenca_api_key'], (localResult) => {
        const provider = syncResult.provider || 'essenca_api';
        let isConfigured = false;
        let message = '';

        switch (provider) {
            case 'essenca_api':
                isConfigured = !!(localResult.essenca_api_key && localResult.essenca_api_key.startsWith('ESN_'));
                message = 'Essenca API key not configured. Please set it in options.';
                break;
            case 'openai':
                isConfigured = !!syncResult.openaiApiKey;
                message = 'OpenAI API key not configured.';
                break;
            case 'gemini':
                isConfigured = !!syncResult.geminiApiKey;
                message = 'Gemini API key not configured.';
                break;
        }

        if (!isConfigured) {
            statusDiv.innerHTML = `
                <span class="status-icon"><i class="fas fa-exclamation-triangle"></i></span>
                ${message}
            `;
            statusDiv.classList.add('not-configured');
        } else {
            let modelText = '';
            if (provider === 'essenca_api') {
                modelText = 'Using: Essenca API';
            } else {
                modelText = syncResult.model ? `Using: ${provider} / ${syncResult.model}` : 'Model not selected';
            }
            statusDiv.innerHTML = `
                <span class="status-icon configured"><i class="fas fa-check-circle"></i></span>
                <span class="status-text-main">Ready to analyze pages</span>
                <span class="status-text-secondary">${modelText}</span>
            `;
        }
    });
});
