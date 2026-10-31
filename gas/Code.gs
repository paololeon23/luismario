/**
 * IMPULSA FINANCIERA — Web App
 *
 * Cómo publicar:
 * 1. Cree un proyecto de Apps Script y copie todos los archivos de /gas
 * 2. Ejecute una vez la función instalar() y autorice Hojas y Drive
 * 3. Implementar > Nueva implementación > Aplicación web
 *    - Ejecutar como: yo
 *    - Quién tiene acceso: Cualquier usuario
 * 4. Copie la URL /exec en js/config.js (apiUrl) o en el meta impulsa-api
 */
var SHEET_MAP = {
  clientes: "CLIENTES",
  avales: "AVALES",
  prestamos: "PRESTAMOS",
  cuotas: "CUOTAS",
  cobranzas: "COBRANZAS",
  inversionistas: "INVERSIONISTAS",
  aportes: "APORTES",
  movimientosCaja: "MOVIMIENTOS_CAJA",
  liquidaciones: "LIQUIDACIONES",
  usuarios: "USUARIOS",
  configuracion: "CONFIGURACION",
  auditoria: "AUDITORIA",
};

var HEADERS = {
  clientes: ["id", "dni", "nombres", "apellidos", "fechaNacimiento", "celular", "direccion", "ocupacion", "ref1Nombre", "ref1Telefono", "ref2Nombre", "ref2Telefono", "observaciones", "estado", "createdAt", "updatedAt"],
  avales: ["id", "clienteId", "dni", "nombres", "apellidos", "celular", "direccion", "ocupacion", "parentesco", "observaciones", "documentacion", "constanciaAceptacion", "estado", "createdAt", "updatedAt"],
  prestamos: ["id", "codigo", "clienteId", "avalId", "capital", "tasa", "tipoTasa", "fechaDesembolso", "frecuencia", "nCuotas", "fechaPrimeraCuota", "totalIntereses", "totalDevolver", "valorCuota", "estado", "createdAt", "updatedAt"],
  cuotas: ["id", "prestamoId", "nro", "fechaVencimiento", "capital", "interes", "monto", "pagado", "capitalPagado", "interesPagado", "estado", "createdAt"],
  cobranzas: ["id", "codigo", "clienteId", "prestamoId", "cuotaId", "fecha", "hora", "importe", "capitalAmortizado", "interesCobrado", "saldoPendiente", "usuario", "usuarioId", "anulado", "anuladoAt", "anuladoPor", "createdAt"],
  inversionistas: ["id", "dni", "nombres", "apellidos", "celular", "direccion", "fechaIncorporacion", "modalidad", "porcentaje", "montoAcordado", "frecuenciaLiquidacion", "fechaVencimiento", "estado", "createdAt", "updatedAt"],
  aportes: ["id", "inversionistaId", "tipo", "sentido", "monto", "fecha", "anulado", "createdAt"],
  movimientosCaja: ["id", "tipo", "categoria", "sentido", "monto", "fecha", "hora", "origenTipo", "origenId", "descripcion", "anulado", "anuladoAt", "anuladoPor", "usuario", "usuarioId", "createdAt"],
  liquidaciones: ["id", "inversionistaId", "fecha", "monto", "modalidad", "estado", "anulado", "fechaPago", "createdAt", "updatedAt"],
  usuarios: ["id", "usuario", "nombre", "rol", "clave", "estado", "createdAt", "updatedAt"],
  configuracion: ["id", "empresa", "moneda", "simbolo", "tasaDefault", "tipoTasaDefault", "frecuenciaDefault", "nCuotasDefault", "avisoLegal"],
  auditoria: ["id", "accion", "entidad", "entidadId", "usuario", "usuarioId", "fecha", "hora", "detalle", "createdAt"],
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action) {
    return handle_(p.action, parseJson_(p.payload), parseJson_(p.session));
  }
  return json_({ ok: true, app: "Impulsa Financiera", version: 1 });
}

function doPost(e) {
  var body = {};
  try {
    body = parseBody_(e);
  } catch (err) {
    return json_({ ok: false, error: "json_invalido", message: "No se pudo leer la petición." });
  }
  return handle_(body.action, body.payload, body.session);
}

