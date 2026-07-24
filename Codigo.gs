/**
 * ============================================================================
 * PROYECTO RASTROS — UNODC / GOBIERNO DEL ESTADO DE JALISCO
 * Acción Regional para apoyar a los países en la lucha contra la trata de
 * personas perpetrada a través de operaciones de estafa en línea (2025–2027)
 * ----------------------------------------------------------------------------
 * ESTRUCTURADOR AUTOMÁTICO DE LA BASE MASTER  ·  RASTROS_UNODC_Master_DB
 *
 * INSTALACIÓN
 *   1. Abrir la hoja master:
 *      https://docs.google.com/spreadsheets/d/1sufZxmUgFnd5M1a00EhyoM0VRbU0z4f5hs3cGbrA73g/edit
 *   2. Menú  Extensiones ▸ Apps Script
 *   3. Borrar el contenido de Código.gs y pegar TODO este archivo.
 *   4. Guardar (Ctrl+S) y ejecutar la función  setupMasterDB
 *   5. Autorizar los permisos cuando Google lo solicite.
 *   6. Recargar la hoja: aparecerá el menú  ▸ RASTROS
 *
 * ADVERTENCIA: setupMasterDB() reconstruye los encabezados de las 4 pestañas.
 * Si ya existen datos capturados, ejecutar primero  respaldarLibro().
 * ============================================================================
 */

/* ─────────────────────────── CONFIGURACIÓN ─────────────────────────────── */

const CFG = {
  NOMBRE_LIBRO: 'RASTROS_UNODC_Master_DB',
  ID_LIBRO: '1sufZxmUgFnd5M1a00EhyoM0VRbU0z4f5hs3cGbrA73g',
  META_CUESTIONARIOS: 25,                         // funcionarios previstos en Jalisco
  CUOTA_POR_DEPENDENCIA: 2,                       // supuesto operativo; ajústelo si UNODC define otra cifra
  FECHA_LIMITE_VETTING: new Date(2026, 6, 29),   // 29 de julio de 2026
  FILAS_PRECARGADAS: 200,                         // filas con formato/validación
  ZONA_HORARIA: 'America/Mexico_City',
  CREAR_HOJAS_AUXILIARES: true,                   // Listas + Mapeo formato embajada
  COLORES: {
    azulUNODC: '#009EDB',
    azulMarino: '#003366',
    grisClaro: '#F2F5F7',
    alertaRoja: '#D0021B',
    alertaAmbar: '#F5A623',
    verdeOk: '#1E8E5A',
    textoClaro: '#FFFFFF'
  }
};

/* ───────────────────────── ESTRUCTURA DE PESTAÑAS ──────────────────────── */

const HOJAS = {

  /* ---- PESTAÑA 1 -------------------------------------------------------- */
  VETTING: {
    nombre: 'Vetting_Beneficiarios',
    encabezados: [
      'ID_Beneficiario',
      'Nombre',
      'Cargo',
      'Dependencia',
      'Tipo_Rol',
      'Correo',
      'Estatus_Vetting',
      'Fecha_Limite_Envio',
      'Observaciones'
    ],
    anchos: [130, 240, 220, 260, 190, 240, 190, 160, 320]
  },

  /* ---- PESTAÑA 3 -------------------------------------------------------- */
  MESAS: {
    nombre: 'Mesas_de_Trabajo_y_Capacitaciones',
    encabezados: [
      'ID_Evento',
      'Tipo',
      'Fecha',
      'Sede_Externa',
      'Estatus_Catering',
      'Asistentes_Confirmados',
      'Acuerdos_Principales',
      'Link_Minuta_PDF'
    ],
    anchos: [110, 170, 120, 260, 180, 190, 420, 260]
  },

  /* ---- PESTAÑA 4 -------------------------------------------------------- */
  KPIS: {
    nombre: 'Control_Metas_y_KPIs',
    encabezados: [
      'ID_Meta', 'Meta', 'Descripción', 'Objetivo_Global',
      'Objetivo_Jalisco', 'Real', 'Avance_%', 'Semáforo', 'Fuente_de_Verificación'
    ],
    anchos: [90, 300, 380, 140, 150, 90, 110, 110, 300]
  }
};

/* ---- PESTAÑAS DINÁMICAS (agregadas en el rediseño de julio 2026) ------ */
const HOJAS_DIN = {
  PENDIENTES: {
    nombre: 'Pendientes_UNODC',
    encabezados: ['ID_Pendiente', 'Titulo', 'Descripcion', 'Responsable',
                  'Estatus', 'Nivel_Alerta', 'Fecha_Vencimiento'],
    anchos: [120, 230, 460, 170, 140, 130, 160]
  },
  RUTA: {
    nombre: 'Ruta_Critica',
    encabezados: ['ID_Hito', 'Fecha', 'Actividad', 'Responsable', 'Estatus', 'Notas'],
    anchos: [100, 180, 420, 170, 140, 320]
  },
  CONFIG: {
    nombre: 'Configuracion_Dashboard',
    encabezados: ['Parametro', 'Valor', 'Descripcion', 'Tipo'],
    anchos: [250, 140, 460, 120]
  },
  METADATOS: {
    nombre: 'Metadatos_Proyecto',
    encabezados: ['Campo', 'Valor'],
    anchos: [240, 620]
  }
};

/** Semillas: el contenido que hasta ahora vivía dentro del código. */
const SEMILLA_PENDIENTES = [
  ['P001', 'Anexo 3',
   'Confirmar si la Embajada lo requerirá, para anticiparlo en la planeación logística de los oficios.',
   'UNODC', 'Pendiente', 'Crítica', ''],
  ['P002', 'Sede de las mesas de trabajo',
   'UNODC cubre alquiler, alimentos y coffee break. Falta definir el lugar.',
   'UNODC', 'En Gestión', 'Atención', ''],
  ['P003', 'Proyección y pantalla',
   'Por confirmar con la sede una vez definida.',
   'CGES', 'Pendiente', 'Atención', ''],
  ['P004', 'Reporte institucional de la capacitación',
   'Se gestiona internamente; UNODC apoya con los insumos que se requieran.',
   'CGES', 'En Gestión', 'OK', '']
];

const SEMILLA_RUTA = [
  ['H001', '29 de julio de 2026', 'Solicitud de vetting al personal de las unidades participantes',
   'CGES', 'En Curso', 'Fecha límite acordada con UNODC el 22/07/2026.'],
  ['H002', '29 de julio de 2026', 'Revisión del formulario de diagnóstico por tomadores de decisiones',
   'CGES', 'En Curso', 'Solo tomadores de decisiones, para acotar las observaciones.'],
  ['H003', '31 de julio de 2026', 'Confirmación de fecha y horario de la reunión presencial',
   'CGES', 'Futuro', ''],
  ['H004', 'Semana del 24 de agosto de 2026', 'Reunión presencial con personal clave y mesas de trabajo',
   'UNODC', 'Futuro', 'Sede externa, alimentos y catering a cargo de UNODC.'],
  ['H005', 'Septiembre de 2026', 'Aplicación en línea del formulario a todas las unidades',
   'UNODC', 'Futuro', '']
];

const SEMILLA_CONFIG = [
  ['CUOTA_POR_DEPENDENCIA', 2, 'Propuestas mínimas esperadas por dependencia', 'Número'],
  ['META_DIAGNOSTICO', 25, 'Cuestionarios de diagnóstico previstos en Jalisco', 'Número'],
  ['FECHA_LIMITE_VETTING', new Date(2026, 6, 29), 'Fecha límite de envío de propuestas de vetting', 'Fecha'],
  ['DIAS_CRITICOS', 3, 'Días restantes para considerar la alerta como crítica', 'Número'],
  ['DIAS_ATENCION', 10, 'Días restantes para considerar la alerta como de atención', 'Número']
];

const SEMILLA_METADATOS = [
  ['Titulo_Proyecto', 'RASTROS'],
  ['Subtitulo', 'Panel ejecutivo del Enlace Coordinador · Coordinación General Estratégica de Seguridad'],
  ['Fase_Actual', 'Convocatoria de vetting y diagnóstico inicial'],
  ['Periodo', 'Julio – Agosto 2026'],
  ['Paises', 'México (Jalisco) · Guatemala · Perú'],
  ['Donante', 'Departamento de Estado de EE. UU.'],
  ['Institucion_Ejecutora', 'UNODC'],
  ['Institucion_Contraparte', 'Gobierno del Estado de Jalisco']
];

/** Abreviaturas para las tarjetas y el reporte impreso. */
const ABREVIATURAS_SEMILLA = {
  'Coordinación General Estratégica de Seguridad (CGES)': 'CGES',
  'Secretaría de Seguridad del Estado de Jalisco': 'Secretaría de Seguridad',
  'Fiscalía del Estado de Jalisco': 'Fiscalía del Estado',
  'Fiscalía Especializada en Trata de Personas': 'Fiscalía Especializada',
  'Ministerio Público': 'Ministerio Público',
  'Policía Cibernética': 'Policía Cibernética',
  'Perito o personal experto técnico': 'Peritos',
  'Comisión Ejecutiva Estatal de Atención a Víctimas': 'CEEAV',
  'Comisión de Búsqueda de Personas': 'Comisión de Búsqueda',
  'Otra': 'Otra'
};

/**
 * PESTAÑA 2 — Respuestas_Formulario_Diagnostico
 * 67 preguntas del cuestionario "Formulario RASTROS_final_Jalisco",
 * agrupadas en las 8 secciones del instrumento.
 */
