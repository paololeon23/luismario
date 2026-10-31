/* Motor financiero de Impulsa Financiera. Cálculos, validaciones e integridad. */
(function (root) {
  var TABLES = [
    "clientes",
    "avales",
    "prestamos",
    "cuotas",
    "cobranzas",
    "inversionistas",
    "aportes",
    "movimientosCaja",
    "liquidaciones",
    "usuarios",
    "configuracion",
    "auditoria",
  ];
  var MSG = {
    dni_invalido: "El DNI debe tener 8 dígitos.",
    dni_duplicado: "Ya existe un cliente con ese DNI.",
    dni_aval_duplicado: "Ese aval ya está registrado para este cliente.",
    nombre_invalido: "Escriba nombres y apellidos.",
    celular_invalido: "El celular no es válido.",
    cliente_invalido: "No se encontró el cliente.",
    aval_invalido: "No se encontró el aval.",
    prestamo_invalido: "No se encontró el préstamo.",
    capital_invalido: "El capital debe ser mayor a cero.",
    tasa_invalida: "La tasa no es válida.",
    cuotas_invalido: "El número de cuotas debe ser de 1 a 120.",
    fecha_invalida: "La fecha no es válida.",
    caja_insuficiente: "No hay capital disponible para este desembolso.",
    importe_invalido: "El importe debe ser mayor a cero.",
    importe_excede_saldo: "El importe supera el saldo pendiente del préstamo.",
    pago_duplicado: "Ese pago ya fue registrado. Evite duplicarlo.",
    prestamo_cancelado: "El préstamo ya está cancelado.",
    prestamo_bloqueado: "No se pueden cambiar las condiciones de un préstamo con pagos.",
    inversionista_invalido: "No se encontró el inversionista.",
    inversionista_dni: "Ya existe un inversionista con ese DNI.",
    movimiento_invalido: "No se encontró el movimiento.",
    movimiento_anulado: "Ese movimiento ya está anulado.",
    liquidacion_invalida: "No se encontró la liquidación.",
    clave_invalida: "Usuario o clave incorrectos.",
    clave_corta: "La clave debe tener al menos 6 caracteres.",
    permiso_denegado: "No tiene permiso para esta operación.",
    sesion_invalida: "Inicie sesión para continuar.",
    tabla_desconocida: "No se reconoció la consulta.",
    accion_desconocida: "El servidor no reconoció la petición.",
    dato_requerido: "Complete los datos obligatorios.",
  };

  function money(n) {
    var x = Number(n);
    if (!isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }
  function nowIso() {
    return new Date().toISOString();
  }
  function limaDate(d) {
    var date = d ? new Date(d) : new Date();
    if (isNaN(date.getTime())) return todayKey();
    var p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    var map = {};
    p.forEach(function (x) {
      map[x.type] = x.value;
    });
    return map.year + "-" + map.month + "-" + map.day;
  }
  function limaTime(d) {
    var date = d ? new Date(d) : new Date();
    return new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
  function todayKey() {
    return limaDate(new Date());
  }
  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }
  function parseDay(s) {
    var p = String(s || "").slice(0, 10).split("-");
    if (p.length !== 3) return null;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  function dayKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function addPeriod(dateStr, freq, n) {
    var d = parseDay(dateStr);
    if (!d) return dateStr;
    n = n || 0;
    if (freq === "diaria") d.setDate(d.getDate() + n);
    else if (freq === "semanal") d.setDate(d.getDate() + n * 7);
    else if (freq === "quincenal") d.setDate(d.getDate() + n * 15);
    else d.setMonth(d.getMonth() + n);
    return dayKey(d);
  }
  function uid(prefix) {
    return (
      (prefix || "X") +
      "-" +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 6).toUpperCase()
    );
  }
  function digits(s, n) {
    var d = String(s || "").replace(/\D/g, "");
    return n ? d.slice(0, n) : d;
  }
  function isDni(s) {
    return /^\d{8}$/.test(digits(s, 8)) && digits(s, 8).length === 8;
  }
  function isPhone(s) {
    var d = digits(s);
    return d.length >= 6 && d.length <= 15;
  }
  function fold(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function fullName(row) {
    return String((row && (row.apellidos || "")) + " " + (row && (row.nombres || "")))
      .replace(/\s+/g, " ")
      .trim();
  }
  function fail(code, extra) {
    return { ok: false, error: code, message: MSG[code] || extra || "No se pudo completar." };
  }
  function ok(data, db) {
    return { ok: true, data: data, db: db };
  }
  function find(list, id) {
    var i;
    for (i = 0; i < (list || []).length; i += 1) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  function emptyDb() {
    var db = {};
    TABLES.forEach(function (t) {
      db[t] = [];
    });
    db.configuracion = [
      {
        id: "CFG",
        empresa: "Impulsa Financiera",
        moneda: "PEN",
        simbolo: "S/",
        tasaDefault: 10,
        tipoTasaDefault: "plana",
        frecuenciaDefault: "semanal",
        nCuotasDefault: 4,
        avisoLegal:
          "Registrar inversionistas no equivale a autorización para captar dinero del público. Las rentabilidades se calculan según el acuerdo y los resultados reales. No se presentan como garantizadas.",
      },
    ];
    return db;
  }
  function normalizeDb(raw) {
    var db = emptyDb();
    if (!raw || typeof raw !== "object") return db;
    TABLES.forEach(function (t) {
      db[t] = Array.isArray(raw[t]) ? raw[t] : db[t];
    });
    if (!db.configuracion.length) db.configuracion = emptyDb().configuracion;
    return db;
  }
  function cfgOf(db) {
    return (db.configuracion && db.configuracion[0]) || emptyDb().configuracion[0];
  }
  function audit(db, user, accion, entidad, entidadId, detalle) {
    db.auditoria.unshift({
      id: uid("AUD"),
      accion: accion,
      entidad: entidad,
      entidadId: entidadId || "",
      usuario: (user && (user.nombre || user.usuario)) || "sistema",
      usuarioId: (user && user.id) || "",
      fecha: limaDate(),
      hora: limaTime(),
      detalle: String(detalle || "").slice(0, 240),
      createdAt: nowIso(),
    });
    if (db.auditoria.length > 2000) db.auditoria.length = 2000;
  }
  function nextCode(list, prefix, field) {
    var day = todayKey().replace(/-/g, "");
    var n = 1;
    (list || []).forEach(function (row) {
      var code = String(row[field || "codigo"] || "");
      if (code.indexOf(prefix + "-" + day) === 0) n += 1;
    });
    return prefix + "-" + day + "-" + ("000" + n).slice(-3);
  }

  function calcSchedule(input) {
    var capital = money(input.capital);
    var tasa = Number(input.tasa);
    var n = Math.round(Number(input.nCuotas));
    var tipo = String(input.tipoTasa || "plana");
    var freq = String(input.frecuencia || "semanal");
    var first = String(input.fechaPrimeraCuota || todayKey());
    if (!(capital > 0)) return fail("capital_invalido");
    if (!(tasa >= 0) || tasa > 1000) return fail("tasa_invalida");
    if (!(n >= 1) || n > 120) return fail("cuotas_invalido");
    if (!parseDay(first)) return fail("fecha_invalida");
    var cuotas = [];
    var totalInteres = 0;
    var totalDevolver = 0;
    var i;
    var rate = tasa / 100;
    if (tipo === "frances") {
      var pmt =
        rate === 0
          ? money(capital / n)
          : money((capital * (rate * Math.pow(1 + rate, n))) / (Math.pow(1 + rate, n) - 1));
      var saldo = capital;
      for (i = 1; i <= n; i += 1) {
        var interes = money(saldo * rate);
        var monto = i === n ? money(saldo + interes) : pmt;
        var cap = money(monto - interes);
        if (cap > saldo) cap = saldo;
        monto = money(cap + interes);
        cuotas.push({
          nro: i,
          fechaVencimiento: addPeriod(first, freq, i - 1),
          capital: cap,
          interes: interes,
          monto: monto,
        });
        saldo = money(saldo - cap);
        totalInteres = money(totalInteres + interes);
      }
    } else if (tipo === "periodo") {
      var capEq = money(capital / n);
      var intEq = money(capital * rate);
      var capAcc = 0;
      for (i = 1; i <= n; i += 1) {
        var capP = i === n ? money(capital - capAcc) : capEq;
        capAcc = money(capAcc + capP);
        var montoP = money(capP + intEq);
        cuotas.push({
          nro: i,
          fechaVencimiento: addPeriod(first, freq, i - 1),
          capital: capP,
          interes: intEq,
          monto: montoP,
        });
        totalInteres = money(totalInteres + intEq);
      }
    } else {
      totalInteres = money(capital * rate);
      var cuota = money((capital + totalInteres) / n);
      var capUnit = money(capital / n);
      var intUnit = money(totalInteres / n);
      var capSum = 0;
      var intSum = 0;
      for (i = 1; i <= n; i += 1) {
        var cCap = i === n ? money(capital - capSum) : capUnit;
        var cInt = i === n ? money(totalInteres - intSum) : intUnit;
        capSum = money(capSum + cCap);
        intSum = money(intSum + cInt);
        cuotas.push({
          nro: i,
          fechaVencimiento: addPeriod(first, freq, i - 1),
          capital: cCap,
          interes: cInt,
          monto: money(cCap + cInt),
        });
      }
    }
    totalDevolver = cuotas.reduce(function (a, c) {
      return money(a + c.monto);
    }, 0);
    totalInteres = cuotas.reduce(function (a, c) {
      return money(a + c.interes);
    }, 0);
    return ok({
      capital: capital,
      tasa: tasa,
      tipoTasa: tipo,
      frecuencia: freq,
      nCuotas: n,
      fechaPrimeraCuota: first,
      totalIntereses: totalInteres,
      totalDevolver: totalDevolver,
      valorCuota: cuotas[0] ? cuotas[0].monto : 0,
      cuotas: cuotas,
    });
  }

  function cuotaSaldo(c) {
    return money((c.monto || 0) - (c.pagado || 0));
  }
  function prestamoSaldo(db, prestamoId) {
    return (db.cuotas || [])
      .filter(function (c) {
        return c.prestamoId === prestamoId;
      })
      .reduce(function (a, c) {
        return money(a + cuotaSaldo(c));
      }, 0);
  }
  function prestamoCapitalPendiente(db, prestamoId) {
    return (db.cuotas || [])
      .filter(function (c) {
        return c.prestamoId === prestamoId;
      })
      .reduce(function (a, c) {
        return money(a + money((c.capital || 0) - (c.capitalPagado || 0)));
      }, 0);
  }
  function refreshPrestamoEstado(db, prestamo) {
    if (!prestamo || prestamo.estado === "refinanciado") return;
    var today = todayKey();
    var pending = db.cuotas.filter(function (c) {
      return c.prestamoId === prestamo.id && cuotaSaldo(c) > 0.009;
    });
    if (!pending.length) {
      prestamo.estado = "cancelado";
      return;
    }
    var vencida = pending.some(function (c) {
      return String(c.fechaVencimiento || "") < today;
    });
    prestamo.estado = vencida ? "vencido" : "activo";
  }
  function cajaSaldo(db) {
    return (db.movimientosCaja || []).reduce(function (a, m) {
      if (!m || m.anulado) return a;
      if (m.sentido === "ingreso") return money(a + Number(m.monto || 0));
      return money(a - Number(m.monto || 0));
    }, 0);
  }
  function addCaja(db, user, payload) {
    var row = {
      id: uid("MOV"),
      tipo: payload.tipo,
      categoria: payload.categoria || payload.tipo,
      sentido: payload.sentido,
      monto: money(payload.monto),
      fecha: payload.fecha || todayKey(),
      hora: limaTime(),
      origenTipo: payload.origenTipo || "",
      origenId: payload.origenId || "",
      descripcion: payload.descripcion || "",
      anulado: false,
      usuario: (user && (user.nombre || user.usuario)) || "",
      usuarioId: (user && user.id) || "",
      createdAt: nowIso(),
    };
    db.movimientosCaja.unshift(row);
    return row;
  }
  function sumAportes(db, tipo) {
    return (db.aportes || []).reduce(function (a, r) {
      if (!r || r.anulado) return a;
      if (tipo && r.tipo !== tipo) return a;
      var s = r.sentido === "egreso" ? -1 : 1;
      return money(a + s * Number(r.monto || 0));
    }, 0);
  }
  function capitalColocado(db) {
    return (db.prestamos || []).reduce(function (a, p) {
      if (!p || p.estado === "cancelado" || p.estado === "refinanciado") return a;
      return money(a + prestamoCapitalPendiente(db, p.id));
    }, 0);
  }
  function interesesCobrados(db, from, to) {
    return (db.cobranzas || []).reduce(function (a, c) {
      if (!c || c.anulado) return a;
      if (from && c.fecha < from) return a;
      if (to && c.fecha > to) return a;
      return money(a + Number(c.interesCobrado || 0));
    }, 0);
  }
  function gastosPeriodo(db, from, to) {
    return (db.movimientosCaja || []).reduce(function (a, m) {
      if (!m || m.anulado || m.sentido !== "egreso") return a;
      if (m.tipo !== "gasto" && m.tipo !== "gasto_admin") return a;
      if (from && m.fecha < from) return a;
      if (to && m.fecha > to) return a;
      return money(a + Number(m.monto || 0));
    }, 0);
  }
  function gananciasPagadas(db, from, to) {
    return (db.liquidaciones || []).reduce(function (a, l) {
      if (!l || l.anulado || l.estado !== "pagada") return a;
      if (from && l.fecha < from) return a;
      if (to && l.fecha > to) return a;
      return money(a + Number(l.monto || 0));
    }, 0);
  }
  function inversionistaCapital(db, invId) {
    return (db.aportes || []).reduce(function (a, r) {
      if (!r || r.anulado || r.inversionistaId !== invId) return a;
      var s = r.sentido === "egreso" ? -1 : 1;
      if (r.tipo === "aporte_inversionista" || r.tipo === "devolucion_inversionista") {
        return money(a + s * Number(r.monto || 0));
      }
      return a;
    }, 0);
  }
  function kpis(db) {
    var today = todayKey();
    var weekStart = addPeriod(today, "diaria", -6);
    var clientes = (db.clientes || []).filter(function (c) {
      return c.estado !== "inactivo";
    });
    var prestamosActivos = (db.prestamos || []).filter(function (p) {
      return p.estado === "activo" || p.estado === "vencido";
    });
    var cobHoy = (db.cobranzas || []).filter(function (c) {
      return !c.anulado && c.fecha === today;
    });
    var cobSem = (db.cobranzas || []).filter(function (c) {
      return !c.anulado && c.fecha >= weekStart && c.fecha <= today;
    });
    var vencidas = (db.cuotas || []).filter(function (c) {
      return cuotaSaldo(c) > 0.009 && String(c.fechaVencimiento || "") < today;
    });
    var invActivos = (db.inversionistas || []).filter(function (i) {
      return i.estado === "activo";
    });
    var ganGen = interesesCobrados(db);
    var gastos = gastosPeriodo(db);
    var pagadas = gananciasPagadas(db);
    var pendLiq = (db.liquidaciones || []).reduce(function (a, l) {
      if (!l || l.anulado || l.estado !== "pendiente") return a;
      return money(a + Number(l.monto || 0));
    }, 0);
    var propio = sumAportes(db, "aporte_propio") + sumAportes(db, "devolucion_propio");
    var deInv = sumAportes(db, "aporte_inversionista") + sumAportes(db, "devolucion_inversionista");
    var colocado = capitalColocado(db);
    var caja = cajaSaldo(db);
    var utilNetas = money(ganGen - gastos - pagadas);
    return {
      capitalDisponible: caja,
      capitalPrestado: colocado,
      prestamosActivos: prestamosActivos.length,
      clientes: clientes.length,
      cobranzasDia: cobHoy.reduce(function (a, c) {
        return money(a + Number(c.importe || 0));
      }, 0),
      cobranzasDiaN: cobHoy.length,
      cobranzasSemana: cobSem.reduce(function (a, c) {
        return money(a + Number(c.importe || 0));
      }, 0),
      cuotasVencidas: vencidas.length,
      cuotasVencidasMonto: vencidas.reduce(function (a, c) {
        return money(a + cuotaSaldo(c));
      }, 0),
      gananciasGeneradas: ganGen,
      gananciasPendientes: pendLiq,
      inversionistasActivos: invActivos.length,
      capitalPropio: propio,
      capitalInversionistas: deInv,
      utilidadesNetas: utilNetas,
      gastos: gastos,
      caja: caja,
      ingresos: (db.movimientosCaja || []).reduce(function (a, m) {
        return !m || m.anulado || m.sentido !== "ingreso" ? a : money(a + Number(m.monto || 0));
      }, 0),
      egresos: (db.movimientosCaja || []).reduce(function (a, m) {
        return !m || m.anulado || m.sentido !== "egreso" ? a : money(a + Number(m.monto || 0));
      }, 0),
    };
  }
  function series(db) {
    var today = todayKey();
    var days = [];
    var i;
    for (i = 13; i >= 0; i -= 1) days.push(addPeriod(today, "diaria", -i));
    var cobranzas = days.map(function (d) {
      var monto = (db.cobranzas || []).reduce(function (a, c) {
        return !c || c.anulado || c.fecha !== d ? a : money(a + Number(c.importe || 0));
      }, 0);
      return { label: d.slice(5), fecha: d, valor: monto };
    });
    var prestamos = days.map(function (d) {
      var monto = (db.prestamos || []).reduce(function (a, p) {
        return !p || p.fechaDesembolso !== d ? a : money(a + Number(p.capital || 0));
      }, 0);
      return { label: d.slice(5), fecha: d, valor: monto };
    });
    var s = kpis(db);
    var dist = [
      { label: "Disponible", valor: Math.max(0, s.capitalDisponible) },
      { label: "Colocado", valor: Math.max(0, s.capitalPrestado) },
      { label: "Utilidades", valor: Math.max(0, s.utilidadesNetas) },
    ];
    var meses = [];
    for (i = 5; i >= 0; i -= 1) {
      var d0 = parseDay(today);
      d0.setDate(1);
      d0.setMonth(d0.getMonth() - i);
      var from = dayKey(d0);
      var d1 = new Date(d0.getFullYear(), d0.getMonth() + 1, 0);
      var to = dayKey(d1);
      meses.push({
        label: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][d0.getMonth()],
        ingresos: (db.movimientosCaja || []).reduce(function (a, m) {
          return !m || m.anulado || m.sentido !== "ingreso" || m.fecha < from || m.fecha > to
            ? a
            : money(a + Number(m.monto || 0));
        }, 0),
        egresos: (db.movimientosCaja || []).reduce(function (a, m) {
          return !m || m.anulado || m.sentido !== "egreso" || m.fecha < from || m.fecha > to
            ? a
            : money(a + Number(m.monto || 0));
        }, 0),
      });
    }
    return { cobranzas: cobranzas, prestamos: prestamos, capital: dist, flujo: meses };
  }

  function requireUser(user) {
    if (!user || !user.id) return fail("sesion_invalida");
    return null;
  }
  function validateCliente(body, db, id) {
    var dni = digits(body.dni, 8);
    if (!isDni(dni)) return fail("dni_invalido");
    var nombres = String(body.nombres || "").replace(/\s+/g, " ").trim();
    var apellidos = String(body.apellidos || "").replace(/\s+/g, " ").trim();
    if (!nombres || !apellidos) return fail("nombre_invalido");
    var celular = digits(body.celular);
    if (celular && !isPhone(celular)) return fail("celular_invalido");
    var dup = (db.clientes || []).some(function (c) {
      return c.dni === dni && c.id !== id;
    });
    if (dup) return fail("dni_duplicado");
    return null;
  }

  function login(db, payload) {
    var usuario = fold(payload && payload.usuario);
    var clave = String((payload && payload.clave) || "");
    var row = (db.usuarios || []).filter(function (u) {
      return fold(u.usuario) === usuario && u.estado !== "inactivo";
    })[0];
    if (!row || String(row.clave) !== clave) return fail("clave_invalida");
    return ok({
      id: row.id,
      usuario: row.usuario,
      nombre: row.nombre,
      rol: row.rol || "admin",
    });
  }
  function setupAdmin(db, payload) {
    if ((db.usuarios || []).length) return fail("permiso_denegado");
    var usuario = String((payload && payload.usuario) || "").trim();
    var clave = String((payload && payload.clave) || "");
    var nombre = String((payload && payload.nombre) || "Administrador").trim();
    if (!usuario) return fail("dato_requerido");
    if (clave.length < 6) return fail("clave_corta");
    var row = {
      id: uid("USR"),
      usuario: usuario,
      nombre: nombre,
      rol: "admin",
      clave: clave,
      estado: "activo",
      createdAt: nowIso(),
    };
    db.usuarios.push(row);
    audit(db, row, "alta", "usuarios", row.id, "Alta de administrador inicial");
    return ok({ id: row.id, usuario: row.usuario, nombre: row.nombre, rol: row.rol }, db);
  }
  function changePassword(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var row = find(db.usuarios, user.id);
    if (!row) return fail("sesion_invalida");
    if (String(payload.claveActual || "") !== String(row.clave)) return fail("clave_invalida");
    if (String(payload.claveNueva || "").length < 6) return fail("clave_corta");
    row.clave = String(payload.claveNueva);
    row.updatedAt = nowIso();
    audit(db, user, "editar", "usuarios", row.id, "Cambio de clave");
    return ok({ id: row.id }, db);
  }

  function saveCliente(db, payload, user) {
    var err = requireUser(user) || validateCliente(payload, db, payload.id);
    if (err) return err;
    var row = payload.id ? find(db.clientes, payload.id) : null;
    var data = {
      dni: digits(payload.dni, 8),
      nombres: String(payload.nombres || "").trim(),
      apellidos: String(payload.apellidos || "").trim(),
      fechaNacimiento: String(payload.fechaNacimiento || "").slice(0, 10),
      celular: digits(payload.celular),
      direccion: String(payload.direccion || "").trim(),
      ocupacion: String(payload.ocupacion || "").trim(),
      ref1Nombre: String(payload.ref1Nombre || "").trim(),
      ref1Telefono: digits(payload.ref1Telefono),
      ref2Nombre: String(payload.ref2Nombre || "").trim(),
      ref2Telefono: digits(payload.ref2Telefono),
      observaciones: String(payload.observaciones || "").trim(),
      estado: payload.estado === "inactivo" ? "inactivo" : "activo",
      updatedAt: nowIso(),
    };
    if (row) {
      Object.keys(data).forEach(function (k) {
        row[k] = data[k];
      });
      audit(db, user, "editar", "clientes", row.id, fullName(row));
    } else {
      row = Object.assign({ id: uid("CLI"), createdAt: nowIso() }, data);
      db.clientes.unshift(row);
      audit(db, user, "alta", "clientes", row.id, fullName(row));
    }
    return ok(row, db);
  }
  function saveAval(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var cliente = find(db.clientes, payload.clienteId);
    if (!cliente) return fail("cliente_invalido");
    var dni = digits(payload.dni, 8);
    if (!isDni(dni)) return fail("dni_invalido");
    var nombres = String(payload.nombres || "").trim();
    var apellidos = String(payload.apellidos || "").trim();
    if (!nombres || !apellidos) return fail("nombre_invalido");
    var dup = (db.avales || []).some(function (a) {
      return a.clienteId === cliente.id && a.dni === dni && a.id !== payload.id;
    });
    if (dup) return fail("dni_aval_duplicado");
    var data = {
      clienteId: cliente.id,
      dni: dni,
      nombres: nombres,
      apellidos: apellidos,
      celular: digits(payload.celular),
      direccion: String(payload.direccion || "").trim(),
      ocupacion: String(payload.ocupacion || "").trim(),
      parentesco: String(payload.parentesco || "").trim(),
      observaciones: String(payload.observaciones || "").trim(),
      documentacion: String(payload.documentacion || "").trim(),
      constanciaAceptacion: !!payload.constanciaAceptacion,
      estado: payload.estado === "inactivo" ? "inactivo" : "activo",
      updatedAt: nowIso(),
    };
    var row = payload.id ? find(db.avales, payload.id) : null;
    if (row) {
      Object.keys(data).forEach(function (k) {
        row[k] = data[k];
      });
      audit(db, user, "editar", "avales", row.id, fullName(row));
    } else {
      row = Object.assign({ id: uid("AVL"), createdAt: nowIso() }, data);
      db.avales.unshift(row);
      audit(db, user, "alta", "avales", row.id, fullName(row));
    }
    return ok(row, db);
  }
  function savePrestamo(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var cliente = find(db.clientes, payload.clienteId);
    if (!cliente) return fail("cliente_invalido");
    if (payload.avalId && !find(db.avales, payload.avalId)) return fail("aval_invalido");
    var preview = calcSchedule(payload);
    if (!preview.ok) return preview;
    var plan = preview.data;
    if (payload.id) {
      var old = find(db.prestamos, payload.id);
      if (!old) return fail("prestamo_invalido");
      var hasPay = (db.cobranzas || []).some(function (c) {
        return c.prestamoId === old.id && !c.anulado;
      });
      if (hasPay) return fail("prestamo_bloqueado");
      db.cuotas = db.cuotas.filter(function (c) {
        return c.prestamoId !== old.id;
      });
      db.movimientosCaja.forEach(function (m) {
        if (m.origenId === old.id && m.tipo === "desembolso" && !m.anulado) {
          m.anulado = true;
          m.anuladoAt = nowIso();
          m.anuladoPor = user.nombre;
        }
      });
      Object.assign(old, {
        clienteId: cliente.id,
        avalId: payload.avalId || "",
        capital: plan.capital,
        tasa: plan.tasa,
        tipoTasa: plan.tipoTasa,
        fechaDesembolso: String(payload.fechaDesembolso || todayKey()).slice(0, 10),
        frecuencia: plan.frecuencia,
        nCuotas: plan.nCuotas,
        fechaPrimeraCuota: plan.fechaPrimeraCuota,
        totalIntereses: plan.totalIntereses,
        totalDevolver: plan.totalDevolver,
        valorCuota: plan.valorCuota,
        estado: "activo",
        updatedAt: nowIso(),
      });
      if (cajaSaldo(db) < plan.capital) return fail("caja_insuficiente");
      plan.cuotas.forEach(function (c) {
        db.cuotas.push({
          id: uid("CUO"),
          prestamoId: old.id,
          nro: c.nro,
          fechaVencimiento: c.fechaVencimiento,
          capital: c.capital,
          interes: c.interes,
          monto: c.monto,
          pagado: 0,
          capitalPagado: 0,
          interesPagado: 0,
          estado: "pendiente",
          createdAt: nowIso(),
        });
      });
      addCaja(db, user, {
        tipo: "desembolso",
        sentido: "egreso",
        monto: plan.capital,
        fecha: old.fechaDesembolso,
        origenTipo: "prestamo",
        origenId: old.id,
        descripcion: "Desembolso " + old.codigo,
      });
      refreshPrestamoEstado(db, old);
      audit(db, user, "editar", "prestamos", old.id, old.codigo);
      return ok(old, db);
    }
    if (cajaSaldo(db) < plan.capital) return fail("caja_insuficiente");
    var codigo = nextCode(db.prestamos, "PRE");
    var row = {
      id: uid("PRE"),
      codigo: codigo,
      clienteId: cliente.id,
      avalId: payload.avalId || "",
      capital: plan.capital,
      tasa: plan.tasa,
      tipoTasa: plan.tipoTasa,
      fechaDesembolso: String(payload.fechaDesembolso || todayKey()).slice(0, 10),
      frecuencia: plan.frecuencia,
      nCuotas: plan.nCuotas,
      fechaPrimeraCuota: plan.fechaPrimeraCuota,
      totalIntereses: plan.totalIntereses,
      totalDevolver: plan.totalDevolver,
      valorCuota: plan.valorCuota,
      estado: "activo",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.prestamos.unshift(row);
    plan.cuotas.forEach(function (c) {
      db.cuotas.push({
        id: uid("CUO"),
        prestamoId: row.id,
        nro: c.nro,
        fechaVencimiento: c.fechaVencimiento,
        capital: c.capital,
        interes: c.interes,
        monto: c.monto,
        pagado: 0,
        capitalPagado: 0,
        interesPagado: 0,
        estado: "pendiente",
        createdAt: nowIso(),
      });
    });
    addCaja(db, user, {
      tipo: "desembolso",
      sentido: "egreso",
      monto: plan.capital,
      fecha: row.fechaDesembolso,
      origenTipo: "prestamo",
      origenId: row.id,
      descripcion: "Desembolso " + row.codigo,
    });
    audit(db, user, "alta", "prestamos", row.id, codigo + " · " + fullName(cliente));
    return ok(row, db);
  }
  function registrarPago(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var prestamo = find(db.prestamos, payload.prestamoId);
    if (!prestamo) return fail("prestamo_invalido");
    if (prestamo.estado === "cancelado") return fail("prestamo_cancelado");
    var importe = money(payload.importe);
    if (!(importe > 0)) return fail("importe_invalido");
    var now = Date.now();
    var dup = (db.cobranzas || []).some(function (c) {
      return (
        !c.anulado &&
        c.prestamoId === prestamo.id &&
        money(c.importe) === importe &&
        Math.abs(new Date(c.createdAt).getTime() - now) < 8000
      );
    });
    if (dup) return fail("pago_duplicado");
    var saldo = prestamoSaldo(db, prestamo.id);
    if (importe - saldo > 0.009) return fail("importe_excede_saldo");
    var cuotas = db.cuotas
      .filter(function (c) {
        return c.prestamoId === prestamo.id && cuotaSaldo(c) > 0.009;
      })
      .sort(function (a, b) {
        return a.nro - b.nro;
      });
    var rest = importe;
    var capitalAm = 0;
    var interesCob = 0;
    var firstCuota = cuotas[0] ? cuotas[0].id : "";
    cuotas.forEach(function (c) {
      if (rest <= 0.009) return;
      var capSaldo = money((c.capital || 0) - (c.capitalPagado || 0));
      var intSaldo = money((c.interes || 0) - (c.interesPagado || 0));
      var due = money(capSaldo + intSaldo);
      if (due <= 0) return;
      var pay = money(Math.min(rest, due));
      var payInt = money(due ? pay * (intSaldo / due) : 0);
      var payCap = money(pay - payInt);
      if (payCap > capSaldo) {
        payCap = capSaldo;
        payInt = money(pay - payCap);
      }
      c.pagado = money((c.pagado || 0) + pay);
      c.capitalPagado = money((c.capitalPagado || 0) + payCap);
      c.interesPagado = money((c.interesPagado || 0) + payInt);
      if (cuotaSaldo(c) <= 0.009) {
        c.pagado = c.monto;
        c.estado = "pagada";
      } else c.estado = "parcial";
      capitalAm = money(capitalAm + payCap);
      interesCob = money(interesCob + payInt);
      rest = money(rest - pay);
      if (!firstCuota) firstCuota = c.id;
    });
    var codigo = nextCode(db.cobranzas, "COB");
    var cob = {
      id: uid("COB"),
      codigo: codigo,
      clienteId: prestamo.clienteId,
      prestamoId: prestamo.id,
      cuotaId: payload.cuotaId || firstCuota,
      fecha: String(payload.fecha || todayKey()).slice(0, 10),
      hora: limaTime(),
      importe: importe,
      capitalAmortizado: capitalAm,
      interesCobrado: interesCob,
      saldoPendiente: prestamoSaldo(db, prestamo.id),
      usuario: (user && (user.nombre || user.usuario)) || "",
      usuarioId: (user && user.id) || "",
      anulado: false,
      createdAt: nowIso(),
    };
    db.cobranzas.unshift(cob);
    addCaja(db, user, {
      tipo: "cobranza",
      sentido: "ingreso",
      monto: importe,
      fecha: cob.fecha,
      origenTipo: "cobranza",
      origenId: cob.id,
      descripcion: "Cobranza " + codigo + " · cap " + capitalAm + " · int " + interesCob,
    });
    refreshPrestamoEstado(db, prestamo);
    audit(db, user, "alta", "cobranzas", cob.id, codigo);
    return ok(cob, db);
  }
  function anularPago(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var cob = find(db.cobranzas, payload.id);
    if (!cob || cob.anulado) return fail("movimiento_invalido");
    cob.anulado = true;
    cob.anuladoAt = nowIso();
    cob.anuladoPor = user.nombre;
    db.movimientosCaja.forEach(function (m) {
      if (m.origenId === cob.id && m.tipo === "cobranza" && !m.anulado) {
        m.anulado = true;
        m.anuladoAt = nowIso();
        m.anuladoPor = user.nombre;
      }
    });
    var prestamo = find(db.prestamos, cob.prestamoId);
    rebuildCuotasFromPays(db, cob.prestamoId);
    if (prestamo) refreshPrestamoEstado(db, prestamo);
    audit(db, user, "anular", "cobranzas", cob.id, cob.codigo);
    return ok(cob, db);
  }
  function rebuildCuotasFromPays(db, prestamoId) {
    var cuotas = db.cuotas
      .filter(function (c) {
        return c.prestamoId === prestamoId;
      })
      .sort(function (a, b) {
        return a.nro - b.nro;
      });
    cuotas.forEach(function (c) {
      c.pagado = 0;
      c.capitalPagado = 0;
      c.interesPagado = 0;
      c.estado = "pendiente";
    });
    var pays = db.cobranzas
      .filter(function (c) {
        return c.prestamoId === prestamoId && !c.anulado;
      })
      .sort(function (a, b) {
        return String(a.createdAt).localeCompare(String(b.createdAt));
      });
    pays.forEach(function (pay) {
      var rest = money(pay.importe);
      cuotas.forEach(function (c) {
        if (rest <= 0.009) return;
        var capSaldo = money((c.capital || 0) - (c.capitalPagado || 0));
        var intSaldo = money((c.interes || 0) - (c.interesPagado || 0));
        var due = money(capSaldo + intSaldo);
        if (due <= 0) return;
        var amt = money(Math.min(rest, due));
        var payInt = money(due ? amt * (intSaldo / due) : 0);
        var payCap = money(amt - payInt);
        c.pagado = money((c.pagado || 0) + amt);
        c.capitalPagado = money((c.capitalPagado || 0) + payCap);
        c.interesPagado = money((c.interesPagado || 0) + payInt);
        c.estado = cuotaSaldo(c) <= 0.009 ? "pagada" : "parcial";
        rest = money(rest - amt);
      });
      pay.saldoPendiente = cuotas.reduce(function (a, c) {
        return money(a + cuotaSaldo(c));
      }, 0);
    });
  }
  function saveInversionista(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var dni = digits(payload.dni, 8);
    if (!isDni(dni)) return fail("dni_invalido");
    var nombres = String(payload.nombres || "").trim();
    var apellidos = String(payload.apellidos || "").trim();
    if (!nombres || !apellidos) return fail("nombre_invalido");
    var dup = (db.inversionistas || []).some(function (i) {
      return i.dni === dni && i.id !== payload.id;
    });
    if (dup) return fail("inversionista_dni");
    var modalidad = payload.modalidad === "utilidades" ? "utilidades" : "fija";
    var data = {
      dni: dni,
      nombres: nombres,
      apellidos: apellidos,
      celular: digits(payload.celular),
      direccion: String(payload.direccion || "").trim(),
      fechaIncorporacion: String(payload.fechaIncorporacion || todayKey()).slice(0, 10),
      modalidad: modalidad,
      porcentaje: money(payload.porcentaje || 0),
      montoAcordado: money(payload.montoAcordado || 0),
      frecuenciaLiquidacion: String(payload.frecuenciaLiquidacion || "mensual"),
      fechaVencimiento: String(payload.fechaVencimiento || "").slice(0, 10),
      estado: payload.estado === "inactivo" ? "inactivo" : "activo",
      updatedAt: nowIso(),
    };
    var row = payload.id ? find(db.inversionistas, payload.id) : null;
    if (row) {
      Object.keys(data).forEach(function (k) {
        row[k] = data[k];
      });
      audit(db, user, "editar", "inversionistas", row.id, fullName(row));
      return ok(row, db);
    }
    row = Object.assign({ id: uid("INV"), createdAt: nowIso() }, data);
    db.inversionistas.unshift(row);
    var monto = money(payload.montoAportado || payload.monto || 0);
    if (monto > 0) {
      registrarAporteInternal(db, user, {
        inversionistaId: row.id,
        monto: monto,
        fecha: payload.fechaAporte || row.fechaIncorporacion,
        tipo: "aporte_inversionista",
      });
    }
    audit(db, user, "alta", "inversionistas", row.id, fullName(row));
    return ok(row, db);
  }
  function registrarAporteInternal(db, user, payload) {
    var inv = find(db.inversionistas, payload.inversionistaId);
    if (!inv) return fail("inversionista_invalido");
    var monto = money(payload.monto);
    if (!(monto > 0)) return fail("importe_invalido");
    var tipo = payload.tipo || "aporte_inversionista";
    var sentido = tipo.indexOf("devolucion") === 0 ? "egreso" : "ingreso";
    if (sentido === "egreso") {
      var vigente = inversionistaCapital(db, inv.id);
      if (monto - vigente > 0.009) return fail("importe_excede_saldo");
      if (cajaSaldo(db) < monto) return fail("caja_insuficiente");
    }
    var row = {
      id: uid("APO"),
      inversionistaId: inv.id,
      tipo: tipo,
      sentido: sentido,
      monto: monto,
      fecha: String(payload.fecha || todayKey()).slice(0, 10),
      anulado: false,
      createdAt: nowIso(),
    };
    db.aportes.unshift(row);
    addCaja(db, user, {
      tipo: tipo,
      sentido: sentido,
      monto: monto,
      fecha: row.fecha,
      origenTipo: "aporte",
      origenId: row.id,
      descripcion: (sentido === "egreso" ? "Devolución " : "Aporte ") + fullName(inv),
    });
    return ok(row, db);
  }
  function registrarAporte(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var res = registrarAporteInternal(db, user, payload);
    if (res.ok) audit(db, user, "alta", "aportes", res.data.id, res.data.tipo);
    return res;
  }
  function calcularGanancia(db, inv) {
    var cap = inversionistaCapital(db, inv.id);
    if (inv.modalidad === "fija") {
      if (inv.montoAcordado > 0) return money(inv.montoAcordado);
      return money(cap * (Number(inv.porcentaje || 0) / 100));
    }
    var totalInv = (db.inversionistas || []).reduce(function (a, i) {
      return i.estado === "activo" ? money(a + inversionistaCapital(db, i.id)) : a;
    }, 0);
    var util = money(interesesCobrados(db) - gastosPeriodo(db) - gananciasPagadas(db));
    if (util < 0) util = 0;
    var pct = Number(inv.porcentaje || 0) / 100;
    if (totalInv > 0 && !(pct > 0)) return money(util * (cap / totalInv));
    return money(util * pct);
  }
  function generarLiquidacion(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var inv = find(db.inversionistas, payload.inversionistaId);
    if (!inv) return fail("inversionista_invalido");
    var monto = money(payload.monto != null ? payload.monto : calcularGanancia(db, inv));
    if (!(monto > 0)) return fail("importe_invalido");
    var row = {
      id: uid("LIQ"),
      inversionistaId: inv.id,
      fecha: todayKey(),
      monto: monto,
      modalidad: inv.modalidad,
      estado: "pendiente",
      anulado: false,
      createdAt: nowIso(),
    };
    db.liquidaciones.unshift(row);
    audit(db, user, "alta", "liquidaciones", row.id, fullName(inv));
    return ok(row, db);
  }
  function pagarLiquidacion(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var liq = find(db.liquidaciones, payload.id);
    if (!liq || liq.anulado || liq.estado === "pagada") return fail("liquidacion_invalida");
    if (cajaSaldo(db) < liq.monto) return fail("caja_insuficiente");
    liq.estado = "pagada";
    liq.fechaPago = todayKey();
    liq.updatedAt = nowIso();
    addCaja(db, user, {
      tipo: "pago_ganancia",
      sentido: "egreso",
      monto: liq.monto,
      fecha: liq.fechaPago,
      origenTipo: "liquidacion",
      origenId: liq.id,
      descripcion: "Pago de ganancias",
    });
    audit(db, user, "pagar", "liquidaciones", liq.id, "Pago liquidación");
    return ok(liq, db);
  }
  function registrarMovimiento(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var monto = money(payload.monto);
    if (!(monto > 0)) return fail("importe_invalido");
    var tipo = String(payload.tipo || "gasto");
    var sentido = payload.sentido || (tipo.indexOf("aporte") === 0 ? "ingreso" : "egreso");
    if (sentido === "egreso" && cajaSaldo(db) < monto) return fail("caja_insuficiente");
    if (tipo === "aporte_propio" || tipo === "devolucion_propio") {
      var ap = {
        id: uid("APO"),
        inversionistaId: "",
        tipo: tipo,
        sentido: sentido,
        monto: monto,
        fecha: String(payload.fecha || todayKey()).slice(0, 10),
        anulado: false,
        createdAt: nowIso(),
      };
      db.aportes.unshift(ap);
    }
    var row = addCaja(db, user, {
      tipo: tipo,
      sentido: sentido,
      monto: monto,
      fecha: payload.fecha,
      descripcion: payload.descripcion || "",
      origenTipo: "caja",
      origenId: "",
    });
    audit(db, user, "alta", "movimientosCaja", row.id, tipo);
    return ok(row, db);
  }
  function anularMovimiento(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var m = find(db.movimientosCaja, payload.id);
    if (!m) return fail("movimiento_invalido");
    if (m.anulado) return fail("movimiento_anulado");
    if (m.tipo === "cobranza" || m.tipo === "desembolso" || m.tipo === "pago_ganancia") {
      return fail("permiso_denegado", "Anule la operación de origen.");
    }
    m.anulado = true;
    m.anuladoAt = nowIso();
    m.anuladoPor = user.nombre;
    if (m.origenId) {
      db.aportes.forEach(function (a) {
        if (a.id === m.origenId) a.anulado = true;
      });
    }
    audit(db, user, "anular", "movimientosCaja", m.id, m.tipo);
    return ok(m, db);
  }
  function saveConfig(db, payload, user) {
    var err = requireUser(user);
    if (err) return err;
    var cfg = cfgOf(db);
    ["empresa", "simbolo", "tasaDefault", "tipoTasaDefault", "frecuenciaDefault", "nCuotasDefault", "avisoLegal"].forEach(
      function (k) {
        if (payload[k] != null) cfg[k] = payload[k];
      }
    );
    cfg.tasaDefault = money(cfg.tasaDefault);
    cfg.nCuotasDefault = Number(cfg.nCuotasDefault) || 4;
    audit(db, user, "editar", "configuracion", cfg.id, "Configuración");
    return ok(cfg, db);
  }
  function inRange(fecha, from, to) {
    if (from && fecha < from) return false;
    if (to && fecha > to) return false;
    return true;
  }
  function reporte(db, payload) {
    var tipo = String((payload && payload.tipo) || "clientes");
    var from = String((payload && payload.from) || "");
    var to = String((payload && payload.to) || "");
    var rows = [];
    if (tipo === "clientes") {
      rows = (db.clientes || []).filter(function (c) {
        return !from || String(c.createdAt || "").slice(0, 10) >= from;
      });
    } else if (tipo === "prestamos" || tipo === "prestamos_otorgados") {
      rows = (db.prestamos || []).filter(function (p) {
        return inRange(p.fechaDesembolso, from, to);
      });
    } else if (tipo === "prestamos_cancelados") {
      rows = (db.prestamos || []).filter(function (p) {
        return p.estado === "cancelado" && inRange(p.updatedAt && p.updatedAt.slice(0, 10), from, to);
      });
    } else if (tipo === "prestamos_pendientes") {
      rows = (db.prestamos || []).filter(function (p) {
        return p.estado === "activo" || p.estado === "vencido";
      });
    } else if (tipo === "cobranzas") {
      rows = (db.cobranzas || []).filter(function (c) {
        return !c.anulado && inRange(c.fecha, from, to);
      });
    } else if (tipo === "cuotas_vencidas") {
      var today = todayKey();
      rows = (db.cuotas || []).filter(function (c) {
        return cuotaSaldo(c) > 0.009 && c.fechaVencimiento < today;
      });
    } else if (tipo === "intereses") {
      rows = (db.cobranzas || []).filter(function (c) {
        return !c.anulado && inRange(c.fecha, from, to) && c.interesCobrado > 0;
      });
    } else if (tipo === "gastos") {
      rows = (db.movimientosCaja || []).filter(function (m) {
        return !m.anulado && m.sentido === "egreso" && (m.tipo === "gasto" || m.tipo === "gasto_admin") && inRange(m.fecha, from, to);
      });
    } else if (tipo === "caja" || tipo === "capital") {
      rows = (db.movimientosCaja || []).filter(function (m) {
        return !m.anulado && inRange(m.fecha, from, to);
      });
    } else if (tipo === "inversionistas") {
      rows = (db.inversionistas || []).slice();
    } else if (tipo === "ganancias") {
      rows = (db.liquidaciones || []).filter(function (l) {
        return !l.anulado && inRange(l.fecha, from, to);
      });
    }
    return ok({ tipo: tipo, rows: rows, kpis: kpis(db) });
  }
  function dashboard(db) {
    return ok({ kpis: kpis(db), series: series(db), cfg: cfgOf(db) });
  }
  function clienteHistorial(db, id) {
    var cli = find(db.clientes, id);
    if (!cli) return fail("cliente_invalido");
    var prestamos = db.prestamos.filter(function (p) {
      return p.clienteId === id;
    });
    var ids = prestamos.map(function (p) {
      return p.id;
    });
    return ok({
      cliente: cli,
      avales: db.avales.filter(function (a) {
        return a.clienteId === id;
      }),
      prestamos: prestamos,
      cobranzas: db.cobranzas.filter(function (c) {
        return ids.indexOf(c.prestamoId) >= 0;
      }),
    });
  }
  function inversionistaEstado(db, id) {
    var inv = find(db.inversionistas, id);
    if (!inv) return fail("inversionista_invalido");
    var aportes = db.aportes.filter(function (a) {
      return a.inversionistaId === id;
    });
    var liqs = db.liquidaciones.filter(function (l) {
      return l.inversionistaId === id;
    });
    var pagadas = liqs.reduce(function (a, l) {
      return l.estado === "pagada" && !l.anulado ? money(a + l.monto) : a;
    }, 0);
    var pendientes = liqs.reduce(function (a, l) {
      return l.estado === "pendiente" && !l.anulado ? money(a + l.monto) : a;
    }, 0);
    return ok({
      inversionista: inv,
      aportes: aportes,
      liquidaciones: liqs,
      capitalVigente: inversionistaCapital(db, id),
      gananciasPagadas: pagadas,
      gananciasPendientes: pendientes,
      gananciaEstimada: calcularGanancia(db, inv),
    });
  }

  function dispatch(action, db, payload, user) {
    db = normalizeDb(db);
    payload = payload || {};
    var fn = {
      login: function () {
        return login(db, payload);
      },
      setupAdmin: function () {
        return setupAdmin(db, payload);
      },
      changePassword: function () {
        return changePassword(db, payload, user);
      },
      dashboard: function () {
        return dashboard(db);
      },
      saveCliente: function () {
        return saveCliente(db, payload, user);
      },
      saveAval: function () {
        return saveAval(db, payload, user);
      },
      previewPrestamo: function () {
        return calcSchedule(payload);
      },
      savePrestamo: function () {
        return savePrestamo(db, payload, user);
      },
      registrarPago: function () {
        return registrarPago(db, payload, user);
      },
      anularPago: function () {
        return anularPago(db, payload, user);
      },
      saveInversionista: function () {
        return saveInversionista(db, payload, user);
      },
      registrarAporte: function () {
        return registrarAporte(db, payload, user);
      },
      generarLiquidacion: function () {
        return generarLiquidacion(db, payload, user);
      },
      pagarLiquidacion: function () {
        return pagarLiquidacion(db, payload, user);
      },
      registrarMovimiento: function () {
        return registrarMovimiento(db, payload, user);
      },
      anularMovimiento: function () {
        return anularMovimiento(db, payload, user);
      },
      saveConfig: function () {
        return saveConfig(db, payload, user);
      },
      reporte: function () {
        return reporte(db, payload);
      },
      clienteHistorial: function () {
        return clienteHistorial(db, payload.id);
      },
      inversionistaEstado: function () {
        return inversionistaEstado(db, payload.id);
      },
      db: function () {
        return ok(db);
      },
    }[action];
    if (!fn) return fail("accion_desconocida");
    return fn();
  }

  root.ImpulsaEngine = {
    TABLES: TABLES,
    MSG: MSG,
    money: money,
    todayKey: todayKey,
    limaDate: limaDate,
    limaTime: limaTime,
    addPeriod: addPeriod,
    uid: uid,
    isDni: isDni,
    digits: digits,
    fold: fold,
    fullName: fullName,
    emptyDb: emptyDb,
    normalizeDb: normalizeDb,
    calcSchedule: calcSchedule,
    kpis: kpis,
    series: series,
    cajaSaldo: cajaSaldo,
    cuotaSaldo: cuotaSaldo,
    prestamoSaldo: prestamoSaldo,
    inversionistaCapital: inversionistaCapital,
    calcularGanancia: calcularGanancia,
    cfgOf: cfgOf,
    find: find,
    dispatch: dispatch,
    clone: clone,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
