/* Chequeo de sintaxis y de cálculos financieros. No llama a APIs remotas. */
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var assert = require("assert");
var { execFileSync } = require("child_process");

var root = path.join(__dirname, "..");
var files = ["js/config.js", "js/store.js", "js/engine.js", "js/api.js", "js/report.js", "js/app.js", "sw.js"];
files.forEach(function (f) {
  execFileSync(process.execPath, ["--check", path.join(root, f)], { stdio: "inherit" });
});

var ctx = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  AbortController: typeof AbortController !== "undefined" ? AbortController : function () {},
  fetch: function () {
    return Promise.reject(new Error("offline-test"));
  },
  indexedDB: undefined,
  localStorage: {
    getItem: function () {
      return null;
    },
    setItem: function () {},
    removeItem: function () {},
  },
  navigator: { onLine: true },
  document: {
    querySelector: function () {
      return null;
    },
    getElementById: function () {
      return null;
    },
    readyState: "complete",
    addEventListener: function () {},
    body: { style: {} },
  },
  location: { protocol: "https:", hash: "#/dashboard", hostname: "localhost" },
  Intl: Intl,
  JSON: JSON,
  Date: Date,
  Math: Math,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  window: null,
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.root = ctx;
vm.createContext(ctx);
["js/config.js", "js/store.js", "js/engine.js", "js/api.js"].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
});

var E = ctx.ImpulsaEngine;
assert.ok(E, "motor ausente");
assert.ok(ctx.ImpulsaStore.version === 2);

var plan = E.calcSchedule({ capital: 1000, tasa: 10, nCuotas: 4, tipoTasa: "plana", frecuencia: "semanal", fechaPrimeraCuota: "2026-11-03" });
assert.ok(plan.ok);
assert.strictEqual(plan.data.totalIntereses, 100);
assert.strictEqual(plan.data.totalDevolver, 1100);
assert.strictEqual(plan.data.cuotas.length, 4);
assert.strictEqual(plan.data.cuotas[0].monto, 275);

var bad = E.calcSchedule({ capital: 0, tasa: 10, nCuotas: 4 });
assert.ok(!bad.ok);

var db = E.emptyDb();
assert.strictEqual(db.usuarios.length, 1);
assert.strictEqual(db.usuarios[0].usuario, "Administrador");
var badLogin = E.dispatch("login", db, { usuario: "Administrador", clave: "otra" });
assert.ok(!badLogin.ok);
var admin = E.dispatch("login", db, { usuario: "Administrador", clave: "luismario2026" });
assert.ok(admin.ok);
db = admin.db || db;
var user = admin.data;
assert.ok(!E.dispatch("login", db, { usuario: "otro", clave: "luismario2026" }).ok);
assert.ok(!E.dispatch("changePassword", db, { claveActual: "luismario2026", claveNueva: "nuevaclave" }, user).ok);

var noMail = E.dispatch("saveCliente", db, { dni: "12345678", nombres: "Ana", apellidos: "Perez", celular: "987654321" }, user);
assert.ok(!noMail.ok);
assert.strictEqual(noMail.error, "correo_invalido");
var cli = E.dispatch("saveCliente", db, { dni: "12345678", nombres: "Ana", apellidos: "Perez", celular: "987654321", correo: "ANA@correo.pe" }, user);
assert.ok(cli.ok);
assert.strictEqual(cli.data.correo, "ana@correo.pe");
assert.strictEqual(cli.data.nombres, "ANA");
assert.strictEqual(cli.data.apellidos, "PEREZ");
db = cli.db;
var dup = E.dispatch("saveCliente", db, { dni: "12345678", nombres: "Luis", apellidos: "Rojas", correo: "luis@correo.pe" }, user);
assert.ok(!dup.ok);
assert.strictEqual(dup.error, "dni_duplicado");

var dniBad = E.dispatch("saveCliente", db, { dni: "123", nombres: "Ana", apellidos: "Perez" }, user);
assert.ok(!dniBad.ok);

var cajaFail = E.dispatch("savePrestamo", db, {
  clienteId: cli.data.id,
  capital: 1000,
  tasa: 10,
  nCuotas: 4,
  tipoTasa: "plana",
  frecuencia: "semanal",
  fechaDesembolso: "2026-11-01",
  fechaPrimeraCuota: "2026-11-03",
}, user);
assert.ok(!cajaFail.ok);
assert.strictEqual(cajaFail.error, "caja_insuficiente");

