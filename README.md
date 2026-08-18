# Monitor de Precios de Combustibles

Tablero web para monitorear precios de gasolina Regular, Premium y Diésel por estación de
servicio. Lee los datos en vivo desde una hoja de Google Sheets publicada como CSV y se
despliega como sitio estático en GitHub Pages.

**Fuente:** Valores estimados por la SENER con información de la CRE/CNE y el SAT.
El precio al público es un promedio de los precios registrados durante el periodo de referencia.

---

## 1. Fuente oficial: el XML de la CNE

El portal de la Comisión Nacional de Energía publica un archivo XML con los precios al público
de todas las estaciones del país:

<https://www.cne.gob.mx/ConsultaPrecios/GasolinasyDiesel/GasolinasyDiesel.html>

```xml
<precios fecha_generacion="2026-08-17">
  <estacion permiso="PL/9998/EXP/ES/2015">
    <producto tipo="regular" precio="24.5"/>
    <producto tipo="premium" precio="30.5"/>
    <producto tipo="diesel"  precio="27"/>
  </estacion>
</precios>
```

El XML trae **permiso y precio, nada más**: no incluye razón social, dirección ni ubicación. Por eso
el proyecto trabaja con dos piezas separadas:

| Pieza | Qué aporta | Con qué frecuencia cambia |
|---|---|---|
| XML de la CNE | Precios del día por permiso | Diaria |
| `catalogo_estaciones.csv` | Permiso → razón social, dirección, municipio, estado, región | Rara vez |

El tablero cruza ambos por el número de permiso. Las estaciones sin coincidencia en el catálogo se
muestran identificadas por su permiso y siguen contando en promedios, mínimos y máximos.

### Arquitectura dual de datos

El tablero recorre las fuentes en orden y se queda con la primera que responda. Si la primaria falla
—red caída, hoja despublicada— pasa sola a la siguiente sin dejar la pantalla en blanco, y el
indicador del encabezado cambia a **Respaldo local** para que la degradación sea visible.

| Orden | Variable en `config.js` | Modalidad | Construye historia |
|---|---|---|---|
| 1 | `SHEET_CSV_URL` | **Cloud (primaria).** Google Sheets alimentado a diario por `AppsScript.gs` | Sí |
| 2 | `CSV_URL` | CSV remoto ya procesado (GitHub Actions u otro servidor) | Solo si acumulas periodos |
| 3 | `XML_URL` | XML oficial alojado en el repositorio, interpretado por el navegador | No |
| 4 | `FALLBACK_CSV` | **Local (secundaria).** `fallback.csv` generado por `xml_a_csv.py` | Solo si acumulas periodos |

La modalidad Cloud es la recomendada: es la única que acumula la serie histórica sin intervención y
la única inmune al bloqueo CORS. La local sirve como respaldo permanente y para trabajar sin Google.

> **El navegador no puede leer el XML directamente del servidor de la CNE.** El portal no envía la
> cabecera `Access-Control-Allow-Origin`, así que apuntar `XML_URL` a `https://www.cne.gob.mx/...`
> falla por CORS. Apps Script no tiene ese problema porque la descarga la hace el servidor de Google.

### Convertir el XML con `xml_a_csv.py`

```bash
python3 xml_a_csv.py precios_2026-08-17.xml --catalogo catalogo_estaciones.csv
# → fallback.csv

# Para acumular varios días en un mismo archivo histórico:
python3 xml_a_csv.py precios_2026-08-18.xml \
        --catalogo catalogo_estaciones.csv \
        --salida historico.csv --acumular
```

### Limpieza que se aplica siempre

Tanto el script como el tablero aplican las mismas dos reglas, así que los números coinciden
sin importar la ruta que uses:

- **Precios fuera de rango.** El XML publica `0.01` o `1.00` cuando la estación no reportó precio.
  Se descartan los valores fuera de `PRICE_MIN`–`PRICE_MAX` (por omisión $15–$45) para que no
  distorsionen promedios ni el mínimo del periodo.
- **Permisos repetidos.** Se conserva el primer registro y solo se completan los productos que le
  falten. En el corte del 17 de agosto de 2026 esto afectó a 35 permisos con precios contradictorios.

