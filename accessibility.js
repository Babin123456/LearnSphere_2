// accessibility.js - Core utilities for quiz accessibility and keyboard navigation
// ------------------------------------------------------------
// This script provides functions to initialize ARIA roles, manage focus, and handle
// keyboard shortcuts for quiz pages. It attaches its API to the global `window` object.

(function () {
  // Initialize accessibility for a quiz.
  function initQuizAccessibility({ containerId = 'quiz-box', optionsContainerId = 'options', statusId = 'sr-status' } = {}) {
    const container = document.getElementById(containerId);
    const optionsContainer = document.getElementById(optionsContainerId);
    const srStatus = document.getElementById(statusId);

    // Ensure the options container has proper ARIA role (radiogroup) if not already set.
    if (optionsContainer && !optionsContainer.getAttribute('role')) {
      optionsContainer.setAttribute('role', 'radiogroup');
    }

    refreshOptionTabStops(optionsContainer);

    // Attach a keydown listener for navigation shortcuts.
    document.addEventListener('keydown', (e) => handleKeyNavigation(e, optionsContainer, srStatus));

    if (optionsContainer) {
      optionsContainer.addEventListener('click', () => refreshOptionTabStops(optionsContainer));
      optionsContainer.addEventListener('focusin', (event) => {
        if (event.target?.classList?.contains('option')) {
          setActiveOption(event.target, optionsContainer, false);
        }
      });
    }

    return { container, optionsContainer, srStatus };
  }

  // Keyboard navigation handler.
  function handleKeyNavigation(event, optionsContainer, srStatus) {
    const KEY = {
      LEFT: 'ArrowLeft',
      RIGHT: 'ArrowRight',
      UP: 'ArrowUp',
      DOWN: 'ArrowDown',
      HOME: 'Home',
      END: 'End',
      ENTER: 'Enter',
      SPACE: ' ',
      CTRL_ENTER: 'Enter',
    };

    const activeEl = document.activeElement;
    const isOption = activeEl && activeEl.classList && activeEl.classList.contains('option');

    if ((event.key === KEY.LEFT || event.key === KEY.UP) && isOption) {
      focusRelativeOption(activeEl, optionsContainer, -1);
      event.preventDefault();
      return;
    }
    if ((event.key === KEY.RIGHT || event.key === KEY.DOWN) && isOption) {
      focusRelativeOption(activeEl, optionsContainer, 1);
      event.preventDefault();
      return;
    }
    if (event.key === KEY.HOME && isOption) {
      focusOptionAt(optionsContainer, 0);
      event.preventDefault();
      return;
    }
    if (event.key === KEY.END && isOption) {
      focusOptionAt(optionsContainer, getOptions(optionsContainer).length - 1);
      event.preventDefault();
      return;
    }
    if ((event.key === KEY.ENTER || event.key === KEY.SPACE) && isOption) {
      activeEl.click();
      event.preventDefault();
      return;
    }
    // Ctrl+Enter to submit current answer (if submit button is visible).
    if (event.key === KEY.CTRL_ENTER && event.ctrlKey) {
      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn && !submitBtn.classList.contains('hidden')) {
        submitBtn.click();
        event.preventDefault();
      }
      return;
    }
  }

  function getOptions(optionsContainer) {
    const scope = optionsContainer || document;
    return Array.from(scope.querySelectorAll('.option'));
  }

  function refreshOptionTabStops(optionsContainer) {
    const options = getOptions(optionsContainer);
    const selected = options.find((option) => option.classList.contains('selected'));
    const active = selected || options[0];

    options.forEach((option) => {
      option.setAttribute('tabindex', option === active ? '0' : '-1');
      if (!option.getAttribute('role')) {
        option.setAttribute('role', 'radio');
      }
      if (!option.getAttribute('aria-checked')) {
        option.setAttribute('aria-checked', option.classList.contains('selected') ? 'true' : 'false');
      }
    });
  }

  function setActiveOption(option, optionsContainer, shouldFocus = true) {
    const options = getOptions(optionsContainer);
    options.forEach((item) => {
      item.setAttribute('tabindex', item === option ? '0' : '-1');
    });
    if (shouldFocus) option.focus();
    announceOptionChange(option, options.indexOf(option), options.length);
  }

  function focusRelativeOption(current, optionsContainer, delta) {
    const options = getOptions(optionsContainer);
    const idx = options.indexOf(current);
    if (idx === -1 || options.length === 0) return;

    const nextIndex = (idx + delta + options.length) % options.length;
    setActiveOption(options[nextIndex], optionsContainer);
  }

  function focusOptionAt(optionsContainer, index) {
    const options = getOptions(optionsContainer);
    if (!options.length || index < 0 || index >= options.length) return;
    setActiveOption(options[index], optionsContainer);
  }

  function announceOptionChange(optionEl, index, total) {
    const sr = document.getElementById('sr-status');
    if (sr) {
      const position = typeof index === 'number' && typeof total === 'number'
        ? `Option ${index + 1} of ${total}: `
        : 'Option ';
      sr.textContent = `${position}${optionEl.textContent.trim()}`;
    }
  }

  function announce(message) {
    const sr = document.getElementById('sr-status');
    if (sr) {
      sr.textContent = '';
      setTimeout(() => {
        sr.textContent = message;
      }, 0);
    }
  }

  // Detect reduced motion preference and add a class to the body.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('prefers-reduced-motion');
  }
  // Detect high‑contrast preference (CSS Level 4 media query) and add a class.
  if (window.matchMedia('(prefers-contrast: more)').matches) {
    document.body.classList.add('high-contrast');
  }

  // ------------------------------
  // User controls: Reduced motion + Larger text
  // ------------------------------
  const A11Y_STORAGE_KEY = 'learnsphere_a11y';

  function safeParse(json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      return {};
    }
  }

  function getStoredA11yPrefs() {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return {};
    const parsed = safeParse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  function setStoredA11yPrefs(next) {
    try {
      localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      // ignore
    }
  }

  function applyLargerText(sizeKey) {
    // sizeKey: 'sm' | 'lg' | 'xl'
    const html = document.documentElement;
    html.dataset.fontScale = sizeKey || 'lg';

    // Persist
    const stored = getStoredA11yPrefs();
    stored.fontScale = html.dataset.fontScale;
    setStoredA11yPrefs(stored);
  }

  function applyReducedMotion(enabled) {
    const html = document.documentElement;
    html.dataset.reducedMotion = enabled ? 'true' : 'false';

    const stored = getStoredA11yPrefs();
    stored.reducedMotion = !!enabled;
    setStoredA11yPrefs(stored);
  }

  function initA11yControls() {
    const reducedToggle = document.getElementById('reducedMotionToggle');
    const fontToggle = document.getElementById('fontSizeToggle');

    // If controls do not exist on this page, do nothing.
    if (!reducedToggle && !fontToggle) return;

    const stored = getStoredA11yPrefs();

    // Reduced motion: stored override, otherwise OS preference
    const osPrefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reducedEnabled = typeof stored.reducedMotion === 'boolean' ? stored.reducedMotion : osPrefersReduced;
    applyReducedMotion(reducedEnabled);

    // Larger text: stored override, otherwise default scale
    const fontScale = stored.fontScale || 'lg';
    applyLargerText(fontScale);

    // Update UI states
    if (reducedToggle) {
      reducedToggle.setAttribute('aria-pressed', String(reducedEnabled));
      reducedToggle.textContent = reducedEnabled ? 'Reduced motion: On' : 'Reduced motion: Off';
    }
    if (fontToggle) {
      const map = { sm: 'Small text', lg: 'Larger text', xl: 'Extra large text' };
      fontToggle.setAttribute('aria-pressed', 'true');
      fontToggle.textContent = map[fontScale] || 'Larger text';
    }

    // Events
    if (reducedToggle) {
      reducedToggle.addEventListener('click', () => {
        const current = document.documentElement.dataset.reducedMotion === 'true';
        const next = !current;
        applyReducedMotion(next);
        reducedToggle.setAttribute('aria-pressed', String(next));
        reducedToggle.textContent = next ? 'Reduced motion: On' : 'Reduced motion: Off';
      });
    }

    if (fontToggle) {
      // cycle: lg -> xl -> sm -> lg
      fontToggle.addEventListener('click', () => {
        const current = document.documentElement.dataset.fontScale || 'lg';
        const next = current === 'lg' ? 'xl' : current === 'xl' ? 'sm' : 'lg';
        applyLargerText(next);
        const map = { sm: 'Small text', lg: 'Larger text', xl: 'Extra large text' };
        fontToggle.textContent = map[next] || 'Larger text';
      });
    }
  }

  // Run immediately on load (works for deferred scripts too)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initA11yControls);
  } else {
    initA11yControls();
  }

  // Expose API globally.
  window.initQuizAccessibility = initQuizAccessibility;
  window.srAnnounce = announce;
})();

