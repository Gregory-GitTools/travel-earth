const el = (id) => document.getElementById(id);

// единый движок: глобус и плоская карта — это одна и та же карта MapLibre с
// projection 'globe', которая сама переходит в обычную проекцию при приближении
// (никакого отдельного "прыжка" глобус→карта, как в travel-globe)

// ---------- базовые карты ----------

// Варианты базовой карты для переключателя внизу слева; миниатюры icons/basemaps/<id>.jpg
// снимает tools/basemap-thumbnails.mjs. Все бесплатные и без ключа. Все векторные стили
// (CARTO и OpenFreeMap) построены на схеме OpenMapTiles — у каждой подписи есть name и
// name:xx на ~80 языках, поэтому язык подписей переключается одинаково на любой карте
const OPENMAPTILES_SOURCE = { type: "vector", url: "https://tiles.openfreemap.org/planet" };
const OPENFREEMAP_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const BASEMAPS = [
  { id: "satellite", name: "Спутник", hint: "Вид из космоса — спутниковые снимки Esri с подписями и границами", style: buildSatelliteStyle },
  { id: "liberty", name: "Яркая", hint: "OpenFreeMap Liberty", style: "https://tiles.openfreemap.org/styles/liberty" },
  { id: "bright", name: "Контрастная", hint: "OpenFreeMap Bright", style: "https://tiles.openfreemap.org/styles/bright" },
  { id: "positron", name: "Светлая", hint: "CARTO Positron", style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
  { id: "voyager", name: "Пастельная", hint: "CARTO Voyager", style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json" },
  { id: "dark", name: "Тёмная", hint: "CARTO Dark Matter", style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
];
const BASEMAP_STORAGE_KEY = "travel-earth.basemap";
// по умолчанию — Пастельная
const DEFAULT_BASEMAP = BASEMAPS.find((b) => b.id === "voyager");
let currentBasemap = BASEMAPS.find((b) => b.id === localStorage.getItem(BASEMAP_STORAGE_KEY)) || DEFAULT_BASEMAP;

// Спутник "как в Google": растровые снимки Esri + поверх них границы, крупные дороги и
// подписи из тех же векторных тайлов OpenFreeMap — белым текстом с тёмной обводкой
function buildSatelliteStyle() {
  const halo = { "text-color": "#fff", "text-halo-color": "rgba(0,0,0,0.75)", "text-halo-width": 1.4 };
  const placeLabel = (id, filter, font, size, minzoom, maxzoom) => ({
    id, type: "symbol", source: "openmaptiles", "source-layer": "place", filter, minzoom, maxzoom: maxzoom ?? 24,
    layout: { "text-field": ["get", "name"], "text-font": [font], "text-size": size, "text-max-width": 8 },
    paint: halo,
  });
  return {
    version: 8,
    glyphs: OPENFREEMAP_GLYPHS,
    sources: {
      esri: {
        type: "raster",
        // blankTile=false: где подробного снимка нет, Esri отдаёт 404 вместо картинки
        // "Map data not yet available" — и MapLibre растягивает последний настоящий снимок
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
      openmaptiles: OPENMAPTILES_SOURCE,
    },
    layers: [
      { id: "esri", type: "raster", source: "esri" },
      {
        id: "roads-major", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 6,
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
        paint: { "line-color": "#ffe9a6", "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 14, 3] },
      },
      {
        id: "roads-minor", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 12,
        filter: ["match", ["get", "class"], ["secondary", "tertiary", "minor"], true, false],
        paint: { "line-color": "#fff", "line-opacity": 0.35, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 2] },
      },
      {
        id: "boundary-state", type: "line", source: "openmaptiles", "source-layer": "boundary", minzoom: 4,
        filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": "#fff", "line-opacity": 0.35, "line-dasharray": [3, 2], "line-width": 0.8 },
      },
      {
        id: "boundary-country", type: "line", source: "openmaptiles", "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": "#fff", "line-opacity": 0.7, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 8, 1.6] },
      },
      {
        id: "road-names", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name", minzoom: 13,
        layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "symbol-placement": "line" },
        paint: halo,
      },
      {
        id: "water-names", type: "symbol", source: "openmaptiles", "source-layer": "water_name",
        filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
        layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 12, "text-max-width": 6 },
        paint: { ...halo, "text-color": "#cde8ff" },
      },
      placeLabel("place-village", ["==", ["get", "class"], "village"], "Noto Sans Regular", 11, 10),
      placeLabel("place-town", ["==", ["get", "class"], "town"], "Noto Sans Regular", 12, 7),
      placeLabel("place-city", ["==", ["get", "class"], "city"], "Noto Sans Bold", ["interpolate", ["linear"], ["zoom"], 4, 12, 10, 17], 3),
      placeLabel("place-country", ["==", ["get", "class"], "country"], "Noto Sans Bold", ["interpolate", ["linear"], ["zoom"], 1, 11, 6, 16], 0, 8),
    ],
  };
}

const resolveStyle = (b) => (typeof b.style === "function" ? b.style() : b.style);

const map = new maplibregl.Map({
  container: "map",
  style: resolveStyle(currentBasemap),
  center: [25, 45],
  zoom: 1.6,
  attributionControl: { compact: true },
});

// ---------- звёздное небо ----------

// Вокруг глобуса холст MapLibre прозрачный, и под ним виден холст #stars. Звёзды лежат
// на бесконечно большой небесной сфере вокруг Земли, и камера смотрит на них из той же
// точки, что и на глобус (центр карты, поворот, наклон). Поэтому небо вращается вместе
// с глобусом как одно целое: при вращении шара звёзды за ним плывут по сфере
const STAR_COUNT = 12000; // в кадр попадает примерно двадцатая часть неба
const MAP_FOV = 36.87; // угол обзора камеры MapLibre по вертикали (градусы)

const STAR_TINTS = ["255,255,255", "255,255,255", "190,210,255", "160,190,255", "255,240,200",
  "255,215,160", "255,180,140", "255,160,160"];

const stars = Array.from({ length: STAR_COUNT }, () => {
  // равномерно по сфере: z равномерно в [-1, 1], долгота равномерно
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  // большинство звёзд тусклые и мелкие, редкие — яркие; цвета как у настоящих звёзд:
  // от голубых до оранжевых и красноватых
  const bright = Math.random() ** 3;
  const tint = STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)];
  return { x: r * Math.cos(a), y: r * Math.sin(a), z, size: 0.8 + bright * 2.2, tint,
    alpha: 0.3 + bright * 0.7,
    // у каждой звезды своя скорость и фаза мерцания
    speed: 0.6 + Math.random() * 2.4, phase: Math.random() * Math.PI * 2 };
});

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const combine = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];

