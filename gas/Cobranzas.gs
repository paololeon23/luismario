function registrarPago(payload, session) {
  return ImpulsaEngine.dispatch("registrarPago", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
function anularPago(payload, session) {
  return ImpulsaEngine.dispatch("anularPago", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
