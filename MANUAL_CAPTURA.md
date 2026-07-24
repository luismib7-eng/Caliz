# Manual de captura — Base master RASTROS

**Para:** Enlace Coordinador · Coordinación General Estratégica de Seguridad
**Libro:** `RASTROS_UNODC_Master_DB` (Google Sheets)
**Última revisión:** 24 de julio de 2026 · incluye las 4 pestañas dinámicas

---

## Cómo usar este manual

El panel ejecutivo **solo lee**. Todo lo que se ve ahí sale de este libro. Si una cifra está mal
en el panel, el error está en una celda de aquí.

La regla que resume todo el documento: **usted captura en las columnas de texto y en los
desplegables; el libro calcula el resto.** Cada pestaña tiene columnas de fórmula que se ven como
datos normales pero no lo son. Sobrescribir una de ellas rompe el cálculo de esa fila para
siempre, sin aviso.

Cuando reciba algo, busque el escenario que corresponda:

| Le llega… | Vaya a |
|---|---|
| Oficio con candidatos para vetting | [Escenario A](#escenario-a) |
| Minuta, lista de asistencia o acuerdos de un evento | [Escenario B](#escenario-b) |
| Cuestionarios de diagnóstico respondidos | [Escenario C](#escenario-c) |
| Avance en programas, investigaciones o redes ToT | [Escenario D](#escenario-d) |
| Momento de enviar el paquete a la Embajada | [Escenario E](#escenario-e) |
| Un pendiente con UNODC se resuelve o aparece uno nuevo | [Escenario F](#escenario-f) |
| Cambia una fecha, se pospone una reunión | [Escenario G](#escenario-g) |
| UNODC cambia la cuota, la meta o la fecha límite | [Escenario H](#escenario-h) |
| El proyecto entra en una fase nueva | [Escenario I](#escenario-i) |

---

# 1. Estructura general del libro

Seis pestañas. Dos son de trabajo diario, dos de registro periódico, una es infraestructura y una
es de salida.

### `Control_Metas_y_KPIs` — el semáforo
Las 4 metas del proyecto en las filas 2 a 5, y debajo diez indicadores operativos que se calculan
solos. **Es la única pestaña donde usted escribe números a mano**, y nada más en tres celdas.
Todo lo demás lee de las otras pestañas.

### `Vetting_Beneficiarios` — el corazón operativo
Una fila por persona propuesta. Es lo que alimenta el Módulo 2 del panel y lo que eventualmente
se convierte en el paquete que va a la Embajada. Formato preparado en 200 filas.

### `Respuestas_Formulario_Diagnostico` — el instrumento
Las 67 preguntas del cuestionario, una columna cada una, agrupadas bajo las 8 bandas de sección.
Tiene **dos filas de encabezado**: la fila 1 son las bandas de sección y la fila 2 los nombres de
pregunta. **Los datos empiezan en la fila 3.** Formato preparado en 200 filas.

### `Mesas_de_Trabajo_y_Capacitaciones` — la bitácora de eventos
Una fila por mesa de trabajo o capacitación, con su logística y sus acuerdos. Alimenta la Meta 2
de forma automática. Formato preparado en 60 filas.

### `Listas_Catalogos` — infraestructura
Los seis catálogos que alimentan las listas desplegables. **No la borre, no la renombre y no
reordene sus columnas.** Si borra esta pestaña, todos los desplegables del libro dejan de
funcionar. Solo la toca para agregar un valor nuevo a un catálogo.

### `Pendientes_UNODC`, `Ruta_Critica`, `Configuracion_Dashboard`, `Metadatos_Proyecto` — el panel
Las cuatro pestañas que controlan lo que antes estaba escrito dentro del código: los pendientes
que se muestran, los hitos de la ruta crítica, los umbrales de las alertas y los textos del
encabezado. Ver escenarios [F](#escenario-f) a [I](#escenario-i).

### `Mapeo_Formato_VETTING_Oficial` — la salida
Espejo de las 31 columnas del archivo oficial `Formato VETTING 2026.xlsx` que recibe la Embajada.
Se llena únicamente cuando toca enviar. Ver [Escenario E](#escenario-e).

---

<a name="escenario-a"></a>
# 2. Escenario A — Llega una propuesta de vetting

> **Ejemplo:** la Fiscalía Especializada envía oficio con dos personas propuestas.

### Pestaña: `Vetting_Beneficiarios`

Ubique la primera fila cuya columna **B (Nombre)** esté vacía. Hoy es la fila 13, porque las filas
2 a 12 traen las once plazas por designar precargadas.

> Si la propuesta corresponde a una de esas plazas precargadas, **sustituya el texto «Por
> designar»** en esa fila en lugar de crear una nueva. Así no duplica el registro.

### Qué capturar en cada columna

| Col. | Encabezado | ¿Quién lo llena? | Reglas |
|:--:|---|---|---|
| **A** | `ID_Beneficiario` | 🔒 **Fórmula** | Se genera solo (`RAS-VET-013`) al escribir el nombre. **Nunca escriba aquí.** |
| **B** | `Nombre` | Usted | Obligatorio. Nombre completo como aparece en el oficio. |
| **C** | `Cargo` | Usted | Obligatorio. El cargo formal, no una descripción. |
| **D** | `Dependencia` | Usted | Obligatorio. **Use el desplegable.** No teclee el nombre. |
| **E** | `Tipo_Rol` | Usted | Obligatorio. Desplegable: `Tomador de decisiones` u `Operativo`. |
| **F** | `Correo` | Usted | **Obligatorio.** Ver la advertencia abajo. |
| **G** | `Estatus_Vetting` | Usted | Desplegable. Empieza en `Pendiente`. |
| **H** | `Fecha_Limite_Envio` | Precargada | Ya dice 29/07/2026. **Déjela como está.** |
| **I** | `Observaciones` | Usted | Libre. Número de oficio, fecha de recepción, salvedades. |

### Tres advertencias que importan

**El correo no es opcional.** El formato de la Embajada lo exige. Un registro sin correo aparece
en rojo en la tabla del panel y dispara la alerta «Registros sin correo» del Módulo 1, porque esa
persona no puede enviarse todavía. Si el oficio no lo trae, capture el resto y anote en
Observaciones «correo solicitado a la dependencia el DD/MM».

**Teclear la dependencia en vez de elegirla del desplegable rompe la agrupación.** Si escribe
«Fiscalía Especializada» en lugar de seleccionar `Fiscalía Especializada en Trata de Personas`,
el panel la tratará como una entidad distinta y le aparecerán dos tarjetas para la misma
institución. La validación le avisará, pero no se lo impide.

**La columna A y la columna H no se tocan.** La A tiene la fórmula del ID; si escribe encima, esa
fila pierde su identificador permanentemente. La H trae la fecha precargada en las 200 filas.

### Conforme avanza el trámite

Actualice solo la columna **G**:

| Estatus | Cuándo ponerlo | Color en el panel |
|---|---|---|
| `Pendiente` | Recibió la propuesta, aún no la envía | 🔴 Rojo |
| `Enviado Embajada` | Ya salió en el paquete | 🟡 Amarillo |
| `Aprobado` | La Embajada confirmó | 🟢 Verde |

---

<a name="escenario-b"></a>
# 3. Escenario B — Se realizó una mesa de trabajo o capacitación

> **Ejemplo:** se llevó a cabo la mesa del 26 de agosto; llegan minuta, lista de asistencia y
> acuerdos.

### Pestaña: `Mesas_de_Trabajo_y_Capacitaciones`

Las filas 2 y 3 ya traen las dos mesas de agosto precargadas. Si el evento es una de ellas,
complete esa fila; si es nuevo, use la primera fila con la columna **B** vacía.

| Col. | Encabezado | ¿Quién lo llena? | Reglas |
|:--:|---|---|---|
| **A** | `ID_Evento` | 🔒 **Fórmula** | Se genera solo (`RAS-EVT-03`). **No escriba aquí.** |
| **B** | `Tipo` | Usted | Desplegable. Ver la advertencia sobre la Meta 2. |
| **C** | `Fecha` | Usted | Formato fecha. Escriba `26/08/2026`, no texto. |
| **D** | `Sede_Externa` | Usted | Lugar real donde se realizó. |
| **E** | `Estatus_Catering` | Usted | Desplegable de cuatro valores. |
| **F** | `Asistentes_Confirmados` | Usted | **Solo el número.** Ver abajo. |
| **G** | `Acuerdos_Principales` | Usted | Resumen de los acuerdos. Es lo que se ve en el panel. |
| **H** | `Link_Minuta_PDF` | Usted | Enlace de Drive. Ver abajo. |

### Cómo la columna F alimenta la Meta 2 — léalo con atención

La celda `F3` de `Control_Metas_y_KPIs` contiene:

```
=SUMIF(Mesas_de_Trabajo_y_Capacitaciones!$B$2:$B$61,"Capacitación",
       Mesas_de_Trabajo_y_Capacitaciones!$F$2:$F$61)
```

Traducido: **suma la columna F de todas las filas cuyo Tipo diga exactamente `Capacitación`.**
Tres consecuencias prácticas:

1. **Las mesas de trabajo no cuentan** para la Meta 2, y así debe ser: la meta mide funcionarios
   capacitados, no asistentes a reuniones de planeación. Si registra una capacitación como «Mesa
   de Trabajo», sus asistentes desaparecen del indicador.
2. **Elija el tipo del desplegable.** La palabra lleva acento. Si teclea «Capacitacion» sin
   acento, el `SUMIF` no la reconoce y suma cero, sin marcar error.
3. **En F va un número, no texto.** `25` funciona; `25 personas` o `aprox. 25` devuelven cero.
   Si la lista de asistencia trae 23 firmas de 25 convocados, capture 23: la meta mide
   capacitados, no invitados.

### Dónde y cómo pegar el enlace de la minuta

1. Suba el PDF a la carpeta del proyecto en Google Drive.
2. Clic derecho ▸ **Compartir ▸ Copiar vínculo**.
3. Verifique el acceso: si dice «Restringido», quien abra el panel sin permisos verá una
   pantalla de solicitud. Para documentos del proyecto, compártalo con las personas que deban
   consultarlo, no con «cualquier persona con el vínculo».
4. Pegue la URL completa en la columna **H**. El panel la convierte en un enlace «minuta» dentro
   de la columna de acuerdos.

Recomendación de nombre de archivo, para que el Drive no se vuelva un pantano:
`RASTROS_Minuta_2026-08-26_MesaTrabajo.pdf`.

---

<a name="escenario-c"></a>
# 4. Escenario C — Llegan respuestas del formulario de diagnóstico

### Pestaña: `Respuestas_Formulario_Diagnostico`

**Los datos empiezan en la fila 3.** Las filas 1 y 2 son encabezados: la 1 tiene las bandas de
sección combinadas y la 2 los nombres de las 67 preguntas.

| Col. | Encabezado | ¿Quién lo llena? | Reglas |
|:--:|---|---|---|
| **A** | `Marca_temporal` | Usted | Fecha de recepción. Formato fecha, no texto. |
| **B** | `ID_Respuesta` | 🔒 **Fórmula** | Se genera solo (`RAS-DIA-001`) al llenar la A. **No escriba aquí.** |
| **C** | `Estatus_Validacion` | Usted | Desplegable de cuatro valores. Ver abajo. |
| **D–BR** | `P01` a `P67` | Usted | Una columna por pregunta, en el orden del instrumento. |

### Si el cuestionario se aplica por Google Forms

Es lo previsto por UNODC. En ese caso las respuestas caen en una hoja distinta que Forms crea
automáticamente. Para consolidarlas aquí:

1. Copie el bloque de respuestas de la hoja de Forms.
2. Péguelo a partir de la celda **D3** con **Ctrl+Shift+V** (pegado especial, solo valores).
   El pegado normal arrastra formatos y puede desarmar las bandas de sección.
3. Verifique que el orden de columnas coincida pregunta por pregunta. Forms respeta el orden del
   formulario; si alguien reordenó preguntas después de crearlo, revise antes de pegar.
4. Llene manualmente las columnas A y C de las filas pegadas.

### La columna C es la que mueve los contadores

| Valor | Efecto en el panel |
|---|---|
| *(vacío)* | No cuenta como recibido. |
| `Recibida` | Suma a «recibidos». |
| `En revisión` | Suma a «recibidos», aparece en «por validar». |
| **`Validada`** | Suma a «recibidos» **y** a «validados». Es el único valor que mueve la barra verde. |
| `Descartada` | Suma a «recibidos» pero nunca a «validados». |

El conteo de recibidos depende de la columna **B**, que a su vez depende de la **A**. Si pega
respuestas sin capturar la marca temporal, el cuestionario no existe para el panel.

### El desglose por dependencia sale de P05

La columna **H** (`P05. Institución a la que pertenece`) es la que agrupa el desglose del Módulo 3.
Si esa celda queda vacía, la respuesta aparece bajo «Sin institución declarada». No es un error
que rompa nada, pero le quita utilidad al desglose.

---

<a name="escenario-d"></a>
# 5. Escenario D — Avance en metas 1, 3 y 4

> **Ejemplo:** UNODC valida el programa de formación para Jalisco; o la Fiscalía informa que ya
> hay tres carpetas de investigación vinculadas.

### Pestaña: `Control_Metas_y_KPIs` — solo tres celdas

Estas son **las únicas celdas del libro donde usted escribe un número a mano**. Están marcadas
en **amarillo**:

| Celda | Meta | Qué cuenta | Objetivo |
|:--:|---|---|:--:|
| **F2** | Meta 1 · Programas diseñados | Programas de formación diseñados e implementados | 3 (1 Jalisco) |
| **F4** | Meta 3 · Investigaciones TIP / OSO | Casos de trata vinculados a estafas en línea investigados | 15 (5 Jalisco) |
| **F5** | Meta 4 · Redes de formadores | Redes ToT constituidas | 3 (1 Jalisco) |

**`F3` no se toca.** Es la Meta 2 y se calcula sola desde la pestaña de eventos ([Escenario B](#escenario-b)).

### Todo lo demás en esa pestaña es fórmula

- **G2:G5** (`Avance_%`) — calcula real ÷ objetivo.
- **H2:H5** (`Semáforo`) — devuelve `CUMPLIDA`, `EN AVANCE`, `INICIADA` o `SIN AVANCE`.
- **C8:C17** — los diez indicadores operativos, que leen de las otras pestañas.

Escriba un número en cualquiera de ellas y perderá el cálculo de esa fila.

### Documente la fuente

Cada vez que suba un número en F2, F4 o F5, anote de dónde salió en la columna
**I (`Fuente_de_Verificación`)** o en un comentario de celda (clic derecho ▸ Comentar). Cuando
UNODC pida el respaldo de «5 investigaciones», va a necesitar saber qué oficio lo sustenta. Un
número sin origen es un número que no se puede defender.

---

<a name="escenario-e"></a>
# 6. Escenario E — Preparar el paquete para la Embajada

### Pestaña: `Mapeo_Formato_VETTING_Oficial`

Esta pestaña existe para que **el control interno nunca se toque al exportar**.
`Vetting_Beneficiarios` es suyo: tiene el estatus, las observaciones y la trazabilidad. El
formato de la Embajada pide 31 campos en otro orden, con datos que usted no administra a diario
(CURP, CUIP, fecha de nacimiento, control de confianza). Mezclarlos en una sola pestaña
convertiría su tablero en un formulario burocrático.

### ⚠️ Antes de capturar por primera vez

**La celda A2 contiene una nota explicativa, no un dato.** Bórrela antes de empezar, o comience a
capturar en la fila 3. Si escribe encima sin darse cuenta, no pasa nada grave, pero conviene
dejarlo limpio de entrada.

### Procedimiento

1. **Filtre lo que va a enviar.** En `Vetting_Beneficiarios`, filtre la columna G por `Pendiente`
   y quédese con los registros que tengan correo capturado. Los que no lo tengan no pueden ir.
2. **Traslade lo que ya tiene.** De cada registro seleccionado pasan directo cuatro campos:
   correo, dependencia, puesto y, partiendo el nombre completo, `Nombre(s)` y `Apellidos`.
   Use **Ctrl+Shift+V** para pegar solo valores.
3. **Complete lo que falta.** Los 26 campos restantes salen del formato que llenó cada
   dependencia: CURP, CUIP, fecha y lugar de nacimiento, nivel de estudios, nivel de inglés,
   teléfono, residencia, rango, control de confianza y su fecha, años de experiencia, contacto
   institucional, unidad en organigrama y autorización del Gobierno de México.
4. **Exporte.** Archivo ▸ Descargar ▸ Microsoft Excel. Abra el archivo oficial
   `Formato VETTING 2026.xlsx`, vaya a la pestaña `Participants` y pegue el bloque bajo sus
   encabezados. Las columnas están en el mismo orden, por eso esta pestaña es un espejo.
5. **Cierre el ciclo.** Regrese a `Vetting_Beneficiarios` y cambie la columna G a
   `Enviado Embajada` para los registros que salieron. Anote en Observaciones la fecha y el
   número de oficio. Si no hace este paso, el panel seguirá reportándolos como pendientes.

### Después de enviar

Vacíe la pestaña de mapeo, o al menos marque en Observaciones qué envío corresponde a qué fecha.
Es una pestaña de trabajo, no un archivo histórico: el histórico vive en
`Vetting_Beneficiarios`.

---

<a name="escenario-f"></a>
# 6-bis. Escenario F — Cambia un pendiente con UNODC

### Pestaña: `Pendientes_UNODC`

| Col. | Encabezado | Reglas |
|:--:|---|---|
| **A** | `ID_Pendiente` | Consecutivo manual: `P005`, `P006`… No hay fórmula. |
| **B** | `Titulo` | Corto. Es lo que se ve en negritas en el panel. |
| **C** | `Descripcion` | El detalle. La **primera oración** es la que aparece en la tarjeta de alerta del Módulo 1, así que póngala primero y complete. |
| **D** | `Responsable` | Desplegable. Quién debe destrabarlo. |
| **E** | `Estatus` | Desplegable: `Pendiente` · `En Gestión` · `Resuelto`. |
| **F** | `Nivel_Alerta` | Desplegable: `Crítica` · `Atención` · `OK`. |
| **G** | `Fecha_Vencimiento` | Opcional. Si la pone y ya pasó, el panel lo marca «vencido» en rojo. |

**Marcar `Resuelto` lo saca del panel.** No borre la fila: el histórico sirve. Solo cambie la
columna E y desaparece de la lista y de la alerta.

Solo los de nivel `Crítica` alimentan la cifra de la tarjeta «Pendientes con UNODC» del Módulo 1.
Si no hay ninguno crítico, la tarjeta baja a ámbar y muestra cuántos hay abiertos.

---

<a name="escenario-g"></a>
# 6-ter. Escenario G — Se mueve una fecha o se completa un hito

### Pestaña: `Ruta_Critica`

| Col. | Encabezado | Reglas |
|:--:|---|---|
| **A** | `ID_Hito` | Consecutivo manual: `H006`, `H007`… |
| **B** | `Fecha` | **Admite texto libre.** «Semana del 24 de agosto» es válido. |
| **C** | `Actividad` | Qué hay que hacer. |
| **D** | `Responsable` | Desplegable. |
| **E** | `Estatus` | Desplegable: `Futuro` (gris) · `En Curso` (azul) · `Completado` (verde, tachado). |
| **F** | `Notas` | Opcional. Aparece en letra pequeña bajo la actividad. |

**El orden del panel es el orden de las filas.** No se ordena por fecha, y es a propósito: la
columna B admite rangos en texto que ninguna función de ordenamiento entiende. Para reordenar,
mueva las filas en la hoja.

Los hitos `Completado` siguen visibles en el panel, tachados, pero **se excluyen del reporte
semanal**, que solo lista lo que viene.

---

<a name="escenario-h"></a>
# 6-quater. Escenario H — Cambian las reglas del proyecto

### Pestaña: `Configuracion_Dashboard`

Cinco parámetros. **Solo se toca la columna B (`Valor`).** Las celdas están en amarillo.

| Parámetro | Qué controla | Si lo cambia… |
|---|---|---|
| `CUOTA_POR_DEPENDENCIA` | Propuestas mínimas esperadas por entidad | Cambia qué dependencias salen en rojo por debajo de cuota |
| `META_DIAGNOSTICO` | Cuestionarios previstos en Jalisco | Cambia el denominador de la barra del Módulo 3 |
| `FECHA_LIMITE_VETTING` | Fecha límite de vetting | Cambia el banner, la cuenta regresiva y el reporte |
| `DIAS_CRITICOS` | Umbral de alerta roja | A menos días, la alerta tarda más en ponerse roja |
| `DIAS_ATENCION` | Umbral de alerta ámbar | Igual, para el nivel intermedio |

**No renombre la columna A.** El código busca cada parámetro por su nombre exacto; si no lo
encuentra, usa el valor de respaldo del código y sigue funcionando, pero su cambio se ignora en
silencio. Si escribe texto donde va un número, pasa lo mismo: queda registrado en el log de Apps
Script y se conserva el respaldo.

`FECHA_LIMITE_VETTING` debe ser **una fecha real**, no texto. Si la celda muestra la fecha
alineada a la izquierda, Sheets la está tratando como texto: reescríbala como `29/07/2026`.

> Ojo: cambiar aquí la fecha límite **no** modifica la columna H de `Vetting_Beneficiarios`, que
> tiene la fecha precargada en cada fila. Si la fecha se recorre de verdad, actualice también esa
> columna.

---

<a name="escenario-i"></a>
# 6-quinquies. Escenario I — El proyecto cambia de fase

### Pestaña: `Metadatos_Proyecto`

Ocho campos, dos columnas. **Solo se toca la columna B.**

| Campo | Dónde se ve |
|---|---|
| `Titulo_Proyecto` | Título grande y pestaña del navegador |
| `Subtitulo` | Línea bajo el título |
| `Fase_Actual` | Bloque «Fase actual», arriba a la derecha |
| `Periodo` | Línea gris bajo la fase |
| `Paises` | Misma línea, después del periodo |
| `Donante`, `Institucion_Ejecutora`, `Institucion_Contraparte` | Cintillo superior en mayúsculas |

Para agregar un campo nuevo hay que tocar el código; los ocho existentes se editan libremente.

---

# 7. Reglas de oro

## 7.1 Celdas que nunca se sobrescriben

| Pestaña | Rango | Qué es |
|---|---|---|
| `Vetting_Beneficiarios` | **A2:A201** | Fórmula del ID (`RAS-VET-001`) |
| `Vetting_Beneficiarios` | **H2:H201** | Fecha límite precargada 29/07/2026 |
| `Respuestas_Formulario_Diagnostico` | **B3:B202** | Fórmula del ID (`RAS-DIA-001`) |
| `Respuestas_Formulario_Diagnostico` | **Filas 1 y 2** | Bandas de sección y nombres de pregunta |
| `Mesas_de_Trabajo_y_Capacitaciones` | **A2:A61** | Fórmula del ID (`RAS-EVT-01`) |
| `Control_Metas_y_KPIs` | **F3** | Meta 2, calculada desde eventos |
| `Control_Metas_y_KPIs` | **G2:G5** y **H2:H5** | Avance y semáforo |
| `Control_Metas_y_KPIs` | **C8:C17** | Los diez indicadores operativos |
| Todas | **Fila 1** | Encabezados |

**Si borró una fórmula por accidente:** cópiela de la fila de arriba y péguela en la celda
afectada; Google ajusta las referencias solas. Si ya no hay ninguna intacta, use
**Archivo ▸ Historial de versiones ▸ Ver historial** y restaure. No reescriba la fórmula de
memoria.

## 7.2 Nombres que no se cambian

El código busca las pestañas y los encabezados **por su texto exacto**. Renombrar cualquiera
rompe la lectura sin dar error visible: el panel simplemente muestra ceros.

Pestañas: `Control_Metas_y_KPIs` · `Vetting_Beneficiarios` ·
`Respuestas_Formulario_Diagnostico` · `Mesas_de_Trabajo_y_Capacitaciones` ·
`Listas_Catalogos` · `Mapeo_Formato_VETTING_Oficial`

Encabezados de vetting: `ID_Beneficiario` · `Nombre` · `Cargo` · `Dependencia` · `Tipo_Rol` ·
`Correo` · `Estatus_Vetting` · `Fecha_Limite_Envio` · `Observaciones`

Van con **guion bajo y sin acentos añadidos**. `Estatus Vetting` con espacio no es lo mismo que
`Estatus_Vetting`.

Tampoco reordene, inserte ni elimine columnas: el código lee la institución del diagnóstico por
posición (columna H).

## 7.3 Si se pasa de las 200 filas

Con 200 plazas de vetting va sobrado para Jalisco, pero si llegara a ocurrir, son tres pasos:

1. **Extienda las fórmulas.** Seleccione la última celda con fórmula de la columna A y arrástrela
   hacia abajo. Copie también la fecha de la columna H.
2. **Extienda las validaciones.** Datos ▸ Validación de datos, seleccione una celda que sí tenga
   desplegable, cópiela y péguela en el rango nuevo con **Ctrl+Shift+V** (solo validación no
   existe como opción; pegar la celda completa y borrar su contenido funciona).
3. **Amplíe los rangos de los indicadores.** Éste es el paso que se olvida. Las fórmulas de
   `Control_Metas_y_KPIs` apuntan a rangos fijos:
   - `C8:C17` usan `Vetting_Beneficiarios!$B$2:$B$201` y similares → cambie `201` por el número
     nuevo.
   - `F3` usa `$B$2:$B$61` y `$F$2:$F$61` de la pestaña de eventos.
   - El diagnóstico usa `$B$3:$B$202`.

   Si no los amplía, los registros nuevos existen en la hoja pero el panel no los cuenta.

## 7.4 Rutina recomendada

**Cada vez que capture:** verifique que el registro nuevo aparezca en los indicadores de
`Control_Metas_y_KPIs`. Si el contador no se movió, algo quedó mal.

**Cada semana, antes de generar el reporte:** abra el panel, revise el Módulo 1 y confirme que
las alertas coinciden con lo que usted sabe. El panel no inventa: si dice que faltan propuestas
en una dependencia, es porque no están capturadas.

**Cada mes:** **▸ RASTROS ▸ Respaldar libro** desde el menú de Apps Script, o
Archivo ▸ Hacer una copia. El historial de versiones de Google protege contra errores de edición,
no contra un borrado del archivo.

---

# 8. Referencia rápida

| Recibo… | Pestaña | Columnas que lleno | Qué se calcula solo |
|---|---|---|---|
| Oficio con candidatos | `Vetting_Beneficiarios` | B, C, D, E, F, G, I | ID, tarjetas por dependencia, alertas |
| Minuta y lista de asistencia | `Mesas_de_Trabajo_y_Capacitaciones` | B, C, D, E, F, G, H | ID, Meta 2 |
| Cuestionarios respondidos | `Respuestas_Formulario_Diagnostico` | A, C, D–BR | ID, barras del diagnóstico |
| Avance de programas / casos / ToT | `Control_Metas_y_KPIs` | F2, F4, F5 | Avance %, semáforo |
| Momento de enviar a la Embajada | `Mapeo_Formato_VETTING_Oficial` | Las 31, desde fila 3 | Nada: es hoja de salida |
| Un pendiente cambia | `Pendientes_UNODC` | A–G | Tarjeta de alerta del Módulo 1 |
| Se mueve una fecha | `Ruta_Critica` | A–F | Ruta crítica y reporte semanal |
| Cambia una regla del proyecto | `Configuracion_Dashboard` | Solo B | Umbrales, cuotas y banner |
| Cambia la fase | `Metadatos_Proyecto` | Solo B | Encabezado completo |

### Valores exactos de los desplegables

- **Tipo_Rol:** Tomador de decisiones · Operativo
- **Estatus_Vetting:** Pendiente · Enviado Embajada · Aprobado
- **Tipo (evento):** Mesa de Trabajo · Capacitación
- **Estatus_Catering:** No requerido · Solicitado a UNODC · Confirmado · Cubierto
- **Estatus_Validacion:** Recibida · En revisión · Validada · Descartada
- **Responsable:** UNODC · CGES · Secretaría de Seguridad · Fiscalía del Estado · Fiscalía Especializada · Policía Cibernética · Embajada de EE. UU. · Otra
- **Estatus (pendientes):** Pendiente · En Gestión · Resuelto
- **Nivel_Alerta:** Crítica · Atención · OK
- **Estatus (hitos):** Futuro · En Curso · Completado
- **Tipo (parámetro):** Número · Texto · Fecha · Booleano

Para agregar un valor nuevo a cualquier catálogo, escríbalo en la columna correspondiente de
`Listas_Catalogos` **y amplíe el rango de validación** en la pestaña que lo usa. Si solo hace lo
primero, el valor existe pero el desplegable no lo ofrece.

---

*Documento de trabajo interno de la Dirección General de Análisis y Políticas Públicas.
No constituye documento oficial del Proyecto RASTROS.*