En ese mismo corte: 13,860 estaciones en el XML, 13,825 filas útiles, 18 precios descartados. Los
promedios resultantes ($23.69 Regular, $28.51 Premium, $27.02 Diésel) coinciden con los publicados
por Profeco para el periodo, lo que confirma que el criterio de limpieza es el adecuado.

---

## 2. Estructura de la hoja de cálculo

La primera fila debe contener los encabezados. Solo `Estacion` (o `Permiso CRE`) y al menos una
columna de precio son obligatorias; las demás enriquecen el tablero.

| Columna | Obligatoria | Ejemplo | Para qué sirve |
|---|---|---|---|
| `Fecha` | recomendada | `2026-08-18` | Selector de periodo, tendencia histórica y delta vs. periodo anterior |
| `Region` | opcional | `Occidente` | Agrupación de la comparativa y filtro superior |
| `Estado` | opcional | `Jalisco` | Alternativa de agrupación si no hay región |
| `Municipio` | opcional | `Zapopan` | Búsqueda y columna de ubicación |
| `Estacion` | **sí** | `GASOLINERA MARTÍN S.A. DE C.V.` | Razón social de la estación |
| `Permiso CRE` | recomendada | `PL/7773/EXP/ES/2015` | Identificador único y búsqueda |
| `Direccion` | recomendada | `Avenida Adolfo López Mateos Sur No. 1000` | Domicilio en tabla y tarjetas |
| `Regular` | sí* | `22.99` | Precio en MXN/litro |
| `Premium` | sí* | `28.39` | Precio en MXN/litro |
| `Diesel` | sí* | `26.99` | Precio en MXN/litro |
| `Tipo Diesel` | opcional | `DUBA` | Etiqueta en la tabla (DUBA / Automotriz) |
| `Margen` | opcional | `2.06` | Indicador de dispersión, se lee para uso futuro |

\* Al menos una de las tres columnas de precio.

**Formatos aceptados en las celdas de precio:** `22.99`, `$22.99`, `$22.99 - Regular (con un índice
de octano ([RON+MON]/2) mínimo de 87)`. El tablero extrae el número y descarta el texto. Las celdas
vacías, `N/A`, `N/D` o `-` se muestran como *N/D* y quedan fuera de los promedios.

**Nombres de columna flexibles.** El tablero reconoce variantes sin distinguir mayúsculas ni acentos:
`Fecha` / `Periodo` / `Periodo de referencia`; `Estado` / `Entidad`; `Municipio` / `Ciudad`;
`Estacion` / `Razón Social` / `Estación de servicio`; `Permiso CRE` / `Número` / `Número de permiso`;
`Direccion` / `Domicilio`; `Regular` / `Precio Regular`; `Diesel` / `Diésel` / `DUBA`.

Para acumular historia, **agrega filas nuevas con otra `Fecha`** en la misma hoja; no reemplaces las
anteriores. Con dos periodos o más se activan la gráfica de tendencia y el delta de las tarjetas KPI.

Los archivos `plantilla_google_sheets.csv` (plantilla con tres filas de ejemplo) y
`estaciones_seed.csv` (175 permisos ya normalizados, periodo 18 de agosto de 2026) sirven de
punto de partida: ábrelos en Google Sheets con **Archivo → Importar**.

---

## 3. Publicar la hoja como CSV y automatizar la ingesta

1. Abre tu hoja en Google Sheets.
2. **Archivo → Compartir → Publicar en la web**.
3. En el primer desplegable elige **la pestaña específica** con los datos (no "Todo el documento").
4. En el segundo desplegable elige **Valores separados por comas (.csv)**.
5. Pulsa **Publicar** y confirma. Copia la URL que aparece; termina en `output=csv`:

   ```
   https://docs.google.com/spreadsheets/d/e/2PACX-1vQ.../pub?gid=0&single=true&output=csv
   ```

6. Pega esa URL en `config.js`:

   ```js
   SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ.../pub?gid=0&single=true&output=csv",
   ```

Publicar en la web deja la hoja accesible para cualquiera con el enlace: usa una hoja dedicada al
tablero, sin datos reservados. Google tarda unos minutos en reflejar los cambios en el CSV
publicado; el botón **Actualizar** fuerza una nueva lectura del lado del navegador.

Si dejas `SHEET_CSV_URL` vacía, el tablero usa `XML_URL` y, en su defecto, `FALLBACK_CSV`.

### Automatizar la ingesta del XML (Apps Script)