function drawStars() {
  const canvas = el("stars");
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // оси камеры в координатах Земли: камера висит над центром карты и смотрит сквозь Землю
  const rad = Math.PI / 180;
  const { lng, lat } = map.getCenter();
  const bearing = map.getBearing() * rad, pitch = map.getPitch() * rad;
  const lo = lng * rad, la = lat * rad;
  const center = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  let up = combine(north, Math.cos(bearing), east, Math.sin(bearing));
  const right = combine(east, Math.cos(bearing), north, -Math.sin(bearing));
  let forward = combine(center, -1, up, 0);
  // наклон карты поднимает взгляд от Земли к горизонту
  [forward, up] = [combine(forward, Math.cos(pitch), up, Math.sin(pitch)),
    combine(up, Math.cos(pitch), center, Math.sin(pitch))];

  const focal = h / 2 / Math.tan((MAP_FOV / 2) * rad);
  const t = performance.now() / 1000;
  for (const s of stars) {
    const v = [s.x, s.y, s.z];
    const depth = dot(v, forward);
    if (depth <= 0) continue; // звезда за спиной камеры
    const x = w / 2 + (focal * dot(v, right)) / depth;
    const y = h / 2 - (focal * dot(v, up)) / depth;
    if (x < -2 || y < -2 || x > w + 2 || y > h + 2) continue;
    // мерцание: яркость плавно колеблется от 40 до 100 %
    ctx.fillStyle = `rgba(${s.tint},${s.alpha * (0.7 + 0.3 * Math.sin(t * s.speed + s.phase))})`;
    ctx.beginPath();
    ctx.arc(x, y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// мерцание требует постоянной перерисовки — ~30 кадров в секунду достаточно для глаза;
// когда вкладка скрыта, requestAnimationFrame сам останавливается
let lastStarsFrame = 0;
function animateStars(now) {
  // пока карта движется — каждый кадр, чтобы небо не отставало от глобуса
  if (map.isMoving() || now - lastStarsFrame > 33) {
    lastStarsFrame = now;
    drawStars();
  }
  requestAnimationFrame(animateStars);
}
requestAnimationFrame(animateStars);

// ---------- язык подписей ----------

// "none" прячет все подписи с названиями (например, чтобы смотреть на чистый спутник),
// "local" — название на местном языке (тег name), остальное — тег name:xx, а если
// перевода нет, то местное название
const LANGUAGES = [
  { code: "none", short: "—", name: "Без подписей" },
  { code: "local", short: "Мест", name: "Местные названия" },
  { code: "ru", short: "Ру", name: "Русский" },
  { code: "en", short: "En", name: "English" },
  { code: "et", short: "Et", name: "Eesti" },
  { code: "fi", short: "Fi", name: "Suomi" },
  { code: "lv", short: "Lv", name: "Latviešu" },
  { code: "lt", short: "Lt", name: "Lietuvių" },
  { code: "uk", short: "Ук", name: "Українська" },
  { code: "de", short: "De", name: "Deutsch" },
  { code: "fr", short: "Fr", name: "Français" },
  { code: "es", short: "Es", name: "Español" },
  { code: "it", short: "It", name: "Italiano" },
];
const LANGUAGE_STORAGE_KEY = "travel-earth.language";
let currentLanguage = LANGUAGES.find((l) => l.code === localStorage.getItem(LANGUAGE_STORAGE_KEY)) || LANGUAGES[2];

// результаты поиска и попапы мест тоже показываем на выбранном языке; для "без подписей" и
// "местных" поиск всё равно нужен на каком-то языке интерфейса — берём русский
const uiLanguageCode = () => (currentLanguage.code.length === 2 ? currentLanguage.code : "ru");

// подписи-названия — это symbol-слои, в text-field которых упоминается name (в отличие
// от номеров дорог ref и номеров домов housenumber, которые не переводятся)
function nameLabelLayers() {
  return map.getStyle().layers.filter((l) =>
    l.type === "symbol" && l.layout?.["text-field"] && /name/.test(JSON.stringify(l.layout["text-field"])));
}

function applyLabelLanguage() {
  const code = currentLanguage.code;
  const field = code === "local" || code === "none"
    ? ["get", "name"]
    : ["coalesce", ["get", `name:${code}`], ["get", "name"]];
  for (const layer of nameLabelLayers()) {
    map.setLayoutProperty(layer.id, "visibility", code === "none" ? "none" : "visible");
    if (code !== "none") map.setLayoutProperty(layer.id, "text-field", field);
  }
}

function renderLanguageMenu() {
  el("lang-btn-label").textContent = currentLanguage.short;
  el("lang-menu").replaceChildren(...LANGUAGES.map((l) => {
    const item = document.createElement("button");
    item.className = "lang-item" + (l === currentLanguage ? " active" : "");
    item.textContent = l.name;
    item.addEventListener("click", () => {
      currentLanguage = l;
      localStorage.setItem(LANGUAGE_STORAGE_KEY, l.code);
      el("lang-menu").hidden = true;
      renderLanguageMenu();
      if (map.isStyleLoaded()) applyLabelLanguage();
    });
    return item;
  }));
}

el("lang-btn").addEventListener("click", (evt) => {
  evt.stopPropagation();
  el("lang-menu").hidden = !el("lang-menu").hidden;
});
document.addEventListener("click", (evt) => {
  if (!el("lang-menu").contains(evt.target)) el("lang-menu").hidden = true;
});
renderLanguageMenu();

// ---------- переключатель карт ----------

// Переключатель как в Google Maps: большая плитка внизу слева показывает "другой" вид
// (на карте — Спутник, на спутнике — последнюю выбранную карту) и переключает на него
// одним кликом; при наведении справа раскрывается ряд всех вариантов с подписями
const SATELLITE = BASEMAPS[0];
let lastMapBasemap = currentBasemap === SATELLITE ? DEFAULT_BASEMAP : currentBasemap;

function fillBasemapTile(tile, b) {
  tile.innerHTML = `<img alt=""><span class="basemap-label"></span>`;
  tile.querySelector("img").src = `icons/basemaps/${b.id}.jpg`;
  tile.querySelector(".basemap-label").textContent = b.name;
  tile.title = b.hint;
}

function renderBasemapSwitcher() {
  const alternative = currentBasemap === SATELLITE ? lastMapBasemap : SATELLITE;
  fillBasemapTile(el("basemap-main"), alternative);
  el("basemap-main").onclick = () => selectBasemap(alternative);

  el("basemap-panel").replaceChildren(...BASEMAPS.map((b) => {
    const item = document.createElement("button");
    item.className = "basemap-item" + (b === currentBasemap ? " active" : "");
    fillBasemapTile(item, b);
    item.addEventListener("click", () => selectBasemap(b));
    return item;
  }));
}

function selectBasemap(b) {
  if (b === currentBasemap) return;
  currentBasemap = b;
  if (b !== SATELLITE) lastMapBasemap = b;
  localStorage.setItem(BASEMAP_STORAGE_KEY, b.id);
  // diff: false — без него MapLibre пытается "досчитать" разницу между стилями разных
  // провайдеров и подставляет в новый стиль несуществующие у него шрифты (404 на глифы)
  map.setStyle(resolveStyle(b), { diff: false });
  renderBasemapSwitcher();
}

renderBasemapSwitcher();

// ---------- слои поверх карты ----------

// Карта — это основа (переключатель выше), а слои ложатся поверх любой из них, и
// включать можно сразу несколько. Все бесплатные и без ключа. Высоты — AWS Terrain
// Tiles (формат terrarium): из них MapLibre рисует тени склонов и 3D, а maplibre-contour
// прямо в браузере строит горизонтали. Тропы — готовые прозрачные картинки Waymarked
// Trails. Железные дороги рисуются из тех же векторных тайлов OpenFreeMap, что и места:
// тайлы OpenRailwayMap закрыты для чужих сайтов (403)
const DEM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const DEM_ATTRIBUTION = 'Высоты: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">AWS Terrain Tiles</a> (Mapzen, SRTM, USGS…)';
const TRAILS_ATTRIBUTION = 'Маршруты: <a href="https://waymarkedtrails.org" target="_blank">Waymarked Trails</a> (CC BY-SA)';
// библиотека горизонталей грузится с unpkg; если не загрузилась — слой просто недоступен
const demSource = window.mlcontour && new mlcontour.DemSource({ url: DEM_URL, encoding: "terrarium", maxzoom: 13, worker: true });
demSource?.setupMaplibre(maplibregl);

// layers — id слоёв карты, из которых состоит пункт меню
// Картинки троп на мелком масштабе — сплошные толстые размытые линии по всей стране,
// поэтому тропы видны только с TRAILS_MIN_ZOOM (шкала около 10 км)
const TRAILS_MIN_ZOOM = 9;

const OVERLAYS = [
  { id: "hillshade", name: "Рельеф", icon: "⛰️", hint: "Тени склонов — горы становятся объёмными", layers: ["ov-hillshade"] },
  { id: "contours", name: "Горизонтали", icon: "〰️", hint: "Линии равной высоты с подписями в метрах",
    layers: ["ov-contours", "ov-contour-labels"], available: () => !!demSource },
  { id: "terrain3d", name: "3D-рельеф", icon: "🏔️", hint: "Настоящий объёмный рельеф — наклоните карту (правая кнопка мыши или два пальца)", layers: [] },
  { id: "hiking", name: "Пешие тропы", icon: "🥾", hint: "Маркированные пешие маршруты — видны с масштаба около 10 км", trails: "hiking", layers: ["ov-hiking"] },
  { id: "cycling", name: "Велодорожки", icon: "🚲", hint: "Веломаршруты — видны с масштаба около 10 км", trails: "cycling", layers: ["ov-cycling"] },
  { id: "mtb", name: "Маунтинбайк", icon: "🚵", hint: "Маршруты для горного велосипеда — видны с масштаба около 10 км", trails: "mtb", layers: ["ov-mtb"] },
  { id: "railways", name: "Железные дороги", icon: "🚆", hint: "Поезда, метро, трамваи и фуникулёры — каждый своим цветом",
    layers: ["ov-rail-tunnel", "ov-rail"] },
];
const OVERLAYS_STORAGE_KEY = "travel-earth.overlays";
const activeOverlays = new Set(JSON.parse(localStorage.getItem(OVERLAYS_STORAGE_KEY) || "[]"));

// шрифт подписей высот — тот же, что у подписей самой карты: у каждого стиля свой
// сервер шрифтов, и чужого шрифта на нём может не быть
function styleFont() {
  const layer = map.getStyle().layers.find((l) => l.type === "symbol" && Array.isArray(l.layout?.["text-font"]));
  return layer ? layer.layout["text-font"] : ["Noto Sans Regular"];
}

// слои встают под подписи карты (флажки мест и так выше — они добавляются последними)
const firstLabelLayer = () => map.getStyle().layers.find((l) => l.type === "symbol")?.id;
const darkBasemap = () => currentBasemap.id === "satellite" || currentBasemap.id === "dark";

function addOverlay(id) {
  const overlay = OVERLAYS.find((o) => o.id === id);
  const before = firstLabelLayer();
  // у теней и у 3D свои источники высот — MapLibre просит не делить один на двоих;
  // через maplibre-contour — общий с горизонталями кэш картинок
  const dem = (sourceId) => map.getSource(sourceId) || map.addSource(sourceId, {
    type: "raster-dem", tiles: [demSource ? demSource.sharedDemProtocolUrl : DEM_URL],
    encoding: "terrarium", tileSize: 256, maxzoom: 13, attribution: DEM_ATTRIBUTION });
  if (id === "hillshade") {
    dem("ov-hillshade");
    map.addLayer({ id: "ov-hillshade", type: "hillshade", source: "ov-hillshade", paint: {
      "hillshade-exaggeration": 0.5,
      "hillshade-shadow-color": darkBasemap() ? "rgba(0,0,0,0.6)" : "rgba(60,50,40,0.45)",
      "hillshade-highlight-color": "rgba(255,255,255,0.25)" } }, before);
  } else if (id === "contours") {
    map.addSource("ov-contours", { type: "vector", maxzoom: 15, attribution: DEM_ATTRIBUTION, tiles: [demSource.contourProtocolUrl({
      // зум: [шаг линий, шаг толстых линий с подписями], метры
      thresholds: { 11: [200, 1000], 12: [100, 500], 13: [50, 250], 14: [20, 100], 15: [10, 50] },
      contourLayer: "contours", elevationKey: "ele", levelKey: "level" })] });
    const color = darkBasemap() ? "#f0d9b5" : "#9c6b3f";
    map.addLayer({ id: "ov-contours", type: "line", source: "ov-contours", "source-layer": "contours", minzoom: 11,
      paint: { "line-color": color, "line-opacity": 0.6, "line-width": ["match", ["get", "level"], 1, 1.4, 0.6] } }, before);
    map.addLayer({ id: "ov-contour-labels", type: "symbol", source: "ov-contours", "source-layer": "contours", minzoom: 11,
      filter: [">", ["get", "level"], 0],
      layout: { "symbol-placement": "line", "text-field": ["concat", ["number-format", ["get", "ele"], {}], " м"],
        "text-font": styleFont(), "text-size": 11 },
      paint: { "text-color": color, "text-halo-width": 1.2,
        "text-halo-color": darkBasemap() ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)" } }, before);
  } else if (id === "terrain3d") {
    dem("ov-terrain3d");
    map.setTerrain({ source: "ov-terrain3d", exaggeration: 1.3 });
  } else if (overlay.trails) {
    map.addSource(`ov-${id}`, { type: "raster", tileSize: 256, maxzoom: 17, attribution: TRAILS_ATTRIBUTION,
      tiles: [`https://tile.waymarkedtrails.org/${overlay.trails}/{z}/{x}/{y}.png`] });
    map.addLayer({ id: `ov-${id}`, type: "raster", source: `ov-${id}`, minzoom: TRAILS_MIN_ZOOM }, before);
  } else if (id === "railways") {
    // цвет пути по виду транспорта — те же цвета, что у флажков станций
    const color = ["match", ["get", "subclass"],
      "subway", "#e53935", "tram", "#fb8c00", "light_rail", "#8e24aa", "monorail", "#8e24aa",
      "funicular", FUNICULAR_PIN.color, "#3949ab"];
    // тоннели — пунктиром и бледнее: метро почти всё под землёй
    const rails = (layerId, tunnel) => map.addLayer({
      id: layerId, type: "line", source: "te-poi", "source-layer": "transportation", minzoom: 5,
      filter: ["all", ["in", ["get", "class"], ["literal", ["rail", "transit"]]],
        tunnel ? ["==", ["get", "brunnel"], "tunnel"] : ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-cap": tunnel ? "butt" : "round" },
      paint: { "line-color": color, "line-opacity": tunnel ? 0.55 : 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 10, 1.6, 16, 4],
        ...(tunnel && { "line-dasharray": [2, 1.5] }) } }, before);
    rails("ov-rail-tunnel", true);
    rails("ov-rail", false);
  }
}

function removeOverlay(id) {
  const overlay = OVERLAYS.find((o) => o.id === id);
  for (const layerId of overlay.layers) if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (id === "terrain3d") map.setTerrain(null);
  if (map.getSource(`ov-${id}`)) map.removeSource(`ov-${id}`);
}

// после каждой смены карты (setStyle стирает всё добавленное) — заново все включённые
function applyOverlays() {
  for (const o of OVERLAYS) if (activeOverlays.has(o.id) && (o.available?.() ?? true)) addOverlay(o.id);
}

function toggleOverlay(id) {
  if (activeOverlays.has(id)) {
    activeOverlays.delete(id);
    removeOverlay(id);
  } else {
    activeOverlays.add(id);
    addOverlay(id);
  }
  localStorage.setItem(OVERLAYS_STORAGE_KEY, JSON.stringify([...activeOverlays]));
  renderOverlayMenu();
}

// по логике кнопки "Места": столбик чипов открыт, пока снова не нажать "Слои" — можно
// спокойно перещёлкать несколько слоёв; кнопка серая, пока столбик открыт или включён слой
function renderOverlayMenu() {
  el("layers-btn").classList.toggle("active", activeOverlays.size > 0 || !el("layers-chips").hidden);
  el("layers-chips").replaceChildren(...OVERLAYS.filter((o) => o.available?.() ?? true).map((o) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (activeOverlays.has(o.id) ? " active" : "");
    chip.title = o.hint;
    chipLabel(chip, o.icon, o.name);
    chip.addEventListener("click", () => toggleOverlay(o.id));
    return chip;
  }));
}

el("layers-btn").addEventListener("click", () => {
  el("layers-chips").hidden = !el("layers-chips").hidden;
  renderOverlayMenu();
});
renderOverlayMenu();

// ---------- категории мест (как чипы "Рестораны", "Гостиницы"… в Google Maps) ----------

// Места берутся прямо из векторных тайлов OpenFreeMap (слой poi схемы OpenMapTiles) —
// это те же тайлы, что и у карты, поэтому точки появляются сразу, без сервера поиска.
// Раньше здесь был Overpass API: 10–15 с на каждый сдвиг карты и частые 504.
// subclass в тайлах — исходное значение тега OSM (restaurant, supermarket, museum…),
// по нему и фильтруем. Точки в тайлах есть с zoom 12, но до 14 — только значимые,
// поэтому "не найдено" можно утверждать лишь с 14-го
const POI_MIN_ZOOM = 12;
const POI_FULL_ZOOM = 14;

// Аэропорты — в отдельном слое тайлов (aerodrome_label), их мало, и они видны раньше
// остальных мест: как только шкала масштаба показывает 3 км и меньше (шкала берёт
// круглое число не длиннее 100 px, "3 км" — пока в 100 px меньше 5 км). Пороговый зум
// зависит от широты, поэтому пересчитывается после каждого движения
const AIRPORT_MAX_METERS_PER_100PX = 5000;
const AIRPORT_CLASSES = ["international", "public", "regional"];

// остановки автобусов и трамваев — только когда шкала показывает 100 м и меньше,
// иначе они засыпают город флажками
const STOP_MAX_METERS_PER_100PX = 200;

// зум, с которого в 100 px экрана помещается не больше maxMeters (на широте центра)
function zoomForScale(maxMeters) {
  const lat = map.getCenter().lat;
  return Math.log2((100 * 40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * maxMeters));
}
const airportMinZoom = () => zoomForScale(AIRPORT_MAX_METERS_PER_100PX);

// Белые значки в головке флажка (контуры Material Icons, viewBox 24×24)
const PIN_GLYPHS = {
  bus: "M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z",
  train: "M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
  boat: "M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z",
  plane: "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
  // кабинка канатной дороги (Material Design Icons "gondola")
  cable: "M18,10H13V7.59L22.12,6.07L21.88,4.59L16.41,5.5C16.46,5.35 16.5,5.18 16.5,5A1.5,1.5 0 0,0 15,3.5A1.5,1.5 0 0,0 13.5,5C13.5,5.35 13.63,5.68 13.84,5.93L13,6.07V6.07L11,6.4V6.4L1.88,7.93L2.12,9.41L11,7.93V10H6A2,2 0 0,0 4,12V18A2,2 0 0,0 6,20H18A2,2 0 0,0 20,18V12A2,2 0 0,0 18,10M6,12H8.25V16H6V12M9.75,16V12H14.25V16H9.75M18,16H15.75V12H18V16Z",
  // метро — буквой "М", как на входах в метро почти везде
  metro: "text:M",
  tram: "M19 16.94V8.5c0-2.79-2.61-3.4-6.01-3.49l.76-1.51H17V2H7v1.5h4.75l-.76 1.52C7.86 5.11 5 5.73 5 8.5v8.44c0 1.45 1.19 2.66 2.59 2.97L6 21.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 20h-.08c1.69 0 2.58-1.37 2.58-3.06zm-7 1.56c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5-4.5H7V9h10v5z",
};
// фуникулёр — вагончик трамвая, наклонённый как на склоне
PIN_GLYPHS.funicular = { path: PIN_GLYPHS.tram, rotate: -30 };

// у эмодзи кровати цветная картинка, выбивающаяся из ряда, — вместо неё монохромный
// значок в стиле Material Icons ("hotel")
const HOTEL_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/></svg>`;

const CATEGORIES = [
  { id: "food", name: "Рестораны", icon: "🍴", color: "#f57c00",
    subclasses: ["restaurant", "cafe", "fast_food", "food_court", "bar", "pub", "biergarten", "ice_cream"] },
  { id: "hotels", name: "Гостиницы", icon: HOTEL_ICON, color: "#8e24aa",
    subclasses: ["hotel", "hostel", "guest_house", "motel", "apartment", "chalet", "camp_site", "caravan_site"] },
  { id: "fun", name: "Развлечения", icon: "📷", color: "#d81b60",
    subclasses: ["attraction", "viewpoint", "theme_park", "zoo", "petting_zoo", "aquarium", "castle", "monument", "theatre", "cinema", "arts_centre", "escape_game"] },
  { id: "museums", name: "Музеи", icon: "🏛️", color: "#3949ab", subclasses: ["museum", "gallery"] },
  // вокзалы, станции, метро, паромы и аэропорты (airports — из отдельного слоя), а
  // остановки (stops) — только на крупном масштабе. station — и ж/д станции, и станции
  // канатных дорог (class aerialway); станции фуникулёров в тайлах не отличить от ж/д —
  // их находит updateFunicularStations по рельсам фуникулёра рядом. lifts — фуникулёры и
  // канатные дороги поверх: их станции ищутся отдельно, а рельсы и тросы подсвечены.
  // modes: цвет и значок флажка по виду транспорта — первое совпадение по subclass/class
  { id: "transport", name: "Транспорт", icon: "🚌", color: "#00897b", airports: true, lifts: true,
    subclasses: ["bus_station", "station", "halt", "subway", "ferry_terminal"],
    stops: ["bus_stop", "tram_stop"],
    modes: [
      { subclass: "subway", glyph: "metro", color: "#e53935" },
      { subclass: "tram_stop", glyph: "tram", color: "#fb8c00" },
      { class: "bus", glyph: "bus", color: "#43a047" },
      { class: "aerialway", glyph: "cable", color: "#39ff14", ink: "#000" },
      { class: "ferry_terminal", glyph: "boat", color: "#0288d1" },
      { class: "railway", glyph: "train", color: "#3949ab" },
    ] },
  { id: "shops", name: "Магазины", icon: "🛒", color: "#1e88e5", subcategories: [
    { id: "grocery", name: "Продукты", subclasses: ["supermarket", "convenience", "greengrocer", "bakery", "pastry", "butcher", "seafood", "deli", "cheese", "dairy", "frozen_food", "health_food", "confectionery", "chocolate", "coffee", "tea", "farm"] },
    { id: "market", name: "Рынки", subclasses: ["marketplace"] },
    { id: "goods", name: "Промтовары и хозтовары", subclasses: ["hardware", "doityourself", "houseware", "variety_store", "general", "department_store", "furniture", "garden_centre", "paint", "kitchen", "bathroom_furnishing", "interior_decoration", "electrical", "trade", "bed", "fabric", "craft"] },
    { id: "clothes", name: "Одежда и обувь", subclasses: ["clothes", "shoes", "bag", "boutique", "fashion", "fashion_accessories", "jewelry", "watches", "second_hand", "sports", "outdoor"] },
    { id: "electronics", name: "Электроника", subclasses: ["electronics", "mobile_phone", "computer", "hifi", "camera", "appliance", "video_games"] },
    { id: "pharmacy", name: "Аптеки и косметика", subclasses: ["pharmacy", "chemist", "cosmetics", "perfumery", "medical_supply", "optician"] },
    { id: "malls", name: "Торговые центры", subclasses: ["mall", "department_store"] },
    { id: "gifts", name: "Сувениры и книги", subclasses: ["gift", "souvenir", "books", "antiques", "art", "toys", "stationery", "music"] },
    { id: "alcohol", name: "Алкоголь и напитки", subclasses: ["alcohol", "wine", "beverages"] },
  ] },
];
const SHOPS = CATEGORIES.find((c) => c.subcategories);
// "Все магазины" — объединение всех профилей
SHOPS.subcategories.unshift({ id: "all", name: "Все магазины",
  subclasses: [...new Set(SHOPS.subcategories.flatMap((s) => s.subclasses))] });

// подписи типов мест для попапа — для значений, которых нет в словаре, показывается сам тег
const POI_KIND_NAMES = {
  restaurant: "Ресторан", cafe: "Кафе", fast_food: "Фастфуд", food_court: "Фуд-корт", bar: "Бар", pub: "Паб",
  biergarten: "Пивной сад", ice_cream: "Мороженое", hotel: "Гостиница", hostel: "Хостел", guest_house: "Гостевой дом",
  motel: "Мотель", apartment: "Апартаменты", chalet: "Шале", camp_site: "Кемпинг", caravan_site: "Стоянка для автодомов",
  supermarket: "Супермаркет", convenience: "Продуктовый магазин", greengrocer: "Овощи и фрукты", bakery: "Пекарня",
  pastry: "Кондитерская", butcher: "Мясной магазин", seafood: "Рыба и морепродукты", deli: "Деликатесы", cheese: "Сыры",
  dairy: "Молочные продукты", frozen_food: "Замороженные продукты", health_food: "Здоровое питание",
  confectionery: "Сладости", chocolate: "Шоколад", coffee: "Кофе", tea: "Чай", farm: "Фермерские продукты",
  marketplace: "Рынок", hardware: "Хозтовары", doityourself: "Стройматериалы", houseware: "Товары для дома",
  variety_store: "Универсальный магазин", general: "Универсальный магазин", department_store: "Универмаг",
  furniture: "Мебель", garden_centre: "Садовый центр", paint: "Краски", kitchen: "Кухни",
  bathroom_furnishing: "Сантехника", interior_decoration: "Декор интерьера", electrical: "Электротовары",
  trade: "Строительная база", bed: "Кровати и матрасы", fabric: "Ткани", craft: "Товары для рукоделия",
  clothes: "Одежда", shoes: "Обувь", bag: "Сумки", boutique: "Бутик", fashion: "Одежда", fashion_accessories: "Аксессуары",
  jewelry: "Ювелирный", watches: "Часы", second_hand: "Секонд-хенд", sports: "Спорттовары", outdoor: "Товары для туризма",
  electronics: "Электроника", mobile_phone: "Телефоны", computer: "Компьютеры", hifi: "Аудиотехника", camera: "Фототехника",
  appliance: "Бытовая техника", video_games: "Видеоигры", pharmacy: "Аптека", chemist: "Бытовая химия",
  cosmetics: "Косметика", perfumery: "Парфюмерия", medical_supply: "Медтовары", optician: "Оптика",
  mall: "Торговый центр", gift: "Подарки", souvenir: "Сувениры", books: "Книги", antiques: "Антиквариат",
  art: "Товары для искусства", toys: "Игрушки", stationery: "Канцтовары", music: "Музыка",
  alcohol: "Алкоголь", wine: "Вино", beverages: "Напитки",
  attraction: "Достопримечательность", viewpoint: "Смотровая площадка", theme_park: "Парк развлечений", zoo: "Зоопарк",
  petting_zoo: "Контактный зоопарк", aquarium: "Аквариум", castle: "Замок", monument: "Памятник", theatre: "Театр",
  cinema: "Кинотеатр", arts_centre: "Арт-центр", escape_game: "Квест-комната", museum: "Музей", gallery: "Галерея",
  bus_stop: "Остановка автобуса", bus_station: "Автовокзал", station: "Железнодорожная станция", halt: "Остановка поезда",
  subway: "Станция метро", tram_stop: "Остановка трамвая", ferry_terminal: "Паромный терминал",
};
// там, где subclass не различает, — подпись по class (станции канатных дорог тоже station)
const POI_CLASS_KIND_NAMES = { aerialway: "Станция канатной дороги" };
const AIRPORT_KIND_NAMES = { international: "Международный аэропорт", public: "Аэропорт", regional: "Региональный аэропорт" };

// что сейчас показано: категория или профиль магазинов — { id, name, color, subclasses }
let activePoi = null;
let activeChipId = null;
// профиль, который включает клик по самому чипу "Магазины" (стрелка рядом меняет его)
let shopProfile = SHOPS.subcategories[0];

// открытый попап места — закрывается при смене или выключении фильтра, иначе висит без точки
let poiPopup = null;

function setActivePoi(chipId, poi) {
  poiPopup?.remove();
  poiClick++;
  activeChipId = poi ? chipId : null;
  activePoi = poi;
  renderCategoryChips();
  applyPoiLayer();
  updatePoiStatus();
  updatePlacesBtn();
}

// кнопка "Места" серая, пока открыт столбик категорий или включён фильтр —
// так включённый фильтр не забудется и при свёрнутом столбике
function updatePlacesBtn() {
  el("places-btn").classList.toggle("active", !!activePoi || !el("category-chips").hidden);
}

function chipLabel(button, icon, text) {
  button.innerHTML = `<span class="chip-icon"></span><span></span>`;
  if (icon.startsWith("<")) button.firstChild.innerHTML = icon;
  else button.firstChild.textContent = icon;
  button.lastChild.textContent = text;
}

function renderCategoryChips() {
  el("category-chips").replaceChildren(...CATEGORIES.map((c) => {
    const active = c.id === activeChipId;
    // клик по чипу — включить/выключить, как у остальных категорий
    const toggle = () => setActivePoi(c.id, active ? null : c.subcategories ? { ...shopProfile, color: c.color } : c);
    if (!c.subcategories) {
      const chip = document.createElement("button");
      chip.className = "chip" + (active ? " active" : "");
      chipLabel(chip, c.icon, c.name);
      chip.addEventListener("click", toggle);
      return chip;
    }
    // у магазинов чип из двух частей: название работает как у всех, стрелка открывает профили
    const chip = document.createElement("div");
    chip.className = "chip chip-split" + (active ? " active" : "");
    const main = document.createElement("button");
    main.className = "chip-main";
    chipLabel(main, c.icon, shopProfile.id === "all" ? c.name : shopProfile.name);
    main.addEventListener("click", toggle);
    const arrow = document.createElement("button");
    arrow.className = "chip-arrow";
    arrow.title = "Выбрать вид магазинов";
    arrow.textContent = "▾";
    arrow.addEventListener("click", (evt) => {
      evt.stopPropagation();
      toggleShopMenu(chip);
    });
    chip.append(main, arrow);
    return chip;
  }));
}

// меню профилей живёт вне полосы чипов (у неё overflow — меню обрезалось бы)
// и ставится под чипом по его координатам; выбор профиля сразу его включает
function toggleShopMenu(chip) {
  const menu = el("shop-menu");
  if (!menu.hidden) { menu.hidden = true; return; }
  const rect = chip.getBoundingClientRect();
  menu.style.right = `${window.innerWidth - rect.right}px`;
  menu.style.top = `${rect.bottom + 6}px`;
  menu.replaceChildren(...SHOPS.subcategories.map((s) => {
    const item = document.createElement("button");
    item.className = "lang-item" + (s === shopProfile ? " active" : "");
    item.textContent = s.name;
    item.addEventListener("click", () => {
      menu.hidden = true;
      shopProfile = s;
      setActivePoi(SHOPS.id, { ...s, color: SHOPS.color });
    });
    return item;
  }));
  menu.hidden = false;
}
document.addEventListener("click", (evt) => {
  if (!el("shop-menu").contains(evt.target)) el("shop-menu").hidden = true;
});

// кнопка "Места" в правом верхнем углу показывает и прячет столбик категорий
el("places-btn").addEventListener("click", () => {
  const open = el("category-chips").hidden;
  el("category-chips").hidden = !open;
  updatePlacesBtn();
  if (!open) el("shop-menu").hidden = true;
});

// короткое сообщение flashStatus несколько секунд не перебивается подсказками мест
let statusFlashUntil = 0;

function showStatus(text) {
  if (Date.now() < statusFlashUntil) return;
  el("map-status").textContent = text;
  el("map-status").hidden = !text;
}

// станции и места, остановки, станции фуникулёров и канатных дорог, аэропорты
const POI_LAYERS = ["poi", "poi-stops", "poi-funicular", "poi-cable", "poi-air"];
const AIRPORT_PIN = { glyph: "plane", color: "#546e7a" };
// ядовито-зелёный с чёрным значком — фуникулёры трудно найти, пусть бросаются в глаза
const FUNICULAR_PIN = { glyph: "funicular", color: "#39ff14", ink: "#000" };
const CABLE_PIN = { glyph: "cable", color: "#39ff14", ink: "#000" };

function applyPoiLayer() {
  if (!map.getLayer("poi")) return;
  // пока категория не выбрана, слои скрыты — тогда MapLibre и тайлы мест не грузит
  const show = {
    "poi": !!activePoi?.subclasses.length,
    "poi-stops": !!activePoi?.stops,
    "poi-funicular": !!activePoi?.lifts,
    "poi-cable": !!activePoi?.lifts,
    "poi-lift-line": !!activePoi?.lifts,
    "poi-air": !!activePoi?.airports,
  };
  for (const [id, on] of Object.entries(show)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  if (!activePoi) return;
  const icon = modeIcon(activePoi);
  map.setLayoutProperty("poi", "icon-image", icon);
  map.setLayoutProperty("poi-stops", "icon-image", icon);
  map.setLayoutProperty("poi-funicular", "icon-image", pinImage(FUNICULAR_PIN.color, FUNICULAR_PIN.glyph, FUNICULAR_PIN.ink));
  map.setLayoutProperty("poi-cable", "icon-image", pinImage(CABLE_PIN.color, CABLE_PIN.glyph, CABLE_PIN.ink));
  map.setLayoutProperty("poi-air", "icon-image", pinImage(AIRPORT_PIN.color, AIRPORT_PIN.glyph));
  applyPoiFilters();
  updateScaleZooms();
}

// флажок по виду транспорта (modes) или просто флажок цвета категории
function modeIcon(poi) {
  const cases = (poi.modes || []).flatMap((m) => [
    ["==", ["get", m.subclass ? "subclass" : "class"], m.subclass || m.class], pinImage(m.color, m.glyph, m.ink)]);
  return cases.length ? ["case", ...cases, pinImage(poi.color)] : pinImage(poi.color);
}

function applyPoiFilters() {
  if (!activePoi) return;
  const funicular = ["in", ["id"], ["literal", funicularIds]];
  map.setFilter("poi", ["all", ["in", ["get", "subclass"], ["literal", activePoi.subclasses]], ["!", funicular]]);
  map.setFilter("poi-stops", ["in", ["get", "subclass"], ["literal", activePoi.stops || []]]);
  map.setFilter("poi-funicular", funicular);
}

// пороги "по шкале" зависят от широты — пересчитываются после каждого движения
function updateScaleZooms() {
  if (!map.getLayer("poi-air")) return;
  map.setLayerZoomRange("poi-air", airportMinZoom(), 24);
  map.setLayerZoomRange("poi-stops", zoomForScale(STOP_MAX_METERS_PER_100PX), 24);
}
map.on("moveend", updateScaleZooms);

// В тайлах станция фуникулёра — обычная railway station/halt, а вот рельсы фуникулёра
// помечены (transportation, subclass funicular). Станция на этих рельсах (ближе
// FUNICULAR_STATION_METERS) или с тегом фуникулёра в OSM и считается станцией фуникулёра
const FUNICULAR_STATION_METERS = 50;
let funicularIds = [];

function distanceToLine(line, [x, y]) {
  // в метрах, в плоском приближении — для десятков метров его хватает
  const kx = 111320 * Math.cos((y * Math.PI) / 180), ky = 110540;
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const ax = (line[i - 1][0] - x) * kx, ay = (line[i - 1][1] - y) * ky;
    const bx = (line[i][0] - x) * kx, by = (line[i][1] - y) * ky;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

// Рельсы фуникулёров есть в тайлах только с zoom 14, а станции — с 12, как метро и
// поезда. Поэтому станции проверяются ещё и по тегам OSM (station=funicular или
// funicular=yes): одним запросом к OSM API на все новые станции в кадре, ответ
// запоминается. Рельсы остаются запасным признаком для станций без этих тегов
const funicularTags = new Map(); // id станции в тайлах → фуникулёр ли по тегам OSM
const funicularPending = new Set();

async function checkFunicularTags(ids) {
  ids.forEach((id) => funicularPending.add(id));
  const byType = {};
  for (const id of ids) (byType[OSM_TYPES[id % 10]] ||= []).push(id);
  await Promise.all(Object.entries(byType).map(async ([type, group]) => {
    for (let i = 0; i < group.length; i += 100) {
      const chunk = group.slice(i, i + 100);
      try {
        const osmIds = chunk.map((id) => Math.floor(id / 10)).join(",");
        const resp = await fetch(`https://api.openstreetmap.org/api/0.6/${type}s.json?${type}s=${osmIds}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const tags = new Map((await resp.json()).elements.map((e) => [e.id, e.tags || {}]));
        for (const id of chunk) {
          const t = tags.get(Math.floor(id / 10)) || {};
          funicularTags.set(id, t.station === "funicular" || t.funicular === "yes");
        }
      } catch (err) {
        console.warn("OSM API", err);
        chunk.forEach((id) => funicularTags.set(id, false));
      }
    }
  }));
  ids.forEach((id) => funicularPending.delete(id));
  updateFunicularStations();
}

