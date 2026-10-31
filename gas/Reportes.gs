function reporte(payload, session) {
  return ImpulsaEngine.dispatch("reporte", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
function dashboard(session) {
  return ImpulsaEngine.dispatch("dashboard", loadDb(), {}, Seguridad.sesion(loadDb(), session));
}
