function saveCliente(payload, session) {
  return ImpulsaEngine.dispatch("saveCliente", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
function clienteHistorial(id, session) {
  return ImpulsaEngine.dispatch("clienteHistorial", loadDb(), { id: id }, Seguridad.sesion(loadDb(), session));
}