function updateFunicularStations() {
  if (!activePoi?.lifts || !map.getLayer("poi")) return;
  const lines = map.querySourceFeatures("te-poi", { sourceLayer: "transportation", filter: ["==", ["get", "subclass"], "funicular"] })
    .flatMap((f) => (f.geometry.type === "LineString" ? [f.geometry.coordinates]
      : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : []));
  const ids = new Set();
  const unknown = new Set();
  for (const s of map.querySourceFeatures("te-poi", { sourceLayer: "poi", filter: ["==", ["get", "class"], "railway"] })) {
    if (s.id == null || !["station", "halt"].includes(s.properties.subclass)) continue;
    if (funicularTags.get(s.id)) ids.add(s.id);
    else if (lines.some((line) => distanceToLine(line, s.geometry.coordinates) < FUNICULAR_STATION_METERS)) ids.add(s.id);
    if (!funicularTags.has(s.id) && !funicularPending.has(s.id) && OSM_TYPES[s.id % 10]) unknown.add(s.id);
  }
  if (unknown.size) checkFunicularTags([...unknown]);
  const next = [...ids].sort((a, b) => a - b);
  if (next.join() === funicularIds.join()) return;
  funicularIds = next;
  applyPoiFilters();
}
map.on("idle", updateFunicularStations);