var apo = E.dispatch("registrarMovimiento", db, { tipo: "aporte_propio", sentido: "ingreso", monto: 5000, fecha: "2026-11-01", descripcion: "Capital inicial" }, user);
assert.ok(apo.ok);
db = apo.db;
assert.strictEqual(E.cajaSaldo(db), 5000);

var pre = E.dispatch("savePrestamo", db, {
  clienteId: cli.data.id,
  capital: 1000,
  tasa: 10,
  nCuotas: 4,
  tipoTasa: "plana",
  frecuencia: "semanal",
  fechaDesembolso: "2026-11-01",
  fechaPrimeraCuota: "2026-11-03",
}, user);
assert.ok(pre.ok, pre.message);
db = pre.db;
assert.strictEqual(E.cajaSaldo(db), 4000);
assert.strictEqual(db.cuotas.length, 4);

var pay = E.dispatch("registrarPago", db, { prestamoId: pre.data.id, importe: 275, fecha: "2026-11-03" }, user);
assert.ok(pay.ok, pay.message);
db = pay.db;
assert.strictEqual(pay.data.interesCobrado, 25);
assert.strictEqual(pay.data.capitalAmortizado, 250);
assert.strictEqual(pay.data.saldoPendiente, 825);
assert.strictEqual(E.cajaSaldo(db), 4275);

var over = E.dispatch("registrarPago", db, { prestamoId: pre.data.id, importe: 9000, fecha: "2026-11-03" }, user);
assert.ok(!over.ok);

var k = E.kpis(db);
assert.strictEqual(k.clientes, 1);
assert.strictEqual(k.prestamosActivos, 1);
assert.ok(k.gananciasGeneradas === 25);
assert.ok(k.capitalPrestado === 750);

assert.ok(!E.clienteSePuedeQuitar(db, cli.data.id));
var noDelCli = E.dispatch("quitarCliente", db, { id: cli.data.id }, user);
assert.ok(!noDelCli.ok);
assert.strictEqual(noDelCli.error, "cliente_con_prestamos");

var cobCaja = (db.movimientosCaja || []).find(function (m) { return m.tipo === "cobranza"; });
assert.ok(cobCaja);
var noDelCobCaja = E.dispatch("anularMovimiento", db, { id: cobCaja.id }, user);
assert.ok(!noDelCobCaja.ok);

var noDelPre = E.dispatch("quitarPrestamo", db, { id: pre.data.id }, user);
assert.ok(!noDelPre.ok);
assert.strictEqual(noDelPre.error, "accion_desconocida");

var anulado = E.dispatch("anularPago", db, { id: pay.data.id }, user);
assert.ok(anulado.ok, anulado.message);
db = anulado.db;
assert.ok(E.find(db.cobranzas, pay.data.id).anulado);
assert.strictEqual(E.cajaSaldo(db), 4000);
assert.strictEqual(E.prestamoSaldo(db, pre.data.id), 1100);

var libre = E.dispatch("saveCliente", db, { dni: "87654321", nombres: "Luis", apellidos: "Rojas", celular: "911111111", correo: "luis.rojas@correo.pe" }, user);
assert.ok(libre.ok);
db = libre.db;
assert.ok(E.clienteSePuedeQuitar(db, libre.data.id));
var quit = E.dispatch("quitarCliente", db, { id: libre.data.id }, user);
assert.ok(quit.ok);
db = quit.db;
assert.ok(!E.find(db.clientes, libre.data.id));

var av = E.dispatch("saveAval", db, {
  clienteId: cli.data.id,
  dni: "11223344",
  nombres: "Rosa",
  apellidos: "Aval",
  celular: "922222222",
}, user);
assert.ok(av.ok);
db = av.db;
var quitAv = E.dispatch("quitarAval", db, { id: av.data.id }, user);
assert.ok(quitAv.ok);
db = quitAv.db;

var invCap = E.dispatch("saveInversionista", db, {
  dni: "33445566",
  nombres: "Mario",
  apellidos: "Capital",
  celular: "933333333",
  fechaIncorporacion: "2026-10-01",
  montoAportado: 2000,
}, user);
assert.ok(invCap.ok);
db = invCap.db;
var noDelInv = E.dispatch("quitarInversionista", db, { id: invCap.data.id }, user);
assert.ok(!noDelInv.ok);
assert.strictEqual(noDelInv.error, "inversionista_con_capital");

var invLibre = E.dispatch("saveInversionista", db, {
  dni: "77889900",
  nombres: "Elena",
  apellidos: "Libre",
  celular: "944444444",
  fechaIncorporacion: "2026-10-01",
}, user);
assert.ok(invLibre.ok);
db = invLibre.db;
var quitInv = E.dispatch("quitarInversionista", db, { id: invLibre.data.id }, user);
assert.ok(quitInv.ok);

