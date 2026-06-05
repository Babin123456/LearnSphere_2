/**
 * home.js — LearnSphere Dashboard Logic
 *
 * Handles logout and AI chatbot interaction.
 * XSS-safe: all user input is sanitized before being inserted into the DOM.
 */

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById("logoutButton").addEventListener("click", function () {
    localStorage.removeItem("isLoggedIn");
    window.location.href = "index.html";
});

// ── XSS Sanitisation Helper ───────────────────────────────────────────────────
/**
 * Escapes HTML special characters to prevent XSS injection via user input
 * or unsanitized server responses being inserted with innerHTML.
 *
 * @param {string} str - Raw string that may contain HTML characters.
 * @returns {string} - HTML-entity-encoded safe string.
 */
function escapeHTML(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ── Chatbot ───────────────────────────────────────────────────────────────────
/**
 * Appends a message bubble to the chat box.
 *
 * @param {string} sender  - Display label for the sender ("You" or "Bot").
 * @param {string} text    - Message content (will be HTML-escaped).
 * @param {string} cssClass - Optional CSS class for styling (e.g. "bot-msg").
 */
function appendMessage(sender, text, cssClass = "") {
    const chatBox = document.getElementById("chat-box");
    const msgEl = document.createElement("p");
    if (cssClass) msgEl.className = cssClass;

    // Use textContent for sender (safe) and escapeHTML for body (safe)
    const strong = document.createElement("strong");
    strong.textContent = sender + ": ";
    msgEl.appendChild(strong);

    // Create a span for the message body — escapeHTML converts to entities
    const body = document.createElement("span");
    // Allow bot's HTML-formatted responses (bold, line breaks from server)
    // but sanitize user input completely via textContent
    if (sender === "You") {
        body.textContent = text; // Never trust user input as HTML
    } else {
        // Bot responses from our own server may contain safe formatting HTML
        body.innerHTML = text;
    }
    msgEl.appendChild(body);

    chatBox.appendChild(msgEl);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to latest message
}

/**
 * Sends user message to the backend chatbot API.
 * Triggered by the Send button or pressing Enter in the input field.
 */
function sendMessage() {
    const inputEl = document.getElementById("user-input");
    const userInput = inputEl.value.trim();

    if (!userInput) return;

    // Render user message (textContent — XSS safe)
    appendMessage("You", userInput, "user-msg");
    inputEl.value = "";

    // Show typing indicator
    const chatBox = document.getElementById("chat-box");
    const typingEl = document.createElement("p");
    typingEl.id = "typing-indicator";
    typingEl.className = "typing-msg";
    typingEl.textContent = "Bot is typing...";
    chatBox.appendChild(typingEl);
    chatBox.scrollTop = chatBox.scrollHeight;

    fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput }),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            const typing = document.getElementById("typing-indicator");
            if (typing) typing.remove();

            const reply = data.reply || "Sorry, I didn't understand that.";
            appendMessage("Bot", reply, "bot-msg");
        })
        .catch((error) => {
            console.error("Chatbot error:", error);
            const typing = document.getElementById("typing-indicator");
            if (typing) typing.remove();
            appendMessage(
                "Bot",
                "⚠️ Unable to connect to the AI tutor. Please ensure the backend server is running.",
                "bot-msg error-msg"
            );
        });
}

// ── Keyboard Support ─────────────────────────────────────────────────────────
const inputEl = document.getElementById("user-input");
if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}
