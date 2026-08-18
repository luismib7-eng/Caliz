/**
 * =============================================================
 *  Ingesta del XML oficial de precios de la CNE a Google Sheets
 *  Proyecto: Monitor de Precios de Combustibles
 * =============================================================
 *
 * Qué hace:
 *   1. Descarga el XML de precios desde el portal de la CNE.
 *   2. Lo convierte en filas (una por permiso, con Regular, Premium y Diésel).
 *   3. Las enriquece con la hoja "Catalogo" (permiso → razón social, dirección,
 *      municipio, estado, región).
 *   4. Las agrega a la hoja "Precios", que es la que publicas como CSV y lee el
 *      tablero. Cada corrida agrega un periodo nuevo sin borrar los anteriores:
 *      así se construye la serie histórica.
 *
 * Instalación:
 *   1. En tu hoja de cálculo: Extensiones → Apps Script.
 *   2. Pega este archivo, guarda y ejecuta "actualizarPrecios" una vez para
 *      autorizar el acceso.
 *   3. Ejecuta "instalarDisparadorDiario" una sola vez para programarlo.
 *
 * Nota: el XML pesa unos 2.5 MB y trae ~13,800 estaciones. Apps Script lo
 * procesa sin problema, pero la escritura se hace en un solo setValues para no
 * agotar la cuota de tiempo de ejecución.
 */

var CONFIG = {
  URL_XML: 'https://www.cne.gob.mx/media/precios/precios.xml', // Confirma la ruta vigente en el portal
  HOJA_PRECIOS: 'Precios',
  HOJA_CATALOGO: 'Catalogo',
  PRECIO_MIN: 15,    // El XML publica 0.01 o 1.00 cuando la estación no reportó precio
  PRECIO_MAX: 45,
  SIN_DATO: 'No especificado',   // Evita comas nulas consecutivas en el CSV publicado
  BLOQUE: 5000,                  // Filas por setValues, para no agotar el tiempo de ejecución
  ENCABEZADOS: ['Fecha', 'Region', 'Estado', 'Municipio', 'Estacion',
                'Permiso CRE', 'Direccion', 'Regular', 'Premium', 'Diesel']
};

/** Punto de entrada: descarga, convierte y agrega el periodo a la hoja. */
function actualizarPrecios() {
  var xml = UrlFetchApp.fetch(CONFIG.URL_XML, { muteHttpExceptions: true });
  if (xml.getResponseCode() !== 200) {
    throw new Error('El portal respondió ' + xml.getResponseCode() + '. Revisa CONFIG.URL_XML.');
  }

  var raiz = XmlService.parse(xml.getContentText()).getRootElement();
  var fecha = raiz.getAttribute('fecha_generacion') ? raiz.getAttribute('fecha_generacion').getValue() : '';
  if (!fecha) throw new Error('El XML no trae fecha_generacion.');

  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName(CONFIG.HOJA_PRECIOS) || libro.insertSheet(CONFIG.HOJA_PRECIOS);
  if (hoja.getLastRow() === 0) hoja.appendRow(CONFIG.ENCABEZADOS);

  if (periodoYaCargado_(hoja, fecha)) {
    Logger.log('El periodo ' + fecha + ' ya estaba cargado. No se agregó nada.');
    return;
  }

  var catalogo = leerCatalogo_(libro);
  var estaciones = raiz.getChildren('estacion');
  var vistos = {}, filas = [], descartados = 0, repetidos = 0;

  for (var i = 0; i < estaciones.length; i++) {
    var permiso = (estaciones[i].getAttribute('permiso') || { getValue: function () { return ''; } }).getValue();
    permiso = String(permiso || '').trim();
    if (!permiso) continue;

    var precios = { regular: '', premium: '', diesel: '' };
    var productos = estaciones[i].getChildren('producto');
    for (var j = 0; j < productos.length; j++) {
      var tipo = String((productos[j].getAttribute('tipo') || { getValue: function () { return ''; } }).getValue()).toLowerCase();
      if (!(tipo in precios)) continue;
      var valor = parseFloat((productos[j].getAttribute('precio') || { getValue: function () { return ''; } }).getValue());
      if (!isFinite(valor) || valor < CONFIG.PRECIO_MIN || valor > CONFIG.PRECIO_MAX) { descartados++; continue; }
      precios[tipo] = valor;
    }

    var clave = clavePermiso_(permiso);
    if (vistos[clave] !== undefined) {
      repetidos++;
      var previa = filas[vistos[clave]];
      if (previa[7] === '' && precios.regular !== '') previa[7] = precios.regular;
      if (previa[8] === '' && precios.premium !== '') previa[8] = precios.premium;
      if (previa[9] === '' && precios.diesel !== '') previa[9] = precios.diesel;
      continue;
    }

    var c = catalogo[permiso.replace(/\s+/g, '').toUpperCase()] || catalogo[clave] || {};
    vistos[clave] = filas.length;
    filas.push([fecha,
                c.region || CONFIG.SIN_DATO,
                c.estado || CONFIG.SIN_DATO,
                c.municipio || CONFIG.SIN_DATO,
                c.estacion || '',
                permiso, c.direccion || '', precios.regular, precios.premium, precios.diesel]);
  }

  if (!filas.length) throw new Error('El XML no produjo filas.');

  // Escritura por bloques: un solo setValues con ~13,800 filas es viable, pero
  // dividirlo mantiene el margen frente al límite de 6 minutos de ejecución.
  var fila = hoja.getLastRow() + 1;
  for (var b = 0; b < filas.length; b += CONFIG.BLOQUE) {
    var lote = filas.slice(b, b + CONFIG.BLOQUE);
    hoja.getRange(fila + b, 1, lote.length, CONFIG.ENCABEZADOS.length).setValues(lote);
    SpreadsheetApp.flush();
  }
  Logger.log('Periodo ' + fecha + ': ' + filas.length + ' estaciones agregadas · ' +
             repetidos + ' permisos repetidos fusionados · ' + descartados + ' precios fuera de rango.');
}