const DIAGNOSTICO = {
  nombre: 'Respuestas_Formulario_Diagnostico',
  metadatos: ['Marca_temporal', 'ID_Respuesta', 'Estatus_Validacion'],
  secciones: [
    {
      clave: 'I',
      titulo: 'Sección I. Información general (Perfil)',
      preguntas: [
        'P01. Correo electrónico institucional',
        'P02. Sexo',
        'P03. Edad',
        'P04. Perfil principal (Jefatura o supervisión / Operativo)',
        'P05. Institución a la que pertenece',
        'P06. Su rol se relaciona con',
        'P07. Rol en Seguridad Pública o Fiscalía',
        'P08. Unidad a la que pertenece',
        'P09. Antigüedad en el cargo',
        'P10. Años de experiencia en casos de estafas en línea',
        'P11. Años de experiencia en casos de trata de personas',
        'P12. Nivel de participación en los últimos 24 meses'
      ]
    },
    {
      clave: 'II',
      titulo: 'Sección II. Detección e identificación de estafas en línea',
      preguntas: [
        'P13. Ha sido involucrado en carpeta de investigación por estafas en línea',
        'P14. Descripción de en qué consistió la estafa',
        'P15. Perfil de las víctimas de estafas en línea',
        'P16. Qué se prometió principalmente a las víctimas',
        'P17. Perfil de las personas victimarias',
        'P18. Nacionalidad de quienes ejecutan las estafas',
        'P19. Señales o indicadores que activan la sospecha de trata',
        'P20. Identificación de call centers, bunkers o inmuebles dedicados al fraude',
        'P21. Identificación del uso de inteligencia artificial',
        'P22. Casos que involucren criptomonedas o billeteras digitales'
      ]
    },
    {
      clave: 'III',
      titulo: 'Sección III. Vinculación con trata de personas (TIP), explotación y otros',
      preguntas: [
        'P23. Casos en que se OBLIGUE a realizar trabajo o actividad en línea',
        'P24. Casos en que se ENGAÑE para realizar trabajo o actividad en línea',
        'P25. Actividades más frecuentes exigidas a la víctima',
        'P26. Tipificación del delito conforme al CNPP',
        'P27. Casos de trata de personas para cometer estafas en línea',
        'P28. Modus operandi identificado',
        'P29. Perfil de las víctimas de trata',
        'P30. Forma de captación de las víctimas',
        'P31. Traslado o facilitación de movilidad',
        'P32. Quién costeó el traslado o alojamiento inicial',
        'P33. Señales de estafa cometida contra la voluntad de la persona'
      ]
    },
    {
      clave: 'IV',
      titulo: 'Sección IV. Marco Legal',
      preguntas: [
        'P34. Medida en que el marco legal facilita o dificulta la investigación',
        'P35. Claridad sobre los mecanismos de coordinación institucional',
        'P36. Nivel de participación de laboratorios forenses digitales o peritos',
        'P37. Conocimiento de unidad de enlace o fuerza de tarea conjunta TIP–Ciber',
        'P38. Necesidad de reformas legales',
        'P39. Áreas de reforma legal consideradas necesarias'
      ]
    },
    {
      clave: 'V',
      titulo: 'Sección V. Recolección de pruebas e investigación (Evidencia digital)',
      preguntas: [
        'P40. Medios de prueba determinantes',
        'P41. Dificultades durante allanamientos',
        'P42. Aplicaciones de mensajería que obstaculizan la interceptación',
        'P43. Procedimiento para preservar comunicaciones en mensajería cifrada',
        'P44. Explicación del procedimiento e institución que lo generó',
        'P45. Vinculación de "facilitadores profesionales"',
        'P46. Barreras técnicas o logísticas para obtener pruebas',
        'P47. Propuestas para mejorar la cadena de custodia digital'
      ]
    },
    {
      clave: 'VI',
      titulo: 'Sección VI. Protección y reparación de víctimas y sobrevivientes',
      preguntas: [
        'P48. Aplicación de protocolos de atención integral',
        'P49. Frecuencia de uso de medidas de protección',
        'P50. Frecuencia de uso de prueba anticipada',
        'P51. Víctimas obligadas o engañadas como beneficiarias de protección',
        'P52. Dificultad para garantizar la no criminalización',
        'P53. Artículo, ley o vacío legal que constituye el principal obstáculo',
        'P54. Trato inicial que recibe quien ejecuta la estafa en línea',
        'P55. Barreras para aplicar tempranamente la no criminalización',
        'P56. Obstáculos para la reparación y restitución de derechos'
      ]
    },
    {
      clave: 'VII',
      titulo: 'Sección VII. Capacitación y recursos',
      preguntas: [
        'P57. Ha recibido capacitación sobre investigación de estafas en línea',
        'P58. Ha recibido capacitación sobre investigación de trata de personas',
        'P59. Temas de capacitación considerados prioritarios',
        'P60. Recursos necesarios para mejorar la respuesta institucional'
      ]
    },
    {
      clave: 'VIII',
      titulo: 'Sección VIII. Cooperación interinstitucional y enfoque regional',
      preguntas: [
        'P61. Evaluación de los mecanismos de cooperación internacional',
        'P62. Mecanismos de cooperación que utilizaría',
        'P63. Actores con los que resulta más urgente coordinar',
        'P64. Principal obstáculo al solicitar información a proveedores extranjeros',
        'P65. Información o mecanismos requeridos del sector privado',
        'P66. Otras barreras institucionales, normativas o de coordinación',
        'P67. Conocimiento de alguna sentencia de trata vinculada a estafas en línea'
      ]
    }
  ]
};

/* ────────────────────── CATÁLOGOS DE VALIDACIÓN ────────────────────────── */

const LISTAS = {
  Tipo_Rol: ['Tomador de decisiones', 'Operativo'],
  Estatus_Vetting: ['Pendiente', 'Enviado Embajada', 'Aprobado'],
  Tipo_Evento: ['Mesa de Trabajo', 'Capacitación'],
  Estatus_Catering: ['No requerido', 'Solicitado a UNODC', 'Confirmado', 'Cubierto'],
  Estatus_Validacion: ['Recibida', 'En revisión', 'Validada', 'Descartada'],
  Responsable: [
    'UNODC', 'CGES', 'Secretaría de Seguridad', 'Fiscalía del Estado',
    'Fiscalía Especializada', 'Policía Cibernética', 'Embajada de EE. UU.', 'Otra'
  ],
  Estatus_Pendiente: ['Pendiente', 'En Gestión', 'Resuelto'],
  Nivel_Alerta: ['Crítica', 'Atención', 'OK'],
  Estatus_Hito: ['Futuro', 'En Curso', 'Completado'],
  Tipo_Parametro: ['Número', 'Texto', 'Fecha', 'Booleano'],
  Dependencia: [
    'Coordinación General Estratégica de Seguridad (CGES)',
    'Secretaría de Seguridad del Estado de Jalisco',
    'Fiscalía del Estado de Jalisco',
    'Fiscalía Especializada en Trata de Personas',
    'Ministerio Público',
    'Policía Cibernética',
    'Perito o personal experto técnico',
    'Comisión Ejecutiva Estatal de Atención a Víctimas',
    'Comisión de Búsqueda de Personas',
    'Otra'
  ]
};

/* ────────────────────── METAS DEL PROYECTO (PESTAÑA 4) ─────────────────── */

const METAS = [
  ['M1', 'Meta 1: Programas Diseñados',
   'Programas de formación diseñados e implementados (1 por país: México/Jalisco, Guatemala, Perú)',
   3, 1, 'Documentos de programa validados por UNODC'],
  ['M2', 'Meta 2: Funcionarios Capacitados',
   'Funcionarios de fuerzas del orden y fiscalías capacitados en trata vinculada a estafas en línea',
   75, 25, 'Listas de asistencia — pestaña Mesas_de_Trabajo_y_Capacitaciones'],
  ['M3', 'Meta 3: Investigaciones TIP / OSO',
   'Casos de trata de personas vinculados a operaciones de estafa en línea investigados (5 por país)',
   15, 5, 'Reporte de la Fiscalía Especializada / carpetas de investigación'],
  ['M4', 'Meta 4: Redes de Formadores y Materiales',
   'Redes ToT constituidas (3) y materiales de formación desarrollados (15)',
   3, 1, 'Actas de constitución de red ToT y repositorio de materiales']
];

/* ══════════════════════ FUNCIÓN PRINCIPAL ═════════════════════════════════ */

