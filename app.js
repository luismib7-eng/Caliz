/* =============================================================
   Monitor de Precios de Combustibles
   Carga · normalización · KPIs · gráficos · explorador
   ============================================================= */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var CACHE_KEY = "combustibles:datos";
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
    region: "",
    search: "",
    sortKey: "regular",
    sortDir: "asc",
    page: 1,
    dimension: null,     // Región / Estado / Municipio / Marca / Razón social
    updatedAt: null,
    origin: ""
  };

  var charts = { trend: null, compare: null, hist: null };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------------------------------------
     1. Utilidades
     --------------------------------------------------------- */

  function slug(s) {
    return String(s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function toNumber(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim();
    if (!s || /^(n\/?a|nd|s\/?d|-|—)$/i.test(s)) return null;
    var m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    var n = parseFloat(m[0]);
    if (!isFinite(n) || n <= 0) return null;
    var lo = CFG.PRICE_MIN === undefined ? 5 : CFG.PRICE_MIN;
    var hi = CFG.PRICE_MAX === undefined ? 60 : CFG.PRICE_MAX;
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
      var get = function (k) { return map[k] ? String(r[map[k]] === undefined ? "" : r[map[k]]).trim() : ""; };
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
        margen: toNumber(get("margen"))
      }));
    });
    return dedupe(out);
  }

  /* Texto precalculado para que la búsqueda no recorra objetos en cada tecla. */
  function indexRow(r) {
    r._s = slug([r.estacion, r.permiso, r.direccion, r.municipio, r.estado, r.region, r.marca].join(" "));
    return r;
  }

  /* Un permiso repetido en el mismo periodo conserva el primer registro y solo
     completa los productos que le falten. */
  function dedupe(rows) {
    var byKey = {}, out = [];
    rows.forEach(function (r) {
      var key = (r.permiso || r.estacion) + "|" + r.fecha;
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
        regular: null, premium: null, diesel: null, tipodiesel: "", margen: null
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
      var c = r.permiso && catalog[r.permiso];
      if (!c) return;
      quality.catalogo++;
      ["region", "estado", "municipio", "marca", "estacion", "direccion"].forEach(function (k) {
        if (!r[k] && c[k]) r[k] = c[k];
      });
      indexRow(r);
    });
    return rows;
  }

  function buildCatalog(text) {
    var parsed = parseCsv(text);
    var rows = normalize(parsed.rows, parsed.fields);
    var idx = {};
    rows.forEach(function (r) { if (r.permiso) idx[r.permiso] = r; });
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

  function resolveSource() {
    if (CFG.SHEET_CSV_URL && CFG.SHEET_CSV_URL.trim())
      return { url: CFG.SHEET_CSV_URL.trim(), kind: "csv", origin: "Google Sheets" };
    if (CFG.XML_URL && CFG.XML_URL.trim())
      return { url: CFG.XML_URL.trim(), kind: "xml", origin: "XML oficial CNE" };
    var f = CFG.FALLBACK_CSV || "";
    return { url: f, kind: /\.xml($|\?)/i.test(f) ? "xml" : "csv", origin: "archivo local" };
  }

  function parseSource(text, kind) {
    var looksXml = text.replace(/^\uFEFF/, "").trim().charAt(0) === "<";
    if (kind === "xml" || looksXml) return parseXmlPrecios(text);
    var parsed = parseCsv(text);
    return normalize(parsed.rows, parsed.fields);
  }

  function load(manual) {
    var src = resolveSource();
    var btn = $("refreshBtn");

    setStatus("loading", "Cargando", "");
    btn.classList.add("is-spinning");
    btn.disabled = true;

    var catalogUrl = CFG.CATALOG_CSV && CFG.CATALOG_CSV.trim();
    var jobs = [fetchText(src.url)];
    jobs.push(catalogUrl ? fetchText(catalogUrl).catch(function () { return null; }) : Promise.resolve(null));

    Promise.all(jobs)
      .then(function (res) {
        var catalog = null;
        if (res[1]) {
          try { catalog = buildCatalog(res[1]); } catch (e) { catalog = null; }
        }
        quality = { duplicados: 0, fueraRango: 0, catalogo: 0 };

        var rows = parseSource(res[0], src.kind);
        if (!rows.length) throw new Error("La fuente no contiene estaciones con precio.");
        applyCatalog(rows, catalog);

        state.rows = rows;
        state.updatedAt = new Date();
        state.origin = src.origin;
        saveCache(rows);
        setStatus("live", src.kind === "csv" && CFG.SHEET_CSV_URL ? "En vivo" : "Sincronizado", fmtDateTime(state.updatedAt));
        buildControls();
        render();
      })
      .catch(function (err) {
        var cached = readCache();
        if (cached) {
          state.rows = cached.rows;
          state.updatedAt = new Date(cached.at);
          state.origin = cached.origin + " (copia guardada)";
          buildControls();
          render();
          setStatus("error", "Sin conexión · datos guardados", fmtDateTime(state.updatedAt));
        } else {
          setStatus("error", "No se pudo cargar", "");
          showLoadError(src.url, err.message);
        }
      })
      .then(function () {
        btn.classList.remove("is-spinning");
        btn.disabled = false;
        if (manual) btn.blur();
      });
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

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return obj && obj.rows && obj.rows.length ? obj : null;
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

  function detectDimension() {
    var order = [
      { key: "region", label: "Región" },
      { key: "estado", label: "Estado" },
      { key: "municipio", label: "Municipio" },
      { key: "marca", label: "Marca" }
    ];
    for (var i = 0; i < order.length; i++) {
      var filled = state.rows.filter(function (r) { return r[order[i].key]; }).length;
      if (filled >= Math.max(3, state.rows.length * 0.5)) return order[i];
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
    var rsel = $("regionSelect");
    var keepRegion = state.region;
    if ($("regionLabel")) $("regionLabel").textContent = state.dimension.label;
    var vals = {}, list = [];
    if (state.dimension.key !== "estacion") {
      state.rows.forEach(function (r) { if (r[state.dimension.key]) vals[r[state.dimension.key]] = true; });
      list = Object.keys(vals).sort();
    }
    rsel.innerHTML = "";
    if (list.length > 1 && list.length <= 400) {
      rsel.appendChild(new Option("Todas", ""));
      list.forEach(function (v) { rsel.appendChild(new Option(v, v)); });
      rsel.disabled = false;
    } else {
      list = [];
      rsel.appendChild(new Option("Sin columna geográfica en la fuente", ""));
      rsel.disabled = true;
      if ($("regionLabel")) $("regionLabel").textContent = "Región / Estado";
    }
    state.region = (keepRegion && list.indexOf(keepRegion) > -1) ? keepRegion : "";
    rsel.value = state.region;

    var nota = [state.rows.length.toLocaleString("es-MX") + " estaciones", "origen: " + state.origin];
    if (ps.length) nota.push(ps.length + " periodo" + (ps.length > 1 ? "s" : ""));
    if (quality.catalogo) nota.push(quality.catalogo.toLocaleString("es-MX") + " con catálogo");
    if (quality.duplicados) nota.push(quality.duplicados + " permisos repetidos fusionados");
    if (quality.fueraRango) nota.push(quality.fueraRango + " precios fuera de rango descartados");
    $("datasetNote").textContent = nota.join(" · ");
  }

  /* ---------------------------------------------------------
     5. Selección de datos
     --------------------------------------------------------- */

  function scoped() {
    return state.rows.filter(function (r) {
      if (state.period && r.fecha !== state.period) return false;
      if (state.region && r[state.dimension.key] !== state.region) return false;
      return true;
    });
  }

  function pricesOf(rows, product) {
    return rows.map(function (r) { return r[product]; }).filter(function (v) { return v !== null; });
  }

  /* ---------------------------------------------------------
     6. KPIs
     --------------------------------------------------------- */

  function previousPeriodAvg(product) {
    var ps = periods();
    if (!state.period || ps.length < 2) return null;
    var idx = ps.indexOf(state.period);
    if (idx < 0 || idx + 1 >= ps.length) return null;
    var prev = ps[idx + 1];
    var rows = state.rows.filter(function (r) {
      return r.fecha === prev && (!state.region || r[state.dimension.key] === state.region);
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
        deltaEl.classList.add(d > 0 ? "is-up" : d < 0 ? "is-down" : "");
        deltaEl.textContent = (d > 0 ? "▲ +" : d < 0 ? "▼ " : "= ") + d.toFixed(2) +
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
    var ps = periods().slice().sort();
    var el = $("emptyTrend");
    destroy("trend");
    if (ps.length < 2) {
      el.hidden = false;
      el.textContent = "Un solo periodo cargado. Agrega filas con otras fechas en la hoja para ver la evolución de los precios.";
      return;
    }
    el.hidden = true;
    var t = chartTheme();
    var series = ["regular", "premium", "diesel"].map(function (p) {
      return {
        label: PRODUCTS[p].label,
        data: ps.map(function (f) {
          var rows = state.rows.filter(function (r) {
            return r.fecha === f && (!state.region || r[state.dimension.key] === state.region);
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
      data: { labels: ps.map(fmtPeriod), datasets: series },
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
    list.sort(function (a, b) {
      var va, vb;
      if (key === "ubicacion") { va = [a.municipio, a.estado, a.direccion].filter(Boolean).join(" "); vb = [b.municipio, b.estado, b.direccion].filter(Boolean).join(" "); }
      else { va = a[key]; vb = b[key]; }
      if (typeof va === "number" || typeof vb === "number") {
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        return (va - vb) * dir;
      }
      return String(va || "").localeCompare(String(vb || ""), "es") * dir;
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
      return "<tr>" +
        '<td><div class="cell-station">' + esc(r.estacion || r.permiso) + "</div>" +
          (r.marca ? '<div class="cell-addr">' + esc(r.marca) + "</div>" : "") + "</td>" +
        '<td><span class="cell-permit">' + (esc(r.permiso) || "—") + "</span></td>" +
        "<td>" + esc([r.municipio, r.estado, r.region].filter(Boolean).join(", ") || "—") +
          (r.direccion ? '<div class="cell-addr">' + esc(r.direccion) + "</div>" : "") + "</td>" +
        cell(r, "regular", lo, hi, p) + cell(r, "premium", lo, hi, p) + cell(r, "diesel", lo, hi, p) +
      "</tr>";
    }).join("");

    $("tbody").innerHTML = html;
    $("emptyTable").hidden = list.length > 0;
    if (!list.length) $("emptyTable").textContent = "Sin resultados. Ajusta la búsqueda o los filtros.";
    $("tableCount").textContent = list.length.toLocaleString("es-MX") + " estaciones listadas · " +
      (state.period ? fmtPeriod(state.period) : "todos los periodos") +
      (state.region ? " · " + state.region : "");
    $("pageInfo").textContent = "Página " + state.page + " de " + pages;
    $("prevPage").disabled = state.page <= 1;
    $("nextPage").disabled = state.page >= pages;

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
    var rows = scoped();
    renderKpis(rows);
    renderExtremes(rows);
    renderRail(rows);
    renderTrend();
    renderCompare(rows);
    renderHist(rows);
    renderTable(rows);
    $("footerUpdated").textContent = state.updatedAt
      ? "Actualizado " + fmtDateTime(state.updatedAt) + " · origen: " + state.origin
      : "";
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
    document.querySelectorAll(".seg").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".seg").forEach(function (b) {
          b.classList.remove("is-active"); b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active"); btn.setAttribute("aria-selected", "true");
        state.product = btn.getAttribute("data-product");
        if (["regular", "premium", "diesel"].indexOf(state.sortKey) > -1) state.sortKey = state.product;
        state.page = 1;
        render();
      });
    });

    $("periodSelect").addEventListener("change", function () { state.period = this.value; state.page = 1; render(); });
    $("regionSelect").addEventListener("change", function () { state.region = this.value; state.page = 1; render(); });
    $("refreshBtn").addEventListener("click", function () { load(true); });
    $("onlyProduct").addEventListener("change", function () { state.page = 1; render(); });

    var timer = null;
    $("search").addEventListener("input", function () {
      var v = this.value;
      clearTimeout(timer);
      timer = setTimeout(function () { state.search = v; state.page = 1; render(); }, 180);
    });

    $("prevPage").addEventListener("click", function () { if (state.page > 1) { state.page--; render(); } });
    $("nextPage").addEventListener("click", function () { state.page++; render(); });

    document.querySelectorAll("th.is-sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-sort");
        if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else { state.sortKey = key; state.sortDir = ["regular", "premium", "diesel"].indexOf(key) > -1 ? "asc" : "asc"; }
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