assert.strictEqual(E.dayFrom("2026-10-31"), "2026-10-31");
assert.strictEqual(E.dayFrom("31-10-2026 17:17:14"), "2026-10-31");
assert.ok(E.dispatch("saveCliente", db, { dni: "", nombres: "", apellidos: "" }, user).error === "dni_invalido");
assert.ok(!E.dispatch("registrarMovimiento", db, { tipo: "gasto", sentido: "egreso", monto: 0, fecha: "2026-11-01" }, user).ok);
assert.ok(!E.dispatch("registrarMovimiento", db, { tipo: "gasto", sentido: "egreso", monto: -10, fecha: "2026-11-01" }, user).ok);

var apOwn = E.dispatch("registrarMovimiento", db, { tipo: "aporte_propio", sentido: "ingreso", monto: 100, fecha: "2026-11-01", descripcion: "extra" }, user);
assert.ok(apOwn.ok, apOwn.message);
db = apOwn.db;
var apMov = (db.movimientosCaja || []).find(function (m) { return m.id === apOwn.data.id; });
assert.ok(apMov && apMov.origenId);
var apRow = E.find(db.aportes, apMov.origenId);
assert.ok(apRow && !apRow.anulado);
var cajaAntes = E.cajaSaldo(db);
var anAp = E.dispatch("anularMovimiento", db, { id: apOwn.data.id }, user);
assert.ok(anAp.ok, anAp.message);
db = anAp.db;
assert.ok(E.find(db.aportes, apMov.origenId).anulado);
assert.strictEqual(E.cajaSaldo(db), cajaAntes - 100);

var pay2 = E.dispatch("registrarPago", db, { prestamoId: pre.data.id, importe: 100, fecha: "2026-11-04" }, user);
assert.ok(pay2.ok, pay2.message);
db = pay2.db;
var payDup = E.dispatch("registrarPago", db, { prestamoId: pre.data.id, importe: 100, fecha: "2026-11-04" }, user);
assert.ok(!payDup.ok);
assert.strictEqual(payDup.error, "pago_duplicado");
var pay3 = E.dispatch("registrarPago", db, { prestamoId: pre.data.id, importe: 110, fecha: "2026-11-05" }, user);
assert.ok(pay3.ok, pay3.message);
db = pay3.db;
assert.ok(E.prestamoSaldo(db, pre.data.id) < 1100);

var resto = E.prestamoSaldo(db, pre.data.id);
var cierre = E.dispatch("registrarPago", db, { prestamoId: pre.data.id, importe: resto, fecha: "2026-11-20" }, user);
assert.ok(cierre.ok, cierre.message);
db = cierre.db;
assert.strictEqual(E.find(db.prestamos, pre.data.id).estado, "cancelado");
assert.ok((db.historialPrestamos || []).some(function (h) { return h.prestamoId === pre.data.id; }));
var histCli = E.dispatch("clienteHistorial", db, { id: cli.data.id }, user);
assert.ok(histCli.ok);
assert.ok(histCli.data.historial && histCli.data.historial.length);
assert.ok(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/.test(String(cierre.data.createdAt || "")));

var liq = E.dispatch("generarLiquidacion", db, { inversionistaId: invCap.data.id, monto: 50 }, user);
assert.ok(liq.ok, liq.message);
db = liq.db;
var pagLiq = E.dispatch("pagarLiquidacion", db, { id: liq.data.id }, user);
assert.ok(pagLiq.ok, pagLiq.message);
db = pagLiq.db;
assert.strictEqual(E.find(db.liquidaciones, liq.data.id).estado, "pagada");
var noDelLiqCaja = (db.movimientosCaja || []).find(function (m) { return m.tipo === "pago_ganancia"; });
assert.ok(noDelLiqCaja);
assert.ok(!E.dispatch("anularMovimiento", db, { id: noDelLiqCaja.id }, user).ok);

var dash = E.dispatch("dashboard", db, {}, user);
assert.ok(dash.ok);
assert.ok(dash.data && dash.data.kpis);

var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(html.indexOf("js/engine.js") !== -1);
assert.ok(html.indexOf("JL.jpeg") !== -1);
assert.ok(html.indexOf("Impulsa Financiera") !== -1);
var toml = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
assert.ok(toml.indexOf("/*") !== -1);
assert.ok(toml.indexOf("/index.html") !== -1);

console.log("verify ok");
