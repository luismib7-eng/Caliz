# RASTROS — Panel ejecutivo y base master

Panel de control del **Proyecto RASTROS** (Acción Regional para apoyar a los países en la lucha
contra la trata de personas perpetrada a través de operaciones de estafa en línea), implementado
por la **UNODC** con el **Gobierno del Estado de Jalisco**, 2025–2027.

Herramienta de uso personal del **Enlace Coordinador** de la Coordinación General Estratégica de
Seguridad: un solo administrador que alimenta la base master, da seguimiento interinstitucional
—Secretaría de Seguridad, Fiscalía del Estado, Fiscalía Especializada en Trata de Personas,
Policía Cibernética y UNODC— y genera el reporte ejecutivo semanal.

---

## Cómo se usa

**La captura vive en Google Sheets. El panel solo lee y presenta.** No hay formularios de alta:
para agregar una propuesta de vetting, registrar una mesa de trabajo o actualizar el avance de una
meta, se escribe en la base master y se recarga el panel.

El panel tiene tres pistas de acción:

### Todo lo configurable vive en la hoja

Ningún dato que cambie durante el proyecto está escrito en el código. Cuatro pestañas lo controlan:

| Pestaña | Controla |
|---|---|
| `Pendientes_UNODC` | Los pendientes que muestra el panel. Marcar `Resuelto` lo retira. |
| `Ruta_Critica` | Los hitos, su estatus y su orden. |
| `Configuracion_Dashboard` | Cuota por dependencia, meta del diagnóstico, fecha límite y umbrales de alerta. |
| `Metadatos_Proyecto` | Títulos, fase, periodo, países e instituciones del encabezado. |

Más `Listas_Catalogos`, que ahora incluye la columna `Dependencia_Abrev` con las abreviaturas que
usan las tarjetas y el reporte. Las descripciones y objetivos de las metas se leen de
`Control_Metas_y_KPIs`; no se agregaron columnas porque la hoja ya las tenía sin usar.

Si una pestaña falta o un valor es inválido, el código registra el problema en el log de Apps
Script y usa el respaldo interno. El panel nunca se queda en blanco.

| Módulo | Para qué |
|---|---|
| **1 · Resumen ejecutivo y alertas** | Qué está trabado hoy: cuellos de botella, semáforo de las 4 metas y ruta crítica. |
| **2 · Control de vetting** | Avance por dependencia con semaforización, más la tabla completa con buscador y filtros. |
| **3 · Seguimiento operativo** | Mesas y capacitaciones, estatus del diagnóstico y pendientes con UNODC. |

### Reporte ejecutivo semanal

El botón del encabezado arma una ficha de una a dos páginas y abre el diálogo de impresión.
Elija **Guardar como PDF** en el destino. El reporte contiene el estado de las 4 metas, el
resumen de vetting por dependencia, las alertas y pendientes con UNODC, y los próximos hitos.

Las reglas `@media print` ocultan navegación, pestañas y fondos oscuros: lo que se imprime es
únicamente la ficha, en blanco y negro salvo la banda de encabezado. Si su navegador inserta
encabezados con la URL, desactívelos en *Más configuraciones ▸ Encabezados y pies de página*.

### Indicador de conexión

El punto junto al título indica de dónde salen los datos. **Verde**: conectado a la base master.
**Rojo**: sin conexión, mostrando la estructura local sin datos reales. Púlselo para reintentar.

Abierto desde GitHub Pages el punto siempre estará en rojo: es un dominio ajeno a Google y el
navegador bloquea la lectura de la hoja. Los datos vivos están en la URL `/exec` de Apps Script.

---

## Estado actual

| Componente | Estado |
|---|---|
| Base master en Google Sheets | Estructurada y verificada (24/07/2026) |
| Fórmulas de KPIs e indicadores | Calculando correctamente |
| Panel ejecutivo (`Panel.html` en Apps Script) | Pendiente de implementar |
| Vista previa en GitHub Pages | Publicada, sin datos en vivo |

