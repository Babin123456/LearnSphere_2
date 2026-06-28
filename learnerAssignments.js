(function () {
  'use strict';

  const ASSIGNMENTS_KEY = 'learnsphere_assignments';
  const ASSIGNMENT_SUBMISSIONS_KEY = 'learnsphere_assignment_submissions';
  const LEARNER_PROGRESS_KEY = 'learnsphere_assignment_learner_progress_v1';

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadAssignments() {
    return safeJsonParse(localStorage.getItem(ASSIGNMENTS_KEY), []);
  }

  function loadSubmissions() {
    return safeJsonParse(localStorage.getItem(ASSIGNMENT_SUBMISSIONS_KEY), []);
  }

  function loadLearnerProgress() {
    return safeJsonParse(localStorage.getItem(LEARNER_PROGRESS_KEY), {});
  }

  function saveLearnerProgress(p) {
    localStorage.setItem(LEARNER_PROGRESS_KEY, JSON.stringify(p));
  }

  function _todayLocalISODateTime() {
    return new Date();
  }

  // Due date locking rule:
  // - Teacher stores dueDate as YYYY-MM-DD from <input type="date">.
  // - We lock AFTER due time (strictly locked after due date).
  // Interpretation: assignment is allowed only on the due date; after 23:59:59.999 it is locked.
  function isLockedAfterDueDate(dueDateYYYYMMDD) {
    if (!dueDateYYYYMMDD) return true;

    const [y, m, d] = String(dueDateYYYYMMDD).split('-').map(Number);
    if (!y || !m || !d) return true;

    // End of due date in local time
    const dueEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
    return _todayLocalISODateTime().getTime() > dueEnd.getTime();
  }

  function getTopics() {
    return window.quizProgress?.QUIZ_TOPICS || [];
  }

  function formatTopics(topicIds) {
    const topics = getTopics();
    return (topicIds || [])
      .map((id) => {
        const found = topics.find((t) => t.id === id);
        return found ? found.label : id;
      })
      .join(', ');
  }

  function getAssignmentQuizUrl(topicIds) {
    // Launch rule:
    // - If assignment has multiple topicIds, we launch the first topic's quiz.
    // - This keeps behavior deterministic without needing teacher-defined ordering.
    // - `quizAssignmentHelper.js` records based on the current quiz's path.
    const topics = getTopics();
    const firstId = (topicIds || [])[0];
    const t = topics.find((x) => x.id === firstId);
    return t && Array.isArray(t.quizIds) && t.quizIds.length > 0 ? t.quizIds[0] : null;
  }

  function setActionButtonState(btn, { disabled, text, reason }) {
    btn.disabled = !!disabled;
    btn.textContent = text;
    if (reason) {
      btn.setAttribute('title', reason);
    } else {
      btn.removeAttribute('title');
    }
  }

  function getCompletionForAssignment(assignmentId) {
    const submissions = loadSubmissions();
    const email = (function () {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        return user?.email || 'guest@learnsphere.com';
      } catch {
        return 'guest@learnsphere.com';
      }
    })();

    // Our submissions are unique by (assignmentId, studentEmail) in quizAssignmentHelper.js
    return submissions.some((s) => s.assignmentId === assignmentId && s.studentEmail === email);
  }

  function recordLearnerAttemptStart(assignmentId) {
    const progress = loadLearnerProgress();
    if (!progress[assignmentId]) progress[assignmentId] = { startedAt: null, finishedAt: null, attemptsCount: 0 };
    progress[assignmentId].attemptsCount = (progress[assignmentId].attemptsCount || 0) + 1;
    progress[assignmentId].startedAt = progress[assignmentId].startedAt || new Date().toISOString();
    saveLearnerProgress(progress);
  }

  function isAttemptLockedBySingleAttemptRule(assignmentId) {
    const progress = loadLearnerProgress();
    const completed = getCompletionForAssignment(assignmentId);
    if (completed) return true;

    // If learner already started (attemptsCount >= 1), keep it locked to enforce single attempt.
    // Even if due date is still valid, retries are disallowed.
    const attemptsCount = progress?.[assignmentId]?.attemptsCount || 0;
    return attemptsCount >= 1;
  }

  function render() {
    const tableBody = document.getElementById('laTableBody');
    const emptyState = document.getElementById('laEmptyState');

    if (!tableBody) return;

    const assignments = loadAssignments();
    const submissions = loadSubmissions(); // used by completion check, but keep for potential stats

    const availableCountEl = document.getElementById('laAvailableCount');
    const completedCountEl = document.getElementById('laCompletedCount');
    const lockedCountEl = document.getElementById('laLockedCount');

    let available = 0;
    let completed = 0;
    let locked = 0;

    tableBody.innerHTML = '';

    if (!assignments || assignments.length === 0) {
      emptyState.style.display = '';
      return;
    }

    const sorted = [...assignments].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    sorted.forEach((asg) => {
      const dueLocked = isLockedAfterDueDate(asg.dueDate);
      const done = getCompletionForAssignment(asg.id);
      const attemptLocked = isAttemptLockedBySingleAttemptRule(asg.id);

      let statusText = '';
      let actionText = '';
      let disabled = true;
      let reason = '';

      if (done) {
        statusText = 'Completed';
        actionText = 'Completed';
        disabled = true;
        reason = '';
        completed += 1;
      } else if (dueLocked) {
        statusText = 'Locked (past due)';
        actionText = 'Locked';
        disabled = true;
        reason = 'This assignment is past its due date.';
        locked += 1;
      } else if (attemptLocked) {
        statusText = 'Locked (single attempt used)';
        actionText = 'Locked';
        disabled = true;
        reason = 'Single attempt rule: retries are not allowed.';
        locked += 1;
      } else {
        statusText = 'Ready';
        actionText = 'Start';
        disabled = false;
        reason = '';
        available += 1;
      }

      const topicText = formatTopics(asg.topicIds);

      const diffBadgeClass =
        asg.difficulty === 'easy' ? 'easy' : asg.difficulty === 'hard' ? 'hard' : 'medium';

      const quizUrl = getAssignmentQuizUrl(asg.topicIds);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:10px; font-weight:600;">${topicText}</td>
        <td style="padding:10px; text-align:center;">${asg.numQuestions ?? '—'}</td>
        <td style="padding:10px; text-align:center;"><span class="difficulty-badge ${diffBadgeClass}">${String(asg.difficulty || 'medium').toUpperCase()}</span></td>
        <td style="padding:10px; text-align:center;">${asg.dueDate ?? '—'}</td>
        <td style="padding:10px; text-align:center; font-weight:800; color:${done ? 'var(--completed-color, #10b981)' : (dueLocked ? '#ef4444' : 'var(--accent-color)')};">${statusText}</td>
        <td style="padding:10px; text-align:center;">
          <button class="la-start-btn" data-assignment-id="${asg.id}" style="background:var(--btn-primary-bg, #1b9aaa); color:#fff; border:none; padding:9px 14px; border-radius:8px; font-weight:900; cursor:pointer; transition:var(--theme-transition);">
            ${actionText}
          </button>
          <div class="muted" style="margin-top:6px; font-size:0.78rem; color:var(--text-muted); ${disabled ? '' : 'display:none'}">${disabled ? (reason || 'Unavailable') : ''}</div>
        </td>
      `;

      const btn = tr.querySelector('.la-start-btn');

      if (!btn) return;

      setActionButtonState(btn, { disabled, text: actionText, reason });

      btn.addEventListener('click', () => {
        if (disabled) return;

        if (!quizUrl) {
          alert('Unable to determine quiz URL for this assignment topic.');
          return;
        }

        recordLearnerAttemptStart(asg.id);

        // Launch quiz and mark assignment mode via query param.
        // quizAssignmentHelper.js will record completion on showResults.
        window.location.href = `${quizUrl}?assignment=${encodeURIComponent(asg.id)}`;
      });

      tableBody.appendChild(tr);
    });

    if (availableCountEl) availableCountEl.textContent = String(available);
    if (completedCountEl) completedCountEl.textContent = String(completed);
    if (lockedCountEl) lockedCountEl.textContent = String(locked);

    if (emptyState) emptyState.style.display = assignments.length ? 'none' : '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Need quizProgress loaded for topic -> quiz mapping.
    // Page includes quizProgress.js first.
    render();

    // Re-render on focus (e.g., after completing a quiz and returning via back button)
    window.addEventListener('focus', () => render());
  });
})();

