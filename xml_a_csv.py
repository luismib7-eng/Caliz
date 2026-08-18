#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monitor de Precios de Combustibles — pipeline XML → CSV
=======================================================

Convierte el XML oficial de precios de la CNE al CSV que consume el tablero
(modalidad local / GitHub Actions de la arquitectura dual).

Uso
---
    # Genera fallback.csv, que es lo que config.js lee por omisión
    python3 xml_a_csv.py precios_2026-08-17.xml --catalogo catalogo_estaciones.csv

    # Acumula varios días en un histórico para activar la gráfica de tendencia
    python3 xml_a_csv.py precios_2026-08-18.xml --catalogo catalogo_estaciones.csv \
            --salida historico.csv --acumular

El XML solo trae permiso y precios; el catálogo aporta razón social, dirección,
municipio, estado y región. El cruce se hace por una clave canónica del permiso,
así que da igual si el catálogo trae espacios accidentales, minúsculas o el
prefijo "CNE/" que la Comisión adoptó en 2025 para los permisos nuevos.

Reglas de limpieza (idénticas a las de app.js, para que los números coincidan
sin importar la ruta de alimentación):
  · Precios fuera de --min/--max se descartan. El XML publica 0.01 o 1.00
    cuando la estación no reportó precio.
  · Permisos repetidos: se conserva el primer registro y solo se completan los
    productos que le falten.
  · Municipio, Estado y Región vacíos se escriben como "No especificado" para
    no dejar comas nulas consecutivas en el CSV.

