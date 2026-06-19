/*
 * badges.js — Unified “Achievements & Badges” system (Milestones)
 *
 * Computes milestones from existing quiz stats stored by quizProgress.js:
 *   localStorage key: learnsphere_quiz_progress_v1
 *
 * Badges are persisted once unlocked in:
 *   localStorage key: learnsphere_achievements_v1
 */

(function () {
  const QUIZ_PROGRESS_KEY = "learnsphere_quiz_progress_v1"; // for visibility in devtools
  const ACHIEVEMENTS_KEY = "learnsphere_achievements_v1";

  const BADGES = [
    {
      id: "first_quiz_attempt",
      title: "First quiz attempt",
      description: "Complete your first quiz.",
      icon: "🏁",
      getProgress: (stats) => {
        const firstAttempt = (stats.attemptCount || 0) >= 1;
        return {
          unlocked: firstAttempt,
          progressText: firstAttempt ? "Unlocked" : "0/1"
        };
      }
    },
    {
      id: "five_topics_completed",
      title: "5 topics completed",
      description: "Attempt quizzes in at least 5 topics.",
      icon: "📚",
      getProgress: (stats) => {
        const target = 5;
        const done = stats.topicAttemptedCount || 0;
        return {
          unlocked: done >= target,
          progressText: `${Math.min(done, target)}/${target}`
        };
      }
    },
    {
      id: "seven_day_streak",
      title: "7-day practice streak",
      description: "Practice every day for 7 days.",
      icon: "🔥",
      getProgress: (stats) => {
        const target = 7;
        const done = stats.currentStreak || 0;
        return {
          unlocked: done >= target,
          progressText: `${Math.min(done, target)}/${target}`
        };
      }
    },
    {
      id: "ninety_percent_accuracy",
      title: "90%+ accuracy",
      description: "Maintain 90% accuracy across your attempts.",
      icon: "🎯",
      getProgress: (stats) => {
        const target = 0.9;
        const total = stats.overallTotalAnswers || 0;
        const acc = stats.overallAccuracy;
        const unlocked = typeof acc === "number" && acc >= target && total > 0;

        // For progress text, show either current acc or 0/1.
        let progressText;
        if (total <= 0 || typeof acc !== "number") {
          progressText = "No attempts";
        } else {
          progressText = `${Math.round(acc * 100)}%`;
        }

        return {
          unlocked,
          progressText
        };
      }
    }
  ];

  function loadAchievements() {
    try {
      const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
      if (!raw) return { unlocked: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { unlocked: {} };
      if (!parsed.unlocked || typeof parsed.unlocked !== "object") parsed.unlocked = {};
      return parsed;
    } catch {
      return { unlocked: {} };
    }
  }

  function saveAchievements(ach) {
    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(ach));
    } catch (e) {
      console.warn("LearnSphere: Could not save achievements.", e);
    }
  }

  function safeNumber(n) {
    return typeof n === "number" && !Number.isNaN(n) ? n : null;
  }

  function buildStatsFromQuizProgress() {
    if (!window.quizProgress) {
      return {
        attemptCount: 0,
        topicAttemptedCount: 0,
        currentStreak: 0,
        overallAccuracy: null,
        overallTotalAnswers: 0
      };
    }

    // Streak
    const streak = window.quizProgress.getStreak ? window.quizProgress.getStreak() : { currentStreak: 0 };

    // Overall accuracy
    const overall = window.quizProgress.getOverallAccuracy ? window.quizProgress.getOverallAccuracy() : { accuracy: null, total: 0 };

    // Topic completion proxy: count of topics with at least 1 quiz attempt
    const byTopic = window.quizProgress.getAllTopicStats ? window.quizProgress.getAllTopicStats() : {};
    const topics = window.quizProgress.QUIZ_TOPICS || [];
    let topicAttemptedCount = 0;
    for (const t of topics) {
      const a = byTopic[t.id];
      const attempts = a?.attempts || 0;
      if (attempts >= 1) topicAttemptedCount++;
    }

    // Attempt count (best effort): derived from topic stats totals
    // (quizProgress stores attempt list, but we don't have direct getter)
    // So estimate by summing per-topic attempts.
    let attemptCount = 0;
    for (const tId of Object.keys(byTopic || {})) {
      attemptCount += (byTopic[tId]?.attempts || 0);
    }

    return {
      attemptCount,
      topicAttemptedCount,
      currentStreak: safeNumber(streak?.currentStreak) ?? 0,
      overallAccuracy: overall?.accuracy == null ? null : safeNumber(overall.accuracy),
      overallTotalAnswers: safeNumber(overall?.total) ?? 0
    };
  }

  function unlockNewBadges(ach, stats) {
    let changed = false;

    for (const badge of BADGES) {
      const already = !!ach.unlocked[badge.id];
      const prog = badge.getProgress(stats);
      if (!already && prog.unlocked) {
        ach.unlocked[badge.id] = { unlockedAt: new Date().toISOString() };
        changed = true;
      }
    }

    if (changed) saveAchievements(ach);
    return ach;
  }

  function badgeCardHTML(badge, unlocked, progressText) {
    const dim = unlocked ? "" : "opacity:0.55; filter: grayscale(0.3);";
    const border = unlocked ? "border-color: rgba(102,252,241,0.55);" : "border-color: rgba(255,255,255,0.12);";
    const shadow = unlocked ? "0 10px 26px rgba(102,252,241,0.16)" : "none";

    return `
      <div class="badge-card" style="${dim} ${border} box-shadow:${shadow}">
        <div class="badge-top">
          <div class="badge-icon" aria-hidden="true" style="font-size:20px">${badge.icon}</div>
          <div style="min-width:0">
            <div class="badge-title" style="font-weight:800">${badge.title}</div>
            <div class="badge-desc" style="font-size:12px; opacity:0.85">${badge.description}</div>
          </div>
        </div>
        <div class="badge-bottom" style="margin-top:10px; font-size:12px; opacity:0.9">
          ${unlocked ? `<span style="color:#66fcf1; font-weight:700">Unlocked ✓</span>` : `<span>Locked • ${progressText}</span>`}
        </div>
      </div>
    `;
  }

  function ensureStyles(containerEl) {
    if (!containerEl) return;
    if (containerEl.dataset.badgesStylesApplied === "true") return;
    containerEl.dataset.badgesStylesApplied = "true";

    // Minimal inline styles so we don't touch global CSS too much.
    const style = document.createElement("style");
    style.textContent = `
      .badges-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 10px;
      }
      @media (max-width: 560px) { .badges-grid { grid-template-columns: 1fr; } }

      .badge-card {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: 12px;
        transition: transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
      }
      .badge-card:hover { transform: translateY(-2px); }
      .badge-top { display:flex; gap:10px; align-items:flex-start; }
      .badge-icon { width:26px; text-align:center; }

    `;
    document.head.appendChild(style);
  }

  function renderBadges(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    ensureStyles(container);

    const stats = buildStatsFromQuizProgress();
    const ach = loadAchievements();
    unlockNewBadges(ach, stats);

    const unlockedSet = ach.unlocked || {};

    container.innerHTML = `
      <div class="badges-grid" role="list" aria-label="Achievements and badges">
        ${BADGES.map((badge) => {
          const unlocked = !!unlockedSet[badge.id];
          const prog = badge.getProgress(stats);
          const progressText = prog.progressText || "";
          return `<div role="listitem">${badgeCardHTML(badge, unlocked, progressText)}</div>`;
        }).join("")}
      </div>
      <div style="margin-top:10px; font-size:12px; opacity:0.8">
        Badges are based on your quiz attempts, streak, and accuracy.
      </div>
    `;
  }

  window.achievements = {
    BADGES,
    renderBadges
  };
})();

