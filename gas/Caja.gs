function registrarMovimiento(payload, session) {
  return ImpulsaEngine.dispatch("registrarMovimiento", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
function anularMovimiento(payload, session) {
  return ImpulsaEngine.dispatch("anularMovimiento", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
