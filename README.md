# RASTROS — Tablero de control y base master

Herramientas de seguimiento del **Proyecto RASTROS** (Acción Regional para apoyar a los países
en la lucha contra la trata de personas perpetrada a través de operaciones de estafa en línea),
implementado por la **UNODC** con el **Gobierno del Estado de Jalisco**, 2025–2027.

Desarrollado y operado por la Dirección General de Análisis y Políticas Públicas de la
Coordinación General Estratégica de Seguridad.

---

## Estado actual

| Componente | Estado |
|---|---|
| Base master en Google Sheets | Estructurada y verificada (24/07/2026) |
| Fórmulas de KPIs e indicadores | Calculando correctamente |
| Tablero web (`Panel.html` en Apps Script) | Pendiente de implementar |
| Vista previa en GitHub Pages | Publicada, sin datos en vivo |

La base se estructuró **importando el libro `RASTROS_UNODC_Master_DB.xlsx`** de este repositorio,
no ejecutando `setupMasterDB`. Ambas rutas producen la misma estructura; conserve el script como
alternativa para reconstruir la base o para replicar el modelo en otro estado.

---

## Antes de publicar este repositorio

Este proyecto administra información de **vetting de servidores públicos** que incluye datos
personales sensibles: nombre, CURP, CUIP, fecha de nacimiento, control de confianza, adscripción
y correo institucional.

1. **Mantenga el repositorio privado** salvo decisión expresa en contrario.
2. **Nunca haga commit de datos reales de personas.** El libro y la plantilla CSV incluidos
   contienen únicamente plazas por designar y valores ficticios. Los datos vivos residen
   exclusivamente en la base master de Google Sheets.
3. El identificador de la hoja está escrito en `index.html`, `Panel.html` y `Codigo.gs`. Si el
   repositorio se hace público, ese identificador queda expuesto: la hoja debe permanecer
   restringida por permisos de Google, no por lo poco conocido del enlace.
4. Un historial de Git conserva lo que se borró después. Si llegara a subirse información
   personal, no basta con eliminarla en un commit posterior: hay que reescribir el historial.
5. La base actual vive en una cuenta personal de Gmail y quedó con acceso de edición abierto
   durante las pruebas. Antes de capturar datos reales, migre el libro a la cuenta institucional
   y restrinja el acceso.

---

## Contenido

Todos los archivos viven en la raíz del repositorio.

| Archivo | Qué es |
|---|---|
| `Panel.html` | Tablero de control y CRM de vetting. Es el archivo que se pega en Apps Script. |
| `index.html` | Copia idéntica de `Panel.html` para vista previa en GitHub Pages (sin datos en vivo). |
| `Codigo.gs` | Apps Script: estructura la base, sirve el tablero y le entrega los datos. |
| `appsscript.json` | Manifiesto del proyecto de Apps Script (necesario solo si usa `clasp`). |
| `RASTROS_UNODC_Master_DB.xlsx` | Libro con las 6 pestañas listas para importar a Google Sheets. |
| `generar_libro_maestro.py` | Script que regenera el libro anterior desde cero (`openpyxl`). |
| `Vetting_Beneficiarios_plantilla.csv` | Plantilla de carga con los nueve encabezados exactos. |
| `.gitignore` | Exclusiones de trabajo local. |
| `.nojekyll` | Evita que GitHub Pages procese el sitio con Jekyll. |
| `README.md` | Este documento. |

---

## Puesta en marcha

### 1. Base master en Google Sheets

**Ruta A — importar el libro (la que se usó).**
En el libro destino: **Archivo ▸ Importar ▸ Subir**, seleccione `RASTROS_UNODC_Master_DB.xlsx`
y elija **Insertar hojas nuevas**. No use *Reemplazar hoja*.

> No abra el archivo en Excel antes de importarlo. Dos nombres de pestaña miden 33 caracteres y
> el límite de Excel es 31; Google Sheets los acepta, pero Excel los truncaría y el código
> dejaría de encontrarlos.

**Ruta B — ejecutar el script.**
**Extensiones ▸ Apps Script**, pegue `Codigo.gs`, guarde y ejecute `setupMasterDB`. Es
idempotente: puede volver a ejecutarse sin romper bandas, protecciones ni celdas combinadas.
Antes de reestructurar una base con capturas, use **▸ RASTROS ▸ Respaldar libro**.

Pestañas resultantes:

1. `Control_Metas_y_KPIs` — las 4 metas e indicadores operativos calculados.
2. `Vetting_Beneficiarios` — control de propuestas y su estatus ante la Embajada.
3. `Respuestas_Formulario_Diagnostico` — 67 preguntas en las 8 secciones del instrumento.
4. `Mesas_de_Trabajo_y_Capacitaciones` — logística y acuerdos de cada evento.
5. `Listas_Catalogos` — alimenta las listas desplegables. No la borre.
6. `Mapeo_Formato_VETTING_Oficial` — espejo de las 31 columnas del formato de la Embajada.