// Станции канатных дорог есть в тайлах только с POI_FULL_ZOOM, а тросы — уже с
// POI_MIN_ZOOM. Поэтому по id троса в тайлах OSM API (way/…/full) отдаёт его узлы, и
// узлы aerialway=station — это станции, вместе с промежуточными. Они рисуются своим
// слоем poi-cable до POI_FULL_ZOOM, дальше — обычные станции из тайлов
const CABLE_LINE_CLASSES = ["cable_car", "gondola", "mixed_lift"];
const cableStations = new Map(); // id троса в тайлах → его станции (GeoJSON), null — загружается

async function loadCableStations(lineId) {
  cableStations.set(lineId, null);
  let stations = [];
  try {
    const resp = await fetch(`https://api.openstreetmap.org/api/0.6/way/${Math.floor(lineId / 10)}/full.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    stations = (await resp.json()).elements
      .filter((e) => e.type === "node" && e.tags?.aerialway === "station")
      .map((e) => ({
        type: "Feature",
        id: e.id * 10 + 1, // как в тайлах — попап по нему же подгрузит подробности
        geometry: { type: "Point", coordinates: [e.lon, e.lat] },
        properties: { ...e.tags, class: "aerialway", subclass: "station" },
      }));
  } catch (err) {
    console.warn("OSM API", err);
  }
  cableStations.set(lineId, stations);
  showCableStations();
}

function showCableStations() {
  map.getSource("te-cable")?.setData({ type: "FeatureCollection",
    features: [...cableStations.values()].flatMap((s) => s || []) });
}

function updateCableStations() {
  if (!activePoi?.lifts || !map.getLayer("poi-cable") || map.getZoom() >= POI_FULL_ZOOM) return;
  const lines = map.querySourceFeatures("te-poi", { sourceLayer: "transportation",
    filter: ["in", ["get", "subclass"], ["literal", CABLE_LINE_CLASSES]] });
  for (const f of lines) {
    if (f.id != null && OSM_TYPES[f.id % 10] === "way" && !cableStations.has(f.id)) loadCableStations(f.id);
  }
}
map.on("idle", updateCableStations);

// с какого зума у категории что-то появляется (min) и с какого можно честно сказать
// "не найдено" (full) — аэропорты видны раньше остальных мест
function poiZoomRange(poi) {
  return { min: poi.airports ? Math.min(airportMinZoom(), POI_MIN_ZOOM) : POI_MIN_ZOOM, full: POI_FULL_ZOOM };
}

// флажок-булавка цвета категории — заметнее точки, не теряется среди подписей карты.
// Картинки рисуются по требованию и после смены стиля (setStyle их удаляет) — заново.
// glyph — белый значок из PIN_GLYPHS в головке вместо белого кружка;
// ink — другой цвет значка и обводки для светлых флажков, на которых белое теряется
function pinImage(color, glyph, ink) {
  const id = `pin-${color}-${glyph || "dot"}${ink ? `-${ink}` : ""}`;
  if (map.hasImage(id)) return id;
  const w = 44, h = 58; // в двойном размере: pixelRatio 2 — чётко на любом экране
  const ctx = Object.assign(document.createElement("canvas"), { width: w, height: h }).getContext("2d");
  ctx.beginPath();
  ctx.moveTo(22, 55);
  ctx.bezierCurveTo(18, 42, 4, 34, 4, 21);
  ctx.arc(22, 21, 18, Math.PI, 0);
  ctx.bezierCurveTo(40, 34, 26, 42, 22, 55);
  ctx.fillStyle = color;
  ctx.strokeStyle = ink || "#fff";
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink || "#fff";
  const shape = PIN_GLYPHS[glyph];
  if (typeof shape === "string" && shape.startsWith("text:")) {
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(shape.slice(5), 22, 22);
  } else if (shape) {
    // значок 24×24 → 22 px в центре головки, при необходимости наклонённый
    ctx.translate(22, 21);
    ctx.rotate(((shape.rotate || 0) * Math.PI) / 180);
    ctx.scale(22 / 24, 22 / 24);
    ctx.translate(-12, -12);
    ctx.fill(new Path2D(shape.path || shape));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    ctx.beginPath();
    ctx.arc(22, 21, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  map.addImage(id, ctx.getImageData(0, 0, w, h), { pixelRatio: 2 });
  return id;
}

function flashStatus(text) {
  statusFlashUntil = 0;
  showStatus(text);
  statusFlashUntil = Date.now() + 5000;
  setTimeout(() => { statusFlashUntil = 0; updatePoiStatus(); }, 5000);
}

function updatePoiStatus() {
  if (!activePoi) { showStatus(""); return; }
  const zoomIn = `Приблизьте карту, чтобы увидеть: ${activePoi.name.toLowerCase()}`;
  const range = poiZoomRange(activePoi);
  if (map.getZoom() < range.min) { showStatus(zoomIn); return; }
  // пока тайлы грузятся, надпись не трогаем — иначе она мигала бы при каждом сдвиге
  if (!map.areTilesLoaded()) return;
  const found = map.queryRenderedFeatures({ layers: POI_LAYERS }).length;
  if (found) showStatus("");
  // до полного зума в тайлах лишь часть мест — пустота ещё не значит, что их нет
  else if (map.getZoom() < range.full) showStatus(zoomIn);
  else showStatus(`В этой части карты не найдено: ${activePoi.name.toLowerCase()}`);
}
map.on("idle", updatePoiStatus);
map.on("zoomend", updatePoiStatus);

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// id точки в тайлах OpenFreeMap = osm_id * 10 + тип (1 — node, 2 — way, 3 — relation);
// подробности (часы работы, сайт, телефон) в тайлах не хранятся — по id их отдаёт OSM API
// одним запросом ~0,15 с
const OSM_TYPES = { 1: "node", 2: "way", 3: "relation" };

async function loadPoiTags(featureId) {
  const type = OSM_TYPES[featureId % 10];
  if (!type) return null;
  const resp = await fetch(`https://api.openstreetmap.org/api/0.6/${type}/${Math.floor(featureId / 10)}.json`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return (await resp.json()).elements[0]?.tags || null;
}

function poiDetailsHtml(tags) {
  const rows = [];
  if (tags.cuisine) rows.push(`<div class="popup-row">🍽️ ${escapeHtml(tags.cuisine.replace(/;/g, ", ").replace(/_/g, " "))}</div>`);
  if (tags.opening_hours) rows.push(`<div class="popup-row">🕒 ${escapeHtml(tags.opening_hours)}</div>`);
  const phone = tags.phone || tags["contact:phone"];
  if (phone) rows.push(`<div class="popup-row">📞 ${escapeHtml(phone)}</div>`);
  const website = tags.website || tags["contact:website"];
  if (website && /^https?:\/\//.test(website)) {
    rows.push(`<div class="popup-row"><a href="${escapeHtml(website)}" target="_blank" rel="noopener">Сайт</a></div>`);
  }
  return rows.join("");
}

// Попап открывается один раз, уже с подробностями: если показать его сразу с "Загрузка…"
// и дописать потом, он меняет размер и прыгает. Медленный ответ ждём не дольше 1,5 с
let poiClick = 0;
map.on("click", POI_LAYERS, async (evt) => {
  const f = evt.features[0];
  const p = f.properties;
  const name = p[`name:${uiLanguageCode()}`] || p.name;
  const kind = f.layer.id === "poi-air"
    ? [AIRPORT_KIND_NAMES[p.class] || "Аэропорт", p.iata].filter(Boolean).join(" · ")
    : f.layer.id === "poi-funicular" ? "Станция фуникулёра"
    : POI_CLASS_KIND_NAMES[p.class] || POI_KIND_NAMES[p.subclass] || p.subclass;
  const click = ++poiClick;
  poiPopup?.remove();
  let details = "";
  try {
    const tags = await Promise.race([loadPoiTags(f.id), new Promise((r) => setTimeout(r, 1500, null))]);
    if (tags) details = poiDetailsHtml(tags);
  } catch (err) {
    console.warn("OSM API", err);
  }
  // пока ждали ответа, успели щёлкнуть другое место или выключить фильтр
  if (click !== poiClick || !activePoi) return;
  poiPopup = new maplibregl.Popup({ offset: 8, maxWidth: "260px" })
    .setLngLat(f.geometry.coordinates)
    .setHTML(`<div class="popup-title">${escapeHtml(name || kind)}</div>`
      + (name ? `<div class="popup-kind">${escapeHtml(kind)}</div>` : "")
      + (details ? `<div class="popup-details">${details}</div>` : ""))
    .addTo(map);
  poiPopup.featureId = f.id;
  poiPopup.layerId = f.layer.id;
});
// попап живёт, пока на карте виден его флажок: при отдалении ниже нижнего зума слоя
// флажки скрываются сразу, а на средних зумах флажок может пропасть вместе с тайлом
map.on("zoom", () => {
  if (poiPopup && map.getZoom() < map.getLayer(poiPopup.layerId).minzoom) poiPopup.remove();
});
map.on("idle", () => {
  if (!poiPopup?.isOpen()) return;
  const { x, y } = map.project(poiPopup.getLngLat());
  const id = poiPopup.featureId;
  // флажок стоит над точкой — ищем его в рамке над ней
  const pins = map.queryRenderedFeatures([[x - 20, y - 35], [x + 20, y + 5]], { layers: [poiPopup.layerId] });
  if (!pins.some((pin) => pin.id === id)) poiPopup.remove();
});

// ---------- подсказка по щелчку на карте ----------

// Щелчок по значку самой карты (достопримечательность, парк, вершина, город, озеро…) —
// название, вид, часы, сайт и описание из Википедии; щелчок по пустому месту —
// координаты (щелчок по ним копирует) и адрес. Значок ищется среди подписей этих слоёв
// тайлов в нескольких пикселях от точки
const MAP_INFO_SOURCE_LAYERS = ["poi", "place", "water_name", "mountain_peak", "aerodrome_label", "park"];
const MAP_INFO_KIND_NAMES = {
  country: "Страна", state: "Регион", province: "Провинция", city: "Город", town: "Город", village: "Деревня",
  hamlet: "Посёлок", suburb: "Район", quarter: "Квартал", neighbourhood: "Район", island: "Остров", islet: "Остров",
  peak: "Вершина", volcano: "Вулкан", saddle: "Перевал", lake: "Озеро", sea: "Море", ocean: "Океан",
  bay: "Залив", park: "Парк", national_park: "Национальный парк", nature_reserve: "Заповедник", protected_area: "Охраняемая территория",
};
let mapPopup = null;

const withTimeout = (promise, ms, fallback) => Promise.race([promise, new Promise((r) => setTimeout(r, ms, fallback))]);

// теги OSM значка. У OpenFreeMap id кодирует и тип объекта (как у флажков мест), а у
// CARTO id с номерами OSM не совпадают — там объект ищется по имени рядом с точкой
async function featureOsmTags(f) {
  if (f.source !== "carto") return f.id == null ? null : loadPoiTags(f.id);
  if (f.geometry.type !== "Point") return null;
  const [lon, lat] = f.geometry.coordinates;
  const params = new URLSearchParams({ q: f.properties.name, format: "jsonv2", limit: "1", bounded: "1",
    viewbox: [lon - 0.005, lat + 0.005, lon + 0.005, lat - 0.005].join(",") });
  const resp = await fetch(`${NOMINATIM_URL}?${params}`);
  const [found] = resp.ok ? await resp.json() : [];
  if (!found?.osm_id) return null;
  const osm = await fetch(`https://api.openstreetmap.org/api/0.6/${found.osm_type}/${found.osm_id}.json`);
  return osm.ok ? (await osm.json()).elements[0]?.tags || null : null;
}

// краткое описание из Википедии: статья на языке подписей, иначе английская, иначе
// та, что указана в OSM. Язык статьи ищется через Викиданные (тег wikidata)
async function wikiSummary(tags) {
  const lang = uiLanguageCode();
  let site = null, title = null;
  if (tags.wikidata) {
    const resp = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(tags.wikidata)}&props=sitelinks&format=json&origin=*`);
    const links = resp.ok ? (await resp.json()).entities?.[tags.wikidata]?.sitelinks || {} : {};
    site = [lang, "en"].find((l) => links[`${l}wiki`]);
    title = site && links[`${site}wiki`].title;
  }
  if (!title && /^[a-z-]+:/.test(tags.wikipedia || "")) {
    site = tags.wikipedia.slice(0, tags.wikipedia.indexOf(":"));
    title = tags.wikipedia.slice(site.length + 1);
  }
  if (!title) return null;
  const resp = await fetch(`https://${site}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (!resp.ok) return null;
  const summary = await resp.json();
  return summary.extract ? { text: summary.extract, url: summary.content_urls?.desktop?.page } : null;
}

async function featureInfoHtml(f) {
  const p = f.properties;
  const name = p[`name:${uiLanguageCode()}`] || p.name;
  const kind = [
    (f.sourceLayer === "poi" && (POI_CLASS_KIND_NAMES[p.class] || POI_KIND_NAMES[p.subclass])) || MAP_INFO_KIND_NAMES[p.class],
    p.ele && `${Math.round(p.ele).toLocaleString("ru")} м`,
  ].filter(Boolean).join(" · ");
  let details = "";
  try {
    details = await withTimeout((async () => {
      const tags = await featureOsmTags(f);
      if (!tags) return "";
      const wiki = await wikiSummary(tags).catch(() => null);
      const about = wiki
        ? `<div class="popup-wiki">${escapeHtml(wiki.text)}</div>`
          + (wiki.url ? `<div class="popup-row"><a href="${escapeHtml(wiki.url)}" target="_blank" rel="noopener">Википедия</a></div>` : "")
        : tags.description ? `<div class="popup-wiki">${escapeHtml(tags.description)}</div>` : "";
      return about + poiDetailsHtml(tags);
    })(), 2500, "");
  } catch (err) {
    console.warn("OSM API", err);
  }
  return `<div class="popup-title">${escapeHtml(name)}</div>`
    + (kind ? `<div class="popup-kind">${escapeHtml(kind)}</div>` : "")
    + (details ? `<div class="popup-details">${details}</div>` : "");
}

async function pointInfoHtml(lngLat) {
  const lat = lngLat.lat.toFixed(5), lon = lngLat.lng.toFixed(5);
  let address = "";
  try {
    const params = new URLSearchParams({ lat, lon, format: "jsonv2", zoom: "18", "accept-language": uiLanguageCode() });
    const place = await withTimeout(fetch(`${NOMINATIM_URL.replace("/search", "/reverse")}?${params}`)
      .then((resp) => (resp.ok ? resp.json() : null)), 1500, null);
    address = place?.display_name || "";
  } catch (err) {
    console.warn("Nominatim", err);
  }
  return `<button class="popup-coords" title="Скопировать координаты" data-coords="${lat}, ${lon}">${lat}, ${lon}</button>`
    + (address ? `<div class="popup-kind">${escapeHtml(address)}</div>` : "");
}

map.on("click", async (evt) => {
  // щелчок по флажку места или по маркеру поиска — у них свои попапы
  if (evt.originalEvent.target !== map.getCanvas()) return;
  // щелчок мимо глобуса, по звёздам, — не на Земле, координат у него нет
  if (map.transform.isPointOnMapSurface?.(evt.point) === false) return;
  if (map.queryRenderedFeatures(evt.point, { layers: POI_LAYERS.filter((id) => map.getLayer(id)) }).length) return;
  // первый щелчок только закрывает открытое: попап, список поиска, меню
  if (poiPopup?.isOpen() || mapPopup?.isOpen() || searchMarker?.getPopup()?.isOpen()
    || !el("search-results").hidden || !el("lang-menu").hidden || !el("shop-menu").hidden) return;
  const { x, y } = evt.point;
  const hit = map.queryRenderedFeatures([[x - 8, y - 8], [x + 8, y + 8]]).find((f) => f.layer.type === "symbol"
    && MAP_INFO_SOURCE_LAYERS.includes(f.sourceLayer) && f.properties.name && !POI_LAYERS.includes(f.layer.id));
  const click = ++poiClick;
  const html = hit ? await featureInfoHtml(hit) : await pointInfoHtml(evt.lngLat);
  // пока ждали ответа, успели щёлкнуть ещё раз
  if (click !== poiClick) return;
  mapPopup?.remove();
  mapPopup = new maplibregl.Popup({ offset: hit ? 12 : 4, maxWidth: "280px" })
    .setLngLat(hit?.geometry.type === "Point" ? hit.geometry.coordinates : evt.lngLat)
    .setHTML(html)
    .addTo(map);
});
document.addEventListener("click", (evt) => {
  const coords = evt.target.closest(".popup-coords");
  if (!coords) return;
  navigator.clipboard?.writeText(coords.dataset.coords);
  coords.textContent = "Скопировано";
  setTimeout(() => { coords.textContent = coords.dataset.coords; }, 1500);
});
map.on("mouseenter", POI_LAYERS, () => { map.getCanvas().style.cursor = "pointer"; });
map.on("mouseleave", POI_LAYERS, () => { map.getCanvas().style.cursor = ""; });

// setStyle заменяет стиль целиком вместе с проекцией и своими слоями — поэтому globe,
// язык подписей и слой мест выставляются заново после каждой загрузки стиля
map.on("style.load", () => {
  map.setProjection({ type: "globe" });
  applyLabelLanguage();
  // свой источник, а не источник стиля: у стилей CARTO другие тайлы, без subclass
  map.addSource("te-poi", OPENMAPTILES_SOURCE);
  // рельсы фуникулёров и тросы канатных дорог подкрашиваются цветом их флажков
  map.addLayer({
    id: "poi-lift-line",
    type: "line",
    source: "te-poi",
    "source-layer": "transportation",
    minzoom: POI_MIN_ZOOM,
    filter: ["in", ["get", "subclass"], ["literal", ["funicular", ...CABLE_LINE_CLASSES]]],
    layout: { visibility: "none", "line-cap": "round" },
    paint: { "line-color": FUNICULAR_PIN.color, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2, 17, 5] },
  });
  const pinLayer = (id, sourceLayer, extra) => map.addLayer({
    id,
    type: "symbol",
    source: "te-poi",
    "source-layer": sourceLayer,
    minzoom: POI_MIN_ZOOM,
    ...extra,
    layout: {
      visibility: "none",
      "icon-anchor": "bottom",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 1, 17, 1.4],
      // показываются все найденные места, даже если флажки перекрываются
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
  // остановки ниже станций — станция не прячется под флажком остановки
  pinLayer("poi-stops", "poi");
  pinLayer("poi", "poi");
  pinLayer("poi-funicular", "poi");
  map.addSource("te-cable", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  pinLayer("poi-cable", undefined, { source: "te-cable", maxzoom: POI_FULL_ZOOM });
  showCableStations();
  pinLayer("poi-air", "aerodrome_label", { minzoom: 0, filter: ["in", ["get", "class"], ["literal", AIRPORT_CLASSES]] });
  applyPoiLayer();
  applyOverlays();
});

renderCategoryChips();

// ---------- поиск ----------

// Nominatim (геокодер OpenStreetMap): бесплатный, но правила использования запрещают
// автодополнение на каждую букву — поэтому поиск только по Enter/кнопке
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
let searchMarker = null;

// история: последние выбранные результаты (не запросы) — повторный клик сразу ведёт
// на место, без нового обращения к Nominatim. Показывается в пустой строке поиска
const SEARCH_HISTORY_KEY = "travel-earth-search-history";
const SEARCH_HISTORY_SIZE = 20;

function loadSearchHistory() {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || []; } catch { return []; }
}

const saveSearchHistory = (history) => localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));

// новое место — наверх; уже известное остаётся на своём месте: список можно
// перетаскиванием выстроить как избранное, и повторный поиск его не перемешает
function rememberSearch(r) {
  const entry = { display_name: r.display_name, lat: r.lat, lon: r.lon, boundingbox: r.boundingbox };
  const history = loadSearchHistory();
  if (history.some((h) => h.display_name === entry.display_name)) return;
  saveSearchHistory([entry, ...history].slice(0, SEARCH_HISTORY_SIZE));
}

function searchItem(r) {
  const item = document.createElement("button");
  item.className = "search-item";
  const [title, ...rest] = r.display_name.split(", ");
  item.innerHTML = `<span class="search-item-title"></span><span class="search-item-sub"></span>`;
  item.firstChild.textContent = title;
  item.lastChild.textContent = rest.join(", ");
  item.addEventListener("click", () => showSearchResult(r, title));
  return item;
}

function showSearchHistory() {
  const history = loadSearchHistory();
  if (el("search-input").value.trim() || !history.length) { clearSearchResults(); return; }
  const clear = document.createElement("button");
  clear.className = "search-history-clear";
  clear.textContent = "Очистить историю";
  clear.addEventListener("click", () => {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    clearSearchResults();
  });
  el("search-results").replaceChildren(...history.map(historyRow), clear);
  el("search-results").hidden = false;
}

const DRAG_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-6 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM9 16a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>`;
const DELETE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

// строка истории: слева ручка — перетащить выше или ниже, справа крестик — удалить.
// Так из истории складывается свой список избранных мест
function historyRow(r) {
  const row = document.createElement("div");
  row.className = "search-history-row";
  row.entry = r;
  const handle = document.createElement("span");
  handle.className = "search-drag";
  handle.title = "Перетащить выше или ниже";
  handle.innerHTML = DRAG_ICON;
  handle.addEventListener("pointerdown", (evt) => dragHistoryRow(evt, row));
  const del = document.createElement("button");
  del.className = "search-delete";
  del.title = "Удалить из истории";
  del.innerHTML = DELETE_ICON;
  del.addEventListener("click", (evt) => {
    // список перерисуется, и щелчок окажется "мимо поиска" — не даём ему закрыть список
    evt.stopPropagation();
    saveSearchHistory(loadSearchHistory().filter((h) => h.display_name !== r.display_name));
    showSearchHistory();
  });
  row.append(handle, searchItem(r), del);
  return row;
}

// Перетаскивание указателем, а не HTML5 drag-and-drop — тот не работает на телефонах.
// Сама строка в списке не переставляется (иначе браузер отпустил бы захват указателя),
// вместо этого соседи перепрыгивают через неё, пока палец выше или ниже строки
function dragHistoryRow(evt, row) {
  evt.preventDefault();
  const handle = evt.currentTarget;
  const list = row.parentElement;
  const isRow = (node) => node?.classList?.contains("search-history-row");
  handle.setPointerCapture(evt.pointerId);
  row.classList.add("dragging");
  const move = (e) => {
    const { top, bottom } = row.getBoundingClientRect();
    if (e.clientY < top && isRow(row.previousElementSibling)) list.insertBefore(row.previousElementSibling, row.nextElementSibling);
    else if (e.clientY > bottom && isRow(row.nextElementSibling)) list.insertBefore(row.nextElementSibling, row);
  };
  const end = () => {
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
    row.classList.remove("dragging");
    saveSearchHistory([...list.querySelectorAll(".search-history-row")].map((r) => r.entry));
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}


function clearSearchResults() {
  el("search-results").replaceChildren();
  el("search-results").hidden = true;
}

async function runSearch() {
  const q = el("search-input").value.trim();
  if (!q) return;
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "8", "accept-language": uiLanguageCode() });
  // как в Google: результаты рядом с видимой частью карты — выше в списке (bounded=0 —
  // остальной мир при этом не отсекается). На глобусе целиком рамка бессмысленна
  if (map.getZoom() >= 5) {
    const b = map.getBounds();
    params.set("viewbox", [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()].map((v) => v.toFixed(4)).join(","));
    params.set("bounded", "0");
  }
  const list = el("search-results");
  list.hidden = false;
  list.innerHTML = `<div class="search-note">Поиск…</div>`;
  try {
    const resp = await fetch(`${NOMINATIM_URL}?${params}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const results = await resp.json();
    if (!results.length) { list.innerHTML = `<div class="search-note">Ничего не найдено</div>`; return; }
    list.replaceChildren(...results.map((r) => searchItem(r)));
  } catch (err) {
    console.error("Nominatim", err);
    list.innerHTML = `<div class="search-note">Поиск не удался — проверьте интернет и попробуйте ещё раз</div>`;
  }
}

