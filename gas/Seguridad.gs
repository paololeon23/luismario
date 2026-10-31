var Seguridad = {
  sesion: function (db, session) {
    if (!session || !session.id) return null;
    var user = ImpulsaEngine.find(db.usuarios || [], session.id);
    if (!user || user.estado === "inactivo") return null;
    return { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol || "admin" };
  },
};
