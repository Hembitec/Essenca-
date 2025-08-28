// LinkedIn Comment Assistant - Content Script

// Enable debug mode to see detailed logs in the console
const DEBUG = false;

// Helper function for logging
function debugLog(...args) {
    if (DEBUG) {
        console.log("[Comment Assistant]", ...args);
    }
}

class CommentAssistant {
    constructor() {
        this.observer = null;
        this.addedButtons = new Set();
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.processedPosts = new Set(); // Track processed posts
        this.isScanning = false; // Prevent concurrent scans
        debugLog("Initializing Comment Assistant");
        this.init();
    }

    init() {
        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.startObserving());
        } else {
            this.startObserving();
        }
    }

    startObserving() {
        // Initial scan with delay to ensure DOM stability
        setTimeout(() => this.addCommentIcons(), 500);

        // Simplified single detection strategy
        this.setupMutationObserver();
        this.setupPeriodicScan();
    }

    setupMutationObserver() {
        this.observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            // Check for comment box specifically
                            if (node.matches && (
                                node.matches('.comments-comment-box__form') ||
                                node.querySelector && node.querySelector('.comments-comment-box__form')
                            )) {
                                shouldScan = true;
                            }
                        }
                    });
                }
            });

            if (shouldScan) {
                // Immediate scan without debounce for better responsiveness
                setTimeout(() => this.addCommentIcons(), 100);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            attributeOldValue: false
        });
    }


    setupPeriodicScan() {
        // Simple periodic scan every 2 seconds
        setInterval(() => {
            this.addCommentIcons();
        }, 2000);
    }


    addCommentIcons() {
        // Simple, direct approach - find all comment boxes and add buttons
        const commentBoxes = document.querySelectorAll('.comments-comment-box__form');
        
        commentBoxes.forEach(box => {
            this.addCommentIconToLinkedIn(box);
        });
    }

    addCommentIconToLinkedIn(commentBox) {
        // Check if we already added a button to this comment box
        const existingButton = commentBox.querySelector('.comment-assistant-icon');
        if (existingButton) return;

        // Try multiple selector strategies for button container
        let buttonContainer = commentBox.querySelector('.display-flex.justify-space-between .display-flex:first-child') ||
                             commentBox.querySelector('.comments-comment-box__form-footer .display-flex') ||
                             commentBox.querySelector('.comments-comment-box-comment__form-footer .display-flex') ||
                             commentBox.querySelector('[data-test-id="comment-box-footer"] .display-flex');

        if (buttonContainer) {
            const commentButton = this.createCommentButton();
            // Insert as the first icon in the button container
            buttonContainer.insertAdjacentElement('afterbegin', commentButton);
        }
    }

    createCommentButton() {
        const button = document.createElement('button');
        button.className = `comment-assistant-icon comment-assistant-icon--linkedin`;
        button.type = 'button';
        button.title = 'Generate AI Comment Suggestion';
        button.setAttribute('aria-label', 'Generate AI Comment Suggestion');

        // Create comment icon using the custom Essenca PNG logo
        button.innerHTML = `
      <div class="comment-assistant-icon__content">
        <img class="comment-assistant-icon__icon" src="${chrome.runtime.getURL('assets/Essenca_logo.png')}" alt="Essenca Logo" width="20" height="20" style="object-fit: contain;">
        <svg class="comment-assistant-icon__spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 4V2A10 10 0 0 0 2 12H4A8 8 0 0 1 12 4Z" fill="#DA7756"/>
        </svg>
      </div>
    `;

        // Add click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleCommentIconClick(button);
        });

        return button;
    }

    handleCommentIconClick(button) {
        const postContainer = button.closest('.feed-shared-update-v2');
        const postContentElement = postContainer?.querySelector('.update-components-text.update-components-update-v2__commentary, .update-components-text');
        const postContent = postContentElement?.textContent.trim();

        if (!postContent) {
            alert("Could not find the post content to analyze.");
            return;
        }

        // Show loading state
        button.classList.add('comment-assistant-icon--loading');

        // Send post content to the background script for AI processing
        chrome.runtime.sendMessage({
            action: 'generate_linkedin_comment',
            content: postContent
        }, (response) => {
            // Remove loading state
            button.classList.remove('comment-assistant-icon--loading');

            if (response.success) {
                // Show success state briefly
                button.classList.add('comment-assistant-icon--success');
                setTimeout(() => {
                    button.classList.remove('comment-assistant-icon--success');
                }, 2000);

                // Insert the AI-generated comment
                this.insertAIComment(button, response.result);
            } else {
                // Handle error
                console.error("AI comment generation failed:", response.error);
                alert(`Error generating comment: ${response.error}`);
            }
        });
    }

    insertAIComment(button, comment) {
        console.log("[Comment Assistant] Inserting AI comment for platform: linkedin");

        const commentBox = button.closest('.comments-comment-box__form');
        const textEditor = commentBox?.querySelector('.ql-editor');

        if (textEditor) {
            // Focus the editor first
            textEditor.focus();

            // The editor might have a <p> tag already. We need to insert the text there.
            let p = textEditor.querySelector('p');
            if (!p) {
                // If no <p> tag, create one
                p = document.createElement('p');
                textEditor.appendChild(p);
            }

            // Clear existing content and set the new comment
            p.textContent = comment;

            // Remove the placeholder class
            textEditor.classList.remove('ql-blank');

            // Dispatch events to notify LinkedIn's framework (React) of the change.
            const events = ['input', 'change', 'blur', 'focus'];
            events.forEach(eventType => {
                textEditor.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
            });

            console.log("[Comment Assistant] Inserted AI comment for LinkedIn using robust method.");
        }
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }

    // Helper to inject a script into the page's context
    injectScript(func, args) {
        const script = document.createElement('script');
        script.textContent = `(${func.toString()}).apply(this, ${JSON.stringify(args)});`;
        document.head.appendChild(script);
        script.remove(); // Clean up the script tag immediately after execution
    }
}

// Initialize the extension
let commentAssistant = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        commentAssistant = new CommentAssistant();
    });
} else {
    commentAssistant = new CommentAssistant();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (commentAssistant) {
        commentAssistant.destroy();
    }
});
