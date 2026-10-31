# -*- coding: utf-8 -*-
from __future__ import print_function
import json
import sys
import time
import urllib.error
import urllib.request

API = "https://script.google.com/macros/s/AKfycbz3wsRn1frz1itfz919oh_KzI36ObxYezIdWpSpJfwCy82wn5C34ghm-zM_lGcB-zGJ/exec"
TIMEOUT = 90
session = None
log_rows = []

CLIENTES = [
    ("51110001", "Elena Patricia", "Ruiz Campos", "969110001", "973110001", "Av. Grau 245, Piura"),
    ("51110002", "Marco Antonio", "Delgado Pineda", "969110002", "973110002", "Jr. Lima 118, Castilla"),
    ("51110003", "Lucía Fernanda", "Sánchez Quispe", "969110003", "973110003", "Urb. Santa Rosa Mz. C Lt. 4, Piura"),
    ("51110004", "Pedro Pablo", "Mendoza Silva", "969110004", "973110004", "Calle Tacna 90, Sullana"),
    ("51110005", "Rosa Isabel", "Flores Navarro", "969110005", "973110005", "Av. Sánchez Cerro 560, Piura"),
    ("51110006", "José Enrique", "Huamán Díaz", "969110006", "973110006", "Jr. Ayacucho 32, Catacaos"),
    ("51110007", "Ana Cecilia", "Torres Guevara", "969110007", "973110007", "Mz. B Lt. 12, Los Algarrobos, Piura"),
    ("51110008", "Miguel Ángel", "Castillo Ríos", "969110008", "973110008", "Av. Vice 210, Sechura"),
    ("51110009", "Patricia Elena", "Salazar Núñez", "969110009", "973110009", "Calle Comercio 45, Talara"),
    ("51110010", "Jorge Luis", "Paredes Cueva", "969110010", "973110010", "Urb. El Chilcal Mz. A Lt. 9, Piura"),
]
LIBRES = [
    ("51110011", "Carmen Rosa", "Vega León", "969110011", "973110011", "Jr. Huancabamba 14, Piura"),
    ("51110012", "Héctor Raúl", "Núñez Palacios", "969110012", "973110012", "Av. Independencia 780, Piura"),
    ("51110013", "Silvia Esther", "Rojas Chávez", "969110013", "973110013", "Calle Arequipa 201, Sullana"),
    ("51110014", "Félix Alberto", "Cueva Paz", "969110014", "973110014", "Urb. Miraflores Mz. D Lt. 2, Piura"),
    ("51110015", "Nancy Pilar", "Aguilar Soto", "969110015", "973110015", "Jr. Ica 55, Castilla"),
    ("51110016", "Óscar Daniel", "Pinto Ramos", "969110016", "973110016", "Av. Panamericana 330, Piura"),
    ("51110017", "Verónica Inés", "López Farfán", "969110017", "973110017", "Calle Bolívar 18, Catacaos"),
    ("51110018", "Raúl Ernesto", "Cruz Távara", "969110018", "973110018", "Mz. E Lt. 7, Los Ejidos, Piura"),
    ("51110019", "Gloria Beatriz", "Reyes Alvarado", "969110019", "973110019", "Jr. Cusco 77, Talara"),
    ("51110020", "Iván Ricardo", "Salas Montalvo", "969110020", "973110020", "Av. Bolognesi 412, Piura"),
]
AVALES = [
    ("52110001", "Carlos Alberto", "Ruiz Peña", "Hermano", "Jr. Lima 80, Piura"),
    ("52110002", "María Elena", "Pineda Soto", "Cónyuge", "Calle Grau 12, Castilla"),
    ("52110003", "Luis Fernando", "Quispe Rojas", "Padre", "Av. Sánchez Cerro 90, Piura"),
    ("52110004", "Rosa María", "Silva Campos", "Hermana", "Jr. Tacna 44, Sullana"),
    ("52110005", "Jorge Antonio", "Navarro Díaz", "Tío", "Urb. Santa Rosa Mz. A Lt. 1, Piura"),
    ("52110006", "Ana Lucía", "Díaz Huamán", "Cónyuge", "Calle Ayacucho 9, Catacaos"),
    ("52110007", "Pedro José", "Guevara Torres", "Hermano", "Mz. C Lt. 3, Los Algarrobos, Piura"),
    ("52110008", "Elena Ruth", "Ríos Castillo", "Madre", "Av. Vice 100, Sechura"),
    ("52110009", "Miguel Ángel", "Núñez Salazar", "Primo", "Calle Comercio 8, Talara"),
    ("52110010", "Lucía Isabel", "Cueva Paredes", "Hermana", "Urb. El Chilcal Mz. B Lt. 2, Piura"),
]
INVS = [
    ("53110001", "Ricardo Alonso", "Benavides López", 8000),
    ("53110002", "Carmen Rosa", "Delgado Vega", 6000),
    ("53110003", "Alberto Jesús", "Farfán Córdova", 5000),
    ("53110004", "Sofía Elena", "Paredes Rivas", 0),
    ("53110005", "Manuel Enrique", "Távara Cruz", 0),
    ("53110006", "Liliana Ruth", "Cáceres Ponce", 0),
    ("53110007", "Diego Armando", "Salinas Vera", 0),
    ("53110008", "Paola Andrea", "Mena Gutiérrez", 0),
    ("53110009", "Walter Iván", "Ortiz Palacios", 0),
    ("53110010", "Karina Isabel", "Berrú Campos", 0),
]


