function previewPrestamo(payload) {
  return ImpulsaEngine.calcSchedule(payload || {});
}
function savePrestamo(payload, session) {
  return ImpulsaEngine.dispatch("savePrestamo", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
