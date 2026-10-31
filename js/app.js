(function (root) {
  var E = root.ImpulsaEngine;
  var PAGE = 10;
  var session = null;
  var db = null;
  var ui = { page: 1, q: "", report: "cobranzas" };
  var toastTimer = 0;
  var movesPage = 1;
  var PANEL_KEY = "impulsa.panel";
  var booted = false;

  var ROUTES = [
    { href: "#/dashboard", label: "Dashboard", group: "Operación", icon: "home" },
    { href: "#/clientes", label: "Clientes", group: "Operación", icon: "users" },
    { href: "#/avales", label: "Avales", group: "Operación", icon: "shield" },
    { href: "#/prestamos", label: "Préstamos", group: "Operación", icon: "file" },
    { href: "#/cobranzas", label: "Cobranzas", group: "Operación", icon: "coin" },
    { href: "#/caja", label: "Caja y capital", group: "Capital", icon: "safe" },
    { href: "#/inversionistas", label: "Inversionistas", group: "Capital", icon: "trend" },
    { href: "#/reportes", label: "Reportes", group: "Análisis", icon: "chart" },
    { href: "#/configuracion", label: "Configuración", group: "Análisis", icon: "gear" },
  ];

  function $(id) {
    return document.getElementById(id);
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function money(n) {
    return (E ? E.money(n) : Math.round(Number(n || 0) * 100) / 100);
  }
  function sol(n) {
    var cfg = db && E.cfgOf(db);
    var sym = (cfg && cfg.simbolo) || "S/";
    return (
      sym +
      " " +
      money(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }
  function parseRoute(hash) {
    var h = String(hash || location.hash || "#/dashboard").replace(/^#/, "") || "/dashboard";
    if (h.charAt(0) !== "/") h = "/" + h;
    return h.split("?")[0];
  }
  function today() {
    return E.todayKey();
  }
  function clienteOf(id) {
    return E.find(db.clientes, id) || { nombres: "", apellidos: "—", dni: "" };
  }
  function avalOf(id) {
    return E.find(db.avales, id);
  }
  function invOf(id) {
    return E.find(db.inversionistas, id) || { nombres: "", apellidos: "—" };
  }
  function person(row) {
    return E.fullName(row) || "—";
  }
  function matchQ(row, q) {
    if (!q) return true;
    var blob = JSON.stringify(row || {}).toLowerCase();
    return blob.indexOf(q) !== -1;
  }
  function icon(name) {
    var p = {
      home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M20 8a3 3 0 1 1 0 6"/><path d="M22 21v-2a3.5 3.5 0 0 0-2.6-3.4"/>',
      shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
      file: '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v6h6"/>',
      coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5c.6-.8 1.5-1.2 2.5-1.2 1.6 0 2.8 1 2.8 2.4 0 3.3-5.3 1.6-5.3 4.2 0 1.3 1.2 2.3 2.8 2.3 1.1 0 2-.5 2.5-1.3"/>',
      safe: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="12" cy="15" r="2.2"/>',
      trend: '<path d="M4 16l5-5 4 3 7-8"/><path d="M14 6h6v6"/>',
      chart: '<path d="M4 19V5M4 19h16"/><path d="M8 15v-4M12 15V8M16 15v-7"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M17.8 6.2l-1.4 1.4M7.6 16.4 6.2 17.8"/>',
    };
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (p[name] || p.home) + "</svg>";
  }
  function badge(estado) {
    var map = {
      activo: "ok",
      pagada: "ok",
      cancelado: "navy",
      pendiente: "gold",
      parcial: "gold",
      vencido: "bad",
      inactivo: "mute",
      anulado: "mute",
      refinanciado: "navy",
    };
    return '<span class="if-badge is-' + (map[estado] || "navy") + '">' + esc(estado || "—") + "</span>";
  }
  function empty(text) {
    return '<p class="empty">' + esc(text || "No hay registros.") + "</p>";
  }
  function pager(total, page) {
    var pages = Math.max(1, Math.ceil(total / PAGE));
    if (page > pages) page = pages;
    if (total <= PAGE) return "";
    var from = (page - 1) * PAGE + 1;
    var to = Math.min(page * PAGE, total);
    return (
      '<div class="team-pager if-pager"><button type="button" class="page-btn" data-act="page" data-page="' +
      (page - 1) +
      '" ' +
      (page <= 1 ? "disabled" : "") +
      ">Anterior</button><span>Mostrando " +
      from +
      "–" +
      to +
      " de " +
      total +
      '</span><button type="button" class="page-btn" data-act="page" data-page="' +
      (page + 1) +
      '" ' +
      (page >= pages ? "disabled" : "") +
      ">Siguiente</button></div>"
    );
  }
  function slice(list) {
    var start = (ui.page - 1) * PAGE;
    return list.slice(start, start + PAGE);
  }
  function navHtml(current) {
    var html = "";
    var last = "";
    ROUTES.forEach(function (r) {
      if (r.group !== last) {
        html += '<p class="nav-label">' + esc(r.group) + "</p>";
        last = r.group;
      }
      var path = r.href.replace("#", "");
      html +=
        '<a href="' +
        r.href +
        '" class="' +
        (current === path ? "on" : "") +
        '">' +
        icon(r.icon) +
        "<span>" +
        esc(r.label) +
        "</span></a>";
    });
    return html;
  }
  function swalOn() {
    return typeof root.Swal !== "undefined";
  }
  function swalBase(extra) {
    return Object.assign(
      {
        confirmButtonColor: "#123D78",
        cancelButtonColor: "#6b7380",
        background: "#fff",
        color: "#1b1f24",
        buttonsStyling: true,
      },
      extra || {}
    );
  }
  function toast(msg, kind) {
    if (swalOn()) {
      return root.Swal.fire(
        swalBase({
          toast: true,
          position: "top-end",
          icon: kind === "bad" ? "error" : kind === "info" ? "info" : kind === "warn" ? "warning" : "success",
          title: msg,
          showConfirmButton: false,
          timer: 3200,
          timerProgressBar: true,
        })
      );
    }
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "toast show" + (kind ? " is-" + kind : "");
    el.hidden = false;
    root.clearTimeout(toastTimer);
    toastTimer = root.setTimeout(function () {
      el.classList.remove("show");
      el.hidden = true;
    }, 2800);
  }
  function ask(opts) {
    opts = opts || {};
    if (swalOn()) {
      return root.Swal.fire(
        swalBase({
          icon: opts.icon || "warning",
          title: opts.title || "Confirmar",
          text: opts.text || "",
          showCancelButton: !opts.hideCancel,
          confirmButtonText: opts.ok || "Confirmar",
          cancelButtonText: opts.cancel || "Cancelar",
          confirmButtonColor: opts.danger ? "#DC3545" : "#123D78",
        })
      ).then(function (r) {
        return !!(r && r.isConfirmed);
      });
    }
    return new Promise(function (resolve) {
      var box = $("swal");
      $("swal-title").textContent = opts.title || "Confirmar";
      $("swal-text").textContent = opts.text || "";
      $("swal-ok").textContent = opts.ok || "Confirmar";
      $("swal-cancel").hidden = !!opts.hideCancel;
      $("swal-cancel").textContent = opts.cancel || "Cancelar";
      box.hidden = false;
      box.classList.add("open");
      document.body.classList.add("swal-on");
      function done(val) {
        box.hidden = true;
        box.classList.remove("open");
        document.body.classList.remove("swal-on");
        $("swal-ok").onclick = null;
        $("swal-cancel").onclick = null;
        resolve(val);
      }
      $("swal-ok").onclick = function () {
        done(true);
      };
      $("swal-cancel").onclick = function () {
        done(false);
      };
    });
  }
  function swalOk(title, text) {
    if (swalOn()) {
      return root.Swal.fire(swalBase({ icon: "success", title: title, text: text || "", confirmButtonText: "Entendido" }));
    }
    toast(title);
    return Promise.resolve();
  }
  function swalErr(msg) {
    if (swalOn()) {
      return root.Swal.fire(swalBase({ icon: "error", title: "No se pudo completar", text: msg || "", confirmButtonText: "Revisar" }));
    }
    toast(msg, "bad");
    return Promise.resolve();
  }
  function swalInfo(title, text) {
    if (swalOn()) {
      return root.Swal.fire(swalBase({ icon: "info", title: title, text: text || "", confirmButtonText: "Entendido" }));
    }
    toast(title, "info");
    return Promise.resolve();
  }
  function openModal(title, kicker, html) {
    $("form-title").textContent = title;
    $("form-kicker").textContent = kicker || "Impulsa Financiera";
    $("form-body").innerHTML = html;
    $("form-modal").classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    $("form-modal").classList.remove("open");
    document.body.style.overflow = "";
    $("form-body").innerHTML = "";
  }
  function formVal(form) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") data[el.name] = el.checked;
      else data[el.name] = el.value;
    });
    return data;
  }
  function field(name, label, type, value, extra) {
    extra = extra || {};
    var req = extra.required ? " required" : "";
    if (type === "select") {
      var opts = (extra.options || [])
        .map(function (o) {
          var v = typeof o === "string" ? o : o.id;
          var t = typeof o === "string" ? o : o.label;
          return '<option value="' + esc(v) + '"' + (String(value) === String(v) ? " selected" : "") + ">" + esc(t) + "</option>";
        })
        .join("");
      return (
        '<label class="form-field"><span>' +
        esc(label) +
        (extra.required ? " *" : "") +
        "</span><select name=\"" +
        esc(name) +
        '"' +
        req +
        ">" +
        opts +
        "</select></label>"
      );
    }
    if (type === "textarea") {
      return (
        '<label class="form-field form-wide"><span>' +
        esc(label) +
        "</span><textarea name=\"" +
        esc(name) +
        '" rows="3">' +
        esc(value || "") +
        "</textarea></label>"
      );
    }
    if (type === "check") {
      return (
        '<label class="form-check"><input type="checkbox" name="' +
        esc(name) +
        '"' +
        (value ? " checked" : "") +
        " /><span>" +
        esc(label) +
        "</span></label>"
      );
    }
    return (
      '<label class="form-field"><span>' +
      esc(label) +
      (extra.required ? " *" : "") +
      '</span><input name="' +
      esc(name) +
      '" type="' +
      (type || "text") +
      '" value="' +
      esc(value == null ? "" : value) +
      '"' +
      req +
      (extra.maxlength ? ' maxlength="' + extra.maxlength + '"' : "") +
      (extra.placeholder ? ' placeholder="' + esc(extra.placeholder) + '"' : "") +
      (extra.step ? ' step="' + extra.step + '"' : "") +
      (extra.min != null ? ' min="' + extra.min + '"' : "") +
      " /></label>"
    );
  }
  function table(cols, rows, foot) {
    if (!rows.length) return empty("No hay información para mostrar.");
    return (
      '<div class="table-wrap if-table-wrap"><table class="admin-table if-table"><thead><tr>' +
      cols
        .map(function (c) {
          return "<th>" + esc(c.label || " ") + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      rows
        .map(function (r) {
          return (
            "<tr>" +
            cols
              .map(function (c) {
                var label = c.label || "Acción";
                return (
                  '<td data-label="' +
                  esc(label) +
                  '">' +
                  (c.html ? r[c.key] : esc(r[c.key] == null ? "" : r[c.key])) +
                  "</td>"
                );
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody>" +
      (foot
        ? "<tfoot><tr class='foot'>" +
          cols
            .map(function (c) {
              return "<td data-label=\"" + esc(c.label || "") + "\">" + (foot[c.key] != null ? foot[c.key] : "") + "</td>";
            })
            .join("") +
          "</tr></tfoot>"
        : "") +
      "</table></div>"
    );
  }
  function bars(items, key) {
    key = key || "valor";
    var max = 1;
    items.forEach(function (it) {
      if (Number(it[key] || 0) > max) max = Number(it[key] || 0);
    });
    return (
      '<div class="if-bars">' +
      items
        .map(function (it) {
          var h = Math.round((Number(it[key] || 0) / max) * 100);
          return (
            '<div class="if-bar" title="' +
            esc(sol(it[key])) +
            '"><span style="height:' +
            h +
            '%"></span><small>' +
            esc(it.label) +
            "</small></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  function dualBars(items) {
    var max = 1;
    items.forEach(function (it) {
      max = Math.max(max, Number(it.ingresos || 0), Number(it.egresos || 0));
    });
    return (
      '<div class="if-bars is-dual">' +
      items
        .map(function (it) {
          return (
            '<div class="if-dual"><div class="if-col in" style="height:' +
            Math.round((Number(it.ingresos || 0) / max) * 100) +
            '%"></div><div class="if-col out" style="height:' +
            Math.round((Number(it.egresos || 0) / max) * 100) +
            '%"></div><small>' +
            esc(it.label) +
            "</small></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  function donut(items) {
    var total = items.reduce(function (a, it) {
      return a + Number(it.valor || 0);
    }, 0) || 1;
    var colors = ["#123D78", "#D4A52C", "#16A36A", "#092653"];
    var r = 42;
    var c = 2 * Math.PI * r;
    var off = 0;
    var rings = items
      .map(function (it, i) {
        var len = (Number(it.valor || 0) / total) * c;
        var html =
          '<circle cx="50" cy="50" r="' +
          r +
          '" fill="none" stroke="' +
          colors[i % colors.length] +
          '" stroke-width="12" stroke-dasharray="' +
          len +
          " " +
          (c - len) +
          '" stroke-dashoffset="' +
          -off +
          '" transform="rotate(-90 50 50)"></circle>';
        off += len;
        return html;
      })
      .join("");
    return (
      '<div class="if-donut"><svg viewBox="0 0 100 100">' +
      rings +
      '</svg><ul>' +
      items
        .map(function (it, i) {
          return (
            "<li><i style='background:" +
            colors[i % colors.length] +
            "'></i>" +
            esc(it.label) +
            " <b>" +
            esc(sol(it.valor)) +
            "</b></li>"
          );
        })
        .join("") +
      "</ul></div>"
    );
  }
  function kpiCard(label, value, hint, tone) {
    return (
      '<article class="card kpi kpi-' +
      (tone || "navy") +
      '"><div class="kpi-top"><span>' +
      esc(label) +
      "</span></div><b>" +
      value +
      "</b><small>" +
      esc(hint || "") +
      "</small></article>"
    );
  }
  function pageHead(kicker, title, sub, actions) {
    return (
      '<header class="page-head if-head"><div><p class="kicker">' +
      esc(kicker) +
      '</p><h1 class="h1">' +
      esc(title) +
      '</h1><p class="sub">' +
      esc(sub) +
      "</p></div>" +
      (actions || "") +
      "</header>"
    );
  }

  function reload() {
    return root.ImpulsaApi.loadLocal().then(function (pack) {
      db = pack;
      return db;
    });
  }
  function run(action, payload) {
    return root.ImpulsaApi.call(action, payload, session).then(function (res) {
      if (res && res.db) db = res.db;
      else return reload().then(function () {
        return res;
      });
      return res;
    });
  }
  function actErr(err) {
    swalErr((err && err.message) || "No se pudo completar.");
  }

  function overdue() {
    var todayKey = today();
    return (db.cuotas || []).filter(function (c) {
      return E.cuotaSaldo(c) > 0.009 && String(c.fechaVencimiento || "") < todayKey;
    });
  }

  function renderDashboard() {
    var s = E.kpis(db);
    var ser = E.series(db);
    var venc = overdue().slice(0, 8);
    return (
      '<div class="layout if-dash"><div class="col">' +
      '<section class="hero if-hero"><div><p>' +
      esc(new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })) +
      "</p><h1>Control de capital y cobranzas</h1><p>Indicadores reales de cartera, caja e inversionistas. Nada se inventa: todo sale de los registros.</p><div class=\"hero-actions\"><a class=\"btn btn-light\" href=\"#/prestamos\">Nuevo préstamo</a><a class=\"btn btn-ghost\" href=\"#/cobranzas\">Registrar cobranza</a></div></div><img class=\"hero-chef hero-logo\" src=\"JL.jpeg\" alt=\"Impulsa Financiera\" width=\"220\" height=\"140\" decoding=\"async\"></section>" +
      '<div class="kpis kpis-wide">' +
      kpiCard("Capital disponible", sol(s.capitalDisponible), "Saldo de caja", "gold") +
      kpiCard("Capital prestado", sol(s.capitalPrestado), "Dinero en la calle", "navy") +
      kpiCard("Préstamos activos", String(s.prestamosActivos), "Incluye vencidos", "navy") +
      kpiCard("Clientes", String(s.clientes), "Registros activos", "navy") +
      kpiCard("Cobranzas del día", sol(s.cobranzasDia), s.cobranzasDiaN + " operaciones", "ok") +
      kpiCard("Cobranzas de la semana", sol(s.cobranzasSemana), "Últimos 7 días", "ok") +
      kpiCard("Cuotas vencidas", String(s.cuotasVencidas), sol(s.cuotasVencidasMonto), "bad") +
      kpiCard("Ganancias cobradas", sol(s.gananciasGeneradas), "Solo intereses percibidos", "ok") +
      kpiCard("Ganancias por liquidar", sol(s.gananciasPendientes), "No son rentabilidad garantizada", "gold") +
      kpiCard("Inversionistas activos", String(s.inversionistasActivos), "Capital " + sol(s.capitalInversionistas), "navy") +
      "</div></div>" +
      '<aside class="rail"><section class="summary if-summary"><h2>Composición</h2>' +
      '<div class="if-kv"><span>Capital propio</span><b>' +
      esc(sol(s.capitalPropio)) +
      "</b></div><div class=\"if-kv\"><span>Capital de inversionistas</span><b>" +
      esc(sol(s.capitalInversionistas)) +
      "</b></div><div class=\"if-kv\"><span>Utilidad neta</span><b>" +
      esc(sol(s.utilidadesNetas)) +
      "</b></div><div class=\"if-kv\"><span>Caja actual</span><b>" +
      esc(sol(s.caja)) +
      "</b></div><p class=\"muted if-note\">Una cobranza no es ganancia completa: solo el interés cobrado entra a resultados.</p>" +
      '<a class="btn-block" href="#/caja">Ver caja</a></section></aside>' +
      '<div class="full if-charts">' +
      '<article class="card chart-card"><h3>Evolución de cobranzas</h3>' +
      bars(ser.cobranzas) +
      "</article>" +
      '<article class="card chart-card"><h3>Préstamos otorgados</h3>' +
      bars(ser.prestamos) +
      "</article>" +
      '<article class="card chart-card"><h3>Distribución del capital</h3>' +
      donut(ser.capital) +
      "</article>" +
      '<article class="card chart-card"><h3>Ingresos y egresos</h3><p class="muted chart-legend">Azul ingresos · Dorado egresos</p>' +
      dualBars(ser.flujo) +
      "</article></div>" +
      '<div class="full"><section class="card verify"><div class="verify-head"><div><h2>Cuotas vencidas</h2><p class="if-count">' +
      venc.length +
      " en alerta</p></div><a class=\"tool-btn\" href=\"#/cobranzas\">Ir a cobranzas</a></div>" +
      (venc.length
        ? table(
            [
              { key: "cli", label: "Cliente" },
              { key: "pre", label: "Préstamo" },
              { key: "nro", label: "Cuota" },
              { key: "fecha", label: "Vencimiento" },
              { key: "saldo", label: "Saldo" },
            ],
            venc.map(function (c) {
              var p = E.find(db.prestamos, c.prestamoId) || {};
              return {
                cli: person(clienteOf(p.clienteId)),
                pre: p.codigo || "—",
                nro: c.nro,
                fecha: c.fechaVencimiento,
                saldo: sol(E.cuotaSaldo(c)),
              };
            })
          )
        : empty("No hay cuotas vencidas.")) +
      "</section></div></div>"
    );
  }

  function renderClientes(q) {
    var list = (db.clientes || []).filter(function (c) {
      var blob = [c.dni, c.nombres, c.apellidos, c.celular].join(" ").toLowerCase();
      return !q || blob.indexOf(q) !== -1;
    });
    var rows = slice(list).map(function (c) {
      var n = db.prestamos.filter(function (p) {
        return p.clienteId === c.id;
      }).length;
      return {
        who:
          '<div class="person-name"><strong>' +
          esc(person(c)) +
          "</strong><small>DNI " +
          esc(c.dni) +
          "</small></div>",
        celular: c.celular || "—",
        prestamos: n,
        estado: badge(c.estado),
        act:
          '<div class="if-acts"><button type="button" class="tool-btn" data-act="cliente-edit" data-id="' +
          esc(c.id) +
          '">Editar</button><button type="button" class="tool-btn" data-act="cliente-hist" data-id="' +
          esc(c.id) +
          '">Historial</button></div>',
      };
    });
    return (
      pageHead("Cartera", "Clientes", "Registro, búsqueda por DNI y seguimiento de préstamos.", '<button type="button" class="tool-btn tool-btn-dark" data-act="cliente-new">Registrar cliente</button>') +
      '<section class="card verify">' +
      table(
        [
          { key: "who", label: "Cliente", html: true },
          { key: "celular", label: "Celular" },
          { key: "prestamos", label: "Préstamos" },
          { key: "estado", label: "Estado", html: true },
          { key: "act", label: "", html: true },
        ],
        rows
      ) +
      pager(list.length, ui.page) +
      "</section>"
    );
  }
  function renderAvales(q) {
    var list = (db.avales || []).filter(function (a) {
      return matchQ(a, q) || person(clienteOf(a.clienteId)).toLowerCase().indexOf(q) !== -1;
    });
    var rows = slice(list).map(function (a) {
      return {
        who:
          '<div class="person-name"><strong>' +
          esc(person(a)) +
          "</strong><small>DNI " +
          esc(a.dni) +
          "</small></div>",
        cli: person(clienteOf(a.clienteId)),
        parentesco: a.parentesco || "—",
        celular: a.celular || "—",
        estado: badge(a.estado),
        act: '<button type="button" class="tool-btn" data-act="aval-edit" data-id="' + esc(a.id) + '">Editar</button>',
      };
    });
    return (
      pageHead("Cartera", "Avales y garantes", "Un aval puede respaldar distintos préstamos y conserva su historial.", '<button type="button" class="tool-btn tool-btn-dark" data-act="aval-new">Registrar aval</button>') +
      '<section class="card verify">' +
      table(
        [
          { key: "who", label: "Aval", html: true },
          { key: "cli", label: "Cliente" },
          { key: "parentesco", label: "Parentesco" },
          { key: "celular", label: "Celular" },
          { key: "estado", label: "Estado", html: true },
          { key: "act", label: "", html: true },
        ],
        rows
      ) +
      pager(list.length, ui.page) +
      "</section>"
    );
  }
  function renderPrestamos(q) {
    var list = (db.prestamos || []).filter(function (p) {
      var cli = clienteOf(p.clienteId);
      var blob = [p.codigo, person(cli), cli.dni].join(" ").toLowerCase();
      return !q || blob.indexOf(q) !== -1;
    });
    var rows = slice(list).map(function (p) {
      return {
        codigo: p.codigo,
        cli: person(clienteOf(p.clienteId)),
        capital: sol(p.capital),
        cuota: sol(p.valorCuota),
        n: p.nCuotas,
        estado: badge(p.estado),
        saldo: sol(E.prestamoSaldo(db, p.id)),
        act:
          '<div class="if-acts"><button type="button" class="tool-btn" data-act="prestamo-ver" data-id="' +
          esc(p.id) +
          '">Cronograma</button></div>',
      };
    });
    return (
      pageHead("Operación", "Préstamos", "El sistema calcula las cuotas. Las tasas nuevas no cambian préstamos ya desembolsados.", '<button type="button" class="tool-btn tool-btn-dark" data-act="prestamo-new">Registrar préstamo</button>') +
      '<section class="card verify">' +
      table(
        [
          { key: "codigo", label: "Código" },
          { key: "cli", label: "Cliente" },
          { key: "capital", label: "Capital" },
          { key: "cuota", label: "Cuota" },
          { key: "n", label: "Plazo" },
          { key: "saldo", label: "Saldo" },
          { key: "estado", label: "Estado", html: true },
          { key: "act", label: "", html: true },
        ],
        rows
      ) +
      pager(list.length, ui.page) +
      "</section>"
    );
  }
  function renderCobranzas(q) {
    var list = (db.cobranzas || []).filter(function (c) {
      if (c.anulado) return q === "anulado";
      var cli = clienteOf(c.clienteId);
      var p = E.find(db.prestamos, c.prestamoId) || {};
      var blob = [c.codigo, person(cli), p.codigo, c.fecha].join(" ").toLowerCase();
      return !q || blob.indexOf(q) !== -1;
    });
    var rows = slice(list).map(function (c) {
      return {
        codigo: c.codigo,
        cli: person(clienteOf(c.clienteId)),
        fecha: c.fecha + " " + (c.hora || ""),
        importe: sol(c.importe),
        cap: sol(c.capitalAmortizado),
        int: sol(c.interesCobrado),
        saldo: sol(c.saldoPendiente),
        user: c.usuario || "—",
        act:
          '<div class="if-acts"><button type="button" class="tool-btn" data-act="pago-ver" data-id="' +
          esc(c.id) +
          '">Comprobante</button>' +
          (c.anulado
            ? ""
            : '<button type="button" class="tool-btn" data-act="pago-anular" data-id="' + esc(c.id) + '">Anular</button>') +
          "</div>",
      };
    });
    return (
      pageHead("Operación", "Cobranzas y pagos", "Pagos totales o parciales, con código único y sin duplicar operaciones.", '<button type="button" class="tool-btn tool-btn-dark" data-act="pago-new">Registrar pago</button>') +
      '<section class="card verify">' +
      table(
        [
          { key: "codigo", label: "Operación" },
          { key: "cli", label: "Cliente" },
          { key: "fecha", label: "Fecha" },
          { key: "importe", label: "Importe" },
          { key: "cap", label: "Capital" },
          { key: "int", label: "Interés" },
          { key: "saldo", label: "Saldo" },
          { key: "user", label: "Usuario" },
          { key: "act", label: "", html: true },
        ],
        rows
      ) +
      pager(list.length, ui.page) +
      "</section>"
    );
  }
  function renderCaja() {
    var s = E.kpis(db);
    var list = db.movimientosCaja || [];
    var q = ui.q;
    var filtered = list.filter(function (m) {
      return !q || matchQ(m, q);
    });
    var rows = slice(filtered).map(function (m) {
      return {
        fecha: m.fecha + " " + (m.hora || ""),
        tipo: m.tipo,
        desc: m.descripcion || "—",
        sentido: m.sentido,
        monto: (m.sentido === "egreso" ? "− " : "+ ") + sol(m.monto),
        estado: m.anulado ? badge("anulado") : badge("activo"),
        act: m.anulado || m.tipo === "cobranza" || m.tipo === "desembolso" || m.tipo === "pago_ganancia"
          ? ""
          : '<button type="button" class="tool-btn" data-act="caja-anular" data-id="' + esc(m.id) + '">Anular</button>',
      };
    });
    return (
      pageHead("Capital", "Caja y capital", "El dinero propio, el de inversionistas y las utilidades se muestran por separado.") +
      '<div class="grid3">' +
      '<article class="card mini"><span>Saldo actual</span><b>' +
      esc(sol(s.caja)) +
      "</b></article>" +
      '<article class="card mini if-mini-in"><span>Ingresos</span><b>' +
      esc(sol(s.ingresos)) +
      "</b></article>" +
      '<article class="card mini if-mini-out"><span>Egresos</span><b>' +
      esc(sol(s.egresos)) +
      "</b></article></div>" +
      '<div class="grid3">' +
      '<article class="card mini"><span>Capital propio</span><b>' +
      esc(sol(s.capitalPropio)) +
      "</b></article>" +
      '<article class="card mini"><span>Capital inversionistas</span><b>' +
      esc(sol(s.capitalInversionistas)) +
      "</b></article>" +
      '<article class="card mini"><span>Capital colocado</span><b>' +
      esc(sol(s.capitalPrestado)) +
      "</b></article></div>" +
      '<div class="if-head-actions"><button type="button" class="tool-btn tool-btn-dark" data-act="caja-in">Ingreso / aporte</button><button type="button" class="tool-btn" data-act="caja-out">Gasto / egreso</button></div>' +
      '<section class="card verify">' +
      table(
        [
          { key: "fecha", label: "Fecha" },
          { key: "tipo", label: "Tipo" },
          { key: "desc", label: "Detalle" },
          { key: "sentido", label: "Sentido" },
          { key: "monto", label: "Monto" },
          { key: "estado", label: "Estado", html: true },
          { key: "act", label: "", html: true },
        ],
        rows
      ) +
      pager(filtered.length, ui.page) +
      "</section>"
    );
  }
  function renderInversionistas(q) {
    var list = (db.inversionistas || []).filter(function (i) {
      return !q || matchQ(i, q);
    });
    var rows = slice(list).map(function (i) {
      return {
        who:
          '<div class="person-name"><strong>' +
          esc(person(i)) +
          "</strong><small>DNI " +
          esc(i.dni) +
          "</small></div>",
        cap: sol(E.inversionistaCapital(db, i.id)),
        mod: i.modalidad === "utilidades" ? "Utilidades netas" : "Rentabilidad fija",
        estado: badge(i.estado),
        act:
          '<div class="if-acts"><button type="button" class="tool-btn" data-act="inv-ver" data-id="' +
          esc(i.id) +
          '">Estado</button><button type="button" class="tool-btn" data-act="inv-edit" data-id="' +
          esc(i.id) +
          '">Editar</button></div>',
      };
    });
    return (
      pageHead("Capital", "Inversionistas", "El capital aportado no se confunde con las ganancias. Las rentabilidades se calculan según el acuerdo y no se presentan como garantizadas.", '<button type="button" class="tool-btn tool-btn-dark" data-act="inv-new">Registrar inversionista</button>') +
      '<p class="if-legal">' +
      esc(E.cfgOf(db).avisoLegal) +
      "</p>" +
      '<section class="card verify">' +
      table(
        [
          { key: "who", label: "Inversionista", html: true },
          { key: "cap", label: "Capital vigente" },
          { key: "mod", label: "Modalidad" },
          { key: "estado", label: "Estado", html: true },
          { key: "act", label: "", html: true },
        ],
        rows
      ) +
      pager(list.length, ui.page) +
      "</section>"
    );
  }
  function renderReportes() {
    var tipo = ui.report || "cobranzas";
    var from = ui.from || "";
    var to = ui.to || "";
    var res = E.dispatch("reporte", db, { tipo: tipo, from: from, to: to });
    var rows = (res.data && res.data.rows) || [];
    var colsMap = {
      clientes: [
        { key: "dni", label: "DNI" },
        { key: "apellidos", label: "Apellidos" },
        { key: "nombres", label: "Nombres" },
        { key: "celular", label: "Celular" },
        { key: "estado", label: "Estado" },
      ],
      prestamos: [
        { key: "codigo", label: "Código" },
        { key: "capital", label: "Capital" },
        { key: "tasa", label: "Tasa" },
        { key: "fechaDesembolso", label: "Desembolso" },
        { key: "estado", label: "Estado" },
      ],
      prestamos_otorgados: [
        { key: "codigo", label: "Código" },
        { key: "capital", label: "Capital" },
        { key: "fechaDesembolso", label: "Desembolso" },
        { key: "estado", label: "Estado" },
      ],
      prestamos_cancelados: [
        { key: "codigo", label: "Código" },
        { key: "capital", label: "Capital" },
        { key: "estado", label: "Estado" },
      ],
      prestamos_pendientes: [
        { key: "codigo", label: "Código" },
        { key: "capital", label: "Capital" },
        { key: "estado", label: "Estado" },
      ],
      cobranzas: [
        { key: "codigo", label: "Operación" },
        { key: "fecha", label: "Fecha" },
        { key: "importe", label: "Importe" },
        { key: "capitalAmortizado", label: "Capital" },
        { key: "interesCobrado", label: "Interés" },
      ],
      cuotas_vencidas: [
        { key: "nro", label: "Cuota" },
        { key: "fechaVencimiento", label: "Vencimiento" },
        { key: "monto", label: "Monto" },
        { key: "pagado", label: "Pagado" },
      ],
      intereses: [
        { key: "codigo", label: "Operación" },
        { key: "fecha", label: "Fecha" },
        { key: "interesCobrado", label: "Interés cobrado" },
      ],
      gastos: [
        { key: "fecha", label: "Fecha" },
        { key: "descripcion", label: "Detalle" },
        { key: "monto", label: "Monto" },
      ],
      caja: [
        { key: "fecha", label: "Fecha" },
        { key: "tipo", label: "Tipo" },
        { key: "sentido", label: "Sentido" },
        { key: "monto", label: "Monto" },
      ],
      capital: [
        { key: "fecha", label: "Fecha" },
        { key: "tipo", label: "Tipo" },
        { key: "sentido", label: "Sentido" },
        { key: "monto", label: "Monto" },
      ],
      inversionistas: [
        { key: "dni", label: "DNI" },
        { key: "apellidos", label: "Apellidos" },
        { key: "nombres", label: "Nombres" },
        { key: "modalidad", label: "Modalidad" },
        { key: "estado", label: "Estado" },
      ],
      ganancias: [
        { key: "fecha", label: "Fecha" },
        { key: "monto", label: "Monto" },
        { key: "estado", label: "Estado" },
      ],
    };
    var cols = colsMap[tipo] || colsMap.cobranzas;
    var moneyKeys = { capital: 1, importe: 1, capitalAmortizado: 1, interesCobrado: 1, monto: 1, pagado: 1 };
    var view = slice(rows).map(function (r) {
      var o = {};
      cols.forEach(function (c) {
        var v = r[c.key];
        if (c.key === "tasa" && v != null && v !== "") o[c.key] = Number(v).toLocaleString("es-PE") + " %";
        else if (moneyKeys[c.key] && v != null && v !== "") o[c.key] = sol(v);
        else o[c.key] = v == null ? "" : v;
      });
      return o;
    });
    var opts = [
      ["clientes", "Clientes registrados"],
      ["prestamos_otorgados", "Préstamos otorgados"],
      ["prestamos_cancelados", "Préstamos cancelados"],
      ["prestamos_pendientes", "Préstamos pendientes"],
      ["cobranzas", "Cobranzas realizadas"],
      ["cuotas_vencidas", "Cuotas vencidas"],
      ["intereses", "Intereses cobrados"],
      ["gastos", "Gastos"],
      ["ganancias", "Ganancias / liquidaciones"],
      ["capital", "Capital y caja"],
      ["inversionistas", "Estado de inversionistas"],
    ];
    return (
      pageHead("Análisis", "Reportes", "Filtros por fecha, exportación a Excel y PDF.") +
      '<section class="card verify"><div class="verify-head"><div><h2>Consulta</h2><p class="if-count">' +
      rows.length +
      " registros</p></div><div class=\"verify-tools\">" +
      '<select id="rep-tipo" class="if-select">' +
      opts
        .map(function (o) {
          return '<option value="' + o[0] + '"' + (tipo === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
        })
        .join("") +
      "</select>" +
      '<input id="rep-from" class="if-date" type="date" value="' +
      esc(from) +
      '" />' +
      '<input id="rep-to" class="if-date" type="date" value="' +
      esc(to) +
      '" />' +
      '<button type="button" class="tool-btn" data-act="rep-run">Filtrar</button>' +
      '<span class="export-btns"><button type="button" class="tool-btn export-btn" data-act="export-xlsx">Excel</button><button type="button" class="tool-btn tool-btn-dark export-btn" data-act="export-pdf">PDF</button></span></div></div>' +
      table(cols, view) +
      pager(rows.length, ui.page) +
      "</section>"
    );
  }
  function renderConfig() {
    var cfg = E.cfgOf(db);
    return (
      pageHead("Sistema", "Configuración", "Tasas y condiciones para préstamos nuevos. No altera cálculos históricos.") +
      '<form id="cfg-form" class="card if-form" data-act="cfg-save">' +
      '<div class="form-grid">' +
      field("empresa", "Empresa", "text", cfg.empresa, { required: true }) +
      field("simbolo", "Símbolo de moneda", "text", cfg.simbolo) +
      field("tasaDefault", "Tasa predeterminada %", "number", cfg.tasaDefault, { step: "0.01" }) +
      field("tipoTasaDefault", "Tipo de tasa", "select", cfg.tipoTasaDefault, {
        options: [
          { id: "plana", label: "Plana sobre capital (interés total)" },
          { id: "periodo", label: "Por periodo sobre capital" },
          { id: "frances", label: "Sistema francés (cuota fija)" },
        ],
      }) +
      field("frecuenciaDefault", "Frecuencia", "select", cfg.frecuenciaDefault, {
        options: [
          { id: "diaria", label: "Diaria" },
          { id: "semanal", label: "Semanal" },
          { id: "quincenal", label: "Quincenal" },
          { id: "mensual", label: "Mensual" },
        ],
      }) +
      field("nCuotasDefault", "Cuotas predeterminadas", "number", cfg.nCuotasDefault, { min: 1 }) +
      field("avisoLegal", "Aviso de cumplimiento", "textarea", cfg.avisoLegal) +
      "</div><button type=\"submit\" class=\"tool-btn tool-btn-dark\">Guardar configuración</button></form>" +
      '<form id="pass-form" class="card if-form" data-act="pass-save"><h3>Cambiar clave</h3><div class="form-grid">' +
      field("claveActual", "Clave actual", "password", "") +
      field("claveNueva", "Nueva clave", "password", "") +
      '</div><button type="submit" class="tool-btn">Actualizar clave</button></form>'
    );
  }

  function render(route, q) {
    ui.q = foldQ(q);
    if (route === "/clientes") return renderClientes(ui.q);
    if (route === "/avales") return renderAvales(ui.q);
    if (route === "/prestamos") return renderPrestamos(ui.q);
    if (route === "/cobranzas") return renderCobranzas(ui.q);
    if (route === "/caja") return renderCaja();
    if (route === "/inversionistas") return renderInversionistas(ui.q);
    if (route === "/reportes") return renderReportes();
    if (route === "/configuracion") return renderConfig();
    return renderDashboard();
  }
  function foldQ(q) {
    return String(q || "")
      .toLowerCase()
      .trim();
  }

  function paint() {
    if (!db) return;
    var nav = $("nav");
    var app = $("app");
    var search = $("q");
    if (!nav || !app) return;
    var current = parseRoute(location.hash);
    nav.innerHTML = navHtml(current);
    app.innerHTML = render(current, search ? search.value : "");
    paintNotices();
    paintMoveBadge();
    paintUser();
  }
  function paintUser() {
    var name = (session && session.nombre) || "Administrador";
    ["side-name", "hello-name", "hello-menu-name"].forEach(function (id) {
      if ($(id)) $(id).textContent = name;
    });
  }
  function paintNotices() {
    var list = overdue();
    var badgeEl = $("notice-badge");
    var sub = $("notice-sub");
    var box = $("notice-list");
    if (!badgeEl || !box) return;
    badgeEl.hidden = !list.length;
    badgeEl.textContent = list.length > 99 ? "99+" : String(list.length);
    if (sub) sub.textContent = list.length ? list.length + " cuotas por cobrar" : "Sin cuotas vencidas";
    box.innerHTML = list.length
      ? list
          .slice(0, 12)
          .map(function (c) {
            var p = E.find(db.prestamos, c.prestamoId) || {};
            return (
              '<article class="notice-item is-new"><span class="avatar">CV</span><div><strong>Cuota ' +
              esc(c.nro) +
              " vencida</strong><small>" +
              esc(person(clienteOf(p.clienteId))) +
              "</small><small>" +
              esc(p.codigo || "") +
              " · " +
              esc(sol(E.cuotaSaldo(c))) +
              "</small></div><div class=\"notice-time\">" +
              esc(c.fechaVencimiento) +
              "</div></article>"
            );
          })
          .join("")
      : '<p class="notice-empty">No hay cuotas vencidas.</p>';
  }
  function paintMoveBadge() {
    var n = (db && db.auditoria ? db.auditoria.length : 0) || 0;
    var badgeEl = $("moves-badge");
    if (!badgeEl) return;
    badgeEl.hidden = !n;
    badgeEl.textContent = n > 99 ? "99+" : String(n);
  }
  function paintMoves() {
    var list = (db.auditoria || []).slice();
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (movesPage > pages) movesPage = pages;
    var sliceRows = list.slice((movesPage - 1) * PAGE, movesPage * PAGE);
    $("moves-count").textContent = list.length ? list.length + " operaciones auditadas" : "Sin operaciones";
    $("moves-list").innerHTML = sliceRows.length
      ? sliceRows
          .map(function (m) {
            return (
              '<article class="move-row"><time>' +
              esc(m.hora || "") +
              "</time><p>" +
              esc((m.accion || "") + " · " + (m.entidad || "") + " · " + (m.detalle || "")) +
              "</p></article>"
            );
          })
          .join("")
      : '<p class="moves-empty">Las altas, pagos y anulaciones quedan registradas aquí.</p>';
    var pagerEl = $("moves-pager");
    if (list.length <= PAGE) {
      pagerEl.hidden = true;
      return;
    }
    pagerEl.hidden = false;
    pagerEl.innerHTML =
      '<button type="button" class="page-btn" data-moves-page="' +
      (movesPage - 1) +
      '"' +
      (movesPage <= 1 ? " disabled" : "") +
      ">Anterior</button><span>" +
      movesPage +
      " / " +
      pages +
      '</span><button type="button" class="page-btn" data-moves-page="' +
      (movesPage + 1) +
      '"' +
      (movesPage >= pages ? " disabled" : "") +
      ">Siguiente</button>";
  }

  function clientesOpts(sel) {
    return (db.clientes || [])
      .filter(function (c) {
        return c.estado !== "inactivo";
      })
      .map(function (c) {
        return { id: c.id, label: person(c) + " · " + c.dni };
      })
      .concat(sel ? [] : []);
  }
  function avalesOpts(clienteId) {
    return [{ id: "", label: "Sin aval" }].concat(
      (db.avales || [])
        .filter(function (a) {
          return !clienteId || a.clienteId === clienteId;
        })
        .map(function (a) {
          return { id: a.id, label: person(a) + " · " + a.dni };
        })
    );
  }

  function clienteForm(row) {
    row = row || {};
    openModal(row.id ? "Editar cliente" : "Registrar cliente", "Datos personales", 
      '<form id="ent-form" class="if-form" data-kind="cliente" data-id="' +
        esc(row.id || "") +
        '"><div class="form-grid">' +
        field("dni", "DNI", "text", row.dni, { required: true, maxlength: 8, placeholder: "8 dígitos" }) +
        field("nombres", "Nombres", "text", row.nombres, { required: true }) +
        field("apellidos", "Apellidos", "text", row.apellidos, { required: true }) +
        field("fechaNacimiento", "Fecha de nacimiento", "date", row.fechaNacimiento) +
        field("celular", "Celular", "tel", row.celular) +
        field("ocupacion", "Ocupación", "text", row.ocupacion) +
        field("direccion", "Dirección", "text", row.direccion) +
        field("ref1Nombre", "Referencia 1 · nombre", "text", row.ref1Nombre) +
        field("ref1Telefono", "Referencia 1 · teléfono", "tel", row.ref1Telefono) +
        field("ref2Nombre", "Referencia 2 · nombre", "text", row.ref2Nombre) +
        field("ref2Telefono", "Referencia 2 · teléfono", "tel", row.ref2Telefono) +
        field("estado", "Estado", "select", row.estado || "activo", { options: ["activo", "inactivo"] }) +
        field("observaciones", "Observaciones", "textarea", row.observaciones) +
        '</div><div class="form-actions"><button type="button" class="tool-btn" data-act="modal-close">Cancelar</button><button type="submit" class="tool-btn tool-btn-dark">Guardar</button></div></form>'
    );
  }
  function avalForm(row) {
    row = row || {};
    openModal(row.id ? "Editar aval" : "Registrar aval", "Garante",
      '<form id="ent-form" class="if-form" data-kind="aval" data-id="' +
        esc(row.id || "") +
        '"><div class="form-grid">' +
        field("clienteId", "Cliente", "select", row.clienteId, { required: true, options: clientesOpts() }) +
        field("dni", "DNI del aval", "text", row.dni, { required: true, maxlength: 8 }) +
        field("nombres", "Nombres", "text", row.nombres, { required: true }) +
        field("apellidos", "Apellidos", "text", row.apellidos, { required: true }) +
        field("celular", "Celular", "tel", row.celular) +
        field("ocupacion", "Ocupación", "text", row.ocupacion) +
        field("parentesco", "Parentesco / relación", "text", row.parentesco) +
        field("direccion", "Dirección", "text", row.direccion) +
        field("documentacion", "Documentación de respaldo", "text", row.documentacion) +
        field("estado", "Estado", "select", row.estado || "activo", { options: ["activo", "inactivo"] }) +
        field("observaciones", "Observaciones", "textarea", row.observaciones) +
        field("constanciaAceptacion", "Constancia de aceptación y autorización", "check", row.constanciaAceptacion) +
        '</div><div class="form-actions"><button type="button" class="tool-btn" data-act="modal-close">Cancelar</button><button type="submit" class="tool-btn tool-btn-dark">Guardar</button></div></form>'
    );
  }
  function scheduleHtml(plan) {
    if (!plan || !plan.cuotas) return "";
    return (
      '<div class="if-plan"><div class="if-plan-kpis"><div><span>Intereses</span><b>' +
      esc(sol(plan.totalIntereses)) +
      "</b></div><div><span>Total a devolver</span><b>" +
      esc(sol(plan.totalDevolver)) +
      "</b></div><div><span>Cuota</span><b>" +
      esc(sol(plan.valorCuota)) +
      "</b></div></div>" +
      table(
        [
          { key: "nro", label: "N°" },
          { key: "fechaVencimiento", label: "Vence" },
          { key: "capital", label: "Capital" },
          { key: "interes", label: "Interés" },
          { key: "monto", label: "Cuota" },
        ],
        plan.cuotas.map(function (c) {
          return {
            nro: c.nro,
            fechaVencimiento: c.fechaVencimiento,
            capital: sol(c.capital),
            interes: sol(c.interes),
            monto: sol(c.monto),
          };
        })
      ) +
      "</div>"
    );
  }
  function prestamoForm(row) {
    row = row || {};
    var cfg = E.cfgOf(db);
    openModal(row.id ? "Editar préstamo" : "Registrar préstamo", "Condiciones y cronograma",
      '<form id="loan-form" class="if-form" data-kind="prestamo" data-id="' +
        esc(row.id || "") +
        '"><div class="form-grid">' +
        field("clienteId", "Cliente", "select", row.clienteId, { required: true, options: clientesOpts() }) +
        field("avalId", "Aval", "select", row.avalId || "", { options: avalesOpts(row.clienteId) }) +
        field("capital", "Capital S/", "number", row.capital || "", { required: true, step: "0.01", min: 1 }) +
        field("tasa", "Tasa %", "number", row.tasa != null ? row.tasa : cfg.tasaDefault, { required: true, step: "0.01" }) +
        field("tipoTasa", "Tipo de tasa", "select", row.tipoTasa || cfg.tipoTasaDefault, {
          options: [
            { id: "plana", label: "Plana sobre capital (interés total)" },
            { id: "periodo", label: "Por periodo sobre capital" },
            { id: "frances", label: "Sistema francés" },
          ],
        }) +
        field("frecuencia", "Frecuencia", "select", row.frecuencia || cfg.frecuenciaDefault, {
          options: [
            { id: "diaria", label: "Diaria" },
            { id: "semanal", label: "Semanal" },
            { id: "quincenal", label: "Quincenal" },
            { id: "mensual", label: "Mensual" },
          ],
        }) +
        field("nCuotas", "N° de cuotas", "number", row.nCuotas || cfg.nCuotasDefault, { required: true, min: 1 }) +
        field("fechaDesembolso", "Fecha de desembolso", "date", row.fechaDesembolso || today(), { required: true }) +
        field("fechaPrimeraCuota", "Primera cuota", "date", row.fechaPrimeraCuota || today(), { required: true }) +
        '</div><div id="loan-preview" class="if-preview"></div><div class="form-actions"><button type="button" class="tool-btn" data-act="modal-close">Cancelar</button><button type="submit" class="tool-btn tool-btn-dark">Confirmar desembolso</button></div></form>'
    );
    refreshLoanPreview();
  }
  function refreshLoanPreview() {
    var form = $("loan-form");
    var box = $("loan-preview");
    if (!form || !box) return;
    var data = formVal(form);
    var res = E.calcSchedule(data);
    box.innerHTML = res.ok ? scheduleHtml(res.data) : '<p class="if-warn">' + esc(res.message) + "</p>";
  }
  function pagoForm() {
    var activos = (db.prestamos || []).filter(function (p) {
      return p.estado === "activo" || p.estado === "vencido";
    });
    openModal("Registrar pago", "Cobranzas",
      '<form id="pay-form" class="if-form" data-kind="pago"><div class="form-grid">' +
        field(
          "prestamoId",
          "Préstamo",
          "select",
          activos[0] ? activos[0].id : "",
          {
            required: true,
            options: activos.map(function (p) {
              return { id: p.id, label: p.codigo + " · " + person(clienteOf(p.clienteId)) + " · saldo " + sol(E.prestamoSaldo(db, p.id)) };
            }),
          }
        ) +
        field("importe", "Importe recibido S/", "number", "", { required: true, step: "0.01", min: 0.01 }) +
        field("fecha", "Fecha", "date", today(), { required: true }) +
        '</div><div id="pay-info" class="if-preview"></div><div class="form-actions"><button type="button" class="tool-btn" data-act="modal-close">Cancelar</button><button type="submit" class="tool-btn tool-btn-dark">Registrar cobranza</button></div></form>'
    );
    refreshPayInfo();
  }
  function refreshPayInfo() {
    var form = $("pay-form");
    var box = $("pay-info");
    if (!form || !box) return;
    var id = formVal(form).prestamoId;
    var p = E.find(db.prestamos, id);
    if (!p) {
      box.innerHTML = empty("No hay préstamos activos. Registre un desembolso primero.");
      return;
    }
    var cuotas = db.cuotas
      .filter(function (c) {
        return c.prestamoId === p.id;
      })
      .sort(function (a, b) {
        return a.nro - b.nro;
      });
    box.innerHTML =
      "<p class=\"muted\">Saldo pendiente: <b>" +
      esc(sol(E.prestamoSaldo(db, p.id))) +
      "</b>. Puede pagar una cuota o un importe parcial.</p>" +
      table(
        [
          { key: "nro", label: "Cuota" },
          { key: "fecha", label: "Vence" },
          { key: "monto", label: "Monto" },
          { key: "pagado", label: "Pagado" },
          { key: "saldo", label: "Saldo" },
          { key: "est", label: "Estado", html: true },
        ],
        cuotas.map(function (c) {
          var st = c.estado;
          if (E.cuotaSaldo(c) > 0.009 && c.fechaVencimiento < today()) st = "vencido";
          return {
            nro: c.nro,
            fecha: c.fechaVencimiento,
            monto: sol(c.monto),
            pagado: sol(c.pagado || 0),
            saldo: sol(E.cuotaSaldo(c)),
            est: badge(st),
          };
        })
      );
  }
  function cajaForm(sentido) {
    var tiposIn = [
      { id: "aporte_propio", label: "Aporte de capital propio" },
      { id: "otro_ingreso", label: "Otro ingreso" },
    ];
    var tiposOut = [
      { id: "gasto", label: "Gasto administrativo" },
      { id: "devolucion_propio", label: "Devolución de capital propio" },
      { id: "otro_egreso", label: "Otro egreso" },
    ];
    openModal(sentido === "ingreso" ? "Registrar ingreso" : "Registrar egreso", "Caja",
      '<form id="ent-form" class="if-form" data-kind="caja"><div class="form-grid">' +
        field("tipo", "Tipo", "select", "", { options: sentido === "ingreso" ? tiposIn : tiposOut }) +
        field("monto", "Monto S/", "number", "", { required: true, step: "0.01", min: 0.01 }) +
        field("fecha", "Fecha", "date", today(), { required: true }) +
        field("descripcion", "Descripción", "textarea", "") +
        '<input type="hidden" name="sentido" value="' +
        esc(sentido) +
        '" /></div><div class="form-actions"><button type="button" class="tool-btn" data-act="modal-close">Cancelar</button><button type="submit" class="tool-btn tool-btn-dark">Guardar</button></div></form>'
    );
  }
  function invForm(row) {
    row = row || {};
    openModal(row.id ? "Editar inversionista" : "Registrar inversionista", "Capital de terceros",
      '<form id="ent-form" class="if-form" data-kind="inv" data-id="' +
        esc(row.id || "") +
        '"><p class="if-legal">Registrar inversionistas no equivale a autorización para captar dinero del público.</p><div class="form-grid">' +
        field("dni", "DNI", "text", row.dni, { required: true, maxlength: 8 }) +
        field("nombres", "Nombres", "text", row.nombres, { required: true }) +
        field("apellidos", "Apellidos", "text", row.apellidos, { required: true }) +
        field("celular", "Celular", "tel", row.celular) +
        field("direccion", "Dirección", "text", row.direccion) +
        field("fechaIncorporacion", "Fecha de incorporación", "date", row.fechaIncorporacion || today()) +
        (row.id ? "" : field("montoAportado", "Monto del primer aporte S/", "number", "", { step: "0.01" })) +
        (row.id ? "" : field("fechaAporte", "Fecha del aporte", "date", today())) +
        field("modalidad", "Modalidad", "select", row.modalidad || "fija", {
          options: [
            { id: "fija", label: "Rentabilidad fija acordada" },
            { id: "utilidades", label: "Participación en utilidades netas" },
          ],
        }) +
        field("porcentaje", "% acordado", "number", row.porcentaje || "", { step: "0.01" }) +
        field("montoAcordado", "Monto fijo por periodo S/", "number", row.montoAcordado || "", { step: "0.01" }) +
        field("frecuenciaLiquidacion", "Frecuencia de liquidación", "select", row.frecuenciaLiquidacion || "mensual", {
          options: [
            { id: "mensual", label: "Mensual" },
            { id: "quincenal", label: "Quincenal" },
            { id: "semanal", label: "Semanal" },
          ],
        }) +
        field("fechaVencimiento", "Vencimiento del acuerdo", "date", row.fechaVencimiento) +
        field("estado", "Estado", "select", row.estado || "activo", { options: ["activo", "inactivo"] }) +
        '</div><div class="form-actions"><button type="button" class="tool-btn" data-act="modal-close">Cancelar</button><button type="submit" class="tool-btn tool-btn-dark">Guardar</button></div></form>'
    );
  }
  function showHistorial(id) {
    var res = E.dispatch("clienteHistorial", db, { id: id });
    if (!res.ok) return swalErr(res.message);
    var h = res.data;
    openModal("Historial del cliente", person(h.cliente),
      '<div class="if-hist"><p class="muted">DNI ' +
        esc(h.cliente.dni) +
        " · " +
        esc(h.cliente.celular || "sin celular") +
        "</p><h3>Préstamos</h3>" +
        table(
          [
            { key: "codigo", label: "Código" },
            { key: "capital", label: "Capital" },
            { key: "estado", label: "Estado", html: true },
            { key: "saldo", label: "Saldo" },
          ],
          h.prestamos.map(function (p) {
            return { codigo: p.codigo, capital: sol(p.capital), estado: badge(p.estado), saldo: sol(E.prestamoSaldo(db, p.id)) };
          })
        ) +
        "<h3>Avales</h3>" +
        (h.avales.length
          ? "<ul class=\"if-list\">" +
            h.avales
              .map(function (a) {
                return "<li>" + esc(person(a)) + " · DNI " + esc(a.dni) + "</li>";
              })
              .join("") +
            "</ul>"
          : empty("Sin avales.")) +
        "</div>"
    );
  }
  function showCronograma(id) {
    var p = E.find(db.prestamos, id);
    if (!p) return;
    var cuotas = db.cuotas
      .filter(function (c) {
        return c.prestamoId === p.id;
      })
      .sort(function (a, b) {
        return a.nro - b.nro;
      });
    openModal(p.codigo, person(clienteOf(p.clienteId)),
      "<p class=\"muted\">" +
        esc(sol(p.capital)) +
        " · tasa " +
        esc(p.tasa) +
        "% · " +
        esc(p.frecuencia) +
        " · " +
        esc(p.tipoTasa) +
        "</p>" +
        table(
          [
            { key: "nro", label: "N°" },
            { key: "fecha", label: "Vence" },
            { key: "monto", label: "Cuota" },
            { key: "pagado", label: "Pagado" },
            { key: "saldo", label: "Saldo" },
            { key: "est", label: "Estado", html: true },
          ],
          cuotas.map(function (c) {
            return {
              nro: c.nro,
              fecha: c.fechaVencimiento,
              monto: sol(c.monto),
              pagado: sol(c.pagado || 0),
              saldo: sol(E.cuotaSaldo(c)),
              est: badge(c.estado),
            };
          })
        )
    );
  }
  function showComprobante(id) {
    var c = E.find(db.cobranzas, id);
    if (!c) return;
    var p = E.find(db.prestamos, c.prestamoId) || {};
    openModal("Comprobante de pago", c.codigo,
      '<div class="if-recibo"><img src="JL.jpeg" alt="Impulsa Financiera" /><p><strong>' +
        esc(person(clienteOf(c.clienteId))) +
        "</strong></p><p>Préstamo " +
        esc(p.codigo || "") +
        "</p><div class=\"if-plan-kpis\"><div><span>Importe</span><b>" +
        esc(sol(c.importe)) +
        "</b></div><div><span>Capital</span><b>" +
        esc(sol(c.capitalAmortizado)) +
        "</b></div><div><span>Interés</span><b>" +
        esc(sol(c.interesCobrado)) +
        "</b></div></div><p class=\"muted\">Saldo pendiente " +
        esc(sol(c.saldoPendiente)) +
        " · " +
        esc(c.fecha) +
        " " +
        esc(c.hora || "") +
        " · " +
        esc(c.usuario || "") +
        '</p><button type="button" class="tool-btn tool-btn-dark" data-act="recibo-print">Imprimir / PDF</button></div>'
    );
  }
  function showInv(id) {
    var res = E.dispatch("inversionistaEstado", db, { id: id });
    if (!res.ok) return swalErr(res.message);
    var d = res.data;
    openModal("Estado de cuenta", person(d.inversionista),
      '<div class="if-hist"><div class="if-plan-kpis"><div><span>Capital vigente</span><b>' +
        esc(sol(d.capitalVigente)) +
        "</b></div><div><span>Ganancias pagadas</span><b>" +
        esc(sol(d.gananciasPagadas)) +
        "</b></div><div><span>Pendiente</span><b>" +
        esc(sol(d.gananciasPendientes)) +
        "</b></div><div><span>Estimado del periodo</span><b>" +
        esc(sol(d.gananciaEstimada)) +
        "</b></div></div><p class=\"muted\">Estimado según el acuerdo. No es una rentabilidad garantizada.</p>" +
        '<div class="form-actions"><button type="button" class="tool-btn" data-act="inv-aporte" data-id="' +
        esc(id) +
        '">Aporte</button><button type="button" class="tool-btn" data-act="inv-dev" data-id="' +
        esc(id) +
        '">Devolver capital</button><button type="button" class="tool-btn tool-btn-dark" data-act="inv-liq" data-id="' +
        esc(id) +
        '">Generar liquidación</button></div>' +
        "<h3>Aportes</h3>" +
        table(
          [
            { key: "fecha", label: "Fecha" },
            { key: "tipo", label: "Tipo" },
            { key: "monto", label: "Monto" },
          ],
          d.aportes.map(function (a) {
            return { fecha: a.fecha, tipo: a.tipo, monto: sol(a.monto) };
          })
        ) +
        "<h3>Liquidaciones</h3>" +
        table(
          [
            { key: "fecha", label: "Fecha" },
            { key: "monto", label: "Monto" },
            { key: "estado", label: "Estado", html: true },
            { key: "act", label: "", html: true },
          ],
          d.liquidaciones.map(function (l) {
            return {
              fecha: l.fecha,
              monto: sol(l.monto),
              estado: badge(l.estado),
              act:
                l.estado === "pendiente"
                  ? '<button type="button" class="tool-btn" data-act="inv-pagar" data-id="' + esc(l.id) + '">Pagar</button>'
                  : "",
            };
          })
        ) +
        "</div>"
    );
  }

  function handleSubmit(form) {
    var kind = form.getAttribute("data-kind");
    var data = formVal(form);
    if (form.id) data.id = form.getAttribute("data-id") || "";
    var action = {
      cliente: "saveCliente",
      aval: "saveAval",
      prestamo: "savePrestamo",
      pago: "registrarPago",
      caja: "registrarMovimiento",
      inv: "saveInversionista",
    }[kind];
    if (!action) return;
    var btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    run(action, data)
      .then(function (res) {
        closeModal();
        ui.page = 1;
        paint();
        var msg = {
          cliente: "Cliente guardado correctamente.",
          aval: "Aval registrado correctamente.",
          prestamo: "Préstamo desembolsado. El cronograma ya quedó fijo.",
          pago: "Cobranza registrada. Revise el comprobante.",
          caja: "Movimiento de caja registrado.",
          inv: "Inversionista guardado. El capital y las ganancias se llevan por separado.",
        }[kind] || "Operación registrada.";
        swalOk("Listo", msg).then(function () {
          if (kind === "pago" && res && res.data) showComprobante(res.data.id);
        });
      })
      .catch(actErr)
      .then(function () {
        if (btn) btn.disabled = false;
      });
  }

  function exportPack(tipo) {
    var titles = {
      clientes: "Registro de clientes",
      prestamos: "Préstamos otorgados",
      prestamos_otorgados: "Préstamos otorgados",
      prestamos_cancelados: "Préstamos cancelados",
      prestamos_pendientes: "Préstamos pendientes",
      cobranzas: "Cobranzas realizadas",
      cuotas_vencidas: "Cuotas vencidas",
      intereses: "Intereses efectivamente cobrados",
      gastos: "Gastos administrativos",
      ganancias: "Liquidaciones de ganancias",
      caja: "Movimientos de caja",
      capital: "Estado de capital",
      inversionistas: "Estado de cuenta de inversionistas",
    };
    var res = E.dispatch("reporte", db, { tipo: tipo, from: ui.from, to: ui.to });
    var raw = (res.data && res.data.rows) || [];
    var rows = [];
    var cols = [];
    if (tipo === "clientes") {
      cols = [
        { key: "dni", label: "DNI", width: 14 },
        { key: "apellidos", label: "Apellidos", width: 22 },
        { key: "nombres", label: "Nombres", width: 22 },
        { key: "celular", label: "Celular", width: 14 },
        { key: "direccion", label: "Dirección", width: 28 },
        { key: "estado", label: "Estado", width: 12 },
      ];
      rows = raw.map(function (c) {
        return { dni: c.dni, apellidos: c.apellidos, nombres: c.nombres, celular: c.celular || "", direccion: c.direccion || "", estado: c.estado };
      });
    } else if (tipo.indexOf("prestamo") === 0) {
      cols = [
        { key: "codigo", label: "Código", width: 20 },
        { key: "cliente", label: "Cliente", width: 26 },
        { key: "dni", label: "DNI", width: 12 },
        { key: "capital", label: "Capital (S/)", width: 14, num: true },
        { key: "tasa", label: "Tasa %", width: 10, num: true },
        { key: "cuotas", label: "Cuotas", width: 10, num: true },
        { key: "desembolso", label: "Desembolso", width: 14 },
        { key: "saldo", label: "Saldo (S/)", width: 14, num: true },
        { key: "estado", label: "Estado", width: 12 },
      ];
      rows = raw.map(function (p) {
        var c = clienteOf(p.clienteId);
        return {
          codigo: p.codigo,
          cliente: person(c),
          dni: c.dni || "",
          capital: p.capital,
          tasa: p.tasa,
          cuotas: p.nCuotas,
          desembolso: p.fechaDesembolso,
          saldo: E.prestamoSaldo(db, p.id),
          estado: p.estado,
        };
      });
    } else if (tipo === "cobranzas" || tipo === "intereses") {
      cols = [
        { key: "codigo", label: "Operación", width: 20 },
        { key: "fecha", label: "Fecha", width: 12 },
        { key: "cliente", label: "Cliente", width: 24 },
        { key: "importe", label: "Importe (S/)", width: 14, num: true },
        { key: "capital", label: "Capital (S/)", width: 14, num: true },
        { key: "interes", label: "Interés (S/)", width: 14, num: true },
        { key: "saldo", label: "Saldo (S/)", width: 14, num: true },
      ];
      rows = raw.map(function (c) {
        return {
          codigo: c.codigo,
          fecha: c.fecha,
          cliente: person(clienteOf(c.clienteId)),
          importe: c.importe,
          capital: c.capitalAmortizado,
          interes: c.interesCobrado,
          saldo: c.saldoPendiente,
        };
      });
    } else if (tipo === "cuotas_vencidas") {
      cols = [
        { key: "prestamo", label: "Préstamo", width: 20 },
        { key: "cliente", label: "Cliente", width: 24 },
        { key: "nro", label: "Cuota", width: 10, num: true },
        { key: "vence", label: "Vencimiento", width: 14 },
        { key: "monto", label: "Monto (S/)", width: 14, num: true },
        { key: "saldo", label: "Saldo (S/)", width: 14, num: true },
      ];
      rows = raw.map(function (c) {
        var p = E.find(db.prestamos, c.prestamoId) || {};
        return {
          prestamo: p.codigo || "",
          cliente: person(clienteOf(p.clienteId)),
          nro: c.nro,
          vence: c.fechaVencimiento,
          monto: c.monto,
          saldo: E.cuotaSaldo(c),
        };
      });
    } else if (tipo === "inversionistas") {
      cols = [
        { key: "dni", label: "DNI", width: 12 },
        { key: "nombre", label: "Inversionista", width: 26 },
        { key: "modalidad", label: "Modalidad", width: 16 },
        { key: "capital", label: "Capital vigente (S/)", width: 18, num: true },
        { key: "estado", label: "Estado", width: 12 },
      ];
      rows = raw.map(function (i) {
        return { dni: i.dni, nombre: person(i), modalidad: i.modalidad, capital: E.inversionistaCapital(db, i.id), estado: i.estado };
      });
    } else {
      cols = [
        { key: "fecha", label: "Fecha", width: 14 },
        { key: "tipo", label: "Tipo", width: 18 },
        { key: "descripcion", label: "Detalle", width: 32 },
        { key: "sentido", label: "Sentido", width: 12 },
        { key: "monto", label: "Monto (S/)", width: 14, num: true },
      ];
      rows = raw.map(function (m) {
        return { fecha: m.fecha || m.createdAt, tipo: m.tipo, descripcion: m.descripcion || "", sentido: m.sentido || m.estado || "", monto: m.monto };
      });
    }
    return {
      title: "IMPULSA FINANCIERA",
      subtitle: (titles[tipo] || "Reporte") + " · " + today() + " · Uso interno",
      sheet: (titles[tipo] || "Reporte").slice(0, 31),
      columns: cols,
      rows: rows,
    };
  }

  function exportRows(kind) {
    var tipo = ui.report || "cobranzas";
    var pack = exportPack(tipo);
    if (!pack.rows.length) {
      swalInfo("Sin datos", "No hay registros para el filtro elegido.");
      return;
    }
    var meta = { title: pack.title, subtitle: pack.subtitle, sheet: pack.sheet, columns: pack.columns };
    var blob = kind === "pdf" ? root.ImpulsaReport.pdf(pack.rows, meta) : root.ImpulsaReport.xlsx(pack.rows, meta);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Impulsa-Financiera-" + tipo + "-" + today() + (kind === "pdf" ? ".pdf" : ".xlsx");
    a.click();
    toast(kind === "pdf" ? "PDF generado." : "Excel formal generado.");
  }

  function onAct(act, el) {
    var id = el.getAttribute("data-id") || "";
    if (act === "page") {
      ui.page = Number(el.getAttribute("data-page") || 1) || 1;
      paint();
      return;
    }
    if (act === "modal-close") return closeModal();
    if (act === "cliente-new") return clienteForm();
    if (act === "cliente-edit") return clienteForm(E.find(db.clientes, id));
    if (act === "cliente-hist") return showHistorial(id);
    if (act === "aval-new") return avalForm();
    if (act === "aval-edit") return avalForm(E.find(db.avales, id));
    if (act === "prestamo-new") {
      if (E.cajaSaldo(db) <= 0) {
        swalInfo("Caja sin capital", "Registre primero un aporte de capital en Caja. Sin saldo no se puede desembolsar un préstamo.");
        return;
      }
      return prestamoForm();
    }
    if (act === "prestamo-ver") return showCronograma(id);
    if (act === "pago-new") return pagoForm();
    if (act === "pago-ver") return showComprobante(id);
    if (act === "pago-anular") {
      return ask({
        title: "Anular cobranza",
        text: "No se borra el registro: queda anulado en auditoría y se revierten cuotas y caja.",
        ok: "Anular",
        danger: true,
        icon: "warning",
      }).then(function (ok) {
        if (!ok) return;
        run("anularPago", { id: id })
          .then(function () {
            swalOk("Cobranza anulada", "El movimiento quedó en auditoría y las cuotas se reabrieron.");
            paint();
          })
          .catch(actErr);
      });
    }
    if (act === "caja-in") return cajaForm("ingreso");
    if (act === "caja-out") return cajaForm("egreso");
    if (act === "caja-anular") {
      return ask({
        title: "Anular movimiento",
        text: "El registro permanece. Solo cambia a anulado y se actualiza el saldo de caja.",
        ok: "Anular",
        danger: true,
        icon: "warning",
      }).then(function (ok) {
        if (!ok) return;
        run("anularMovimiento", { id: id })
          .then(function () {
            swalOk("Movimiento anulado", "El saldo de caja se actualizó. El registro sigue visible para auditoría.");
            paint();
          })
          .catch(actErr);
      });
    }
    if (act === "inv-new") return invForm();
    if (act === "inv-edit") return invForm(E.find(db.inversionistas, id));
    if (act === "inv-ver") return showInv(id);
    if (act === "inv-aporte" || act === "inv-dev") {
      var tipo = act === "inv-dev" ? "devolucion_inversionista" : "aporte_inversionista";
      openModal(act === "inv-dev" ? "Devolver capital" : "Registrar aporte", "Inversionista",
        '<form id="aporte-form" class="if-form" data-inv="' +
          esc(id) +
          '" data-tipo="' +
          esc(tipo) +
          '"><div class="form-grid">' +
          field("monto", "Monto S/", "number", "", { required: true, step: "0.01" }) +
          field("fecha", "Fecha", "date", today(), { required: true }) +
          '</div><div class="form-actions"><button type="submit" class="tool-btn tool-btn-dark">Guardar</button></div></form>'
      );
      return;
    }
    if (act === "inv-liq") {
      return ask({
        title: "Generar liquidación",
        text: "Se calcula según el acuerdo. No es una rentabilidad garantizada. Revise el monto antes de pagarla.",
        ok: "Generar",
        icon: "info",
      }).then(function (ok) {
        if (!ok) return;
        return run("generarLiquidacion", { inversionistaId: id })
          .then(function () {
            swalOk("Liquidación lista", "Revise el estado de cuenta y pague solo si el monto es correcto.");
            paint();
            showInv(id);
          })
          .catch(actErr);
      });
    }
    if (act === "inv-pagar") {
      return ask({
        title: "Pagar ganancia",
        text: "Se descontará de caja y quedará registrada como ganancia pagada, no como capital.",
        ok: "Pagar",
        icon: "question",
      }).then(function (ok) {
        if (!ok) return;
        return run("pagarLiquidacion", { id: id })
          .then(function () {
            swalOk("Ganancia pagada", "El capital del inversionista no cambia. Solo se registró la utilidad acordada.");
            paint();
          })
          .catch(actErr);
      });
    }
    if (act === "rep-run") {
      ui.report = ($("rep-tipo") && $("rep-tipo").value) || "cobranzas";
      ui.from = ($("rep-from") && $("rep-from").value) || "";
      ui.to = ($("rep-to") && $("rep-to").value) || "";
      ui.page = 1;
      paint();
      return;
    }
    if (act === "export-xlsx") return exportRows("xlsx");
    if (act === "export-pdf") return exportRows("pdf");
    if (act === "recibo-print") {
      root.print();
      return;
    }
  }

  function closeMenu() {
    var sidebar = $("sidebar");
    var backdrop = $("backdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("show");
  }
  function closeHelloMenu() {
    var menu = $("hello-menu");
    var btn = $("hello-btn");
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function closeNotices() {
    var panel = $("notice-panel");
    var btn = $("notice-btn");
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function logoutPanel() {
    closeHelloMenu();
    closeMenu();
    closeModal();
    try {
      sessionStorage.removeItem(PANEL_KEY);
    } catch (err) {}
    session = null;
    showPanelLogin();
  }
  function panelOpen() {
    try {
      var raw = sessionStorage.getItem(PANEL_KEY);
      if (!raw) return false;
      session = JSON.parse(raw);
      return !!(session && session.id);
    } catch (err) {
      return false;
    }
  }
  function showPanelLogin() {
    if ($("panel-login")) return;
    var first = !(db && db.usuarios && db.usuarios.length);
    var gate = document.createElement("div");
    gate.id = "panel-login";
    gate.className = "panel-login";
    gate.innerHTML =
      '<form class="panel-login-card" id="panel-login-form" autocomplete="off">' +
      '<img class="panel-login-brand" src="JL.jpeg" alt="Impulsa Financiera" />' +
      '<p class="panel-login-kicker">Impulsa Financiera</p>' +
      "<h1>" +
      (first ? "Crear acceso" : "Iniciar sesión") +
      "</h1>" +
      '<p class="panel-login-lead">' +
      (first
        ? "Defina el usuario y la clave del administrador. No use una clave corta."
        : "Acceso al panel de préstamos, cobranzas y capital.") +
      "</p>" +
      (first
        ? '<label>Nombre<input id="panel-nombre" name="nombre" required value="Administrador" /></label>'
        : "") +
      '<label>Usuario<input id="panel-user" name="usuario" required autocomplete="username" /></label>' +
      '<label>Clave<input id="panel-pass" type="password" name="clave" required autocomplete="current-password" /></label>' +
      '<p class="panel-login-err" id="panel-login-err" hidden></p>' +
      '<button type="submit" id="panel-login-btn"><span class="panel-login-spin" id="panel-login-spin" hidden></span><span id="panel-login-label">' +
      (first ? "Crear y entrar" : "Iniciar sesión") +
      "</span></button></form>";
    document.body.appendChild(gate);
    $("panel-login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("panel-login-err");
      var btn = $("panel-login-btn");
      var spin = $("panel-login-spin");
      var label = $("panel-login-label");
      var payload = {
        usuario: $("panel-user").value,
        clave: $("panel-pass").value,
        nombre: $("panel-nombre") ? $("panel-nombre").value : "",
      };
      btn.disabled = true;
      spin.hidden = false;
      err.hidden = true;
      var action = first ? "setupAdmin" : "login";
      run(action, payload)
        .then(function (res) {
          session = res.data;
          try {
            sessionStorage.setItem(PANEL_KEY, JSON.stringify(session));
          } catch (ignore) {}
          gate.remove();
          var next = first
            ? swalOk("Acceso creado", "Ya puede operar clientes, préstamos, cobranzas y caja.")
            : toast("Bienvenido.");
          return Promise.resolve(next).then(function () {
            if (booted) paint();
            else boot();
          });
        })
        .catch(function (e2) {
          var msg = (e2 && e2.message) || "No se pudo ingresar.";
          err.hidden = false;
          err.textContent = msg;
          swalErr(msg);
          btn.disabled = false;
          spin.hidden = true;
          label.textContent = first ? "Crear y entrar" : "Iniciar sesión";
        });
    });
    root.setTimeout(function () {
      var u = $("panel-user");
      if (u) u.focus();
    }, 30);
  }

  function boot() {
    if (booted) return;
    if (!panelOpen()) {
      showPanelLogin();
      return;
    }
    booted = true;
    if (location.protocol === "file:") {
      var fileWarn = $("file-warn");
      if (fileWarn) {
        fileWarn.hidden = false;
        fileWarn.classList.add("open", "is-err");
      }
    }
    if (!location.hash) location.hash = "#/dashboard";
    var search = $("q");
    var searchTimer = 0;
    if (search) {
      search.addEventListener("input", function () {
        ui.page = 1;
        root.clearTimeout(searchTimer);
        searchTimer = root.setTimeout(paint, 220);
      });
    }
    $("menu").addEventListener("click", function () {
      $("sidebar").classList.toggle("open");
      $("backdrop").classList.toggle("show");
    });
    $("backdrop").addEventListener("click", closeMenu);
    $("notice-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      var panel = $("notice-panel");
      panel.hidden = !panel.hidden;
      $("notice-btn").setAttribute("aria-expanded", panel.hidden ? "false" : "true");
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".notice")) closeNotices();
      if (!e.target.closest(".hello-wrap")) closeHelloMenu();
    });
    $("hello-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      var menu = $("hello-menu");
      var open = menu.hidden;
      closeNotices();
      menu.hidden = !open;
      $("hello-btn").setAttribute("aria-expanded", open ? "true" : "false");
    });
    $("logout-btn").addEventListener("click", function () {
      ask({
        title: "Cerrar sesión",
        text: "Saldrá del panel. Los datos quedan en este dispositivo.",
        ok: "Salir",
        icon: "question",
      }).then(function (ok) {
        if (ok) logoutPanel();
      });
    });
    $("moves-eye").addEventListener("click", function () {
      movesPage = 1;
      paintMoves();
      $("moves-modal").classList.add("open");
      document.body.style.overflow = "hidden";
      closeMenu();
    });
    $("moves-close").addEventListener("click", function () {
      $("moves-modal").classList.remove("open");
      document.body.style.overflow = "";
    });
    $("moves-modal").addEventListener("click", function (e) {
      if (e.target.id === "moves-modal") {
        $("moves-modal").classList.remove("open");
        document.body.style.overflow = "";
      }
      var btn = e.target.closest("[data-moves-page]");
      if (btn && !btn.disabled) {
        movesPage = Number(btn.getAttribute("data-moves-page"));
        paintMoves();
      }
    });
    $("form-close").addEventListener("click", closeModal);
    $("form-modal").addEventListener("click", function (e) {
      if (e.target.id === "form-modal") closeModal();
    });
    $("refresh-btn").addEventListener("click", function () {
      reload().then(function () {
        paint();
        toast("Datos actualizados.");
      }).catch(actErr);
    });
    $("api-retry").addEventListener("click", function () {
      reload().then(paint);
    });
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act], a[data-act]");
      if (!btn) return;
      if (btn.tagName === "BUTTON" && btn.type === "submit") return;
      e.preventDefault();
      onAct(btn.getAttribute("data-act"), btn);
    });
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (form.id === "cfg-form") {
        e.preventDefault();
        run("saveConfig", formVal(form)).then(function () {
          swalOk("Configuración guardada", "Las tasas nuevas no cambian préstamos ya desembolsados.");
          paint();
        }).catch(actErr);
        return;
      }
      if (form.id === "pass-form") {
        e.preventDefault();
        run("changePassword", formVal(form)).then(function () {
          swalOk("Clave actualizada", "Use la nueva clave en el próximo ingreso.");
          form.reset();
        }).catch(actErr);
        return;
      }
      if (form.id === "aporte-form") {
        e.preventDefault();
        var payload = formVal(form);
        payload.inversionistaId = form.getAttribute("data-inv");
        payload.tipo = form.getAttribute("data-tipo");
        run("registrarAporte", payload)
          .then(function () {
            var invId = payload.inversionistaId;
            closeModal();
            swalOk("Capital actualizado", payload.tipo === "devolucion_inversionista" ? "Se devolvió capital. No se registró como ganancia." : "El aporte quedó en caja, separado de las ganancias.");
            paint();
            showInv(invId);
          })
          .catch(actErr);
        return;
      }
      if (form.id === "ent-form" || form.id === "loan-form" || form.id === "pay-form") {
        e.preventDefault();
        handleSubmit(form);
      }
    });
    document.addEventListener("input", function (e) {
      if (e.target.closest("#loan-form")) refreshLoanPreview();
    });
    document.addEventListener("change", function (e) {
      if (e.target.closest("#loan-form")) {
        if (e.target.name === "clienteId") {
          var sel = document.querySelector('#loan-form select[name="avalId"]');
          if (sel) {
            var cur = sel.value;
            sel.innerHTML = avalesOpts(e.target.value)
              .map(function (o) {
                return '<option value="' + esc(o.id) + '"' + (o.id === cur ? " selected" : "") + ">" + esc(o.label) + "</option>";
              })
              .join("");
          }
        }
        refreshLoanPreview();
      }
      if (e.target.closest("#pay-form") && e.target.name === "prestamoId") refreshPayInfo();
      if (e.target.id === "rep-tipo") ui.report = e.target.value;
    });
    root.addEventListener("hashchange", function () {
      ui.page = 1;
      closeMenu();
      closeModal();
      paint();
    });
    paint();
    if (root.navigator && "serviceWorker" in root.navigator && location.protocol !== "file:") {
      root.navigator.serviceWorker.register("./sw.js").catch(function () {});
    }
  }

  function start() {
    reload().then(function () {
      if (!panelOpen()) showPanelLogin();
      else boot();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(typeof window !== "undefined" ? window : globalThis);