def log(ok, name, extra="", ms=0):
    log_rows.append((ok, name, extra, ms))
    print("[%s] %s %sms %s" % ("OK" if ok else "FAIL", name, ms, extra), flush=True)


def parse(raw):
    text = raw.decode("utf-8", "replace").strip()
    try:
        return json.loads(text)
    except Exception:
        return {"ok": False, "message": text[:240]}


def call(method, action=None, payload=None):
    t0 = time.time()
    try:
        if method == "GET":
            req = urllib.request.Request(API, method="GET", headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
                data = parse(res.read())
                return True, data, int((time.time() - t0) * 1000)
        body = json.dumps({"action": action, "payload": payload or {}, "session": session}, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(API, data=body, method="POST", headers={"Content-Type": "text/plain;charset=utf-8", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            data = parse(res.read())
            return bool(data.get("ok")), data, int((time.time() - t0) * 1000)
    except urllib.error.HTTPError as err:
        data = parse(err.read())
        return False, data, int((time.time() - t0) * 1000)
    except Exception as exc:
        return False, {"ok": False, "message": str(exc)}, int((time.time() - t0) * 1000)


def post(action, payload, name):
    ok, data, ms = call("POST", action, payload)
    extra = ""
    if ok:
        row = data.get("data") or {}
        extra = row.get("id") or row.get("codigo") or ""
    else:
        extra = data.get("error") or data.get("message") or ""
    log(ok, name, extra, ms)
    return data if ok else {}


def dni_of(rows, dni):
    for row in rows or []:
        if str(row.get("dni") or "") == str(dni):
            return row
    return None


def pack(data):
    if data.get("db"):
        return data["db"]
    inner = data.get("data")
    if isinstance(inner, dict) and "clientes" in inner:
        return inner
    return {}


def main():
    global session
    ok, ping, ms = call("GET")
    log(ok and ping.get("ok") is True, "GET ping", json.dumps(ping)[:80], ms)

    data = post("login", {"usuario": "Administrador", "clave": "luismario2026"}, "POST login")
    user = data.get("data") or {}
    if not user.get("id"):
        print("STOP login")
        return 1
    session = {"id": user["id"], "usuario": user.get("usuario"), "nombre": user.get("nombre"), "rol": "admin"}

    ok, dump, ms = call("POST", "db", {})
    db = pack(dump)
    log(ok and dump.get("ok"), "GET db inicial", "cli=%s av=%s pre=%s cob=%s inv=%s caja=%s" % (
        len(db.get("clientes") or []), len(db.get("avales") or []), len(db.get("prestamos") or []),
        len(db.get("cobranzas") or []), len(db.get("inversionistas") or []), len(db.get("movimientosCaja") or [])
    ), ms)

    ids_cli = []
    for dni, nom, ape, t1, t2, dir_ in CLIENTES:
        exist = dni_of(db.get("clientes"), dni)
        payload = {
            "dni": dni, "nombres": nom, "apellidos": ape, "celular": t1, "ref1Telefono": t2,
            "correo": nom.split()[0].lower() + "." + ape.split()[0].lower() + dni[-2:] + "@correo.pe",
            "direccion": dir_,
        }
        if exist:
            payload["id"] = exist["id"]
        res = post("saveCliente", payload, "POST cliente " + dni)
        cid = ((res.get("data") or {}).get("id")) or (exist or {}).get("id")
        ids_cli.append(cid)

    ids_lib = []
    for dni, nom, ape, t1, t2, dir_ in LIBRES:
        exist = dni_of(db.get("clientes"), dni)
        payload = {
            "dni": dni, "nombres": nom, "apellidos": ape, "celular": t1, "ref1Telefono": t2,
            "correo": "libre." + dni + "@correo.pe", "direccion": dir_,
        }
        if exist:
            payload["id"] = exist["id"]
        res = post("saveCliente", payload, "POST cliente libre " + dni)
        ids_lib.append(((res.get("data") or {}).get("id")) or (exist or {}).get("id"))

    ids_av = []
    for i, row in enumerate(AVALES):
        dni, nom, ape, par, dir_ = row
        payload = {
            "clienteId": ids_cli[i], "dni": dni, "nombres": nom, "apellidos": ape,
            "celular": "98711" + dni[-3:], "direccion": dir_, "parentesco": par,
        }
        res = post("saveAval", payload, "POST aval " + dni)
        ids_av.append((res.get("data") or {}).get("id"))

    post("registrarMovimiento", {
        "tipo": "aporte_propio", "sentido": "ingreso", "monto": 40000, "fecha": "2026-10-31",
        "descripcion": "Capital operativo Impulsa",
    }, "POST caja aporte 40000")

    ids_inv = []
    ids_inv_lib = []
    for dni, nom, ape, monto in INVS:
        payload = {
            "dni": dni, "nombres": nom, "apellidos": ape, "celular": "99911" + dni[-3:],
            "direccion": "Piura", "fechaIncorporacion": "2026-10-15",
            "fechaAporte": "2026-10-15", "porcentaje": 4 if monto else 0,
        }
        if monto:
            payload["montoAportado"] = monto
        res = post("saveInversionista", payload, "POST inversionista " + dni)
        iid = (res.get("data") or {}).get("id")
        ids_inv.append(iid)
        if not monto:
            ids_inv_lib.append(iid)

    ids_pre = []
    for i, cid in enumerate(ids_cli):
        if not cid:
            continue
        res = post("savePrestamo", {
            "clienteId": cid, "avalId": ids_av[i] if i < len(ids_av) else "",
            "capital": 800, "tasa": 10, "nCuotas": 4, "tipoTasa": "plana",
            "frecuencia": "semanal", "fechaDesembolso": "2026-10-31",
            "fechaPrimeraCuota": "2026-11-07",
        }, "POST prestamo cli " + str(i + 1))
        ids_pre.append((res.get("data") or {}).get("id"))

    ids_cob = []
    for i, pid in enumerate(ids_pre):
        if not pid:
            continue
        res = post("registrarPago", {"prestamoId": pid, "importe": 220, "fecha": "2026-11-07"}, "POST cobranza " + str(i + 1))
        ids_cob.append((res.get("data") or {}).get("id"))

    ids_gasto = []
    gastos = ["Útiles de oficina", "Movilidad", "Internet", "Mantenimiento", "Agua", "Luz", "Papelería", "Transporte", "Limpieza", "Otros gastos"]
    for i, desc in enumerate(gastos):
        res = post("registrarMovimiento", {
            "tipo": "gasto", "sentido": "egreso", "monto": 12 + i, "fecha": "2026-10-31", "descripcion": desc,
        }, "POST caja gasto " + str(i + 1))
        ids_gasto.append((res.get("data") or {}).get("id"))

    for i, (dni, nom, ape, t1, t2, dir_) in enumerate(CLIENTES):
        cid = ids_cli[i]
        if not cid:
            continue
        post("saveCliente", {
            "id": cid, "dni": dni, "nombres": nom, "apellidos": ape + " Editado",
            "celular": t1, "ref1Telefono": t2,
            "correo": nom.split()[0].lower() + ".edit" + dni[-2:] + "@correo.pe",
            "direccion": dir_,
        }, "PUT cliente " + dni)

    for i, row in enumerate(AVALES):
        aid = ids_av[i] if i < len(ids_av) else None
        if not aid:
            continue
        dni, nom, ape, par, dir_ = row
        post("saveAval", {
            "id": aid, "clienteId": ids_cli[i], "dni": dni, "nombres": nom,
            "apellidos": ape + " Editado", "celular": "98711" + dni[-3:],
            "direccion": dir_, "parentesco": par,
        }, "PUT aval " + dni)

    for i, iid in enumerate(ids_inv_lib[:5]):
        if not iid:
            continue
        dni, nom, ape, _monto = INVS[i + 3]
        post("saveInversionista", {
            "id": iid, "dni": dni, "nombres": nom, "apellidos": ape + " Editado",
            "celular": "99911" + dni[-3:], "direccion": "Piura centro",
            "fechaIncorporacion": "2026-10-15",
        }, "PUT inversionista " + dni)

    ok, dump, ms = call("POST", "db", {})
    db2 = pack(dump)
    log(ok, "GET db final", "cli=%s av=%s pre=%s cuo=%s cob=%s inv=%s ap=%s caja=%s" % (
        len(db2.get("clientes") or []), len(db2.get("avales") or []), len(db2.get("prestamos") or []),
        len(db2.get("cuotas") or []), len(db2.get("cobranzas") or []), len(db2.get("inversionistas") or []),
        len(db2.get("aportes") or []), len(db2.get("movimientosCaja") or [])
    ), ms)

    ok, dash, ms = call("POST", "dashboard", {})
    k = ((dash.get("data") or {}).get("kpis")) or {}
    log(ok, "GET dashboard", "caja=%s colocado=%s clientes=%s prestamos=%s" % (
        k.get("caja"), k.get("capitalPrestado"), k.get("clientes"), k.get("prestamosActivos")
    ), ms)

    for i, cid in enumerate(ids_cli):
        if cid:
            post("clienteHistorial", {"id": cid}, "GET historial " + str(i + 1))

    for tipo in ("clientes", "prestamos", "cobranzas", "caja", "inversionistas", "cuotas_vencidas", "intereses", "gastos"):
        post("reporte", {"tipo": tipo}, "GET reporte " + tipo)

    for i, iid in enumerate(ids_inv[:3]):
        if iid:
            post("inversionistaEstado", {"id": iid}, "GET estado inv " + str(i + 1))

    for i, gid in enumerate(ids_gasto):
        if gid:
            post("anularMovimiento", {"id": gid}, "DELETE anular gasto " + str(i + 1))

    for cob_id in ids_cob[:2]:
        if cob_id:
            post("anularPago", {"id": cob_id}, "DELETE anular pago")

    for i, aid in enumerate(ids_av[:0]):
        pass
    for iid in ids_inv_lib:
        if iid:
            post("quitarInversionista", {"id": iid}, "DELETE inversionista vacío")

    for cid in ids_cli[:1]:
        ok, data, ms = call("POST", "quitarCliente", {"id": cid})
        log((not ok) or data.get("ok") is False, "DELETE cliente préstamo bloqueado", data.get("error"), ms)

    for cid in ids_lib:
        if cid:
            post("quitarCliente", {"id": cid}, "DELETE cliente libre")

    ok, dump, ms = call("POST", "db", {})
    db3 = pack(dump)
    log(ok, "GET db tras delete", "cli=%s av=%s pre=%s cob=%s inv=%s caja=%s" % (
        len(db3.get("clientes") or []), len(db3.get("avales") or []), len(db3.get("prestamos") or []),
        len(db3.get("cobranzas") or []), len(db3.get("inversionistas") or []), len(db3.get("movimientosCaja") or [])
    ), ms)

    print("")
    passed = sum(1 for o, _, _, _ in log_rows if o)
    failed = [(n, e) for o, n, e, _ in log_rows if not o]
    gets = [r for r in log_rows if r[1].startswith("GET")]
    posts = [r for r in log_rows if r[1].startswith("POST")]
    puts = [r for r in log_rows if r[1].startswith("PUT")]
    dels = [r for r in log_rows if r[1].startswith("DELETE")]
    def avg(lst):
        if not lst:
            return 0
        return int(sum(x[3] for x in lst) / len(lst))
    print("RESUMEN %s/%s OK" % (passed, len(log_rows)))
    print("GET %s  avg %sms  max %sms" % (len(gets), avg(gets), max((x[3] for x in gets), default=0)))
    print("POST %s avg %sms  max %sms" % (len(posts), avg(posts), max((x[3] for x in posts), default=0)))
    print("PUT %s  avg %sms" % (len(puts), avg(puts)))
    print("DELETE %s avg %sms" % (len(dels), avg(dels)))
    if failed:
        print("FALLIDOS:")
        for n, e in failed:
            print(" - %s :: %s" % (n, e))
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