function showSearchResult(r, title) {
  clearSearchResults();
  rememberSearch(r);
  el("search-input").value = title;
  el("search-clear-btn").hidden = false;
  const lngLat = [Number(r.lon), Number(r.lat)];
  searchMarker?.remove();
  searchMarker = new maplibregl.Marker({ color: "#e53935" })
    .setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 30 }).setHTML(
      `<div class="popup-title">${escapeHtml(title)}</div><div class="popup-kind">${escapeHtml(r.display_name)}</div>`))
    .addTo(map);
  // boundingbox Nominatim: [юг, север, запад, восток]
  const [s, n, w, e] = r.boundingbox.map(Number);
  map.fitBounds([[w, s], [e, n]], { padding: 80, maxZoom: 16, duration: 2500 });
}

el("search-input").addEventListener("keydown", (evt) => {
  if (evt.key === "Enter") runSearch();
  if (evt.key === "Escape") clearSearchResults();
});
el("search-input").addEventListener("input", () => {
  el("search-clear-btn").hidden = !el("search-input").value;
  // стёрли запрос — снова видна история, начали печатать — она прячется
  showSearchHistory();
});
el("search-input").addEventListener("focus", showSearchHistory);
// клик мимо поиска закрывает список
document.addEventListener("click", (evt) => {
  if (!evt.target.closest(".search-wrap")) clearSearchResults();
});
el("search-btn").addEventListener("click", runSearch);
el("search-clear-btn").addEventListener("click", () => {
  el("search-input").value = "";
  el("search-clear-btn").hidden = true;
  clearSearchResults();
  searchMarker?.remove();
  searchMarker = null;
  el("search-input").focus();
  showSearchHistory();
});

