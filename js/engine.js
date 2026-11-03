/* Motor financiero de Impulsa Financiera. Cálculos, validaciones e integridad. */
(function (root) {
  var TABLES = [
    "clientes",
    "avales",
    "prestamos",
    "cuotas",
    "cobranzas",
    "inversionistas",
    "aportes",
    "movimientosCaja",
    "liquidaciones",
    "historialPrestamos",
    "usuarios",
    "configuracion",
    "auditoria",
  ];
  var MSG = {
    dni_invalido: "El DNI debe tener 8 dígitos.",
    dni_duplicado: "Ya existe un cliente con ese DNI.",
    dni_aval_duplicado: "Ese aval ya está registrado para este cliente.",
    nombre_invalido: "Escriba nombres y apellidos.",
    celular_invalido: "El celular no es válido.",
    correo_invalido: "Escriba un correo electrónico válido.",
    cliente_invalido: "No se encontró el cliente.",
    aval_invalido: "No se encontró el aval.",
    prestamo_invalido: "No se encontró el préstamo.",
    capital_invalido: "El capital debe ser mayor a cero.",
    tasa_invalida: "La tasa no es válida.",
    cuotas_invalido: "El número de cuotas debe ser de 1 a 120.",
    fecha_invalida: "La fecha no es válida.",
    caja_insuficiente: "No hay capital disponible para este desembolso.",
    importe_invalido: "El importe debe ser mayor a cero.",
    importe_excede_saldo: "El importe supera el saldo pendiente del préstamo.",
    pago_duplicado: "Ese pago ya fue registrado. Evite duplicarlo.",
    prestamo_cancelado: "El préstamo ya está cancelado.",
    prestamo_bloqueado: "No se pueden cambiar las condiciones de un préstamo con pagos.",
    inversionista_invalido: "No se encontró el inversionista.",
    inversionista_dni: "Ya existe un inversionista con ese DNI.",
    movimiento_invalido: "No se encontró el movimiento.",
    movimiento_anulado: "Ese movimiento ya está anulado.",
    liquidacion_invalida: "No se encontró la liquidación.",
    clave_invalida: "Usuario o clave incorrectos.",
    clave_corta: "La clave debe tener al menos 6 caracteres.",
    permiso_denegado: "No tiene permiso para esta operación.",
    sesion_invalida: "Inicie sesión para continuar.",
    tabla_desconocida: "No se reconoció la consulta.",
    accion_desconocida: "El servidor no reconoció la petición.",
    dato_requerido: "Complete los datos obligatorios.",
    clave_fija: "El acceso del administrador es fijo y no se cambia.",
    cliente_con_prestamos: "No se puede quitar: el cliente ya tiene préstamos.",
    aval_en_uso: "No se puede quitar: el aval está ligado a un préstamo.",
    inversionista_con_capital: "No se puede quitar: el inversionista tiene capital o historial.",
  };
  var ADMIN_USER = "Administrador";
  var ADMIN_CLAVE = "luismario2026";

  function money(n) {
    var x = Number(n);
    if (!isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }
  function pad(n) {
    n = Number(n) || 0;
    return n < 10 ? "0" + n : String(n);
  }
  function stampMs(s) {
    if (Object.prototype.toString.call(s) === "[object Date]") {
      return isNaN(s.getTime()) ? 0 : s.getTime();
    }
    var str = String(s || "").trim();
    if (!str) return 0;
    var pe = str.match(/^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (pe && Number(pe[1]) >= 1 && Number(pe[1]) <= 31 && Number(pe[2]) >= 1 && Number(pe[2]) <= 12) {
      return Date.UTC(Number(pe[3]), Number(pe[2]) - 1, Number(pe[1]), Number(pe[4] || 0) + 5, Number(pe[5] || 0), Number(pe[6] || 0));
    }
    var iso = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?)?/);
    if (iso) {
      if (/Z|[+-]\d{2}:?\d{2}$/.test(str)) {
        var parsed = Date.parse(str);
        return isNaN(parsed) ? 0 : parsed;
      }
      return Date.UTC(
        Number(iso[1]),
        Number(iso[2]) - 1,
        Number(iso[3]),
        Number(iso[4] || 0) + 5,
        Number(iso[5] || 0),
        Number(String(iso[6] || "0").split(".")[0])
      );
    }
    var t = Date.parse(str);
    return isNaN(t) ? 0 : t;
  }
  function asDate(d) {
    if (Object.prototype.toString.call(d) === "[object Date]" && !isNaN(d.getTime())) return d;
    var ms = stampMs(d);
    return ms ? new Date(ms) : new Date();
  }
  function limaDate(d) {
    var date = asDate(d);
    try {
      var p = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);
      var map = {};
      p.forEach(function (x) {
        map[x.type] = x.value;
      });
      if (map.year && map.month && map.day) return map.year + "-" + map.month + "-" + map.day;
    } catch (err) {}
    var fall = new Date(date.getTime() - 5 * 3600000);
    return fall.getUTCFullYear() + "-" + pad(fall.getUTCMonth() + 1) + "-" + pad(fall.getUTCDate());
  }
  function limaHms(d) {
    var date = asDate(d);
    try {
      var p = new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(date);
      var map = {};
      p.forEach(function (x) {
        map[x.type] = x.value;
      });
      if (map.hour != null && map.minute != null && map.second != null) {
        return pad(map.hour) + ":" + pad(map.minute) + ":" + pad(map.second);
      }
    } catch (err) {}
    var fall = new Date(date.getTime() - 5 * 3600000);
    return pad(fall.getUTCHours()) + ":" + pad(fall.getUTCMinutes()) + ":" + pad(fall.getUTCSeconds());
  }
  function limaTime(d) {
    return limaHms(d).slice(0, 5);
  }
  function limaStamp(d) {
    var ymd = limaDate(d);
    var p = ymd.split("-");
    return p[2] + "-" + p[1] + "-" + p[0] + " " + limaHms(d);
  }
  function nowIso() {
    return limaStamp();
  }
  function todayKey() {
    return limaDate(new Date());
  }
  function parseDay(s) {
    if (Object.prototype.toString.call(s) === "[object Date]" && !isNaN(s.getTime())) {
      return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    }
    var str = String(s || "").trim();
    if (!str) return null;
    var pe = str.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (pe && Number(pe[1]) <= 31 && Number(pe[2]) <= 12) {
      var dPe = new Date(Number(pe[3]), Number(pe[2]) - 1, Number(pe[1]));
      return isNaN(dPe.getTime()) ? null : dPe;
    }
    var iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      var dIso = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return isNaN(dIso.getTime()) ? null : dIso;
    }
    return null;
  }
  function dayFrom(s) {
    var d = parseDay(s);
    return d ? limaDate(d) : "";
  }
  function fechaKey(s) {
    return dayFrom(s) || todayKey();
  }
  function dayKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function addPeriod(dateStr, freq, n) {
    var d = parseDay(dateStr);
    if (!d) return dateStr;
    n = n || 0;
    if (freq === "diaria") d.setDate(d.getDate() + n);
    else if (freq === "semanal") d.setDate(d.getDate() + n * 7);
    else if (freq === "quincenal") d.setDate(d.getDate() + n * 15);
    else d.setMonth(d.getMonth() + n);
    return dayKey(d);
  }
  var UID_SEQ = 0;
  function idTaken(db, id) {
    if (!db || id == null || id === "") return false;
    var key = String(id);
    var t;
    for (t = 0; t < TABLES.length; t += 1) {
      var list = db[TABLES[t]] || [];
      var i;
      for (i = 0; i < list.length; i += 1) {
        if (list[i] && String(list[i].id) === key) return true;
      }
    }
    return false;
  }
  function uid(prefix, db) {
    UID_SEQ += 1;
    var n = 0;
    var id;
    do {
      var ymd = limaDate(new Date()).replace(/-/g, "");
      var hms = limaHms(new Date()).replace(/:/g, "");
      var rnd = (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8) +
        UID_SEQ.toString(36) +
        n.toString(36)
      )
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(-8);
      id = String(prefix || "X").toUpperCase() + "-" + ymd + "-" + hms + "-" + rnd;
      n += 1;
    } while (db && idTaken(db, id) && n < 12);
    return id;
  }
  function asStamp(s) {
    if (s == null || s === "") return "";
    var str = String(s).trim();
    var lima = str.match(/^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (lima && Number(lima[1]) >= 1 && Number(lima[1]) <= 31 && Number(lima[2]) >= 1 && Number(lima[2]) <= 12) {
      return lima[1] + "-" + lima[2] + "-" + lima[3] + " " + pad(lima[4] || 0) + ":" + pad(lima[5] || 0) + ":" + pad(lima[6] || 0);
    }
    var ms = stampMs(str);
    if (!ms) return limaStamp();
    return limaStamp(new Date(ms));
  }
  function digits(s, n) {
    var d = String(s || "").replace(/\D/g, "");
    return n ? d.slice(0, n) : d;
  }
  function isDni(s) {
    return /^\d{8}$/.test(digits(s, 8)) && digits(s, 8).length === 8;
  }
  function isPhone(s) {
    var d = digits(s);
    return d.length >= 6 && d.length <= 15;
  }
  function isEmail(s) {
    var e = asEmail(s);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }
  function asUpper(s) {
    return String(s || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("es-PE");
  }
  function asEmail(s) {
    return String(s || "").replace(/\s+/g, "").trim().toLowerCase();
  }
  function fold(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function fullName(row) {
    return String((row && (row.apellidos || "")) + " " + (row && (row.nombres || "")))
      .replace(/\s+/g, " ")
      .trim();
  }
  function fail(code, extra) {
    return { ok: false, error: code, message: MSG[code] || extra || "No se pudo completar." };
  }
  function ok(data, db) {
    return { ok: true, data: data, db: db };
  }
  function find(list, id) {
    if (id == null || id === "") return null;
    var key = String(id);
    var i;
    for (i = 0; i < (list || []).length; i += 1) {
      if (list[i] && String(list[i].id) === key) return list[i];
    }
    return null;
  }
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  function emptyDb() {
    var db = {};
    TABLES.forEach(function (t) {
      db[t] = [];
    });
    db.configuracion = [
      {
        id: "CFG",
        empresa: "Impulsa Financiera",
        moneda: "PEN",
        simbolo: "S/",
        tasaDefault: 10,
        tipoTasaDefault: "plana",
        frecuenciaDefault: "semanal",
        nCuotasDefault: 4,
        avisoLegal:
          "Registrar inversionistas no equivale a autorización para captar dinero del público. Las rentabilidades se calculan según el acuerdo y los resultados reales. No se presentan como garantizadas.",
      },
    ];
    return ensureAdmin(db);
  }
  function fixedAdmin() {
    return {
      id: "USR-ADMIN",
      usuario: ADMIN_USER,
      nombre: ADMIN_USER,
      rol: "admin",
      clave: ADMIN_CLAVE,
      estado: "activo",
      createdAt: "01-01-2026 00:00:00",
    };
  }
  function ensureAdmin(db) {
    db.usuarios = [fixedAdmin()];
    return db;
  }
  function stringifyIds(row) {
    if (!row || typeof row !== "object") return;
    ["id", "clienteId", "avalId", "prestamoId", "cuotaId", "inversionistaId", "origenId", "usuarioId", "entidadId"].forEach(function (k) {
      if (row[k] != null && row[k] !== "") row[k] = String(row[k]);
    });
    ["createdAt", "updatedAt", "anuladoAt"].forEach(function (k) {
      if (row[k] != null && row[k] !== "") row[k] = asStamp(row[k]);
    });
    if (row.dni != null && row.dni !== "") row.dni = digits(row.dni, 8);
    if (row.celular != null) row.celular = digits(row.celular);
    if (row.ref1Telefono != null) row.ref1Telefono = digits(row.ref1Telefono);
    ["nombres", "apellidos", "direccion", "parentesco", "ocupacion", "observaciones", "descripcion", "cliente"].forEach(function (k) {
      if (row[k] != null && row[k] !== "") row[k] = asUpper(row[k]);
    });
    if (row.correo != null && row.correo !== "") row.correo = asEmail(row.correo);
  }
  function normalizeDb(raw) {
    var db = emptyDb();
    if (!raw || typeof raw !== "object") return db;
    TABLES.forEach(function (t) {
      db[t] = Array.isArray(raw[t]) ? raw[t] : db[t];
      db[t].forEach(stringifyIds);
    });
    if (!db.configuracion.length) db.configuracion = emptyDb().configuracion;
    ensureAdmin(db);
    backfillHistorial(db);
    return db;
  }
  function maybeSeed(db) {
    db = ensureAdmin(db);
    var hasBiz =
      (db.clientes || []).length ||
      (db.inversionistas || []).length ||
      (db.movimientosCaja || []).length;
    if (hasBiz) return db;
    return seedDemo(db);
  }
  function seedDemo(db) {
    var now = "15-10-2026 10:00:00";
    var clientes = [
      { id: "CLI-S01", dni: "45678901", nombres: "María Elena", apellidos: "Quispe Rojas", celular: "987654321", ref1Telefono: "912345678", correo: "maria.quispe@correo.pe", direccion: "Jr. Lima 245, Piura" },
      { id: "CLI-S02", dni: "40231876", nombres: "José Antonio", apellidos: "Huamán Díaz", celular: "976543210", ref1Telefono: "923456789", correo: "jose.huaman@correo.pe", direccion: "Av. Grau 1180, Piura" },
      { id: "CLI-S03", dni: "43892105", nombres: "Rosa Isabel", apellidos: "Flores Paredes", celular: "965432109", ref1Telefono: "934567890", correo: "rosa.flores@correo.pe", direccion: "Urb. Santa Rosa Mz. B Lt. 8, Castilla" },
      { id: "CLI-S04", dni: "41567230", nombres: "Carlos Enrique", apellidos: "Vargas Soto", celular: "954321098", ref1Telefono: "945678901", correo: "carlos.vargas@correo.pe", direccion: "Calle Tacna 332, Sullana" },
      { id: "CLI-S05", dni: "46789012", nombres: "Lucía Fernanda", apellidos: "Ramos Chávez", celular: "943210987", ref1Telefono: "956789012", correo: "lucia.ramos@correo.pe", direccion: "Av. Sánchez Cerro 560, Piura" },
      { id: "CLI-S06", dni: "42345678", nombres: "Pedro Pablo", apellidos: "Mendoza Silva", celular: "932109876", ref1Telefono: "967890123", correo: "pedro.mendoza@correo.pe", direccion: "Jr. Ayacucho 90, Catacaos" },
      { id: "CLI-S07", dni: "45123098", nombres: "Ana Cecilia", apellidos: "Torres Guevara", celular: "921098765", ref1Telefono: "978901234", correo: "ana.torres@correo.pe", direccion: "Mz. C Lt. 14, Los Algarrobos, Piura" },
      { id: "CLI-S08", dni: "40987654", nombres: "Miguel Ángel", apellidos: "Castillo Ríos", celular: "910987654", ref1Telefono: "989012345", correo: "miguel.castillo@correo.pe", direccion: "Av. Vice 210, Sechura" },
      { id: "CLI-S09", dni: "47890123", nombres: "Patricia Elena", apellidos: "Salazar Núñez", celular: "909876543", ref1Telefono: "990123456", correo: "patricia.salazar@correo.pe", direccion: "Calle Comercio 45, Talara" },
      { id: "CLI-S10", dni: "43456789", nombres: "Jorge Luis", apellidos: "Paredes Cueva", celular: "998765432", ref1Telefono: "901234567", correo: "jorge.paredes@correo.pe", direccion: "Urb. El Chilcal Mz. A Lt. 3, Piura" },
    ];
    clientes.forEach(function (c) {
      if (find(db.clientes, c.id)) return;
      if ((db.clientes || []).some(function (row) { return row && row.dni === c.dni; })) return;
      db.clientes.push({
        id: c.id,
        dni: c.dni,
        nombres: c.nombres,
        apellidos: c.apellidos,
        fechaNacimiento: "",
        celular: c.celular,
        correo: c.correo || "",
        direccion: c.direccion,
        ocupacion: "",
        ref1Nombre: "",
        ref1Telefono: c.ref1Telefono,
        ref2Nombre: "",
        ref2Telefono: "",
        observaciones: "",
        estado: "activo",
        createdAt: now,
        updatedAt: now,
      });
    });
    var invs = [
      {
        id: "INV-S01",
        dni: "10293847",
        nombres: "Ricardo Alonso",
        apellidos: "Benavides López",
        celular: "999111222",
        direccion: "Av. Pardo 890, Miraflores",
        porcentaje: 5,
        montoAcordado: 0,
        aporteId: "APO-S01",
        movId: "MOV-S01",
        monto: 15000,
        fecha: "2026-10-02",
      },
      {
        id: "INV-S02",
        dni: "10938475",
        nombres: "Carmen Rosa",
        apellidos: "Delgado Vega",
        celular: "988222333",
        direccion: "Calle Los Pinos 12, Piura",
        porcentaje: 0,
        montoAcordado: 400,
        aporteId: "APO-S02",
        movId: "MOV-S02",
        monto: 25000,
        fecha: "2026-10-05",
      },
    ];
    invs.forEach(function (i) {
      if (!find(db.inversionistas, i.id) && !(db.inversionistas || []).some(function (row) { return row && row.dni === i.dni; })) {
        db.inversionistas.push({
          id: i.id,
          dni: i.dni,
          nombres: i.nombres,
          apellidos: i.apellidos,
          celular: i.celular,
          direccion: i.direccion,
          fechaIncorporacion: i.fecha,
          modalidad: "fija",
          porcentaje: i.porcentaje,
          montoAcordado: i.montoAcordado,
          frecuenciaLiquidacion: "mensual",
          fechaVencimiento: "",
          estado: "activo",
          createdAt: now,
          updatedAt: now,
        });
      }
      if (!find(db.aportes, i.aporteId)) {
        db.aportes.push({
          id: i.aporteId,
          inversionistaId: i.id,
          tipo: "aporte_inversionista",
          sentido: "ingreso",
          monto: i.monto,
          fecha: i.fecha,
          anulado: false,
          createdAt: now,
        });
      }
      if (!find(db.movimientosCaja, i.movId)) {
        db.movimientosCaja.push({
          id: i.movId,
          tipo: "aporte_inversionista",
          categoria: "aporte_inversionista",
          sentido: "ingreso",
          monto: i.monto,
          fecha: i.fecha,
          hora: "10:00:00",
          origenTipo: "aporte",
          origenId: i.aporteId,
          descripcion: "Aporte " + i.nombres + " " + i.apellidos,
          anulado: false,
          usuario: ADMIN_USER,
          usuarioId: "USR-ADMIN",
          createdAt: now,
        });
      }
    });
    return db;
  }
  function cfgOf(db) {
    var cfg = (db.configuracion && db.configuracion[0]) || emptyDb().configuracion[0];
    cfg.simbolo = "S/";
    cfg.moneda = "PEN";
    cfg.empresa = cfg.empresa || "Impulsa Financiera";
    if (!isFinite(Number(cfg.tasaDefault))) cfg.tasaDefault = 10;
    return cfg;
  }
  function audit(db, user, accion, entidad, entidadId, detalle) {
    db.auditoria.unshift({
      id: uid("AUD", db),
      accion: accion,
      entidad: entidad,
      entidadId: entidadId || "",
      usuario: (user && (user.nombre || user.usuario)) || "sistema",
      usuarioId: (user && user.id) || "",
      fecha: limaDate(),
      hora: limaTime(),
      detalle: String(detalle || "").slice(0, 240),
      createdAt: nowIso(),
    });
    if (db.auditoria.length > 2000) db.auditoria.length = 2000;
  }
  function nextCode(list, prefix, field) {
    var day = todayKey().replace(/-/g, "");
    var used = {};
    (list || []).forEach(function (row) {
      used[String(row[field || "codigo"] || "")] = true;
    });
    var n = 1;
    var code;
    do {
      code = prefix + "-" + day + "-" + ("000" + n).slice(-3);
      n += 1;
    } while (used[code] && n < 1000);
    return code;
  }

  function calcSchedule(input) {
    var capital = money(input.capital);
    var tasa = Number(input.tasa);
    var n = Math.round(Number(input.nCuotas));
    var tipo = String(input.tipoTasa || "plana");
    var freq = String(input.frecuencia || "semanal");
    var first = String(input.fechaPrimeraCuota || todayKey());
    if (!(capital > 0)) return fail("capital_invalido");
    if (!(tasa >= 0) || tasa > 1000) return fail("tasa_invalida");
    if (!(n >= 1) || n > 120) return fail("cuotas_invalido");
    if (!parseDay(first)) return fail("fecha_invalida");
    var cuotas = [];
    var totalInteres = 0;
    var totalDevolver = 0;
    var i;
    var rate = tasa / 100;
    if (tipo === "frances") {
      var pmt =
        rate === 0
          ? money(capital / n)
          : money((capital * (rate * Math.pow(1 + rate, n))) / (Math.pow(1 + rate, n) - 1));
      var saldo = capital;
      for (i = 1; i <= n; i += 1) {
        var interes = money(saldo * rate);
        var monto = i === n ? money(saldo + interes) : pmt;
        var cap = money(monto - interes);
        if (cap > saldo) cap = saldo;
        monto = money(cap + interes);
        cuotas.push({
          nro: i,
          fechaVencimiento: addPeriod(first, freq, i - 1),
          capital: cap,
          interes: interes,
          monto: monto,
        });
        saldo = money(saldo - cap);
        totalInteres = money(totalInteres + interes);
      }
    } else if (tipo === "periodo") {
      var capEq = money(capital / n);
      var intEq = money(capital * rate);
      var capAcc = 0;
      for (i = 1; i <= n; i += 1) {
        var capP = i === n ? money(capital - capAcc) : capEq;
        capAcc = money(capAcc + capP);
        var montoP = money(capP + intEq);
        cuotas.push({
          nro: i,
          fechaVencimiento: addPeriod(first, freq, i - 1),
          capital: capP,
          interes: intEq,
          monto: montoP,
        });
        totalInteres = money(totalInteres + intEq);
      }
    } else {
      totalInteres = money(capital * rate);
      var cuota = money((capital + totalInteres) / n);
      var capUnit = money(capital / n);
      var intUnit = money(totalInteres / n);
      var capSum = 0;
      var intSum = 0;
      for (i = 1; i <= n; i += 1) {
        var cCap = i === n ? money(capital - capSum) : capUnit;
        var cInt = i === n ? money(totalInteres - intSum) : intUnit;
        capSum = money(capSum + cCap);
        intSum = money(intSum + cInt);
        cuotas.push({
          nro: i,
          fechaVencimiento: addPeriod(first, freq, i - 1),
          capital: cCap,
          interes: cInt,
          monto: money(cCap + cInt),
        });
      }
    }
    totalDevolver = cuotas.reduce(function (a, c) {
      return money(a + c.monto);
    }, 0);
    totalInteres = cuotas.reduce(function (a, c) {
      return money(a + c.interes);
    }, 0);
    return ok({
      capital: capital,
      tasa: tasa,
      tipoTasa: tipo,
      frecuencia: freq,
      nCuotas: n,
      fechaPrimeraCuota: first,
      totalIntereses: totalInteres,
      totalDevolver: totalDevolver,
      valorCuota: cuotas[0] ? cuotas[0].monto : 0,
      cuotas: cuotas,
    });
  }

  function cuotaSaldo(c) {
    return money((c.monto || 0) - (c.pagado || 0));
  }
  function prestamoSaldo(db, prestamoId) {
    return (db.cuotas || [])
      .filter(function (c) {
        return c.prestamoId === prestamoId;
      })
      .reduce(function (a, c) {
        return money(a + cuotaSaldo(c));
      }, 0);
  }
  function prestamoCapitalPendiente(db, prestamoId) {
    return (db.cuotas || [])
      .filter(function (c) {
        return c.prestamoId === prestamoId;
      })
      .reduce(function (a, c) {
        return money(a + money((c.capital || 0) - (c.capitalPagado || 0)));
      }, 0);
  }
  function registrarCierreHistorial(db, prestamo, silent) {
    if (!db || !prestamo || !prestamo.id) return;
    db.historialPrestamos = db.historialPrestamos || [];
    var pid = String(prestamo.id);
    var i;
    for (i = 0; i < db.historialPrestamos.length; i += 1) {
      if (String(db.historialPrestamos[i].prestamoId) === pid) return;
    }
    var cli = find(db.clientes, prestamo.clienteId) || {};
    var pagado = (db.cobranzas || []).reduce(function (a, c) {
      if (!c || c.anulado || String(c.prestamoId) !== pid) return a;
      return money(a + Number(c.importe || 0));
    }, 0);
    db.historialPrestamos.unshift({
      id: "HIS-" + pid,
      clienteId: String(prestamo.clienteId || ""),
      prestamoId: pid,
      codigo: prestamo.codigo || "",
      dni: digits(cli.dni, 8),
      cliente: fullName(cli),
      capital: money(prestamo.capital),
      totalIntereses: money(prestamo.totalIntereses),
      totalPagado: pagado,
      nCuotas: prestamo.nCuotas,
      fechaDesembolso: prestamo.fechaDesembolso,
      fechaCierre: dayFrom(prestamo.updatedAt) || todayKey(),
      createdAt: asStamp(prestamo.updatedAt) || nowIso(),
    });
    if (!silent) {
      audit(db, { id: "USR-ADMIN", nombre: "Sistema" }, "cerrar", "prestamo", prestamo.id, fullName(cli) + " · Préstamo " + (prestamo.codigo || "") + " terminado");
    }
  }
  function quitarCierreHistorial(db, prestamoId) {
    if (!db) return;
    var pid = String(prestamoId || "");
    db.historialPrestamos = (db.historialPrestamos || []).filter(function (h) {
      return String(h.prestamoId) !== pid;
    });
  }
  function backfillHistorial(db) {
    if (!db) return db;
    db.historialPrestamos = db.historialPrestamos || [];
    (db.prestamos || []).forEach(function (p) {
      if (!p) return;
      if (p.estado === "cancelado") registrarCierreHistorial(db, p, true);
      else quitarCierreHistorial(db, p.id);
    });
    return db;
  }
  function refreshPrestamoEstado(db, prestamo) {
    if (!prestamo || prestamo.estado === "refinanciado") return;
    var today = todayKey();
    var pending = db.cuotas.filter(function (c) {
      return c.prestamoId === prestamo.id && cuotaSaldo(c) > 0.009;
    });
    if (!pending.length) {
      prestamo.estado = "cancelado";
      prestamo.updatedAt = nowIso();
      registrarCierreHistorial(db, prestamo);
      return;
    }
    quitarCierreHistorial(db, prestamo.id);
    var vencida = pending.some(function (c) {
      return String(c.fechaVencimiento || "") < today;
    });
    prestamo.estado = vencida ? "vencido" : "activo";
  }
  function cajaSaldo(db) {
    return (db.movimientosCaja || []).reduce(function (a, m) {
      if (!m || m.anulado) return a;
      if (m.sentido === "ingreso") return money(a + Number(m.monto || 0));
      return money(a - Number(m.monto || 0));
    }, 0);
  }
  function addCaja(db, user, payload) {
    var row = {
      id: uid("MOV", db),
      tipo: payload.tipo,
      categoria: payload.categoria || payload.tipo,
      sentido: payload.sentido,
      monto: money(payload.monto),
      fecha: fechaKey(payload.fecha),
      hora: limaTime(),
      origenTipo: payload.origenTipo || "",
      origenId: payload.origenId || "",
      descripcion: asUpper(payload.descripcion || ""),
      anulado: false,
      usuario: (user && (user.nombre || user.usuario)) || "",
      usuarioId: (user && user.id) || "",
      createdAt: nowIso(),
    };
    db.movimientosCaja.unshift(row);
    return row;
  }
  function sumAportes(db, tipo) {
    return (db.aportes || []).reduce(function (a, r) {
      if (!r || r.anulado) return a;
      if (tipo && r.tipo !== tipo) return a;
      var s = r.sentido === "egreso" ? -1 : 1;
      return money(a + s * Number(r.monto || 0));
    }, 0);
  }
  function capitalColocado(db) {
    return (db.prestamos || []).reduce(function (a, p) {
      if (!p || p.estado === "cancelado" || p.estado === "refinanciado") return a;
      return money(a + prestamoCapitalPendiente(db, p.id));
    }, 0);
  }
  function interesesCobrados(db, from, to) {
    return (db.cobranzas || []).reduce(function (a, c) {
      if (!c || c.anulado) return a;
      if (from && c.fecha < from) return a;
      if (to && c.fecha > to) return a;
      return money(a + Number(c.interesCobrado || 0));
    }, 0);
  }
  function gastosPeriodo(db, from, to) {
    return (db.movimientosCaja || []).reduce(function (a, m) {
      if (!m || m.anulado || m.sentido !== "egreso") return a;
      if (m.tipo !== "gasto" && m.tipo !== "gasto_admin") return a;
      if (from && m.fecha < from) return a;
      if (to && m.fecha > to) return a;
      return money(a + Number(m.monto || 0));
    }, 0);
  }
  function gananciasPagadas(db, from, to) {
    return (db.liquidaciones || []).reduce(function (a, l) {
      if (!l || l.anulado || l.estado !== "pagada") return a;
      if (from && l.fecha < from) return a;
      if (to && l.fecha > to) return a;
      return money(a + Number(l.monto || 0));
    }, 0);
  }
  function inversionistaCapital(db, invId) {
    return (db.aportes || []).reduce(function (a, r) {
      if (!r || r.anulado || r.inversionistaId !== invId) return a;
      var s = r.sentido === "egreso" ? -1 : 1;
      if (r.tipo === "aporte_inversionista" || r.tipo === "devolucion_inversionista") {
        return money(a + s * Number(r.monto || 0));
      }
      return a;
    }, 0);
  }
  function kpis(db) {
    var today = todayKey();
    var weekStart = addPeriod(today, "diaria", -6);
    var clientes = (db.clientes || []).filter(function (c) {
      return c.estado !== "inactivo";
    });
    var prestamosActivos = (db.prestamos || []).filter(function (p) {
      return p.estado === "activo" || p.estado === "vencido";
    });
    var cobHoy = (db.cobranzas || []).filter(function (c) {
      return !c.anulado && c.fecha === today;
    });
    var cobSem = (db.cobranzas || []).filter(function (c) {
      return !c.anulado && c.fecha >= weekStart && c.fecha <= today;
    });
    var vencidas = (db.cuotas || []).filter(function (c) {
      return cuotaSaldo(c) > 0.009 && String(c.fechaVencimiento || "") < today;
    });
    var invActivos = (db.inversionistas || []).filter(function (i) {
      return i.estado === "activo";
    });
    var ganGen = interesesCobrados(db);
    var gastos = gastosPeriodo(db);
    var pagadas = gananciasPagadas(db);
    var pendLiq = (db.liquidaciones || []).reduce(function (a, l) {
      if (!l || l.anulado || l.estado !== "pendiente") return a;
      return money(a + Number(l.monto || 0));
    }, 0);
    var propio = sumAportes(db, "aporte_propio") + sumAportes(db, "devolucion_propio");
    var deInv = sumAportes(db, "aporte_inversionista") + sumAportes(db, "devolucion_inversionista");
    var colocado = capitalColocado(db);
    var caja = cajaSaldo(db);
    var utilNetas = money(ganGen - gastos - pagadas);
    return {
      capitalDisponible: caja,
      capitalPrestado: colocado,
      prestamosActivos: prestamosActivos.length,
      clientes: clientes.length,
      cobranzasDia: cobHoy.reduce(function (a, c) {
        return money(a + Number(c.importe || 0));
      }, 0),
      cobranzasDiaN: cobHoy.length,
      cobranzasSemana: cobSem.reduce(function (a, c) {
        return money(a + Number(c.importe || 0));
      }, 0),
      cuotasVencidas: vencidas.length,
      cuotasVencidasMonto: vencidas.reduce(function (a, c) {
        return money(a + cuotaSaldo(c));
      }, 0),
      gananciasGeneradas: ganGen,
      gananciasPendientes: pendLiq,
      inversionistasActivos: invActivos.length,
      capitalPropio: propio,
      capitalInversionistas: deInv,
      utilidadesNetas: utilNetas,
      gastos: gastos,
      caja: caja,
      ingresos: (db.movimientosCaja || []).reduce(function (a, m) {
        return !m || m.anulado || m.sentido !== "ingreso" ? a : money(a + Number(m.monto || 0));
      }, 0),
      egresos: (db.movimientosCaja || []).reduce(function (a, m) {
        return !m || m.anulado || m.sentido !== "egreso" ? a : money(a + Number(m.monto || 0));
      }, 0),
    };
  }
  function series(db) {
    var today = todayKey();
    var days = [];
    var i;
    for (i = 13; i >= 0; i -= 1) days.push(addPeriod(today, "diaria", -i));
    var cobranzas = days.map(function (d) {
      var monto = (db.cobranzas || []).reduce(function (a, c) {
        return !c || c.anulado || c.fecha !== d ? a : money(a + Number(c.importe || 0));
      }, 0);
      return { label: d.slice(5), fecha: d, valor: monto };
    });
    var prestamos = days.map(function (d) {
      var monto = (db.prestamos || []).reduce(function (a, p) {
        return !p || p.fechaDesembolso !== d ? a : money(a + Number(p.capital || 0));
      }, 0);
      return { label: d.slice(5), fecha: d, valor: monto };
    });
    var s = kpis(db);
    var dist = [
      { label: "Disponible", valor: Math.max(0, s.capitalDisponible) },
      { label: "Colocado", valor: Math.max(0, s.capitalPrestado) },
      { label: "Utilidades", valor: Math.max(0, s.utilidadesNetas) },
    ];
    var meses = [];
    for (i = 5; i >= 0; i -= 1) {
      var d0 = parseDay(today);
      d0.setDate(1);
      d0.setMonth(d0.getMonth() - i);
      var from = dayKey(d0);
      var d1 = new Date(d0.getFullYear(), d0.getMonth() + 1, 0);
      var to = dayKey(d1);
      meses.push({
        label: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][d0.getMonth()],
        ingresos: (db.movimientosCaja || []).reduce(function (a, m) {
          return !m || m.anulado || m.sentido !== "ingreso" || m.fecha < from || m.fecha > to
            ? a
            : money(a + Number(m.monto || 0));
        }, 0),
        egresos: (db.movimientosCaja || []).reduce(function (a, m) {
          return !m || m.anulado || m.sentido !== "egreso" || m.fecha < from || m.fecha > to
            ? a
            : money(a + Number(m.monto || 0));
        }, 0),
      });
    }
    return { cobranzas: cobranzas, prestamos: prestamos, capital: dist, flujo: meses };
  }

  function requireUser(user) {
    if (!user || !user.id) return fail("sesion_invalida");
    return null;
  }
  function validateCliente(body, db, id) {
    var dni = digits(body.dni, 8);
    if (!isDni(dni)) return fail("dni_invalido");
    var nombres = asUpper(body.nombres);
    var apellidos = asUpper(body.apellidos);
    if (!nombres || !apellidos) return fail("nombre_invalido");
    var celular = digits(body.celular);
    if (celular && !isPhone(celular)) return fail("celular_invalido");
    if (!isEmail(body.correo || body.email)) return fail("correo_invalido");
    var dup = (db.clientes || []).some(function (c) {
      return c.dni === dni && c.id !== id;
    });
    if (dup) return fail("dni_duplicado");
    return null;
  }

  function login(db, payload) {
    ensureAdmin(db);
    var usuario = fold(payload && payload.usuario);
    var clave = String((payload && payload.clave) || "");
    if (usuario !== fold(ADMIN_USER) || clave !== ADMIN_CLAVE) return fail("clave_invalida");
    var row = db.usuarios[0];
    return ok({
      id: row.id,
      usuario: row.usuario,
      nombre: row.nombre,
      rol: "admin",
    });
  }
  function setupAdmin(db, payload) {
    return login(db, payload);
  }
  function changePassword() {
    return fail("clave_fija");
  }

  function saveCliente(db, payload, user) {
    var err = requireUser(user) || validateCliente(payload, db, payload.id);
    if (err) return err;
    var row = payload.id ? find(db.clientes, payload.id) : null;
    var data = {
      dni: digits(payload.dni, 8),
      nombres: asUpper(payload.nombres),
      apellidos: asUpper(payload.apellidos),
      celular: digits(payload.celular),
      correo: asEmail(payload.correo || payload.email),
      direccion: asUpper(payload.direccion),
      ref1Telefono: digits(payload.ref1Telefono),
      estado: payload.estado === "inactivo" ? "inactivo" : "activo",
      updatedAt: nowIso(),
    };
    if (row) {
      Object.keys(data).forEach(function (k) {
        row[k] = data[k];
      });
      delete row.firma;
      audit(db, user, "editar", "clientes", row.id, fullName(row));
    } else {
      row = Object.assign({ id: uid("CLI", db), createdAt: nowIso() }, data);
      db.clientes.unshift(row);
      audit(db, user, "alta", "clientes", row.id, fullName(row));
    }
    return ok(row, db);
  }
  function saveAval(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var cliente = find(db.clientes, payload.clienteId);
    if (!cliente) return fail("cliente_invalido");
    var dni = digits(payload.dni, 8);
    if (!isDni(dni)) return fail("dni_invalido");
    var nombres = asUpper(payload.nombres);
    var apellidos = asUpper(payload.apellidos);
    if (!nombres || !apellidos) return fail("nombre_invalido");
    var dup = (db.avales || []).some(function (a) {
      return a.clienteId === cliente.id && a.dni === dni && a.id !== payload.id;
    });
    if (dup) return fail("dni_aval_duplicado");
    var row = payload.id ? find(db.avales, payload.id) : null;
    var data = {
      clienteId: cliente.id,
      dni: dni,
      nombres: nombres,
      apellidos: apellidos,
      celular: digits(payload.celular),
      direccion: asUpper(payload.direccion),
      ocupacion: asUpper(payload.ocupacion != null ? payload.ocupacion : (row && row.ocupacion) || ""),
      parentesco: asUpper(payload.parentesco != null ? payload.parentesco : (row && row.parentesco) || ""),
      observaciones: asUpper(payload.observaciones != null ? payload.observaciones : (row && row.observaciones) || ""),
      documentacion: row ? row.documentacion || "" : "",
      constanciaAceptacion: row ? !!row.constanciaAceptacion : false,
      estado: payload.estado === "inactivo" ? "inactivo" : "activo",
      updatedAt: nowIso(),
    };
    if (row) {
      Object.keys(data).forEach(function (k) {
        row[k] = data[k];
      });
      audit(db, user, "editar", "avales", row.id, fullName(row));
    } else {
      row = Object.assign({ id: uid("AVL", db), createdAt: nowIso() }, data);
      db.avales.unshift(row);
      audit(db, user, "alta", "avales", row.id, fullName(row));
    }
    return ok(row, db);
  }
  function clienteSePuedeQuitar(db, id) {
    return !(db.prestamos || []).some(function (p) {
      return p && p.clienteId === id;
    });
  }
  function avalSePuedeQuitar(db, id) {
    return !(db.prestamos || []).some(function (p) {
      return p && p.avalId === id;
    });
  }
  function inversionistaSePuedeQuitar(db, id) {
    if (inversionistaCapital(db, id) > 0.009) return false;
    var aportes = (db.aportes || []).some(function (a) {
      return a && a.inversionistaId === id && !a.anulado;
    });
    var liqs = (db.liquidaciones || []).some(function (l) {
      return l && l.inversionistaId === id && !l.anulado;
    });
    return !aportes && !liqs;
  }
  function quitarCliente(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var row = find(db.clientes, payload.id);
    if (!row) return fail("cliente_invalido");
    if (!clienteSePuedeQuitar(db, row.id)) return fail("cliente_con_prestamos");
    if ((db.avales || []).some(function (a) {
      return a.clienteId === row.id && !avalSePuedeQuitar(db, a.id);
    })) return fail("aval_en_uso");
    db.avales = (db.avales || []).filter(function (a) {
      return a.clienteId !== row.id;
    });
    db.clientes = (db.clientes || []).filter(function (c) {
      return c.id !== row.id;
    });
    audit(db, user, "baja", "clientes", row.id, fullName(row));
    return ok(row, db);
  }
  function quitarAval(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var row = find(db.avales, payload.id);
    if (!row) return fail("aval_invalido");
    if (!avalSePuedeQuitar(db, row.id)) return fail("aval_en_uso");
    db.avales = (db.avales || []).filter(function (a) {
      return a.id !== row.id;
    });
    audit(db, user, "baja", "avales", row.id, fullName(row));
    return ok(row, db);
  }
  function quitarInversionista(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var row = find(db.inversionistas, payload.id);
    if (!row) return fail("inversionista_invalido");
    if (!inversionistaSePuedeQuitar(db, row.id)) return fail("inversionista_con_capital");
    db.inversionistas = (db.inversionistas || []).filter(function (i) {
      return i.id !== row.id;
    });
    audit(db, user, "baja", "inversionistas", row.id, fullName(row));
    return ok(row, db);
  }
  function savePrestamo(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var cliente = find(db.clientes, payload.clienteId);
    if (!cliente) return fail("cliente_invalido");
    if (payload.avalId && !find(db.avales, payload.avalId)) return fail("aval_invalido");
    var preview = calcSchedule(payload);
    if (!preview.ok) return preview;
    var plan = preview.data;
    if (payload.id) {
      var old = find(db.prestamos, payload.id);
      if (!old) return fail("prestamo_invalido");
      var hasPay = (db.cobranzas || []).some(function (c) {
        return c.prestamoId === old.id && !c.anulado;
      });
      if (hasPay) return fail("prestamo_bloqueado");
      db.cuotas = db.cuotas.filter(function (c) {
        return c.prestamoId !== old.id;
      });
      db.movimientosCaja.forEach(function (m) {
        if (m.origenId === old.id && m.tipo === "desembolso" && !m.anulado) {
          m.anulado = true;
          m.anuladoAt = nowIso();
          m.anuladoPor = user.nombre;
        }
      });
      Object.assign(old, {
        clienteId: cliente.id,
        avalId: payload.avalId || "",
        capital: plan.capital,
        tasa: plan.tasa,
        tipoTasa: plan.tipoTasa,
        fechaDesembolso: fechaKey(payload.fechaDesembolso),
        frecuencia: plan.frecuencia,
        nCuotas: plan.nCuotas,
        fechaPrimeraCuota: plan.fechaPrimeraCuota,
        totalIntereses: plan.totalIntereses,
        totalDevolver: plan.totalDevolver,
        valorCuota: plan.valorCuota,
        estado: "activo",
        updatedAt: nowIso(),
      });
      if (cajaSaldo(db) < plan.capital) return fail("caja_insuficiente");
      plan.cuotas.forEach(function (c) {
        db.cuotas.push({
          id: uid("CUO", db),
          prestamoId: old.id,
          nro: c.nro,
          fechaVencimiento: c.fechaVencimiento,
          capital: c.capital,
          interes: c.interes,
          monto: c.monto,
          pagado: 0,
          capitalPagado: 0,
          interesPagado: 0,
          estado: "pendiente",
          createdAt: nowIso(),
        });
      });
      addCaja(db, user, {
        tipo: "desembolso",
        sentido: "egreso",
        monto: plan.capital,
        fecha: old.fechaDesembolso,
        origenTipo: "prestamo",
        origenId: old.id,
        descripcion: "Desembolso " + old.codigo,
      });
      refreshPrestamoEstado(db, old);
      audit(db, user, "editar", "prestamos", old.id, old.codigo);
      return ok(old, db);
    }
    if (cajaSaldo(db) < plan.capital) return fail("caja_insuficiente");
    var codigo = nextCode(db.prestamos, "PRE");
    var row = {
      id: uid("PRE", db),
      codigo: codigo,
      clienteId: cliente.id,
      avalId: payload.avalId || "",
      capital: plan.capital,
      tasa: plan.tasa,
      tipoTasa: plan.tipoTasa,
      fechaDesembolso: fechaKey(payload.fechaDesembolso),
      frecuencia: plan.frecuencia,
      nCuotas: plan.nCuotas,
      fechaPrimeraCuota: plan.fechaPrimeraCuota,
      totalIntereses: plan.totalIntereses,
      totalDevolver: plan.totalDevolver,
      valorCuota: plan.valorCuota,
      estado: "activo",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.prestamos.unshift(row);
    plan.cuotas.forEach(function (c) {
      db.cuotas.push({
        id: uid("CUO", db),
        prestamoId: row.id,
        nro: c.nro,
        fechaVencimiento: c.fechaVencimiento,
        capital: c.capital,
        interes: c.interes,
        monto: c.monto,
        pagado: 0,
        capitalPagado: 0,
        interesPagado: 0,
        estado: "pendiente",
        createdAt: nowIso(),
      });
    });
    addCaja(db, user, {
      tipo: "desembolso",
      sentido: "egreso",
      monto: plan.capital,
      fecha: row.fechaDesembolso,
      origenTipo: "prestamo",
      origenId: row.id,
      descripcion: "Desembolso " + row.codigo,
    });
    audit(db, user, "alta", "prestamos", row.id, codigo + " · " + fullName(cliente));
    return ok(row, db);
  }
  function registrarPago(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var prestamo = find(db.prestamos, payload.prestamoId);
    if (!prestamo) return fail("prestamo_invalido");
    if (prestamo.estado === "cancelado") return fail("prestamo_cancelado");
    var importe = money(payload.importe);
    if (!(importe > 0)) return fail("importe_invalido");
    var now = Date.now();
    var dup = (db.cobranzas || []).some(function (c) {
      return (
        !c.anulado &&
        c.prestamoId === prestamo.id &&
        money(c.importe) === importe &&
        Math.abs(stampMs(c.createdAt) - now) < 8000
      );
    });
    if (dup) return fail("pago_duplicado");
    var saldo = prestamoSaldo(db, prestamo.id);
    if (importe - saldo > 0.009) return fail("importe_excede_saldo");
    var cuotas = db.cuotas
      .filter(function (c) {
        return c.prestamoId === prestamo.id && cuotaSaldo(c) > 0.009;
      })
      .sort(function (a, b) {
        return a.nro - b.nro;
      });
    var rest = importe;
    var capitalAm = 0;
    var interesCob = 0;
    var firstCuota = cuotas[0] ? cuotas[0].id : "";
    cuotas.forEach(function (c) {
      if (rest <= 0.009) return;
      var capSaldo = money((c.capital || 0) - (c.capitalPagado || 0));
      var intSaldo = money((c.interes || 0) - (c.interesPagado || 0));
      var due = money(capSaldo + intSaldo);
      if (due <= 0) return;
      var pay = money(Math.min(rest, due));
      var payInt = money(due ? pay * (intSaldo / due) : 0);
      var payCap = money(pay - payInt);
      if (payCap > capSaldo) {
        payCap = capSaldo;
        payInt = money(pay - payCap);
      }
      c.pagado = money((c.pagado || 0) + pay);
      c.capitalPagado = money((c.capitalPagado || 0) + payCap);
      c.interesPagado = money((c.interesPagado || 0) + payInt);
      if (cuotaSaldo(c) <= 0.009) {
        c.pagado = c.monto;
        c.estado = "pagada";
      } else c.estado = "parcial";
      capitalAm = money(capitalAm + payCap);
      interesCob = money(interesCob + payInt);
      rest = money(rest - pay);
      if (!firstCuota) firstCuota = c.id;
    });
    var codigo = nextCode(db.cobranzas, "COB");
    var cob = {
      id: uid("COB", db),
      codigo: codigo,
      clienteId: prestamo.clienteId,
      prestamoId: prestamo.id,
      cuotaId: payload.cuotaId || firstCuota,
      fecha: fechaKey(payload.fecha),
      hora: limaTime(),
      importe: importe,
      capitalAmortizado: capitalAm,
      interesCobrado: interesCob,
      saldoPendiente: prestamoSaldo(db, prestamo.id),
      usuario: (user && (user.nombre || user.usuario)) || "",
      usuarioId: (user && user.id) || "",
      anulado: false,
      createdAt: nowIso(),
    };
    db.cobranzas.unshift(cob);
    addCaja(db, user, {
      tipo: "cobranza",
      sentido: "ingreso",
      monto: importe,
      fecha: cob.fecha,
      origenTipo: "cobranza",
      origenId: cob.id,
      descripcion: "Cobranza " + codigo + " · cap " + capitalAm + " · int " + interesCob,
    });
    refreshPrestamoEstado(db, prestamo);
    audit(db, user, "alta", "cobranzas", cob.id, codigo);
    return ok(cob, db);
  }
  function anularPago(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var cob = find(db.cobranzas, payload.id);
    if (!cob || cob.anulado) return fail("movimiento_invalido");
    cob.anulado = true;
    cob.anuladoAt = nowIso();
    cob.anuladoPor = user.nombre;
    db.movimientosCaja.forEach(function (m) {
      if (m.origenId === cob.id && m.tipo === "cobranza" && !m.anulado) {
        m.anulado = true;
        m.anuladoAt = nowIso();
        m.anuladoPor = user.nombre;
      }
    });
    var prestamo = find(db.prestamos, cob.prestamoId);
    rebuildCuotasFromPays(db, cob.prestamoId);
    if (prestamo) refreshPrestamoEstado(db, prestamo);
    audit(db, user, "anular", "cobranzas", cob.id, cob.codigo);
    return ok(cob, db);
  }
  function rebuildCuotasFromPays(db, prestamoId) {
    var cuotas = db.cuotas
      .filter(function (c) {
        return c.prestamoId === prestamoId;
      })
      .sort(function (a, b) {
        return a.nro - b.nro;
      });
    cuotas.forEach(function (c) {
      c.pagado = 0;
      c.capitalPagado = 0;
      c.interesPagado = 0;
      c.estado = "pendiente";
    });
    var pays = db.cobranzas
      .filter(function (c) {
        return c.prestamoId === prestamoId && !c.anulado;
      })
      .sort(function (a, b) {
        return stampMs(a.createdAt) - stampMs(b.createdAt);
      });
    pays.forEach(function (pay) {
      var rest = money(pay.importe);
      cuotas.forEach(function (c) {
        if (rest <= 0.009) return;
        var capSaldo = money((c.capital || 0) - (c.capitalPagado || 0));
        var intSaldo = money((c.interes || 0) - (c.interesPagado || 0));
        var due = money(capSaldo + intSaldo);
        if (due <= 0) return;
        var amt = money(Math.min(rest, due));
        var payInt = money(due ? amt * (intSaldo / due) : 0);
        var payCap = money(amt - payInt);
        c.pagado = money((c.pagado || 0) + amt);
        c.capitalPagado = money((c.capitalPagado || 0) + payCap);
        c.interesPagado = money((c.interesPagado || 0) + payInt);
        c.estado = cuotaSaldo(c) <= 0.009 ? "pagada" : "parcial";
        rest = money(rest - amt);
      });
      pay.saldoPendiente = cuotas.reduce(function (a, c) {
        return money(a + cuotaSaldo(c));
      }, 0);
    });
  }
  function saveInversionista(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var dni = digits(payload.dni, 8);
    if (!isDni(dni)) return fail("dni_invalido");
    var nombres = asUpper(payload.nombres);
    var apellidos = asUpper(payload.apellidos);
    if (!nombres || !apellidos) return fail("nombre_invalido");
    var dup = (db.inversionistas || []).some(function (i) {
      return i.dni === dni && i.id !== payload.id;
    });
    if (dup) return fail("inversionista_dni");
    var modalidad = payload.modalidad === "utilidades" ? "utilidades" : "fija";
    var data = {
      dni: dni,
      nombres: nombres,
      apellidos: apellidos,
      celular: digits(payload.celular),
      direccion: asUpper(payload.direccion),
      fechaIncorporacion: fechaKey(payload.fechaIncorporacion),
      modalidad: modalidad,
      porcentaje: money(payload.porcentaje || 0),
      montoAcordado: money(payload.montoAcordado || 0),
      frecuenciaLiquidacion: String(payload.frecuenciaLiquidacion || "mensual"),
      fechaVencimiento: payload.fechaVencimiento ? fechaKey(payload.fechaVencimiento) : "",
      estado: payload.estado === "inactivo" ? "inactivo" : "activo",
      updatedAt: nowIso(),
    };
    var row = payload.id ? find(db.inversionistas, payload.id) : null;
    if (row) {
      Object.keys(data).forEach(function (k) {
        row[k] = data[k];
      });
      audit(db, user, "editar", "inversionistas", row.id, fullName(row));
      return ok(row, db);
    }
    row = Object.assign({ id: uid("INV", db), createdAt: nowIso() }, data);
    db.inversionistas.unshift(row);
    var monto = money(payload.montoAportado || payload.monto || 0);
    if (monto > 0) {
      registrarAporteInternal(db, user, {
        inversionistaId: row.id,
        monto: monto,
        fecha: payload.fechaAporte || row.fechaIncorporacion,
        tipo: "aporte_inversionista",
      });
    }
    audit(db, user, "alta", "inversionistas", row.id, fullName(row));
    return ok(row, db);
  }
  function registrarAporteInternal(db, user, payload) {
    var inv = find(db.inversionistas, payload.inversionistaId);
    if (!inv) return fail("inversionista_invalido");
    var monto = money(payload.monto);
    if (!(monto > 0)) return fail("importe_invalido");
    var tipo = payload.tipo || "aporte_inversionista";
    var sentido = tipo.indexOf("devolucion") === 0 ? "egreso" : "ingreso";
    if (sentido === "egreso") {
      var vigente = inversionistaCapital(db, inv.id);
      if (monto - vigente > 0.009) return fail("importe_excede_saldo");
      if (cajaSaldo(db) < monto) return fail("caja_insuficiente");
    }
    var row = {
      id: uid("APO", db),
      inversionistaId: inv.id,
      tipo: tipo,
      sentido: sentido,
      monto: monto,
      fecha: fechaKey(payload.fecha),
      anulado: false,
      createdAt: nowIso(),
    };
    db.aportes.unshift(row);
    addCaja(db, user, {
      tipo: tipo,
      sentido: sentido,
      monto: monto,
      fecha: row.fecha,
      origenTipo: "aporte",
      origenId: row.id,
      descripcion: (sentido === "egreso" ? "Devolución " : "Aporte ") + fullName(inv),
    });
    return ok(row, db);
  }
  function registrarAporte(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var res = registrarAporteInternal(db, user, payload);
    if (res.ok) audit(db, user, "alta", "aportes", res.data.id, res.data.tipo);
    return res;
  }
  function calcularGanancia(db, inv) {
    var cap = inversionistaCapital(db, inv.id);
    if (inv.modalidad === "fija") {
      if (inv.montoAcordado > 0) return money(inv.montoAcordado);
      return money(cap * (Number(inv.porcentaje || 0) / 100));
    }
    var totalInv = (db.inversionistas || []).reduce(function (a, i) {
      return i.estado === "activo" ? money(a + inversionistaCapital(db, i.id)) : a;
    }, 0);
    var util = money(interesesCobrados(db) - gastosPeriodo(db) - gananciasPagadas(db));
    if (util < 0) util = 0;
    var pct = Number(inv.porcentaje || 0) / 100;
    if (totalInv > 0 && !(pct > 0)) return money(util * (cap / totalInv));
    return money(util * pct);
  }
  function generarLiquidacion(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var inv = find(db.inversionistas, payload.inversionistaId);
    if (!inv) return fail("inversionista_invalido");
    var monto = money(payload.monto != null ? payload.monto : calcularGanancia(db, inv));
    if (!(monto > 0)) return fail("importe_invalido");
    var row = {
      id: uid("LIQ", db),
      inversionistaId: inv.id,
      fecha: todayKey(),
      monto: monto,
      modalidad: inv.modalidad,
      estado: "pendiente",
      anulado: false,
      createdAt: nowIso(),
    };
    db.liquidaciones.unshift(row);
    audit(db, user, "alta", "liquidaciones", row.id, fullName(inv));
    return ok(row, db);
  }
  function pagarLiquidacion(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var liq = find(db.liquidaciones, payload.id);
    if (!liq || liq.anulado || liq.estado === "pagada") return fail("liquidacion_invalida");
    if (cajaSaldo(db) < liq.monto) return fail("caja_insuficiente");
    liq.estado = "pagada";
    liq.fechaPago = todayKey();
    liq.updatedAt = nowIso();
    addCaja(db, user, {
      tipo: "pago_ganancia",
      sentido: "egreso",
      monto: liq.monto,
      fecha: liq.fechaPago,
      origenTipo: "liquidacion",
      origenId: liq.id,
      descripcion: "Pago de ganancias",
    });
    audit(db, user, "pagar", "liquidaciones", liq.id, "Pago liquidación");
    return ok(liq, db);
  }
  function registrarMovimiento(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var monto = money(payload.monto);
    if (!(monto > 0)) return fail("importe_invalido");
    var tipo = String(payload.tipo || "gasto");
    var sentido = payload.sentido || (tipo.indexOf("aporte") === 0 ? "ingreso" : "egreso");
    if (sentido === "egreso" && cajaSaldo(db) < monto) return fail("caja_insuficiente");
    var apId = "";
    if (tipo === "aporte_propio" || tipo === "devolucion_propio") {
      apId = uid("APO", db);
      db.aportes.unshift({
        id: apId,
        inversionistaId: "",
        tipo: tipo,
        sentido: sentido,
        monto: monto,
        fecha: fechaKey(payload.fecha),
        anulado: false,
        createdAt: nowIso(),
      });
    }
    var row = addCaja(db, user, {
      tipo: tipo,
      sentido: sentido,
      monto: monto,
      fecha: fechaKey(payload.fecha),
      descripcion: asUpper(payload.descripcion || ""),
      origenTipo: apId ? "aporte" : "caja",
      origenId: apId,
    });
    audit(db, user, "alta", "movimientosCaja", row.id, tipo);
    return ok(row, db);
  }
  function anularMovimiento(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var m = find(db.movimientosCaja, payload.id);
    if (!m) return fail("movimiento_invalido");
    if (m.anulado) return fail("movimiento_anulado");
    if (m.tipo === "cobranza" || m.tipo === "desembolso" || m.tipo === "pago_ganancia") {
      return fail("permiso_denegado", "Anule la operación de origen.");
    }
    m.anulado = true;
    m.anuladoAt = nowIso();
    m.anuladoPor = user.nombre;
    if (m.origenId) {
      db.aportes.forEach(function (a) {
        if (a.id === m.origenId) a.anulado = true;
      });
    }
    audit(db, user, "anular", "movimientosCaja", m.id, m.tipo);
    return ok(m, db);
  }
  function saveConfig(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var cfg = cfgOf(db);
    if (payload && payload.tasaDefault != null) {
      var tasa = money(payload.tasaDefault);
      if (tasa < 0 || tasa > 100) return fail("tasa_invalida");
      cfg.tasaDefault = tasa;
    }
    cfg.simbolo = "S/";
    cfg.moneda = "PEN";
    audit(db, user, "editar", "configuracion", cfg.id, "Tasa predeterminada " + cfg.tasaDefault + "%");
    return ok(cfg, db);
  }
  function inRange(fecha, from, to) {
    if (from && fecha < from) return false;
    if (to && fecha > to) return false;
    return true;
  }
  function reporte(db, payload) {
    var tipo = String((payload && payload.tipo) || "clientes");
    var from = String((payload && payload.from) || "");
    var to = String((payload && payload.to) || "");
    var rows = [];
    if (tipo === "clientes") {
      rows = (db.clientes || []).filter(function (c) {
        return !from || dayFrom(c.createdAt) >= from;
      });
    } else if (tipo === "prestamos" || tipo === "prestamos_otorgados") {
      rows = (db.prestamos || []).filter(function (p) {
        return inRange(p.fechaDesembolso, from, to);
      });
    } else if (tipo === "prestamos_cancelados") {
      rows = (db.prestamos || []).filter(function (p) {
        return p.estado === "cancelado" && inRange(dayFrom(p.updatedAt), from, to);
      });
    } else if (tipo === "prestamos_pendientes") {
      rows = (db.prestamos || []).filter(function (p) {
        return p.estado === "activo" || p.estado === "vencido";
      });
    } else if (tipo === "cobranzas") {
      rows = (db.cobranzas || []).filter(function (c) {
        return !c.anulado && inRange(c.fecha, from, to);
      });
    } else if (tipo === "cuotas_vencidas") {
      var today = todayKey();
      rows = (db.cuotas || []).filter(function (c) {
        return cuotaSaldo(c) > 0.009 && c.fechaVencimiento < today;
      });
    } else if (tipo === "intereses") {
      rows = (db.cobranzas || []).filter(function (c) {
        return !c.anulado && inRange(c.fecha, from, to) && c.interesCobrado > 0;
      });
    } else if (tipo === "gastos") {
      rows = (db.movimientosCaja || []).filter(function (m) {
        return !m.anulado && m.sentido === "egreso" && (m.tipo === "gasto" || m.tipo === "gasto_admin") && inRange(m.fecha, from, to);
      });
    } else if (tipo === "caja" || tipo === "capital") {
      rows = (db.movimientosCaja || []).filter(function (m) {
        return !m.anulado && inRange(m.fecha, from, to);
      });
    } else if (tipo === "inversionistas") {
      rows = (db.inversionistas || []).slice();
    } else if (tipo === "ganancias") {
      rows = (db.liquidaciones || []).filter(function (l) {
        return !l.anulado && inRange(l.fecha, from, to);
      });
    }
    return ok({ tipo: tipo, rows: rows, kpis: kpis(db) });
  }
  function dashboard(db) {
    return ok({ kpis: kpis(db), series: series(db), cfg: cfgOf(db) });
  }
  function clienteHistorial(db, id) {
    var cli = find(db.clientes, id);
    if (!cli) return fail("cliente_invalido");
    var prestamos = db.prestamos.filter(function (p) {
      return String(p.clienteId) === String(id);
    });
    var ids = prestamos.map(function (p) {
      return p.id;
    });
    var historial = (db.historialPrestamos || []).filter(function (h) {
      return String(h.clienteId) === String(id);
    });
    return ok({
      cliente: cli,
      avales: db.avales.filter(function (a) {
        return String(a.clienteId) === String(id);
      }),
      prestamos: prestamos,
      prestamosActivos: prestamos.filter(function (p) {
        return p.estado !== "cancelado";
      }),
      prestamosTerminados: prestamos.filter(function (p) {
        return p.estado === "cancelado";
      }),
      historial: historial,
      cobranzas: db.cobranzas.filter(function (c) {
        return ids.indexOf(c.prestamoId) >= 0;
      }),
    });
  }
  function inversionistaEstado(db, id) {
    var inv = find(db.inversionistas, id);
    if (!inv) return fail("inversionista_invalido");
    var aportes = db.aportes.filter(function (a) {
      return a.inversionistaId === id;
    });
    var liqs = db.liquidaciones.filter(function (l) {
      return l.inversionistaId === id;
    });
    var pagadas = liqs.reduce(function (a, l) {
      return l.estado === "pagada" && !l.anulado ? money(a + l.monto) : a;
    }, 0);
    var pendientes = liqs.reduce(function (a, l) {
      return l.estado === "pendiente" && !l.anulado ? money(a + l.monto) : a;
    }, 0);
    return ok({
      inversionista: inv,
      aportes: aportes,
      liquidaciones: liqs,
      capitalVigente: inversionistaCapital(db, id),
      gananciasPagadas: pagadas,
      gananciasPendientes: pendientes,
      gananciaEstimada: calcularGanancia(db, inv),
    });
  }

  function dispatch(action, db, payload, user) {
    db = clone(normalizeDb(db));
    payload = payload || {};
    var fn = {
      login: function () {
        return login(db, payload);
      },
      setupAdmin: function () {
        return setupAdmin(db, payload);
      },
      changePassword: function () {
        return changePassword(db, payload, user);
      },
      dashboard: function () {
        return dashboard(db);
      },
      saveCliente: function () {
        return saveCliente(db, payload, user);
      },
      saveAval: function () {
        return saveAval(db, payload, user);
      },
      quitarCliente: function () {
        return quitarCliente(db, payload, user);
      },
      quitarAval: function () {
        return quitarAval(db, payload, user);
      },
      quitarInversionista: function () {
        return quitarInversionista(db, payload, user);
      },
      previewPrestamo: function () {
        return calcSchedule(payload);
      },
      savePrestamo: function () {
        return savePrestamo(db, payload, user);
      },
      registrarPago: function () {
        return registrarPago(db, payload, user);
      },
      anularPago: function () {
        return anularPago(db, payload, user);
      },
      saveInversionista: function () {
        return saveInversionista(db, payload, user);
      },
      registrarAporte: function () {
        return registrarAporte(db, payload, user);
      },
      generarLiquidacion: function () {
        return generarLiquidacion(db, payload, user);
      },
      pagarLiquidacion: function () {
        return pagarLiquidacion(db, payload, user);
      },
      registrarMovimiento: function () {
        return registrarMovimiento(db, payload, user);
      },
      anularMovimiento: function () {
        return anularMovimiento(db, payload, user);
      },
      saveConfig: function () {
        return saveConfig(db, payload, user);
      },
      reporte: function () {
        return reporte(db, payload);
      },
      clienteHistorial: function () {
        return clienteHistorial(db, payload.id);
      },
      inversionistaEstado: function () {
        return inversionistaEstado(db, payload.id);
      },
      db: function () {
        var err = requireUser(user);
        if (err) return err;
        return ok(db);
      },
    }[action];
    if (!fn) return fail("accion_desconocida");
    return fn();
  }

  root.ImpulsaEngine = {
    TABLES: TABLES,
    MSG: MSG,
    money: money,
    todayKey: todayKey,
    limaDate: limaDate,
    limaTime: limaTime,
    dayFrom: dayFrom,
    parseDay: parseDay,
    addPeriod: addPeriod,
    uid: uid,
    isDni: isDni,
    digits: digits,
    fold: fold,
    fullName: fullName,
    emptyDb: emptyDb,
    normalizeDb: normalizeDb,
    maybeSeed: maybeSeed,
    seedDemo: seedDemo,
    calcSchedule: calcSchedule,
    kpis: kpis,
    series: series,
    cajaSaldo: cajaSaldo,
    cuotaSaldo: cuotaSaldo,
    prestamoSaldo: prestamoSaldo,
    inversionistaCapital: inversionistaCapital,
    calcularGanancia: calcularGanancia,
    cfgOf: cfgOf,
    find: find,
    dispatch: dispatch,
    clone: clone,
    clienteSePuedeQuitar: clienteSePuedeQuitar,
    avalSePuedeQuitar: avalSePuedeQuitar,
    inversionistaSePuedeQuitar: inversionistaSePuedeQuitar,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
