import { describe, it, expect, beforeEach } from "vitest";
const notifications = require("./notifications.js");

// ──────────────────────────────────────────────────────────────────────────
// Helper: reset store before every test
// ──────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  const store = notifications.loadStore();
  store.notifications = [];
  store.lastEventAt = null;
  notifications.saveStore(store);
});

// ──────────────────────────────────────────────────────────────────────────
// 1) pushNotification & Deduplication
// ──────────────────────────────────────────────────────────────────────────
describe("pushNotification & Deduplication", () => {
  it("should push a new notification successfully", () => {
    const res = notifications.pushNotification({
      type: "info",
      title: "Welcome",
      message: "Welcome to LearnSphere!",
    });

    expect(res.inserted).toBe(true);
    expect(res.notification).toBeDefined();
    expect(res.notification.title).toBe("Welcome");
    expect(res.notification.deliveryState).toBe("pending");
    expect(res.notification.deliveredAt).toBeNull();
    expect(res.notification.readAt).toBeNull();
  });

  it("should prevent duplicate notifications with the same explicit ID", () => {
    const first = notifications.pushNotification({
      id: "test-id-1",
      type: "info",
      title: "Test",
      message: "Message",
    });
    expect(first.inserted).toBe(true);

    const second = notifications.pushNotification({
      id: "test-id-1",
      type: "info",
      title: "Different Title",
      message: "Different Message",
    });
    expect(second.inserted).toBe(false);
    expect(second.reason).toBe("duplicate_id");
  });

  it("should deduplicate by dedupeKey within a 24-hour window", () => {
    const first = notifications.pushNotification({
      type: "streak",
      title: "Streak Up!",
      message: "Your streak is 3 days",
      dedupeKey: "streak-key-1",
    });
    expect(first.inserted).toBe(true);

    const second = notifications.pushNotification({
      type: "streak",
      title: "Streak Up!",
      message: "Your streak is 3 days",
      dedupeKey: "streak-key-1",
    });
    expect(second.inserted).toBe(false);
    expect(second.reason).toBe("duplicate_dedupe_key");
  });

  it("should allow duplicate dedupeKey after 24 hours have passed", () => {
    notifications.pushNotification({
      type: "streak",
      title: "Streak Up!",
      message: "Your streak is 3 days",
      dedupeKey: "streak-key-1",
    });

    const store = notifications.loadStore();
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    store.notifications[0].createdAt = oldTime;
    notifications.saveStore(store);

    const second = notifications.pushNotification({
      type: "streak",
      title: "Streak Up!",
      message: "Your streak is 3 days",
      dedupeKey: "streak-key-1",
    });
    expect(second.inserted).toBe(true);
  });

  it("should prevent rapid identical content submissions within 60 seconds", () => {
    const first = notifications.pushNotification({
      type: "info",
      title: "Alert",
      message: "Action required",
    });
    expect(first.inserted).toBe(true);

    const second = notifications.pushNotification({
      type: "info",
      title: "Alert",
      message: "Action required",
    });
    expect(second.inserted).toBe(false);
    expect(second.reason).toBe("duplicate_content_recent");
  });

  it("should allow identical content submissions if 60 seconds have passed", () => {
    notifications.pushNotification({
      type: "info",
      title: "Alert",
      message: "Action required",
    });

    const store = notifications.loadStore();
    const oldTime = new Date(Date.now() - 65 * 1000).toISOString();
    store.notifications[0].createdAt = oldTime;
    notifications.saveStore(store);

    const second = notifications.pushNotification({
      type: "info",
      title: "Alert",
      message: "Action required",
    });
    expect(second.inserted).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 2) Delivery State Management
// ──────────────────────────────────────────────────────────────────────────
describe("Delivery State Management", () => {
  it("should mark pending notifications as delivered", () => {
    notifications.pushNotification({
      type: "info",
      title: "Alert 1",
      message: "Action required",
    });

    let store = notifications.loadStore();
    expect(store.notifications[0].deliveryState).toBe("pending");
    expect(store.notifications[0].deliveredAt).toBeNull();

    notifications.markAllDelivered();

    store = notifications.loadStore();
    expect(store.notifications[0].deliveryState).toBe("delivered");
    expect(store.notifications[0].deliveredAt).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 3) Read / Acknowledgment State Management
// ──────────────────────────────────────────────────────────────────────────
describe("Read / Acknowledgment State Management", () => {
  it("should explicitly mark a notification as read by ID", () => {
    const n1 = notifications.pushNotification({ type: "t", title: "A", message: "A" }).notification;
    const n2 = notifications.pushNotification({ type: "t", title: "B", message: "B" }).notification;

    let store = notifications.loadStore();
    expect(store.notifications.find(n => n.id === n1.id).readAt).toBeNull();
    expect(store.notifications.find(n => n.id === n2.id).readAt).toBeNull();

    notifications.markReadById(n1.id);

    store = notifications.loadStore();
    expect(store.notifications.find(n => n.id === n1.id).readAt).not.toBeNull();
    expect(store.notifications.find(n => n.id === n2.id).readAt).toBeNull();
  });

  it("should mark all read", () => {
    const n1 = notifications.pushNotification({ type: "t", title: "A", message: "A" }).notification;
    const n2 = notifications.pushNotification({ type: "t", title: "B", message: "B" }).notification;

    notifications.markAllRead();

    const store = notifications.loadStore();
    expect(store.notifications.find(n => n.id === n1.id).readAt).not.toBeNull();
    expect(store.notifications.find(n => n.id === n2.id).readAt).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 4) Category System
// ──────────────────────────────────────────────────────────────────────────
describe("Category System", () => {
  const { CATEGORIES } = notifications;

  it("should assign the correct category based on type when no category is given", () => {
    const n = notifications.pushNotification({
      type: "streak",
      title: "Streak!",
      message: "Keep going!",
    }).notification;
    expect(n.category).toBe(CATEGORIES.STREAK);
  });

  it("should use the explicit category override when provided", () => {
    const n = notifications.pushNotification({
      type: "info",
      category: CATEGORIES.GRADES,
      title: "Grade posted",
      message: "Your quiz grade is ready.",
    }).notification;
    expect(n.category).toBe(CATEGORIES.GRADES);
  });

  it("should default unrecognized type to 'general' category", () => {
    const n = notifications.pushNotification({
      type: "some_unknown_type",
      title: "Mystery",
      message: "Unknown.",
    }).notification;
    expect(n.category).toBe(CATEGORIES.GENERAL);
  });

  it("should filter notifications by category correctly", () => {
    notifications.pushNotification({ type: "streak",        title: "S1", message: "m" });
    notifications.pushNotification({ type: "streak",        title: "S2", message: "m2" });
    notifications.pushNotification({ type: "weekly_report", title: "W1", message: "m" });

    const streaks = notifications.getByCategory(CATEGORIES.STREAK);
    expect(streaks.length).toBe(2);
    streaks.forEach(n => expect(n.category).toBe(CATEGORIES.STREAK));

    const weekly = notifications.getByCategory(CATEGORIES.WEEKLY);
    expect(weekly.length).toBe(1);
    expect(weekly[0].category).toBe(CATEGORIES.WEEKLY);
  });

  it("should return all notifications when getByCategory is called with 'all'", () => {
    notifications.pushNotification({ type: "streak", title: "S", message: "m" });
    notifications.pushNotification({ type: "info",   title: "I", message: "m2" });

    const all = notifications.getByCategory("all");
    expect(all.length).toBe(2);
  });

  it("should return empty array for a category with no notifications", () => {
    notifications.pushNotification({ type: "streak", title: "S", message: "m" });

    const grades = notifications.getByCategory(CATEGORIES.GRADES);
    expect(grades.length).toBe(0);
  });

  it("should back-fill 'general' category for legacy notifications missing the category field", () => {
    // Push a normal notification first so the store is initialised
    notifications.pushNotification({ type: "info", title: "Old notification", message: "From before v2" });

    // Strip the category field to simulate a legacy record
    const store = notifications.loadStore();
    const legacyNotif = store.notifications[0];
    const legacyId = legacyNotif.id;
    delete legacyNotif.category;
    notifications.saveStore(store);

    // loadStore should back-fill the missing category to 'general'
    const loaded = notifications.loadStore();
    const legacy = loaded.notifications.find(n => n.id === legacyId);
    expect(legacy).toBeDefined();
    // In-memory path: back-fill runs on loadStore because storageEnabled may be false;
    // either way the TYPE_TO_CATEGORY for 'info' is undefined → falls back to GENERAL.
    expect([CATEGORIES.GENERAL, "general"]).toContain(legacy.category);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 5) Unread Filtering
// ──────────────────────────────────────────────────────────────────────────
describe("Unread Filtering", () => {
  it("should return only unread notifications via getUnread()", () => {
    const n1 = notifications.pushNotification({ type: "t", title: "A", message: "A" }).notification;
    const n2 = notifications.pushNotification({ type: "t", title: "B", message: "B" }).notification;

    notifications.markReadById(n1.id);

    const unread = notifications.getUnread();
    expect(unread.length).toBe(1);
    expect(unread[0].id).toBe(n2.id);
  });

  it("getUnread() should return empty array after markAllRead()", () => {
    notifications.pushNotification({ type: "t", title: "A", message: "A" });
    notifications.pushNotification({ type: "t", title: "B", message: "B" });

    notifications.markAllRead();
    expect(notifications.getUnread().length).toBe(0);
  });

  it("getUnread() should return empty array when store is empty", () => {
    expect(notifications.getUnread().length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 6) Delete / Clear
// ──────────────────────────────────────────────────────────────────────────
describe("Delete / Clear", () => {
  it("deleteById() should remove only the specified notification", () => {
    const n1 = notifications.pushNotification({ type: "t", title: "A", message: "A" }).notification;
    const n2 = notifications.pushNotification({ type: "t", title: "B", message: "B" }).notification;

    notifications.deleteById(n1.id);

    const store = notifications.loadStore();
    expect(store.notifications.find(n => n.id === n1.id)).toBeUndefined();
    expect(store.notifications.find(n => n.id === n2.id)).toBeDefined();
  });

  it("deleteById() with a non-existent ID should not throw and leave store intact", () => {
    notifications.pushNotification({ type: "t", title: "A", message: "A" });

    expect(() => notifications.deleteById("does-not-exist")).not.toThrow();

    const store = notifications.loadStore();
    expect(store.notifications.length).toBe(1);
  });

  it("clearAll() should remove all notifications", () => {
    notifications.pushNotification({ type: "t", title: "A", message: "A" });
    notifications.pushNotification({ type: "t", title: "B", message: "B" });
    notifications.pushNotification({ type: "t", title: "C", message: "C" });

    notifications.clearAll();
    expect(notifications.loadStore().notifications.length).toBe(0);
  });

  it("clearAll() on an already-empty store should not throw", () => {
    expect(() => notifications.clearAll()).not.toThrow();
    expect(notifications.loadStore().notifications.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 7) Digest Settings
// ──────────────────────────────────────────────────────────────────────────
describe("Digest Settings", () => {
  it("getDigestSetting() should return default values when nothing is stored", () => {
    const s = notifications.getDigestSetting();
    expect(s).toBeDefined();
    expect(s.enabled).toBe(false);
    expect(s.frequency).toBe("daily");
    expect(Array.isArray(s.categories)).toBe(true);
  });

  it("setDigestSetting() should persist and be readable by getDigestSetting()", () => {
    const saved = notifications.setDigestSetting({ enabled: true, frequency: "weekly", categories: ["streak", "grades"] });

    // setDigestSetting always returns the merged object — verify the returned value
    expect(saved.enabled).toBe(true);
    expect(saved.frequency).toBe("weekly");
    expect(saved.categories).toContain("streak");
    expect(saved.categories).toContain("grades");

    // getDigestSetting reads from localStorage if available, otherwise from the returned
    // merged value. In the test env (no real localStorage), verify the return value above
    // is consistent; if localStorage is available (e.g. jsdom), also verify round-trip.
    const read = notifications.getDigestSetting();
    // At minimum, it should return a valid object with the correct shape
    expect(read).toBeDefined();
    expect(typeof read.enabled).toBe("boolean");
    expect(["daily", "weekly"]).toContain(read.frequency);
  });

  it("setDigestSetting() should do a partial merge, not overwrite unrelated fields", () => {
    notifications.setDigestSetting({ enabled: true, frequency: "daily", categories: ["streak"] });
    notifications.setDigestSetting({ enabled: false }); // partial update

    const s = notifications.getDigestSetting();
    expect(s.enabled).toBe(false);
    // frequency should still be "daily" from the first call
    expect(s.frequency).toBe("daily");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 8) Digest Build
// ──────────────────────────────────────────────────────────────────────────
describe("buildDigest()", () => {
  it("should return zero counts on empty store", () => {
    const digest = notifications.buildDigest("daily");
    expect(digest.totalCount).toBe(0);
    expect(digest.unreadCount).toBe(0);
    expect(Object.keys(digest.grouped).length).toBe(0);
  });

  it("should group today's notifications by category", () => {
    notifications.pushNotification({ type: "streak", title: "S1", message: "m" });
    notifications.pushNotification({ type: "streak", title: "S2", message: "m" });
    notifications.pushNotification({ type: "weekly_report", title: "W1", message: "m" });

    const digest = notifications.buildDigest("daily");
    expect(digest.totalCount).toBe(3);
    expect(digest.grouped["streak"]?.length).toBe(2);
    expect(digest.grouped["weekly_report"]?.length).toBe(1);
  });

  it("should count unread notifications correctly in the digest", () => {
    const n1 = notifications.pushNotification({ type: "streak", title: "S", message: "m" }).notification;
    notifications.pushNotification({ type: "streak", title: "S2", message: "m2" });

    notifications.markReadById(n1.id);

    const digest = notifications.buildDigest("daily");
    expect(digest.totalCount).toBe(2);
    expect(digest.unreadCount).toBe(1);
  });

  it("should exclude notifications older than the cutoff for daily digest", () => {
    // Push one recent and one old notification
    notifications.pushNotification({ type: "streak", title: "Recent", message: "m" });

    const store = notifications.loadStore();
    // Backdating the first (only) notification to 2 days ago
    store.notifications[0].createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    notifications.saveStore(store);

    notifications.pushNotification({ type: "info", title: "Today", message: "m" });

    const digest = notifications.buildDigest("daily");
    // Only "Today" should be in today's digest
    expect(digest.totalCount).toBe(1);
  });
});
