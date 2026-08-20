# Qué subir a GitHub

Esta carpeta contiene **solo lo indispensable**. Súbela completa, respetando la estructura.

> **Versión con el esquema real del endpoint.** El archivo de precios de la CNE identifica
> cada estación por `place_id` y se cruza con el catálogo por esa llave, no por el permiso
> CRE. Si ya tenías una versión anterior en GitHub, reemplaza **todos** estos archivos.

## Estructura

```
.github/
└── workflows/
    └── actualizar-datos.yml     Actualización diaria automática
.nojekyll
index.html                       Tablero
styles.css
app.js
config.js                        Único archivo que editas
sw.js                            Modo sin conexión y aviso de versión
manifest.json                    Instalación como app en iPhone/Android
leaflet.js · leaflet.css         Mapa (local, sin CDN)
papaparse.min.js                 Lectura de CSV
chart.umd.min.js                 Gráficas
logo_lbgas23.png                 Logotipo del encabezado
favicon.png · apple-touch-icon.png
icono-192.png · icono-512.png · icono-512-maskable.png
fallback.csv                     Padrón con precios (15,034 estaciones)
historico.csv                    Promedios diarios (gráfica de tendencia)
catalogo_estaciones.csv          place_id + permiso CRE + ubicación + coordenadas
reporte_mercado.csv              Métricas estilo Profeco
xml_a_csv.py                     Conversor que usa el flujo diario
README.md
```

## Pasos

1. **Sube todo con `git push`.** Si lo haces arrastrando archivos en la web de GitHub,
   la carpeta `.github` NO se sube (el navegador ignora las que empiezan con punto):
   créala aparte con **Add file → Create new file** y escribe como nombre
   `.github/workflows/actualizar-datos.yml`, luego pega el contenido.

2. **Settings → Actions → General → Workflow permissions**: marca
   *Read and write permissions*. Sin esto el flujo descarga los datos pero no puede publicarlos.

3. **Settings → Pages → Deploy from a branch**: rama `main`, carpeta `/ (root)`.

4. **Actions → Actualizar precios de combustibles → Run workflow.**

## Qué esperar en el resumen

```
### Datos actualizados
Periodos en fallback.csv: 2026-08-20

| HTTP | 200 |
| Bytes recibidos | ~2400000 |

esquema: places/place con gas_price
resultado: OK
```

Y en la pestaña **Code**, un commit nuevo de `github-actions[bot]`.

## Qué NO subir

| Archivo | Por qué no va |
|---|---|
| `entidades_mx.geojson` (130 KB) | Solo sirve para regenerar el catálogo desde cero |
| `municipios_mx.topojson` (755 KB) | Igual: ya está aplicado dentro de `catalogo_estaciones.csv` |
| `AppsScript.gs` | Vía alterna por Google Sheets; no se usa con GitHub Actions |

Si algún día el catálogo cambia (estaciones nuevas), recupéralos de tu respaldo y corre:

```bash
curl -fsSL -o places.xml "https://publicacionexterna.azurewebsites.net/publicaciones/places"
python3 xml_a_csv.py places.xml --catalogo places.xml \
        --geojson entidades_mx.geojson --municipios municipios_mx.topojson \
        --exportar-catalogo catalogo_estaciones.csv --salida /dev/null
```

## Después de subir

El tablero queda en `https://TU-USUARIO.github.io/TU-REPOSITORIO/`.

Para apuntarlo a tus estaciones usa el botón **★ Mis estaciones** del encabezado
y elige hasta cinco. La selección se guarda en tu navegador.
