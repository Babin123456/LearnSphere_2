/**
 * explore.js — Explore page personalized recommendations
 *
 * Renders “Recommended Next” using quizProgress mastery heuristics.
 */

(function () {
  "use strict";

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  const TOPIC_QUIZ_MAP = {
    "physics-motion": "quiz/motionquiz.html",
    "physics-nlm": "quiz/nlmquiz.html",
    "physics-projectile": "quiz/projectilequiz.html",
    "physics-ray": "quiz/rayquiz.html",
    "maths-calculus": "mathsquiz/calculusquiz.html",
    "maths-vectors": "mathsquiz/vectorquiz.html",
    "maths-probability": "mathsquiz/probabilityquiz.html",
    "maths-geometry": "mathsquiz/geometryquiz.html",
    "chemistry-atomic": "chemistryquiz/atomic_structurequiz.html",
    "chemistry-bonding": "chemistryquiz/chemical_bondingquiz.html",
    "chemistry-equil": "chemistryquiz/equilibriumquiz.html",
    "chemistry-thermo": "chemistryquiz/thermoquiz.html",
  };

  function renderRecommendations() {
    const recommendedContainer = document.getElementById("recommendedExploreList");
    if (!recommendedContainer) return;

    recommendedContainer.innerHTML = "";

    if (!window.quizProgress || typeof window.quizProgress.getRecommendedTopics !== "function") {
      recommendedContainer.innerHTML =
        '<p style="color: var(--text-muted); text-align: center; margin: 12px 0;">Recommendations unavailable.</p>';
      return;
    }

    const recommended = window.quizProgress.getRecommendedTopics({ limit: 3 }) || [];

    if (recommended.length === 0) {
      recommendedContainer.innerHTML =
        `<p style="color: var(--text-muted); text-align: center; margin: 12px 0;">No recommendations yet—start a quiz to build your learning path.</p>`;
      return;
    }

    recommended.forEach((item, idx) => {
      const topic = item.topic || {};
      const topicLabel = topic.label || item.topicId || topic.id || "Unknown Topic";
      const topicId = topic.id || "";
      const quizUrl = TOPIC_QUIZ_MAP[topicId];

      if (!quizUrl) return;

      let hint = "Focus on this next.";
      if (item.attempts === 0) hint = "Start this topic to get your baseline.";
      else if (typeof item.accuracy === "number") {
        if (item.accuracy < 0.4) hint = "Low accuracy—practice this next.";
        else if (item.accuracy < 0.7) hint = "Improve accuracy with one more round.";
        else hint = "Review to keep it sharp.";
      }

      const card = document.createElement("div");
      card.className = "assignment-card";
      card.style.borderLeftColor = "var(--accent-color)";

      card.innerHTML = `
        <div class="assignment-info">
          <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-color); font-weight: 600;">${escapeHTML(
            topicLabel
          )}</h3>
          <div class="assignment-meta">
            <span class="difficulty-badge" style="background: rgba(255,255,255,0.06); color: var(--accent-color);">#${
              idx + 1
            }</span>
            <span>•</span>
            <span>${escapeHTML(hint)}</span>
          </div>
        </div>
        <div class="assignment-actions">
          <a class="assignment-btn" href="${quizUrl}?recommended=true" aria-label="Start recommended quiz">
            Start Quiz
          </a>
        </div>
      `;

      recommendedContainer.appendChild(card);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    // reuse shared escape helper if already attached by home.js
    if (window.escapeHTML && typeof window.escapeHTML === "function") {
      escapeHTML = window.escapeHTML; // eslint-disable-line no-global-assign
    }

    renderRecommendations();
  });
})();