`AppsScript.gs` mantiene la hoja al día sin intervención:

1. En la hoja de cálculo: **Extensiones → Apps Script**.
2. Pega el contenido de `AppsScript.gs`, guarda y confirma la ruta vigente del XML en
   `CONFIG.URL_XML` (tómala del portal de la CNE).
3. Crea dos pestañas: **`Precios`** (destino, la que publicas como CSV) y **`Catalogo`**
   (permiso CRE, razón social, dirección, municipio, estado, región).
4. Ejecuta `actualizarPrecios` una vez para autorizar los permisos y verificar el resultado.
5. Ejecuta `instalarDisparadorDiario` una sola vez: a partir de ahí corre solo cada mañana.

Cada corrida **agrega** el periodo nuevo sin borrar los anteriores, y si la fecha ya estaba cargada
no duplica nada. La escritura se hace por bloques de 5,000 filas con `setValues()` para mantener el
margen frente al límite de seis minutos de ejecución. Como son ~13,800 filas por día, ejecuta
`conservarUltimosPeriodos(60)` de vez en cuando para no acercarte al límite de 10 millones de celdas
de Google Sheets.

### Automatizar sin Google: GitHub Actions

`actualizar-datos.yml` hace lo mismo desde el repositorio: descarga el XML, corre `xml_a_csv.py` y
publica `fallback.csv` con un commit diario.

1. Copia el archivo a `.github/workflows/actualizar-datos.yml`. **Esa ruta la impone GitHub**; es la
   única carpeta del proyecto y el resto del repositorio se mantiene plano.
2. **Settings → Secrets and variables → Actions → Variables**: crea `URL_XML` con la ruta vigente
   del XML de la CNE.
3. **Settings → Actions → General → Workflow permissions**: marca *Read and write permissions*.
4. Pruébalo a mano desde la pestaña **Actions → Run workflow**.

---

## 4. Otros ajustes en `config.js`

| Clave | Qué controla |
|---|---|
| `SHEET_CSV_URL` | CSV publicado de Google Sheets. Tiene prioridad sobre las demás fuentes. |
| `XML_URL` | XML oficial (usa una copia en el repositorio; ver la advertencia de CORS). |
| `CSV_URL` | CSV remoto ya procesado (por ejemplo el que publica GitHub Actions). |
| `FALLBACK_CSV` | Respaldo local dentro del repositorio. Acepta CSV o XML. |
| `CATALOG_CSV` | Catálogo permiso → razón social, dirección y ubicación. `""` lo desactiva. |
| `PRICE_MIN`, `PRICE_MAX` | Rango de precio válido en MXN/litro (por omisión $15–$45). |
| `SEARCH_DEBOUNCE_MS` | Espera del buscador antes de filtrar. |
| `REFRESH_MINUTES` | Minutos entre actualizaciones automáticas. `0` las desactiva. |
| `TITLE`, `SUBTITLE` | Encabezado del tablero. |
| `REPO_URL` | Enlace del pie de página. |
| `BENCHMARK` | Referencia nacional que se compara en las tarjetas KPI y se marca en la regla de dispersión. Cambia los valores cuando Profeco publique una nueva edición. |
| `METODOLOGIA` | Leyenda que aparece en el pie y en los tooltips de las tarjetas. |
| `PAGE_SIZE` | Filas por página del explorador. |

---

## 5. Publicar en GitHub Pages

```bash
# 1. Dentro de la carpeta del proyecto
git init
git add .
git commit -m "Tablero de precios de combustibles"
git branch -M main

# 2. Crea el repositorio vacío en github.com y enlázalo
git remote add origin https://github.com/USUARIO/monitor-combustibles.git
git push -u origin main
```

En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
rama `main`, carpeta `/ (root)`, **Save**. En uno o dos minutos el sitio queda en:

```
https://USUARIO.github.io/monitor-combustibles/
```

Para actualizar el tablero después de un cambio:

```bash
git add . && git commit -m "Ajustes" && git push
```

El archivo `.nojekyll` evita que GitHub Pages procese el sitio con Jekyll.
Los datos **no** requieren un nuevo despliegue: al cambiar la hoja de cálculo, el tablero se
actualiza solo en la siguiente lectura.

---

## 6. Estructura de archivos

