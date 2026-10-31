function saveInversionista(payload, session) {
  return ImpulsaEngine.dispatch("saveInversionista", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
function registrarAporte(payload, session) {
  return ImpulsaEngine.dispatch("registrarAporte", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
function generarLiquidacion(payload, session) {
  return ImpulsaEngine.dispatch("generarLiquidacion", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
function pagarLiquidacion(payload, session) {
  return ImpulsaEngine.dispatch("pagarLiquidacion", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