Codificación: lectura y escritura en UTF-8 (se acepta BOM en el catálogo). Los
acentos de razones sociales y domicilios se conservan tal cual.
"""

import argparse
import csv
import io
import os
import sys
import xml.etree.ElementTree as ET

COLUMNAS = ["Fecha", "Region", "Estado", "Municipio", "Estacion",
            "Permiso CRE", "Direccion", "Regular", "Premium", "Diesel"]

PRODUCTOS = {"regular": "Regular", "premium": "Premium", "diesel": "Diesel"}

SIN_DATO = "No especificado"

# Campos que reciben marcador cuando el catálogo no aporta el dato.
CON_MARCADOR = ("Region", "Estado", "Municipio")

# Encabezados aceptados en el catálogo, sin distinguir mayúsculas ni acentos.
ALIAS_CATALOGO = {
    "permiso": ["permiso cre", "permisocre", "numero", "num permiso", "permiso"],
    "estacion": ["estacion", "razon social", "nombre"],
    "direccion": ["direccion", "domicilio"],
    "municipio": ["municipio", "ciudad", "localidad"],
    "estado": ["estado", "entidad", "entidad federativa"],
    "region": ["region", "zona"],
}


def norm_encabezado(h):
    """Minúsculas, sin acentos y sin espacios de sobra."""
    s = (h or "").strip().lower()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ü", "u")):
        s = s.replace(a, b)
    return " ".join(s.split())


def clave_permiso(permiso):
    """
    Clave canónica para cruzar catálogos capturados con distintas convenciones:
    mayúsculas, sin espacios internos y sin el prefijo 'CNE/'.
        ' cne/pl/14/exp/es/2025 ' → 'PL/14/EXP/ES/2025'
        'PL/14/EXP/ES/2025'       → 'PL/14/EXP/ES/2025'
    """
    k = "".join(str(permiso or "").split()).upper()
    return k[4:] if k.startswith("CNE/") else k


def leer_catalogo(ruta):
    """Indexa el catálogo por permiso literal y por clave canónica."""
    if not ruta:
        return {}
    if not os.path.exists(ruta):
        sys.exit("No se encontró el catálogo: %s" % ruta)

    idx = {}
    with io.open(ruta, encoding="utf-8-sig", newline="") as fh:
        lector = csv.reader(fh)
        try:
            encabezados = [norm_encabezado(h) for h in next(lector)]
        except StopIteration:
            return idx

        def col(campo):
            for alias in ALIAS_CATALOGO[campo]:
                if alias in encabezados:
                    return encabezados.index(alias)
            return -1

        cols = dict((campo, col(campo)) for campo in ALIAS_CATALOGO)
        if cols["permiso"] < 0:
            sys.exit("El catálogo no tiene columna de permiso (Permiso CRE / Número).")

        def val(fila, campo):
            i = cols[campo]
            if i < 0 or i >= len(fila):
                return ""
            v = (fila[i] or "").strip()
            return "" if v.lower() in ("", "n/a", "n/d", "-", SIN_DATO.lower()) else v

        for fila in lector:
            if not fila or cols["permiso"] >= len(fila):
                continue
            permiso = (fila[cols["permiso"]] or "").strip()
            if not permiso:
                continue
            registro = {
                "Estacion": val(fila, "estacion"),
                "Direccion": val(fila, "direccion"),
                "Municipio": val(fila, "municipio"),
                "Estado": val(fila, "estado"),
                "Region": val(fila, "region"),
            }
            idx.setdefault("".join(permiso.split()).upper(), registro)
            idx.setdefault(clave_permiso(permiso), registro)
    return idx


def convertir(ruta_xml, catalogo, minimo, maximo):
    if not os.path.exists(ruta_xml):
        sys.exit("No se encontró el XML: %s" % ruta_xml)

    raiz = ET.parse(ruta_xml).getroot()
    fecha = raiz.get("fecha_generacion", "")

    registros, orden = {}, []
    st = {"estaciones": 0, "duplicados": 0, "descartados": 0, "sin_catalogo": 0}

    for est in raiz.findall("estacion"):
        permiso = " ".join(str(est.get("permiso") or "").split())
        if not permiso:
            continue
        st["estaciones"] += 1
        clave = clave_permiso(permiso)

        precios = {}
        for prod in est.findall("producto"):
            columna = PRODUCTOS.get((prod.get("tipo") or "").strip().lower())
            if not columna:
                continue
            try:
                valor = float(prod.get("precio"))
            except (TypeError, ValueError):
                continue
            if valor < minimo or valor > maximo:
                st["descartados"] += 1
                continue
            precios[columna] = "%.2f" % valor

        if clave in registros:
            st["duplicados"] += 1
            for columna, v in precios.items():
                if not registros[clave][columna]:
                    registros[clave][columna] = v
            continue

        info = catalogo.get("".join(permiso.split()).upper()) or catalogo.get(clave) or {}
        if not info:
            st["sin_catalogo"] += 1

        fila = {
            "Fecha": fecha,
            "Region": info.get("Region", ""),
            "Estado": info.get("Estado", ""),
            "Municipio": info.get("Municipio", ""),
            "Estacion": info.get("Estacion", ""),
            "Permiso CRE": permiso,
            "Direccion": info.get("Direccion", ""),
            "Regular": precios.get("Regular", ""),
            "Premium": precios.get("Premium", ""),
            "Diesel": precios.get("Diesel", ""),
        }
        for campo in CON_MARCADOR:
            if not fila[campo]:
                fila[campo] = SIN_DATO

        registros[clave] = fila
        orden.append(clave)

    filas = [registros[k] for k in orden]
    st["filas"] = len(filas)
    st["con_catalogo"] = st["filas"] - st["sin_catalogo"]
    st["fecha"] = fecha
    return filas, st


def escribir(filas, salida, acumular):
    carpeta = os.path.dirname(salida)
    if carpeta:
        os.makedirs(carpeta, exist_ok=True)

    encabezar, modo = True, "w"
    if acumular and os.path.exists(salida) and os.path.getsize(salida) > 0:
        encabezar, modo = False, "a"

    with io.open(salida, modo, encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS, lineterminator="\n")
        if encabezar:
            w.writeheader()
        w.writerows(filas)


def main():
    ap = argparse.ArgumentParser(
        description="Convierte el XML oficial de precios de la CNE al CSV del tablero.")
    ap.add_argument("xml", help="Archivo XML descargado del portal de la CNE")
    ap.add_argument("--catalogo", default="catalogo_estaciones.csv",
                    help="Catálogo permiso → razón social, dirección y ubicación (por omisión catalogo_estaciones.csv)")
    ap.add_argument("--salida", default="fallback.csv",
                    help="CSV de salida (por omisión fallback.csv, que es lo que lee config.js)")
    ap.add_argument("--acumular", action="store_true",
                    help="Agrega las filas al final del archivo en lugar de reemplazarlo")
    ap.add_argument("--min", type=float, default=15.0, help="Precio mínimo válido (por omisión 15.00)")
    ap.add_argument("--max", type=float, default=45.0, help="Precio máximo válido (por omisión 45.00)")
    args = ap.parse_args()

    catalogo = leer_catalogo(args.catalogo if os.path.exists(args.catalogo) else "")
    if args.catalogo and not catalogo:
        print("Aviso: no se cargó catálogo; las estaciones quedarán identificadas por su permiso.")

    filas, st = convertir(args.xml, catalogo, args.min, args.max)
    if not filas:
        sys.exit("El XML no produjo filas.")
    escribir(filas, args.salida, args.acumular)

    print("Fecha de generación:      %s" % st["fecha"])
    print("Estaciones en el XML:     %d" % st["estaciones"])
    print("Filas escritas:           %d" % st["filas"])
    print("Permisos repetidos:       %d (fusionados con el primer registro)" % st["duplicados"])
    print("Precios fuera de rango:   %d (descartados, límites %.2f-%.2f)" % (st["descartados"], args.min, args.max))
    print("Con datos de catálogo:    %d de %d" % (st["con_catalogo"], st["filas"]))
    print("Archivo:                  %s%s" % (args.salida, " (acumulado)" if args.acumular else ""))


if __name__ == "__main__":
    main()