function setupMasterDB() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(CFG.ZONA_HORARIA);
  if (ss.getName().indexOf('RASTROS') === -1) ss.rename(CFG.NOMBRE_LIBRO);

  construirVetting_(ss);
  construirDiagnostico_(ss);
  construirMesas_(ss);
  construirKPIs_(ss);

  if (CFG.CREAR_HOJAS_AUXILIARES) {
    construirListas_(ss);
    construirMapeoEmbajada_(ss);
  }

  // Capa dinámica: pendientes, ruta crítica, configuración y metadatos.
  crearPestanasDinamicasSilencioso_(ss);

  ordenarPestanas_(ss);
  eliminarHojaVacia_(ss);
  ss.setActiveSheet(ss.getSheetByName(HOJAS.KPIS.nombre));

  SpreadsheetApp.getUi().alert(
    'RASTROS — Base master lista',
    'Se estructuraron las pestañas:\n\n' +
    '1. ' + HOJAS.VETTING.nombre + '\n' +
    '2. ' + DIAGNOSTICO.nombre + ' (67 preguntas / 8 secciones)\n' +
    '3. ' + HOJAS.MESAS.nombre + '\n' +
    '4. ' + HOJAS.KPIS.nombre +
    (CFG.CREAR_HOJAS_AUXILIARES ? '\n\nAuxiliares: Listas_Catalogos, Mapeo_Formato_VETTING_Oficial' : '') +
    '\n\nFecha límite de vetting precargada: 29/07/2026.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/* ════════════════════ PESTAÑA 1 · VETTING ════════════════════════════════ */

function construirVetting_(ss) {
  const H = HOJAS.VETTING;
  const sh = obtenerHoja_(ss, H.nombre);
  const n = CFG.FILAS_PRECARGADAS;

  // Encabezados declarados de forma explícita y en el orden exigido por el
  // requerimiento. No depender del catálogo evita que un cambio en HOJAS
  // altere el orden de las columnas que consume la Embajada.
  const ENCABEZADOS_VETTING = [
    'ID_Beneficiario',
    'Nombre',
    'Cargo',
    'Dependencia',
    'Tipo_Rol',
    'Correo',
    'Estatus_Vetting',
    'Fecha_Limite_Envio',
    'Observaciones'
  ];

  escribirEncabezado_(sh, ENCABEZADOS_VETTING, H.anchos);

  // Etiquetas ampliadas en la nota del encabezado (fidelidad al formato oficial)
  sh.getRange(1, 5).setNote('Tipo_Rol: Tomador de decisiones / Operativo');
  sh.getRange(1, 7).setNote('Estatus_Vetting: Pendiente / Enviado Embajada / Aprobado');
  sh.getRange(1, 8).setNote('Fecha límite de envío de propuestas de vetting: 29 de julio de 2026.');

  // ID automático
  sh.getRange(2, 1, n, 1).setFormulaR1C1(
    '=IF(LEN(RC[1])=0,"","RAS-VET-"&TEXT(ROW()-1,"000"))'
  );

  // Validaciones
  validar_(sh, 5, n, LISTAS.Tipo_Rol);
  validar_(sh, 7, n, LISTAS.Estatus_Vetting);
  validar_(sh, 4, n, LISTAS.Dependencia, true);

  // Fecha límite fija: 29/07/2026
  const fechas = [];
  for (let i = 0; i < n; i++) fechas.push([CFG.FECHA_LIMITE_VETTING]);
  sh.getRange(2, 8, n, 1)
    .setValues(fechas)
    .setNumberFormat('dd/mm/yyyy')
    .setHorizontalAlignment('center');

  // Semáforo de estatus
  const rgEstatus = sh.getRange(2, 7, n, 1);
  sh.setConditionalFormatRules([
    reglaTexto_(rgEstatus, 'Aprobado', CFG.COLORES.verdeOk, '#FFFFFF'),
    reglaTexto_(rgEstatus, 'Enviado Embajada', CFG.COLORES.alertaAmbar, '#3D2B00'),
    reglaTexto_(rgEstatus, 'Pendiente', CFG.COLORES.alertaRoja, '#FFFFFF')
  ]);

  sh.getRange(2, 6, n, 1).setFontColor(CFG.COLORES.azulUNODC); // correo
  cerrarHoja_(sh, ENCABEZADOS_VETTING.length, n);
}

/* ════════════════ PESTAÑA 2 · DIAGNÓSTICO (67 PREGUNTAS) ═════════════════ */

function construirDiagnostico_(ss) {
  const sh = obtenerHoja_(ss, DIAGNOSTICO.nombre);
  sh.clear();
  sh.clearConditionalFormatRules();
  // Idempotencia: separar combinaciones previas antes de volver a fusionar
  try {
    sh.getRange(1, 1, 2, sh.getMaxColumns()).breakApart();
  } catch (e) {
    Logger.log('Sin combinaciones previas que separar: ' + e.message);
  }

  // Fila 1: banda de sección · Fila 2: encabezado de pregunta
  const filaSeccion = [];
  const filaPregunta = [];

  DIAGNOSTICO.metadatos.forEach(function (m) {
    filaSeccion.push('CONTROL');
    filaPregunta.push(m);
  });

  const bloques = [];   // para pintar y fusionar las bandas de sección
  let col = DIAGNOSTICO.metadatos.length + 1;

  DIAGNOSTICO.secciones.forEach(function (sec) {
    bloques.push({ inicio: col, ancho: sec.preguntas.length, titulo: sec.titulo });
    sec.preguntas.forEach(function (p) {
      filaSeccion.push(sec.titulo);
      filaPregunta.push(p);
    });
    col += sec.preguntas.length;
  });

  const total = filaPregunta.length;   // 3 metadatos + 67 preguntas = 70
  sh.getRange(1, 1, 1, total).setValues([filaSeccion]);
  sh.getRange(2, 1, 1, total).setValues([filaPregunta]);

  // Banda de control
  sh.getRange(1, 1, 1, DIAGNOSTICO.metadatos.length)
    .merge()
    .setValue('CONTROL DE REGISTRO')
    .setBackground('#5A6B7B').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');

  // Bandas de sección, alternando el azul institucional
  bloques.forEach(function (b, i) {
    sh.getRange(1, b.inicio, 1, b.ancho)
      .merge()
      .setValue(b.titulo)
      .setBackground(i % 2 === 0 ? CFG.COLORES.azulMarino : CFG.COLORES.azulUNODC)
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  });

  sh.getRange(2, 1, 1, total)
    .setBackground(CFG.COLORES.grisClaro)
    .setFontColor(CFG.COLORES.azulMarino)
    .setFontWeight('bold')
    .setWrap(true)
    .setVerticalAlignment('middle');

  sh.setRowHeight(1, 34).setRowHeight(2, 76);
  sh.setFrozenRows(2);
  sh.setFrozenColumns(2);
  for (let c = 1; c <= total; c++) sh.setColumnWidth(c, c <= 3 ? 150 : 260);

  const n = CFG.FILAS_PRECARGADAS;
  sh.getRange(3, 1, n, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  sh.getRange(3, 2, n, 1).setFormulaR1C1(
    '=IF(LEN(RC[-1])=0,"","RAS-DIA-"&TEXT(ROW()-2,"000"))'
  );
  validar_(sh, 3, n, LISTAS.Estatus_Validacion, false, 3);

  if (sh.getMaxColumns() > total) {
    sh.deleteColumns(total + 1, sh.getMaxColumns() - total);
  }
}

/* ═══════════ PESTAÑA 3 · MESAS DE TRABAJO Y CAPACITACIONES ═══════════════ */

function construirMesas_(ss) {
  const H = HOJAS.MESAS;
  const sh = obtenerHoja_(ss, H.nombre);
  const n = 60;

  escribirEncabezado_(sh, H.encabezados, H.anchos);

  sh.getRange(2, 1, n, 1).setFormulaR1C1(
    '=IF(LEN(RC[1])=0,"","RAS-EVT-"&TEXT(ROW()-1,"00"))'
  );
  validar_(sh, 2, n, LISTAS.Tipo_Evento);
  validar_(sh, 5, n, LISTAS.Estatus_Catering);

  sh.getRange(2, 3, n, 1).setNumberFormat('dd/mm/yyyy').setHorizontalAlignment('center');
  sh.getRange(2, 6, n, 1).setNumberFormat('0').setHorizontalAlignment('center');
  sh.getRange(2, 7, n, 1).setWrap(true);

  sh.getRange(1, 4).setNote(
    'Sede externa financiada por UNODC. Acuerdo del 22/07/2026: UNODC cubre ' +
    'alquiler de sede, alimentos, catering y coffee break.'
  );

  // Hitos precargados conforme a la minuta del 22 de julio de 2026
  sh.getRange(2, 2, 2, 7).setValues([
    ['Mesa de Trabajo', new Date(2026, 7, 26), 'Por definir — sede externa UNODC',
     'Solicitado a UNODC', '', 'Presentación del proyecto a personal clave con nivel de mando o comunicación con operativos.', ''],
    ['Mesa de Trabajo', new Date(2026, 7, 27), 'Por definir — sede externa UNODC',
     'Solicitado a UNODC', '', 'Planeación de actividades y explicación del formulario de diagnóstico.', '']
  ]);
  sh.getRange(2, 3, 2, 1).setNumberFormat('dd/mm/yyyy');

  cerrarHoja_(sh, H.encabezados.length, n);
}

/* ═══════════════ PESTAÑA 4 · CONTROL DE METAS Y KPIs ═════════════════════ */

function construirKPIs_(ss) {
  const H = HOJAS.KPIS;
  const sh = obtenerHoja_(ss, H.nombre);
  escribirEncabezado_(sh, H.encabezados, H.anchos);

  const vet = "'" + HOJAS.VETTING.nombre + "'";
  const mes = "'" + HOJAS.MESAS.nombre + "'";
  const dia = "'" + DIAGNOSTICO.nombre + "'";

  const filas = METAS.map(function (m) {
    return [m[0], m[1], m[2], m[3], m[4], '', '', '', m[5]];
  });
  sh.getRange(2, 1, filas.length, 9).setValues(filas);

  // Real — Meta 2 se alimenta de las capacitaciones registradas
  sh.getRange('F3').setFormula(
    '=SUMIF(' + mes + '!B2:B,"Capacitación",' + mes + '!F2:F)'
  );
  sh.getRange('F2').setValue(0);
  sh.getRange('F4').setValue(0);
  sh.getRange('F5').setValue(0);

  sh.getRange('G2:G5').setFormula('=IF(D2=0,0,F2/D2)').setNumberFormat('0%');
  sh.getRange('H2:H5').setFormula(
    '=IF(G2>=1,"CUMPLIDA",IF(G2>=0.5,"EN AVANCE",IF(G2>0,"INICIADA","SIN AVANCE")))'
  );

  // Indicadores operativos derivados
  const base = filas.length + 3;
  sh.getRange(base, 1).setValue('INDICADORES OPERATIVOS — FASE ACTUAL')
    .setFontWeight('bold').setFontColor(CFG.COLORES.azulMarino).setFontSize(12);

  const ops = [
    ['Beneficiarios registrados para vetting', '=COUNTA(' + vet + '!B2:B)'],
    ['Vetting pendiente', '=COUNTIF(' + vet + '!G2:G,"Pendiente")'],
    ['Vetting enviado a la Embajada', '=COUNTIF(' + vet + '!G2:G,"Enviado Embajada")'],
    ['Vetting aprobado', '=COUNTIF(' + vet + '!G2:G,"Aprobado")'],
    ['Tomadores de decisiones convocados', '=COUNTIF(' + vet + '!E2:E,"Tomador de decisiones")'],
    ['Dependencias participantes', '=COUNTA(UNIQUE(FILTER(' + vet + '!D2:D,' + vet + '!D2:D<>"")))'],
    ['Cuestionarios de diagnóstico recibidos', '=COUNTA(' + dia + '!B3:B)'],
    ['Cuestionarios validados', '=COUNTIF(' + dia + '!C3:C,"Validada")'],
    ['Días restantes para la fecha límite de vetting', '=DATE(2026,7,29)-TODAY()'],
    ['Mesas de trabajo y capacitaciones programadas', '=COUNTA(' + mes + '!A2:A)']
  ];
  ops.forEach(function (o, i) {
    const r = base + 1 + i;
    sh.getRange(r, 1, 1, 2).merge().setValue(o[0]);
    sh.getRange(r, 3).setFormula(o[1]).setFontWeight('bold')
      .setFontColor(CFG.COLORES.azulMarino).setHorizontalAlignment('left');
  });
  sh.getRange(base + 1, 1, ops.length, 3).setBackground(CFG.COLORES.grisClaro);

  const rgSem = sh.getRange('H2:H5');
  sh.setConditionalFormatRules([
    reglaTexto_(rgSem, 'CUMPLIDA', CFG.COLORES.verdeOk, '#FFFFFF'),
    reglaTexto_(rgSem, 'EN AVANCE', CFG.COLORES.alertaAmbar, '#3D2B00'),
    reglaTexto_(rgSem, 'INICIADA', '#BBDDEE', CFG.COLORES.azulMarino),
    reglaTexto_(rgSem, 'SIN AVANCE', CFG.COLORES.alertaRoja, '#FFFFFF')
  ]);

  sh.getRange('D2:F5').setHorizontalAlignment('center');
  sh.getRange('C2:C5').setWrap(true);
  sh.setFrozenRows(1);
}

/* ═════════════════════ HOJAS AUXILIARES (OPCIONALES) ═════════════════════ */

function construirListas_(ss) {
  const sh = obtenerHoja_(ss, 'Listas_Catalogos');
  sh.clear();
  const claves = Object.keys(LISTAS);
  claves.forEach(function (k, i) {
    sh.getRange(1, i + 1).setValue(k)
      .setBackground(CFG.COLORES.azulMarino).setFontColor('#FFFFFF').setFontWeight('bold');
    const vals = LISTAS[k].map(function (v) { return [v]; });
    sh.getRange(2, i + 1, vals.length, 1).setValues(vals);
    sh.setColumnWidth(i + 1, 300);
  });
  sh.setFrozenRows(1);
  sh.hideSheet();
}

/**
 * Espejo de las columnas del archivo oficial "Formato VETTING 2026.xlsx"
 * (pestaña Participants). Sirve para exportar hacia el formato que recibe la
 * Embajada sin volver a capturar la información.
 */
function construirMapeoEmbajada_(ss) {
  const sh = obtenerHoja_(ss, 'Mapeo_Formato_VETTING_Oficial');
  const enc = [
    'Participante o Alterno', 'Nombre(s)', 'Apellidos', 'CURP', 'Sexo',
    'Fecha de Nacimiento (mm/dd/aaaa)', 'Nacimiento — Ciudad o Municipio',
    'Nacimiento — Estado', 'Nacimiento — País', 'Último Nivel de Estudios',
    'Conocimiento del Idioma Inglés', 'Correo Electrónico', 'Teléfono',
    'Residencia — Ciudad o Municipio', 'Residencia — Estado', 'Residencia — País',
    'Dependencia / Organización', 'Puesto / Ocupación', 'Rango (si aplica)',
    '¿Jefe de Unidad? (Sí/No)', 'CUIP', '¿Control de Confianza Aprobado? (Sí/No)',
    'Fecha de Certificación de Control de Confianza', 'Años de Experiencia en Puesto Actual',
    'Nombre de Contacto de la Dependencia', 'Correo de Contacto de la Dependencia',
    'ID Unidad', 'Ciudad de Partida', 'Unidad en Organigrama (nivel 1)',
    'Unidad en Organigrama (nivel 2)', 'Autorización del Gobierno de México'
  ];
  escribirEncabezado_(sh, enc, enc.map(function () { return 200; }));
  sh.getRange(1, 1, 1, enc.length).setNote(
    'Estructura espejo del archivo oficial Formato VETTING 2026.xlsx (pestaña Participants). ' +
    'Capturar aquí solo para exportación a la Embajada; el control interno vive en Vetting_Beneficiarios.'
  );
  cerrarHoja_(sh, enc.length, CFG.FILAS_PRECARGADAS);
}

/* ═════════════════════════ UTILIDADES ════════════════════════════════════ */

function obtenerHoja_(ss, nombre) {
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  sh.clearConditionalFormatRules();
  return sh;
}

function escribirEncabezado_(sh, encabezados, anchos) {
  sh.clear();
  sh.getRange(1, 1, 1, encabezados.length)
    .setValues([encabezados])
    .setBackground(CFG.COLORES.azulMarino)
    .setFontColor(CFG.COLORES.textoClaro)
    .setFontWeight('bold')
    .setFontSize(11)
    .setWrap(true)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center');
  sh.setRowHeight(1, 46);
  sh.setFrozenRows(1);
  anchos.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  if (sh.getMaxColumns() > encabezados.length) {
    sh.deleteColumns(encabezados.length + 1, sh.getMaxColumns() - encabezados.length);
  }
}

/**
 * Aplica el formato de cuerpo de una hoja de forma IDEMPOTENTE.
 * sh.clear() no elimina bandas ni protecciones, así que una segunda ejecución
 * de setupMasterDB() lanzaría "You can't add a banding that overlaps with
 * another banding" y duplicaría las protecciones. Ambas se limpian antes.
 */
function cerrarHoja_(sh, cols, filas) {
  sh.getRange(2, 1, filas, cols)
    .setVerticalAlignment('top')
    .setFontSize(10);

  // 1. Retirar bandas previas de la hoja
  try {
    sh.getBandings().forEach(function (b) { b.remove(); });
  } catch (e) {
    Logger.log('No se pudieron limpiar bandas en "' + sh.getName() + '": ' + e.message);
  }

  // 2. Aplicar la banda nueva sin abortar el script si algo falla
  try {
    sh.getRange(2, 1, filas, cols).applyRowBanding(
      SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false
    );
  } catch (e) {
    Logger.log('Banding omitido en "' + sh.getName() + '": ' + e.message);
  }

  // 3. Retirar protecciones previas y volver a proteger el encabezado
  try {
    sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
      if (p.getDescription() === 'Encabezados RASTROS') p.remove();
    });
    sh.getRange(1, 1, 1, cols).protect()
      .setDescription('Encabezados RASTROS')
      .setWarningOnly(true);
  } catch (e) {
    Logger.log('Protección omitida en "' + sh.getName() + '": ' + e.message);
  }
}

