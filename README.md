# RASTROS — Tablero de control y base master

Herramientas de seguimiento del **Proyecto RASTROS** (Acción Regional para apoyar a los países
en la lucha contra la trata de personas perpetrada a través de operaciones de estafa en línea),
implementado por la **UNODC** con el **Gobierno del Estado de Jalisco**, 2025–2027.

Desarrollado y operado por la Dirección General de Análisis y Políticas Públicas de la
Coordinación General Estratégica de Seguridad.

---

## ⚠️ Antes de publicar este repositorio

Este proyecto administra información de **vetting de servidores públicos** que incluye datos
personales sensibles: nombre, CURP, CUIP, fecha de nacimiento, control de confianza, adscripción
y correo institucional.

1. **Mantenga el repositorio privado** salvo decisión expresa en contrario.
2. **Nunca haga commit de datos reales de personas.** El archivo
   `Vetting_Beneficiarios_plantilla.csv` contiene únicamente encabezados y una fila de ejemplo
   con valores ficticios. Los datos vivos residen exclusivamente en la base master de Google Sheets.
3. El identificador de la hoja de cálculo está escrito en `index.html`. Si el repositorio se hace
   público, ese identificador queda expuesto: la hoja debe permanecer restringida por permisos de
   Google Workspace, no por oscuridad del enlace.
4. Un historial de Git conserva lo que se borró después. Si llegara a subirse información
   personal, no basta con eliminarla en un commit posterior: hay que reescribir el historial.

---

## Contenido

Todos los archivos viven en la raíz del repositorio.

| Archivo | Qué es |
|---|---|
| `index.html` | Tablero de control y CRM de vetting. Página única, sin dependencias de compilación. |
| `Codigo.gs` | Google Apps Script que estructura la base master en Google Sheets. |
| `appsscript.json` | Manifiesto del proyecto de Apps Script (necesario solo si usa `clasp`). |
| `Vetting_Beneficiarios_plantilla.csv` | Plantilla de carga con los nueve encabezados exactos. |
| `.gitignore` | Exclusiones de trabajo local. |
| `.nojekyll` | Evita que GitHub Pages procese el sitio con Jekyll. |
| `README.md` | Este documento. |

---

## Puesta en marcha

### 1. Base master en Google Sheets

1. Abra el libro `RASTROS_UNODC_Master_DB`.
2. Vaya a **Extensiones ▸ Apps Script**.
3. Sustituya el contenido de `Código.gs` por el de `Codigo.gs` de este repositorio.
4. Guarde y ejecute la función `setupMasterDB`. Autorice los permisos cuando Google los solicite.
5. Recargue el libro: aparecerá el menú **▸ RASTROS**.

El script es idempotente; puede volver a ejecutarse sin romper bandas, protecciones ni celdas
combinadas. Aun así, ejecute **▸ RASTROS ▸ Respaldar libro** antes de reestructurar una base que
ya tenga capturas.

Pestañas que genera:

1. `Vetting_Beneficiarios` — control de propuestas y su estatus ante la Embajada.
2. `Respuestas_Formulario_Diagnostico` — 67 preguntas agrupadas en las 8 secciones del instrumento.
3. `Mesas_de_Trabajo_y_Capacitaciones` — logística y acuerdos de cada evento.
4. `Control_Metas_y_KPIs` — las 4 metas del proyecto e indicadores operativos calculados.

Auxiliares (desactivables con la constante `CFG.CREAR_HOJAS_AUXILIARES`):
`Listas_Catalogos` y `Mapeo_Formato_VETTING_Oficial`, este último espejo de las 31 columnas del
archivo oficial `Formato VETTING 2026.xlsx` para exportar sin recapturar.

### 2. Tablero web

Abra `index.html` en cualquier navegador. No requiere servidor, instalación ni compilación.

Para publicarlo en **GitHub Pages**: *Settings ▸ Pages ▸ Source: Deploy from a branch ▸ `main` / `root`*.
El archivo `.nojekyll` ya está incluido. No se agregó flujo de trabajo en `.github/workflows/`
porque exigiría subcarpetas; Pages funciona sin él.

---

## Conexión con datos en vivo

El tablero intenta leer la pestaña `Vetting_Beneficiarios` por dos rutas, en orden:

1. `…/export?format=csv&gid=0`
2. `…/gviz/tq?tqx=out:csv&sheet=Vetting_Beneficiarios`

El indicador del encabezado informa el origen de lo que está viendo:

- 🟢 **En vivo (Google Sheets)** — se leyeron registros reales de la hoja.
- 🟡 **Vista previa local** — se usan las plazas por designar precargadas.

Pulse el indicador para reintentar la lectura.

Mientras la hoja no esté publicada en **Archivo ▸ Compartir ▸ Publicar en la web**, el navegador
bloqueará la petición por política de origen cruzado y el tablero mostrará la vista previa local.
Esto es deliberado: la alternativa a publicar la hoja es servir el tablero con `HtmlService` dentro
del mismo Apps Script y leer los datos con `google.script.run`, que respeta los permisos del libro
sin exponerlo. Elija la ruta según la clasificación que se dé a la información.

El tablero **solo lee**. Las altas capturadas en pantalla se exportan con el botón *Descargar CSV*
y deben registrarse en la base master; no se escriben solas.

---

## Fechas y acuerdos de referencia

Conforme a la reunión con UNODC del 22 de julio de 2026:

- **29 de julio de 2026** — cierre de propuestas de vetting y de comentarios al formulario de
  diagnóstico. Los comentarios los formulan únicamente los tomadores de decisiones, para obtener
  un conjunto acotado de observaciones estratégicas.
- **Semana del 24 de agosto de 2026** — reunión presencial con personal clave con nivel de mando o
  vínculo de comunicación con los operativos.
- La sede externa, alimentos, catering y coffee break corren a cargo de UNODC.
- Pendiente: confirmar con UNODC si la Embajada requerirá el Anexo 3, para anticiparlo en la
  planeación logística de los oficios.

---

## Notas técnicas

- `index.html` usa Tailwind por CDN y tipografías de Google Fonts; requiere conexión a internet
  para renderizar con estilos. Si necesita operarlo sin red, hay que empaquetar el CSS localmente.
- No se usa `localStorage` ni ningún almacenamiento del navegador: al recargar la página se
  pierden las altas no exportadas.
- El script de Apps Script precarga formato y validaciones en 200 filas
  (constante `CFG.FILAS_PRECARGADAS`).

## Licencia

Sin licencia definida. Antes de abrir el repositorio, determine el régimen aplicable con el área
jurídica, considerando que el proyecto se ejecuta con financiamiento del Departamento de Estado
de los Estados Unidos a través de UNODC.
