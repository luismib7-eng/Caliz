/* =============================================================
   Monitor de Precios de Combustibles
   Carga · normalización · KPIs · gráficos · explorador
   ============================================================= */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  /* La versión va en la llave: si el esquema de fila cambia, la copia guardada
     de una versión anterior se ignora sola en lugar de romper el render. */
  var CACHE_KEY = "combustibles:datos:v3";
  var THEME_KEY = "combustibles:tema";

  var PRODUCTS = {
    regular: { key: "regular", label: "Regular", css: "--regular" },
    premium: { key: "premium", label: "Premium", css: "--premium" },
    diesel:  { key: "diesel",  label: "Diésel",  css: "--diesel"  }
  };

  var quality = { duplicados: 0, fueraRango: 0, catalogo: 0 };

  var state = {
    rows: [],
    product: "regular",
    period: "",
    estado: "",
    municipio: "",
    onlyMine: false,
    search: "",
    sortKey: "regular",
    sortDir: "asc",
    page: 1,
    dimension: null,     // Región / Estado / Municipio / Marca / Razón social
    updatedAt: null,
    origin: ""
  };

  var charts = { trend: null, compare: null, hist: null, marcas: null };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------------------------------------
     1. Utilidades
     --------------------------------------------------------- */

  function slug(s) {
    return String(s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /* El pipeline escribe "No especificado" para no dejar comas vacías en el CSV.
     Para agrupar y filtrar equivale a un dato ausente. */
  var SIN_DATO = ["no especificado", "sin dato", "sin datos", "n/d", "nd", "na", "n/a",
                  "-", "—", "null", "undefined"];

  function texto(v) {
    var s = String(v === null || v === undefined ? "" : v).trim();
    return SIN_DATO.indexOf(s.toLowerCase()) > -1 ? "" : s;
  }

  /* Coordenada decimal válida, o null. */
  function coord(v, tope) {
    if (v === null || v === undefined || v === "") return null;
    var n = parseFloat(String(v).replace(",", "."));
    return isFinite(n) && n !== 0 && Math.abs(n) <= tope ? n : null;
  }

  function toNumber(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim();
    if (!s || /^(n\/?a|nd|s\/?d|-|—)$/i.test(s)) return null;
    var m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    var n = parseFloat(m[0]);
    if (!isFinite(n) || n <= 0) return null;
    var lo = CFG.PRICE_MIN === undefined ? 15 : CFG.PRICE_MIN;
    var hi = CFG.PRICE_MAX === undefined ? 45 : CFG.PRICE_MAX;
    // El XML oficial publica 0.01 o 1.00 cuando la estación no reportó precio.
    if (n < lo || n > hi) { quality.fueraRango++; return null; }
    return n;
  }

  function dieselType(v) {
    var s = String(v || "").toUpperCase();
    if (s.indexOf("DUBA") > -1 || s.indexOf("ULTRA BAJO") > -1) return "DUBA";
    if (s.indexOf("AUTOMOTRIZ") > -1) return "Automotriz";
    return "";
  }

  function money(n, decimals) {
    if (n === null || n === undefined || !isFinite(n)) return "—";
    return "$" + n.toFixed(decimals === undefined ? 2 : decimals);
  }

  function titleCase(s) {
    return String(s || "").toLowerCase().replace(/(^|[\s.\-\/])([a-záéíóúñ])/g, function (m, a, b) {
      return a + b.toUpperCase();
    });
  }

  function avg(list) {
    if (!list.length) return null;
    var t = 0, i;
    for (i = 0; i < list.length; i++) t += list[i];
    return t / list.length;
  }

  function quantile(sorted, q) {
    if (!sorted.length) return null;
    var pos = (sorted.length - 1) * q;
    var base = Math.floor(pos), rest = pos - base;
    if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    return sorted[base];
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function fmtDateTime(d) {
    if (!d) return "";
    try {
      return d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return d.toISOString().slice(0, 16).replace("T", " "); }
  }

  function fmtPeriod(v) {
    var m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return v || "Sin fecha";
    var meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return m[3] + " " + meses[parseInt(m[2], 10) - 1] + " " + m[1];
  }

  /* ---------------------------------------------------------
     2. Normalización de columnas
     --------------------------------------------------------- */

  var FIELD_ALIASES = {
    fecha:     ["fecha", "periodo", "fechaperiodo", "periodoreferencia", "fechaperiodoreferencia", "fechadereferencia"],
    region:    ["region", "regionpetrolifera", "zona"],
    estado:    ["estado", "entidad", "entidadfederativa"],
    municipio: ["municipio", "ciudad", "localidad", "delegacion", "alcaldia"],
    marca:     ["marca"],
    estacion:  ["estacion", "estacionrazonsocial", "razonsocial", "nombre", "nombrecomercial", "estaciondeservicio"],
    permiso:   ["permisocre", "numeropermisocre", "numeropermiso", "numero", "permiso", "numpermiso"],
    direccion: ["direccion", "domicilio", "ubicacion"],
    regular:   ["regular", "precioregular", "gasolinaregular", "preciogasolinaregular", "magna"],
    premium:   ["premium", "preciopremium", "gasolinapremium", "preciogasolinapremium"],
    diesel:    ["diesel", "preciodiesel", "dieselduba", "preciodieselduba", "duba"],
    tipodiesel:["tipodiesel", "tipodediesel"],
    lat:       ["lat", "latitud", "latitude"],
    lon:       ["lon", "lng", "longitud", "longitude"],
    margen:    ["margen", "margenestimado", "indicadordedispersion", "margendeganancia"]
  };

  function buildHeaderMap(fields) {
    var map = {}, used = {};
    Object.keys(FIELD_ALIASES).forEach(function (target) {
      for (var i = 0; i < fields.length; i++) {
        var h = fields[i];
        if (used[h]) continue;
        if (FIELD_ALIASES[target].indexOf(slug(h)) > -1) { map[target] = h; used[h] = true; return; }
      }
    });
    // Segunda pasada: coincidencia parcial (p. ej. "Precio Regular (MXN/L)")
    Object.keys(FIELD_ALIASES).forEach(function (target) {
      if (map[target]) return;
      for (var i = 0; i < fields.length; i++) {
        var h = fields[i], s = slug(h);
        if (used[h]) continue;
        for (var j = 0; j < FIELD_ALIASES[target].length; j++) {
          if (s.indexOf(FIELD_ALIASES[target][j]) > -1) { map[target] = h; used[h] = true; return; }
        }
      }
    });
    return map;
  }

  function normalize(raw, fields) {
    var map = buildHeaderMap(fields);
    var out = [];
    raw.forEach(function (r) {
      var get = function (k) { return map[k] ? texto(r[map[k]]) : ""; };
      var estacion = get("estacion");
      var permiso = get("permiso");
      if (!estacion && !permiso) return;

      var dieselRaw = get("diesel");
      out.push(indexRow({
        fecha: get("fecha"),
        region: titleCase(get("region")),
        estado: titleCase(get("estado")),
        municipio: titleCase(get("municipio")),
        marca: titleCase(get("marca")),
        estacion: estacion,
        permiso: permiso,
        direccion: get("direccion"),
        regular: toNumber(get("regular")),
        premium: toNumber(get("premium")),
        diesel: toNumber(dieselRaw),
        tipodiesel: get("tipodiesel") || dieselType(dieselRaw),
        lat: coord(get("lat"), 90),
        lon: coord(get("lon"), 180),
        margen: toNumber(get("margen"))
      }));
    });
    return dedupe(out);
  }


  /* ---------------------------------------------------------
     1 bis. Inferencia de ubicación a partir del domicilio

     El XML de la CNE no trae ubicación y el catálogo puede venir sin
     Estado/Municipio. Como último recurso se busca el nombre de un
     municipio o estado dentro de la dirección.

     Advertencia de diseño: en México los domicilios de carretera se
     nombran por su DESTINO, no por su ubicación ("Carretera Guadalajara -
     Nogales" puede estar a 200 km de Guadalajara). Por eso toda
     coincidencia precedida de carretera, camino, autopista, libramiento,
     entronque, salida o rumbo se descarta, y lo que sí se acepta queda
     marcado como inferido (≈) para no confundirlo con el dato de catálogo.

     Para ampliar la cobertura, agrega municipios a MUNICIPIOS: la clave es
     el nombre en minúsculas y sin acentos, el valor es su estado.
     --------------------------------------------------------- */

  var ESTADOS = ["aguascalientes", "baja california sur", "baja california", "campeche",
    "coahuila", "colima", "chiapas", "chihuahua", "ciudad de mexico", "cdmx", "durango",
    "guanajuato", "guerrero", "hidalgo", "jalisco", "estado de mexico", "michoacan",
    "morelos", "nayarit", "nuevo leon", "oaxaca", "puebla", "queretaro", "quintana roo",
    "san luis potosi", "sinaloa", "sonora", "tabasco", "tamaulipas", "tlaxcala",
    "veracruz", "yucatan", "zacatecas"];

  var ESTADO_NOMBRE = {
    "cdmx": "Ciudad de México", "ciudad de mexico": "Ciudad de México",
    "estado de mexico": "Estado de México", "michoacan": "Michoacán",
    "nuevo leon": "Nuevo León", "queretaro": "Querétaro", "san luis potosi": "San Luis Potosí",
    "yucatan": "Yucatán", "jalisco": "Jalisco", "guanajuato": "Guanajuato", "colima": "Colima",
    "nayarit": "Nayarit", "zacatecas": "Zacatecas", "aguascalientes": "Aguascalientes",
    "sinaloa": "Sinaloa", "sonora": "Sonora", "durango": "Durango", "chihuahua": "Chihuahua",
    "coahuila": "Coahuila", "tamaulipas": "Tamaulipas", "veracruz": "Veracruz",
    "puebla": "Puebla", "morelos": "Morelos", "hidalgo": "Hidalgo", "tlaxcala": "Tlaxcala",
    "guerrero": "Guerrero", "oaxaca": "Oaxaca", "chiapas": "Chiapas", "tabasco": "Tabasco",
    "campeche": "Campeche", "quintana roo": "Quintana Roo",
    "baja california": "Baja California", "baja california sur": "Baja California Sur"
  };

  var MUNICIPIOS = {
    /* Área Metropolitana de Guadalajara y resto de Jalisco */
    "guadalajara": "Jalisco", "zapopan": "Jalisco", "tlaquepaque": "Jalisco",
    "san pedro tlaquepaque": "Jalisco", "tonala": "Jalisco", "tlajomulco": "Jalisco",
    "tlajomulco de zuniga": "Jalisco", "el salto": "Jalisco", "juanacatlan": "Jalisco",
    "ixtlahuacan de los membrillos": "Jalisco", "zapotlanejo": "Jalisco",
    "puerto vallarta": "Jalisco", "lagos de moreno": "Jalisco", "tepatitlan": "Jalisco",
    "ocotlan": "Jalisco", "ciudad guzman": "Jalisco", "zapotlan el grande": "Jalisco",
    "ameca": "Jalisco", "autlan": "Jalisco", "arandas": "Jalisco", "la barca": "Jalisco",
    "chapala": "Jalisco", "jocotepec": "Jalisco", "tala": "Jalisco", "tequila": "Jalisco",
    "san juan de los lagos": "Jalisco", "mazamitla": "Jalisco", "sayula": "Jalisco",
    "cocula": "Jalisco", "villa corona": "Jalisco", "acatlan de juarez": "Jalisco",
    "etzatlan": "Jalisco", "magdalena": "Jalisco", "zacoalco": "Jalisco",
    "tamazula": "Jalisco", "tuxpan": "Jalisco", "atotonilco": "Jalisco",
    /* Estados vecinos y principales metrópolis del país */
    "morelia": "Michoacán", "uruapan": "Michoacán", "zamora": "Michoacán",
    "lazaro cardenas": "Michoacán", "cotija": "Michoacán", "tocumbo": "Michoacán",
    "sahuayo": "Michoacán", "jiquilpan": "Michoacán", "la piedad": "Michoacán",
    "leon": "Guanajuato", "irapuato": "Guanajuato", "celaya": "Guanajuato",
    "salamanca": "Guanajuato", "silao": "Guanajuato", "san miguel de allende": "Guanajuato",
    "manzanillo": "Colima", "tecoman": "Colima", "villa de alvarez": "Colima",
    "tepic": "Nayarit", "bahia de banderas": "Nayarit", "compostela": "Nayarit",
    "monterrey": "Nuevo León", "san nicolas de los garza": "Nuevo León",
    "guadalupe": "Nuevo León", "apodaca": "Nuevo León", "santa catarina": "Nuevo León",
    "saltillo": "Coahuila", "torreon": "Coahuila", "monclova": "Coahuila",
    "gomez palacio": "Durango", "culiacan": "Sinaloa", "mazatlan": "Sinaloa",
    "los mochis": "Sinaloa", "hermosillo": "Sonora", "ciudad obregon": "Sonora",
    "nogales": "Sonora", "tijuana": "Baja California", "mexicali": "Baja California",
    "ensenada": "Baja California", "la paz": "Baja California Sur",
    "los cabos": "Baja California Sur", "ciudad juarez": "Chihuahua",
    "delicias": "Chihuahua", "cuauhtemoc": "Chihuahua",
    "tampico": "Tamaulipas", "reynosa": "Tamaulipas", "matamoros": "Tamaulipas",
    "nuevo laredo": "Tamaulipas", "victoria": "Tamaulipas",
    "toluca": "Estado de México", "naucalpan": "Estado de México",
    "ecatepec": "Estado de México", "tlalnepantla": "Estado de México",
    "cuautitlan": "Estado de México", "ocoyoacac": "Estado de México",
    "iztapalapa": "Ciudad de México", "coyoacan": "Ciudad de México",
    "azcapotzalco": "Ciudad de México", "gustavo a madero": "Ciudad de México",
    "cuernavaca": "Morelos", "cuautla": "Morelos", "pachuca": "Hidalgo",
    "tulancingo": "Hidalgo", "puebla": "Puebla", "tehuacan": "Puebla",
    "cholula": "Puebla", "veracruz": "Veracruz", "xalapa": "Veracruz",
    "coatzacoalcos": "Veracruz", "cordoba": "Veracruz", "orizaba": "Veracruz",
    "poza rica": "Veracruz", "ursulo galvan": "Veracruz",
    "villahermosa": "Tabasco", "cardenas": "Tabasco", "acapulco": "Guerrero",
    "chilpancingo": "Guerrero", "zihuatanejo": "Guerrero", "oaxaca de juarez": "Oaxaca",
    "santa cruz xoxocotlan": "Oaxaca", "salina cruz": "Oaxaca",
    "tuxtla gutierrez": "Chiapas", "tapachula": "Chiapas", "san cristobal": "Chiapas",
    "merida": "Yucatán", "valladolid": "Yucatán", "cancun": "Quintana Roo",
    "playa del carmen": "Quintana Roo", "chetumal": "Quintana Roo",
    "carmen": "Campeche", "san luis potosi": "San Luis Potosí",
    "queretaro": "Querétaro", "san juan del rio": "Querétaro",
    "aguascalientes": "Aguascalientes", "zacatecas": "Zacatecas",
    "fresnillo": "Zacatecas", "durango": "Durango", "colima": "Colima",
    "guanajuato": "Guanajuato", "chihuahua": "Chihuahua", "tlaxcala": "Tlaxcala",
    "campeche": "Campeche"
  };

  /* Nombre para mostrar de los municipios con acento (la clave del
     diccionario va sin acentos para poder buscarla en el domicilio). */
  var MUNICIPIO_NOMBRE = {
    "tonala": "Tonalá", "tlajomulco": "Tlajomulco", "tlajomulco de zuniga": "Tlajomulco de Zúñiga",
    "juanacatlan": "Juanacatlán", "ixtlahuacan de los membrillos": "Ixtlahuacán de los Membrillos",
    "tepatitlan": "Tepatitlán", "ocotlan": "Ocotlán", "ciudad guzman": "Ciudad Guzmán",
    "zapotlan el grande": "Zapotlán el Grande", "autlan": "Autlán", "etzatlan": "Etzatlán",
    "acatlan de juarez": "Acatlán de Juárez", "atotonilco": "Atotonilco", "leon": "León",
    "lazaro cardenas": "Lázaro Cárdenas", "torreon": "Torreón", "monclova": "Monclova",
    "gomez palacio": "Gómez Palacio", "culiacan": "Culiacán", "mazatlan": "Mazatlán",
    "hermosillo": "Hermosillo", "ciudad obregon": "Ciudad Obregón", "ciudad juarez": "Ciudad Juárez",
    "cuauhtemoc": "Cuauhtémoc", "san nicolas de los garza": "San Nicolás de los Garza",
    "tuxtla gutierrez": "Tuxtla Gutiérrez", "merida": "Mérida", "cancun": "Cancún",
    "oaxaca de juarez": "Oaxaca de Juárez", "santa cruz xoxocotlan": "Santa Cruz Xoxocotlán",
    "coyoacan": "Coyoacán", "azcapotzalco": "Azcapotzalco", "cordoba": "Córdoba",
    "tehuacan": "Tehuacán", "queretaro": "Querétaro", "san juan del rio": "San Juan del Río",
    "san luis potosi": "San Luis Potosí", "ursulo galvan": "Úrsulo Galván",
    "tlalnepantla": "Tlalnepantla", "cuautitlan": "Cuautitlán", "colima": "Colima"
  };

  /* ---------------------------------------------------------
     Motor de inferencia: solo "ranuras de localidad"

     En México los nombres de ciudades se usan masivamente como nombres de
     calles y carreteras: "Avenida Lázaro Cárdenas" está en Guadalajara, no
     en Lázaro Cárdenas; "Carretera Guadalajara - Nogales" puede estar a
     200 km de ambas; "Prolongación Avenida Guadalupe" no está en Guadalupe,
     Nuevo León. Buscar el nombre en cualquier parte del domicilio produce
     puros falsos positivos.

     Por eso solo se acepta la coincidencia cuando aparece donde un domicilio
     mexicano sí codifica la localidad:
       a) en los dos últimos segmentos separados por coma
          "Av. Vallarta 1234, Col. Americana, Guadalajara, Jalisco"
       b) tras un marcador explícito
          "Municipio de Zapopan", "Mpio. Tala", "Ciudad de Colima"
     Cualquier otra aparición se ignora.
     --------------------------------------------------------- */

  var MARCADOR_LOCALIDAD = /(municipio|mpio\.?|ciudad|cd\.?|localidad|delegacion|alcaldia)\s+(de\s+)?$/;
  var PREFIJO_VIAL = /(carretera|carr\.?|camino|autopista|libramiento|periferico|entronque|desviacion|salida|rumbo|avenida|av\.?|calle|calz\.?|calzada|boulevard|blvd\.?|prolongacion|paseo|circuito|andador|privada|cerrada|lago|plaza|colonia|col\.?|fraccionamiento|fracc\.?|barrio|esquina)\s+(de\s+|a\s+|del\s+)?$/;

  function normText(v) {
    var s = String(v || "").toLowerCase();
    s = s.replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
         .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n");
    return s.replace(/\s+/g, " ").trim();
  }

  /* ¿La clave ocupa el segmento completo (o casi) de una ranura de localidad? */
  function esRanura(segmento, clave) {
    var seg = segmento.replace(/^[\s.,-]+|[\s.,;-]+$/g, "");
    if (seg === clave) return true;
    var m = seg.match(new RegExp("^(.*?)\\b" + clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b\\s*$"));
    if (!m) return false;
    return MARCADOR_LOCALIDAD.test(m[1]) && !PREFIJO_VIAL.test(m[1]);
  }

  function buscaEnRanuras(texto, clave) {
    var partes = texto.split(",");
    var candidatas = partes.length > 1 ? partes.slice(-2) : [];
    for (var i = 0; i < partes.length; i++) {
      if (MARCADOR_LOCALIDAD.test(partes[i].slice(0, partes[i].toLowerCase().indexOf(clave)) || "")) {
        candidatas.push(partes[i]);
      }
    }
    for (var j = 0; j < candidatas.length; j++) {
      if (esRanura(candidatas[j], clave)) return true;
    }
    return false;
  }

  /* Devuelve { municipio, estado } o null. Solo se usa cuando el catálogo no
     aporta el dato, y prefiere no responder antes que responder mal: una
     ubicación equivocada contamina promedios locales, semáforo y simulador. */
  function inferirUbicacion(direccion) {
    var t = normText(direccion);
    if (!t || t.indexOf(",") === -1) return null;
    var k, estado = "", municipio = "";
    for (k in MUNICIPIOS) {
      if (MUNICIPIOS.hasOwnProperty(k) && buscaEnRanuras(t, k)) {
        municipio = MUNICIPIO_NOMBRE[k] || titleCase(k); estado = MUNICIPIOS[k];
        break;
      }
    }
    for (var i = 0; i < ESTADOS.length && !estado; i++) {
      if (buscaEnRanuras(t, ESTADOS[i])) estado = ESTADO_NOMBRE[ESTADOS[i]] || titleCase(ESTADOS[i]);
    }
    return estado ? { municipio: municipio, estado: estado } : null;
  }

  /* Sucursales propias declaradas en config.js. Se resuelve una sola vez. */
  /* ---------------------------------------------------------
     Mis estaciones: hasta 5 permisos elegidos en la interfaz.
     Se guardan en localStorage; config.js queda como respaldo inicial.
     --------------------------------------------------------- */

  var MIS_KEY = "combustibles:mis-estaciones";
  var MIS_MAX = 5;
  var misPermisos = [];

  function cargarMisPermisos() {
    var guardado = null;
    try {
      var raw = localStorage.getItem(MIS_KEY);
      if (raw) guardado = JSON.parse(raw);
    } catch (e) { guardado = null; }
    var base = (guardado && guardado.length !== undefined)
      ? guardado
      : ((CFG.MIS_ESTACIONES && CFG.MIS_ESTACIONES.permisos) || []);
    misPermisos = [];
    for (var i = 0; i < base.length && misPermisos.length < MIS_MAX; i++) {
      var k = String(base[i] || "").toUpperCase().replace(/\s+/g, "");
      if (!k) continue;
      k = k.indexOf("CNE/") === 0 ? k.slice(4) : k;
      if (misPermisos.indexOf(k) === -1) misPermisos.push(k);
    }
  }

  function guardarMisPermisos() {
    try { localStorage.setItem(MIS_KEY, JSON.stringify(misPermisos)); } catch (e) {}
  }

  var MIAS = (function () {
    var cfg = CFG.MIS_ESTACIONES || {};
    var patrones = [];
    (cfg.patrones || []).forEach(function (t) {
      if (String(t || "").trim()) patrones.push(t);
    });
    return { patrones: patrones, activo: true };
  })();

  /* Marcas a vigilar (config.MARCAS_COMPETENCIA), reconocidas por la columna
     Marca del catálogo y, en su defecto, por la razón social. */
  /* La coincidencia es por PALABRA COMPLETA, nunca por subcadena. Buscar
     "mobil" dentro del texto compactado convertía cada INMOBILIARIA en una
     estación Mobil, y "arco" marcaba a MARCOFAN. */
  function reglaPalabra(texto) {
    var t = normText(texto).replace(/[^a-z0-9\s]/g, " ");
    return " " + t.replace(/\s+/g, " ").trim() + " ";
  }

  function contienePalabras(campo, frase) {
    var f = reglaPalabra(frase).trim();
    return f ? campo.indexOf(" " + f + " ") > -1 : false;
  }

  var MARCAS = (CFG.MARCAS_COMPETENCIA || []).map(function (m) {
    return { nombre: m, frase: m };
  });

  /* Recalcula la marca propia de todas las filas tras cambiar la selección. */
  function refrescarPropias() {
    state.rows.forEach(function (r) { r._own = esPropia(r); });
  }

  function detectaMarca(r) {
    var campo = reglaPalabra((r.marca || "") + " " + (r.estacion || ""));
    for (var i = 0; i < MARCAS.length; i++) {
      if (contienePalabras(campo, MARCAS[i].frase)) return MARCAS[i].nombre;
    }
    return "";
  }

  function esPropia(r) {
    if (r.permiso && misPermisos.indexOf(permitKey(r.permiso)) > -1) return true;
    if (!MIAS.patrones.length) return false;
    var campo = reglaPalabra((r.estacion || "") + " " + (r.marca || ""));
    for (var i = 0; i < MIAS.patrones.length; i++) {
      if (contienePalabras(campo, MIAS.patrones[i])) return true;
    }
    return false;
  }

  /* Texto precalculado para que la búsqueda no recorra objetos en cada tecla. */
  function indexRow(r) {
    // No se reinicia la marca: indexRow vuelve a correr tras cruzar el catálogo.
    if (r.inferido === undefined) r.inferido = false;
    if (!r.estado && r.direccion) {
      var geo = inferirUbicacion(r.direccion);
      if (geo) {
        r.estado = geo.estado;
        if (!r.municipio && geo.municipio) r.municipio = geo.municipio;
        r.inferido = true;
      } else if (CFG.ESTADO_POR_DEFECTO) {
        r.estado = CFG.ESTADO_POR_DEFECTO;   // asignación declarada en config.js
        r.asignado = true;
      }
    }
    r._s = slug([r.estacion, r.permiso, permitKey(r.permiso), r.direccion,
                 r.municipio, r.estado, r.region, r.marca].join(" "));
    r._own = esPropia(r);
    r._marca = detectaMarca(r);
    return r;
  }

  /* Un permiso repetido en el mismo periodo conserva el primer registro y solo
     completa los productos que le falten. */
  function dedupe(rows) {
    var byKey = {}, out = [];
    rows.forEach(function (r) {
      var key = (r.permiso ? permitKey(r.permiso) : r.estacion) + "|" + r.fecha;
      if (!r.permiso) { out.push(r); return; }
      if (!byKey[key]) { byKey[key] = r; out.push(r); return; }
      quality.duplicados++;
      var prev = byKey[key];
      ["regular", "premium", "diesel"].forEach(function (p) {
        if (prev[p] === null && r[p] !== null) prev[p] = r[p];
      });
      if (!prev.tipodiesel && r.tipodiesel) prev.tipodiesel = r.tipodiesel;
    });
    return out;
  }

  /* ---------------------------------------------------------
     2 bis. Lectura del XML oficial de la CNE
     <precios fecha_generacion="AAAA-MM-DD">
       <estacion permiso="PL/XXXX/EXP/ES/AÑO">
         <producto tipo="regular|premium|diesel" precio="00.00"/>
     --------------------------------------------------------- */

  function parseXmlPrecios(text) {
    var doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("El XML no se pudo interpretar.");
    var raiz = doc.documentElement;
    var fecha = raiz.getAttribute("fecha_generacion") || "";
    var nodos = raiz.getElementsByTagName("estacion");
    var rows = [], i, j;
    for (i = 0; i < nodos.length; i++) {
      var est = nodos[i];
      var permiso = (est.getAttribute("permiso") || "").trim();
      if (!permiso) continue;
      var row = {
        fecha: fecha, region: "", estado: "", municipio: "", marca: "",
        estacion: "", permiso: permiso, direccion: "",
        regular: null, premium: null, diesel: null, tipodiesel: "",
        lat: null, lon: null, margen: null
      };
      var prods = est.getElementsByTagName("producto");
      for (j = 0; j < prods.length; j++) {
        var tipo = (prods[j].getAttribute("tipo") || "").toLowerCase();
        if (tipo !== "regular" && tipo !== "premium" && tipo !== "diesel") continue;
        row[tipo] = toNumber(prods[j].getAttribute("precio"));
      }
      rows.push(indexRow(row));
    }
    if (!rows.length) throw new Error("El XML no contiene estaciones.");
    return dedupe(rows);
  }

  /* El XML solo trae permiso y precios: el catálogo aporta razón social,
     dirección, municipio, estado y región. */
  function applyCatalog(rows, catalog) {
    if (!catalog) return rows;
    quality.catalogo = 0;
    rows.forEach(function (r) {
      var c = r.permiso && (catalog[r.permiso] || catalog[permitKey(r.permiso)]);
      if (!c) return;
      quality.catalogo++;
      ["region", "estado", "municipio", "marca", "estacion", "direccion"].forEach(function (k) {
        if (!r[k] && c[k]) r[k] = c[k];
      });
      if (r.lat === null && c.lat !== null && c.lat !== undefined) r.lat = c.lat;
      if (r.lon === null && c.lon !== null && c.lon !== undefined) r.lon = c.lon;
      indexRow(r);   // recalcula búsqueda y marca de sucursal propia
    });
    return rows;
  }

  function buildCatalog(text) {
    var parsed = parseCsv(text);
    var rows = normalize(parsed.rows, parsed.fields);
    var idx = {};
    rows.forEach(function (r) {
      if (!r.permiso) return;
      idx[r.permiso] = r;
      var k = permitKey(r.permiso);
      if (!idx[k]) idx[k] = r;
    });
    return idx;
  }

  /* ---------------------------------------------------------
     3. Carga de datos
     --------------------------------------------------------- */

  function setStatus(stateName, text, time) {
    var el = $("status");
    el.setAttribute("data-state", stateName);
    $("statusText").textContent = text;
    $("statusTime").textContent = time || "";
  }

  function parseCsv(text) {
    var res = Papa.parse(text.trim(), { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
    return { rows: res.data, fields: (res.meta && res.meta.fields) || [] };
  }

  function bust(url) {
    return url + (url.indexOf("?") > -1 ? "&" : "?") + "t=" + Date.now();
  }

  function fetchText(url) {
    return fetch(bust(url), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " al leer " + url);
      return r.text();
    });
  }

  /* Clave canónica del permiso: mayúsculas, sin espacios y sin el prefijo
     "CNE/" que la Comisión adoptó en 2025 para los permisos nuevos. Permite
     cruzar catálogos capturados con una u otra convención. */
  function permitKey(p) {
    var k = String(p || "").toUpperCase().replace(/\s+/g, "");
    return k.indexOf("CNE/") === 0 ? k.slice(4) : k;
  }

  function esXml(url) { return /\.xml($|\?)/i.test(url || ""); }

  /* Orden de la arquitectura dual: Sheets → CSV remoto → XML → respaldo local.
     Se devuelve la lista completa para poder degradar sin cortar la vista. */
  function resolveSources() {
    var lista = [];
    var add = function (url, kind, origin, primary) {
      url = (url || "").trim();
      if (!url) return;
      if (lista.some(function (s) { return s.url === url; })) return;
      lista.push({ url: url, kind: kind, origin: origin, primary: !!primary });
    };
    add(CFG.SHEET_CSV_URL, "csv", "Google Sheets", true);
    add(CFG.CSV_URL, "csv", "CSV remoto", true);
    add(CFG.XML_URL, esXml(CFG.XML_URL) ? "xml" : "csv", "XML oficial CNE", true);
    add(CFG.FALLBACK_CSV, esXml(CFG.FALLBACK_CSV) ? "xml" : "csv", "respaldo local", false);
    return lista;
  }

  function parseSource(text, kind) {
    var looksXml = text.replace(/^\uFEFF/, "").trim().charAt(0) === "<";
    if (kind === "xml" || looksXml) return parseXmlPrecios(text);
    var parsed = parseCsv(text);
    return normalize(parsed.rows, parsed.fields);
  }

  function load(manual) {
    var fuentes = resolveSources();
    var btn = $("refreshBtn");

    if (!fuentes.length) {
      setStatus("error", "Sin fuente configurada", "");
      showLoadError("config.js", "No hay SHEET_CSV_URL, CSV_URL, XML_URL ni FALLBACK_CSV.");
      return;
    }

    setStatus("loading", "Cargando", "");
    btn.classList.add("is-spinning");
    btn.disabled = true;

    var histUrl = CFG.HISTORY_CSV && CFG.HISTORY_CSV.trim();
    if (histUrl) {
      fetchText(histUrl)
        .then(function (t) { historico = parseHistorico(t); if (state.rows.length) render(); })
        .catch(function () { historico = []; });
    }

    var catUrl = CFG.CATALOG_CSV && CFG.CATALOG_CSV.trim();
    var catalogo = catUrl ? fetchText(catUrl).then(buildCatalogSafe, function () { return null; })
                          : Promise.resolve(null);

    catalogo
      .then(function (cat) { return intentar(fuentes, 0, cat, []); })
      .then(function (res) {
        quality = res.quality;
        state.rows = res.rows;
        refrescarPropias();
        state.updatedAt = new Date();
        state.origin = res.src.origin;
        saveCache(res.rows);
        buildControls();
        render();
        if (res.src.primary) {
          setStatus("live", res.src.kind === "csv" && res.src.origin === "Google Sheets" ? "En vivo" : "Sincronizado",
                    fmtDateTime(state.updatedAt));
        } else if (fuentes.length > 1) {
          // Alguna fuente primaria falló: se degradó al respaldo del repositorio.
          setStatus("fallback", "Respaldo local", fmtDateTime(state.updatedAt));
        } else {
          setStatus("live", "Sincronizado", fmtDateTime(state.updatedAt));
        }
      })
      .catch(function (err) {
        var cached = readCache();
        if (cached) {
          state.rows = cached.rows;
          state.updatedAt = new Date(cached.at);
          state.origin = cached.origin + " (copia guardada)";
          buildControls();
          render();
          setStatus("fallback", "Sin conexión · datos guardados", fmtDateTime(state.updatedAt));
        } else {
          setStatus("error", "No se pudo cargar", "");
          showLoadError(fuentes.map(function (f) { return f.url; }).join(" · "), err.message);
        }
      })
      .then(function () {
        btn.classList.remove("is-spinning");
        btn.disabled = false;
        if (manual) btn.blur();
      });
  }

  /* Recorre las fuentes en orden y se queda con la primera utilizable. */
  function intentar(fuentes, i, catalogo, fallos) {
    if (i >= fuentes.length) {
      throw new Error(fallos.join(" | ") || "Ninguna fuente respondió.");
    }
    var src = fuentes[i];
    return fetchText(src.url)
      .then(function (text) {
        quality = { duplicados: 0, fueraRango: 0, catalogo: 0 };
        var rows = parseSource(text, src.kind);
        if (!rows.length) throw new Error("Sin estaciones con precio.");
        applyCatalog(rows, catalogo);
        return { rows: rows, src: src, quality: quality };
      })
      .catch(function (e) {
        fallos.push(src.url + ": " + e.message);
        return intentar(fuentes, i + 1, catalogo, fallos);
      });
  }

  function buildCatalogSafe(text) {
    try { return buildCatalog(text); } catch (e) { return null; }
  }

  /* El padrón nacional supera las 13,800 estaciones: guardarlo completo en
     localStorage excede la cuota del navegador, así que solo se cachean
     conjuntos pequeños. */
  function saveCache(rows) {
    if (rows.length > 4000) { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} return; }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        rows: rows, at: state.updatedAt.toISOString(), origin: state.origin
      }));
    } catch (e) { /* almacenamiento no disponible o lleno */ }
  }

  /* ---------------------------------------------------------
     3 bis. Serie histórica de promedios
     Fecha,Ambito,Clave,Producto,Promedio,Estaciones
     --------------------------------------------------------- */

  var historico = [];

  function parseHistorico(text) {
    var parsed = parseCsv(text);
    var out = [];
    parsed.rows.forEach(function (r) {
      var f = (r.Fecha || "").trim();
      var prod = (r.Producto || "").trim().toLowerCase().replace("é", "e");
      var v = parseFloat(r.Promedio);
      if (!f || !isFinite(v)) return;
      out.push({
        fecha: f,
        ambito: (r.Ambito || "").trim().toLowerCase(),
        clave: (r.Clave || "").trim(),
        producto: prod === "diesel" ? "diesel" : prod,
        promedio: v,
        estaciones: parseInt(r.Estaciones, 10) || 0
      });
    });
    return out;
  }

  /* Serie del ámbito que corresponde a los filtros activos. */
  function serieHistorica() {
    if (!historico.length) return { puntos: {}, fechas: [], etiqueta: "" };
    var ambito = "nacional", clave = "MX", etiqueta = "nacional";
    if (state.municipio && state.municipio !== SIN_UBICACION) {
      ambito = "municipio"; clave = state.estado + "»" + state.municipio; etiqueta = state.municipio;
    } else if (state.estado && state.estado !== SIN_UBICACION) {
      ambito = "estado"; clave = state.estado; etiqueta = state.estado;
    }
    var sel = historico.filter(function (h) { return h.ambito === ambito && h.clave === clave; });
    /* El histórico guarda nacional, estado y región, no municipio: al filtrar
       un municipio la serie degrada a su estado y, en último caso, al país. */
    if (!sel.length && ambito === "municipio" && state.estado && state.estado !== SIN_UBICACION) {
      sel = historico.filter(function (h) { return h.ambito === "estado" && h.clave === state.estado; });
      etiqueta = state.estado;
    }
    if (!sel.length && ambito !== "nacional") {
      sel = historico.filter(function (h) { return h.ambito === "nacional"; });
      etiqueta = "nacional";
    }
    var fechas = [], puntos = { regular: {}, premium: {}, diesel: {} };
    sel.forEach(function (h) {
      if (fechas.indexOf(h.fecha) === -1) fechas.push(h.fecha);
      if (puntos[h.producto]) puntos[h.producto][h.fecha] = h.promedio;
    });
    fechas.sort();
    return { puntos: puntos, fechas: fechas, etiqueta: etiqueta };
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.rows || !obj.rows.length) return null;
      // Verificación de forma: una fila válida trae permiso o estación.
      var f = obj.rows[0];
      if (!f || typeof f !== "object" || (!f.permiso && !f.estacion)) return null;
      obj.rows.forEach(indexRow);   // reconstruye índices derivados tras el JSON
      return obj;
    } catch (e) { return null; }
  }

  function showLoadError(target, detail) {
    $("datasetNote").textContent = "Origen no disponible: " + target;
    var msg = "No se pudo leer el origen de datos (" + detail + "). Revisa que la hoja esté publicada como CSV y que la URL en config.js sea correcta.";
    ["emptyTrend", "emptyCompare", "emptyHist"].forEach(function (id) {
      $(id).hidden = false; $(id).textContent = msg;
    });
    $("emptyTable").hidden = false;
    $("emptyTable").textContent = msg;
  }

  /* ---------------------------------------------------------
     4. Controles dependientes de los datos
     --------------------------------------------------------- */

  function periods() {
    var set = {};
    state.rows.forEach(function (r) { if (r.fecha) set[r.fecha] = true; });
    return Object.keys(set).sort().reverse();
  }

  /* La comparativa se agrupa por el nivel más fino que tenga suficientes
     grupos dentro de la selección actual. */
  function detectDimension() {
    var base = typeof scoped === "function" && state.rows.length ? scoped() : state.rows;
    var order = [
      { key: "municipio", label: "Municipio" },
      { key: "estado", label: "Estado" },
      { key: "region", label: "Región" },
      { key: "marca", label: "Marca" }
    ];
    for (var i = 0; i < order.length; i++) {
      var vals = {};
      base.forEach(function (r) { if (r[order[i].key]) vals[r[order[i].key]] = true; });
      if (Object.keys(vals).length >= 2) return order[i];
    }
    return { key: "estacion", label: "Estación" };
  }

  function buildControls() {
    var ps = periods(), sel = $("periodSelect"), i;
    var keepPeriod = state.period;
    sel.innerHTML = "";
    if (ps.length > 1) sel.appendChild(new Option("Todos los periodos", ""));
    for (i = 0; i < ps.length; i++) sel.appendChild(new Option(fmtPeriod(ps[i]), ps[i]));
    if (!ps.length) sel.appendChild(new Option("Sin columna de fecha", ""));
    // Conserva la selección del usuario si sigue existiendo tras la actualización.
    state.period = (keepPeriod && ps.indexOf(keepPeriod) > -1) ? keepPeriod : (ps.length ? ps[0] : "");
    sel.value = state.period;
    sel.disabled = ps.length < 2;

    state.dimension = detectDimension();
    buildGeoSelects();

    var mias = state.rows.filter(function (r) { return r._own; }).length;
    var toggle = $("mineToggle");
    $("mineCount").textContent = mias ? "(" + mias + ")" : "";
    toggle.disabled = false;   // sin estaciones, el clic abre el gestor
    toggle.title = mias
      ? "Aísla tus " + mias + " estación(es); los promedios del mercado se siguen calculando con el padrón completo."
      : "Aún no eliges estaciones: usa el botón \u201cMis estaciones\u201d para agregar hasta 5.";
    if (!mias && state.onlyMine) setMine(false);

    var nota = [state.rows.length.toLocaleString("es-MX") + " estaciones", "origen: " + state.origin];
    if (ps.length) nota.push(ps.length + " periodo" + (ps.length > 1 ? "s" : ""));
    if (quality.catalogo) nota.push(quality.catalogo.toLocaleString("es-MX") + " con catálogo");
    var conUbic = state.rows.filter(function (r) { return r.estado; }).length;
    var inferidas = state.rows.filter(function (r) { return r.inferido; }).length;
    nota.push(conUbic.toLocaleString("es-MX") + " con ubicación" + (inferidas ? " (" + inferidas + " inferida" + (inferidas > 1 ? "s" : "") + " del domicilio)" : ""));
    if (MIAS.activo) {
      nota.push(mias ? mias + " sucursal" + (mias > 1 ? "es" : "") + " propia" + (mias > 1 ? "s" : "")
                     : "sin sucursales propias en el padrón");
    }
    if (quality.duplicados) nota.push(quality.duplicados + " permisos repetidos fusionados");
    if (quality.fueraRango) nota.push(quality.fueraRango + " precios fuera de rango descartados");
    $("datasetNote").textContent = nota.join(" · ");
  }

  /* Estado y Municipio en cascada: el municipio solo lista los del estado
     seleccionado. */
  /* Las estaciones sin ubicación no bloquean los filtros: se agrupan en una
     opción propia. Los selectores siempre quedan operables. */
  var SIN_UBICACION = "__sin__";

  function buildGeoSelects() {
    var selE = $("estadoSelect");
    var estados = {}, sinUbic = 0;
    state.rows.forEach(function (r) {
      if (r.estado) estados[r.estado] = true; else sinUbic++;
    });
    var listaE = Object.keys(estados).sort(function (a, b) { return a.localeCompare(b, "es"); });

    var keepE = state.estado;
    selE.innerHTML = "";
    selE.appendChild(new Option("Todos los estados", ""));
    listaE.forEach(function (v) { selE.appendChild(new Option(v, v)); });
    if (sinUbic) selE.appendChild(new Option("Sin ubicación (" + sinUbic.toLocaleString("es-MX") + ")", SIN_UBICACION));
    selE.disabled = false;

    var validos = [""].concat(listaE);
    if (sinUbic) validos.push(SIN_UBICACION);
    state.estado = validos.indexOf(keepE) > -1 ? keepE : "";
    selE.value = state.estado;

    buildMunicipioSelect();
  }

  function buildMunicipioSelect() {
    var selM = $("municipioSelect");
    var muni = {}, sinMuni = 0;
    state.rows.forEach(function (r) {
      if (state.estado === SIN_UBICACION) { if (r.estado) return; }
      else if (state.estado && r.estado !== state.estado) return;
      if (r.municipio) muni[r.municipio] = true; else sinMuni++;
    });
    var lista = Object.keys(muni).sort(function (a, b) { return a.localeCompare(b, "es"); });

    var keepM = state.municipio;
    selM.innerHTML = "";
    selM.appendChild(new Option(lista.length
      ? "Todos los municipios (" + lista.length.toLocaleString("es-MX") + ")"
      : "El catálogo no trae municipios", ""));
    lista.forEach(function (v) { selM.appendChild(new Option(v, v)); });
    if (sinMuni && lista.length) selM.appendChild(new Option("Sin municipio (" + sinMuni.toLocaleString("es-MX") + ")", SIN_UBICACION));
    selM.disabled = false;
    selM.title = lista.length
      ? lista.length.toLocaleString("es-MX") + " municipios en la selección actual"
      : "Ninguna estación de la selección tiene municipio. Genera el catálogo con --municipios o captura la columna Municipio.";

    var validos = [""].concat(lista);
    if (sinMuni && lista.length) validos.push(SIN_UBICACION);
    state.municipio = validos.indexOf(keepM) > -1 ? keepM : "";
    selM.value = state.municipio;
  }

  function setMine(on) {
    state.onlyMine = !!on;
    var t = $("mineToggle");
    t.setAttribute("aria-pressed", state.onlyMine ? "true" : "false");
    t.classList.toggle("is-on", state.onlyMine);
    t.querySelector(".switch-brand__label").textContent = state.onlyMine ? "Solo mis estaciones" : "Mercado total";
  }

  /* ---------------------------------------------------------
     5. Selección de datos
     --------------------------------------------------------- */

  /* Filas del periodo seleccionado, sin filtros del usuario: es la base de
     mercado contra la que se calculan los promedios locales, para que aislar
     "mis estaciones" no deforme la referencia. */
  function periodRows() {
    return state.rows.filter(function (r) { return !state.period || r.fecha === state.period; });
  }

  function coincideGeo(r) {
    if (state.estado === SIN_UBICACION) { if (r.estado) return false; }
    else if (state.estado && r.estado !== state.estado) return false;
    if (state.municipio === SIN_UBICACION) { if (r.municipio) return false; }
    else if (state.municipio && r.municipio !== state.municipio) return false;
    return true;
  }

  function scoped() {
    return periodRows().filter(function (r) {
      if (!coincideGeo(r)) return false;
      if (state.onlyMine && !r._own) return false;
      return true;
    });
  }

  /* ---------------------------------------------------------
     5 bis. Promedios locales y diferencial (semáforo comercial)
     --------------------------------------------------------- */

  var mercado = { municipio: {}, estado: {}, nacional: {} };

  /* ---------- Mercado por radio (cuando el catálogo trae coordenadas) ----------
     Es la definición más fiel de competencia: quien está a pocos kilómetros,
     sin importar el límite municipal. Se indexa en una rejilla para no comparar
     cada estación contra las 13,800 restantes. */

  var rejilla = null, RADIO_KM = 0;

  function gradosPorKm(lat) {
    return { lat: 1 / 110.574, lon: 1 / (111.320 * Math.cos(lat * Math.PI / 180) || 1) };
  }

  function distanciaKm(a, b) {
    var R = 6371, p = Math.PI / 180;
    var dLat = (b.lat - a.lat) * p, dLon = (b.lon - a.lon) * p;
    var s1 = Math.sin(dLat / 2), s2 = Math.sin(dLon / 2);
    var h = s1 * s1 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * s2 * s2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function construirRejilla(rows) {
    RADIO_KM = Number(CFG.RADIO_KM || 0);
    rejilla = null;
    if (!RADIO_KM) return;
    var conCoords = rows.filter(function (r) { return r.lat !== null && r.lon !== null; });
    if (conCoords.length < 2) return;

    // Celdas del tamaño del radio: basta revisar la celda y sus ocho vecinas.
    var paso = RADIO_KM / 110.574;
    var celdas = {};
    conCoords.forEach(function (r) {
      var k = Math.floor(r.lat / paso) + ":" + Math.floor(r.lon / paso);
      (celdas[k] = celdas[k] || []).push(r);
    });
    rejilla = { paso: paso, celdas: celdas, total: conCoords.length };
  }

  function vecinos(r, prod) {
    if (!rejilla || r.lat === null || r.lon === null) return null;
    var ci = Math.floor(r.lat / rejilla.paso), cj = Math.floor(r.lon / rejilla.paso);
    var out = [], i, j, k, lista, x;
    for (i = ci - 1; i <= ci + 1; i++) {
      for (j = cj - 1; j <= cj + 1; j++) {
        lista = rejilla.celdas[i + ":" + j];
        if (!lista) continue;
        for (k = 0; k < lista.length; k++) {
          x = lista[k];
          if (x[prod] === null) continue;
          if (distanciaKm(r, x) <= RADIO_KM) out.push(x);
        }
      }
    }
    return out;
  }

  var mercadoFirma = "";

  function computeMercado() {
    /* Los promedios y la rejilla dependen solo del periodo y del padrón cargado,
       no de los filtros de vista. Recalcularlos en cada clic cuesta caro con
       13,800 estaciones, así que se memorizan por firma. */
    var base = periodRows();
    var firma = state.period + "|" + base.length + "|" + (state.updatedAt ? state.updatedAt.getTime() : 0) +
                "|" + (CFG.RADIO_KM || 0);
    if (firma === mercadoFirma) return;
    mercadoFirma = firma;

    construirRejilla(base);
    var acc = { municipio: {}, estado: {}, nacional: {} };
    var sumar = function (bolsa, clave, prod, valor) {
      var k = clave + "|" + prod;
      if (!bolsa[k]) bolsa[k] = { t: 0, n: 0 };
      bolsa[k].t += valor; bolsa[k].n++;
    };
    base.forEach(function (r) {
      ["regular", "premium", "diesel"].forEach(function (p) {
        if (r[p] === null) return;
        sumar(acc.nacional, "MX", p, r[p]);
        if (r.estado) sumar(acc.estado, r.estado, p, r[p]);
        if (r.municipio) sumar(acc.municipio, r.estado + "»" + r.municipio, p, r[p]);
      });
    });
    var prom = function (bolsa) {
      var out = {}, k;
      for (k in bolsa) if (bolsa.hasOwnProperty(k)) out[k] = { avg: bolsa[k].t / bolsa[k].n, n: bolsa[k].n };
      return out;
    };
    mercado = { municipio: prom(acc.municipio), estado: prom(acc.estado), nacional: prom(acc.nacional) };
  }

  /* Referencia local del producto activo, con degradación municipio → estado
     → nacional. Un municipio con una sola estación no es referencia: en ese
     caso sube al estado. */
  function referenciaLocal(r, prod) {
    var cerca = vecinos(r, prod);
    if (cerca && cerca.length >= 2) {
      var t = 0;
      for (var i = 0; i < cerca.length; i++) t += cerca[i][prod];
      return { avg: t / cerca.length, n: cerca.length, alcance: "radio",
               etiqueta: RADIO_KM + " km a la redonda", rows: cerca };
    }
    var m = r.municipio && mercado.municipio[r.estado + "»" + r.municipio + "|" + prod];
    if (m && m.n >= 2) return { avg: m.avg, n: m.n, alcance: "municipio", etiqueta: r.municipio };
    var e = r.estado && mercado.estado[r.estado + "|" + prod];
    if (e && e.n >= 2) return { avg: e.avg, n: e.n, alcance: "estado", etiqueta: r.estado };
    var n = mercado.nacional["MX|" + prod];
    return n ? { avg: n.avg, n: n.n, alcance: "nacional", etiqueta: "nacional" } : null;
  }

  function spreadDe(r, prod) {
    if (r[prod] === null) return null;
    var ref = referenciaLocal(r, prod);
    if (!ref) return null;
    return { valor: r[prod] - ref.avg, ref: ref };
  }

  function pricesOf(rows, product) {
    return rows.map(function (r) { return r[product]; }).filter(function (v) { return v !== null; });
  }

  /* ---------------------------------------------------------
     6. KPIs
     --------------------------------------------------------- */

  /* Promedio del corte inmediato anterior. Si el padrón solo trae un periodo,
     se toma del histórico de promedios. */
  function previousPeriodAvg(product) {
    var ps = periods();
    if (ps.length < 2 && historico.length) {
      var h = serieHistorica();
      var i = h.fechas.indexOf(state.period || h.fechas[h.fechas.length - 1]);
      if (i === -1) i = h.fechas.length - 1;
      var prevF = h.fechas[i - 1];
      if (prevF && h.puntos[product] && h.puntos[product][prevF] !== undefined) {
        return h.puntos[product][prevF];
      }
    }
    if (!state.period || ps.length < 2) return null;
    var idx = ps.indexOf(state.period);
    if (idx < 0 || idx + 1 >= ps.length) return null;
    var prev = ps[idx + 1];
    var rows = state.rows.filter(function (r) {
      if (r.fecha !== prev) return false;
      if (!coincideGeo(r)) return false;
      if (state.onlyMine && !r._own) return false;
      return true;
    });
    return avg(pricesOf(rows, product));
  }

  function renderKpis(rows) {
    ["regular", "premium", "diesel"].forEach(function (p) {
      var card = $("kpi" + p.charAt(0).toUpperCase() + p.slice(1));
      var vals = pricesOf(rows, p);
      var mean = avg(vals);
      var valEl = card.querySelector(".kpi__value");
      var deltaEl = card.querySelector(".kpi__delta");
      var benchEl = card.querySelector(".kpi__bench");

      valEl.innerHTML = mean === null
        ? '<span class="na">Sin datos</span>'
        : money(mean) + " <small>/ litro</small>";

      var prev = previousPeriodAvg(p);
      deltaEl.className = "kpi__delta";
      if (mean !== null && prev !== null) {
        var d = mean - prev;
        // Sin cambio no lleva clase: classList.add("") lanza excepción.
        if (d > 0) deltaEl.classList.add("is-up");
        else if (d < 0) deltaEl.classList.add("is-down");
        deltaEl.textContent = (d > 0 ? "▲ +" + d.toFixed(2) : d < 0 ? "▼ " + d.toFixed(2) : "Sin cambio") +
          " vs. periodo anterior (" + money(prev) + ")";
      } else {
        deltaEl.textContent = "Sin periodo anterior para comparar";
      }

      var b = CFG.BENCHMARK && CFG.BENCHMARK[p];
      var parts = [vals.length.toLocaleString("es-MX") + " estaciones con precio"];
      if (mean !== null && b) {
        var diff = mean - b;
        parts.push((diff >= 0 ? "+" : "") + diff.toFixed(2) + " vs. " + CFG.BENCHMARK.label + " (" + money(b) + ")");
      }
      benchEl.textContent = parts.join(" · ");
    });
  }

  function renderExtremes(rows) {
    var p = state.product;
    var withPrice = rows.filter(function (r) { return r[p] !== null; });
    var lowCard = $("cardMin"), highCard = $("cardMax");

    if (!withPrice.length) {
      [lowCard, highCard].forEach(function (c) {
        c.querySelector(".extreme__price").textContent = "—";
        c.querySelector(".extreme__station").textContent = "Sin registros de " + PRODUCTS[p].label;
        c.querySelector(".extreme__addr").textContent = "";
      });
      return;
    }
    var sorted = withPrice.slice().sort(function (a, b) { return a[p] - b[p]; });
    fill(lowCard, sorted[0], "Precio más bajo · " + PRODUCTS[p].label);
    fill(highCard, sorted[sorted.length - 1], "Precio más alto · " + PRODUCTS[p].label);

    function fill(card, row, label) {
      card.querySelector(".extreme__label").textContent = label;
      card.querySelector(".extreme__price").textContent = money(row[p]);
      card.querySelector(".extreme__station").textContent = row.estacion || row.permiso;
      var pie = [row.direccion, row.municipio, row.estado].filter(Boolean).join(" · ");
      card.querySelector(".extreme__addr").textContent =
        pie || (row.estacion ? row.permiso : "Permiso sin datos en el catálogo");
    }
  }

  /* ---------------------------------------------------------
     7. Regla de dispersión
     --------------------------------------------------------- */

  function renderRail(rows) {
    var p = state.product;
    var track = $("railTrack");
    var withPrice = rows.filter(function (r) { return r[p] !== null; });

    document.body.setAttribute("data-product", p);
    Array.prototype.slice.call(track.querySelectorAll(".rail__tick")).forEach(function (t) { t.remove(); });

    if (withPrice.length < 2) {
      $("railMin").textContent = $("railMid").textContent = $("railMax").textContent = "—";
      $("railSpread").textContent = "Sin datos suficientes";
      $("railIqr").style.display = "none";
      $("railMedian").style.display = "none";
      $("railBench").style.display = "none";
      return;
    }

    var vals = withPrice.map(function (r) { return r[p]; }).sort(function (a, b) { return a - b; });
    var min = vals[0], max = vals[vals.length - 1];
    var span = (max - min) || 1;
    var pos = function (v) { return ((v - min) / span) * 100; };

    var frag = document.createDocumentFragment();
    if ($("railSub")) {
      $("railSub").textContent = withPrice.length <= 400
        ? "Cada marca es una estación. La banda sombreada concentra la mitad central del mercado (P25–P75)."
        : "Cada columna agrupa las estaciones de un mismo rango de precio; entre más intensa, más estaciones. La banda sombreada concentra la mitad central del mercado (P25–P75).";
    }
    if (withPrice.length <= 400) {
      // Una marca por estación, con su ficha en el tooltip.
      withPrice.forEach(function (r) {
        var tick = document.createElement("div");
        tick.className = "rail__tick";
        tick.style.left = pos(r[p]) + "%";
        tick.setAttribute("data-tip-title", r.estacion || r.permiso);
        tick.setAttribute("data-tip-body",
          money(r[p]) + " / litro · " + PRODUCTS[p].label + "\n" +
          (r.permiso ? r.permiso + "\n" : "") +
          [r.direccion, r.municipio].filter(Boolean).join(" · "));
        frag.appendChild(tick);
      });
    } else {
      // Padrón nacional: se agrupa en columnas de densidad para no crear
      // miles de nodos; la opacidad indica cuántas estaciones caen en el rango.
      var cols = 480, buckets = new Array(cols).fill(0), k;
      withPrice.forEach(function (r) {
        var i = Math.min(cols - 1, Math.floor(((r[p] - min) / span) * cols));
        buckets[i]++;
      });
      var top = Math.max.apply(null, buckets);
      for (k = 0; k < cols; k++) {
        if (!buckets[k]) continue;
        var tick2 = document.createElement("div");
        tick2.className = "rail__tick";
        tick2.style.left = (k / cols) * 100 + "%";
        tick2.style.opacity = (0.18 + 0.82 * Math.sqrt(buckets[k] / top)).toFixed(3);
        var a = min + (k / cols) * span, b2 = min + ((k + 1) / cols) * span;
        tick2.setAttribute("data-tip-title", buckets[k].toLocaleString("es-MX") + " estaciones");
        tick2.setAttribute("data-tip-body", "Entre " + money(a) + " y " + money(b2) + " / litro · " + PRODUCTS[p].label);
        frag.appendChild(tick2);
      }
    }
    track.appendChild(frag);

    var q1 = quantile(vals, 0.25), q3 = quantile(vals, 0.75), med = quantile(vals, 0.5);
    var iqr = $("railIqr");
    iqr.style.display = "block";
    iqr.style.left = pos(q1) + "%";
    iqr.style.width = (pos(q3) - pos(q1)) + "%";

    var medEl = $("railMedian");
    medEl.style.display = "block";
    medEl.style.left = pos(med) + "%";
    medEl.classList.toggle("is-right", pos(med) > 76);
    medEl.querySelector("span").textContent = money(med);

    var b = CFG.BENCHMARK && CFG.BENCHMARK[p];
    var benchEl = $("railBench");
    if (b && b >= min && b <= max) {
      benchEl.style.display = "block";
      benchEl.style.left = pos(b) + "%";
      benchEl.classList.toggle("is-right", pos(b) > 76);
      benchEl.querySelector("span").textContent = "Nacional " + money(b);
      $("railBenchChip").hidden = false;
    } else {
      benchEl.style.display = "none";
      $("railBenchChip").hidden = true;
    }

    $("railMin").textContent = money(min) + " mínimo";
    $("railMid").textContent = "mediana " + money(med);
    $("railMax").textContent = money(max) + " máximo";
    $("railSpread").textContent = "Brecha " + money(max - min) + " entre " +
      withPrice.length.toLocaleString("es-MX") + " estaciones";
  }

  /* ---------------------------------------------------------
     8. Gráficos
     --------------------------------------------------------- */

  function chartTheme() {
    return {
      text: cssVar("--text"),
      muted: cssVar("--muted"),
      line: cssVar("--line"),
      surface: cssVar("--surface-2"),
      regular: cssVar("--regular"),
      premium: cssVar("--premium"),
      diesel: cssVar("--diesel")
    };
  }

  function baseOptions(t) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: t.muted, boxWidth: 10, boxHeight: 10, font: { family: "IBM Plex Sans", size: 12 } } },
        tooltip: {
          backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text,
          borderColor: t.line, borderWidth: 1, padding: 10, displayColors: true,
          titleFont: { family: "IBM Plex Sans", weight: "600" },
          bodyFont: { family: "IBM Plex Mono" },
          callbacks: { footer: function () { return CFG.METODOLOGIA ? "Valores estimados SENER/CNE-CRE/SAT" : ""; } }
        }
      },
      scales: {
        x: { grid: { color: t.line, drawBorder: false }, ticks: { color: t.muted, font: { family: "IBM Plex Sans", size: 11 } } },
        y: { grid: { color: t.line, drawBorder: false }, ticks: { color: t.muted, font: { family: "IBM Plex Mono", size: 11 }, callback: function (v) { return "$" + v.toFixed(2); } } }
      }
    };
  }

  function destroy(name) { if (charts[name]) { charts[name].destroy(); charts[name] = null; } }

  function renderTrend() {
    var el = $("emptyTrend");
    destroy("trend");

    /* Dos fuentes posibles: los periodos cargados en el padrón, o el archivo
       de promedios diarios (historico.csv), que es el que crece solo con el
       flujo diario sin inflar el repositorio. Gana el que tenga más historia. */
    var ps = periods().slice().sort();
    var hist = serieHistorica();
    var usarHist = hist.fechas.length > ps.length;
    var etiquetas = usarHist ? hist.fechas : ps;
    var sub = $("trendSub");

    if (etiquetas.length < 2) {
      el.hidden = false;
      el.textContent = historico.length
        ? "El histórico tiene un solo corte. Cada corrida diaria del flujo agrega un punto a historico.csv y esta gráfica se llena sola."
        : "Un solo periodo cargado. El flujo diario (o el parámetro --historico de xml_a_csv.py) irá construyendo la serie.";
      if (sub) sub.textContent = "Promedio de cada producto en los periodos cargados.";
      return;
    }
    el.hidden = true;
    if (sub) {
      sub.textContent = usarHist
        ? "Promedios diarios de historico.csv · ámbito " + hist.etiqueta + " · " + etiquetas.length + " cortes."
        : "Promedio de cada producto en los periodos cargados en el padrón.";
    }

    var t = chartTheme();
    var series = ["regular", "premium", "diesel"].map(function (p) {
      return {
        label: PRODUCTS[p].label,
        data: etiquetas.map(function (f) {
          if (usarHist) {
            var v = hist.puntos[p] && hist.puntos[p][f];
            return v === undefined ? null : +v.toFixed(2);
          }
          var rows = state.rows.filter(function (r) {
            if (r.fecha !== f) return false;
            if (!coincideGeo(r)) return false;
            if (state.onlyMine && !r._own) return false;
            return true;
          });
          var m = avg(pricesOf(rows, p));
          return m === null ? null : +m.toFixed(2);
        }),
        borderColor: t[p], backgroundColor: t[p],
        tension: .3, borderWidth: 2, pointRadius: 2.5, pointHoverRadius: 5, spanGaps: true
      };
    });
    var opts = baseOptions(t);
    opts.scales.y.beginAtZero = false;
    charts.trend = new Chart($("chartTrend"), {
      type: "line",
      data: { labels: etiquetas.map(fmtPeriod), datasets: series },
      options: opts
    });
  }

  function renderCompare(rows) {
    var p = state.product, dim = state.dimension;
    var el = $("emptyCompare");
    destroy("compare");

    $("compareTitle").textContent = "Comparativa por " + dim.label.toLowerCase();
    $("compareSub").textContent = dim.key === "estacion"
      ? "La fuente no incluye región, estado ni municipio: se comparan estaciones individuales."
      : "Promedio de " + PRODUCTS[p].label + " en cada " + dim.label.toLowerCase() + ".";

    var groups = {};
    rows.forEach(function (r) {
      if (r[p] === null) return;
      var k = r[dim.key] || (dim.key === "estacion" ? r.permiso : "Sin clasificar");
      if (!k) return;
      (groups[k] = groups[k] || []).push(r[p]);
    });
    var list = Object.keys(groups).map(function (k) {
      return { k: k, v: avg(groups[k]), n: groups[k].length };
    }).sort(function (a, b) { return b.v - a.v; });

    if (list.length < 2) {
      el.hidden = false;
      el.textContent = "Se necesitan al menos dos grupos con precio de " + PRODUCTS[p].label + " para comparar.";
      return;
    }
    el.hidden = true;
    var trimmed = false;
    if (list.length > 14) {
      list = list.slice(0, 7).concat(list.slice(-7));
      trimmed = true;
      $("compareSub").textContent = "Las 7 " + (dim.key === "estacion" ? "estaciones" : dim.label.toLowerCase() + "s") +
        " con el precio más alto y las 7 con el más bajo de " + PRODUCTS[p].label +
        (dim.key === "estacion" ? ". La fuente no incluye región, estado ni municipio." : ".");
    }

    var t = chartTheme();
    var opts = baseOptions(t);
    opts.indexAxis = "y";
    opts.plugins.legend.display = false;
    opts.scales.x.ticks.callback = function (v) { return "$" + Number(v).toFixed(2); };
    opts.scales.y.ticks.callback = function (v) {
      var s = this.getLabelForValue(v);
      return s.length > 26 ? s.slice(0, 25) + "…" : s;
    };
    opts.scales.x.beginAtZero = false;
    opts.plugins.tooltip.callbacks.label = function (ctx) {
      return "$" + ctx.parsed.x.toFixed(2) + " · " + list[ctx.dataIndex].n + " estaciones";
    };

    charts.compare = new Chart($("chartCompare"), {
      type: "bar",
      data: {
        labels: list.map(function (d) { return d.k; }),
        datasets: [{
          data: list.map(function (d) { return +d.v.toFixed(2); }),
          backgroundColor: list.map(function (_, i) {
            return trimmed && i >= 7 ? t.muted : t[p];
          }),
          borderRadius: 4, barThickness: 14
        }]
      },
      options: opts
    });
  }

  function renderHist(rows) {
    var p = state.product;
    var el = $("emptyHist");
    destroy("hist");
    var vals = pricesOf(rows, p).sort(function (a, b) { return a - b; });
    if (vals.length < 3) {
      el.hidden = false;
      el.textContent = "Se necesitan al menos tres estaciones con precio de " + PRODUCTS[p].label + ".";
      return;
    }
    el.hidden = true;

    var min = vals[0], max = vals[vals.length - 1];
    var span = (max - min) || 1;
    var bins = Math.min(14, Math.max(5, Math.round(Math.sqrt(vals.length))));
    var width = span / bins;
    var counts = new Array(bins).fill(0);
    vals.forEach(function (v) {
      var i = Math.min(bins - 1, Math.floor((v - min) / width));
      counts[i]++;
    });

    var t = chartTheme();
    var opts = baseOptions(t);
    opts.plugins.legend.display = false;
    opts.scales.y.ticks.callback = function (v) { return v; };
    opts.scales.y.title = { display: true, text: "Estaciones", color: t.muted, font: { size: 11 } };
    opts.plugins.tooltip.callbacks.label = function (ctx) { return ctx.parsed.y + " estaciones"; };

    charts.hist = new Chart($("chartHist"), {
      type: "bar",
      data: {
        labels: counts.map(function (_, i) {
          return "$" + (min + i * width).toFixed(2) + "–" + (min + (i + 1) * width).toFixed(2);
        }),
        datasets: [{ data: counts, backgroundColor: t[p], borderRadius: 4 }]
      },
      options: opts
    });
  }

  /* ---------------------------------------------------------
     9. Explorador de estaciones
     --------------------------------------------------------- */

  function tableRows(rows) {
    var q = slug(state.search);
    var p = state.product;
    var list = rows.filter(function (r) {
      if ($("onlyProduct").checked && r[p] === null) return false;
      if (!q) return true;
      return (r._s || "").indexOf(q) > -1;
    });

    var key = state.sortKey, dir = state.sortDir === "asc" ? 1 : -1;
    var prod = state.product;

    var valor = function (r) {
      // Se ordena por la ubicación que muestra la columna; sin ubicación, al final.
      if (key === "ubicacion") return [r.municipio, r.estado].filter(Boolean).join(", ") || null;
      if (key === "spread") { var sp = spreadDe(r, prod); return sp ? sp.valor : null; }
      if (key === "estacion") return r.estacion || r.permiso || null;
      var v = r[key];
      return (v === undefined || v === "" ) ? null : v;
    };

    /* Los vacíos siempre al final, sin importar el sentido del orden: una
       columna de precios se ordena por precios, no por huecos. */
    list.sort(function (a, b) {
      var va = valor(a), vb = valor(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "es") * dir;
    });
    return list;
  }

  function renderTable(rows) {
    var list = tableRows(rows);
    var size = CFG.PAGE_SIZE || 25;
    var pages = Math.max(1, Math.ceil(list.length / size));
    if (state.page > pages) state.page = pages;
    var slice = list.slice((state.page - 1) * size, state.page * size);

    var p = state.product;
    var priced = list.filter(function (r) { return r[p] !== null; }).map(function (r) { return r[p]; });
    var lo = priced.length ? Math.min.apply(null, priced) : null;
    var hi = priced.length ? Math.max.apply(null, priced) : null;

    var html = slice.map(function (r) {
      return "<tr" + (r._own ? ' class="is-own"' : "") + ">" +
        '<td><div class="cell-station">' + esc(r.estacion || r.permiso) +
          (r._own ? '<span class="badge badge--own">Sucursal propia</span>' : "") + "</div>" +
          (r.marca ? '<div class="cell-addr">' + esc(r.marca) + "</div>" : "") + "</td>" +
        '<td><span class="cell-permit">' + (esc(r.permiso) || "—") + "</span></td>" +
        "<td>" + (r.inferido ? '<span class="inferido" data-tip data-tip-title="Ubicación inferida" data-tip-body="Deducida del domicilio, no del catálogo. Captura Estado y Municipio en catalogo_estaciones.csv para tenerla confirmada.">≈</span> ' : "") +
          esc([r.municipio, r.estado, r.region].filter(Boolean).join(", ") || "—") +
          (r.direccion ? '<div class="cell-addr">' + esc(r.direccion) + "</div>" : "") + "</td>" +
        cell(r, "regular", lo, hi, p) + cell(r, "premium", lo, hi, p) + cell(r, "diesel", lo, hi, p) +
        spreadCell(r, p) +
      "</tr>";
    }).join("");

    $("tbody").innerHTML = html;
    $("emptyTable").hidden = list.length > 0;
    if (!list.length) $("emptyTable").textContent = "Sin resultados. Ajusta la búsqueda o los filtros.";
    var head = $("spreadHead");
    if (head) head.childNodes[0].nodeValue = "Δ " + PRODUCTS[p].label + " vs. local ";
    $("tableCount").textContent = list.length.toLocaleString("es-MX") + " estaciones listadas · " +
      (state.period ? fmtPeriod(state.period) : "todos los periodos") +
      (state.municipio ? " · " + (state.municipio === SIN_UBICACION ? "sin municipio" : state.municipio) : "") +
      (state.estado ? " · " + (state.estado === SIN_UBICACION ? "sin ubicación" : state.estado) : "") +
      (state.onlyMine ? " · solo mis estaciones" : "");
    $("pageInfo").textContent = "Página " + state.page + " de " + pages;
    $("prevPage").disabled = state.page <= 1;
    $("nextPage").disabled = state.page >= pages;

    /* Semáforo comercial: por debajo del promedio local = combate por volumen;
       por encima = margen alto con riesgo de perder volumen. */
    function spreadCell(r, prod) {
      var sp = spreadDe(r, prod);
      if (!sp) return '<td class="is-num na">N/D</td>';
      var signo = sp.valor > 0 ? "+" : sp.valor < 0 ? "−" : "";
      var clase = sp.valor < -0.005 ? "spread--bajo" : sp.valor > 0.005 ? "spread--alto" : "spread--par";
      var tip = "Promedio " + (sp.ref.alcance === "nacional" ? "nacional"
                             : sp.ref.alcance === "radio" ? "de " + sp.ref.etiqueta
                             : sp.ref.alcance + " " + sp.ref.etiqueta) +
                ": " + money(sp.ref.avg) + " (" + sp.ref.n.toLocaleString("es-MX") + " estaciones)";
      return '<td class="is-num"><span class="spread ' + clase + '" data-tip-title="' +
             (sp.valor < 0 ? "Por debajo del mercado local" : sp.valor > 0 ? "Por encima del mercado local" : "En el promedio local") +
             '" data-tip-body="' + esc(tip) + '">' + signo + Math.abs(sp.valor).toFixed(2) + "</span></td>";
    }

    function cell(r, prod, lo, hi, active) {
      var v = r[prod];
      if (v === null) return '<td class="is-num na">N/D</td>';
      var badge = "";
      if (prod === active && v === lo && lo !== hi) badge = '<span class="badge badge--low">mín</span>';
      if (prod === active && v === hi && lo !== hi) badge = '<span class="badge badge--high">máx</span>';
      if (prod === "diesel" && r.tipodiesel) badge += '<span class="badge badge--type">' + esc(r.tipodiesel) + "</span>";
      return '<td class="is-num">' + money(v) + badge + "</td>";
    }
  }

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------------------------------------------------------
     10. Render general
     --------------------------------------------------------- */

  function render() {
    computeMercado();
    state.dimension = detectDimension();
    var rows = scoped();
    renderKpis(rows);
    renderExtremes(rows);
    renderRail(rows);
    renderTrend();
    renderCompare(rows);
    renderHist(rows);
    renderTable(rows);
    renderCompetencia(rows);
    renderMisEstaciones();
    renderProfeco(rows);
    renderSimulador();
    $("footerUpdated").textContent = state.updatedAt
      ? "Actualizado " + fmtDateTime(state.updatedAt) + " · origen: " + state.origin
      : "";
  }

  /* ---------------------------------------------------------
     9 bis. Monitoreo de competencia directa por marca
     --------------------------------------------------------- */

  function renderCompetencia(rows) {
    var caja = $("compCards"), nota = $("compNote");
    if (!caja) return;
    var p = state.product;

    var grupos = {};
    rows.forEach(function (r) {
      if (!r._marca || r[p] === null) return;
      (grupos[r._marca] = grupos[r._marca] || []).push(r[p]);
    });

    var lista = Object.keys(grupos).map(function (k) {
      return { marca: k, avg: avg(grupos[k]), n: grupos[k].length };
    }).sort(function (a, b) { return a.avg - b.avg; });

    var refBase = mercado.nacional["MX|" + p];
    var refZona = null;
    if (state.municipio && state.municipio !== SIN_UBICACION) {
      refZona = mercado.municipio[state.estado + "»" + state.municipio + "|" + p];
    } else if (state.estado && state.estado !== SIN_UBICACION) {
      refZona = mercado.estado[state.estado + "|" + p];
    }
    var ref = refZona || refBase;

    if (!lista.length) {
      caja.innerHTML = '<p class="comp__empty">Ninguna de las marcas vigiladas aparece en la selección actual. ' +
        'El padrón de la CNE publica la razón social, no la marca comercial: llena la columna <code>Marca</code> ' +
        'en <code>catalogo_estaciones.csv</code> (o ajusta <code>MARCAS_COMPETENCIA</code> en config.js) para activarla.</p>';
      if (nota) nota.textContent = "Promedio por marca en la selección activa.";
      return;
    }

    caja.innerHTML = lista.map(function (d) {
      var dif = ref ? d.avg - ref.avg : null;
      var clase = dif === null ? "" : dif < -0.005 ? " comp__card--bajo" : dif > 0.005 ? " comp__card--alto" : "";
      return '<div class="comp__card' + clase + '">' +
        '<p class="comp__marca">' + esc(d.marca) + "</p>" +
        '<p class="comp__precio">' + money(d.avg) + "</p>" +
        '<p class="comp__pie">' + d.n.toLocaleString("es-MX") + (d.n > 1 ? " estaciones" : " estación") +
          (dif === null ? "" : " · " + (dif >= 0 ? "+" : "−") + Math.abs(dif).toFixed(2) + " vs. zona") +
        "</p></div>";
    }).join("");

    if (nota) {
      nota.textContent = "Promedio de " + PRODUCTS[p].label + " por marca · " +
        (refZona ? "comparado contra el promedio de la zona filtrada" : "comparado contra el promedio nacional del periodo") +
        (ref ? " (" + money(ref.avg) + ")" : "");
    }
  }

  /* ---------------------------------------------------------
     9 quater. Reporte estilo "Quién es Quién en los Precios"

     Nota metodológica: Profeco publica el margen de ganancia con estimaciones
     de la SENER (precio de referencia en TAR, IEPS y estímulos) que no vienen
     en las publicaciones de la CNE. Aquí el "margen" se sustituye por el
     DIFERENCIAL contra el precio más bajo del periodo en el mismo ámbito, que
     es medible con los datos disponibles y se etiqueta como tal.
     --------------------------------------------------------- */

  var profVista = "marcas";

  function renderProfeco(rows) {
    var prod = state.product;
    $("profecoSub").textContent = profVista === "marcas"
      ? "Precio promedio y diferencial por marca · " + PRODUCTS[prod].label +
        " · " + (state.period ? fmtPeriod(state.period) : "todos los periodos")
      : "Extremos y dispersión en las 8 regiones de la Política Pública de Almacenamiento Mínimo · " +
        PRODUCTS[prod].label;

    if (profVista === "marcas") renderMarcasChart(rows);
    else renderRegiones(rows);
  }

  function renderMarcasChart(rows) {
    destroy("marcas");
    var el = $("emptyMarcas"), prod = state.product;
    var grupos = {};
    rows.forEach(function (r) {
      if (!r._marca || r[prod] === null) return;
      (grupos[r._marca] = grupos[r._marca] || []).push(r[prod]);
    });
    var lista = Object.keys(grupos).map(function (k) {
      var v = grupos[k].slice().sort(function (a, b) { return a - b; });
      return { marca: k, avg: avg(v), min: v[0], n: v.length };
    }).sort(function (a, b) { return b.avg - a.avg; });

    if (lista.length < 2) {
      el.hidden = false;
      el.textContent = "Se necesitan al menos dos marcas reconocidas en la selección. " +
        "El padrón publica la razón social, no la bandera: llena la columna Marca del catálogo para ampliar la cobertura.";
      return;
    }
    el.hidden = true;

    var base = Math.min.apply(null, lista.map(function (d) { return d.min; }));
    var t = chartTheme(), opts = baseOptions(t);
    opts.scales.x.stacked = false;
    opts.scales.y.beginAtZero = false;
    opts.plugins.tooltip.callbacks.label = function (ctx) {
      var d = lista[ctx.dataIndex];
      return ctx.datasetIndex === 0
        ? "Promedio $" + d.avg.toFixed(2) + " · " + d.n.toLocaleString("es-MX") + " estaciones"
        : "Diferencial vs. el más bajo del periodo: $" + (d.avg - base).toFixed(2);
    };

    charts.marcas = new Chart($("chartMarcas"), {
      type: "bar",
      data: {
        labels: lista.map(function (d) { return d.marca; }),
        datasets: [
          { label: "Precio promedio", data: lista.map(function (d) { return +d.avg.toFixed(2); }),
            backgroundColor: t[state.product], borderRadius: 4 },
          { label: "Diferencial vs. mínimo del periodo",
            data: lista.map(function (d) { return +(d.avg - base).toFixed(2); }),
            backgroundColor: t.muted, borderRadius: 4 }
        ]
      },
      options: opts
    });
  }

  function renderRegiones(rows) {
    var prod = state.product;
    var grupos = {};
    rows.forEach(function (r) {
      if (!r.region || r[prod] === null) return;
      (grupos[r.region] = grupos[r.region] || []).push(r);
    });

    var ordenRegiones = ["Noroeste", "Norte", "Noreste", "Occidente", "Centro", "Golfo", "Sur", "Sureste"];
    var altos = [], bajos = [], resumen = [];

    ordenRegiones.forEach(function (reg) {
      var lista = grupos[reg];
      if (!lista || !lista.length) return;
      var ord = lista.slice().sort(function (a, b) { return a[prod] - b[prod]; });
      var precios = ord.map(function (x) { return x[prod]; });
      var media = avg(precios);
      resumen.push({ reg: reg, n: ord.length, avg: media, min: precios[0],
                     max: precios[precios.length - 1] });
      altos.push({ reg: reg, r: ord[ord.length - 1], avg: media });
      bajos.push({ reg: reg, r: ord[0], avg: media });
    });

    var pinta = function (destino, datos, clase) {
      $(destino).innerHTML = datos.length ? datos.map(function (d) {
        var dif = d.r[prod] - d.avg;
        return "<tr><td>" + esc(d.reg) + "</td>" +
          '<td><div class="cell-station">' + esc(d.r.estacion || d.r.permiso) + "</div>" +
            '<div class="cell-addr">' + esc(d.r.permiso) + "</div></td>" +
          "<td>" + esc(d.r.estado || "—") + "</td>" +
          '<td class="is-num">' + money(d.r[prod]) + "</td>" +
          '<td class="is-num"><span class="spread ' + clase + '">' +
            (dif >= 0 ? "+" : "−") + Math.abs(dif).toFixed(2) + "</span></td></tr>";
      }).join("") : '<tr><td colspan="5" class="na">Sin datos regionales en la selección.</td></tr>';
    };

    pinta("regAltos", altos, "spread--alto");
    pinta("regBajos", bajos, "spread--bajo");

    $("regResumen").innerHTML = resumen.length ? resumen.map(function (d) {
      return "<tr><td>" + esc(d.reg) + "</td>" +
        '<td class="is-num">' + d.n.toLocaleString("es-MX") + "</td>" +
        '<td class="is-num">' + money(d.avg) + "</td>" +
        '<td class="is-num">' + money(d.min) + "</td>" +
        '<td class="is-num">' + money(d.max) + "</td>" +
        '<td class="is-num">' + money(d.max - d.min) + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="na">La selección no incluye estaciones con región asignada.</td></tr>';
  }

  /* ---------------------------------------------------------
     9 ter. Gestor de mis estaciones (modal) y resumen multiestación
     --------------------------------------------------------- */

  function filaPorPermiso(permiso) {
    var k = permitKey(permiso);
    var enc = periodRows().filter(function (r) { return permitKey(r.permiso) === k; });
    return enc[0] || null;
  }

  function abrirGestor() {
    $("mineModal").hidden = false;
    pintarGestor();
    setTimeout(function () { $("mineSearch").focus(); }, 30);
  }

  function cerrarGestor() {
    $("mineModal").hidden = true;
    $("mineSearch").value = "";
  }

  function pintarGestor() {
    var chips = $("mineChips"), res = $("mineResults"), hint = $("mineModalHint");

    chips.innerHTML = misPermisos.length
      ? misPermisos.map(function (k) {
          var r = filaPorPermiso(k);
          return '<span class="chip-sel"><span>' + esc(r ? (r.estacion || k) : k) +
                 (r && r.estado ? ' · <span class="chip-sel__sub">' + esc(r.estado) + "</span>" : "") +
                 '</span><button type="button" data-quitar="' + esc(k) + '" aria-label="Quitar">✕</button></span>';
        }).join("")
      : '<p class="modal__vacio">Aún no eliges ninguna. Busca por permiso CRE o razón social.</p>';

    hint.textContent = misPermisos.length + " de " + MIS_MAX + " seleccionadas";

    var q = slug($("mineSearch").value || "");
    if (!q) {
      res.innerHTML = '<p class="modal__vacio">Escribe al menos tres caracteres para buscar entre las ' +
        periodRows().length.toLocaleString("es-MX") + " estaciones del padrón.</p>";
      return;
    }
    var hallados = periodRows().filter(function (r) { return (r._s || "").indexOf(q) > -1; });
    if (!hallados.length) {
      res.innerHTML = '<p class="modal__vacio">Sin coincidencias.</p>';
      return;
    }
    res.innerHTML = hallados.slice(0, 40).map(function (r) {
      var k = permitKey(r.permiso);
      var puesto = misPermisos.indexOf(k) > -1;
      return '<button class="res" type="button" data-agregar="' + esc(k) + '"' + (puesto ? " disabled" : "") + '>' +
        '<span class="res__nombre">' + esc(r.estacion || r.permiso) + "</span>" +
        '<span class="res__meta">' + esc(r.permiso) + (r.estado ? " · " + esc(r.estado) : "") +
          (r.regular !== null ? " · Regular " + money(r.regular) : "") + "</span>" +
        '<span class="res__accion">' + (puesto ? "Ya está" : "Agregar") + "</span></button>";
    }).join("") +
      (hallados.length > 40 ? '<p class="modal__vacio">' + hallados.length.toLocaleString("es-MX") +
        " coincidencias; se muestran las primeras 40.</p>" : "");
  }

  function agregarMia(k) {
    if (misPermisos.length >= MIS_MAX || misPermisos.indexOf(k) > -1) return;
    misPermisos.push(k);
    guardarMisPermisos();
    refrescarPropias();
    pintarGestor();
    buildControls();
    state.page = 1;          // el set filtrado cambió: evita quedar en una página vacía
    render();
  }

  function quitarMia(k) {
    var i = misPermisos.indexOf(k);
    if (i === -1) return;
    misPermisos.splice(i, 1);
    guardarMisPermisos();
    refrescarPropias();
    pintarGestor();
    buildControls();
    state.page = 1;
    render();
  }

  /* Resumen comparativo: precio, radio, diferencial y lugar de cada estación. */
  function renderMisEstaciones() {
    var panel = $("minePanel"), cuerpo = $("mineBody");
    if (!panel) return;
    var prod = state.product;
    var filas = misPermisos.map(filaPorPermiso).filter(Boolean);

    if (!state.onlyMine || !filas.length) { panel.hidden = true; return; }
    panel.hidden = false;

    $("mineSub").textContent = "Precio de " + PRODUCTS[prod].label +
      ", diferencial y lugar dentro de su mercado local · " + fmtPeriod(state.period);

    cuerpo.innerHTML = filas.map(function (r) {
      if (r[prod] === null) {
        return "<tr><td>" + esc(r.estacion || r.permiso) +
          '<div class="cell-addr">' + esc(r.permiso) + "</div></td>" +
          '<td class="is-num na" colspan="6">Sin ' + PRODUCTS[prod].label + " en el periodo</td></tr>";
      }
      var uni = universoLocal(r, prod);
      var ref = uni.ref;
      var precios = uni.rows.map(function (x) { return x[prod]; });
      var otros = precios.slice();
      var i = otros.indexOf(r[prod]);
      if (i > -1) otros.splice(i, 1);
      var pos = lugar(r[prod], otros);
      var dif = ref ? r[prod] - ref.avg : null;
      var clase = dif === null ? "spread--par" : dif < -0.005 ? "spread--bajo" : dif > 0.005 ? "spread--alto" : "spread--par";
      var lectura = dif === null ? "—"
        : dif < -0.005 ? "Por debajo del mercado" : dif > 0.005 ? "Por encima del mercado" : "En el promedio";

      return "<tr>" +
        "<td><div class=\"cell-station\">" + esc(r.estacion || r.permiso) + "</div>" +
          '<div class="cell-addr">' + esc(r.permiso) + (r.estado ? " · " + esc(r.estado) : "") + "</div></td>" +
        '<td class="is-num">' + money(r[prod]) + "</td>" +
        '<td class="is-num">' + (ref ? money(ref.avg) : "—") + "</td>" +
        '<td class="is-num"><span class="spread ' + clase + '">' +
          (dif === null ? "—" : (dif > 0 ? "+" : dif < 0 ? "−" : "") + Math.abs(dif).toFixed(2)) + "</span></td>" +
        '<td class="is-num">' + pos + " de " + (otros.length + 1) + "</td>" +
        '<td class="is-num">' + otros.length.toLocaleString("es-MX") + "</td>" +
        "<td>" + lectura + (ref ? ' <span class="cell-addr">' + esc(ref.etiqueta) + "</span>" : "") + "</td>" +
      "</tr>";
    }).join("");
  }

  /* ---------------------------------------------------------
     10 bis. Simulador táctico de precios
     --------------------------------------------------------- */

  var sim = { permiso: "", precio: null, busqueda: "" };

  /* Universo con el que compite la estación: su municipio si hay referencia,
     si no su estado y en último caso el país. */
  function universoLocal(r, prod) {
    var ref = referenciaLocal(r, prod);
    if (!ref) return { rows: [], ref: null };
    if (ref.alcance === "radio" && ref.rows) return { rows: ref.rows, ref: ref };
    var base = periodRows().filter(function (x) { return x[prod] !== null; });
    if (ref.alcance === "municipio") {
      base = base.filter(function (x) { return x.estado === r.estado && x.municipio === r.municipio; });
    } else if (ref.alcance === "estado") {
      base = base.filter(function (x) { return x.estado === r.estado; });
    }
    return { rows: base, ref: ref };
  }

  function lugar(precio, precios) {
    var n = 0;
    for (var i = 0; i < precios.length; i++) if (precios[i] < precio - 0.0001) n++;
    return n + 1;
  }

  /* Cualquier estación del inventario es simulable. El cuadro de búsqueda
     filtra por permiso CRE, razón social, municipio o dirección; sin búsqueda
     se listan primero las propias. */
  var SIM_MAX = 200;

  function candidatasSimulador() {
    var base = periodRows();
    var q = slug(sim.busqueda || "");
    var propias = base.filter(function (r) { return r._own; });

    if (q) {
      var hallados = base.filter(function (r) { return (r._s || "").indexOf(q) > -1; });
      // Las propias siempre encabezan la lista, aunque la búsqueda traiga más.
      hallados.sort(function (a, b) { return (b._own ? 1 : 0) - (a._own ? 1 : 0); });
      return { rows: hallados.slice(0, SIM_MAX), total: hallados.length, filtrado: true, propias: false };
    }
    if (propias.length) {
      var resto = base.filter(function (r) { return !r._own; }).slice(0, SIM_MAX - propias.length);
      return { rows: propias.concat(resto), total: propias.length, filtrado: false, propias: true };
    }
    return { rows: base.slice(0, SIM_MAX), total: base.length, filtrado: false, propias: false };
  }

  function renderSimulador() {
    var selec = $("simStation"), salida = $("simResult"), pista = $("simHint");
    if (!selec || !salida) return;

    var cand = candidatasSimulador();
    var previo = sim.permiso;
    selec.innerHTML = "";

    if (!cand.rows.length) {
      selec.appendChild(new Option("Sin coincidencias", ""));
      selec.disabled = true;
      $("simPrice").disabled = true;
      salida.innerHTML = '<p class="sim__empty">La búsqueda no encontró estaciones. Prueba con el permiso CRE ' +
        '(por ejemplo <code>PL/9998</code>), la razón social o el municipio.</p>';
      if (pista) pista.textContent = "";
      return;
    }

    selec.disabled = false;
    $("simPrice").disabled = false;
    cand.rows.forEach(function (r) {
      var donde = r.municipio ? " · " + r.municipio : r.estado ? " · " + r.estado : " · sin ubicación";
      selec.appendChild(new Option((r.estacion || r.permiso) + donde + (r._own ? " ★" : ""), r.permiso));
    });

    if (pista) {
      pista.textContent = cand.filtrado
        ? cand.total.toLocaleString("es-MX") + " coincidencia(s)" + (cand.total > SIM_MAX ? " · se listan las primeras " + SIM_MAX : "")
        : cand.propias
          ? cand.total + " estación(es) propia(s) · escribe arriba para buscar cualquier otra"
          : "Se listan las primeras " + Math.min(SIM_MAX, cand.total).toLocaleString("es-MX") +
            " de " + cand.total.toLocaleString("es-MX") + " · escribe arriba para buscar una en particular";
    }

    if (previo && cand.rows.some(function (r) { return r.permiso === previo; })) selec.value = previo;
    else { sim.permiso = cand.rows[0].permiso; sim.precio = null; selec.value = sim.permiso; }

    calcularSimulacion(!cand.propias);
  }

  function filaSim() {
    var p = sim.permiso;
    var enc = state.rows.filter(function (r) { return r.permiso === p && (!state.period || r.fecha === state.period); });
    return enc[0] || null;
  }

  function calcularSimulacion(avisoAjeno) {
    var salida = $("simResult");
    var r = filaSim();
    var prod = state.product;
    if (!r) { salida.innerHTML = '<p class="sim__empty">Selecciona una estación.</p>'; return; }

    if (r[prod] === null) {
      salida.innerHTML = '<p class="sim__empty">Esta estación no reporta ' + PRODUCTS[prod].label +
        ' en el periodo. Cambia de producto en los controles superiores o elige otra estación.</p>';
      $("simPrice").value = "";
      return;
    }

    var actual = r[prod];
    if (sim.precio === null || !isFinite(sim.precio)) sim.precio = actual;
    $("simPrice").value = sim.precio.toFixed(2);

    var uni = universoLocal(r, prod);
    var precios = uni.rows.map(function (x) { return x[prod]; }).sort(function (a, b) { return a - b; });
    var total = precios.length;
    var otros = precios.slice();
    var i = otros.indexOf(actual);
    if (i > -1) otros.splice(i, 1);          // la propia estación no compite consigo misma

    var lugarActual = lugar(actual, otros);
    var lugarSim = lugar(sim.precio, otros);
    var barata = otros.length ? Math.min.apply(null, otros) : actual;
    var promedio = uni.ref ? uni.ref.avg : actual;
    // Frase preposicional lista para insertar: "del país", "de Jalisco", "de Zapopan".
    var ambito = !uni.ref ? "de la zona"
               : uni.ref.alcance === "nacional" ? "del país"
               : uni.ref.alcance === "radio" ? "en " + uni.ref.etiqueta
               : "de " + uni.ref.etiqueta;

    var delta = sim.precio - actual;
    var movimiento;
    if (lugarSim === lugarActual) {
      movimiento = "Conservarías el lugar <strong>" + lugarActual + "</strong> de " +
                   total.toLocaleString("es-MX") + " " + esc(ambito) + ".";
    } else if (lugarSim < lugarActual) {
      movimiento = "Pasarías del lugar <strong>" + lugarActual + "</strong> al <strong>" + lugarSim +
                   "</strong> más económico " + esc(ambito) + ".";
    } else {
      movimiento = "Caerías del lugar <strong>" + lugarActual + "</strong> al <strong>" + lugarSim +
                   "</strong> de " + total.toLocaleString("es-MX") + " " + esc(ambito) + ".";
    }

    var vsBarata = sim.precio - barata;
    var vsProm = sim.precio - promedio;
    var ambitoTexto = !uni.ref ? "la zona"
                    : uni.ref.alcance === "radio" ? uni.ref.etiqueta
                    : uni.ref.alcance === "municipio" ? "el municipio de " + uni.ref.etiqueta
                    : uni.ref.alcance === "estado" ? "el estado de " + uni.ref.etiqueta
                    : "todo el país";

    salida.innerHTML =
      '<p class="sim__verdict">' + movimiento + "</p>" +
      '<div class="sim__grid">' +
        tarjeta("Precio actual", money(actual), PRODUCTS[prod].label + " · " + (r.estacion || r.permiso)) +
        tarjeta("Precio simulado", money(sim.precio),
                (delta === 0 ? "sin cambio" : (delta > 0 ? "+" : "−") + Math.abs(delta).toFixed(2) + " respecto al actual"),
                delta > 0 ? "alto" : delta < 0 ? "bajo" : "") +
        tarjeta("Contra la más barata", (vsBarata >= 0 ? "+" : "−") + Math.abs(vsBarata).toFixed(2),
                "la más económica " + ambito + " está en " + money(barata),
                vsBarata > 0 ? "alto" : "bajo") +
        tarjeta("Contra el promedio", (vsProm >= 0 ? "+" : "−") + Math.abs(vsProm).toFixed(2),
                "promedio de " + ambitoTexto + " " + money(promedio) +
                " · " + total.toLocaleString("es-MX") + " estaciones",
                vsProm > 0 ? "alto" : "bajo") +
        tarjeta("Margen proyectado", (delta >= 0 ? "+" : "−") + Math.abs(delta).toFixed(2) + " $/L",
                delta === 0 ? "sin cambio respecto al precio actual"
                            : (delta > 0 ? "ganas" : "cedes") + " " + Math.abs(delta).toFixed(2) +
                              " por litro vendido frente al precio de hoy",
                delta > 0 ? "alto" : delta < 0 ? "bajo" : "") +
      "</div>" +
      (uni.ref && uni.ref.alcance !== "municipio" && uni.ref.alcance !== "radio"
        ? '<p class="sim__nota">Esta estación no tiene competidores identificados en su municipio, así que ' +
          "el ranking se calcula contra " +
          (uni.ref.alcance === "estado" ? "todo el estado de " + esc(uni.ref.etiqueta) : "el padrón nacional") +
          ". Es una referencia más amplia que su mercado real: captura Estado y Municipio en el catálogo para afinarla.</p>"
        : "") +
      (avisoAjeno ? '<p class="sim__nota">Esta estación no está declarada como propia (las tuyas aparecen con ★). ' +
        'Captura tus permisos CRE en <code>MIS_ESTACIONES</code> dentro de <code>config.js</code> para que el ' +
        'simulador abra directamente con ellas.</p>' : "");

    function tarjeta(titulo, valor, pie, tono) {
      return '<div class="sim__card' + (tono ? " sim__card--" + tono : "") + '">' +
             '<p class="sim__card-label">' + titulo + "</p>" +
             '<p class="sim__card-value">' + valor + "</p>" +
             '<p class="sim__card-foot">' + esc(pie) + "</p></div>";
    }
  }

  /* ---------------------------------------------------------
     10 ter. Exportación de la vista filtrada
     --------------------------------------------------------- */

  function exportarCsv() {
    var prod = state.product;
    var filas = tableRows(scoped());
    if (!filas.length) return;

    var cab = ["Fecha", "Permiso CRE", "Estacion", "Marca", "Municipio", "Estado", "Origen ubicacion",
               "Direccion", "Regular", "Premium", "Diesel",
               "Producto analizado", "Promedio local", "Alcance del promedio",
               "Diferencial vs promedio local", "Posicion comercial", "Sucursal propia"];

    var lineas = [cab.join(",")];
    filas.forEach(function (r) {
      var sp = spreadDe(r, prod);
      var pos = !sp ? "" : sp.valor < -0.005 ? "Por debajo del promedio local"
                        : sp.valor > 0.005 ? "Por encima del promedio local" : "En el promedio local";
      lineas.push([
        r.fecha, r.permiso, r.estacion, r.marca || r._marca, r.municipio, r.estado,
        r.estado ? (r.asignado ? "Asignado por omisión" : r.inferido ? "Inferido del domicilio" : "Catálogo") : "",
        r.direccion,
        r.regular === null ? "" : r.regular.toFixed(2),
        r.premium === null ? "" : r.premium.toFixed(2),
        r.diesel === null ? "" : r.diesel.toFixed(2),
        PRODUCTS[prod].label,
        sp ? sp.ref.avg.toFixed(4) : "",
        sp ? sp.ref.alcance + (sp.ref.alcance === "nacional" ? "" : " " + sp.ref.etiqueta) : "",
        sp ? sp.valor.toFixed(2) : "",
        pos,
        r._own ? "Sí" : "No"
      ].map(csvCampo).join(","));
    });

    var nombre = "lbgas23_" + prod + "_" +
                 (state.period || "periodo") +
                 (state.municipio ? "_" + slug(state.municipio) : state.estado ? "_" + slug(state.estado) : "") +
                 (state.onlyMine ? "_mis-estaciones" : "") + ".csv";

    // El BOM hace que Excel respete los acentos al abrir el archivo.
    var blob = new Blob(["\ufeff" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function csvCampo(v) {
    var s = String(v === null || v === undefined ? "" : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* ---------------------------------------------------------
     11. Tooltips
     --------------------------------------------------------- */

  function initTooltip() {
    var tip = $("tooltip");
    document.addEventListener("mouseover", function (e) {
      var t = e.target.closest("[data-tip], [data-tip-title]");
      if (!t) return;
      var title = t.getAttribute("data-tip-title");
      var body = t.getAttribute("data-tip-body") || CFG.METODOLOGIA || "";
      tip.innerHTML = (title ? "<strong>" + esc(title) + "</strong>" : "") +
        esc(body).replace(/\n/g, "<br>");
      tip.hidden = false;
      place(e);
    });
    document.addEventListener("mousemove", function (e) { if (!tip.hidden) place(e); });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest("[data-tip], [data-tip-title]")) tip.hidden = true;
    });
    function place(e) {
      var pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
      var x = Math.min(e.clientX + pad, window.innerWidth - w - 8);
      var y = e.clientY - h - pad;
      if (y < 8) y = e.clientY + pad;
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    }
  }

  /* ---------------------------------------------------------
     12. Eventos
     --------------------------------------------------------- */

  function initEvents() {
    // Solo los segmentos de producto: el reporte Profeco usa otros con data-prof.
    document.querySelectorAll(".seg[data-product]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".seg[data-product]").forEach(function (b) {
          b.classList.remove("is-active"); b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active"); btn.setAttribute("aria-selected", "true");
        state.product = btn.getAttribute("data-product");
        if (["regular", "premium", "diesel"].indexOf(state.sortKey) > -1) state.sortKey = state.product;
        sim.precio = null;
        state.page = 1;
        render();
      });
    });

    $("periodSelect").addEventListener("change", function () { state.period = this.value; state.page = 1; sim.precio = null; render(); });

    $("estadoSelect").addEventListener("change", function () {
      state.estado = this.value;
      state.municipio = "";
      buildMunicipioSelect();
      state.page = 1;
      render();
    });

    $("municipioSelect").addEventListener("change", function () {
      state.municipio = this.value; state.page = 1; render();
    });

    $("mineToggle").addEventListener("click", function () {
      // Sin estaciones elegidas el interruptor no tiene nada que aislar:
      // se abre el gestor en lugar de dejar al usuario sin respuesta.
      if (!state.rows.some(function (r) { return r._own; })) { abrirGestor(); return; }
      setMine(!state.onlyMine); state.page = 1; render();
    });

    $("exportBtn").addEventListener("click", exportarCsv);

    $("manageBtn").addEventListener("click", abrirGestor);
    $("mineModal").addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) { cerrarGestor(); return; }
      var add = e.target.closest("[data-agregar]");
      if (add) { agregarMia(add.getAttribute("data-agregar")); return; }
      var quita = e.target.closest("[data-quitar]");
      if (quita) quitarMia(quita.getAttribute("data-quitar"));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("mineModal").hidden) cerrarGestor();
    });

    var tGestor = null;
    $("mineSearch").addEventListener("input", function () {
      clearTimeout(tGestor);
      tGestor = setTimeout(pintarGestor, CFG.SEARCH_DEBOUNCE_MS === undefined ? 180 : CFG.SEARCH_DEBOUNCE_MS);
    });

    document.querySelectorAll("[data-prof]").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("[data-prof]").forEach(function (o) { o.classList.remove("is-active"); });
        b.classList.add("is-active");
        profVista = b.getAttribute("data-prof");
        $("profMarcas").hidden = profVista !== "marcas";
        $("profRegiones").hidden = profVista !== "regiones";
        renderProfeco(scoped());
      });
    });

    $("simStation").addEventListener("change", function () {
      sim.permiso = this.value; sim.precio = null; calcularSimulacion();
    });

    var tSim = null;
    $("simSearch").addEventListener("input", function () {
      var v = this.value;
      clearTimeout(tSim);
      tSim = setTimeout(function () {
        sim.busqueda = v; sim.permiso = ""; sim.precio = null; renderSimulador();
      }, CFG.SEARCH_DEBOUNCE_MS === undefined ? 180 : CFG.SEARCH_DEBOUNCE_MS);
    });

    $("simPrice").addEventListener("input", function () {
      var v = parseFloat(this.value);
      sim.precio = isFinite(v) ? v : null;
      if (sim.precio !== null) calcularSimulacion();
    });

    document.querySelectorAll(".sim__steps [data-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        var base = sim.precio;
        if (base === null || !isFinite(base)) {
          var r = filaSim();
          base = r ? r[state.product] : null;
        }
        if (base === null) return;
        sim.precio = Math.max(0, Math.round((base + parseFloat(this.getAttribute("data-step"))) * 100) / 100);
        calcularSimulacion();
      });
    });

    $("simReset").addEventListener("click", function () { sim.precio = null; calcularSimulacion(); });
    $("refreshBtn").addEventListener("click", function () { load(true); });
    $("onlyProduct").addEventListener("change", function () { state.page = 1; render(); });

    var timer = null;
    $("search").addEventListener("input", function () {
      var v = this.value;
      clearTimeout(timer);
      timer = setTimeout(function () { state.search = v; state.page = 1; render(); },
                         CFG.SEARCH_DEBOUNCE_MS === undefined ? 180 : CFG.SEARCH_DEBOUNCE_MS);
    });

    $("prevPage").addEventListener("click", function () { if (state.page > 1) { state.page--; render(); } });
    $("nextPage").addEventListener("click", function () { state.page++; render(); });

    document.querySelectorAll("th.is-sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-sort");
        if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else { state.sortKey = key; state.sortDir = "asc"; }
        document.querySelectorAll("th.is-sortable").forEach(function (o) { o.removeAttribute("data-dir"); });
        th.setAttribute("data-dir", state.sortDir);
        state.page = 1;
        render();
      });
    });

    $("themeBtn").addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      if (state.rows.length) render();
    });

    window.addEventListener("resize", function () {
      clearTimeout(window.__rz);
      window.__rz = setTimeout(function () { if (state.rows.length) renderRail(scoped()); }, 200);
    });
  }

  /* ---------------------------------------------------------
     13. Arranque
     --------------------------------------------------------- */

  function init() {
    var logo = $("brandLogo");
    if (logo) {
      if (CFG.LOGO_URL && CFG.LOGO_URL.trim()) logo.src = CFG.LOGO_URL.trim();
      else logo.remove();
      logo.addEventListener("error", function () {
        this.remove();
        var regla = document.querySelector(".brand__rule");
        if (regla) regla.remove();
      });
    }
    if (CFG.TITLE) { document.title = CFG.TITLE; $("appTitle").textContent = CFG.TITLE; }
    if (CFG.SUBTITLE) $("appSubtitle").textContent = CFG.SUBTITLE;
    $("footerMethod").textContent = CFG.METODOLOGIA || "";
    if (CFG.REPO_URL) $("repoLink").href = CFG.REPO_URL;
    if (CFG.BENCHMARK && CFG.BENCHMARK.label) $("railBenchChip").textContent = CFG.BENCHMARK.label;

    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved) document.documentElement.setAttribute("data-theme", saved);
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches)
        document.documentElement.setAttribute("data-theme", "light");
    } catch (e) {}

    document.body.setAttribute("data-product", state.product);
    cargarMisPermisos();
    setMine(false);
    initEvents();
    initTooltip();

    var cached = readCache();
    if (cached) {
      state.rows = cached.rows;
      state.updatedAt = new Date(cached.at);
      state.origin = cached.origin + " (copia guardada)";
      buildControls();
      render();
      setStatus("loading", "Actualizando", fmtDateTime(state.updatedAt));
    }

    load(false);

    var mins = Number(CFG.REFRESH_MINUTES);
    if (mins > 0) setInterval(function () { if (!document.hidden) load(false); }, mins * 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
