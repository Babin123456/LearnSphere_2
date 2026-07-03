// storage.js – Simple wrapper around localStorage with optional (stub) encryption

(function () {
  const PREFIX = 'learnsphere_';

  function encrypt(value) {
    // Placeholder: Base64 encode (replace with real crypto if needed)
    try { return btoa(value); } catch (e) { return value; }
  }
  function decrypt(value) {
    try { return atob(value); } catch (e) { return value; }
  }

  const storage = {
    setItem(key, data, options = { encrypt: false }) {
      const fullKey = PREFIX + key;
      let payload = JSON.stringify(data);
      if (options.encrypt) payload = encrypt(payload);
      try { localStorage.setItem(fullKey, payload); } catch (e) { console.warn('storage.setItem failed', e); }
    },
    getItem(key, options = { decrypt: false }) {
      const fullKey = PREFIX + key;
      const raw = localStorage.getItem(fullKey);
      if (raw == null) return null;
      let payload = raw;
      if (options.decrypt) payload = decrypt(raw);
      try { return JSON.parse(payload); } catch (e) { return payload; }
    },
    removeItem(key) {
      const fullKey = PREFIX + key;
      localStorage.removeItem(fullKey);
    },
    clearAll() {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    }
  };

  // expose globally
  window.storage = storage;
})();