---

## Antes de publicar este repositorio

Este proyecto administra información de **vetting de servidores públicos** que incluye datos
personales sensibles: nombre, CURP, CUIP, fecha de nacimiento, control de confianza, adscripción
y correo institucional.

1. **Mantenga el repositorio privado** salvo decisión expresa en contrario.
2. **Nunca haga commit de datos reales de personas.** El libro y la plantilla CSV incluidos
   contienen únicamente plazas por designar y valores ficticios.
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
| `Panel.html` | Panel ejecutivo. Es el archivo que se pega en Apps Script. |
| `index.html` | Copia idéntica de `Panel.html` para vista previa en GitHub Pages (sin datos en vivo). |
| `Codigo.gs` | Apps Script: estructura la base, sirve el panel y le entrega los datos procesados. |
| `appsscript.json` | Manifiesto del proyecto de Apps Script (necesario solo si usa `clasp`). |
| `RASTROS_UNODC_Master_DB.xlsx` | Libro con las 6 pestañas listas para importar a Google Sheets. |
| `generar_libro_maestro.py` | Script que regenera el libro anterior desde cero (`openpyxl`). |
| `Vetting_Beneficiarios_plantilla.csv` | Plantilla de carga con los nueve encabezados exactos. |
| `.gitignore` | Exclusiones de trabajo local. |
| `.nojekyll` | Evita que GitHub Pages procese el sitio con Jekyll. |
| `MANUAL_CAPTURA.md` | Manual de captura paso a paso, escenario por escenario. |
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
idempotente. Antes de reestructurar una base con capturas, use **▸ RASTROS ▸ Respaldar libro**.

Pestañas resultantes:

1. `Control_Metas_y_KPIs` — las 4 metas e indicadores operativos calculados.
2. `Vetting_Beneficiarios` — control de propuestas y su estatus ante la Embajada.
3. `Respuestas_Formulario_Diagnostico` — 67 preguntas en las 8 secciones del instrumento.
4. `Mesas_de_Trabajo_y_Capacitaciones` — logística y acuerdos de cada evento.
5. `Listas_Catalogos` — alimenta las listas desplegables. No la borre.
6. `Mapeo_Formato_VETTING_Oficial` — espejo de las 31 columnas del formato de la Embajada.

**Los nombres de pestaña y de encabezado no se renombran.** El código los busca literalmente.

### 2. Panel ejecutivo (aplicación de Apps Script)

0. Si su base ya estaba estructurada, ejecute una sola vez
   **▸ RASTROS ▸ Crear pestañas dinámicas**. Es aditivo: crea las cuatro pestañas nuevas y la
   columna de abreviaturas sin tocar una sola celda de lo existente.
1. Pulse **+ ▸ HTML**, nombre el archivo **`Panel`** (sin extensión) y pegue el contenido de
   `Panel.html`. El nombre importa: `doGet()` lo busca exactamente así.
2. **Implementar ▸ Nueva implementación ▸ Tipo: Aplicación web**
   - Ejecutar como: **Usuario que accede**
   - Quién tiene acceso: **Solo yo** si el libro está en una cuenta personal, o
     **Usuarios de jalisco.gob.mx** si se migró al Workspace institucional.
     No use *Cualquier usuario*: expondría la base de vetting.
3. Copie la URL que termina en `/exec`.

Para recuperarla más tarde: **▸ RASTROS ▸ Ver URL del tablero web**.

Cada vez que modifique `Codigo.gs` o `Panel.html` debe pulsar **Implementar ▸ Gestionar
implementaciones ▸ Editar ▸ Versión: Nueva**. La URL no cambia. Es el descuido más común: se
edita, se recarga y no pasa nada, porque la implementación sigue apuntando a la versión anterior.

### 3. GitHub Pages (opcional)

*Settings ▸ Pages ▸ Deploy from a branch ▸ `main` / `root`*. El archivo `.nojekyll` ya está
incluido.

---