/**
 * Clave canónica del permiso: mayúsculas, sin espacios y sin el prefijo 'CNE/'
 * que la Comisión adoptó en 2025. Permite cruzar catálogos capturados con una
 * u otra convención y detectar permisos repetidos escritos distinto.
 */
function clavePermiso_(permiso) {
  var k = String(permiso || '').replace(/\s+/g, '').toUpperCase();
  return k.indexOf('CNE/') === 0 ? k.substring(4) : k;
}

/** Indexa la hoja "Catalogo" por permiso literal y por clave canónica. */
function leerCatalogo_(libro) {
  var hoja = libro.getSheetByName(CONFIG.HOJA_CATALOGO);
  var idx = {};
  if (!hoja || hoja.getLastRow() < 2) return idx;

  var datos = hoja.getDataRange().getValues();
  var enc = datos[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var col = function (nombres) {
    for (var i = 0; i < nombres.length; i++) {
      var k = enc.indexOf(nombres[i]);
      if (k > -1) return k;
    }
    return -1;
  };
  var cPermiso = col(['permiso cre', 'número', 'numero', 'permiso']);
  if (cPermiso < 0) return idx;
  var cEst = col(['estacion', 'estación', 'razón social', 'razon social']);
  var cDir = col(['direccion', 'dirección', 'domicilio']);
  var cMun = col(['municipio', 'ciudad']);
  var cEdo = col(['estado', 'entidad']);
  var cReg = col(['region', 'región']);

  for (var r = 1; r < datos.length; r++) {
    var permiso = String(datos[r][cPermiso] || '').replace(/\s+/g, '').toUpperCase();
    if (!permiso) continue;
    var registro = {
      estacion: cEst > -1 ? String(datos[r][cEst] || '').trim() : '',
      direccion: cDir > -1 ? String(datos[r][cDir] || '').trim() : '',
      municipio: cMun > -1 ? String(datos[r][cMun] || '').trim() : '',
      estado: cEdo > -1 ? String(datos[r][cEdo] || '').trim() : '',
      region: cReg > -1 ? String(datos[r][cReg] || '').trim() : ''
    };
    if (!idx[permiso]) idx[permiso] = registro;
    var canon = clavePermiso_(permiso);
    if (!idx[canon]) idx[canon] = registro;
  }
  return idx;
}

/** Evita cargar dos veces el mismo periodo revisando las últimas filas. */
function periodoYaCargado_(hoja, fecha) {
  var ultima = hoja.getLastRow();
  if (ultima < 2) return false;
  var desde = Math.max(2, ultima - 20000);
  var col = hoja.getRange(desde, 1, ultima - desde + 1, 1).getDisplayValues();
  for (var i = col.length - 1; i >= 0; i--) {
    if (String(col[i][0]).trim() === fecha) return true;
  }
  return false;
}

/** Programa la ingesta todos los días entre 6 y 7 de la mañana. */
function instalarDisparadorDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'actualizarPrecios') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('actualizarPrecios').timeBased().everyDays(1).atHour(6).create();
  Logger.log('Disparador diario instalado.');
}

/**
 * Mantenimiento: conserva solo los últimos N periodos para que la hoja no
 * crezca sin control (13,800 filas por día llegan pronto al límite de celdas
 * de Google Sheets). Ejecútalo a mano o con su propio disparador mensual.
 */
function conservarUltimosPeriodos(n) {
  n = n || 60;
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJA_PRECIOS);
  if (!hoja || hoja.getLastRow() < 2) return;

  var fechas = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getDisplayValues();
  var unicas = {};
  fechas.forEach(function (f) { unicas[String(f[0]).trim()] = true; });
  var orden = Object.keys(unicas).sort();
  if (orden.length <= n) return;

  var corte = orden[orden.length - n];
  var primeraValida = 0;
  for (var i = 0; i < fechas.length; i++) {
    if (String(fechas[i][0]).trim() >= corte) { primeraValida = i; break; }
  }
  if (primeraValida > 0) {
    hoja.deleteRows(2, primeraValida);
    Logger.log('Se eliminaron ' + primeraValida + ' filas anteriores a ' + corte + '.');
  }
}
