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
    const ss = abrirLibro_();

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
    const reales = leerRealesDeKPIs_(ss);
    const metas = [
      { id: 'M1', real: reales[0] },
      { id: 'M2', real: reales[1] !== null ? reales[1] : capacitados },
      { id: 'M3', real: reales[2] },
      { id: 'M4', real: reales[3] }
    ].map(function (m) { return { id: m.id, real: Number(m.real) || 0 }; });

    return {
      ok: true,
      usuario: Session.getActiveUser().getEmail() || '',
      actualizado: Utilities.formatDate(new Date(), CFG.ZONA_HORARIA, "dd/MM/yyyy HH:mm"),
      beneficiarios: beneficiarios,
      eventos: eventos,
      metas: metas,
      diagnostico: { recibidas: recibidas, validadas: validadas, meta: CFG.META_CUESTIONARIOS }
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