// ---------- элементы управления справа внизу ----------

function openAboutModal() { el("about-modal").hidden = false; }
function closeAboutModal() { el("about-modal").hidden = true; }

// шестерёнка — отдельный контрол MapLibre, чтобы встать в тот же столбик в правом нижнем
// углу, что и кнопки масштаба, над строкой атрибуции (как в Google Maps)
class SettingsControl {
  onAdd() {
    const div = document.createElement("div");
    div.className = "maplibregl-ctrl maplibregl-ctrl-group";
    div.innerHTML = `<button id="settings-btn" type="button" title="О программе"><img src="icons/Gear BLK.png" alt=""></button>`;
    div.querySelector("button").addEventListener("click", openAboutModal);
    return div;
  }
  onRemove() {}
}
// нижние контролы MapLibre складываются снизу вверх: над атрибуцией шкала масштаба,
// выше шестерёнка, над ней кнопки масштаба
// шкала по-русски: до километра — в метрах, дальше — в километрах
class RuScaleControl extends maplibregl.ScaleControl {
  onAdd(map) {
    const container = super.onAdd(map);
    // подписка после собственной подписки шкалы — срабатывает следом и переписывает текст
    const translate = () => {
      const m = container.textContent.match(/^([\d.]+)\s*(k?m)$/);
      if (!m) return;
      container.textContent = `${Number(m[1]).toLocaleString("ru")} ${m[2] === "km" ? "км" : "м"}`;
    };
    map.on("move", translate);
    translate();
    return container;
  }
}
map.addControl(new RuScaleControl({ unit: "metric" }), "bottom-right");
map.addControl(new SettingsControl(), "bottom-right");
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

