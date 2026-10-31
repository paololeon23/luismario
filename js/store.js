/* Motor de persistencia. IndexedDB con respaldo en localStorage. */
(function (root) {
  var VERSION = 2;
  var DB_NAME = "impulsa-financiera";
  var DB_STORE = "kv";
  var PREFIX = "impulsa.v" + VERSION + ".";
  var KEY = "db";
  var memory = {};
  var dbp = null;

  function canLS() {
    try {
      return !!root.localStorage;
    } catch (err) {
      return false;
    }
  }
  function lsGet(key) {
    if (!canLS()) return memory[key] || null;
    try {
      var raw = root.localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : memory[key] || null;
    } catch (err) {
      return memory[key] || null;
    }
  }
  function lsSet(key, value) {
    memory[key] = value;
    if (!canLS()) return false;
    try {
      root.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (err) {
      try {
        root.localStorage.removeItem(PREFIX + key);
      } catch (e2) {}
      return false;
    }
  }
  function openDb() {
    if (dbp) return dbp;
    if (!root.indexedDB) {
      dbp = Promise.resolve(null);
      return dbp;
    }
    dbp = new Promise(function (resolve) {
      var timer = root.setTimeout(function () {
        resolve(null);
      }, 800);
      try {
        var req = root.indexedDB.open(DB_NAME, VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
        };
        req.onsuccess = function () {
          root.clearTimeout(timer);
          resolve(req.result);
        };
        req.onerror = function () {
          root.clearTimeout(timer);
          resolve(null);
        };
        req.onblocked = function () {
          root.clearTimeout(timer);
          resolve(null);
        };
      } catch (err) {
        root.clearTimeout(timer);
        resolve(null);
      }
    });
    return dbp;
  }
  function idbOp(fn) {
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          fn(db, resolve);
        } catch (err) {
          resolve(null);
        }
      });
    });
  }
  function get(key) {
    return idbOp(function (db, resolve) {
      var tx = db.transaction(DB_STORE, "readonly");
      var req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = function () {
        var val = req.result;
        if (val === undefined) resolve(lsGet(key));
        else resolve(val);
      };
      req.onerror = function () {
        resolve(lsGet(key));
      };
    }).then(function (val) {
      return val == null ? lsGet(key) : val;
    });
  }
  function set(key, value) {
    if (value == null) return Promise.resolve(false);
    memory[key] = value;
    lsSet(key, value);
    return idbOp(function (db, resolve) {
      var tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = function () {
        resolve(true);
      };
      tx.onerror = function () {
        resolve(false);
      };
    }).then(function () {
      return true;
    });
  }

  root.ImpulsaStore = {
    version: VERSION,
    get: get,
    set: set,
    loadDb: function () {
      return get(KEY);
    },
    saveDb: function (db) {
      return set(KEY, db);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
