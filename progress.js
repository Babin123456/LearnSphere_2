/**
 * progress.js — LearnSphere Study Progress Tracker
 *
 * Manages topic-level progress states (Not Started → In Progress → Completed)
 * using localStorage for persistence across sessions.
 *
 * Usage: Include this script on home.html (or any page with #progressList).
 */

// ── Data ──────────────────────────────────────────────────────────────────────

/** @type {Array<{id: string, label: string, subject: string}>} */
const TOPICS = [
    { id: "physics-motion",       label: "Physics: Motion",                   subject: "physics"   },
    { id: "physics-nlm",          label: "Physics: Newton's Laws of Motion",  subject: "physics"   },
    { id: "physics-projectile",   label: "Physics: Projectile Motion",        subject: "physics"   },
    { id: "physics-ray",          label: "Physics: Ray Optics",               subject: "physics"   },
    { id: "maths-calculus",       label: "Maths: Calculus",                   subject: "maths"     },
    { id: "maths-vectors",        label: "Maths: Vectors & 3D Geometry",      subject: "maths"     },
    { id: "maths-probability",    label: "Maths: Probability & Statistics",   subject: "maths"     },
    { id: "maths-geometry",       label: "Maths: Coordinate Geometry",        subject: "maths"     },
    { id: "chemistry-atomic",     label: "Chemistry: Atomic Structure",       subject: "chemistry" },
    { id: "chemistry-bonding",    label: "Chemistry: Chemical Bonding",       subject: "chemistry" },
    { id: "chemistry-equil",      label: "Chemistry: Equilibrium",            subject: "chemistry" },
    { id: "chemistry-thermo",     label: "Chemistry: Thermodynamics",         subject: "chemistry" },
];

const STATES = ["not-started", "in-progress", "completed"];

const STATE_LABELS = {
    "not-started": "Not Started",
    "in-progress": "In Progress",
    "completed":   "Completed ✅",
};

const STATE_COLORS = {
    "not-started": "#888",
    "in-progress": "#f0a500",
    "completed":   "#66fcf1",
};

const STORAGE_KEY = "learnsphere_progress";

// ── Storage Helpers ───────────────────────────────────────────────────────────

function loadProgress() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function saveProgress(progressMap) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap));
    } catch (e) {
        console.warn("LearnSphere: Could not save progress to localStorage.", e);
    }
}

function getTopicState(progressMap, topicId) {
    return progressMap[topicId] || "not-started";
}

function cycleState(currentState) {
    const idx = STATES.indexOf(currentState);
    return STATES[(idx + 1) % STATES.length];
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderProgressList() {
    const list = document.getElementById("progressList");
    if (!list) return;

    const progressMap = loadProgress();
    list.innerHTML = ""; // Clear static placeholder items

    TOPICS.forEach(topic => {
        const state = getTopicState(progressMap, topic.id);

        const li = document.createElement("li");
        li.className = `progress-item progress-${state}`;
        li.setAttribute("data-topic-id", topic.id);

        const label = document.createElement("span");
        label.className = "progress-label";
        label.textContent = topic.label;

        const badge = document.createElement("button");
        badge.className = "progress-badge";
        badge.textContent = STATE_LABELS[state];
        badge.style.color = STATE_COLORS[state];
        badge.setAttribute("aria-label", `${topic.label}: ${STATE_LABELS[state]}. Click to change status.`);
        badge.setAttribute("title", "Click to cycle: Not Started → In Progress → Completed");

        badge.addEventListener("click", () => {
            const current = getTopicState(loadProgress(), topic.id);
            const next = cycleState(current);
            const updated = loadProgress();
            updated[topic.id] = next;
            saveProgress(updated);
            renderProgressList();       // Re-render to reflect change
            updateProgressSummary();    // Update summary bar
        });

        li.appendChild(label);
        li.appendChild(badge);
        list.appendChild(li);
    });
}

/** Render overall completion percentage bar */
function updateProgressSummary() {
    const summaryEl = document.getElementById("progress-summary");
    const barEl = document.getElementById("progress-bar-fill");
    if (!summaryEl || !barEl) return;

    const progressMap = loadProgress();
    const completed = TOPICS.filter(t => progressMap[t.id] === "completed").length;
    const pct = Math.round((completed / TOPICS.length) * 100);

    barEl.style.width = pct + "%";
    barEl.setAttribute("aria-valuenow", pct);
    summaryEl.textContent = `${completed} of ${TOPICS.length} topics completed (${pct}%)`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    renderProgressList();
    updateProgressSummary();
});
