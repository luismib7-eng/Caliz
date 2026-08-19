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

  /* Reporte estilo "Quién es Quién en los Precios" que genera xml_a_csv.py con
     --reporte: nacional, por marca y por región, un renglón por bloque. El
     tablero calcula el panel en vivo desde el padrón; este archivo sirve como
     registro semanal para consulta y respaldo. */
  REPORT_CSV: "reporte_mercado.csv",

  /* Serie histórica ligera de promedios diarios (la genera xml_a_csv.py con
     --historico). Alimenta la gráfica de tendencia y el delta de las tarjetas
     KPI sin cargar un padrón completo por cada día. Deja "" para desactivarla. */
  HISTORY_CSV: "historico.csv",

  /* Catálogo permiso CRE → razón social, marca, dirección, municipio, estado y región.
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

  TITLE: "LB GAS 23 · Monitor de Precios",
  SUBTITLE: "Servicio Bautista · Análisis de Precios al Público (SENER / CNE / SAT)",

  /* Logotipo del encabezado. Si el archivo no existe, el tablero oculta la
     imagen y deja el título sin hueco vacío. */
  LOGO_URL: "logo_lbgas23.png",

  REPO_URL: "https://github.com/usuario/monitor-combustibles",

  /* Sucursales propias: se marcan en el explorador con el distintivo
     "Sucursal propia" y un realce azul de marca.
       permisos → coincidencia exacta (ignora espacios y el prefijo "CNE/")
       patrones → texto contenido en la razón social, sin acentos ni mayúsculas
     Captura aquí los permisos CRE de tus estaciones: es la vía confiable,
     porque la razón social en el catálogo puede no incluir la marca comercial. */
  MIS_ESTACIONES: {
    /* Semilla inicial. La selección real se hace con el botón "Mis estaciones"
       del encabezado (hasta 5) y se guarda en este navegador; a partir de esa
       primera vez, localStorage manda sobre esta lista.
       Los permisos son la única vía confiable: en el catálogo nacional no
       existe ninguna razón social con "LB GAS", y "Servicio Bautista" solo
       coincide con PL/4799/EXP/ES/2015, una estación de Oaxaca que no es tuya. */
    permisos: [],
    patrones: []
  },

  /* Marcas a vigilar en la tarjeta de competencia directa. Se reconocen por la
     columna Marca del catálogo y, en su defecto, por la razón social, siempre
     por palabra completa.

     ADVERTENCIA: el catálogo de la CNE publica la razón social, no la bandera.
     La mayoría de las estaciones Pemex están a nombre de sociedades que no
     dicen "Pemex", y a la inversa hay razones sociales que contienen el nombre
     de una marca sin pertenecer a ella ("Honestidad Total", "Servicio Ciudad
     Pemex"). La lista sirve para las marcas que sí operan con razón social
     propia; para el resto, llena la columna Marca en catalogo_estaciones.csv. */
  MARCAS_COMPETENCIA: ["BP", "TOTALENERGIES", "REPSOL", "SHELL", "CHEVRON",
                       "EXXONMOBIL", "GULF", "G500", "OXXO GAS", "ARCO NORTE"],

  /* Radio en kilómetros del mercado local cuando el catálogo trae coordenadas
     (columnas Lat y Lon). Es la definición más fiel de competencia —quien está
     a pocos kilómetros, sin importar el límite municipal— y tiene prioridad
     sobre municipio, estado y nacional. Usa 0 para desactivarlo.
     Referencias: 3–5 km en zona urbana, 15–25 km en carretera. */
  RADIO_KM: 5,

  /* Estado que se asigna a las estaciones sin ubicación conocida.
     Déjalo en "" (recomendado): con un valor, TODAS las estaciones sin dato
     quedan bajo ese estado, y entonces el "promedio estatal" contra el que se
     mide el semáforo deja de ser el de tu plaza y pasa a ser el nacional
     disfrazado. Los selectores nunca se deshabilitan: las estaciones sin
     ubicación aparecen agrupadas bajo "Sin ubicación". */
  ESTADO_POR_DEFECTO: "",

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