function validar_(sh, col, filas, lista, permitirOtro, filaInicio) {
  const inicio = filaInicio || 2;
  const regla = SpreadsheetApp.newDataValidation()
    .requireValueInList(lista, true)
    .setAllowInvalid(!!permitirOtro)
    .setHelpText('Valores permitidos: ' + lista.join(' · '))
    .build();
  sh.getRange(inicio, col, filas, 1).setDataValidation(regla);
}

function reglaTexto_(rango, texto, fondo, color) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(texto)
    .setBackground(fondo)
    .setFontColor(color)
    .setRanges([rango])
    .build();
}

function ordenarPestanas_(ss) {
  const orden = [
    HOJAS.KPIS.nombre,
    HOJAS.VETTING.nombre,
    DIAGNOSTICO.nombre,
    HOJAS.MESAS.nombre
  ];
  orden.forEach(function (n, i) {
    const sh = ss.getSheetByName(n);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  });
}

function eliminarHojaVacia_(ss) {
  ['Hoja 1', 'Hoja1', 'Sheet1'].forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
}

/* ═════════════════════ OPERACIÓN COTIDIANA ═══════════════════════════════ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('▸ RASTROS')
    .addItem('Estructurar base master (primera vez)', 'setupMasterDB')
    .addItem('Crear pestañas dinámicas', 'crearPestanasDinamicas')
    .addSeparator()
    .addItem('Respaldar libro', 'respaldarLibro')
    .addItem('Reporte de estatus de vetting', 'reporteVetting')
    .addSeparator()
    .addItem('Ver URL del tablero web', 'urlDelTablero')
    .addToUi();
}

function respaldarLibro() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sello = Utilities.formatDate(new Date(), CFG.ZONA_HORARIA, 'yyyy-MM-dd_HHmm');
  const copia = DriveApp.getFileById(ss.getId())
    .makeCopy('RESPALDO_' + ss.getName() + '_' + sello);
  SpreadsheetApp.getUi().alert('Respaldo creado', copia.getUrl(),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function reporteVetting() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJAS.VETTING.nombre);
  const datos = sh.getRange(2, 2, Math.max(sh.getLastRow() - 1, 1), 6).getValues()
    .filter(function (r) { return r[0] !== ''; });

  const conteo = { 'Pendiente': 0, 'Enviado Embajada': 0, 'Aprobado': 0 };
  datos.forEach(function (r) { if (conteo[r[5]] !== undefined) conteo[r[5]]++; });

  const dias = Math.ceil(
    (CFG.FECHA_LIMITE_VETTING - new Date()) / (1000 * 60 * 60 * 24)
  );

  SpreadsheetApp.getUi().alert(
    'Estatus de vetting — RASTROS',
    'Beneficiarios registrados: ' + datos.length + '\n\n' +
    'Pendiente: ' + conteo['Pendiente'] + '\n' +
    'Enviado Embajada: ' + conteo['Enviado Embajada'] + '\n' +
    'Aprobado: ' + conteo['Aprobado'] + '\n\n' +
    'Fecha límite: 29/07/2026 (' + dias + ' días).',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * APLICACIÓN WEB — TABLERO DE CONTROL
 * ─────────────────────────────────────────────────────────────────────────
 * Sirve el archivo Panel.html y le entrega los datos de la base master sin
 * publicar la hoja en internet. El acceso se resuelve con la cuenta
 * institucional de cada persona, no con un enlace público.
 *
 * IMPLEMENTACIÓN (una sola vez):
 *   Implementar ▸ Nueva implementación ▸ Tipo: Aplicación web
 *     · Ejecutar como:        Usuario que accede
 *     · Quién tiene acceso:   Usuarios de jalisco.gob.mx
 *   Copiar la URL /exec resultante y compartirla con quien deba consultarla.
 * ═══════════════════════════════════════════════════════════════════════ */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Panel')
    .setTitle('RASTROS · Tablero de control')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Abre el libro por ID y, si no es posible, cae al contenedor activo. */
