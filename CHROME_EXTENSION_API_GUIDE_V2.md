# 📝 How to Build an Essenca Chrome Extension (Simple Step-by-Step Guide)

This guide will walk you through creating a basic Chrome extension that uses your Essenca API key to connect to the service.

---

### **Step 1: Create Your Project Files**

First, create a new folder for your extension. Inside it, create these three empty files:

1.  `manifest.json` - Tells Chrome about your extension.
2.  `popup.html` - The little window that appears when you click the extension icon.
3.  `popup.js` - The JavaScript code that makes the extension work.

---

### **Step 2: Configure the Manifest**

Copy and paste this code into your `manifest.json` file. This sets up the basic permissions and tells Chrome which files to use.

```json
{
  "manifest_version": 3,
  "name": "Essenca Quick Access",
  "version": "1.0",
  "description": "A simple extension to interact with the Essenca API.",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://essenca-admin.vercel.app/*"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "icons": {
    "128": "icon.png"
  }
}
```
*(Note: You'll also need an `icon.png` file in your folder for the extension icon).*

---

### **Step 3: Create the User Interface**

Copy and paste this code into `popup.html`. This creates a simple form for the user to enter and save their API key, and a button to test it.

```html
<!DOCTYPE html>
<html>
<head>
  <title>Essenca Settings</title>
  <style>
    body { font-family: sans-serif; width: 300px; padding: 10px; }
    input { width: 95%; padding: 5px; margin-bottom: 10px; }
    button { padding: 8px 12px; }
    #status { margin-top: 10px; font-weight: bold; }
  </style>
</head>
<body>
  <h3>Essenca API Settings</h3>
  <p>Enter your API Key from the Essenca dashboard.</p>
  <input type="text" id="apiKeyInput" placeholder="Paste your ESN_... key here">
  <button id="saveButton">Save Key</button>
  <hr>
  <button id="testButton">Test API (Get My Profile)</button>
  <div id="status"></div>
  <script src="popup.js"></script>
</body>
</html>
```

---

### **Step 4: Write the JavaScript Logic**

This is the core of the extension. Copy and paste this code into `popup.js`. I've added comments to explain what each part does.

```javascript
// File: popup.js

// --- Connect to HTML elements ---
const apiKeyInput = document.getElementById('apiKeyInput');
const saveButton = document.getElementById('saveButton');
const testButton = document.getElementById('testButton');
const statusDiv = document.getElementById('status');

const API_BASE_URL = 'https://essenca-admin.vercel.app';

// --- Function to save the API key ---
function saveApiKey() {
  const apiKey = apiKeyInput.value;
  if (apiKey && apiKey.startsWith('ESN_')) {
    // Use chrome.storage.local to save the key securely
    chrome.storage.local.set({ 'essenca_api_key': apiKey }, () => {
      statusDiv.textContent = '✅ Key saved successfully!';
      statusDiv.style.color = 'green';
    });
  } else {
    statusDiv.textContent = '❌ Invalid API Key format.';
    statusDiv.style.color = 'red';
  }
}

// --- Function to make a test API call ---
async function testApi() {
  statusDiv.textContent = 'Testing...';

  // 1. Retrieve the key from storage
  const result = await chrome.storage.local.get('essenca_api_key');
  const apiKey = result.essenca_api_key;

  if (!apiKey) {
    statusDiv.textContent = '❌ No API Key saved.';
    statusDiv.style.color = 'red';
    return;
  }

  try {
    // 2. Make the request with the Authorization header
    const response = await fetch(`${API_BASE_URL}/api/essenca/v1/user/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Authentication failed! Status: ${response.status}`);
    }

    const data = await response.json();
    // 3. Show a success message with the user's name
    statusDiv.textContent = `✅ Success! Hello, ${data.username}.`;
    statusDiv.style.color = 'green';

  } catch (error) {
    statusDiv.textContent = `❌ API Test Failed: ${error.message}`;
    statusDiv.style.color = 'red';
  }
}

// --- Load the saved key when the popup opens ---
document.addEventListener('DOMContentLoaded', async () => {
  const result = await chrome.storage.local.get('essenca_api_key');
  if (result.essenca_api_key) {
    apiKeyInput.value = result.essenca_api_key;
    statusDiv.textContent = 'API Key is loaded.';
    statusDiv.style.color = 'blue';
  }
});

// --- Attach functions to button clicks ---
saveButton.addEventListener('click', saveApiKey);
testButton.addEventListener('click', testApi);
```

---

### **Step 5: How to Get Your API Key**

1.  Log in to your account on the **Essenca User Dashboard**.
2.  Your API key will be displayed in your user profile automatically.
3.  Copy the key (it starts with `ESN_`) and paste it into your Chrome extension.

**Alternative Method - API Call:**
If you're building the dashboard, call the `/api/essenca/v1/user/me` endpoint after user login:

```javascript
// Get user data including API key
async function getUserApiKey() {
  try {
    const response = await fetch('/api/essenca/v1/user/me', {
      method: 'GET',
      credentials: 'include', // Include cookies for JWT auth
    });
    
    const userData = await response.json();
    return userData.api_key; // Returns: "ESN_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  } catch (error) {
    console.error('Failed to fetch API key:', error);
  }
}
```

**API Key Regeneration:**
If users need a new API key, call the regeneration endpoint:

```javascript
async function regenerateApiKey() {
  try {
    const response = await fetch('/api/essenca/v1/user/me/regenerate-api-key', {
      method: 'POST',
      credentials: 'include',
    });
    
    const result = await response.json();
    return result.newApiKey; // Returns new API key
  } catch (error) {
    console.error('Failed to regenerate API key:', error);
  }
}
```

---

### **Step 6: Available API Endpoints for Chrome Extension**

Your Chrome extension can now use these endpoints with the API key:

**Core Endpoints:**
- `/api/essenca/v1/user/me` - Get user profile and current API key
- `/api/essenca/v1/balance` - Check token balance  
- `/api/essenca/v1/process` - Main AI processing endpoint

**Authentication Format:**
All requests must include the Authorization header:
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${apiKey}` // apiKey starts with ESN_
}
```

That's it! You now have a working Chrome extension that authenticates securely with the Essenca API using the new API key system.