function saveAval(payload, session) {
  return ImpulsaEngine.dispatch("saveAval", loadDb(), payload, Seguridad.sesion(loadDb(), session));
}
