var Validaciones = {
  dni: function (s) {
    return ImpulsaEngine.isDni(s);
  },
  mensaje: function (code) {
    return ImpulsaEngine.MSG[code] || "No se pudo completar.";
  },
};