**Los nombres de pestaña y de encabezado no se renombran.** El código los busca literalmente,
con guion bajo y sin acentos añadidos.

### 2. Tablero web (aplicación de Apps Script)

En el editor de Apps Script del libro:

1. Pulse **+ ▸ HTML**, nombre el archivo **`Panel`** (sin extensión) y pegue el contenido de
   `Panel.html`. El nombre importa: `doGet()` lo busca exactamente así.
2. **Implementar ▸ Nueva implementación ▸ Tipo: Aplicación web**
   - Ejecutar como: **Usuario que accede**
   - Quién tiene acceso: **Solo yo** si el libro está en una cuenta personal, o
     **Usuarios de jalisco.gob.mx** si se migró al Workspace institucional.
     No use *Cualquier usuario*: expondría la base de vetting.
3. Copie la URL que termina en `/exec`. Ésa es la dirección del tablero.

Para recuperarla más tarde: **▸ RASTROS ▸ Ver URL del tablero web**.

Cada vez que modifique `Codigo.gs` o `Panel.html` debe pulsar **Implementar ▸ Gestionar
implementaciones ▸ Editar ▸ Versión: Nueva** para que los cambios surtan efecto. La URL no cambia.
Es el descuido más común: se edita, se recarga y no pasa nada, porque la implementación sigue
apuntando a la versión anterior.

### 3. GitHub Pages (opcional)

*Settings ▸ Pages ▸ Deploy from a branch ▸ `main` / `root`*. El archivo `.nojekyll` ya está
incluido. No se agregó flujo de trabajo en `.github/workflows/` porque exigiría subcarpetas.

---

## Origen de los datos

El tablero resuelve su fuente en cascada y lo informa en el indicador del encabezado:

| Indicador | Significado |
|---|---|
| Verde — **En vivo (base master)** | Corre dentro de Apps Script y lee la hoja con `google.script.run`. Es el modo previsto. |
| Verde — **En vivo (Google Sheets)** | Leyó el CSV publicado. Solo ocurre si la hoja se publicó en la web. |
| Ámbar — **Vista previa local** | Muestra las plazas por designar precargadas. |

Pulse el indicador para reintentar la lectura.

**GitHub Pages siempre mostrará la vista previa local.** Corre en un dominio ajeno a Google, así
que el navegador bloquea la lectura de la hoja por política de origen cruzado. Eso es deliberado:
la alternativa sería publicar la hoja en internet. Los datos vivos están en la URL `/exec`.

La función `obtenerDatosTablero()` de `Codigo.gs` es la única puerta de entrada: devuelve los
registros de vetting, los eventos capturados, el avance de las metas y el conteo de cuestionarios.
**Solo lee.** Las altas capturadas en pantalla se exportan con *Descargar CSV* y deben
registrarse en la base master; no se escriben solas.

---

## Convenciones del libro

- Celdas en **azul**: datos de ejemplo, sustitúyalos por los reales.
- Celdas **amarillas** en `Control_Metas_y_KPIs`: avance manual de las metas 1, 3 y 4. La meta 2
  se calcula sumando los asistentes de los eventos tipo *Capacitación*.
- Todo lo demás son fórmulas. Si las sobrescribe, el tablero dejará de reflejar el avance.

Para regenerar el libro desde cero: `python3 generar_libro_maestro.py salida.xlsx`
(requiere `openpyxl`). Genera el archivo sin recalcular, a propósito: Google Sheets computa las
fórmulas al importar, y pasarlo por LibreOffice truncaría los nombres largos de pestaña.

---

## Fechas y acuerdos de referencia

Conforme a la reunión con UNODC del 22 de julio de 2026:

- **29 de julio de 2026** — cierre de propuestas de vetting y de comentarios al formulario de
  diagnóstico. Los comentarios los formulan únicamente los tomadores de decisiones, para obtener
  un conjunto acotado de observaciones estratégicas.
- **Semana del 24 de agosto de 2026** — reunión presencial con personal clave con nivel de mando
  o vínculo de comunicación con los operativos.
- La sede externa, alimentos, catering y coffee break corren a cargo de UNODC.
- Pendiente: confirmar con UNODC si la Embajada requerirá el Anexo 3, para anticiparlo en la
  planeación logística de los oficios.

---

## Notas técnicas

- `Panel.html` usa Tailwind por CDN y tipografías de Google Fonts; requiere conexión a internet
  para renderizar con estilos.
- No se usa `localStorage` ni ningún almacenamiento del navegador: al recargar la página se
  pierden las altas no exportadas.
- El script de Apps Script precarga formato y validaciones en 200 filas
  (constante `CFG.FILAS_PRECARGADAS`).

## Licencia

Sin licencia definida. Antes de abrir el repositorio, determine el régimen aplicable con el área
jurídica, considerando que el proyecto se ejecuta con financiamiento del Departamento de Estado
de los Estados Unidos a través de UNODC.