function abrirLibro_() {
  try {
    return SpreadsheetApp.openById(CFG.ID_LIBRO);
  } catch (e) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
    throw new Error('No fue posible abrir la base master: ' + e.message);
  }
}

/**
 * Única función que consume el tablero. Devuelve un objeto plano:
 * { ok, usuario, actualizado, beneficiarios[], eventos[], metas[], diagnostico{} }
 */
function obtenerDatosTablero() {
  try {
    limpiarCacheDinamica_();
    const ss = abrirLibro_();

    // Capa dinámica: todo lo configurable se lee de la hoja antes de calcular.
    const cfg = leerConfiguracion();
    const metadatos = leerMetadatos();
    const pendientes = leerPendientesUNODC();
    const rutaCritica = leerRutaCritica();
    const catalogos = leerCatalogos();
    const abreviaturas = leerAbreviaturas();

    /* -- Vetting ------------------------------------------------------- */
    const beneficiarios = [];
    const shV = ss.getSheetByName(HOJAS.VETTING.nombre);
    if (shV && shV.getLastRow() > 1) {
      shV.getRange(2, 1, shV.getLastRow() - 1, 9).getValues().forEach(function (f, i) {
        if (!String(f[1]).trim()) return;
        beneficiarios.push({
          id: String(f[0] || 'RAS-VET-' + ('00' + (i + 1)).slice(-3)),
          nombre: String(f[1]).trim(),
          cargo: String(f[2] || '').trim(),
          dependencia: String(f[3] || '').trim(),
          rol: String(f[4] || '').trim(),
          correo: String(f[5] || '').trim(),
          estatus: LISTAS.Estatus_Vetting.indexOf(String(f[6]).trim()) !== -1
            ? String(f[6]).trim() : 'Pendiente'
        });
      });
    }

    /* -- Mesas y capacitaciones ---------------------------------------- */
    const eventos = [];
    let capacitados = 0;
    const shM = ss.getSheetByName(HOJAS.MESAS.nombre);
    if (shM && shM.getLastRow() > 1) {
      shM.getRange(2, 1, shM.getLastRow() - 1, 8).getValues().forEach(function (f) {
        if (!String(f[1]).trim()) return;
        const asistentes = Number(f[5]) || 0;
        if (String(f[1]).trim() === 'Capacitación') capacitados += asistentes;
        eventos.push({
          id: String(f[0] || ''),
          tipo: String(f[1]).trim(),
          fecha: f[2] instanceof Date
            ? Utilities.formatDate(f[2], CFG.ZONA_HORARIA, 'dd/MM/yyyy')
            : String(f[2] || ''),
          sede: String(f[3] || ''),
          catering: String(f[4] || ''),
          asistentes: asistentes,
          acuerdos: String(f[6] || ''),
          minuta: String(f[7] || '')
        });
      });
    }

    /* -- Diagnóstico ---------------------------------------------------- */
    let recibidas = 0, validadas = 0;
    const shD = ss.getSheetByName(DIAGNOSTICO.nombre);
    if (shD && shD.getLastRow() > 2) {
      shD.getRange(3, 2, shD.getLastRow() - 2, 2).getValues().forEach(function (f) {
        if (!String(f[0]).trim()) return;
        recibidas++;
        if (String(f[1]).trim() === 'Validada') validadas++;
      });
    }

    /* -- Metas ---------------------------------------------------------- */
    const definiciones = leerDefinicionMetas_(ss);
    const reales = leerRealesDeKPIs_(ss);
    const metas = definiciones.map(function (d, i) {
      const real = (i === 1 && reales[1] === null) ? capacitados : reales[i];
      return {
        id: d.id,
        nombre: d.nombre,
        descripcion: d.descripcion,
        objetivo: d.objetivo,
        objetivoJalisco: d.objetivoJalisco,
        fuente: d.fuente,
        real: Number(real) || 0
      };
    });

    const diagPorDep = diagnosticoPorDependencia_(shD);
    const agrupado = agruparPorDependencia_(beneficiarios);
    const diagnostico = {
      recibidas: recibidas,
      validadas: validadas,
      meta: cfg.META_DIAGNOSTICO,
      porDependencia: diagPorDep
    };

    return {
      ok: true,
      usuario: Session.getActiveUser().getEmail() || '',
      actualizado: Utilities.formatDate(new Date(), CFG.ZONA_HORARIA, "dd/MM/yyyy HH:mm"),

      // Datos operativos
      beneficiarios: beneficiarios,
      eventos: eventos,
      metas: metas,
      diagnostico: diagnostico,
      porDependencia: agrupado,

      // Capa dinámica
      metadatos: metadatos,
      configuracion: {
        cuotaPorDependencia: cfg.CUOTA_POR_DEPENDENCIA,
        metaDiagnostico: cfg.META_DIAGNOSTICO,
        fechaLimite: Utilities.formatDate(cfg.FECHA_LIMITE_VETTING, CFG.ZONA_HORARIA, 'dd/MM/yyyy'),
        fechaLimiteISO: Utilities.formatDate(cfg.FECHA_LIMITE_VETTING, CFG.ZONA_HORARIA, 'yyyy-MM-dd'),
        diasCriticos: cfg.DIAS_CRITICOS,
        diasAtencion: cfg.DIAS_ATENCION
      },
      pendientesUnodc: pendientes,
      rutaCritica: rutaCritica,
      catalogos: catalogos,
      abreviaturas: abreviaturas,

      diasRestantes: diasParaLimite_(cfg),
      alertas: construirAlertas_(beneficiarios, agrupado, diagnostico, eventos,
                                 pendientes, cfg, abreviaturas)
    };

  } catch (e) {
    return { ok: false, mensaje: e.message };
  }
}

/** Lee la columna Real de Control_Metas_y_KPIs; devuelve null donde no haya valor. */
function leerRealesDeKPIs_(ss) {
  const sh = ss.getSheetByName(HOJAS.KPIS.nombre);
  if (!sh || sh.getLastRow() < 5) return [null, null, null, null];
  return sh.getRange(2, 6, 4, 1).getValues().map(function (f) {
    return (f[0] === '' || f[0] === null) ? null : Number(f[0]);
  });
}