// ---------- моё местоположение ----------

// Кнопка как в Google Maps и Mapy.com: первый щелчок включает слежение и ставит карту на
// меня (центр значка синий). Сдвинул карту рукой — она больше не бегает за мной, центр
// значка серый; щелчок — снова ко мне. Щелчок по синему выключает слежение. Включённое
// слежение запоминается: при следующем запуске карта сразу встаёт на меня
const GEO_STORAGE_KEY = "travel-earth.geolocate";
const GEO_ZOOM = 16;
let geoWatch = null;
let geoMarker = null;
let geoFollow = false;
let geoPosition = null;

class GeolocateControl {
  onAdd() {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    container.innerHTML = `<button id="geo-btn" class="geo-btn" title="Моё местоположение">
      <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle class="geo-center" cx="12" cy="12" r="3.5"/></svg></button>`;
    container.firstElementChild.addEventListener("click", onGeoClick);
    return container;
  }
  onRemove() {}
}

function updateGeoBtn() {
  el("geo-btn").classList.toggle("on", geoWatch !== null);
  el("geo-btn").classList.toggle("follow", geoWatch !== null && geoFollow);
}

function startGeo() {
  if (!navigator.geolocation) { flashStatus("Этот браузер не умеет определять местоположение"); return; }
  geoFollow = true;
  geoWatch = navigator.geolocation.watchPosition(onGeoPosition, onGeoError, { enableHighAccuracy: true, maximumAge: 10000 });
  localStorage.setItem(GEO_STORAGE_KEY, "on");
  updateGeoBtn();
}

