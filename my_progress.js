function pct(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function formatAttempts(n) {
  if (typeof n !== "number") return "0";
  return String(n);
}

function drawLineChart(canvas, labels, accuracyByDay) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Background grid
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = (h / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Build points (skip nulls)
  const valid = accuracyByDay
    .map((a, idx) => ({ a, idx }))
    .filter(p => typeof p.a === "number");

  if (valid.length < 2) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "14px Arial";
    ctx.fillText("Complete at least 2 quiz attempts to see a trend.", 16, 28);
    return;
  }

  const xStep = w / (labels.length - 1);
  const toY = (acc) => {
    // acc: 0..1
    const marginTop = 16;
    const marginBottom = 24;
    const usable = h - marginTop - marginBottom;
    return marginTop + (1 - acc) * usable;
  };

  // Line
  ctx.strokeStyle = "#66fcf1";
  ctx.lineWidth = 2;
  ctx.beginPath();

  // Find first valid index
  const firstIdx = valid[0].idx;
  let started = false;
  for (let i = 0; i < accuracyByDay.length; i++) {
    const a = accuracyByDay[i];
    if (typeof a !== "number") continue;
    const x = i * xStep;
    const y = toY(a);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Points
  valid.forEach(({ a, idx }) => {
    const x = idx * xStep;
    const y = toY(a);
    ctx.fillStyle = "#66fcf1";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
  });

  // X labels (mm/dd)
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "12px Arial";
  const stride = Math.max(1, Math.floor(labels.length / 6));
  labels.forEach((lab, i) => {
    if (i % stride !== 0 && i !== labels.length - 1) return;
    ctx.fillText(lab, i * xStep - 10, h - 8);
  });
}

function init() {
  const streak = window.quizProgress.getStreak();
  const streakValue = document.getElementById("streakValue");
  const streakMeta = document.getElementById("streakMeta");

  if (streakValue) streakValue.textContent = String(streak.currentStreak || 0);
  if (streakMeta) {
    const last = streak.lastPracticeDate;
    streakMeta.textContent = last ? `Last practice: ${last}` : "No practice yet.";
  }

  const overall = window.quizProgress.getOverallAccuracy();
  const overallAccuracyValue = document.getElementById("overallAccuracyValue");
  const overallAccuracyMeta = document.getElementById("overallAccuracyMeta");

  if (overallAccuracyValue) overallAccuracyValue.textContent = overall.accuracy == null ? "—" : pct(overall.accuracy);
  if (overallAccuracyMeta) {
    overallAccuracyMeta.textContent = overall.total > 0 ? `${overall.correct} correct out of ${overall.total} answers` : "Complete a quiz to populate your stats.";
  }

  // Chart
  const series = window.quizProgress.getAccuracySeries({ days: 14 });
  const canvas = document.getElementById("accuracyChart");
  if (canvas) {
    // Ensure canvas resolution matches layout size
    // (Canvas width/height are attributes; default may be too small.)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(240 * dpr);

    drawLineChart(canvas, series.labels, series.accuracyByDay);
  }

  // Topic stats
  const topicStatsEl = document.getElementById("topicStats");
  const byTopic = window.quizProgress.getAllTopicStats();

  if (topicStatsEl) {
    const topics = window.quizProgress.QUIZ_TOPICS;
    const sorted = [...topics].sort((a, b) => {
      const aAttempts = byTopic[a.id]?.attempts || 0;
      const bAttempts = byTopic[b.id]?.attempts || 0;
      return bAttempts - aAttempts;
    });

    topicStatsEl.innerHTML = "";

    sorted.forEach(t => {
      const agg = byTopic[t.id];
      const attempts = agg?.attempts || 0;
      const qTotal = agg?.questionsTotal || 0;
      const correctTotal = agg?.correctTotal || 0;
      const accuracy = qTotal > 0 ? correctTotal / qTotal : null;
      const barW = accuracy == null ? 0 : Math.max(0, Math.min(100, Math.round(accuracy * 100)));

      const row = document.createElement("div");
      row.className = "topic-row";
      row.innerHTML = `
        <div style="min-width: 210px; font-weight: 600">${t.label}</div>
        <div class="bar" aria-label="accuracy bar">
          <i style="width:${barW}%; background:${accuracy == null ? "rgba(255,255,255,0.22)" : "#66fcf1"}"></i>
        </div>
        <div style="min-width: 92px; text-align:right">
          <div style="font-weight:700">${accuracy == null ? "—" : pct(accuracy)}</div>
          <div class="muted" style="font-size:12px">${formatAttempts(attempts)} attempts</div>
        </div>
      `;

      topicStatsEl.appendChild(row);
    });
  }

  // Recommendations
  const recEl = document.getElementById("recommendedTopics");
  if (recEl) {
    const recs = window.quizProgress.getRecommendedTopics({ limit: 3 });
    recEl.innerHTML = "";
    recs.forEach(r => {
      const chip = document.createElement("span");
      chip.className = "recommend-chip";
      const accText = r.accuracy == null ? "not attempted" : `accuracy ${pct(r.accuracy)}`;
      chip.textContent = `${r.topic.label} • ${accText}`;
      recEl.appendChild(chip);
    });
  }
}

function initReviewQueueWidget() {
  const widget = document.getElementById("reviewQueueWidget");
  if (!widget) return;

  const STORAGE_KEY = "learnsphere_review_schedule_v1";
  let schedule = {};
  try {
    schedule = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    schedule = {};
  }

  // Topic IDs must match progress.js topic list.
  const TOPIC_IDS = [
    "physics-motion",
    "physics-nlm",
    "physics-projectile",
    "physics-ray",
    "maths-calculus",
    "maths-vectors",
    "maths-probability",
    "maths-geometry",
    "chemistry-atomic",
    "chemistry-bonding",
    "chemistry-equil",
    "chemistry-thermo",
  ];

  function todayLocalISODate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseISODateToUTCStart(isoDateYYYYMMDD) {
    const [y, m, day] = isoDateYYYYMMDD.split("-".map(Number));
    const dt = new Date(y, m - 1, day, 0, 0, 0, 0);
    return Math.floor(dt.getTime() / 86400000);
  }

  const today = todayLocalISODate();
  const todayToken = parseISODateToUTCStart(today);

  let dueCount = 0;
  const nextDates = [];

  for (const topicId of TOPIC_IDS) {
    const s = schedule[topicId];
    if (!s || !s.nextReviewDate) continue;

    const nextToken = parseISODateToUTCStart(s.nextReviewDate);
    if (todayToken >= nextToken) {
      dueCount += 1;
    } else {
      nextDates.push(s.nextReviewDate);
    }
  }

  if (dueCount > 0) {
    widget.textContent = `${dueCount} review${dueCount === 1 ? "" : "s"} due today. Open Home to start review.`;
  } else {
    const earliest = nextDates.sort().shift();
    widget.textContent = earliest ? `Next review available in ${earliest} (open Home).` : "No reviews scheduled yet. Complete topics to start getting review sessions.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init();
  initReviewQueueWidget();
  if (window.achievements?.renderBadges) {
    window.achievements.renderBadges("badgesContainerMyProgress");
  }
});




