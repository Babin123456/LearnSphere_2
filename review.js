/*
 * review.js — Spaced Repetition Review Mode
 *
 * Provides a small review quiz runner (placeholder implementation)
 * and updates per-topic nextReviewDate using spaced repetition logic
 * stored in progress.js localStorage key:
 *   learnsphere_review_schedule_v1
 *
 * Expected integration:
 * - progress.js calls: window.ReviewMode.start(topicId)
 * - home.html includes a modal container with ids used below.
 */

(function () {
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

  const REVIEW_SCHEDULE_KEY = "learnsphere_review_schedule_v1";

  function loadSchedule() {
    try {
      return JSON.parse(localStorage.getItem(REVIEW_SCHEDULE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSchedule(map) {
    try {
      localStorage.setItem(REVIEW_SCHEDULE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn("LearnSphere: Could not save review schedule.", e);
    }
  }

  function recordReviewResult({ topicId, scorePct, answeredCount = 0 }) {
    if (!topicId) return;

    const today = _todayLocalISODate();
    const schedule = loadSchedule();
    const prev = schedule[topicId] || {};

    const prevInterval =
      typeof prev.intervalDays === "number" && prev.intervalDays > 0 ? prev.intervalDays : 1;

    const pct = typeof scorePct === "number" ? scorePct : 0;

    let nextInterval = prevInterval;
    if (pct >= 80) {
      nextInterval = Math.max(1, Math.round(prevInterval * 2));
    } else if (pct >= 50) {
      nextInterval = Math.max(1, Math.round(prevInterval * 1.3));
    } else {
      nextInterval = 1;
    }

    schedule[topicId] = {
      intervalDays: nextInterval,
      nextReviewDate: _addDaysISO(today, nextInterval),
      lastReviewedAt: today,
      lastScorePct: pct,
      lastAnsweredCount: answeredCount,
      updatedAt: Date.now(),
    };

    saveSchedule(schedule);
    return schedule[topicId];
  }

  // Minimal question set per topic.
  // This is intentionally generic because each topic quiz page has its own
  // question bank and formats. This review mode is designed to be lightweight.
  function getReviewQuiz(topicId) {
    const bank = {
      "physics-motion": [
        {
          q: "Which quantity describes how fast an object changes its velocity?",
          options: ["Speed", "Acceleration", "Distance", "Momentum"],
          answerIndex: 1,
        },
        {
          q: "If velocity is constant, acceleration is…",
          options: ["Constant", "Zero", "Increasing", "Negative"],
          answerIndex: 1,
        },
      ],
      "physics-nlm": [
        {
          q: "Newton's First Law relates to…",
          options: ["Motion with constant force", "Inertia and tendency to maintain velocity", "Mutual attractions", "Energy conservation"],
          answerIndex: 1,
        },
        {
          q: "Newton's Second Law: F is proportional to…",
          options: ["Velocity", "Acceleration", "Mass only", "Distance"],
          answerIndex: 1,
        },
      ],
      "physics-projectile": [
        {
          q: "In projectile motion (neglecting air resistance), horizontal acceleration is…",
          options: ["Zero", "Constant positive", "Constant negative", "Depends on time"],
          answerIndex: 0,
        },
        {
          q: "Vertical motion is influenced by…",
          options: ["No forces", "Gravity", "Magnetism", "Friction"],
          answerIndex: 1,
        },
      ],
      "physics-ray": [
        {
          q: "When light refracts, it changes direction due to…",
          options: ["Different speeds in different media", "Reflection only", "Electric fields", "Mass"],
          answerIndex: 0,
        },
        {
          q: "A concave mirror generally…",
          options: ["Always forms a virtual image", "Can form real images depending on object position", "Only forms real images", "Cannot focus light"],
          answerIndex: 1,
        },
      ],
      "maths-calculus": [
        {
          q: "The derivative of a function represents its…",
          options: ["Average value", "Rate of change", "Total distance", "Constant term"],
          answerIndex: 1,
        },
        {
          q: "∫ f(x) dx is the…",
          options: ["Difference", "Integral/accumulation", "Derivative", "Logarithm"],
          answerIndex: 1,
        },
      ],
      "maths-vectors": [
        {
          q: "A vector is defined by…",
          options: ["Magnitude only", "Magnitude and direction", "Direction only", "Neither"],
          answerIndex: 1,
        },
        {
          q: "The dot product of perpendicular vectors is…",
          options: ["1", "0", "-1", "Infinity"],
          answerIndex: 1,
        },
      ],
      "maths-probability": [
        {
          q: "Probability values lie in the range…",
          options: ["0 to 1", "-1 to 1", "1 to 100", "0 to 100"],
          answerIndex: 0,
        },
        {
          q: "If events are independent, then P(A and B) =…",
          options: ["P(A)+P(B)", "P(A)×P(B)", "P(A)-P(B)", "1"],
          answerIndex: 1,
        },
      ],
      "maths-geometry": [
        {
          q: "Distance formula in coordinate geometry gives the…",
          options: ["Length between points", "Slope only", "Area only", "Angle only"],
          answerIndex: 0,
        },
        {
          q: "The slope of a line measures its…",
          options: ["Steepness", "Length", "Area", "Curvature"],
          answerIndex: 0,
        },
      ],
      "chemistry-atomic": [
        {
          q: "The atomic number equals the number of…",
          options: ["Neutrons", "Protons", "Electrons only", "Nucleons"],
          answerIndex: 1,
        },
        {
          q: "Isotopes have the same…",
          options: ["Mass number only", "Number of neutrons", "Atomic number (protons)", "Volume"],
          answerIndex: 2,
        },
      ],
      "chemistry-bonding": [
        {
          q: "An ionic bond forms due to…",
          options: ["Sharing electrons", "Transfer of electrons", "Unequal mass", "Magnetism"],
          answerIndex: 1,
        },
        {
          q: "A covalent bond involves…",
          options: ["Transfer of electrons", "Sharing of electrons", "No electrons", "Only ions"],
          answerIndex: 1,
        },
      ],
      "chemistry-equil": [
        {
          q: "At equilibrium, the…",
          options: ["Reaction stops", "Forward and reverse rates become equal", "Concentrations are always zero", "Temperature is zero"],
          answerIndex: 1,
        },
        {
          q: "Le Chatelier's principle helps predict how a system responds to…",
          options: ["Only pressure changes", "Perturbations (stress)", "Only colors", "No changes"],
          answerIndex: 1,
        },
      ],
      "chemistry-thermo": [
        {
          q: "Thermodynamics primarily studies…",
          options: ["Motion", "Heat and energy transformations", "Electricity only", "Sound"],
          answerIndex: 1,
        },
        {
          q: "A process is exothermic if it…",
          options: ["Absorbs heat", "Releases heat", "Has zero heat", "Always increases temperature"],
          answerIndex: 1,
        },
      ],
    };

    const generic = [
      {
        q: "Spaced repetition helps by…",
        options: ["Remembering less", "Improving long-term recall", "Skipping practice", "Only using notes"],
        answerIndex: 1,
      },
      {
        q: "A review should be taken when it’s…",
        options: ["Random", "Due / scheduled", "Never", "Only after exams"],
        answerIndex: 1,
      },
    ];

    return bank[topicId] || generic;
  }

  function ensureModal() {
    const modal = document.getElementById("reviewModal");
    if (!modal) return null;
    return modal;
  }

  function renderQuiz({ topicId, topicLabel }) {
    const modal = ensureModal();
    if (!modal) return;

    const quiz = getReviewQuiz(topicId);
    const modalTitle = document.getElementById("reviewModalTitle");
    const container = document.getElementById("reviewQuizContainer");
    const msg = document.getElementById("reviewResultMessage");
    const submitBtn = document.getElementById("reviewSubmitBtn");

    if (modalTitle) modalTitle.textContent = `Review: ${topicLabel || topicId}`;
    if (container) container.innerHTML = "";
    if (msg) msg.textContent = "";

    if (!container) return;

    quiz.forEach((item, idx) => {
      const qWrap = document.createElement("div");
      qWrap.className = "review-question";

      const h = document.createElement("div");
      h.className = "review-question-text";
      h.textContent = `${idx + 1}. ${item.q}`;

      const optionsWrap = document.createElement("div");
      optionsWrap.className = "review-options";

      item.options.forEach((opt, optIdx) => {
        const label = document.createElement("label");
        label.style.display = "block";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `review_q_${idx}`;
        radio.value = String(optIdx);

        label.appendChild(radio);
        label.appendChild(document.createTextNode(` ${opt}`));
        optionsWrap.appendChild(label);
      });

      qWrap.appendChild(h);
      qWrap.appendChild(optionsWrap);
      container.appendChild(qWrap);
    });

    if (submitBtn) submitBtn.disabled = false;

    modal.style.display = "block";
  }

  function closeModal() {
    const modal = document.getElementById("reviewModal");
    if (modal) modal.style.display = "none";
  }

  function readQuizAnswers() {
    const container = document.getElementById("reviewQuizContainer");
    if (!container) return { scorePct: 0, correctCount: 0, total: 0, answeredCount: 0 };

    // Determine question count from DOM by counting .review-question
    const questions = Array.from(container.querySelectorAll(".review-question"));
    const total = questions.length;

    // Recompute correct answers using topicId set in modal dataset
    const topicId = container.dataset.topicId;
    const quiz = getReviewQuiz(topicId);

    let correctCount = 0;
    let answeredCount = 0;

    for (let i = 0; i < total; i++) {
      const qWrap = questions[i];
      const checked = qWrap.querySelector(`input[name="review_q_${i}"]:checked`);
      if (!checked) continue;
      answeredCount += 1;

      const picked = Number(checked.value);
      if (picked === quiz[i].answerIndex) correctCount += 1;
    }

    const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return { scorePct, correctCount, total, answeredCount };
  }

  function start(topicId) {
    const schedule = loadSchedule();

    // Find a label from progress.js TOPICS (not accessible). Fallback to id.
    const topicLabel = topicId;

    const modal = ensureModal();
    const container = document.getElementById("reviewQuizContainer");
    if (container) container.dataset.topicId = topicId;

    renderQuiz({ topicId, topicLabel });

    const submitBtn = document.getElementById("reviewSubmitBtn");
    if (submitBtn) {
      submitBtn.onclick = function () {
        const { scorePct, correctCount, total, answeredCount } = readQuizAnswers();
        const msg = document.getElementById("reviewResultMessage");
        if (msg) msg.textContent = `Score: ${correctCount}/${total} (${scorePct}%).`;

        recordReviewResult({ topicId, scorePct, answeredCount });

        // Short delay, then close
        setTimeout(() => {
          closeModal();
          // Notify progress.js to re-render list
          window.dispatchEvent(new Event("review-saved"));
        }, 650);
      };
    }
  }

  window.ReviewMode = {
    start,
    closeModal,
  };
})();

