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
var admin = E.dispatch("setupAdmin", db, { usuario: "admin", clave: "secreto", nombre: "Admin" });
assert.ok(admin.ok);
db = admin.db;
var user = admin.data;
assert.ok(!E.dispatch("setupAdmin", db, { usuario: "otro", clave: "secreto1" }).ok);

var cli = E.dispatch("saveCliente", db, { dni: "12345678", nombres: "Ana", apellidos: "Perez", celular: "987654321" }, user);
assert.ok(cli.ok);
db = cli.db;
var dup = E.dispatch("saveCliente", db, { dni: "12345678", nombres: "Luis", apellidos: "Rojas" }, user);
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

var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(html.indexOf("js/engine.js") !== -1);
assert.ok(html.indexOf("JL.jpeg") !== -1);
assert.ok(html.indexOf("Impulsa Financiera") !== -1);
var toml = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
assert.ok(toml.indexOf("/*") !== -1);
assert.ok(toml.indexOf("/index.html") !== -1);

console.log("verify ok");
