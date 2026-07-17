(function () {
  const MISSED_KEY = "learnsphere_review_missed_v1";

  function _todayLocalISODate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function _safeParse(json, fallback) {
    try {
      return JSON.parse(json) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadMissedMap() {
    return _safeParse(localStorage.getItem(MISSED_KEY), {});
  }

  function saveMissedMap(m) {
    try {
      localStorage.setItem(MISSED_KEY, JSON.stringify(m));
    } catch (e) {
      console.warn("LearnSphere: could not save missed map", e);
    }
  }

  function getTopicIdFromQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("topic") || urlParams.get("topicId") || null;
  }

  function buildExplainText(question) {
    if (!question) return "";
    if (typeof question.explanation === "string" && question.explanation.trim()) return question.explanation.trim();
    if (typeof question.explanation === "function") return question.explanation();
    return "";
  }

  function getReviewQuizBankForTopic(topicId) {
    if (window.ReviewMode && typeof window.ReviewMode.__getReviewQuizBank === "function") {
      return window.ReviewMode.__getReviewQuizBank(topicId);
    }
    return null;
  }

  function getMissedQids(topicId) {
    const map = loadMissedMap();
    const entry = map[topicId];
    const qids = entry && Array.isArray(entry.missedQids) ? entry.missedQids : [];
    return qids;
  }

  function setMissedQids(topicId, missedQids) {
    const map = loadMissedMap();
    map[topicId] = {
      ...(map[topicId] || {}),
      missedQids: Array.isArray(missedQids) ? missedQids : [],
      updatedAt: Date.now(),
    };
    saveMissedMap(map);
  }

  function renderList({ topicId, missedQids }) {
    const listEl = document.getElementById("rm-list");
    const totalEl = document.getElementById("rm-total-missed");
    const topicLabelEl = document.getElementById("rm-topic-label");

    if (totalEl) totalEl.textContent = String(missedQids.length);
    if (topicLabelEl) topicLabelEl.textContent = topicId || "—";

    if (!listEl) return;
    listEl.innerHTML = "";

    if (!topicId || missedQids.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">🔎</span>
          No missed questions found for this topic.
        </div>
      `;
      return;
    }

    const quizBank = getReviewQuizBankForTopic(topicId) || [];

    // quizBank items expected to have __qid
    const byQid = new Map();
    quizBank.forEach((q) => {
      if (q && typeof q.__qid === "string") byQid.set(q.__qid, q);
    });

    // Support both legacy missedQids shape (array of qid strings)
    // and enriched shape (array of objects { qid, selectedMisconceptionTags }).
    const normalizedMisses = missedQids.map((entry) => {
      if (typeof entry === 'string') return { qid: entry, selectedMisconceptionTags: [] };
      if (entry && typeof entry === 'object') {
        const qid = typeof entry.qid === 'string' ? entry.qid : null;
        const tags = Array.isArray(entry.selectedMisconceptionTags) ? entry.selectedMisconceptionTags : [];
        return { qid, selectedMisconceptionTags: tags };
      }
      return { qid: null, selectedMisconceptionTags: [] };
    }).filter(x => x.qid);

    const totalMissed = normalizedMisses.length;

    // Group by misconception tag (string)
    const groups = new Map();

    function getTagsForMiss(m) {
      if (Array.isArray(m.selectedMisconceptionTags) && m.selectedMisconceptionTags.length > 0) return m.selectedMisconceptionTags;
      return ['unknown-misconception'];
    }

    normalizedMisses.forEach((m) => {
      const tags = getTagsForMiss(m);
      tags.forEach(tag => {
        if (!groups.has(tag)) groups.set(tag, []);
        groups.get(tag).push(m);
      });
    });

    const groupEntries = Array.from(groups.entries())
      .map(([tag, misses]) => ({ tag, count: misses.length, misses }))
      .sort((a, b) => b.count - a.count);

    // Render: Mistakes by misconception (grouped)
    groupEntries.forEach((g, idx) => {
      const tagLabel = g.tag === 'unknown-misconception' ? 'Other (misconception not tagged)' : g.tag;

      const micro = (window.misconceptionMicroLessonsConfig && window.misconceptionMicroLessonsConfig[g.tag])
        ? window.misconceptionMicroLessonsConfig[g.tag]
        : null;

      const groupEl = document.createElement('div');
      groupEl.className = 'review-mistake-item';

      const title = micro?.title || `Practice: ${tagLabel}`;
      const summary = micro?.summary || 'Review the concept behind this mistake.';
      const steps = Array.isArray(micro?.steps) ? micro.steps : [];

      groupEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="font-weight:900; color: var(--text-color);">${idx + 1}. ${title}</div>
          <div class="review-mistake-meta">
            <span>Misconception tag: <strong>${tagLabel}</strong></span>
            <span>•</span>
            <span>Count: <strong>${g.count}</strong></span>
          </div>
          <div class="review-mistake-expl">
            <div style="font-weight:800; margin-bottom:6px;">Micro-lesson</div>
            <div style="margin-bottom:10px;">${summary}</div>
            ${steps.length ? `<ol style="margin: 0; padding-left: 18px;">${steps.map(s => `<li>${s}</li>`).join('')}</ol>` : ''}
          </div>
        </div>
      `;

      // Under each group, show the related missed questions (limited for readability)
      const listUnderGroup = document.createElement('div');
      listUnderGroup.style.marginTop = '12px';
      listUnderGroup.style.display = 'flex';
      listUnderGroup.style.flexDirection = 'column';
      listUnderGroup.style.gap = '10px';

      g.misses.slice(0, 12).forEach((m, mi) => {
        const q = byQid.get(m.qid);
        const qText = q?.q || "(Question text unavailable)";
        const correctIndex = typeof q?.answerIndex === "number" ? q.answerIndex : null;
        const correctText =
          correctIndex !== null && Array.isArray(q?.options) ? q.options[correctIndex] : "";

        const qEl = document.createElement('div');
        qEl.className = 'review-mistake-item';
        qEl.style.borderRadius = '10px';
        qEl.style.padding = '14px';
        qEl.style.background = 'rgba(255,255,255,0.02)';

        qEl.innerHTML = `
          <div class="review-mistake-q" style="margin-bottom:6px;">${mi + 1}. ${qText}</div>
          <div class="review-mistake-meta">
            <span>Correct answer: <strong>${correctText || '—'}</strong></span>
          </div>
          ${q?.explanation
            ? `<div class="review-mistake-expl" style="margin-top:8px;">${q.explanation}</div>`
            : ''}
        `;

        listUnderGroup.appendChild(qEl);
      });

      if (g.count > 12) {
        const more = document.createElement('div');
        more.className = 'small-note';
        more.textContent = `Showing first 12 of ${g.count} items for this misconception.`;
        listUnderGroup.appendChild(more);
      }

      groupEl.appendChild(listUnderGroup);
      listEl.appendChild(groupEl);
    });
  }

  function initRetryMode({ topicId }) {
    const retryBtn = document.getElementById("rm-retryBtn");
    const retryBtnEnabled = !!retryBtn;

    if (!retryBtnEnabled) return;

    const missedQids = getMissedQids(topicId);
    retryBtn.disabled = missedQids.length === 0;

    retryBtn.addEventListener("click", () => {
      if (!window.ReviewMode || typeof window.ReviewMode.start !== "function") return;

      // Start the review modal in retry-only mode.
      // We pass retryQids; ReviewMode.start will render only missed questions.
      window.ReviewMode.start(topicId, { retryQids: missedQids });
    });
  }

  function renderWeakTopicsSection() {
    const container = document.getElementById("rm-weak-topics");
    if (!container) return;

    if (!window.quizProgress || typeof window.quizProgress.getRecommendedTopics !== "function") {
      container.innerHTML = "";
      return;
    }

    const recs = window.quizProgress.getRecommendedTopics({ limit: 5 }) || [];

    container.innerHTML = "";

    if (!recs.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">✅</span>
          No weak topics identified yet.
        </div>
      `;
      return;
    }

    const sorted = recs.slice().sort((a,b) => (b.weakness||0) - (a.weakness||0));

    sorted.forEach((item) => {
      const topic = item.topic;
      const label = topic?.label || topic?.id || "—";
      const accuracy = typeof item.accuracy === "number" ? item.accuracy : null;
      const attempts = item.attempts || 0;
      const pct = accuracy === null ? null : Math.round(accuracy * 100);

      const topicCard = document.createElement("div");
      topicCard.className = "review-mistake-item";
      topicCard.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="font-weight:800; color: var(--text-color);">📌 ${label}</div>
          <div style="color: var(--text-muted); font-size: 0.85rem;">
            ${pct === null ? "No attempts yet" : `Accuracy: <strong>${pct}%</strong>`}
            <span style="margin: 0 8px;">•</span>
            Attempts: <strong>${attempts}</strong>
          </div>
          <div>
            <button class="action-btn primary rm-start-practice" type="button" data-topic-id="${topic?.id || ""}">
              Start practice: ${label}
            </button>
          </div>
        </div>
      `;
      container.appendChild(topicCard);
    });

    container.querySelectorAll(".rm-start-practice").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tid = btn.getAttribute("data-topic-id");
        if (!tid) return;
        // Keep UX consistent with this page: topic is driven by query param.
        window.location.href = `review_mistakes.html?topic=${encodeURIComponent(tid)}`;
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const topicId = getTopicIdFromQuery();

    const missedQids = getMissedQids(topicId);

    renderList({ topicId, missedQids });
    initRetryMode({ topicId });
    renderWeakTopicsSection();

    const retryBtn = document.getElementById("rm-retryBtn");
    if (retryBtn && missedQids.length > 0) retryBtn.disabled = false;

    // Listen for retry completion: ReviewMode should clear missed after successful retry.
    window.addEventListener("review-mistakes-retried", () => {
      const latestMissed = getMissedQids(topicId);
      renderList({ topicId, missedQids: latestMissed });
      initRetryMode({ topicId });
      renderWeakTopicsSection();
    });
  });

})();