function handle_(action, payload, session) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json_({ ok: false, error: "lock_timeout", message: "El servidor está ocupado. Intente de nuevo." });
  }
  try {
    if (!action) return json_({ ok: false, error: "accion_desconocida", message: "Falta la acción." });
    if (typeof ImpulsaEngine === "undefined") {
      return json_({ ok: false, error: "motor_ausente", message: "Falta Motor.gs. Copie gas/Motor.gs al proyecto de Apps Script." });
    }
    var db = loadDb();
    var user = null;
    if (action !== "login" && action !== "setupAdmin") {
      user = Seguridad.sesion(db, session);
    }
    var result = ImpulsaEngine.dispatch(String(action), db, payload || {}, user);
    if (result && result.ok && result.db) saveDb(result.db);
    if (result && result.data && result.data.clave) delete result.data.clave;
    if (result && result.db) delete result.db;
    return json_(result);
  } catch (err) {
    return json_({
      ok: false,
      error: "json_invalido",
      message: String(err && err.message ? err.message : err),
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (e2) {}
  }
}

function instalar() {
  var ss = getSpreadsheet();
  ensureSheets(ss);
  var db = ImpulsaEngine.emptyDb();
  saveDb(db);
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
  return ss.getUrl();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj || {})).setMimeType(ContentService.MimeType.JSON);
}

function parseJson_(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch (err) {
    return {};
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return { action: "", payload: {}, session: null };
  return JSON.parse(e.postData.contents);
}

function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SPREADSHEET_ID");
  var ss = null;
  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (err) {
      ss = null;
    }
  }
  if (!ss) {
    try {
      ss = SpreadsheetApp.getActive();
    } catch (err) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create("Impulsa Financiera");
    props.setProperty("SPREADSHEET_ID", ss.getId());
  } else {
    props.setProperty("SPREADSHEET_ID", ss.getId());
  }
  ensureSheets(ss);
  return ss;
}

function ensureSheets(ss) {
  var names = Object.keys(SHEET_MAP).map(function (k) {
    return SHEET_MAP[k];
  });
  names.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.setFrozenRows(1);
  });
  var extra = ss.getSheetByName("Hoja 1") || ss.getSheetByName("Sheet1");
  if (extra && ss.getSheets().length > 1) ss.deleteSheet(extra);
}

function loadDb() {
  var ss = getSpreadsheet();
  var db = ImpulsaEngine.emptyDb();
  ImpulsaEngine.TABLES.forEach(function (key) {
    db[key] = readSheet_(ss, SHEET_MAP[key], HEADERS[key] || ["id"]);
  });
  return ImpulsaEngine.normalizeDb(db);
}

function saveDb(db) {
  var ss = getSpreadsheet();
  ImpulsaEngine.TABLES.forEach(function (key) {
    writeSheet_(ss, SHEET_MAP[key], db[key] || [], HEADERS[key] || ["id"]);
  });
}

function readSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var last = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (last < 2 || lastCol < 1) return [];
  var values = sh.getRange(1, 1, last, lastCol).getValues();
  var head = values[0].map(function (h) {
    return String(h || "").trim();
  });
  var rows = [];
  var r;
  var c;
  for (r = 1; r < values.length; r += 1) {
    var obj = {};
    var empty = true;
    for (c = 0; c < head.length; c += 1) {
      if (!head[c]) continue;
      var val = decodeCell_(values[r][c]);
      obj[head[c]] = val;
      if (val !== "" && val != null && val !== false) empty = false;
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

function writeSheet_(ss, name, rows, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  var keys = (headers || []).slice();
  (rows || []).forEach(function (row) {
    Object.keys(row || {}).forEach(function (k) {
      if (keys.indexOf(k) === -1) keys.push(k);
    });
  });
  if (!keys.length) keys = ["id"];
  var data = [keys];
  (rows || []).forEach(function (row) {
    data.push(
      keys.map(function (k) {
        return encodeCell_(row[k]);
      })
    );
  });
  sh.clearContents();
  sh.getRange(1, 1, data.length, keys.length).setValues(data);
  sh.getRange(1, 1, 1, keys.length).setFontWeight("bold").setBackground("#092653").setFontColor("#FFFFFF");
}

function encodeCell_(val) {
  if (val == null) return "";
  if (typeof val === "object") return JSON.stringify(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  return val;
}

function decodeCell_(val) {
  if (val === "" || val == null) return "";
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, "America/Lima", "yyyy-MM-dd");
  }
  if (val === "TRUE" || val === true) return true;
  if (val === "FALSE" || val === false) return false;
  if (typeof val === "string") {
    var s = val.trim();
    if (s.charAt(0) === "{" || s.charAt(0) === "[") {
      try {
        return JSON.parse(s);
      } catch (err) {
        return val;
      }
    }
  }
  return val;
}
