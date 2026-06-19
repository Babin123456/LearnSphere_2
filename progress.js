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
const REVIEW_SCHEDULE_KEY = "learnsphere_review_schedule_v1";

// ── Storage Helpers ───────────────────────────────────────────────────────────

function loadProgress() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function loadReviewSchedule() {
    try {
        return JSON.parse(localStorage.getItem(REVIEW_SCHEDULE_KEY)) || {};
    } catch {
        return {};
    }
}

function saveReviewSchedule(scheduleMap) {
    try {
        localStorage.setItem(REVIEW_SCHEDULE_KEY, JSON.stringify(scheduleMap));
    } catch (e) {
        console.warn("LearnSphere: Could not save review schedule.", e);
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

// ── Spaced Repetition Helpers ───────────────────────────────────────────────

function _todayLocalISODate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function _parseISODateToUTCStart(isoDateYYYYMMDD) {
    const [y, m, d] = isoDateYYYYMMDD.split("-".map(Number));
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Math.floor(dt.getTime() / 86400000);
}

function _addDaysISO(isoDateYYYYMMDD, days) {
    const token = _parseISODateToUTCStart(isoDateYYYYMMDD);
    const target = token + days;
    const dt = new Date(target * 86400000);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function getReviewScheduleForTopic(topicId) {
    const scheduleMap = loadReviewSchedule();
    return scheduleMap[topicId] || null;
}

function getReviewStatus(topicId) {
    const s = getReviewScheduleForTopic(topicId);
    const today = _todayLocalISODate();
    const todayToken = _parseISODateToUTCStart(today);

    if (!s || !s.nextReviewDate) {
        return { due: false, nextReviewDate: null, intervalDays: null, lastReviewedAt: null };
    }

    const nextToken = _parseISODateToUTCStart(s.nextReviewDate);
    const due = todayToken >= nextToken;
    return {
        due,
        nextReviewDate: s.nextReviewDate,
        intervalDays: typeof s.intervalDays === "number" ? s.intervalDays : null,
        lastReviewedAt: s.lastReviewedAt || null,
        scoreLast: typeof s.lastScorePct === "number" ? s.lastScorePct : null,
    };
}

function recordReviewResult({ topicId, scorePct, answeredCount = 0 }) {
    if (!topicId) return;
    const scheduleMap = loadReviewSchedule();

    const today = _todayLocalISODate();
    const prev = scheduleMap[topicId] || {};
    const prevInterval = typeof prev.intervalDays === "number" && prev.intervalDays > 0 ? prev.intervalDays : 1;

    const pct = typeof scorePct === "number" ? scorePct : 0;

    let nextInterval = prevInterval;
    if (pct >= 80) {
        nextInterval = Math.max(1, Math.round(prevInterval * 2));
    } else if (pct >= 50) {
        nextInterval = Math.max(1, Math.round(prevInterval * 1.3));
    } else {
        nextInterval = 1;
    }

    const nextReviewDate = _addDaysISO(today, nextInterval);

    scheduleMap[topicId] = {
        intervalDays: nextInterval,
        nextReviewDate,
        lastReviewedAt: today,
        lastScorePct: pct,
        lastAnsweredCount: answeredCount,
        updatedAt: Date.now(),
    };

    saveReviewSchedule(scheduleMap);
    return scheduleMap[topicId];
}

function formatDaysUntil(isoDate) {
    if (!isoDate) return "";
    const todayToken = _parseISODateToUTCStart(_todayLocalISODate());
    const nextToken = _parseISODateToUTCStart(isoDate);
    const delta = nextToken - todayToken;
    if (delta <= 0) return "0d";
    return `${delta}d`;
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

        // ── Review CTA ───────────────────────────────────────────────────────
        const reviewBtn = document.createElement("button");
        reviewBtn.className = "review-badge";
        const reviewStatus = getReviewStatus(topic.id);
        const isDue = !!reviewStatus.due;
        reviewBtn.disabled = !isDue;

        if (!reviewStatus.nextReviewDate) {
            // Not scheduled yet: let user review once they start.
            reviewBtn.disabled = false;
            reviewBtn.textContent = "Review";
        } else {
            reviewBtn.textContent = isDue ? "Review" : `Review in ${formatDaysUntil(reviewStatus.nextReviewDate)}`;
        }

        // Basic styling; assumes CSS may not exist yet.
        reviewBtn.style.marginLeft = "10px";
        reviewBtn.style.padding = "6px 12px";
        reviewBtn.style.borderRadius = "20px";
        reviewBtn.style.border = isDue ? "1px solid var(--accent-color)" : "1px solid rgba(255,255,255,0.18)";
        reviewBtn.style.background = isDue ? "rgba(102,252,241,0.12)" : "rgba(255,255,255,0.04)";
        reviewBtn.style.color = isDue ? "var(--accent-color)" : "rgba(255,255,255,0.55)";
        reviewBtn.style.fontWeight = "700";
        reviewBtn.style.cursor = isDue ? "pointer" : "not-allowed";

        reviewBtn.addEventListener("click", () => {
            // Expects review.js to expose window.ReviewMode.start(topicId)
            if (window.ReviewMode?.start) {
                window.ReviewMode.start(topic.id);
            } else {
                alert("Review mode is not ready yet.");
            }
        });

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
        li.appendChild(reviewBtn);
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
