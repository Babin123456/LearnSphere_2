/**
 * classHeatmap.js — Class Mastery Heatmap Module
 *
 * Renders a topics-vs-students heatmap on a <canvas> element.
 * Data comes from localStorage (learnsphere_class_sessions_v1 and
 * learnsphere_quiz_progress_v1). Designed to be pluggable for a
 * future backend — all data access is through a single `getHeatmapData()`.
 *
 * Public API (window.classHeatmap):
 *   - getHeatmapData(options)   → { students[], topics[], matrix[][] }
 *   - renderHeatmap(canvas, data, options)
 *   - initHeatmapUI()           → wires up the teacher_analytics page
 */
(function () {
  "use strict";

  // ── Topic registry (mirrors quizProgress.js QUIZ_TOPICS) ────────────
  function _getTopics() {
    if (window.quizProgress?.QUIZ_TOPICS) {
      return window.quizProgress.QUIZ_TOPICS;
    }
    // Fallback hardcoded list
    return [
      { id: "physics-motion",     label: "Motion",          subject: "physics" },
      { id: "physics-nlm",        label: "Newton's Laws",   subject: "physics" },
      { id: "physics-projectile", label: "Projectile",      subject: "physics" },
      { id: "physics-ray",        label: "Ray Optics",      subject: "physics" },
      { id: "maths-calculus",     label: "Calculus",        subject: "maths" },
      { id: "maths-vectors",      label: "Vectors",         subject: "maths" },
      { id: "maths-probability",  label: "Probability",     subject: "maths" },
      { id: "maths-geometry",     label: "Geometry",        subject: "maths" },
      { id: "chemistry-atomic",   label: "Atomic Structure",subject: "chemistry" },
      { id: "chemistry-bonding",  label: "Bonding",         subject: "chemistry" },
      { id: "chemistry-equil",    label: "Equilibrium",     subject: "chemistry" },
      { id: "chemistry-thermo",   label: "Thermodynamics",  subject: "chemistry" },
    ];
  }

  // ── Data Aggregation ────────────────────────────────────────────────
  // In local-only mode we generate demo learner data from the single
  // user's localStorage + any class_manager sessions.  When a backend
  // exists, replace this function body with an API call.

  /**
   * @param {object} options
   * @param {string} [options.subject]   - "physics" | "maths" | "chemistry" | "all"
   * @param {string} [options.fromDate]  - ISO date YYYY-MM-DD
   * @param {string} [options.toDate]    - ISO date YYYY-MM-DD
   * @param {number} [options.maxStudents] - cap (default 12)
   * @returns {{ students: string[], topics: {id,label,subject}[], matrix: (number|null)[][] }}
   *   matrix[studentIdx][topicIdx] = accuracy 0..1 or null (no data)
   */
  function getHeatmapData(options = {}) {
    const {
      subject = "all",
      fromDate = null,
      toDate = null,
      maxStudents = 12,
    } = options;

    // 1. Gather topics (optionally filtered by subject)
    let topics = _getTopics();
    if (subject && subject !== "all") {
      topics = topics.filter((t) => t.subject === subject);
    }

    // 2. Collect per-student attempt data
    //    Source A: class_manager sessions (multi-student)
    //    Source B: current user's quiz progress (single learner fallback)
    const studentMap = new Map(); // studentId → Map<topicId, { correct, total }>

    // Source A: Class sessions
    try {
      const classSessions = JSON.parse(
        localStorage.getItem("learnsphere_class_sessions_v1") || "[]"
      );
      for (const cls of classSessions) {
        if (!Array.isArray(cls.attempts)) continue;
        for (const att of cls.attempts) {
          const sid = att.studentId || "anonymous";
          const topicId = att.topicId || _quizIdToTopicId(att.quizId) || null;
          if (!topicId) continue;
          if (!_inDateRange(att.timestamp, fromDate, toDate)) continue;
          _addToStudentMap(studentMap, sid, topicId, att.score, att.totalQuestions, att.correctCount);
        }
      }
    } catch {}

    // Source B: Current user's quiz progress
    try {
      const raw = localStorage.getItem("learnsphere_quiz_progress_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        const attempts = Array.isArray(parsed?.attempts) ? parsed.attempts : [];
        for (const att of attempts) {
          const topicId = att.topicId || null;
          if (!topicId) continue;
          if (!_inDateRange(att.finishedAt || att.startedAt, fromDate, toDate)) continue;
          _addToStudentMap(
            studentMap,
            "You (current user)",
            topicId,
            att.score,
            att.totalQuestions,
            att.correctCount
          );
        }
      }
    } catch {}

    // If we still have no students, generate demo data so the heatmap isn't empty
    if (studentMap.size === 0) {
      _generateDemoData(studentMap, topics);
    }

    // 3. Build matrix
    const allStudents = Array.from(studentMap.keys()).slice(0, maxStudents);
    const topicIds = topics.map((t) => t.id);

    const matrix = allStudents.map((sid) => {
      const studentData = studentMap.get(sid);
      return topicIds.map((tid) => {
        const d = studentData?.get(tid);
        if (!d || d.total === 0) return null;
        return d.correct / d.total; // accuracy 0..1
      });
    });

    return { students: allStudents, topics, matrix };
  }

  function _addToStudentMap(map, studentId, topicId, score, totalQuestions, correctCount) {
    if (!map.has(studentId)) map.set(studentId, new Map());
    const sMap = map.get(studentId);
    if (!sMap.has(topicId)) sMap.set(topicId, { correct: 0, total: 0 });
    const bucket = sMap.get(topicId);

    if (correctCount != null && totalQuestions != null) {
      bucket.correct += Number(correctCount) || 0;
      bucket.total += Number(totalQuestions) || 0;
    } else if (score != null) {
      // score is assumed percentage (0-100)
      bucket.correct += Number(score) || 0;
      bucket.total += 100;
    }
  }

  function _quizIdToTopicId(quizId) {
    if (!quizId) return null;
    const topics = _getTopics();
    for (const t of topics) {
      if (t.quizIds && t.quizIds.some((q) => quizId.includes(q.replace("quiz:", "")))) {
        return t.id;
      }
    }
    return null;
  }

  function _inDateRange(timestamp, fromDate, toDate) {
    if (!fromDate && !toDate) return true;
    let ts = timestamp;
    if (typeof ts === "string") ts = new Date(ts).getTime();
    if (typeof ts !== "number" || !Number.isFinite(ts)) return true; // can't filter, include
    const d = new Date(ts);
    const dayStr = d.toISOString().slice(0, 10);
    if (fromDate && dayStr < fromDate) return false;
    if (toDate && dayStr > toDate) return false;
    return true;
  }

  function _generateDemoData(studentMap, topics) {
    const names = [
      "Aarav S.", "Priya M.", "Rohan K.", "Sneha P.", "Vikram J.",
      "Ananya R.", "Karthik L.", "Divya N.", "Arjun B.", "Meera T.",
    ];
    const rng = _seededRandom(42);
    for (const name of names) {
      const sMap = new Map();
      for (const t of topics) {
        // Each student has some topics with data, some null
        if (rng() < 0.15) continue; // 15% chance of no data
        const totalQ = Math.floor(rng() * 15) + 5;
        // Create varied accuracy: some students weak on some topics
        const basePct = 0.3 + rng() * 0.6;
        const correctQ = Math.min(totalQ, Math.round(basePct * totalQ));
        sMap.set(t.id, { correct: correctQ, total: totalQ });
      }
      studentMap.set(name, sMap);
    }
  }

  function _seededRandom(seed) {
    let s = seed;
    return function () {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // ── Heatmap Rendering (Canvas 2D) ──────────────────────────────────

  /**
   * Render a heatmap on a canvas element.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {{ students: string[], topics: {id,label}[], matrix: (number|null)[][] }} data
   * @param {object} [options]
   */
  function renderHeatmap(canvas, data, options = {}) {
    if (!canvas || !data) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const { students, topics, matrix } = data;
    if (!students.length || !topics.length) {
      _drawEmpty(ctx, canvas);
      return;
    }

    // Layout constants
    const cellW = options.cellWidth || 64;
    const cellH = options.cellHeight || 36;
    const labelLeftW = options.labelLeftWidth || 130;
    const labelTopH = options.labelTopHeight || 100;
    const padding = 8;

    const totalW = labelLeftW + topics.length * cellW + padding * 2;
    const totalH = labelTopH + students.length * cellH + padding * 2;

    // Size canvas
    canvas.width = Math.floor(totalW * dpr);
    canvas.height = Math.floor(totalH * dpr);
    canvas.style.width = totalW + "px";
    canvas.style.height = totalH + "px";
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, totalW, totalH);

    // Draw topic labels (top, rotated)
    ctx.save();
    ctx.font = "bold 11px 'Inter', 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.textAlign = "left";
    topics.forEach((t, i) => {
      const x = labelLeftW + i * cellW + cellW / 2;
      const y = labelTopH - 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 3);
      // Truncate long labels
      const label = t.label.length > 16 ? t.label.slice(0, 15) + "…" : t.label;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });
    ctx.restore();

    // Draw student labels (left)
    ctx.font = "600 12px 'Inter', 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    students.forEach((s, i) => {
      const y = labelTopH + i * cellH + cellH / 2;
      const label = s.length > 15 ? s.slice(0, 14) + "…" : s;
      ctx.fillText(label, labelLeftW - 8, y);
    });

    // Draw cells
    students.forEach((_, si) => {
      topics.forEach((_, ti) => {
        const val = matrix[si]?.[ti];
        const x = labelLeftW + ti * cellW;
        const y = labelTopH + si * cellH;

        // Cell background
        ctx.fillStyle = _accuracyColor(val);
        _roundRect(ctx, x + 1, y + 1, cellW - 2, cellH - 2, 4);
        ctx.fill();

        // Cell text (percentage)
        if (val != null) {
          ctx.font = "bold 11px 'Inter', 'Segoe UI', sans-serif";
          ctx.fillStyle = val > 0.55 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(Math.round(val * 100) + "%", x + cellW / 2, y + cellH / 2);
        } else {
          ctx.font = "10px 'Inter', sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("—", x + cellW / 2, y + cellH / 2);
        }
      });
    });

    // Draw subject separator lines
    let prevSubject = null;
    topics.forEach((t, ti) => {
      if (prevSubject && t.subject !== prevSubject) {
        const x = labelLeftW + ti * cellW;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, labelTopH);
        ctx.lineTo(x, labelTopH + students.length * cellH);
        ctx.stroke();
      }
      prevSubject = t.subject;
    });

    // Draw legend
    _drawLegend(ctx, totalW - 200, labelTopH - 28, 180);
  }

  function _accuracyColor(val) {
    if (val == null) return "rgba(255, 255, 255, 0.04)";
    // Gradient: red (0%) → orange (40%) → yellow (60%) → green (80%) → teal (100%)
    if (val >= 0.8) {
      // Teal-green
      const t = (val - 0.8) / 0.2;
      const r = Math.round(34 + (102 - 34) * t);
      const g = Math.round(197 + (252 - 197) * t);
      const b = Math.round(94 + (241 - 94) * t);
      return `rgba(${r}, ${g}, ${b}, 0.85)`;
    }
    if (val >= 0.6) {
      // Yellow-green
      const t = (val - 0.6) / 0.2;
      const r = Math.round(234 - (234 - 34) * t);
      const g = Math.round(179 + (197 - 179) * t);
      const b = Math.round(8 + (94 - 8) * t);
      return `rgba(${r}, ${g}, ${b}, 0.8)`;
    }
    if (val >= 0.4) {
      // Orange-yellow
      const t = (val - 0.4) / 0.2;
      const r = Math.round(245 - (245 - 234) * t);
      const g = Math.round(158 + (179 - 158) * t);
      const b = Math.round(11 - (11 - 8) * t);
      return `rgba(${r}, ${g}, ${b}, 0.75)`;
    }
    // Red-orange
    const t = val / 0.4;
    const r = Math.round(239 + (245 - 239) * t);
    const g = Math.round(68 + (158 - 68) * t);
    const b = Math.round(68 - (68 - 11) * t);
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
  }

  function _roundRect(ctx, x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function _drawLegend(ctx, x, y, width) {
    const h = 10;
    const steps = 20;
    const stepW = width / steps;

    // Legend label
    ctx.font = "bold 10px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = "left";
    ctx.fillText("0%", x, y - 3);
    ctx.textAlign = "right";
    ctx.fillText("100%", x + width, y - 3);

    // Gradient bar
    for (let i = 0; i < steps; i++) {
      const val = i / (steps - 1);
      ctx.fillStyle = _accuracyColor(val);
      _roundRect(ctx, x + i * stepW, y, stepW + 0.5, h, i === 0 ? 3 : i === steps - 1 ? 3 : 0);
      ctx.fill();
    }
  }

  function _drawEmpty(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data available for the selected filters.", canvas.width / 4, 40);
  }

  // ── Topic Aggregation Summary ──────────────────────────────────────

  /**
   * Compute class-wide topic gap analysis.
   * Returns topics sorted by class average accuracy (weakest first).
   */
  function getTopicGapAnalysis(data) {
    if (!data?.topics?.length || !data?.matrix?.length) return [];

    return data.topics.map((topic, ti) => {
      let totalAcc = 0;
      let count = 0;
      let lowest = 1;
      let highest = 0;

      data.matrix.forEach((row) => {
        const val = row[ti];
        if (val != null) {
          totalAcc += val;
          count++;
          if (val < lowest) lowest = val;
          if (val > highest) highest = val;
        }
      });

      const avg = count > 0 ? totalAcc / count : null;
      return {
        topicId: topic.id,
        label: topic.label,
        subject: topic.subject,
        avgAccuracy: avg,
        lowestAccuracy: count > 0 ? lowest : null,
        highestAccuracy: count > 0 ? highest : null,
        studentsWithData: count,
        totalStudents: data.students.length,
      };
    }).sort((a, b) => {
      if (a.avgAccuracy == null && b.avgAccuracy == null) return 0;
      if (a.avgAccuracy == null) return 1;
      if (b.avgAccuracy == null) return -1;
      return a.avgAccuracy - b.avgAccuracy; // weakest first
    });
  }

  // ── UI Wiring ─────────────────────────────────────────────────────

  function initHeatmapUI() {
    const canvas = document.getElementById("heatmapCanvas");
    const subjectSelect = document.getElementById("heatmapSubjectFilter");
    const fromDate = document.getElementById("heatmapFromDate");
    const toDate = document.getElementById("heatmapToDate");
    const applyBtn = document.getElementById("heatmapApplyBtn");
    const gapList = document.getElementById("heatmapGapList");

    if (!canvas) return;

    function refresh() {
      const opts = {
        subject: subjectSelect?.value || "all",
        fromDate: fromDate?.value || null,
        toDate: toDate?.value || null,
        maxStudents: 12,
      };
      const data = getHeatmapData(opts);
      renderHeatmap(canvas, data);

      // Render gap analysis
      if (gapList) {
        const gaps = getTopicGapAnalysis(data);
        gapList.innerHTML = "";

        if (gaps.length === 0) {
          gapList.innerHTML = '<div style="color:rgba(255,255,255,0.5); font-size:13px;">No topic data available.</div>';
          return;
        }

        gaps.forEach((g) => {
          const pct = g.avgAccuracy != null ? Math.round(g.avgAccuracy * 100) : null;
          const barColor = g.avgAccuracy != null ? _accuracyColor(g.avgAccuracy) : "rgba(255,255,255,0.08)";
          const barW = pct != null ? Math.max(0, Math.min(100, pct)) : 0;

          const row = document.createElement("div");
          row.className = "heatmap-gap-row";
          row.innerHTML = `
            <div class="gap-label">${g.label}</div>
            <div class="gap-bar-wrap">
              <div class="gap-bar" style="width:${barW}%; background:${barColor};"></div>
            </div>
            <div class="gap-pct" style="color:${barColor};">${pct != null ? pct + "%" : "—"}</div>
            <div class="gap-meta">${g.studentsWithData}/${g.totalStudents} students</div>
          `;
          gapList.appendChild(row);
        });
      }
    }

    if (applyBtn) {
      applyBtn.addEventListener("click", refresh);
    }

    // Also refresh when the existing teacher analytics Apply button is clicked
    const taApplyBtn = document.getElementById("taApplyBtn");
    if (taApplyBtn) {
      taApplyBtn.addEventListener("click", () => {
        // Sync date filters from teacher analytics to heatmap
        const taFrom = document.getElementById("taFromDate");
        const taTo = document.getElementById("taToDate");
        if (fromDate && taFrom) fromDate.value = taFrom.value;
        if (toDate && taTo) toDate.value = taTo.value;
        refresh();
      });
    }

    // Initial render
    refresh();
  }

  // ── Auto-init ─────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeatmapUI);
  } else {
    initHeatmapUI();
  }

  // ── Export ─────────────────────────────────────────────────────────
  window.classHeatmap = {
    getHeatmapData,
    renderHeatmap,
    getTopicGapAnalysis,
    initHeatmapUI,
  };
})();