/** Devuelve la URL de la aplicación web ya implementada. */
function urlDelTablero() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(
    'Tablero RASTROS',
    url ? url : 'Aún no hay una implementación activa. Use Implementar ▸ Nueva implementación.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * ESCRITURA — ALTA DE PROPUESTAS  [DISPONIBLE, SIN USO ACTUALMENTE]
 * ─────────────────────────────────────────────────────────────────────────
 * El rediseño de julio de 2026 retiró el formulario de alta del tablero: la
 * captura se hace directamente en la base master. La función se conserva
 * probada y lista por si se decide reactivar la captura desde el panel;
 * basta con volver a llamarla con google.script.run desde Panel.html.
 *
 * Si se reactiva: escribe la fila en
 * Vetting_Beneficiarios. Requisitos de la implementación:
 *   · "Ejecutar como: Usuario que accede"  → cada quien escribe con su
 *     propia cuenta y necesita permiso de edición sobre el libro. Queda
 *     rastro de quién capturó en el historial de versiones de Google.
 *   · "Ejecutar como: Yo"                  → cualquiera con acceso al
 *     tablero puede dar de alta aunque no tenga permiso sobre la hoja.
 *     Cómodo, pero el historial atribuye todo al propietario.
 * ═══════════════════════════════════════════════════════════════════════ */

const RE_CORREO_SRV = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Localiza la primera fila sin nombre capturado en Vetting_Beneficiarios.
 * No se usa appendRow(): la columna H trae la fecha límite precargada en 200
 * filas, así que getLastRow() devuelve 201 y el alta caería fuera del rango
 * con fórmulas y validaciones.
 */
function primeraFilaLibre_(sh) {
  const tope = Math.max(sh.getLastRow(), CFG.FILAS_PRECARGADAS + 1);
  const nombres = sh.getRange(2, 2, tope - 1, 1).getValues();
  for (let i = 0; i < nombres.length; i++) {
    if (String(nombres[i][0]).trim() === '') return i + 2;
  }
  return tope + 1;
}

/**
 * Da de alta una propuesta de vetting.
 * @param {Object} d {nombre, cargo, dependencia, rol, correo}
 * @return {Object} {ok, mensaje, id, fila, datos}
 */
function agregarBeneficiario(d) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { ok: false, mensaje: 'Otra alta se está guardando en este momento. Inténtelo de nuevo.' };
  }

  try {
    d = d || {};
    const nombre = String(d.nombre || '').trim();
    const cargo = String(d.cargo || '').trim();
    const dependencia = String(d.dependencia || '').trim();
    const rol = String(d.rol || '').trim();
    const correo = String(d.correo || '').trim();

    // Validación en el servidor: el navegador ya validó, pero no se le confía.
    if (!nombre) return { ok: false, mensaje: 'Falta el nombre de la persona propuesta.' };
    if (!cargo) return { ok: false, mensaje: 'Falta el cargo de la persona propuesta.' };
    if (!RE_CORREO_SRV.test(correo)) return { ok: false, mensaje: 'El correo no tiene un formato válido.' };
    if (LISTAS.Tipo_Rol.indexOf(rol) === -1) {
      return { ok: false, mensaje: 'Tipo de rol no reconocido: ' + rol };
    }
    if (LISTAS.Dependencia.indexOf(dependencia) === -1) {
      return { ok: false, mensaje: 'Dependencia no reconocida: ' + dependencia };
    }

    const ss = abrirLibro_();
    const sh = ss.getSheetByName(HOJAS.VETTING.nombre);
    if (!sh) {
      return { ok: false, mensaje: 'No se encontró la pestaña ' + HOJAS.VETTING.nombre + ' en la base master.' };
    }

    // Duplicados por correo
    if (sh.getLastRow() > 1) {
      const correos = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < correos.length; i++) {
        if (String(correos[i][0]).trim().toLowerCase() === correo.toLowerCase()) {
          return { ok: false, mensaje: 'Ese correo ya está registrado en la fila ' + (i + 2) + '.' };
        }
      }
    }

    const fila = primeraFilaLibre_(sh);
    sh.getRange(fila, 2, 1, 5).setValues([[nombre, cargo, dependencia, rol, correo]]);
    sh.getRange(fila, 7).setValue('Pendiente');

    // Si el alta cayó fuera del rango precargado, replicar fórmula y fecha.
    if (!sh.getRange(fila, 1).getFormula()) {
      sh.getRange(fila, 1).setFormula(
        '=IF(LEN(B' + fila + ')=0,"","RAS-VET-"&TEXT(ROW()-1,"000"))');
    }
    if (sh.getRange(fila, 8).getValue() === '') {
      sh.getRange(fila, 8).setValue(CFG.FECHA_LIMITE_VETTING)
        .setNumberFormat('dd/mm/yyyy').setHorizontalAlignment('center');
    }

    SpreadsheetApp.flush();

    return {
      ok: true,
      fila: fila,
      id: sh.getRange(fila, 1).getDisplayValue(),
      mensaje: 'Propuesta guardada en la base master, fila ' + fila + '.',
      datos: obtenerDatosTablero()
    };

  } catch (e) {
    return { ok: false, mensaje: 'No se pudo escribir en la base master: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

/* ═════════════════════════════════════════════════════════════════════════
 * AGREGADOS PARA EL PANEL EJECUTIVO
 * Se calculan aquí y no en el navegador, para que el tablero, el reporte
 * imprimible y cualquier consumidor futuro vean exactamente las mismas
 * cifras. El frontend replica esta lógica solo como respaldo cuando no hay
 * backend disponible.
 * ═══════════════════════════════════════════════════════════════════════ */

function diasParaLimite_(cfg) {
  const limite = (cfg && cfg.FECHA_LIMITE_VETTING) || CFG.FECHA_LIMITE_VETTING;
  const hoy = new Date();
  const cero = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((limite - cero) / 86400000);
}

/** Acumula el vetting por dependencia, incluyendo las que aún no reportan. */
function agruparPorDependencia_(beneficiarios) {
  const mapa = {};
  const orden = [];

  function asegurar(dep) {
    if (!mapa[dep]) {
      mapa[dep] = { dependencia: dep, total: 0, pendiente: 0, enviado: 0, aprobado: 0, sinCorreo: 0 };
      orden.push(dep);
    }
    return mapa[dep];
  }

  // Las dependencias del catálogo aparecen aunque tengan cero propuestas:
  // una entidad sin registros es justamente la que hay que perseguir.
  const catalogo = (leerCatalogos().Dependencia || LISTAS.Dependencia);
  catalogo.forEach(function (d) { if (d !== 'Otra') asegurar(d); });

  beneficiarios.forEach(function (b) {
    const g = asegurar(b.dependencia || 'Sin dependencia');
    g.total++;
    if (b.estatus === 'Aprobado') g.aprobado++;
    else if (b.estatus === 'Enviado Embajada') g.enviado++;
    else g.pendiente++;
    if (!b.correo) g.sinCorreo++;
  });

  return orden.map(function (d) { return mapa[d]; });
}

/** Cuenta cuestionarios por institución, leyendo la columna P05 del diagnóstico. */
function diagnosticoPorDependencia_(shD) {
  if (!shD || shD.getLastRow() < 3) return [];
  const filas = shD.getLastRow() - 2;
  const ids = shD.getRange(3, 2, filas, 2).getValues();      // ID_Respuesta, Estatus_Validacion
  const inst = shD.getRange(3, 8, filas, 1).getValues();     // P05. Institución a la que pertenece

  const mapa = {}, orden = [];
  for (let i = 0; i < filas; i++) {
    if (!String(ids[i][0]).trim()) continue;
    const dep = String(inst[i][0]).trim() || 'Sin institución declarada';
    if (!mapa[dep]) { mapa[dep] = { dependencia: dep, recibidas: 0, validadas: 0 }; orden.push(dep); }
    mapa[dep].recibidas++;
    if (String(ids[i][1]).trim() === 'Validada') mapa[dep].validadas++;
  }
  return orden.map(function (d) { return mapa[d]; });
}

/** Construye las tarjetas de cuellos de botella del Módulo 1. */
function construirAlertas_(beneficiarios, agrupado, diagnostico, eventos, pendientes, cfg, abrev) {
  cfg = cfg || leerConfiguracion();
  abrev = abrev || {};
  const corto = function (d) { return abrev[d] || d; };
  const cuota = cfg.CUOTA_POR_DEPENDENCIA;
  const dias = diasParaLimite_(cfg);
  const total = beneficiarios.length;
  const pend = beneficiarios.filter(function (b) { return b.estatus === 'Pendiente'; }).length;
  const sinCorreo = beneficiarios.filter(function (b) { return !b.correo; }).length;
  const bajoCuota = agrupado.filter(function (g) { return g.total < cuota; });
  const porValidar = Math.max(diagnostico.recibidas - diagnostico.validadas, 0);
  const a = [];

  a.push({
    nivel: dias <= cfg.DIAS_CRITICOS ? 'critica' : (dias <= cfg.DIAS_ATENCION ? 'atencion' : 'ok'),
    titulo: 'Cierre de vetting',
    cifra: dias > 0 ? dias + (dias === 1 ? ' día' : ' días') : (dias === 0 ? 'Hoy' : 'Vencido'),
    detalle: pend + ' de ' + total + ' propuestas siguen en estatus Pendiente. Límite: ' +
      Utilities.formatDate(cfg.FECHA_LIMITE_VETTING, CFG.ZONA_HORARIA, 'dd/MM/yyyy') + '.'
  });

  a.push({
    nivel: bajoCuota.length ? 'critica' : 'ok',
    titulo: 'Dependencias por debajo de cuota',
    cifra: bajoCuota.length + ' de ' + agrupado.length,
    detalle: bajoCuota.length
      ? 'Faltan propuestas en: ' + bajoCuota.map(function (g) {
          return corto(g.dependencia) + ' (' + g.total + '/' + cuota + ')';
        }).join(' · ')
      : 'Todas las dependencias alcanzan la cuota de ' + cuota + ' propuestas.'
  });

  a.push({
    nivel: sinCorreo ? 'critica' : 'ok',
    titulo: 'Registros sin correo',
    cifra: sinCorreo,
    detalle: sinCorreo
      ? 'El formato de la Embajada exige correo electrónico. Estos registros no pueden enviarse todavía.'
      : 'Todos los registros tienen correo capturado.'
  });

  // Se arma con lo que diga la pestaña Pendientes_UNODC, no con texto fijo.
  pendientes = pendientes || [];
  const criticos = pendientes.filter(function (p) { return p.nivel === 'critica'; });
  a.push({
    nivel: criticos.length ? 'critica' : (pendientes.length ? 'atencion' : 'ok'),
    titulo: 'Pendientes con UNODC',
    cifra: criticos.length || pendientes.length,
    detalle: criticos.length
      ? criticos.map(function (p) {
          return p.titulo + (p.responsable ? ' (' + p.responsable + ')' : '') + ': ' +
                 p.descripcion.split('.')[0] + '.';
        }).join(' ')
      : (pendientes.length
          ? pendientes.length + ' pendientes abiertos, ninguno crítico.'
          : 'Sin pendientes abiertos.')
  });

  a.push({
    nivel: diagnostico.recibidas === 0 ? 'atencion' : (porValidar > 0 ? 'atencion' : 'ok'),
    titulo: 'Diagnóstico',
    cifra: diagnostico.recibidas + ' / ' + diagnostico.meta,
    detalle: diagnostico.recibidas === 0
      ? 'Aún no se recibe ningún cuestionario. El instrumento se difunde tras la revisión de los tomadores de decisiones.'
      : porValidar + ' cuestionarios pendientes de validar.'
  });

  a.push({
    nivel: eventos.length ? 'ok' : 'atencion',
    titulo: 'Mesas y capacitaciones',
    cifra: eventos.length,
    detalle: eventos.length
      ? 'Eventos programados en la base master.'
      : 'No hay eventos capturados. Registre las mesas de la semana del 24 de agosto.'
  });

  return a;
}

/* ═════════════════════════════════════════════════════════════════════════
 * CAPA DINÁMICA — TODO LO CONFIGURABLE VIVE EN LA HOJA, NO EN EL CÓDIGO
 * ─────────────────────────────────────────────────────────────────────────
 * Cuatro pestañas nuevas sustituyen a las constantes que antes estaban
 * escritas aquí dentro: pendientes con UNODC, ruta crítica, parámetros de
 * alerta y metadatos del proyecto. El coordinador cambia una celda y el
 * panel lo refleja al recargar.
 *
 * INSTALACIÓN EN UNA BASE YA ESTRUCTURADA:
 *   Ejecute crearPestanasDinamicas() una sola vez, o use el menú
 *   ▸ RASTROS ▸ Crear pestañas dinámicas. Es aditivo: no toca ni una celda
 *   de las pestañas existentes.
 * ═══════════════════════════════════════════════════════════════════════ */

/** Caché por ejecución: evita releer las mismas pestañas varias veces. */
var _CACHE_DIN = {};

function limpiarCacheDinamica_() { _CACHE_DIN = {}; }

/** Lee un bloque de datos acotado al contenido real de la hoja. */
function leerBloque_(nombreHoja, columnas, filaInicio) {
  const ini = filaInicio || 2;
  try {
    const sh = abrirLibro_().getSheetByName(nombreHoja);
    if (!sh) { Logger.log('Pestaña ausente: ' + nombreHoja); return []; }
    const ultima = sh.getLastRow();
    if (ultima < ini) return [];
    return sh.getRange(ini, 1, ultima - ini + 1, columnas).getValues();
  } catch (e) {
    Logger.log('Error al leer ' + nombreHoja + ': ' + e.message);
    return [];
  }
}

/* ───────────────────────── CONFIGURACIÓN ──────────────────────────────── */

/**
 * Parámetros operativos del panel.
 * @return {Object} {CUOTA_POR_DEPENDENCIA, META_DIAGNOSTICO, FECHA_LIMITE_VETTING,
 *                   DIAS_CRITICOS, DIAS_ATENCION}
 * Si la pestaña falta o un valor es inválido, cae al valor de respaldo del código.
 */
function leerConfiguracion() {
  if (_CACHE_DIN.config) return _CACHE_DIN.config;

  const cfg = {
    CUOTA_POR_DEPENDENCIA: CFG.CUOTA_POR_DEPENDENCIA,
    META_DIAGNOSTICO: CFG.META_CUESTIONARIOS,
    FECHA_LIMITE_VETTING: CFG.FECHA_LIMITE_VETTING,
    DIAS_CRITICOS: 3,
    DIAS_ATENCION: 10
  };

  leerBloque_(HOJAS_DIN.CONFIG.nombre, 4).forEach(function (f) {
    const clave = String(f[0]).trim();
    if (!clave || !(clave in cfg)) return;
    const tipo = String(f[3]).trim();
    const bruto = f[1];

    if (tipo === 'Número') {
      const n = Number(bruto);
      if (!isNaN(n) && bruto !== '') cfg[clave] = n;
      else Logger.log('Parámetro ' + clave + ': valor no numérico, se conserva el respaldo.');
    } else if (tipo === 'Fecha') {
      if (bruto instanceof Date && !isNaN(bruto.getTime())) cfg[clave] = bruto;
      else Logger.log('Parámetro ' + clave + ': fecha inválida, se conserva el respaldo.');
    } else if (tipo === 'Booleano') {
      cfg[clave] = (bruto === true || String(bruto).toLowerCase() === 'sí' ||
                    String(bruto).toLowerCase() === 'si' || String(bruto).toLowerCase() === 'true');
    } else {
      if (String(bruto).trim() !== '') cfg[clave] = String(bruto).trim();
    }
  });

  _CACHE_DIN.config = cfg;
  return cfg;
}

/* ───────────────────────── METADATOS ──────────────────────────────────── */

/**
 * Textos del encabezado y contexto del proyecto.
 * @return {Object} pares Campo → Valor, con respaldo desde SEMILLA_METADATOS.
 */
function leerMetadatos() {
  if (_CACHE_DIN.metadatos) return _CACHE_DIN.metadatos;

  const m = {};
  SEMILLA_METADATOS.forEach(function (f) { m[f[0]] = f[1]; });

  leerBloque_(HOJAS_DIN.METADATOS.nombre, 2).forEach(function (f) {
    const campo = String(f[0]).trim();
    const valor = String(f[1]).trim();
    if (campo && valor) m[campo] = valor;
  });

  _CACHE_DIN.metadatos = m;
  return m;
}

/* ───────────────────────── PENDIENTES CON UNODC ───────────────────────── */

/**
 * Pendientes activos. Filtra los resueltos: el panel muestra lo que estorba hoy.
 * @return {Array<Object>} {id, titulo, descripcion, responsable, estatus,
 *                          nivel, vencimiento, diasVencimiento}
 */
function leerPendientesUNODC() {
  if (_CACHE_DIN.pendientes) return _CACHE_DIN.pendientes;

  const nivel = { 'Crítica': 'critica', 'Atención': 'atencion', 'OK': 'ok' };
  const hoy = new Date();
  const cero = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const filas = leerBloque_(HOJAS_DIN.PENDIENTES.nombre, 7);
  const lista = [];

  filas.forEach(function (f) {
    const titulo = String(f[1]).trim();
    if (!titulo) return;
    const estatus = String(f[4]).trim() || 'Pendiente';
    if (estatus === 'Resuelto') return;          // resuelto = fuera del radar

    const venc = (f[6] instanceof Date && !isNaN(f[6].getTime())) ? f[6] : null;
    lista.push({
      id: String(f[0]).trim(),
      titulo: titulo,
      descripcion: String(f[2]).trim(),
      responsable: String(f[3]).trim(),
      estatus: estatus,
      nivel: nivel[String(f[5]).trim()] || 'atencion',
      vencimiento: venc ? Utilities.formatDate(venc, CFG.ZONA_HORARIA, 'dd/MM/yyyy') : '',
      diasVencimiento: venc ? Math.round((venc - cero) / 86400000) : null
    });
  });

  // Si la pestaña no existe todavía, el panel no se queda mudo.
  const salida = lista.length ? lista : SEMILLA_PENDIENTES
    .filter(function (f) { return f[4] !== 'Resuelto'; })
    .map(function (f) {
      return {
        id: f[0], titulo: f[1], descripcion: f[2], responsable: f[3], estatus: f[4],
        nivel: nivel[f[5]] || 'atencion', vencimiento: '', diasVencimiento: null
      };
    });

  _CACHE_DIN.pendientes = salida;
  return salida;
}

/* ───────────────────────── RUTA CRÍTICA ───────────────────────────────── */

/**
 * Hitos del proyecto, en el orden en que aparecen en la hoja.
 * Se respeta ese orden a propósito: la columna Fecha admite rangos en texto
 * ("Semana del 24 de agosto"), que ninguna función de ordenamiento entiende.
 * Para reordenar, mueva las filas en la hoja.
 * @return {Array<Object>} {id, fecha, actividad, responsable, estatus, notas, tono}
 */
function leerRutaCritica() {
  if (_CACHE_DIN.ruta) return _CACHE_DIN.ruta;

  const tono = { 'En Curso': 'activo', 'Futuro': 'proximo', 'Completado': 'hecho' };
  const filas = leerBloque_(HOJAS_DIN.RUTA.nombre, 6);
  const lista = [];

  filas.forEach(function (f) {
    const act = String(f[2]).trim();
    if (!act) return;
    const est = String(f[4]).trim() || 'Futuro';
    lista.push({
      id: String(f[0]).trim(),
      fecha: (f[1] instanceof Date)
        ? Utilities.formatDate(f[1], CFG.ZONA_HORARIA, 'dd/MM/yyyy')
        : String(f[1]).trim(),
      actividad: act,
      responsable: String(f[3]).trim(),
      estatus: est,
      notas: String(f[5]).trim(),
      tono: tono[est] || 'proximo'
    });
  });

  const salida = lista.length ? lista : SEMILLA_RUTA.map(function (f) {
    return {
      id: f[0], fecha: f[1], actividad: f[2], responsable: f[3],
      estatus: f[4], notas: f[5], tono: tono[f[4]] || 'proximo'
    };
  });

  _CACHE_DIN.ruta = salida;
  return salida;
}

/* ───────────────────────── CATÁLOGOS Y ABREVIATURAS ───────────────────── */

/**
 * Los seis catálogos de Listas_Catalogos, leídos por encabezado y no por
 * posición, para que agregar una columna no rompa nada.
 * @return {Object} nombre del catálogo → array de valores
 */
function leerCatalogos() {
  if (_CACHE_DIN.catalogos) return _CACHE_DIN.catalogos;

  const cat = {};
  Object.keys(LISTAS).forEach(function (k) { cat[k] = LISTAS[k].slice(); });

  try {
    const sh = abrirLibro_().getSheetByName('Listas_Catalogos');
    if (sh && sh.getLastRow() > 1) {
      const datos = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
      const enc = datos[0].map(function (h) { return String(h).trim(); });
      enc.forEach(function (nombre, c) {
        if (!nombre || nombre === 'Dependencia_Abrev') return;
        const vals = [];
        for (let r = 1; r < datos.length; r++) {
          const v = String(datos[r][c]).trim();
          if (v && v.indexOf('Catálogos que alimentan') !== 0) vals.push(v);
        }
        if (vals.length) cat[nombre] = vals;
      });
    }
  } catch (e) {
    Logger.log('Error al leer catálogos: ' + e.message);
  }

  _CACHE_DIN.catalogos = cat;
  return cat;
}

/**
 * Abreviaturas de dependencia, tomadas de la columna Dependencia_Abrev de
 * Listas_Catalogos, emparejada fila a fila con la columna Dependencia.
 * @return {Object} nombre completo → abreviatura
 */
function leerAbreviaturas() {
  if (_CACHE_DIN.abreviaturas) return _CACHE_DIN.abreviaturas;

  const abrev = {};
  Object.keys(ABREVIATURAS_SEMILLA).forEach(function (k) { abrev[k] = ABREVIATURAS_SEMILLA[k]; });

  try {
    const sh = abrirLibro_().getSheetByName('Listas_Catalogos');
    if (sh && sh.getLastRow() > 1) {
      const datos = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
      const enc = datos[0].map(function (h) { return String(h).trim(); });
      const cDep = enc.indexOf('Dependencia');
      const cAbr = enc.indexOf('Dependencia_Abrev');
      if (cDep !== -1 && cAbr !== -1) {
        for (let r = 1; r < datos.length; r++) {
          const d = String(datos[r][cDep]).trim();
          const a = String(datos[r][cAbr]).trim();
          if (d && a) abrev[d] = a;
        }
      }
    }
  } catch (e) {
    Logger.log('Error al leer abreviaturas: ' + e.message);
  }

  _CACHE_DIN.abreviaturas = abrev;
  return abrev;
}

/* ───────────────────────── DEFINICIÓN DE METAS ────────────────────────── */

/**
 * Nombre, descripción, objetivos y fuente de verificación de las 4 metas,
 * leídos de Control_Metas_y_KPIs. No se agregaron columnas nuevas: la hoja
 * ya tenía Descripción y Fuente_de_Verificación, solo no se estaban usando.
 * @return {Array<Object>} {id, nombre, descripcion, objetivo, objetivoJalisco, real, fuente}
 */
function leerDefinicionMetas_(ss) {
  const respaldo = METAS.map(function (m) {
    return { id: m[0], nombre: m[1], descripcion: m[2], objetivo: m[3],
             objetivoJalisco: m[4], real: 0, fuente: m[5] };
  });
  try {
    const sh = ss.getSheetByName(HOJAS.KPIS.nombre);
    if (!sh || sh.getLastRow() < 5) return respaldo;
    const d = sh.getRange(2, 1, 4, 9).getValues();
    return d.map(function (f, i) {
      return {
        id: String(f[0]).trim() || respaldo[i].id,
        nombre: String(f[1]).trim() || respaldo[i].nombre,
        descripcion: String(f[2]).trim() || respaldo[i].descripcion,
        objetivo: Number(f[3]) || respaldo[i].objetivo,
        objetivoJalisco: f[4] === '' ? respaldo[i].objetivoJalisco : f[4],
        real: Number(f[5]) || 0,
        fuente: String(f[8]).trim() || respaldo[i].fuente
      };
    });
  } catch (e) {
    Logger.log('Error al leer definición de metas: ' + e.message);
    return respaldo;
  }
}

/* ═════════════ CREACIÓN DE LAS PESTAÑAS DINÁMICAS ═══════════════════════ */

/**
 * Crea las cuatro pestañas nuevas y la columna de abreviaturas.
 * ADITIVO: si una pestaña ya existe con datos, no la toca.
 */
function crearPestanasDinamicas() {
  const ss = abrirLibro_();
  const creadas = [], respetadas = [];

  function construir(def, semilla, validaciones) {
    const existente = ss.getSheetByName(def.nombre);
    if (existente && existente.getLastRow() > 1) { respetadas.push(def.nombre); return; }
    const sh = existente || ss.insertSheet(def.nombre);
    escribirEncabezado_(sh, def.encabezados, def.anchos);
    if (semilla && semilla.length) {
      sh.getRange(2, 1, semilla.length, def.encabezados.length).setValues(semilla);
    }
    (validaciones || []).forEach(function (v) { validar_(sh, v[0], 60, v[1]); });
    sh.getRange(2, 1, 60, def.encabezados.length).setVerticalAlignment('top').setWrap(true);
    creadas.push(def.nombre);
  }

  construir(HOJAS_DIN.PENDIENTES, SEMILLA_PENDIENTES,
    [[4, LISTAS.Responsable], [5, LISTAS.Estatus_Pendiente], [6, LISTAS.Nivel_Alerta]]);
  construir(HOJAS_DIN.RUTA, SEMILLA_RUTA,
    [[4, LISTAS.Responsable], [5, LISTAS.Estatus_Hito]]);
  construir(HOJAS_DIN.CONFIG, SEMILLA_CONFIG, [[4, LISTAS.Tipo_Parametro]]);
  construir(HOJAS_DIN.METADATOS, SEMILLA_METADATOS, []);

  const fechaCfg = ss.getSheetByName(HOJAS_DIN.CONFIG.nombre);
  if (fechaCfg) fechaCfg.getRange('B4').setNumberFormat('dd/mm/yyyy');
  const pend = ss.getSheetByName(HOJAS_DIN.PENDIENTES.nombre);
  if (pend) pend.getRange(2, 7, 60, 1).setNumberFormat('dd/mm/yyyy');

  const abrev = agregarColumnaAbreviaturas_(ss);
  limpiarCacheDinamica_();

  SpreadsheetApp.getUi().alert(
    'Pestañas dinámicas',
    (creadas.length ? 'Creadas: ' + creadas.join(', ') + '\n\n' : '') +
    (respetadas.length ? 'Ya existían con datos, no se tocaron: ' + respetadas.join(', ') + '\n\n' : '') +
    (abrev ? 'Columna Dependencia_Abrev agregada a Listas_Catalogos.' :
             'La columna Dependencia_Abrev ya existía.'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** Misma construcción, sin diálogo: se invoca desde setupMasterDB(). */
function crearPestanasDinamicasSilencioso_(ss) {
  function construir(def, semilla, validaciones) {
    const existente = ss.getSheetByName(def.nombre);
    if (existente && existente.getLastRow() > 1) return;
    const sh = existente || ss.insertSheet(def.nombre);
    escribirEncabezado_(sh, def.encabezados, def.anchos);
    if (semilla && semilla.length) {
      sh.getRange(2, 1, semilla.length, def.encabezados.length).setValues(semilla);
    }
    (validaciones || []).forEach(function (v) { validar_(sh, v[0], 60, v[1]); });
    sh.getRange(2, 1, 60, def.encabezados.length).setVerticalAlignment('top').setWrap(true);
  }
  construir(HOJAS_DIN.PENDIENTES, SEMILLA_PENDIENTES,
    [[4, LISTAS.Responsable], [5, LISTAS.Estatus_Pendiente], [6, LISTAS.Nivel_Alerta]]);
  construir(HOJAS_DIN.RUTA, SEMILLA_RUTA,
    [[4, LISTAS.Responsable], [5, LISTAS.Estatus_Hito]]);
  construir(HOJAS_DIN.CONFIG, SEMILLA_CONFIG, [[4, LISTAS.Tipo_Parametro]]);
  construir(HOJAS_DIN.METADATOS, SEMILLA_METADATOS, []);
  const c = ss.getSheetByName(HOJAS_DIN.CONFIG.nombre);
  if (c) c.getRange('B4').setNumberFormat('dd/mm/yyyy');
  agregarColumnaAbreviaturas_(ss);
  limpiarCacheDinamica_();
}

/** Agrega la columna Dependencia_Abrev a Listas_Catalogos si aún no está. */
function agregarColumnaAbreviaturas_(ss) {
  const sh = ss.getSheetByName('Listas_Catalogos');
  if (!sh) return false;
  const enc = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  if (enc.indexOf('Dependencia_Abrev') !== -1) return false;

  const cDep = enc.indexOf('Dependencia');
  if (cDep === -1) return false;

  const col = sh.getLastColumn() + 1;
  sh.getRange(1, col).setValue('Dependencia_Abrev')
    .setBackground(CFG.COLORES.azulMarino).setFontColor('#FFFFFF').setFontWeight('bold');
  sh.setColumnWidth(col, 220);

  const deps = sh.getRange(2, cDep + 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  const salida = deps.map(function (f) {
    const d = String(f[0]).trim();
    return [d ? (ABREVIATURAS_SEMILLA[d] || d) : ''];
  });
  if (salida.length) sh.getRange(2, col, salida.length, 1).setValues(salida);
  return true;
}
