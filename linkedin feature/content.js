// LinkedIn Comment Assistant - Content Script

// Enable debug mode to see detailed logs in the console
const DEBUG = true;

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
        // Initial scan
        this.addCommentIcons();

        // Set up mutation observer to catch dynamically loaded content
        this.observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldScan = true;
                }
            });

            if (shouldScan) {
                setTimeout(() => this.addCommentIcons(), 100);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    addCommentIcons() {
        // LinkedIn comment boxes
        const linkedinCommentBoxes = document.querySelectorAll('.comments-comment-box__form');

        linkedinCommentBoxes.forEach((commentBox) => {
            this.addCommentIconToLinkedIn(commentBox);
        });
    }

    addCommentIconToLinkedIn(commentBox) {
        // Check if we already added a button to this comment box
        const existingButton = commentBox.querySelector('.comment-assistant-icon');
        if (existingButton) return;

        // Find the container with other buttons (emoji, photo)
        const buttonContainer = commentBox.querySelector('.display-flex.justify-space-between .display-flex:first-child');

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
        <img class="comment-assistant-icon__icon" src="${chrome.runtime.getURL('Essenca_logo.png')}" alt="Essenca Logo" width="20" height="20" style="object-fit: contain;">
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
        debugLog(`Icon clicked on platform: linkedin`);

        const postContainer = button.closest('.feed-shared-update-v2');
        const postContentElement = postContainer?.querySelector('.update-components-text.update-components-update-v2__commentary, .update-components-text');
        const postContent = postContentElement?.textContent.trim();

        if (!postContent) {
            debugLog("LinkedIn Post content not found.");
            alert("Could not find the post content to analyze.");
            return;
        }

        debugLog("LinkedIn Post Content:", postContent);

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
        debugLog(`Inserting AI comment for platform: linkedin`);

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

            debugLog("Inserted AI comment for LinkedIn using robust method.");
        } else {
            debugLog("LinkedIn text editor (.ql-editor) not found.");
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