function stopGeo() {
  if (geoWatch !== null) navigator.geolocation.clearWatch(geoWatch);
  geoWatch = null;
  geoFollow = false;
  geoPosition = null;
  geoMarker?.remove();
  geoMarker = null;
  localStorage.setItem(GEO_STORAGE_KEY, "off");
  updateGeoBtn();
}

function onGeoPosition(pos) {
  const first = !geoPosition;
  geoPosition = [pos.coords.longitude, pos.coords.latitude];
  if (!geoMarker) {
    geoMarker = new maplibregl.Marker({ element: Object.assign(document.createElement("div"), { className: "geo-dot" }) })
      .setLngLat(geoPosition).addTo(map);
  }
  geoMarker.setLngLat(geoPosition);
  if (geoFollow) centerOnMe(first);
}

function onGeoError(err) {
  // запрет доступа — выключаем совсем, иначе при каждом запуске спрашивали бы заново
  if (err.code === err.PERMISSION_DENIED) {
    stopGeo();
    flashStatus("Нет доступа к местоположению — разрешите его браузеру");
  } else {
    flashStatus("Не удаётся определить местоположение");
  }
}

function centerOnMe(fly) {
  if (!geoPosition) return;
  // издалека — перелёт с приближением, вблизи — просто сдвиг, масштаб не трогаем
  if (fly || map.getZoom() < 12) map.flyTo({ center: geoPosition, zoom: Math.max(map.getZoom(), GEO_ZOOM), duration: 3000 });
  else map.easeTo({ center: geoPosition, duration: 800 });
}

function onGeoClick() {
  if (geoWatch === null) startGeo();
  else if (!geoFollow) {
    geoFollow = true;
    updateGeoBtn();
    centerOnMe(false);
  } else stopGeo();
}

// сдвинул карту рукой — карта больше не бегает за мной
map.on("dragstart", () => {
  if (!geoFollow) return;
  geoFollow = false;
  updateGeoBtn();
});

map.addControl(new GeolocateControl(), "bottom-right");
if (localStorage.getItem(GEO_STORAGE_KEY) === "on") startGeo();


// Внизу справа в одну строку: шкала, кнопка ⓘ источников, шестерёнка; кнопки масштаба
// остаются над ними. ⓘ стоит в ячейке своего размера, а раскрытая строка источников
// ложится поверх шкалы влево — шкала не сдвигается (на телефоне ей некуда)
{
  const corner = document.querySelector(".maplibregl-ctrl-bottom-right");
  const row = document.createElement("div");
  row.className = "bottom-row";
  const attribSlot = document.createElement("div");
  attribSlot.className = "attrib-slot";
  attribSlot.append(corner.querySelector(".maplibregl-ctrl-attrib"));
  row.append(corner.querySelector(".maplibregl-ctrl-scale"), attribSlot, el("settings-btn").parentElement);
  corner.append(row);
}

// Пока глобус виден целиком на звёздном небе, наклон и поворот только сбивают с толку —
// шар и так крутится мышью. Они включаются, когда шкала масштаба показывает не больше
// 100 км, а при отдалении карта сама возвращается к северу вверх и виду сверху
const TILT_MAX_METERS_PER_100PX = 100000;
let tiltLocked = null;

function metersPer100px() {
  const { lat } = map.getCenter();
  return (100 * 40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
}

// Глобус не уменьшается до "юлы": на компьютере — не мельче шкалы 500 км (радиус шара
// 660 px — шар примерно во всю высоту экрана), на узком экране телефона — не шире
// ~1,1 ширины экрана, иначе шар целиком не разглядеть
const GLOBE_MIN_RADIUS_PX = 660;
const GLOBE_MAX_SCREEN_SHARE = 1.1;

// Минимальный зум, при котором видимый диск глобуса не меньше нужного. MapLibre рисует
// шар радиусом worldSize / 2π / cos(широта центра), а камера (угол обзора 36,87°) стоит
// на расстоянии 1,5 высоты экрана от поверхности — из-за перспективы диск виден меньше
// радиуса шара. Проверено замером по пикселям холста с точностью до нескольких px
function minGlobeZoom(lat) {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const f = 1.5 * h;
  const diskOf = (r) => 2 * f * Math.tan(Math.asin(r / (f + r)));
  const disk = Math.min(diskOf(GLOBE_MIN_RADIUS_PX), GLOBE_MAX_SCREEN_SHARE * w);
  const t = disk / (2 * f);
  const s = t / Math.sqrt(1 + t * t);
  const radius = (f * s) / (1 - s);
  return Math.log2((radius * 2 * Math.PI * Math.cos((lat * Math.PI) / 180)) / 512);
}

// Переключается только после окончания движения: в режиме глобуса масштаб чуть меняется
// и при перетаскивании по широте, и отключение поворота посреди жеста мышью могло
// оставить обработчик мыши в "застрявшем" состоянии
function updateTiltLock() {
  const locked = metersPer100px() > TILT_MAX_METERS_PER_100PX;
  if (locked !== tiltLocked) {
    tiltLocked = locked;
    const toggle = locked ? "disable" : "enable";
    map.dragRotate[toggle]();
    map.touchPitch[toggle]();
    map.touchZoomRotate[locked ? "disableRotation" : "enableRotation"]();
    map.keyboard[locked ? "disableRotation" : "enableRotation"]();
  }
  // Выравниваем не прямо из moveend, а с паузой: moveend приходит изнутри кадра анимации
  // MapLibre, и новый easeTo оттуда ломает её внутреннюю очередь ("Attempting to run(),
  // but is already running") — отрисовка останавливается навсегда, глобус "виснет"
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settleGlobe, 300);
}

let settleTimer;
function settleGlobe() {
  // пока пользователь тащит или крутит карту — не перебиваем его; следующий moveend
  // после его жеста снова запланирует выравнивание
  if (map.isMoving()) return;
  // нижняя граница зума зависит от широты центра — при переезде к экватору шар мельчает,
  // тогда он плавно приближается до нужного размера, а колёсико дальше не отдаляет
  const minZoom = minGlobeZoom(map.getCenter().lat);
  const target = {};
  if (map.getZoom() < minZoom - 0.01) target.zoom = minZoom;
  // доли градуса не выпрямляем — иначе easeTo мог бы запускаться снова и снова
  if (tiltLocked && (Math.abs(map.getBearing()) > 0.1 || map.getPitch() > 0.1)) {
    target.bearing = 0;
    target.pitch = 0;
  }
  if (Object.keys(target).length) {
    // неспешно и с затуханием к концу, чтобы глобус мягко "вставал на место"
    map.easeTo({ ...target, duration: 2400, easing: (t) => 1 - (1 - t) ** 3 });
  } else {
    map.setMinZoom(minZoom);
  }
}

map.on("moveend", updateTiltLock);
map.on("resize", updateTiltLock);
// стартовый вид — сразу минимального размера, без анимации
map.jumpTo({ zoom: minGlobeZoom(map.getCenter().lat) });
map.setMinZoom(map.getZoom());
updateTiltLock();

// строка источников карты (обязательная по лицензиям OpenStreetMap, CARTO, Esri)
// по умолчанию свёрнута в кнопку ⓘ — MapLibre на широком экране раскрывает её сам
map.once("load", () => {
  const attrib = document.querySelector(".maplibregl-ctrl-attrib");
  attrib?.classList.remove("maplibregl-compact-show");
  attrib?.removeAttribute("open");
});

el("about-close-btn").addEventListener("click", closeAboutModal);
el("about-modal").addEventListener("click", (evt) => {
  if (evt.target.id === "about-modal") closeAboutModal();
});
document.addEventListener("keydown", (evt) => {
  if (evt.key === "Escape") closeAboutModal();
});

// "Установить на рабочий стол" — кнопка видна всегда, но включается только когда браузер
// сам решил, что приложение устанавливаемо, и прислал beforeinstallprompt (так же, как в
// photo-editor). Установленное приложение открывает localhost — сервер из start.bat
// должен быть запущен
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (evt) => {
  evt.preventDefault();
  deferredInstallPrompt = evt;
  el("install-btn").disabled = false;
});
el("install-btn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  el("install-btn").disabled = true;
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  el("install-btn").disabled = true;
});
// подсказка про start.bat нужна только при запуске с локального сервера, не на GitHub Pages
el("about-install-hint").hidden = !["localhost", "127.0.0.1"].includes(location.hostname);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
