/* Cliente de API. Usa Apps Script si hay URL; si no, el motor local. */
(function (root) {
  var inflight = {};
  var cache = {};
  var controllers = {};
  var chain = Promise.resolve();
  var localDb = null;

  function cfg() {
    return root.ImpulsaConfig || {};
  }
  function online() {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    } catch (err) {}
    return true;
  }
  function friendlyStatus(status) {
    if (status === 401 || status === 403) return "No tiene permiso para ver esta información.";
    if (status === 404) return "No se encontró el servicio.";
    if (status === 408) return "La consulta tardó demasiado. Intente nuevamente.";
    if (status === 429) return "Hay demasiadas consultas. Espere un momento.";
    if (status >= 500) return "El servidor no pudo completar la consulta.";
    if (status >= 400) return "No se pudo cargar la información. Intente nuevamente.";
    return "No se pudo cargar la información. Intente nuevamente.";
  }
  function friendlyError(err) {
    if (!err) return "No se pudo completar la operación.";
    if (err.message) return err.message;
    if (err.offline) return "Sin conexión. Se usan los datos guardados.";
    if (err.status) return friendlyStatus(err.status);
    if (err.name === "AbortError") return "La consulta tardó demasiado. Intente nuevamente.";
    return "No se pudo completar la operación.";
  }
  function locked(fn) {
    var run = chain.then(fn, fn);
    chain = run.then(
      function () {},
      function () {}
    );
    return run;
  }
  function loadLocal() {
    if (localDb) return Promise.resolve(localDb);
    var store = root.ImpulsaStore;
    var engine = root.ImpulsaEngine;
    if (!store || !engine) return Promise.resolve(engine ? engine.emptyDb() : {});
    return store.loadDb().then(function (raw) {
      localDb = engine.normalizeDb(raw);
      if (!apiUrl() && engine.maybeSeed) localDb = engine.maybeSeed(localDb);
      return persistLocal(localDb).then(function () {
        return localDb;
      });
    });
  }
  function persistLocal(db) {
    localDb = db;
    var store = root.ImpulsaStore;
    if (!store) return Promise.resolve(true);
    return store.saveDb(db);
  }
  function runLocal(action, payload, user) {
    return locked(function () {
      return loadLocal().then(function (db) {
        var engine = root.ImpulsaEngine;
        var result = engine.dispatch(action, engine.clone(db), payload, user);
        if (!result.ok) {
          var err = { status: 422, error: result.error, message: result.message || engine.MSG[result.error] };
          throw err;
        }
        if (result.db) {
          return persistLocal(result.db).then(function () {
            return result;
          });
        }
        return result;
      });
    });
  }
  function request(opts) {
    opts = opts || {};
    var method = String(opts.method || "GET").toUpperCase();
    var url = String(opts.url || "").trim();
    if (!url) return Promise.reject({ status: 0, message: "Falta la URL de la API." });
    var key = method + " " + url;
    var staleMs = opts.staleMs != null ? opts.staleMs : cfg().staleMs || 4000;
    if (method === "GET" && !opts.fresh && cache[key] && Date.now() - cache[key].at < staleMs) {
      return Promise.resolve(cache[key].data);
    }
    if (method === "GET" && inflight[key]) return inflight[key];
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ctrl) controllers[key] = ctrl;
    var timeoutMs = opts.timeout != null ? opts.timeout : cfg().timeoutMs || 8000;
    var timer = root.setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, timeoutMs);
    var headers = { Accept: "application/json" };
    if (opts.body != null) headers["Content-Type"] = "text/plain;charset=utf-8";
    var started = fetch(url, {
      method: method,
      headers: headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      redirect: "follow",
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        return res.text().then(function (t) {
          var data = null;
          try {
            data = t ? JSON.parse(t) : null;
          } catch (err) {}
          if (!res.ok) throw { status: res.status, message: friendlyStatus(res.status), data: data };
          return data;
        });
      })
      .then(function (data) {
        if (method === "GET" && data != null) cache[key] = { at: Date.now(), data: data };
        return data;
      })
      .catch(function (err) {
        if (err && err.status) throw err;
        throw { status: 0, message: friendlyError(err), cause: err, offline: !online() };
      })
      .finally(function () {
        root.clearTimeout(timer);
        if (controllers[key] === ctrl) delete controllers[key];
        if (inflight[key]) delete inflight[key];
      });
    if (method === "GET") inflight[key] = started;
    return started;
  }
  function apiUrl() {
    return String((cfg().apiUrl || "").trim());
  }
  function usesRemote() {
    return !!(apiUrl() && online());
  }
  function cacheDump(pack) {
    var engine = root.ImpulsaEngine;
    if (!pack || !engine) return Promise.resolve(localDb);
    localDb = engine.normalizeDb(pack);
    return persistLocal(localDb).then(function () {
      return localDb;
    });
  }
  function callRemote(action, payload, user) {
    return request({
      method: "POST",
      url: apiUrl(),
      body: { action: action, payload: payload || {}, session: user || null },
      fresh: true,
      retry: false,
      timeout: cfg().timeoutMs || 25000,
    }).then(function (data) {
      if (data && data.ok === false) {
        throw {
          status: 422,
          error: data.error,
          message: data.message || (root.ImpulsaEngine && root.ImpulsaEngine.MSG[data.error]) || "No se pudo completar.",
        };
      }
      return data;
    });
  }
  function sync(user) {
    if (!usesRemote() || !user || !user.id) return loadLocal();
    return callRemote("db", {}, user).then(function (res) {
      return cacheDump(res && res.data);
    });
  }
  function call(action, payload, user) {
    if (usesRemote()) {
      return callRemote(action, payload, user).then(function (data) {
        var nextUser = user;
        if ((action === "login" || action === "setupAdmin") && data && data.data && data.data.id) {
          nextUser = data.data;
        }
        if (data && data.db) {
          return cacheDump(data.db).then(function () {
            return data;
          });
        }
        if (action === "db") {
          return cacheDump(data && data.data).then(function () {
            return data;
          });
        }
        if (nextUser && nextUser.id) {
          return sync(nextUser).then(function () {
            return data;
          });
        }
        return data;
      });
    }
    return runLocal(action, payload, user);
  }

  root.ImpulsaApi = {
    request: request,
    online: online,
    call: call,
    sync: sync,
    usesRemote: usesRemote,
    loadLocal: loadLocal,
    cacheDb: function () {
      return localDb;
    },
    setDb: function (db) {
      localDb = db;
    },
    friendlyError: friendlyError,
    clearCache: function () {
      cache = {};
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