```
.
├── index.html                          Estructura del tablero
├── styles.css                          Tokens de diseño, temas claro/oscuro y componentes
├── app.js                              Carga, normalización, KPIs, gráficos y explorador
├── config.js                           Único archivo que necesitas editar
├── .nojekyll
├── README.md
├── fallback.csv                        Respaldo local: padrón nacional de 13,825 estaciones
├── catalogo_estaciones.csv             Permiso CRE → razón social y dirección (175 estaciones)
├── estaciones_seed.csv                 Corte de 175 estaciones con nombre y dirección
├── plantilla_google_sheets.csv         Plantilla de columnas para la hoja
├── xml_a_csv.py                        Convierte el XML oficial a CSV limpio y enriquecido
├── AppsScript.gs                       Ingesta diaria del XML a Google Sheets
└── actualizar-datos.yml                Flujo de GitHub Actions (copiar a .github/workflows/)
```

Todos los archivos viven en la raíz del repositorio, sin subcarpetas: `index.html` queda en el
primer nivel, que es lo que GitHub Pages espera para servir el sitio desde `/ (root)`.

El tablero interpreta CSV y XML sin dependencias adicionales: el XML se lee con `DOMParser`,
que ya trae el navegador. Dependencias por CDN: PapaParse 5.4.1 (lectura de CSV), Chart.js 4.4.1 (gráficos) y Google Fonts
(Archivo, IBM Plex Sans, IBM Plex Mono). Sin proceso de compilación: el sitio funciona abriendo
`index.html` desde un servidor estático.

> Para probarlo en tu equipo: `python3 -m http.server 8000` y abre `http://localhost:8000`.
> Abrir el archivo con doble clic (`file://`) no funciona porque el navegador bloquea la lectura
> del CSV local.

---

## 7. Qué muestra cada bloque

- **Tarjetas KPI.** Promedio de cada producto en el periodo y filtro activos, número de estaciones
  con precio, cambio contra el periodo anterior y diferencia contra la referencia nacional.
- **Precio más bajo / más alto.** Estación en los extremos del producto seleccionado.
- **Regla de dispersión.** Una marca por estación entre el mínimo y el máximo, con la mediana, la
  banda P25–P75 y la referencia nacional. Muestra de un vistazo qué tan concentrado está el mercado.
- **Tendencia por periodo.** Promedio de los tres productos en cada fecha cargada.
- **Comparativa.** Promedio por región, estado, municipio o marca, según las columnas disponibles.
  Con más de catorce grupos muestra los siete más altos y los siete más bajos.
- **Distribución de precios.** Cuántas estaciones caen en cada rango.
- **Explorador.** Búsqueda por estación, permiso CRE, municipio o dirección; orden por cualquier
  columna; paginación; etiquetas de mínimo, máximo y tipo de diésel.

**Notas:** excluye zonas fronterizas con estímulo fiscal. El indicador de ganancia de las compañías
importadoras incluye el margen al mayoreo e incluye descuentos en TAR.

---

## 8. Flujo de comandos

### Actualizar los datos (modalidad local)

```bash
# 1. Descarga el XML del día desde el portal de la CNE (o con curl si ya tienes la ruta)
curl -fsSL -o precios_del_dia.xml "URL_DEL_XML"

# 2. Conviértelo al CSV que lee el tablero
python3 xml_a_csv.py precios_del_dia.xml --catalogo catalogo_estaciones.csv

# 3. Revísalo en local antes de publicar
python3 -m http.server 8000    # abre http://localhost:8000

# 4. Publica
git add fallback.csv
git commit -m "Precios $(date +%F)"
git push
```

Para acumular la serie histórica en lugar de reemplazar el corte del día, cambia el paso 2 por:

```bash
python3 xml_a_csv.py precios_del_dia.xml --catalogo catalogo_estaciones.csv \
        --salida historico.csv --acumular
```

y apunta `FALLBACK_CSV: "historico.csv"` en `config.js`.

### Primer despliegue

```bash
git init
git add .
git commit -m "Monitor de precios de combustibles"
git branch -M main
git remote add origin https://github.com/USUARIO/monitor-combustibles.git
git push -u origin main
```

Luego **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

### Cambios posteriores al tablero

```bash
git add . && git commit -m "Ajustes" && git push
```

Con la modalidad Cloud no hace falta ninguno de estos pasos para los datos: al actualizarse la hoja,
el tablero la lee en la siguiente sincronización.
