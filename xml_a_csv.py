#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convierte el XML oficial de precios de la CNE al CSV que consume el tablero.

Uso:
    python3 xml_a_csv.py precios_2026-08-17.xml
    python3 xml_a_csv.py precios_2026-08-17.xml --catalogo catalogo_estaciones.csv
    python3 xml_a_csv.py precios_2026-08-17.xml --salida historico.csv --acumular

El XML solo trae permiso y precios. El catálogo (permiso → razón social, dirección,
municipio, estado, región) es opcional: si se indica, el resultado queda enriquecido y
las estaciones sin coincidencia conservan su permiso como identificador.

Reglas de limpieza aplicadas:
  · Se descartan precios fuera del rango válido (por omisión, entre $5.00 y $60.00):
    el XML publica valores como 0.01 o 1.00 cuando la estación no reportó precio.
  · Permisos repetidos: se conserva el primer registro y se completan únicamente los
    productos que le falten con los registros siguientes.
"""

import argparse
import csv
import os
import sys
import xml.etree.ElementTree as ET

COLUMNAS = ["Fecha", "Region", "Estado", "Municipio", "Estacion",
            "Permiso CRE", "Direccion", "Regular", "Premium", "Diesel"]

PRODUCTOS = {"regular": "Regular", "premium": "Premium", "diesel": "Diesel"}


def leer_catalogo(ruta):
    """Indexa un CSV de catálogo por permiso. Acepta 'Permiso CRE' o 'Número'."""
    if not ruta:
        return {}
    if not os.path.exists(ruta):
        sys.exit("No se encontró el catálogo: " + ruta)
    idx = {}
    with open(ruta, encoding="utf-8-sig", newline="") as fh:
        for fila in csv.DictReader(fh):
            claves = {k.strip().lower(): (v or "").strip() for k, v in fila.items() if k}
            permiso = claves.get("permiso cre") or claves.get("número") or claves.get("numero")
            if not permiso:
                continue
            idx[permiso] = {
                "Region": claves.get("region") or claves.get("región", ""),
                "Estado": claves.get("estado") or claves.get("entidad", ""),
                "Municipio": claves.get("municipio", ""),
                "Estacion": claves.get("estacion") or claves.get("estación") or claves.get("razón social", ""),
                "Direccion": claves.get("direccion") or claves.get("dirección") or claves.get("domicilio", ""),
            }
    return idx


def convertir(ruta_xml, catalogo, minimo, maximo):
    raiz = ET.parse(ruta_xml).getroot()
    fecha = raiz.get("fecha_generacion", "")

    registros = {}
    orden = []
    stats = {"estaciones": 0, "duplicados": 0, "precios_descartados": 0}

    for est in raiz.findall("estacion"):
        permiso = (est.get("permiso") or "").strip()
        if not permiso:
            continue
        stats["estaciones"] += 1

        precios = {}
        for prod in est.findall("producto"):
            tipo = (prod.get("tipo") or "").strip().lower()
            col = PRODUCTOS.get(tipo)
            if not col:
                continue
            try:
                valor = float(prod.get("precio"))
            except (TypeError, ValueError):
                continue
            if valor < minimo or valor > maximo:
                stats["precios_descartados"] += 1
                continue
            precios[col] = "%.2f" % valor

        if permiso in registros:
            stats["duplicados"] += 1
            for col, val in precios.items():
                if not registros[permiso][col]:
                    registros[permiso][col] = val
            continue

        info = catalogo.get(permiso, {})
        registros[permiso] = {
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
        orden.append(permiso)

    filas = [registros[p] for p in orden]
    stats["filas"] = len(filas)
    stats["con_catalogo"] = sum(1 for f in filas if f["Estacion"])
    stats["fecha"] = fecha
    return filas, stats


def escribir(filas, salida, acumular):
    existe = os.path.exists(salida)
    carpeta = os.path.dirname(salida)
    if carpeta:
        os.makedirs(carpeta, exist_ok=True)
    modo = "a" if (acumular and existe) else "w"
    with open(salida, modo, encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS)
        if modo == "w":
            w.writeheader()
        w.writerows(filas)


def main():
    ap = argparse.ArgumentParser(description="Convierte el XML de precios de la CNE a CSV.")
    ap.add_argument("xml", help="Archivo XML descargado del portal de la CNE")
    ap.add_argument("--catalogo", default="", help="CSV con permiso, razón social, dirección, municipio, estado y región")
    ap.add_argument("--salida", default="", help="CSV de salida (por omisión precios_<fecha>.csv)")
    ap.add_argument("--acumular", action="store_true", help="Agrega las filas al final del archivo de salida en lugar de reemplazarlo")
    ap.add_argument("--min", type=float, default=5.0, help="Precio mínimo válido (por omisión 5.00)")
    ap.add_argument("--max", type=float, default=60.0, help="Precio máximo válido (por omisión 60.00)")
    args = ap.parse_args()

    catalogo = leer_catalogo(args.catalogo)
    filas, st = convertir(args.xml, catalogo, args.min, args.max)
    salida = args.salida or ("precios_%s.csv" % (st["fecha"] or "sin_fecha"))
    escribir(filas, salida, args.acumular)

    print("Fecha de generación:      %s" % st["fecha"])
    print("Estaciones en el XML:     %d" % st["estaciones"])
    print("Filas escritas:           %d" % st["filas"])
    print("Permisos repetidos:       %d (fusionados con el primer registro)" % st["duplicados"])
    print("Precios fuera de rango:   %d (descartados)" % st["precios_descartados"])
    print("Con datos de catálogo:    %d de %d" % (st["con_catalogo"], st["filas"]))
    print("Archivo:                  %s%s" % (salida, " (acumulado)" if args.acumular else ""))


if __name__ == "__main__":
    main()
