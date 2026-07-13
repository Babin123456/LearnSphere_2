/*
 * notifications.js — Notification Center v2
 *
 * Responsibilities:
 * - Maintain an in-app notification feed in localStorage
 * - Category tagging: grades | reminders | offline_sync | teacher | streak | quiz_ready | weekly_report | general
 * - Floating bell panel with category filter tabs
 * - Static renderNotificationCenter(containerId) for inline embedding (my_progress.html)
 * - Digest mode: daily/weekly opt-in stored in localStorage
 * - Trigger milestone events (streak, weekly report, quiz/review readiness)
 */

(function () {
  const STORAGE_KEY      = "learnsphere_notifications_v1";
  const DIGEST_KEY       = "learnsphere_notif_digest_v1";
  const WEEKLY_REPORT_KEY       = "learnsphere_weekly_report_notified_v1"; // YYYY-Www
  const LAST_QUIZ_READY_CHECK_KEY = "learnsphere_quiz_ready_check_v1";     // YYYY-MM-DD

  // ------------------------------------------------------------------
  // Category registry
  // ------------------------------------------------------------------
  const CATEGORIES = {
    GRADES:       "grades",
    REMINDERS:    "reminders",
    OFFLINE_SYNC: "offline_sync",
    TEACHER:      "teacher",
    STREAK:       "streak",
    QUIZ_READY:   "quiz_ready",
    WEEKLY:       "weekly_report",
    GENERAL:      "general"
  };

  const CATEGORY_META = {
    [CATEGORIES.GRADES]:       { label: "Grades",       icon: "📊", color: "#a855f7" },
    [CATEGORIES.REMINDERS]:    { label: "Reminders",    icon: "⏰", color: "#f59e0b" },
    [CATEGORIES.OFFLINE_SYNC]: { label: "Sync",         icon: "🔄", color: "#3b82f6" },
    [CATEGORIES.TEACHER]:      { label: "Teacher",      icon: "👩‍🏫", color: "#ec4899" },
    [CATEGORIES.STREAK]:       { label: "Streak",       icon: "🔥", color: "#f97316" },
    [CATEGORIES.QUIZ_READY]:   { label: "Quiz",         icon: "📚", color: "#66fcf1" },
    [CATEGORIES.WEEKLY]:       { label: "Weekly",       icon: "📅", color: "#10b981" },
    [CATEGORIES.GENERAL]:      { label: "General",      icon: "🔔", color: "rgba(255,255,255,0.7)" }
  };

  // Map legacy `type` strings → category (backward compat)
  const TYPE_TO_CATEGORY = {
    streak:       CATEGORIES.STREAK,
    weekly_report: CATEGORIES.WEEKLY,
    quiz_ready:   CATEGORIES.QUIZ_READY,
    sync_status:  CATEGORIES.OFFLINE_SYNC,
    teacher:      CATEGORIES.TEACHER,
    grades:       CATEGORIES.GRADES,
    reminder:     CATEGORIES.REMINDERS
  };

  // ------------------------------------------------------------------
  // i18n helper
  // ------------------------------------------------------------------
  function _t(key, params) {
    try {
      return window.i18n && typeof window.i18n.t === "function" ? window.i18n.t(key, params) : key;
    } catch {
      return key;
    }
  }

  // ------------------------------------------------------------------
  // Storage
  // ------------------------------------------------------------------
  let storageEnabled = false;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__test_storage_active__", "1");
      localStorage.removeItem("__test_storage_active__");
      storageEnabled = true;
    }
  } catch {}

  let inMemoryStore = null;

  function _backfillCategories(notifications) {
    return notifications.map(n => {
      if (!n.category) {
        n.category = TYPE_TO_CATEGORY[n.type] || CATEGORIES.GENERAL;
      }
      return n;
    });
  }

  function loadStore() {
    try {
      if (storageEnabled) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { notifications: [], lastEventAt: null };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") throw new Error("bad store");
        if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
        parsed.notifications = _backfillCategories(parsed.notifications);
        return parsed;
      }
    } catch {
      return { notifications: [], lastEventAt: null };
    }
    if (!inMemoryStore) inMemoryStore = { notifications: [], lastEventAt: null };
    // Back-fill also applies in the in-memory path (used by tests)
    inMemoryStore.notifications = _backfillCategories(inMemoryStore.notifications);
    return inMemoryStore;
  }

  function saveStore(store) {
    try {
      if (storageEnabled) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.warn("LearnSphere: could not save notifications", e);
    }
    inMemoryStore = store;
  }

  // ------------------------------------------------------------------
  // Digest settings
  // ------------------------------------------------------------------
  function getDigestSetting() {
    try {
      if (storageEnabled) {
        const raw = localStorage.getItem(DIGEST_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") return parsed;
        }
      }
    } catch {}
    return { enabled: false, frequency: "daily", categories: Object.values(CATEGORIES) };
  }

  function setDigestSetting(opts = {}) {
    const current = getDigestSetting();
    const next = { ...current, ...opts };
    try {
      if (storageEnabled) localStorage.setItem(DIGEST_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("LearnSphere: could not save digest settings", e);
    }
    return next;
  }

  function buildDigest(frequency = "daily") {
    const store = loadStore();
    const now = new Date();
    const cutoff = frequency === "weekly"
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const relevant = (store.notifications || []).filter(n => {
      try { return new Date(n.createdAt) >= cutoff; } catch { return false; }
    });

    const grouped = {};
    for (const cat of Object.values(CATEGORIES)) {
      const items = relevant.filter(n => (n.category || CATEGORIES.GENERAL) === cat);
      if (items.length) grouped[cat] = items;
    }

    const unreadCount = relevant.filter(n => !n.readAt).length;
    return { grouped, totalCount: relevant.length, unreadCount, frequency, since: cutoff.toISOString() };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function nowISO() { return new Date().toISOString(); }

  function uuid() {
    return "n_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  function getUnreadCount(store) {
    return (store.notifications || []).filter(n => !n.readAt).length;
  }

  function getWeekToken(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  function getTodayToken() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function relativeTime(isoStr) {
    try {
      const diff = Date.now() - new Date(isoStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch { return ""; }
  }

  // ------------------------------------------------------------------
  // Core notification API
  // ------------------------------------------------------------------
  function pushNotification({ id = null, type, category = null, title, message, ctaUrl = null, dedupeKey = null }) {
    const store = loadStore();
    const notifId = id || uuid();

    // Resolve category
    const resolvedCategory = category
      || TYPE_TO_CATEGORY[type]
      || CATEGORIES.GENERAL;

    if (id && store.notifications.some(n => n.id === id)) {
      return { inserted: false, reason: "duplicate_id" };
    }

    if (dedupeKey) {
      const existing = store.notifications.find(n => n.dedupeKey === dedupeKey);
      if (existing) {
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs < 24 * 60 * 60 * 1000) {
          return { inserted: false, reason: "duplicate_dedupe_key" };
        }
      }
    }

    // Prevents spam loops: deduplicate similar content pushed within 60s
    const recentDuplicate = store.notifications.find(n =>
      n.title === title &&
      n.message === message &&
      (Date.now() - new Date(n.createdAt).getTime() < 60 * 1000)
    );
    if (recentDuplicate) {
      return { inserted: false, reason: "duplicate_content_recent" };
    }

    const n = {
      id: notifId,
      type,
      category: resolvedCategory,
      title,
      message,
      ctaUrl,
      createdAt: nowISO(),
      readAt: null,
      deliveredAt: null,
      deliveryState: "pending",
      dedupeKey: dedupeKey || null,
    };

    store.notifications.unshift(n);
    store.lastEventAt = nowISO();
    saveStore(store);

    return { inserted: true, notification: n };
  }

  function markAllRead() {
    const store = loadStore();
    const t = nowISO();
    store.notifications = (store.notifications || []).map(n => {
      if (!n.readAt) n.readAt = t;
      return n;
    });
    saveStore(store);
    return store;
  }

  function markReadById(id) {
    const store = loadStore();
    const t = nowISO();
    store.notifications = (store.notifications || []).map(n => {
      if (n.id === id && !n.readAt) n.readAt = t;
      return n;
    });
    saveStore(store);
    return store;
  }

  function deleteById(id) {
    const store = loadStore();
    store.notifications = (store.notifications || []).filter(n => n.id !== id);
    saveStore(store);
    return store;
  }

  function clearAll() {
    const store = loadStore();
    store.notifications = [];
    store.lastEventAt = nowISO();
    saveStore(store);
    return store;
  }

  function getByCategory(category) {
    const store = loadStore();
    const all = store.notifications || [];
    if (!category || category === "all") return all;
    return all.filter(n => (n.category || CATEGORIES.GENERAL) === category);
  }

  function getUnread() {
    const store = loadStore();
    return (store.notifications || []).filter(n => !n.readAt);
  }

  function markAllDelivered() {
    const store = loadStore();
    let updated = false;
    store.notifications.forEach(n => {
      if (n.deliveryState === "pending") {
        n.deliveryState = "delivered";
        n.deliveredAt = nowISO();
        updated = true;
      }
    });
    if (updated) saveStore(store);
  }

  // ------------------------------------------------------------------
  // Floating bell panel
  // ------------------------------------------------------------------
  let _panelActiveCategory = "all";

  function _buildCategoryTabs(panelEl) {
    // Remove old tabs if any
    const old = panelEl.querySelector(".notif-category-tabs");
    if (old) old.remove();

    const tabs = document.createElement("div");
    tabs.className = "notif-category-tabs";
    tabs.style.cssText = "display:flex; gap:6px; flex-wrap:wrap; padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.08); overflow-x:auto;";

    const allCategories = [
      { key: "all", label: "All", icon: "🔔" },
      ...Object.values(CATEGORIES).map(cat => ({
        key: cat,
        label: CATEGORY_META[cat]?.label || cat,
        icon: CATEGORY_META[cat]?.icon || ""
      }))
    ];

    const store = loadStore();
    allCategories.forEach(({ key, label, icon }) => {
      const count = key === "all"
        ? (store.notifications || []).length
        : (store.notifications || []).filter(n => (n.category || CATEGORIES.GENERAL) === key).length;
      if (count === 0 && key !== "all") return;

      const tab = document.createElement("button");
      tab.type = "button";
      tab.dataset.catKey = key;
      const isActive = _panelActiveCategory === key;
      tab.style.cssText = `
        background: ${isActive ? "rgba(102,252,241,0.18)" : "rgba(255,255,255,0.05)"};
        border: 1px solid ${isActive ? "rgba(102,252,241,0.45)" : "rgba(255,255,255,0.1)"};
        color: ${isActive ? "#66fcf1" : "rgba(255,255,255,0.75)"};
        border-radius: 999px; padding: 4px 10px; cursor:pointer;
        font-size:11px; font-weight:700; white-space:nowrap;
        transition: all 0.15s ease;
      `;
      tab.textContent = `${icon} ${label}${count > 0 ? ` (${count})` : ""}`;
      tab.addEventListener("click", () => {
        _panelActiveCategory = key;
        _buildCategoryTabs(panelEl);
        renderList(getByCategory(key));
      });
      tabs.appendChild(tab);
    });

    // Insert after header (index 0 = header)
    const header = panelEl.querySelector(":scope > div:first-child");
    if (header && header.nextSibling) {
      panelEl.insertBefore(tabs, header.nextSibling);
    } else {
      panelEl.appendChild(tabs);
    }
  }

  function ensurePanel() {
    const root = document;
    let panel = root.getElementById("notifications-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "notifications-panel";
      Object.assign(panel.style, {
        display: "none", position: "fixed", right: "16px", top: "70px",
        width: "min(380px, calc(100vw - 32px))", maxHeight: "75vh",
        overflow: "auto", zIndex: "10000", background: "#0f1115",
        border: "1px solid rgba(255,255,255,0.10)", borderRadius: "14px",
        boxShadow: "0 18px 60px rgba(0,0,0,0.55)"
      });

      // Header
      const header = document.createElement("div");
      Object.assign(header.style, {
        padding: "12px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
        position: "sticky", top: "0", background: "#0f1115", zIndex: "1"
      });

      const title = document.createElement("div");
      title.style.fontWeight = "800";
      title.textContent = `🔔 ${_t("notifications.panelTitle")}`;

      const actions = document.createElement("div");
      Object.assign(actions.style, { display: "flex", gap: "8px", alignItems: "center" });

      const mkBtn = (txt, id) => {
        const b = document.createElement("button");
        b.id = id;
        b.type = "button";
        Object.assign(b.style, {
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.9)", borderRadius: "10px", padding: "6px 10px",
          cursor: "pointer", fontWeight: "700", fontSize: "11px"
        });
        b.textContent = txt;
        return b;
      };

      const btnAll    = mkBtn(_t("notifications.markAllRead"), "notifications-mark-all");
      const btnClear  = mkBtn("🗑 Clear all", "notifications-clear-all");
      const btnClose  = mkBtn("✕", "notifications-close");
      btnClose.setAttribute("aria-label", _t("notifications.close"));

      actions.append(btnAll, btnClear, btnClose);
      header.append(title, actions);

      const list = document.createElement("div");
      list.id = "notifications-list";
      Object.assign(list.style, { padding: "10px", display: "flex", flexDirection: "column", gap: "10px" });

      panel.append(header, list);
      document.body.appendChild(panel);

      btnAll.addEventListener("click", () => { markAllRead(); render(); });
      btnClear.addEventListener("click", () => {
        if (confirm("Clear all notifications?")) { clearAll(); render(); }
      });
      btnClose.addEventListener("click", hidePanel);
      document.addEventListener("keydown", e => { if (e.key === "Escape") hidePanel(); });
    }
    return panel;
  }

  function showPanel() {
    const panel = ensurePanel();
    panel.style.display = "block";
    _panelActiveCategory = "all";
    _buildCategoryTabs(panel);
    render();
  }

  function hidePanel() {
    const panel = document.getElementById("notifications-panel");
    if (panel) panel.style.display = "none";
  }

  // ------------------------------------------------------------------
  // Notification list renderer (shared by panel + center)
  // ------------------------------------------------------------------
  function _buildNotifItem(n, { onDelete, onMarkRead } = {}) {
    const isUnread = !n.readAt;
    const catMeta = CATEGORY_META[n.category] || CATEGORY_META[CATEGORIES.GENERAL];

    const item = document.createElement("div");
    Object.assign(item.style, {
      padding: "10px 12px", borderRadius: "12px",
      border: `1px solid ${isUnread ? "rgba(102,252,241,0.22)" : "rgba(255,255,255,0.07)"}`,
      background: isUnread ? "rgba(102,252,241,0.06)" : "rgba(255,255,255,0.02)",
      transition: "background 0.2s ease", cursor: "pointer"
    });

    // Category pill + time row
    const meta = document.createElement("div");
    Object.assign(meta.style, {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: "6px"
    });

    const pill = document.createElement("span");
    Object.assign(pill.style, {
      background: `${catMeta.color}22`, border: `1px solid ${catMeta.color}55`,
      color: catMeta.color, borderRadius: "999px", padding: "2px 8px",
      fontSize: "10px", fontWeight: "700", letterSpacing: "0.3px"
    });
    pill.textContent = `${catMeta.icon} ${catMeta.label}`;

    const timeEl = document.createElement("span");
    Object.assign(timeEl.style, { fontSize: "11px", color: "rgba(255,255,255,0.45)" });
    timeEl.textContent = relativeTime(n.createdAt);

    meta.append(pill, timeEl);

    // Title + message
    const titleEl = document.createElement("div");
    Object.assign(titleEl.style, {
      fontWeight: "800", fontSize: "13px",
      color: isUnread ? "#66fcf1" : "rgba(255,255,255,0.92)"
    });
    titleEl.textContent = n.title || _t("notifications.defaultTitle");

    const msgEl = document.createElement("div");
    Object.assign(msgEl.style, {
      marginTop: "3px", color: "rgba(255,255,255,0.72)",
      fontSize: "12.5px", lineHeight: "1.4"
    });
    msgEl.textContent = n.message || "";

    item.append(meta, titleEl, msgEl);

    // Actions row
    const actions = document.createElement("div");
    Object.assign(actions.style, {
      display: "flex", gap: "8px", marginTop: "10px",
      justifyContent: "flex-end", flexWrap: "wrap"
    });

    if (n.ctaUrl) {
      const a = document.createElement("a");
      a.textContent = _t("notifications.open");
      Object.assign(a.style, {
        textDecoration: "none", background: "rgba(102,252,241,0.10)",
        border: "1px solid rgba(102,252,241,0.35)", color: "#66fcf1",
        padding: "5px 10px", borderRadius: "8px", fontWeight: "800", fontSize: "11px"
      });
      a.addEventListener("click", () => { if (isUnread) markReadById(n.id); });
      try {
        const parsed = new URL(String(n.ctaUrl), window.location.origin);
        a.href = parsed.origin === window.location.origin
          ? parsed.pathname + parsed.search + parsed.hash
          : "#";
      } catch { a.href = "#"; }
      actions.appendChild(a);
    }

    if (isUnread) {
      const markBtn = document.createElement("button");
      markBtn.type = "button";
      markBtn.textContent = _t("notifications.markRead");
      Object.assign(markBtn.style, {
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.8)", borderRadius: "8px", padding: "5px 10px",
        cursor: "pointer", fontWeight: "700", fontSize: "11px"
      });
      markBtn.addEventListener("click", e => {
        e.stopPropagation();
        markReadById(n.id);
        if (onMarkRead) onMarkRead();
      });
      actions.appendChild(markBtn);
    }

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.setAttribute("aria-label", "Delete notification");
    delBtn.textContent = "✕";
    Object.assign(delBtn.style, {
      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
      color: "#ef4444", borderRadius: "8px", padding: "5px 8px",
      cursor: "pointer", fontWeight: "900", fontSize: "11px"
    });
    delBtn.addEventListener("click", e => {
      e.stopPropagation();
      deleteById(n.id);
      if (onDelete) onDelete();
    });
    actions.appendChild(delBtn);

    if (actions.children.length) item.appendChild(actions);

    item.addEventListener("click", e => {
      if (e.target.tagName === "BUTTON" || e.target.tagName === "A") return;
      if (isUnread) { markReadById(n.id); if (onMarkRead) onMarkRead(); }
    });

    return item;
  }

  function renderList(notifications) {
    const listEl = document.getElementById("notifications-list");
    if (!listEl) return;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    if (!notifications || notifications.length === 0) {
      const empty = document.createElement("div");
      Object.assign(empty.style, { color: "rgba(255,255,255,0.55)", fontSize: "13px", padding: "14px 0", textAlign: "center" });
      empty.textContent = _t("notifications.empty");
      listEl.appendChild(empty);
      return;
    }

    notifications.slice(0, 40).forEach(n => {
      listEl.appendChild(_buildNotifItem(n, {
        onDelete: () => { renderBadgeOnly(); render(); },
        onMarkRead: () => { renderBadgeOnly(); render(); }
      }));
    });
  }

  function renderBadgeOnly() {
    const badge = document.getElementById("notifications-badge-count");
    if (!badge) return;
    const store = loadStore();
    const unread = getUnreadCount(store);
    badge.textContent = String(unread);
    badge.style.display = unread > 0 ? "inline-flex" : "none";
  }

  function render() {
    const listEl = document.getElementById("notifications-list");
    if (!listEl) return;
    const notifications = getByCategory(_panelActiveCategory);
    renderList(notifications);
    renderBadgeOnly();
    markAllDelivered();
  }

  // ------------------------------------------------------------------
  // Notification Center (static, embeddable into a page card)
  // ------------------------------------------------------------------
  function renderNotificationCenter(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let activeCategory = "all";

    function refresh() {
      container.innerHTML = "";

      const store = loadStore();
      const all = store.notifications || [];
      const unreadCount = all.filter(n => !n.readAt).length;

      // ── Header row ──
      const headerRow = document.createElement("div");
      Object.assign(headerRow.style, {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "14px", flexWrap: "wrap", gap: "10px"
      });

      const leftSide = document.createElement("div");
      Object.assign(leftSide.style, { display: "flex", alignItems: "center", gap: "10px" });

      if (unreadCount > 0) {
        const badge = document.createElement("span");
        Object.assign(badge.style, {
          background: "#ff4500", color: "#fff", borderRadius: "999px",
          padding: "2px 8px", fontSize: "11px", fontWeight: "900"
        });
        badge.textContent = `${unreadCount} unread`;
        leftSide.appendChild(badge);
      } else {
        const clearBadge = document.createElement("span");
        Object.assign(clearBadge.style, {
          background: "rgba(102,252,241,0.12)", color: "#66fcf1", borderRadius: "999px",
          padding: "2px 10px", fontSize: "11px", fontWeight: "700"
        });
        clearBadge.textContent = "All caught up ✓";
        leftSide.appendChild(clearBadge);
      }

      const actionRow = document.createElement("div");
      Object.assign(actionRow.style, { display: "flex", gap: "8px" });

      const mkActionBtn = (txt, danger = false) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = txt;
        Object.assign(b.style, {
          background: danger ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${danger ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.10)"}`,
          color: danger ? "#ef4444" : "rgba(255,255,255,0.85)",
          borderRadius: "8px", padding: "6px 12px", cursor: "pointer",
          fontWeight: "700", fontSize: "12px", transition: "all 0.15s ease"
        });
        return b;
      };

      const markAllBtn = mkActionBtn("✓ Mark all read");
      markAllBtn.id = "nc-mark-all";
      markAllBtn.addEventListener("click", () => { markAllRead(); refresh(); renderBadgeOnly(); });

      const clearAllBtn = mkActionBtn("🗑 Clear all", true);
      clearAllBtn.id = "nc-clear-all";
      clearAllBtn.addEventListener("click", () => {
        if (confirm("Clear all notifications?")) { clearAll(); refresh(); renderBadgeOnly(); }
      });

      actionRow.append(markAllBtn, clearAllBtn);
      headerRow.append(leftSide, actionRow);
      container.appendChild(headerRow);

      // ── Category tabs ──
      const tabsWrap = document.createElement("div");
      Object.assign(tabsWrap.style, {
        display: "flex", gap: "6px", flexWrap: "wrap",
        borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px", marginBottom: "14px"
      });

      const allCategories = [
        { key: "all", label: "All", icon: "🔔" },
        ...Object.values(CATEGORIES).map(cat => ({
          key: cat, label: CATEGORY_META[cat]?.label || cat, icon: CATEGORY_META[cat]?.icon || ""
        }))
      ];

      allCategories.forEach(({ key, label, icon }) => {
        const count = key === "all"
          ? all.length
          : all.filter(n => (n.category || CATEGORIES.GENERAL) === key).length;
        if (count === 0 && key !== "all") return;

        const tab = document.createElement("button");
        tab.type = "button";
        const isActive = activeCategory === key;
        const catColor = key === "all" ? "#66fcf1" : (CATEGORY_META[key]?.color || "#66fcf1");
        Object.assign(tab.style, {
          background: isActive ? `${catColor}22` : "rgba(255,255,255,0.04)",
          border: `1px solid ${isActive ? `${catColor}55` : "rgba(255,255,255,0.1)"}`,
          color: isActive ? catColor : "rgba(255,255,255,0.65)",
          borderRadius: "999px", padding: "5px 12px", cursor: "pointer",
          fontSize: "12px", fontWeight: "700", transition: "all 0.15s ease"
        });
        tab.textContent = `${icon} ${label} (${count})`;
        tab.addEventListener("click", () => { activeCategory = key; refresh(); });
        tabsWrap.appendChild(tab);
      });

      container.appendChild(tabsWrap);

      // ── Notification list ──
      const listEl = document.createElement("div");
      Object.assign(listEl.style, { display: "flex", flexDirection: "column", gap: "10px" });

      const filtered = activeCategory === "all"
        ? all
        : all.filter(n => (n.category || CATEGORIES.GENERAL) === activeCategory);

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        Object.assign(empty.style, {
          padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: "13px"
        });
        empty.textContent = activeCategory === "all"
          ? "No notifications yet. Keep learning and you'll see updates here!"
          : `No ${CATEGORY_META[activeCategory]?.label || activeCategory} notifications.`;
        listEl.appendChild(empty);
      } else {
        filtered.slice(0, 50).forEach(n => {
          listEl.appendChild(_buildNotifItem(n, {
            onDelete: () => { refresh(); renderBadgeOnly(); },
            onMarkRead: () => { refresh(); renderBadgeOnly(); }
          }));
        });
      }

      container.appendChild(listEl);
    }

    refresh();
  }

  // ------------------------------------------------------------------
  // Bell button UI
  // ------------------------------------------------------------------
  function initUI() {
    if (document.getElementById("notifications-bell")) return;

    const headerStreak = document.getElementById("headerStreakBadge");
    let anchor = null;

    if (headerStreak) {
      anchor = headerStreak.parentElement;
    } else {
      anchor = document.querySelector("header.navbar .buttons") || document.querySelector("header.navbar");
    }

    if (!anchor) return;

    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { position: "relative", display: "inline-flex", alignItems: "center", gap: "8px" });

    const bellBtn = document.createElement("button");
    bellBtn.id = "notifications-bell";
    bellBtn.type = "button";
    bellBtn.setAttribute("aria-label", "Open notifications");
    Object.assign(bellBtn.style, {
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)",
      color: "rgba(255,255,255,0.92)", borderRadius: "12px", padding: "8px 12px",
      cursor: "pointer", fontWeight: "900", display: "flex", alignItems: "center", gap: "8px"
    });

    const icon = document.createElement("span");
    icon.textContent = "🔔";

    const hiddenLabel = document.createElement("span");
    Object.assign(hiddenLabel.style, { display: "none" });
    hiddenLabel.textContent = "Notifications";

    const badge = document.createElement("span");
    badge.id = "notifications-badge-count";
    Object.assign(badge.style, {
      display: "none", minWidth: "20px", height: "20px", padding: "0 6px",
      background: "#ff4500", color: "#fff", borderRadius: "999px",
      alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "900"
    });
    badge.textContent = "0";

    bellBtn.append(icon, hiddenLabel, badge);
    wrapper.appendChild(bellBtn);
    anchor.appendChild(wrapper);

    bellBtn.addEventListener("click", () => {
      const panel = document.getElementById("notifications-panel");
      const isOpen = panel && panel.style.display === "block";
      if (isOpen) hidePanel(); else showPanel();
    });

    document.addEventListener("click", e => {
      const panel = document.getElementById("notifications-panel");
      const bell = document.getElementById("notifications-bell");
      if (!panel || panel.style.display !== "block") return;
      if (bell && bell.contains(e.target)) return;
      if (panel.contains(e.target)) return;
      hidePanel();
    });

    renderBadgeOnly();
  }

  // ------------------------------------------------------------------
  // Milestone triggers
  // ------------------------------------------------------------------
  function triggerStreakMaintainedIfNeeded() {
    if (!window.studyProgress || typeof window.studyProgress.loadStreakState !== "function") return;
    const s = window.studyProgress.loadStreakState();
    const current = s.currentStreak || 0;
    if (current <= 0) return;

    const dedupeKey = `streak-maintained-${getTodayToken()}-${current}`;
    const activeToday = s.lastActiveDate === getTodayToken();
    if (!activeToday) return;

    pushNotification({
      type: "streak",
      category: CATEGORIES.STREAK,
      title: _t("notifications.streakMaintained.title"),
      message: _t("notifications.streakMaintained.message", { count: current }),
      ctaUrl: "my_progress.html",
      dedupeKey,
    });
  }

  function triggerWeeklyReportIfDue() {
    const weekToken = getWeekToken(new Date());
    const already = localStorage.getItem(WEEKLY_REPORT_KEY);
    if (already === weekToken) return;

    pushNotification({
      type: "weekly_report",
      category: CATEGORIES.WEEKLY,
      title: _t("notifications.weeklyReport.title"),
      message: _t("notifications.weeklyReport.message"),
      ctaUrl: "my_progress.html",
      dedupeKey: `weekly-${weekToken}`,
    });

    localStorage.setItem(WEEKLY_REPORT_KEY, weekToken);
  }

  function triggerNewQuizReadyIfDue() {
    const today = getTodayToken();
    const last = localStorage.getItem(LAST_QUIZ_READY_CHECK_KEY);
    if (last === today) return;

    const shouldHaveRecommendations =
      window.quizProgress && typeof window.quizProgress.getRecommendedTopics === "function";

    let hasRec = false;
    let recCount = 0;
    if (shouldHaveRecommendations) {
      try {
        const recs = window.quizProgress.getRecommendedTopics({ limit: 3 }) || [];
        recCount = recs.length;
        hasRec = recCount > 0;
      } catch { hasRec = false; }
    }

    if (hasRec) {
      pushNotification({
        type: "quiz_ready",
        category: CATEGORIES.QUIZ_READY,
        title: _t("notifications.quizReady.title"),
        message: _t(recCount === 1 ? "notifications.quizReady.messageSingle" : "notifications.quizReady.messagePlural", { count: recCount }),
        ctaUrl: "home.html",
        dedupeKey: `quiz-ready-${today}-${recCount}`,
      });
    }

    localStorage.setItem(LAST_QUIZ_READY_CHECK_KEY, today);
  }

  function checkAndTriggerAll() {
    initUI();

    try { if (window.quizProgress) triggerNewQuizReadyIfDue(); } catch {}
    try { if (window.studyProgress) triggerStreakMaintainedIfNeeded(); } catch {}
    try { triggerWeeklyReportIfDue(); } catch {}

    render();
  }

  // ------------------------------------------------------------------
  // Event API (called by progress flows)
  // ------------------------------------------------------------------
  function notifyFromEvent({ type, category = null, title, message, ctaUrl = null, dedupeKey = null }) {
    initUI();
    pushNotification({ type, category, title, message, ctaUrl, dedupeKey });
    render();
  }

  function notifyFromEventI18n({ type, category = null, titleKey, messageKey, messageParams, ctaUrl = null, dedupeKey = null }) {
    notifyFromEvent({
      type, category,
      title: _t(titleKey),
      message: _t(messageKey, messageParams),
      ctaUrl, dedupeKey,
    });
  }

  // ------------------------------------------------------------------
  // Sync lifecycle events
  // ------------------------------------------------------------------
  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", () => { checkAndTriggerAll(); });

    window.addEventListener("learnsphere:sync-start", e => {
      const count = e.detail?.itemCount || 0;
      if (count <= 0) return;
      pushNotification({
        type: "sync_status", category: CATEGORIES.OFFLINE_SYNC,
        title: "🔄 Syncing progress…",
        message: `Uploading ${count} queued update${count !== 1 ? "s" : ""} to the server.`,
        dedupeKey: `sync-start-${Math.floor(Date.now() / 60000)}`,
      });
      initUI(); render();
    });

    window.addEventListener("learnsphere:sync-complete", e => {
      const synced = e.detail?.syncedCount || 0;
      const failed = e.detail?.failedCount || 0;
      if (synced <= 0 && failed <= 0) return;
      if (failed > 0) {
        pushNotification({
          type: "sync_status", category: CATEGORIES.OFFLINE_SYNC,
          title: "⚠️ Sync partially complete",
          message: `${synced} update${synced !== 1 ? "s" : ""} synced, ${failed} failed. Failed items will be retried.`,
          dedupeKey: `sync-partial-${Math.floor(Date.now() / 60000)}`,
        });
      } else {
        pushNotification({
          type: "sync_status", category: CATEGORIES.OFFLINE_SYNC,
          title: "✅ Progress synced!",
          message: `${synced} queued update${synced !== 1 ? "s" : ""} successfully uploaded.`,
          dedupeKey: `sync-complete-${Math.floor(Date.now() / 60000)}`,
        });
      }
      initUI(); render();
    });

    window.addEventListener("learnsphere:sync-failed", e => {
      const failed = e.detail?.failedCount || 0;
      if (failed <= 0) return;
      pushNotification({
        type: "sync_status", category: CATEGORIES.OFFLINE_SYNC,
        title: "❌ Sync failed",
        message: `${failed} update${failed !== 1 ? "s" : ""} could not be synced. Will retry when back online.`,
        dedupeKey: `sync-failed-${Math.floor(Date.now() / 60000)}`,
      });
      initUI(); render();
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", event => {
        if (event.data?.action === "sync-status" && event.data.status === "syncing") {
          const pending = window.offlineSync?.getQueueLength?.() || 0;
          if (pending > 0) {
            pushNotification({
              type: "sync_status", category: CATEGORIES.OFFLINE_SYNC,
              title: "🔄 Background sync in progress",
              message: `Syncing ${pending} queued update${pending !== 1 ? "s" : ""} in the background.`,
              dedupeKey: `bg-sync-${Math.floor(Date.now() / 60000)}`,
            });
            initUI(); render();
          }
        }
        if (event.data?.action === "request-queue-status") {
          const status = window.offlineSync?.getQueueStatus?.();
          if (status && status.pending > 0) window.offlineSync?.flushQueue?.();
        }
      });
    }

    window.notifications = {
      CATEGORIES,
      pushNotification,
      markAllRead,
      markReadById,
      deleteById,
      clearAll,
      getByCategory,
      getUnread,
      getDigestSetting,
      setDigestSetting,
      buildDigest,
      render,
      initUI,
      checkAndTriggerAll,
      notifyFromEvent,
      notifyFromEventI18n,
      renderNotificationCenter,
    };
  }

  // CJS export for unit tests
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      CATEGORIES,
      pushNotification,
      markAllRead,
      markReadById,
      deleteById,
      clearAll,
      getByCategory,
      getUnread,
      getDigestSetting,
      setDigestSetting,
      buildDigest,
      markAllDelivered,
      loadStore,
      saveStore,
    };
  }
})();