## Arquitectura de datos

El panel resuelve su fuente en cascada: `google.script.run` → CSV público → estructura local.

`obtenerDatosTablero()` es la única puerta de entrada y **entrega los agregados ya calculados**,
para que el panel, el reporte impreso y cualquier consumidor futuro vean las mismas cifras:

- `beneficiarios` — registros de vetting.
- `porDependencia` — acumulado por entidad, incluidas las que aún no reportan ninguna propuesta.
- `alertas` — tarjetas de cuellos de botella con su nivel (`critica` / `atencion` / `ok`).
- `diagnostico` — recibidos, validados, meta y desglose por institución (columna P05).
- `eventos`, `metas` (con nombre, descripción, objetivos y fuente), `diasRestantes`.
- `metadatos`, `configuracion`, `pendientesUnodc`, `rutaCritica`, `catalogos`, `abreviaturas`.

Funciones de lectura: `leerConfiguracion()`, `leerMetadatos()`, `leerPendientesUNODC()`,
`leerRutaCritica()`, `leerCatalogos()`, `leerAbreviaturas()`. Todas con caché por ejecución y
lectura acotada al contenido real de cada hoja.

El frontend replica esa lógica **solo como respaldo**, para que la vista previa y la lectura por
CSV muestren lo mismo. Si el servidor manda los agregados, mandan ellos.

### Supuesto que conviene revisar

`CUOTA_POR_DEPENDENCIA = 2` alimenta la alerta de *dependencias por debajo de cuota*. Sale de la
minuta del 22/07/2026, donde UNODC habló de «tal vez uno, dos por unidad», no de una cifra formal.
**Ya no se edita en el código:** cámbielo en `Configuracion_Dashboard`.

### Captura desde el panel

`agregarBeneficiario()` sigue en `Codigo.gs`, probada y funcional, pero **sin uso**: el rediseño
retiró el formulario de alta. Para reactivarla basta con volver a llamarla con `google.script.run`
desde `Panel.html`. Escribe validando en el servidor, rechaza correos duplicados y usa
`LockService` contra escrituras simultáneas.

---

## Convenciones del libro

- Celdas en **azul**: datos de ejemplo, sustitúyalos por los reales.
- Celdas **amarillas** en `Control_Metas_y_KPIs`: avance manual de las metas 1, 3 y 4. La meta 2
  se calcula sumando los asistentes de los eventos tipo *Capacitación*.
- Todo lo demás son fórmulas. Si las sobrescribe, el panel dejará de reflejar el avance.

Para regenerar el libro: `python3 generar_libro_maestro.py salida.xlsx` (requiere `openpyxl`).
Genera el archivo sin recalcular, a propósito: Google Sheets computa las fórmulas al importar, y
pasarlo por LibreOffice truncaría los nombres largos de pestaña.

---

## Fechas y acuerdos de referencia

Conforme a la reunión con UNODC del 22 de julio de 2026:

- **29 de julio de 2026** — cierre de propuestas de vetting y de comentarios al formulario de
  diagnóstico. Los comentarios los formulan únicamente los tomadores de decisiones.
- **Semana del 24 de agosto de 2026** — reunión presencial con personal clave con nivel de mando
  o vínculo de comunicación con los operativos.
- La sede externa, alimentos, catering y coffee break corren a cargo de UNODC.
- Pendiente: confirmar con UNODC si la Embajada requerirá el Anexo 3.

---

## Notas técnicas

- `Panel.html` usa Tailwind por CDN y tipografías de Google Fonts; requiere conexión a internet.
- No se usa `localStorage` ni ningún almacenamiento del navegador.
- El script precarga formato y validaciones en 200 filas (`CFG.FILAS_PRECARGADAS`).

## Licencia

Sin licencia definida. Antes de abrir el repositorio, determine el régimen aplicable con el área
jurídica, considerando que el proyecto se ejecuta con financiamiento del Departamento de Estado
de los Estados Unidos a través de UNODC.
