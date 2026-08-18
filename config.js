/* =============================================================
   CONFIGURACIÓN DEL TABLERO
   Edita únicamente este archivo para conectar tu hoja de cálculo.
   ============================================================= */

window.APP_CONFIG = {

  /* 1) URL de la hoja de Google Sheets publicada como CSV. Tiene prioridad sobre XML_URL.
        Ver README.md → "Publicar la hoja como CSV".
        Ejemplo: "https://docs.google.com/spreadsheets/d/e/2PACX-xxxxx/pub?gid=0&single=true&output=csv"
        Si se deja vacía, se usa XML_URL y, en su defecto, FALLBACK_CSV. */
  SHEET_CSV_URL: "",

  /* 2) XML oficial de la CNE. El tablero lo interpreta directamente
        (<precios><estacion permiso><producto tipo precio>).
        Usa una copia dentro del repositorio: el servidor de la CNE no envía
        cabeceras CORS, así que el navegador bloquea la lectura directa de
        https://www.cne.gob.mx/... Ver README.md → "Fuente XML oficial". */
  XML_URL: "",

  /* 2 bis) Archivo local de respaldo (CSV o XML) si las dos opciones anteriores están vacías. */
  FALLBACK_CSV: "precios_2026-08-17.csv",

  /* 2 ter) Catálogo permiso CRE → razón social, dirección, municipio, estado y región.
            El XML solo publica permiso y precios: este archivo les pone nombre y ubicación.
            Deja "" para desactivarlo. */
  CATALOG_CSV: "catalogo_estaciones.csv",

  /* 3) Auto-actualización en minutos. Usa 0 para desactivarla. */
  REFRESH_MINUTES: 10,

  /* 4) Título e identificación del tablero. */
  TITLE: "Monitor de Precios de Combustibles",
  SUBTITLE: "Gasolina Regular, Premium y Diésel · Precio al público (MXN/litro)",
  REPO_URL: "https://github.com/usuario/monitor-combustibles",

  /* 5) Referencia nacional para comparar los promedios del tablero.
        Valores publicados por Profeco en "Quién es Quién en los Precios",
        edición del 17 de agosto de 2026 (precio promedio diario nacional).
        Deja los valores en null si no quieres mostrar la comparación. */
  BENCHMARK: {
    label: "Promedio nacional Profeco · 13 ago 2026",
    regular: 23.68,
    premium: 28.50,
    diesel: 27.00
  },

  /* 6) Leyenda metodológica obligatoria (pie de página y tooltips). */
  METODOLOGIA: "Fuente: Valores estimados por la SENER con información de la CRE/CNE y el SAT. " +
               "El precio al público es un promedio de los precios registrados durante el periodo de referencia.",

  /* 7) Filas por página en el explorador de estaciones. */
  PAGE_SIZE: 25,

  /* 8) Rango de precio válido en MXN/litro. El XML oficial publica 0.01 o 1.00
        cuando la estación no reportó precio; esos valores se descartan para que
        no distorsionen promedios, mínimos y máximos. */
  PRICE_MIN: 5,
  PRICE_MAX: 60
};
