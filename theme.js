/**
 * theme.js — LearnSphere Theme Manager
 *
 * Provides a persistent dark/light mode toggle using:
 * 1. localStorage for user preference persistence
 * 2. prefers-color-scheme media query as the system default fallback
 *
 * Usage:
 *   1. Add <script src="../theme.js"></script> in <head> (before <body>
 *      renders) to avoid flash of wrong theme on load.
 *   2. Add a button with id="themeToggleBtn" anywhere in the page.
 *
 * The script applies data-theme="dark" or data-theme="light" on <html>.
 * CSS variables defined under [data-theme="light"] override the defaults.
 */

(function () {
    const STORAGE_KEY = "learnsphere_theme";

    // ── Inject FontAwesome CDN if not already present ───────────────────────
    function injectFontAwesome() {
        if (!document.querySelector('link[href*="font-awesome"]') && 
            !document.querySelector('link[href*="fontawesome"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css";
            link.crossOrigin = "anonymous";
            link.referrerPolicy = "no-referrer";
            document.head.appendChild(link);
        }
    }

    // ── Determine initial theme ──────────────────────────────────────────────
    function getPreferredTheme() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "dark" || stored === "light") return stored;

        // Fall back to system preference
        return window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
    }

    // ── Apply theme to <html> element ────────────────────────────────────────
    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem(STORAGE_KEY, theme);
        updateToggleButton(theme);
    }

    // ── Update toggle button label and aria-label ────────────────────────────
    function updateToggleButton(theme) {
        const btn = document.getElementById("themeToggleBtn");
        if (!btn) return;

        if (theme === "dark") {
            btn.innerHTML = "<i class='fa-solid fa-sun'></i>";
            btn.setAttribute("aria-label", "Switch to light mode");
            btn.setAttribute("aria-pressed", "false");
        } else {
            btn.innerHTML = "<i class='fa-solid fa-moon'></i>";
            btn.setAttribute("aria-label", "Switch to dark mode");
            btn.setAttribute("aria-pressed", "true");
        }
    }

    // ── Wire up toggle button once DOM is ready ──────────────────────────────
    function initToggle() {
        const btn = document.getElementById("themeToggleBtn");
        if (!btn) return;

        const current = document.documentElement.getAttribute("data-theme") || "dark";
        updateToggleButton(current);

        btn.addEventListener("click", () => {
            const next = document.documentElement.getAttribute("data-theme") === "dark"
                ? "light"
                : "dark";
            applyTheme(next);
        });
    }

    // Apply theme immediately (before paint) to prevent flash
    applyTheme(getPreferredTheme());
    
    // Ensure FontAwesome is loaded for icons
    injectFontAwesome();

    // Wire up toggle button after DOM is parsed
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initToggle);
    } else {
        initToggle();
    }

    // Listen for OS-level theme changes
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) {
            applyTheme(e.matches ? "light" : "dark");
        }
    });
})();
