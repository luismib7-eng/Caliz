/* =============================================================
   MONITOR DE PRECIOS DE COMBUSTIBLES — CONFIGURACIÓN
   Este es el único archivo que necesitas editar.

   ARQUITECTURA DUAL DE DATOS
   El tablero recorre las fuentes en este orden y se queda con la
   primera que responda; si una falla, pasa a la siguiente sin
   interrumpir la vista:

     1. SHEET_CSV_URL  Modalidad Cloud (primaria)
                       Google Sheets publicado como CSV, alimentado
                       a diario por el trigger de AppsScript.gs.
     2. CSV_URL        CSV remoto ya procesado (por ejemplo, el que
                       genera GitHub Actions con xml_a_csv.py).
     3. XML_URL        XML oficial de la CNE alojado en el repositorio.
     4. FALLBACK_CSV   Respaldo offline dentro del repositorio.
   ============================================================= */

window.APP_CONFIG = {

  /* ---------- Fuentes de datos ---------- */

  /* Modalidad Cloud (primaria). URL del Google Sheet publicado como CSV.
     Archivo → Compartir → Publicar en la web → pestaña + CSV.
     Ejemplo: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ.../pub?gid=0&single=true&output=csv" */
  SHEET_CSV_URL: "",

  /* CSV remoto ya procesado. Útil si publicas el resultado de xml_a_csv.py
     en otro repositorio o en un servidor propio.
     Ejemplo: "https://raw.githubusercontent.com/USUARIO/REPO/main/fallback.csv" */
  CSV_URL: "",

  /* XML oficial de la CNE. Usa una copia dentro del repositorio: el portal
     no envía cabeceras CORS, así que el navegador bloquea la lectura directa
     de https://www.cne.gob.mx/... Ver README.md → "Fuente XML oficial". */
  XML_URL: "",

  /* Respaldo offline. Es el archivo que genera xml_a_csv.py por omisión,
     de modo que actualizarlo no obliga a tocar esta configuración. */
  FALLBACK_CSV: "fallback.csv",

  /* Catálogo permiso CRE → razón social, dirección, municipio, estado y región.
     El XML solo publica permiso y precios: este archivo les pone nombre y
     ubicación. Deja "" para desactivarlo. */
  CATALOG_CSV: "catalogo_estaciones.csv",

  /* ---------- Comportamiento ---------- */

  /* Minutos entre actualizaciones automáticas. Usa 0 para desactivarlas. */
  REFRESH_MINUTES: 10,

  /* Milisegundos de espera del buscador antes de filtrar. Evita recalcular
     la tabla en cada tecla con padrones de más de 13,000 estaciones. */
  SEARCH_DEBOUNCE_MS: 180,

  /* Filas por página en el explorador de estaciones. */
  PAGE_SIZE: 25,

  /* Rango de precio válido en MXN/litro. El XML oficial publica 0.01 o 1.00
     cuando la estación no reportó precio; fuera de este rango los valores se
     descartan para que no distorsionen promedios, mínimos ni máximos. */
  PRICE_MIN: 15,
  PRICE_MAX: 45,

  /* ---------- Identidad y metodología ---------- */

  TITLE: "Monitor de Precios de Combustibles",
  SUBTITLE: "Gasolina Regular, Premium y Diésel · Precio al público (MXN/litro)",
  REPO_URL: "https://github.com/usuario/monitor-combustibles",

  /* Referencia nacional para comparar los promedios del tablero.
     Valores publicados por Profeco en "Quién es Quién en los Precios",
     edición del 17 de agosto de 2026. Actualízalos en cada edición. */
  BENCHMARK: {
    label: "Promedio nacional Profeco · 13 ago 2026",
    regular: 23.68,
    premium: 28.50,
    diesel: 27.00
  },

  /* Leyenda metodológica obligatoria (pie de página y tooltips). */
  METODOLOGIA: "Fuente: Valores estimados por la SENER con información de la CNE y el SAT. " +
               "El precio al público es un promedio de los precios registrados durante el periodo de referencia."
};
