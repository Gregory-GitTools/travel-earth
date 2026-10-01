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
// по умолчанию — Яркая
const DEFAULT_BASEMAP = BASEMAPS.find((b) => b.id === "liberty");
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
// с этого зума (шкала около 2 км) вместо картинок — свои линии троп с номерами: на
// ужатых вдвое картинках таблички с номерами нечитаемы — пустые квадратики или слипшиеся
// овалы. С 12 было поздно: на юге шкала «1 км» — это ещё зум 11,5
const TRAILS_VECTOR_ZOOM = 11;

// значки на кнопках слоёв — монохромные условные обозначения, как на картах, а не цветные
// эмодзи (Грегори: «ближе к общепринятым, а не как конфетки»); пляжи и сёрфинг — значки с карты
const chipSvg = (inner) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">${inner}</svg>`;
const BIKE_PATH = "M18.18 10l-1.7-4.68C16.19 4.53 15.44 4 14.6 4H12v2h2.6l1.46 4h-4.81l-.36-1H12V7H7v2h1.75l1.82 5H9.9c-.44-2.23-2.31-3.88-4.65-3.99C2.45 9.87 0 12.2 0 15c0 2.8 2.2 5 5 5 2.46 0 4.45-1.69 4.9-4h4.2c.44 2.23 2.31 3.88 4.65 3.99 2.8.13 5.25-2.19 5.25-5 0-2.8-2.2-5-5-5h-.82zM7.82 16c-.4 1.17-1.49 2-2.82 2-1.68 0-3-1.32-3-3s1.32-3 3-3c1.33 0 2.42.83 2.82 2H5v2h2.82zm6.28-2h-1.4l-.73-2H15c-.44.58-.76 1.25-.9 2zm4.9 4c-1.68 0-3-1.32-3-3 0-.93.41-1.73 1.05-2.28l.96 2.64 1.88-.68-.97-2.67c.03 0 .06-.01.09-.01 1.68 0 3 1.32 3 3s-1.33 3-3.01 3z";
const CHIP_ICONS = {
  hillshade: chipSvg('<path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/>'), // горы
  contours: chipSvg('<g fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 15c0-5 4.5-9.5 10-9.5s9 3.5 9 7.5-4 6.5-9.5 6.5S2.5 19 2.5 15z"/><path d="M6.5 14.5c0-3 2.8-5.5 6-5.5s5.3 2 5.3 4.2-2.5 3.8-5.5 3.8-5.8-.3-5.8-2.5z"/></g><circle cx="12.3" cy="13.4" r="1.5"/>'), // вершина в горизонталях
  terrain3d: chipSvg('<path d="M2 17.5l5 3.5h15l-5-3.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4.5 16.5l5-8 3 4.5 2.5-3 4.5 6.5z"/>'), // горы на плите блок-диаграммы
  hiking: chipSvg('<g transform="rotate(-12 7 15)"><ellipse cx="7" cy="16.5" rx="2.4" ry="4"/><circle cx="5.2" cy="10.9" r="1.05"/><circle cx="7.1" cy="10.4" r=".8"/><circle cx="8.6" cy="10.9" r=".7"/><circle cx="9.6" cy="11.9" r=".6"/></g><g transform="rotate(12 17 8)"><ellipse cx="17" cy="9.5" rx="2.4" ry="4"/><circle cx="18.8" cy="3.9" r="1.05"/><circle cx="16.9" cy="3.4" r=".8"/><circle cx="15.4" cy="3.9" r=".7"/><circle cx="14.4" cy="4.9" r=".6"/></g>'), // босые следы
  cycling: chipSvg(`<path d="${BIKE_PATH}"/>`),
  mtb: chipSvg(`<path d="M9 1.5l3.5 5h-7z"/><path d="M13.5 3.5l2.8 3h-4.2z" opacity=".75"/><path transform="translate(0 4) scale(1 .85)" d="${BIKE_PATH}"/>`), // велосипед под вершинами
  streets: chipSvg('<path fill-rule="evenodd" d="M1.2 6.4 17.6 2.2c.9-.2 1.5.1 1.7.9l.2.7-17.9 4.6zM2.2 8.9 19.6 4.4l.9 3.6c.3 1.1-.2 1.8-1.2 2.1L6.4 13.4c-2.3.6-3.6-.2-4-1.7zM7.9 10.6a2.6 2.6 0 1 0-5.2 0 2.6 2.6 0 0 0 5.2 0z"/><circle cx="5.3" cy="10.6" r="1.1"/><path d="M11 12.3h2.6v4.2h5.4v2.6h-6.7c-.7 0-1.3-.6-1.3-1.3z"/><path fill-rule="evenodd" d="M19.6 12.6h2.2c.6 0 1 .4 1 1v8c0 .6-.4 1-1 1h-2.2zM21.2 14.4a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2zm0 5.2a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2z"/>'), // уличная камера на кронштейне (Грегори выбрал по картинке)
  myphotos: chipSvg('<path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4 2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>'), // стопка снимков — альбом
  tours: chipSvg('<path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>'), // сложенная карта — план поездки
  photos: chipSvg('<path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>'), // фотоаппарат
  railways: chipSvg('<path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>'), // поезд, как у флажков станций
};

const OVERLAYS = [
  { id: "hillshade", name: "Рельеф", icon: CHIP_ICONS.hillshade, hint: "Тени склонов — горы становятся объёмными", layers: ["ov-hillshade"] },
  { id: "contours", name: "Горизонтали", icon: CHIP_ICONS.contours, hint: "Линии равной высоты с подписями в метрах",
    layers: ["ov-contours", "ov-contour-labels"], available: () => !!demSource },
  { id: "terrain3d", name: "3D-рельеф", icon: CHIP_ICONS.terrain3d, hint: "Настоящий объёмный рельеф — наклоните карту (правая кнопка мыши или два пальца)", layers: [] },
  { id: "hiking", name: "Пешие тропы", icon: CHIP_ICONS.hiking, hint: "Маркированные пешие маршруты — видны с масштаба около 10 км, вблизи — с номерами", trails: "hiking",
    layers: ["ov-hiking", "ov-hiking-line", "ov-hiking-label"] },
  { id: "cycling", name: "Велодорожки", icon: CHIP_ICONS.cycling, hint: "Веломаршруты — видны с масштаба около 10 км, вблизи — с номерами", trails: "cycling",
    layers: ["ov-cycling", "ov-cycling-line", "ov-cycling-label"] },
  { id: "mtb", name: "Маунтинбайк", icon: CHIP_ICONS.mtb, hint: "Маршруты для горного велосипеда — видны с масштаба около 10 км, вблизи — с номерами", trails: "mtb",
    layers: ["ov-mtb", "ov-mtb-line", "ov-mtb-label"] },
  { id: "beaches", name: "Пляжи", icon: "", hint: "Пляжи — видны с масштаба 10 км", layers: ["ov-beaches"] },
  { id: "surf", name: "Сёрфинг", icon: "", hint: "Места для сёрфинга, кайта и виндсёрфинга по всему миру — видны на любом масштабе",
    layers: ["ov-surf"] },
  { id: "photos", name: "Фото", icon: CHIP_ICONS.photos,
    hint: "Общедоступные фотографии мест из Wikimedia Commons — точками с масштаба 3 км, снимками с 1 км и лентой внизу",
    layers: ["ov-photo-selected", "ov-photos", "ov-photo-dots"] },
  { id: "myphotos", name: "Мои фото", icon: CHIP_ICONS.myphotos,
    hint: "Фотографии из папки на этом компьютере (выбирается в ⚙ настройках) — альбомы видны на всём глобусе",
    layers: ["ov-my-selected", "ov-my-photos", "ov-my-dots", "ov-my-albums"], available: () => "showDirectoryPicker" in window },
  { id: "tours", name: "Экскурсии", icon: CHIP_ICONS.tours,
    hint: "Наброски будущих путешествий из текстовых файлов в своей папке (выбирается в ⚙ настройках) — маршрут, точки, справки",
    layers: ["ov-tour-labels", "ov-tour-marks", "ov-tour-sel", "ov-tour-stops", "ov-tour-route"], available: () => "showDirectoryPicker" in window,
    // кнопки в «Слоях» нет (Грегори): экскурсии видны всегда, вход к ним — значок карты в строке поиска
    hidden: true },
  { id: "mapillary", name: "Снимки улиц", icon: CHIP_ICONS.streets,
    hint: "Снимки и панорамы улиц и дорог из Mapillary — линии со шкалы 1 км, точки снимков со 100 м; двойной щелчок — просмотр",
    layers: ["ov-mly-pos", "ov-mly-images", "ov-mly-lines"] },
  { id: "railways", name: "Железные дороги", icon: CHIP_ICONS.railways, hint: "Поезда, метро, трамваи и фуникулёры — каждый своим цветом",
    layers: ["ov-rail-tunnel", "ov-rail"] },
];
const OVERLAYS_STORAGE_KEY = "travel-earth.overlays";
const activeOverlays = new Set(JSON.parse(localStorage.getItem(OVERLAYS_STORAGE_KEY) || "[]"));
if (!("showDirectoryPicker" in window)) activeOverlays.delete("tours");

// шрифт подписей высот — тот же, что у подписей самой карты: у каждого стиля свой
// сервер шрифтов, и чужого шрифта на нём может не быть
function styleFont() {
  const layer = map.getStyle().layers.find((l) => l.type === "symbol" && Array.isArray(l.layout?.["text-font"]));
  return layer ? layer.layout["text-font"] : ["Noto Sans Regular"];
}

// слои встают под подписи карты (флажки мест и так выше — они добавляются последними)
const firstLabelLayer = () => map.getStyle().layers.find((l) => l.type === "symbol")?.id;
const darkBasemap = () => currentBasemap.id === "satellite" || currentBasemap.id === "dark";

// Вблизи тропы рисуются самим. На картинке линия и номер маршрута нарисованы вместе и
// растут вместе — получалась широкая мутная полоса. Свои линии тонкие, как у железных
// дорог, а номер растёт с приближением. Маршруты берутся у того же Waymarked Trails, что
// и картинки: список маршрутов в квадрате (by_area) и их линии, уже обрезанные по
// квадрату (segments) — меньше секунды на квадрат. Раньше был Overpass: 1–4 с, частые
// 429/504, и тропы появлялись кусками. Квадраты по TRAIL_CELL градусов, каждый — один раз,
// в TRAIL_STREAMS очереди, начиная с ближайших к центру. На большом экране при зуме 11 в
// кадре до ~32 квадратов — прежний предел 16 оставлял края пустыми
const TRAIL_CELL = 0.1;
const TRAIL_MAX_CELLS = 40;
const TRAIL_STREAMS = 3;
const TRAIL_RETRY_MS = 30000;
const TRAIL_NAME_MAX = 16;
// цвет по значимости маршрута (group у Waymarked Trails): международный, национальный,
// региональный, местный
const TRAIL_LEVELS = { INT: { color: "#c62828", rank: 4 }, NAT: { color: "#1e53c7", rank: 3 },
  REG: { color: "#ef8a00", rank: 2 }, LOC: { color: "#8e24aa", rank: 1 } };
const trailCells = new Map(); // "hiking:247:594" → true | "loading" | когда можно повторить
const trailFeatures = { hiking: new Map(), cycling: new Map(), mtb: new Map() }; // "маршрут:квадрат:кусок" → feature
const trailQueues = Array.from({ length: TRAIL_STREAMS }, () => Promise.resolve());
let trailNextQueue = 0;
// новые данные передаются карте ещё раз на ближайшем idle: если они пришли, пока источник
// ещё обрабатывал прежние, MapLibre иногда оставлял тайлы пустыми
const trailDirty = new Set();

const trailData = (id) => ({ type: "FeatureCollection", features: [...trailFeatures[id].values()] });
// номера троп — под флажками мест, но над подписями карты
const firstPoiLayer = () => map.getStyle().layers.find((l) => POI_LAYERS.includes(l.id))?.id;

function addTrailLines(id, before) {
  map.addSource(`ov-${id}-vec`, { type: "geojson", data: trailData(id) });
  map.addLayer({ id: `ov-${id}-line`, type: "line", source: `ov-${id}-vec`, minzoom: TRAILS_VECTOR_ZOOM,
    layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "rank"] },
    paint: { "line-color": ["get", "color"], "line-opacity": 0.85,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.5, 12, 1.8, 14, 2.5, 17, 4, 20, 6] } }, before);
  // номер — табличка цвета маршрута без каймы, всегда горизонтальная: текст вдоль петляющей горной
  // тропы MapLibre почти нигде не ставит (изгиб круче text-max-angle)
  for (const level of Object.values(TRAIL_LEVELS)) plateImage(level.color);
  map.addLayer({ id: `ov-${id}-label`, type: "symbol", source: `ov-${id}-vec`, minzoom: TRAILS_VECTOR_ZOOM,
    filter: ["has", "label"],
    layout: { "symbol-placement": "line", "symbol-spacing": 200, "text-max-angle": 360,
      "text-rotation-alignment": "viewport", "icon-rotation-alignment": "viewport",
      "text-field": ["get", "label"], "text-font": styleFont(), "text-max-width": 12,
      "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 12, 11, 14, 12, 17, 15, 20, 20],
      "icon-image": ["concat", "plate-", ["get", "color"]], "icon-text-fit": "both", "icon-text-fit-padding": [1, 3, 0, 3] },
    paint: { "text-color": "#fff" } }, firstPoiLayer());
  addTrailPoi();
  raiseTrailPoi();
}

// фото — ниже всех своих значков: миниатюры крупные и закрывали бы их.
// Значки у троп — над линиями и табличками всех троп (другой вид троп может включиться
// позже и встать выше) и над подписями карты, а вышки, площадки, маяки и пикник — над
// остальными значками. Верхний слой и расставляется первым: при тесноте уступают нижние
// (Грегори: «наши приоритеты должны быть сверху»)
const TRAIL_POI_ORDER = ["ov-mly-lines", "ov-mly-images", "ov-mly-pos", "ov-photo-dots", "ov-photos", "ov-photo-selected",
  "ov-my-dots", "ov-my-photos", "ov-my-selected", "ov-my-albums", "ov-trail-poi-near", "ov-trail-poi-near-far", "ov-trail-poi-extra-near", "ov-beaches",
  "ov-trail-poi", "ov-trail-poi-extra", "ov-trail-poi-far", "ov-surf"];
function raiseTrailPoi() {
  for (const id of TRAIL_POI_ORDER) if (map.getLayer(id)) map.moveLayer(id, firstPoiLayer());
  // экскурсии — поверх всего, даже флажков мест и снимков (Грегори: их номера тонули в точках фото)
  for (const id of TOUR_TOP_ORDER) if (map.getLayer(id)) map.moveLayer(id);
}
const TOUR_TOP_ORDER = ["ov-tour-route", "ov-tour-stops", "ov-tour-sel", "ov-tour-marks", "ov-tour-labels"];

// Значки у троп — указатели и щиты «i», навесы, места для костра и пикника, кемпинги,
// вода. В основе карты они появляются только с зума 15–17 (по рангу), в тайлах есть с 14 —
// оттуда свой слой, общий для пеших, вело и МТБ. Мельче 14 в тайлах этих точек нет,
// поэтому со шкалы 3 км (trailPoiMinZoom) они подгружаются из QLever квадратами по
// полградуса, одной очередью после троп. QLever отвечает 8–17 с (Overpass, который был
// раньше, часто не отвечал вовсе); при ошибке значки просто появятся позже или только
// с 14 (Грегори: «если не успеют, то и не очень надо»), без сообщений. Туалеты и достопримечательности — только
// из тайлов: в городах их слишком много. Смотровых вышек, кострищ и маяков в тайлах нет (маяк там —
// обычная «достопримечательность», и только с 14) — они
// только из QLever, зато на любом зуме. Метки краской на деревьях (route_marker) не
// показываем: их десятки на каждой тропе. Навесы тоже: почти все — остановки автобуса.
// Значки свои, в одном стиле: символ цвета группы в белой обводке, без кружка (viewBox 24×24)
const TRAIL_POI_ZOOM = 14;
// вышки, смотровые площадки, маяки и места для пикника видны, как только шкала показывает
// 3 км и меньше (до 5 км в 100 px, см. AIRPORT_MAX_METERS_PER_100PX) — раньше табличек троп;
// остальные — со «500 м» (до 1 км в 100 px; Грегори: «давай на 500 м»; 3 км — слишком
// густо). Пороги зависят от широты
const TRAIL_POI_MAX_METERS_PER_100PX = 5000;
const TRAIL_POI_NEAR_MAX_METERS_PER_100PX = 1000;
const TRAIL_POI_FAR_KINDS = ["tower", "viewpoint", "lighthouse", "picnic_site"];
const trailPoiMinZoom = () => Math.min(zoomForScale(TRAIL_POI_MAX_METERS_PER_100PX), TRAIL_POI_ZOOM);
const trailPoiNearZoom = () => Math.min(zoomForScale(TRAIL_POI_NEAR_MAX_METERS_PER_100PX), TRAIL_POI_ZOOM);
const TRAIL_POI_CLASSES = ["information", "picnic_site", "campsite", "drinking_water", "attraction", "toilets"];
const TRAIL_POI_RETRY_MS = 60000;
const TRAIL_POI_CELL = 0.5;
const QLEVER_URL = "https://qlever.dev/api/osm-planet";
const BRIGHT_YELLOW = "#ffd600";
const TRAIL_POI_ICONS = {
  // информация — светло-синие, щиты и карты — серые: их много
  info: { color: "#6a9fe0", path: "M10.2 9.5h3.6V20h-3.6z M12 3.5a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z" },
  guidepost: { color: "#6a9fe0", path: "M11 2h2v20h-2z M4 4h12l3 2.75L16 9.5H4z M20 11.5H8l-3 2.75L8 17h12z" },
  board: { color: "#8a9099", path: "M3 4h18v11H3z M6.5 15h2v6h-2z M15.5 15h2v6h-2z" },
  map: { color: "#8a9099", evenodd: true,
    path: "M2.5 6.5L9 4l6 2.5L21.5 4v13.5L15 20l-6-2.5-6.5 2.5z M8.3 5.5h1.4v12H8.3z M14.3 8h1.4v12h-1.4z" },
  // виды — зелёные
  // смотровая площадка — «красивый вид»: точка с веером лучей
  viewpoint: { color: "#2e7d32", path: "M12 16.9a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z " +
    "M8 17.2L0.8 12.8L-0.5 15.7L7.6 18.1z M9.9 15.4L6.3 7.7L3.6 9.5L9.1 15.9z M12.5 14.9L13.6 6.5L10.4 6.5L11.5 14.9z " +
    "M14.9 15.9L20.4 9.5L17.7 7.7L14.1 15.4z M16.4 18.1L24.5 15.7L23.2 12.8L16 17.2z" },
  tower: { color: "#2e7d32", path: "M5 2h14l-2 2.5v1.5H7V4.5z M8 6h2.2L8.2 22H6z M13.8 6H16l2 16h-2.2z " +
    "M8.5 10.5h7v1.6h-7z M7.8 15.5h8.4v1.6H7.8z" },
  attraction: { color: "#2e7d32", path: "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" },
  // стоянки — коричневые, палатка — светло-зелёная, кострище — красное
  campsite: { color: "#7cb342", path: "M12 3L1.5 21H9l3-6 3 6h7.5z" },
  picnic_site: { color: "#8d5a2b", path: "M3 6h18v2.6H3z M6.3 8.6h2.4L6.4 20H4z M15.3 8.6h2.4L20 20h-2.4z M2 13h20v2.2H2z" },
  firepit: { color: "#d32f2f", path: "M12 2c1 4 6.5 6 6.5 12.5a6.5 6.5 0 0 1-13 0c0-3.2 1.8-5.3 3-6.5 0 2.2 1 3.5 2.3 3.5C10.5 8 10 5 12 2z" },
  // вода и туалет — голубые
  drinking_water: { color: "#0288d1", path: "M12 2.5S5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-7-12.5-7-12.5z" },
  toilets: { color: "#0288d1", text: "WC" },
  // пляж — наклонный зонтик на песке, сёрфинг — кайтер; оба ярко-жёлтые (Грегори): воздушный змей, стропы, райдер на доске
  beach: { color: BRIGHT_YELLOW, path: "M1.53 16.1A8.5 8.5 0 0 1 16.55 8.12A2.83 2.83 0 0 0 11.54 10.78A2.83 2.83 0 0 0 6.54 13.44" +
    "A2.83 2.83 0 0 0 1.53 16.1z M8.29 12.51L9.79 11.71L14.25 20.1L12.75 20.9z M2 20h20v2.5H2z" },
  kitesurfing: { color: BRIGHT_YELLOW, path: "M11.5 4.2Q17.5 -0.4 23.5 5.2L21.8 6.9Q17.5 3.1 12.7 6z M11.83 5.20L11.93 12.60L12.47 12.60L12.37 5.20z M22.45 " +
    "5.87L12.05 12.37L12.35 12.83L22.75 6.33z M7.60 7.65a1.75 1.75 0 1 1 0 3.50a1.75 1.75 0 1 1 0 -3.50z M7.22 " +
    "11.26L5.22 15.66L7.58 16.74L9.58 12.34z M8.27 12.44L12.07 13.24L12.33 11.96L8.53 11.16z M6.10 17.10L9.10 " +
    "18.10L9.70 16.30L6.70 15.30z M8.79 17.79L10.99 20.09L12.21 18.91L10.01 16.61z M5.50 16.51L6.90 20.51L8.70 " +
    "19.89L7.30 15.89z M1.98 21.13L15.77 18.70L16.48 19.28L16.02 20.07L2.23 22.50L1.52 21.92z" },
  // маяк — чёрно-белый: купол, фонарь с лучами, башня; окошко и полосы — white
  lighthouse: { color: "#222", path: "M9 5a3 3 0 0 1 6 0z M9.5 5h5v3h-5z M8 8h8v1.5H8z M9.2 9.5h5.6l1.5 10.5H7.7z " +
    "M6 20h12v2H6z M9 6.5L3 3.5v6z M15 6.5l6-3v6z",
    white: "M10.7 5.8h2.6v1.5h-2.6z M9 12.5h6v1.8H9z M8.6 16.3h6.8v1.8H8.6z" },
};
// на кнопках «Пляжи» и «Сёрфинг» — те же значки, что на карте
const glyphSvg = (kind) => `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="${TRAIL_POI_ICONS[kind].color}" d="${TRAIL_POI_ICONS[kind].path}"/></svg>`;
OVERLAYS.find((o) => o.id === "beaches").icon = glyphSvg("beach");
OVERLAYS.find((o) => o.id === "surf").icon = glyphSvg("kitesurfing");
// вид точки из тайла: class, а у информации и достопримечательностей — ещё и subclass
const TRAIL_POI_KIND = ["match", ["get", "class"],
  "information", ["match", ["get", "subclass"], ["guidepost", "board", "map"], ["get", "subclass"], "info"],
  "attraction", ["match", ["get", "subclass"], "viewpoint", "viewpoint", "attraction"],
  ["get", "class"]];
// только в QLever — их слои видны и там, где уже есть тайлы
const TRAIL_POI_OVERPASS_ONLY = ["tower", "lighthouse"];
const TRAIL_POI_OVERPASS_ONLY_NEAR = ["firepit"];
const TRAIL_POI_LAYERS = ["ov-trail-poi", "ov-trail-poi-near", "ov-trail-poi-far", "ov-trail-poi-near-far",
  "ov-trail-poi-extra", "ov-trail-poi-extra-near"];
const trailPoiCells = new Map(); // "247:594" → true | "loading" | когда можно повторить
const trailPoiFeatures = new Map(); // "node/123" → feature
const trailPoiTags = new Map(); // "node/123" или id тайла → теги OSM, для подсказки
let trailPoiQueue = Promise.resolve();
const trailOverlayActive = () => OVERLAYS.some((o) => o.trails && activeOverlays.has(o.id));
const trailPoiData = () => ({ type: "FeatureCollection", features: [...trailPoiFeatures.values()] });

function addTrailPoi() {
  if (map.getLayer("ov-trail-poi")) return;
  for (const kind of Object.keys(TRAIL_POI_ICONS)) trailPoiImage(kind);
  const icon = ["concat", "trail-poi-", ["get", "kind"]];
  const tileIcon = ["concat", "trail-poi-", TRAIL_POI_KIND];
  const nearSize = ["interpolate", ["linear"], ["zoom"], 14, 1, 16, 1.2];
  const far = ["literal", TRAIL_POI_FAR_KINDS];
  const tileFilter = ["all", ["in", ["get", "class"], ["literal", TRAIL_POI_CLASSES]], ["!=", ["get", "subclass"], "route_marker"]];
  const layers = [
    { id: "ov-trail-poi", source: "te-poi", always: true, minzoom: TRAIL_POI_ZOOM, filter: ["all", tileFilter, ["in", TRAIL_POI_KIND, far]] },
    { id: "ov-trail-poi-near", source: "te-poi", minzoom: TRAIL_POI_ZOOM, filter: ["all", tileFilter, ["!", ["in", TRAIL_POI_KIND, far]]] },
    { id: "ov-trail-poi-far", always: true, minzoom: trailPoiMinZoom(), maxzoom: TRAIL_POI_ZOOM, filter: ["in", ["get", "kind"], far],
      size: ["interpolate", ["linear"], ["zoom"], 11, 0.8, 14, 1] },
    { id: "ov-trail-poi-near-far", minzoom: trailPoiNearZoom(), maxzoom: TRAIL_POI_ZOOM,
      filter: ["!", ["in", ["get", "kind"], ["literal", [...TRAIL_POI_FAR_KINDS, ...TRAIL_POI_OVERPASS_ONLY_NEAR]]]] },
    { id: "ov-trail-poi-extra", always: true, minzoom: TRAIL_POI_ZOOM, filter: ["in", ["get", "kind"], ["literal", TRAIL_POI_OVERPASS_ONLY]] },
    { id: "ov-trail-poi-extra-near", minzoom: trailPoiNearZoom(), filter: ["in", ["get", "kind"], ["literal", TRAIL_POI_OVERPASS_ONLY_NEAR]] },
  ];
  map.addSource("ov-trail-poi-far", { type: "geojson", data: trailPoiData() });
  for (const { id, source = "ov-trail-poi-far", size = nearSize, maxzoom = 24, always = false, ...rest } of layers) {
    map.addLayer({ id, type: "symbol", source, ...(source === "te-poi" && { "source-layer": "poi" }), maxzoom, ...rest,
      // дальних видов немного — не прячем их за табличками троп и подписями карты
      layout: { "icon-image": source === "te-poi" ? tileIcon : icon, "icon-size": size, "icon-allow-overlap": always } }, firstPoiLayer());
  }
}

function trailPoiImage(kind) {
  if (map.hasImage(`trail-poi-${kind}`)) return;
  const { color, path, text, evenodd, white } = TRAIL_POI_ICONS[kind];
  // без белой обводки — с ней значки выглядели размытыми (Грегори)
  const size = 56; // pixelRatio 2: символ 24 px и поле по краям
  const ctx = Object.assign(document.createElement("canvas"), { width: size, height: size }).getContext("2d");
  ctx.fillStyle = color;
  if (text) {
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 28, 29);
  } else {
    // символ 24×24 → 48 px в двойном размере
    ctx.translate(4, 4);
    ctx.scale(2, 2);
    const shape = new Path2D(path);
    ctx.fill(shape, evenodd ? "evenodd" : "nonzero");
    if (white) {
      ctx.fillStyle = "#fff";
      ctx.fill(new Path2D(white));
    }
  }
  map.addImage(`trail-poi-${kind}`, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
}

// QLever (SPARQL по всему OSM) отвечает за 8–17 с почти независимо от размера квадрата —
// поэтому квадраты по полградуса. Тегов он не отдаёт — они для подсказки берутся из OSM API.
// body — условия на ?osm и ?kind; в ответе — центр объекта (у площадных — центроид)
const qleverQuery = (select, body, w, s, e, n) => `PREFIX osmkey: <https://www.openstreetmap.org/wiki/Key:>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?osm ?c ?kind ${select} WHERE {
  ${body}
  ?osm geo:hasGeometry/geo:asWKT ?wkt .
  BIND (geof:centroid(?wkt) AS ?c)
  FILTER (geof:latitude(?c) > ${s} && geof:latitude(?c) < ${n} && geof:longitude(?c) > ${w} && geof:longitude(?c) < ${e})
}`;

// точки квадрата со стороной cell градусов: [{ osm: "node/123", coordinates, b — вся строка ответа }]
async function loadQleverCell(cx, cy, select, body, cell = TRAIL_POI_CELL) {
  const [w, s, e, n] = [cx, cy, cx + 1, cy + 1].map((v) => (v * cell).toFixed(2));
  const res = await fetch(QLEVER_URL, { method: "POST", headers: { Accept: "application/sparql-results+json" },
    body: new URLSearchParams({ query: qleverQuery(select, body, w, s, e, n) }), signal: AbortSignal.timeout(40000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).results.bindings.map((b) => ({ b,
    osm: b.osm.value.replace(/^.*\/(node|way|relation)\/(\d+)$/, "$1/$2"),
    coordinates: b.c.value.match(/-?[\d.]+/g).map(Number) }));
}

// квадраты со стороной cell в кадре (не дальше reach градусов от центра), ближние первыми
function qleverCells(cell = TRAIL_POI_CELL, reach = 0.5) {
  const center = map.getCenter();
  const bounds = map.getBounds();
  const range = (min, max, c) => [Math.floor(Math.max(min, c - reach) / cell), Math.floor(Math.min(max, c + reach) / cell)];
  const [x0, x1] = range(bounds.getWest(), bounds.getEast(), center.lng);
  const [y0, y1] = range(bounds.getSouth(), bounds.getNorth(), center.lat);
  const cells = [];
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      cells.push([cx, cy, Math.hypot((cx + 0.5) * cell - center.lng, (cy + 0.5) * cell - center.lat)]);
    }
  }
  return cells.sort((a, b) => a[2] - b[2]);
}

const TRAIL_POI_SPARQL = `{ ?osm osmkey:tourism "viewpoint" . BIND("viewpoint" AS ?kind) }
  UNION { ?osm osmkey:tourism "picnic_site" . BIND("picnic_site" AS ?kind) }
  UNION { ?osm osmkey:tourism "camp_site" . BIND("campsite" AS ?kind) }
  UNION { ?osm osmkey:man_made "lighthouse" . BIND("lighthouse" AS ?kind) }
  UNION { ?osm osmkey:man_made "tower" . ?osm <https://www.openstreetmap.org/wiki/Key:tower:type> "observation" . BIND("tower" AS ?kind) }
  UNION { ?osm osmkey:amenity "drinking_water" . BIND("drinking_water" AS ?kind) }
  UNION { ?osm osmkey:leisure "firepit" . BIND("firepit" AS ?kind) }
  UNION { ?osm osmkey:tourism "information" . BIND("info" AS ?kind) OPTIONAL { ?osm osmkey:information ?info } }`;

async function loadTrailPoiCell(cx, cy) {
  const key = `${cx}:${cy}`;
  try {
    for (const { osm, coordinates, b } of await loadQleverCell(cx, cy, "?info", TRAIL_POI_SPARQL)) {
      let kind = b.kind.value;
      if (kind === "info") {
        const info = b.info?.value;
        if (info === "route_marker") continue;
        if (["guidepost", "board", "map"].includes(info)) kind = info;
      }
      trailPoiFeatures.set(osm, { type: "Feature", geometry: { type: "Point", coordinates }, properties: { kind, osm } });
    }
    trailPoiCells.set(key, true);
    map.getSource("ov-trail-poi-far")?.setData(trailPoiData());
  } catch {
    trailPoiCells.set(key, Date.now() + TRAIL_POI_RETRY_MS);
    // повтор — сам: если стоять на месте, значки всё-таки появятся
    setTimeout(updateTrails, TRAIL_POI_RETRY_MS + 100);
  }
}

// табличка с закруглёнными углами, растягивается под номер (icon-text-fit)
function plateImage(color) {
  const id = `plate-${color}`;
  if (map.hasImage(id)) return;
  const size = 24; // pixelRatio 2
  const ctx = Object.assign(document.createElement("canvas"), { width: size, height: size }).getContext("2d");
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 6);
  ctx.fillStyle = color;
  ctx.fill();
  map.addImage(id, ctx.getImageData(0, 0, size, size),
    { pixelRatio: 2, stretchX: [[8, 16]], stretchY: [[8, 16]], content: [6, 5, 18, 19] });
}

// Waymarked Trails считает в метрах проекции Меркатора (EPSG:3857)
const toMercator = ([lng, lat]) => [lng * 20037508.34 / 180,
  Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 6378137];
const fromMercator = ([x, y]) => [x * 180 / 20037508.34,
  (Math.atan(Math.exp(y / 6378137)) * 360) / Math.PI - 90];

async function waymarked(id, path) {
  const res = await fetch(`https://${id}.waymarkedtrails.org/api/v1/list/${path}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Waymarked Trails: ${res.status}`);
  return res.json();
}

async function loadTrailCell(id, cx, cy) {
  const key = `${id}:${cx}:${cy}`;
  const bbox = [...toMercator([cx * TRAIL_CELL, cy * TRAIL_CELL]), ...toMercator([(cx + 1) * TRAIL_CELL, (cy + 1) * TRAIL_CELL])]
    .map(Math.round).join(",");
  try {
    const routes = new Map((await waymarked(id, `by_area?bbox=${bbox}&limit=100`)).results.map((r) => [r.id, r]));
    const segments = routes.size ? (await waymarked(id, `segments?bbox=${bbox}&relations=${[...routes.keys()].join(",")}`)).features : [];
    for (const seg of segments) {
      const route = routes.get(seg.id);
      if (!route) continue;
      const level = TRAIL_LEVELS[route.group] || TRAIL_LEVELS.LOC;
      // название — только короткое: длинное («Camí de Sant Jaume (…)») на табличку не влезает
      const label = route.ref || (route.name?.length <= TRAIL_NAME_MAX && route.name);
      const lines = seg.geometry.type === "LineString" ? [seg.geometry.coordinates] : seg.geometry.coordinates;
      lines.forEach((line, i) => trailFeatures[id].set(`${seg.id}:${key}:${i}`, { type: "Feature",
        geometry: { type: "LineString", coordinates: line.map(fromMercator) },
        properties: { color: level.color, rank: level.rank, ...(label && { label }) } }));
    }
    trailCells.set(key, true);
    trailDirty.add(id);
    map.getSource(`ov-${id}-vec`)?.setData(trailData(id));
  } catch {
    trailCells.set(key, Date.now() + TRAIL_RETRY_MS);
    // повтор — сам, не дожидаясь, пока карту сдвинут
    setTimeout(updateTrails, TRAIL_RETRY_MS + 100);
    flashStatus("Тропы сейчас не загрузились — сервер занят, чуть позже попробую ещё раз");
  }
}

function updateTrails() {
  for (const id of trailDirty) map.getSource(`ov-${id}-vec`)?.setData(trailData(id));
  trailDirty.clear();
  const trailsOn = map.getZoom() >= TRAILS_VECTOR_ZOOM;
  if (!trailsOn && !(trailOverlayActive() && map.getZoom() >= trailPoiMinZoom())) return;
  const center = map.getCenter();
  const bounds = map.getBounds();
  // у наклонённой карты граница уходит к горизонту — берём не дальше полуградуса от центра
  const range = (min, max, c) => [Math.floor(Math.max(min, c - 0.5) / TRAIL_CELL), Math.floor(Math.min(max, c + 0.5) / TRAIL_CELL)];
  const [x0, x1] = range(bounds.getWest(), bounds.getEast(), center.lng);
  const [y0, y1] = range(bounds.getSouth(), bounds.getNorth(), center.lat);
  const cells = [];
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      cells.push([cx, cy, Math.hypot((cx + 0.5) * TRAIL_CELL - center.lng, (cy + 0.5) * TRAIL_CELL - center.lat)]);
    }
  }
  cells.sort((a, b) => a[2] - b[2]);
  for (const o of OVERLAYS) {
    if (!trailsOn || !o.trails || !activeOverlays.has(o.id)) continue;
    for (const [cx, cy] of cells.slice(0, TRAIL_MAX_CELLS)) {
      const key = `${o.id}:${cx}:${cy}`;
      const state = trailCells.get(key);
      if (state === true || state === "loading" || state > Date.now()) continue;
      trailCells.set(key, "loading");
      const q = trailNextQueue++ % TRAIL_STREAMS;
      trailQueues[q] = trailQueues[q].then(() => loadTrailCell(o.id, cx, cy));
    }
  }
  // значки у троп — после самих троп; на любом зуме: вышек и кострищ в тайлах нет
  if (!trailOverlayActive()) return;
  const after = Promise.all(trailQueues);
  for (const [cx, cy] of qleverCells()) {
    const key = `${cx}:${cy}`;
    const state = trailPoiCells.get(key);
    if (state === true || state === "loading" || state > Date.now()) continue;
    trailPoiCells.set(key, "loading");
    trailPoiQueue = Promise.all([trailPoiQueue, after]).then(() => loadTrailPoiCell(cx, cy));
  }
}
map.on("idle", updateTrails);

// ---------- пляжи ----------

// Пляжи (natural=beach, leisure=beach_resort) — значками в центре объекта, со шкалы 10 км
// (до 20 км в 100 px; Грегори: «подними видимость повыше» — 3 км было мало). В тайлах
// OpenFreeMap их нет (пляж там — только песок без названия), поэтому всё из QLever, своей
// очередью. Кадр на «10 км» — пара градусов, поэтому квадраты по 2° (QLever отвечает за то
// же время, на побережье ~400 пляжей в квадрате) и до 1,5° от центра
const BEACH_MAX_METERS_PER_100PX = 20000;
const BEACH_CELL = 2;
const beachMinZoom = () => zoomForScale(BEACH_MAX_METERS_PER_100PX);
const BEACH_SPARQL = `{ ?osm osmkey:natural "beach" . BIND("beach" AS ?kind) }
  UNION { ?osm osmkey:leisure "beach_resort" . BIND("beach_resort" AS ?kind) }`;
const BEACH_LAYERS = ["ov-beaches"];
const beachCells = new Map(); // "3:83" → true | "loading" | когда можно повторить
const beachFeatures = new Map(); // "way/123" → feature
let beachQueue = Promise.resolve();
const beachData = () => ({ type: "FeatureCollection", features: [...beachFeatures.values()] });

function addBeaches(before) {
  trailPoiImage("beach");
  map.addSource("ov-beaches", { type: "geojson", data: beachData() });
  map.addLayer({ id: "ov-beaches", type: "symbol", source: "ov-beaches", minzoom: beachMinZoom(),
    layout: { "icon-image": "trail-poi-beach", "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.75, 14, 1, 16, 1.2] } }, before);
  raiseTrailPoi();
}

async function loadBeachCell(cx, cy) {
  const key = `${cx}:${cy}`;
  try {
    for (const { osm, coordinates, b } of await loadQleverCell(cx, cy, "", BEACH_SPARQL, BEACH_CELL)) {
      beachFeatures.set(osm, { type: "Feature", geometry: { type: "Point", coordinates }, properties: { kind: b.kind.value, osm } });
    }
    beachCells.set(key, true);
    map.getSource("ov-beaches")?.setData(beachData());
  } catch {
    beachCells.set(key, Date.now() + TRAIL_POI_RETRY_MS);
    setTimeout(updateBeaches, TRAIL_POI_RETRY_MS + 100);
  }
}

function updateBeaches() {
  if (!activeOverlays.has("beaches") || map.getZoom() < beachMinZoom()) return;
  for (const [cx, cy] of qleverCells(BEACH_CELL, 1.5)) {
    const key = `${cx}:${cy}`;
    const state = beachCells.get(key);
    if (state === true || state === "loading" || state > Date.now()) continue;
    beachCells.set(key, "loading");
    beachQueue = beachQueue.then(() => loadBeachCell(cx, cy));
  }
}
map.on("idle", updateBeaches);

// ---------- сёрфинг ----------

// Места для сёрфинга, кайта и виндсёрфинга (sport=…) — по всему миру и на любом масштабе
// (Грегори: «неограниченная видимость»). В OSM их всего ~1900, QLever отдаёт весь мир
// одним запросом за 1–2 с — грузим один раз при включении. К ним — кайт-споты Эстонии из
// списка Грегори в Google Картах (surf-spots.json, «Kite spots Estoni»): точка OSM ближе
// 300 м к точке списка не рисуется, чтобы не было двух значков. Вблизи друг друга значки
// прореживаются, точки списка остаются первыми
const SURF_KINDS = ["surfing", "kitesurfing", "windsurfing"];
const SURF_SPARQL = `?osm osmkey:sport ?kind . FILTER (?kind IN (${SURF_KINDS.map((k) => `"${k}"`).join(", ")}))`;
let surfOsm = null; // точки OSM, когда загружены
let surfList = null; // точки списка
let surfLoading = false;

function surfData() {
  const list = surfList || [];
  const near = ([lon, lat]) => list.some((f) => {
    const [lon2, lat2] = f.geometry.coordinates;
    return Math.hypot((lon - lon2) * Math.cos(lat * Math.PI / 180), lat - lat2) < 0.0027;
  });
  return { type: "FeatureCollection", features: [...list, ...(surfOsm || []).filter((f) => !near(f.geometry.coordinates))] };
}

async function loadSurf() {
  if (surfLoading) return;
  surfLoading = true;
  if (!surfList) {
    try {
      const spots = await (await fetch("surf-spots.json")).json();
      surfList = spots.map(({ name, note, lon, lat }, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] },
        properties: { kind: "kitesurfing", osm: `list/${i}`, name, note, rank: 0 } }));
      map.getSource("ov-surf")?.setData(surfData());
    } catch { /* без списка — только OSM */ }
  }
  try {
    const res = await fetch(QLEVER_URL, { method: "POST", headers: { Accept: "application/sparql-results+json" },
      body: new URLSearchParams({ query: qleverQuery("", SURF_SPARQL, -180, -90, 180, 90) }), signal: AbortSignal.timeout(40000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    surfOsm = (await res.json()).results.bindings.map((b) => ({ type: "Feature",
      geometry: { type: "Point", coordinates: b.c.value.match(/-?[\d.]+/g).map(Number) },
      properties: { kind: b.kind.value, osm: b.osm.value.replace(/^.*\/(node|way|relation)\/(\d+)$/, "$1/$2"), rank: 1 } }));
    map.getSource("ov-surf")?.setData(surfData());
  } catch {
    setTimeout(() => activeOverlays.has("surf") && loadSurf(), TRAIL_POI_RETRY_MS);
  }
  surfLoading = false;
}

function addSurf(before) {
  trailPoiImage("kitesurfing");
  map.addSource("ov-surf", { type: "geojson", data: surfData() });
  map.addLayer({ id: "ov-surf", type: "symbol", source: "ov-surf",
    layout: { "icon-image": "trail-poi-kitesurfing", "symbol-sort-key": ["get", "rank"],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 8, 0.9, 14, 1, 16, 1.2] } }, before);
  raiseTrailPoi();
  if (!surfOsm) loadSurf();
}

// ---------- фото ----------

// Общедоступные фотографии с координатами из Wikimedia Commons: со шкалы 3 км — точки там,
// где есть снимки, со шкалы 1 км — миниатюры. Загруженные снимки в кадре — ещё и лентой
// внизу (photoStrip, слева направо как на карте); щелчок по снимку в ленте выделяет его на
// карте (увеличенная миниатюра поверх всех, слой ov-photo-selected) и открывает подсказку.
// Точка появляется сразу после списка, в ленту и миниатюрой — когда снимок загрузился. Commons ищет только в небольшом прямоугольнике (больше ~0,15° —
// ошибка "toobig") и отдаёт ближайшие к его центру снимки, поэтому грузим квадратами
// тайлов не крупнее 12-го уровня (0,09°). Ближайшие к центру снимки обычно сняты с одной
// точки и слипаются в один значок, поэтому на квадрат два запроса: список до 500 точек
// (быстро, без картинок), из него по снимку на клетку сетки PHOTO_GRID×PHOTO_GRID — и уже
// для них миниатюра, автор, лицензия и дата. При приближении квадраты мельче, и снимков
// гуще. В старых центрах городов 500 точек покрывают лишь пятачок у центра квадрата —
// такой квадрат (photoDense) делится на четыре, пока они не мельче половины тайла экрана.
// Миниатюра рисуется на холсте (скруглённый квадрат в тонкой белой рамке) и
// ставится картинкой карты; после смены карты картинки берутся из кэша photoImages.
// Грузится в 3 параллельных запроса, ближние к центру квадраты первыми; квадраты, до
// которых очередь не дошла, при сдвиге карты забываются
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const PHOTO_MAX_METERS_PER_100PX = 2000;
const PHOTO_DOT_MAX_METERS_PER_100PX = 5000;
const PHOTO_COLOR = "#e91e63";
const PHOTO_CELL_MIN_Z = 12;
const PHOTO_GRID = 4;
const PHOTO_MAX_CELLS = 40;
const PHOTO_SIZE = 44; // px на карте
const photoMinZoom = () => zoomForScale(PHOTO_MAX_METERS_PER_100PX);
const photoDotZoom = () => zoomForScale(PHOTO_DOT_MAX_METERS_PER_100PX);
let selectedPhoto = null;
const photoCells = new Map(); // "13/4000/2000" → true | "loading" | когда можно повторить
const photoDense = new Set(); // квадраты, где снимков больше 500
const photoFeatures = new Map(); // pageid → feature
const photoImages = new Map(); // "photo-123" → ImageData
const photoQueue = [];
let photoActive = 0;
const photoData = () => ({ type: "FeatureCollection", features: [...photoFeatures.values()] });
const stripHtml = (html) => new DOMParser().parseFromString(html, "text/html").body.textContent.replace(/\s+/g, " ").trim();

function addPhotos(before) {
  for (const [id, data] of photoImages) if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: 2 });
  map.addSource("ov-photos", { type: "geojson", data: photoData(),
    attribution: '<a href="https://commons.wikimedia.org/" target="_blank">Wikimedia Commons</a>' });
  map.addLayer({ id: "ov-photo-dots", type: "circle", source: "ov-photos", minzoom: photoDotZoom(),
    paint: { "circle-color": PHOTO_COLOR, "circle-radius": 4, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } }, before);
  // размер 1 на всех зумах: ужатая картинка расплывается
  map.addLayer({ id: "ov-photos", type: "symbol", source: "ov-photos", minzoom: photoMinZoom(), filter: ["has", "img"],
    layout: { "icon-image": ["get", "img"], "symbol-sort-key": ["get", "z"], "icon-padding": 4 } }, before);
  map.addLayer({ id: "ov-photo-selected", type: "symbol", source: "ov-photos", minzoom: photoDotZoom(),
    filter: ["==", ["get", "photo"], selectedPhoto || ""],
    layout: { "icon-image": "photo-selected", "icon-size": 1.4, "icon-allow-overlap": true, "icon-ignore-placement": true } }, before);
  raiseTrailPoi();
  updatePhotos();
}

// выделить снимок на карте и в ленте (null — снять выделение). Одинаково по щелчку в ленте
// и на карте; выделение живёт, пока открыто окно снимка: закрылось окно (щелчок мимо, сдвиг
// карты, другой снимок) — снимается и выделение
function selectPhoto(f, { popup = true } = {}) {
  if (selectedPhoto === (f?.properties.photo || null)) return;
  if (!f || f.properties.photo !== galleryFocus) galleryFocus = null;
  selectedPhoto = f?.properties.photo || null;
  // картинка выделенного — тот же снимок в розовой рамке, как в ленте
  if (f) {
    (f.properties.thumb ? Promise.resolve(f.properties.thumb) : ensureMyThumb(f)).then((url) => photoThumb(url, PHOTO_COLOR)).then((data) => {
      if (selectedPhoto !== f.properties.photo) return;
      if (map.hasImage("photo-selected")) map.removeImage("photo-selected");
      map.addImage("photo-selected", data, { pixelRatio: 2 });
    }).catch(() => {});
  }
  for (const id of ["ov-photo-selected", "ov-my-selected"]) if (map.getLayer(id)) map.setFilter(id, ["==", ["get", "photo"], selectedPhoto || ""]);
  for (const [id, el] of photoStripItems) el.classList.toggle("active", id === selectedPhoto);
  if (!f) return;
  photoStripItems.get(selectedPhoto)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  if (!popup) return;
  showPhotoInfo(f);
  trailPoiPopup?.setOffset(1.4 * PHOTO_SIZE / 2 + 4);
}

// лента внизу: загруженные снимки в кадре, слева направо как на карте; снимки, ушедшие
// из кадра, из ленты убираются. Элементы переиспользуются — прокрутка ленты не сбрасывается
const photoStrip = Object.assign(document.createElement("div"), { className: "photo-strip", hidden: true });
// внутри контейнера карты — чтобы кнопки в углах MapLibre (z-index 2) были поверх ленты
map.getContainer().append(photoStrip);
const photoStripItems = new Map(); // "photo/123" → кнопка
let photoStripList = []; // снимки ленты по порядку — для галереи
photoStrip.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) photoStrip.scrollLeft += e.deltaY;
  e.preventDefault();
}, { passive: false });
let photoStripFrame = 0;

function updatePhotoStrip() {
  cancelAnimationFrame(photoStripFrame);
  photoStripFrame = requestAnimationFrame(() => {
    const on = map.getZoom() >= photoDotZoom();
    const bounds = map.getBounds();
    const pool = [...(activeOverlays.has("photos") ? photoFeatures.values() : []), ...(activeOverlays.has("myphotos") ? myPhotoFeatures.values() : [])];
    const shown = on ? pool
      .filter((f) => f.properties.img && bounds.contains(f.geometry.coordinates))
      .map((f) => [f, map.project(f.geometry.coordinates).x]).sort((a, b) => a[1] - b[1]).map(([f]) => f) : [];
    photoStripList = shown;
    const keep = new Set(shown.map((f) => f.properties.photo));
    for (const [id, el] of photoStripItems) if (!keep.has(id)) { el.remove(); photoStripItems.delete(id); }
    shown.forEach((f, i) => {
      const id = f.properties.photo;
      let el = photoStripItems.get(id);
      if (!el) {
        el = Object.assign(document.createElement("button"), { className: "photo-strip-item", title: f.properties.title });
        el.append(Object.assign(document.createElement("img"), { src: f.properties.thumb, alt: "" }));
        el.addEventListener("click", () => selectPhoto(f));
        el.addEventListener("dblclick", () => openPhotoGallery(f));
        el.classList.toggle("active", id === selectedPhoto);
        photoStripItems.set(id, el);
      }
      if (photoStrip.children[i] !== el) photoStrip.insertBefore(el, photoStrip.children[i] || null);
    });
    photoStrip.hidden = !shown.length;
    // запас справа (из-под кнопок) — только когда ленту есть куда крутить, иначе пустая полоса
    photoStrip.classList.toggle("scrolls", shown.length * 74 > photoStrip.parentElement.clientWidth - 106 - 150);
    document.body.classList.toggle("has-photo-strip", shown.length > 0);
  });
}
map.on("moveend", updatePhotoStrip);

// Пока в галерее листают снимки, карта следит за ними (Грегори: «фокус на карте при
// просмотре фото»): галерея шлёт сюда postMessage, текущий снимок выделяется на карте и в
// ленте (без окна — снимок и так на весь экран в галерее), а если он у края или за кадром,
// карта плавно подвигается к нему. Выделение держится, пока карту не тронут руками или
// галерею не закроют
let galleryFocus = null;
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data?.gallery) return;
  // снимок выбран в галерее слайд-шоу — показать его в слайд-шоу
  if (e.data.gallery === "photo" && tourSlides.slides && !tourSlides.hidden) {
    const i = tourSlides.slides.findIndex((sl) => slideId(sl) === e.data.photo);
    if (i >= 0) { if (i !== tourSlides.current) tourSlides.showAt?.(i); return; }
  }
  const f = e.data.photo && photoById(e.data.photo);
  if (e.data.gallery === "closed" || !f) {
    if (galleryFocus && selectedPhoto === galleryFocus) selectPhoto(null);
    galleryFocus = null;
    return;
  }
  galleryFocus = f.properties.photo;
  trailPoiPopup?.remove();
  selectPhoto(f, { popup: false });
  // снимок альбома может быть на другом конце глобуса — туда перелёт с приближением
  if (map.getZoom() < photoMinZoom()) map.flyTo({ center: f.geometry.coordinates, zoom: photoMinZoom() + 1, duration: 2500 });
  else keepInView(f.geometry.coordinates);
});

// точка у края кадра (или под лентой фото) — карта плавно подвигается, чтобы она была в середине
function keepInView(lngLat) {
  const { x, y } = map.project(lngLat);
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const bottom = (photoStrip.hidden ? h : h - 110) - h * 0.1;
  if (x < w * 0.2 || x > w * 0.8 || y < h * 0.2 || y > bottom) map.easeTo({ center: lngLat, duration: 700 });
}

const photoById = (id) => (String(id).startsWith("my/") ? myPhotoFeatures.get(id) : photoFeatures.get(Number(String(id).slice(6))));

// Галерея (только на компьютере, двойной щелчок по снимку на карте или в ленте) — отдельное
// окно gallery.html со всеми снимками ленты, начиная с выбранного. Список передаётся через
// localStorage (то же устройство, наружу не уходит); окно одно и то же ("travel-earth-gallery"),
// повторный двойной щелчок перезагружает его с новым списком
const PHOTO_GALLERY_KEY = "travel-earth.gallery";
const canOpenGallery = () => matchMedia("(pointer: fine)").matches;

function openPhotoGallery(f) {
  if (!canOpenGallery()) return;
  if (f.properties.photo.startsWith("my/")) return openAlbumGallery(f.properties.album, f.properties.photo);
  const list = photoStripList.some((g) => g.properties.photo === f.properties.photo) ? photoStripList : [f, ...photoStripList];
  const photos = list.map((g) => {
    const { photo, title, author, date, license, page, thumb, full, fullWidth } = g.properties;
    return { photo, title, author, date, license, page, thumb, full, fullWidth };
  });
  localStorage.setItem(PHOTO_GALLERY_KEY, JSON.stringify({ photos, start: list.indexOf(f) < 0 ? 0 : list.indexOf(f) }));
  openSideWindow(`gallery.html?t=${Date.now()}`, "travel-earth-gallery");
}

// отдельное окно по центру экрана, 80 % × 85 %; с тем же именем — то же окно, перезагружается
function openSideWindow(url, name) {
  const w = Math.round(screen.availWidth * 0.8), h = Math.round(screen.availHeight * 0.85);
  const win = window.open(url, name, `popup,width=${w},height=${h},left=${Math.round((screen.availWidth - w) / 2)},top=${Math.round((screen.availHeight - h) / 2)}`);
  win?.focus();
  return win;
}

// миниатюра — квадрат из середины снимка в тонкой (1,5 px) белой скруглённой рамке, вдвое
// детальнее (pixelRatio 2). Толстая рамка с серой каймой Грегори не понравилась
async function photoThumb(src, frame = "#fff") {
  const bmp = await createImageBitmap(src instanceof Blob ? src : await (await fetch(src)).blob());
  const size = PHOTO_SIZE * 2, border = frame === "#fff" ? 3 : 5, side = Math.min(bmp.width, bmp.height);
  const ctx = new OffscreenCanvas(size, size).getContext("2d");
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 12);
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(border, border, size - 2 * border, size - 2 * border, 12 - border);
  ctx.clip();
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, border, border, size - 2 * border, size - 2 * border);
  return ctx.getImageData(0, 0, size, size);
}

async function addPhoto(page, z, co) {
  const ii = page.imageinfo?.[0];
  if (!ii?.thumburl || photoFeatures.get(page.pageid)?.properties.img) return;
  const img = `photo-${page.pageid}`;
  if (!photoImages.has(img)) {
    try { photoImages.set(img, await photoThumb(ii.thumburl)); } catch { return; }
  }
  if (!map.hasImage(img)) try { map.addImage(img, photoImages.get(img), { pixelRatio: 2 }); } catch { /* стиль меняется */ }
  const meta = ii.extmetadata || {};
  const text = (k) => stripHtml(meta[k]?.value || "");
  const title = text("ImageDescription") || page.title.replace(/^File:/, "").replace(/\.\w+$/, "").replace(/_/g, " ");
  photoFeatures.set(page.pageid, { type: "Feature", geometry: { type: "Point", coordinates: co },
    properties: { photo: `photo/${page.pageid}`, img, z, thumb: ii.thumburl, page: ii.descriptionurl, full: ii.url, fullWidth: ii.width,
      aspect: ii.thumbheight / ii.thumbwidth, title: title.length > 160 ? `${title.slice(0, 157)}…` : title,
      author: text("Artist"), license: text("LicenseShortName"), date: text("DateTimeOriginal").replace(/^Taken on\s*/, "") } });
}

async function loadPhotoCell(z, x, y) {
  const n = 2 ** z;
  const lat = (t) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
  const lon = (t) => (t / n) * 360 - 180;
  const [w, s, e, n2] = [lon(x), lat(y + 1), lon(x + 1), lat(y)];
  const query = async (params) => {
    const res = await fetch(`${COMMONS_API}?${new URLSearchParams({ action: "query", format: "json", formatversion: 2, origin: "*", ...params })}`,
      { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).query || {};
  };
  const key = `${z}/${x}/${y}`;
  try {
    const found = (await query({ list: "geosearch", gsbbox: `${n2}|${w}|${s}|${e}`, gsnamespace: 6, gslimit: 500 })).geosearch || [];
    if (found.length >= 500) photoDense.add(key);
    // по снимку на клетку — ближайший к её центру; только фото: png и svg на Commons — в основном карты и схемы
    const best = new Map();
    for (const g of found) {
      if (!/\.(jpe?g|webp)$/i.test(g.title) || photoFeatures.has(g.pageid)) continue;
      const fx = ((g.lon - w) / (e - w)) * PHOTO_GRID, fy = ((n2 - g.lat) / (n2 - s)) * PHOTO_GRID;
      const cell = `${Math.min(PHOTO_GRID - 1, Math.floor(fx))}:${Math.min(PHOTO_GRID - 1, Math.floor(fy))}`;
      const d = Math.hypot(fx % 1 - 0.5, fy % 1 - 0.5);
      if (!best.has(cell) || d < best.get(cell).d) best.set(cell, { g, d });
    }
    const picked = new Map([...best.values()].map(({ g }) => [g.pageid, [g.lon, g.lat]]));
    // сначала точки — снимки подгрузятся следом
    for (const [pageid, coordinates] of picked) {
      photoFeatures.set(pageid, { type: "Feature", geometry: { type: "Point", coordinates }, properties: { photo: `photo/${pageid}`, z } });
    }
    map.getSource("ov-photos")?.setData(photoData());
    if (picked.size) {
      const pages = (await query({ pageids: [...picked.keys()].join("|"), prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: 120,
        iiextmetadatafilter: "Artist|LicenseShortName|ImageDescription|DateTimeOriginal" })).pages || [];
      await Promise.all(pages.map((page) => addPhoto(page, z, picked.get(page.pageid))));
    }
    photoCells.set(key, true);
    map.getSource("ov-photos")?.setData(photoData());
    updatePhotoStrip();
    if (photoDense.has(key)) setTimeout(updatePhotos);
  } catch {
    photoCells.set(key, Date.now() + TRAIL_POI_RETRY_MS);
    setTimeout(updatePhotos, TRAIL_POI_RETRY_MS + 100);
  }
}

function pumpPhotos() {
  while (photoActive < 3 && photoQueue.length) {
    const [z, x, y] = photoQueue.shift();
    photoActive++;
    loadPhotoCell(z, x, y).finally(() => { photoActive--; pumpPhotos(); });
  }
}

// квадраты тайлов в кадре (переполненные — вместе с четвертинками), ближние к центру первыми
function photoCellsInView() {
  const z = Math.min(16, Math.max(PHOTO_CELL_MIN_Z, Math.floor(map.getZoom())));
  const maxZ = Math.floor(map.getZoom()) + 1;
  // координаты в долях мира: 0…1 слева направо и сверху вниз
  const tx = (lon) => (lon + 180) / 360;
  const ty = (lat) => (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2;
  const b = map.getBounds(), c = map.getCenter();
  const cells = [];
  const visit = (cz, x, y) => {
    const n = 2 ** cz;
    cells.push([cz, x, y, Math.hypot((x + 0.5) / n - tx(c.lng), (y + 0.5) / n - ty(c.lat))]);
    if (cz < maxZ && photoDense.has(`${cz}/${x}/${y}`)) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) visit(cz + 1, 2 * x + dx, 2 * y + dy);
    }
  };
  const n = 2 ** z;
  for (let x = Math.max(0, Math.floor(tx(b.getWest()) * n)); x <= Math.min(n - 1, Math.floor(tx(b.getEast()) * n)); x++) {
    for (let y = Math.max(0, Math.floor(ty(b.getNorth()) * n)); y <= Math.min(n - 1, Math.floor(ty(b.getSouth()) * n)); y++) visit(z, x, y);
  }
  return cells.sort((a, b2) => a[3] - b2[3]);
}

function updatePhotos() {
  for (const [z, x, y] of photoQueue.splice(0)) photoCells.delete(`${z}/${x}/${y}`);
  if (!activeOverlays.has("photos") || map.getZoom() < photoDotZoom()) return;
  for (const [z, x, y] of photoCellsInView()) {
    const key = `${z}/${x}/${y}`;
    const state = photoCells.get(key);
    if (state === true || state === "loading" || state > Date.now()) continue;
    photoCells.set(key, "loading");
    if (photoQueue.push([z, x, y]) >= PHOTO_MAX_CELLS) break;
  }
  pumpPhotos();
}
map.on("idle", updatePhotos);

// ---------- снимки улиц (Mapillary) ----------

// Снимки и панорамы улиц из Mapillary (векторные тайлы, ключ приложения — Client Token,
// он открытый: даёт только чтение общедоступного). Тайлы у Mapillary тяжёлые (в центре
// Таллина 1 МБ на тайл 13-го уровня, 2,6 МБ — 14-го, мельче — до 10 МБ), поэтому два
// источника, и MapLibre грузит каждый, только когда виден его слой: линии съёмки — тайлы
// ровно 13-го уровня (со шкалы ~1 км), точки снимков — ровно 14-го (слой со 100 м).
// Наведение на линию или точку — окно со снимком (тем же showPhotoInfo, что у Commons: на
// линии — её снимок-представитель image_id), данные снимка — Graph API, по запросу на снимок.
// Двойной щелчок — отдельное окно viewer.html с просмотром Mapillary (на компьютере); оно
// шлёт сюда, где сейчас стоит камера и куда смотрит, — на карте розовая точка со «взглядом»
const MAPILLARY_TOKEN = "MLY|27764742799866922|5ce2165cbf2f1597e411962b204bf708";
const MLY_TILES = `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${MAPILLARY_TOKEN}`;
const MLY_COLOR = "#05cb63"; // зелёный Mapillary
const MLY_ATTRIBUTION = '<a href="https://www.mapillary.com/" target="_blank">Mapillary</a> (CC BY-SA)';
const MLY_LAYERS = ["ov-mly-lines", "ov-mly-images"];
const mlyInfo = new Map(); // id снимка → свойства для окна
const mlyAt = (point) => map.queryRenderedFeatures(point, { layers: MLY_LAYERS.filter((id) => map.getLayer(id)) })[0];

function addMapillary(before) {
  map.addSource("ov-mapillary", { type: "vector", tiles: [MLY_TILES], minzoom: 13, maxzoom: 13, attribution: MLY_ATTRIBUTION });
  map.addSource("ov-mapillary-vec", { type: "vector", tiles: [MLY_TILES], minzoom: 14, maxzoom: 14 });
  map.addLayer({ id: "ov-mly-lines", type: "line", source: "ov-mapillary", "source-layer": "sequence", minzoom: 13,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": MLY_COLOR, "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.8, 16, 1.5, 18, 2.5] } }, before);
  map.addLayer({ id: "ov-mly-images", type: "circle", source: "ov-mapillary-vec", "source-layer": "image", minzoom: 16,
    paint: { "circle-color": MLY_COLOR, "circle-radius": ["interpolate", ["linear"], ["zoom"], 16, 2.5, 19, 5],
      "circle-stroke-color": "#fff", "circle-stroke-width": 1 } }, before);
  if (!map.hasImage("mly-pos")) map.addImage("mly-pos", mlyPosImage(), { pixelRatio: 2 });
  map.addSource("ov-mly-pos", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "ov-mly-pos", type: "symbol", source: "ov-mly-pos",
    layout: { "icon-image": "mly-pos", "icon-size": 1.6, "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map",
      "icon-allow-overlap": true, "icon-ignore-placement": true } }, before);
  raiseTrailPoi();
}

// точка камеры со «взглядом» — розовый веер вверх (поворачивается по направлению)
function mlyPosImage() {
  const size = 96, c = size / 2;
  const ctx = new OffscreenCanvas(size, size).getContext("2d");
  ctx.fillStyle = "rgba(233, 30, 99, 0.35)";
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, 44, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, 11, 0, 2 * Math.PI);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, 8, 0, 2 * Math.PI);
  ctx.fillStyle = PHOTO_COLOR;
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

async function loadMlyInfo(id) {
  if (mlyInfo.has(id)) return mlyInfo.get(id);
  const res = await fetch(`https://graph.mapillary.com/${id}?fields=thumb_1024_url,captured_at,creator,is_pano,width,height&access_token=${encodeURIComponent(MAPILLARY_TOKEN)}`,
    { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  const info = { photo: `mly/${id}`, thumb: d.thumb_1024_url, page: `https://www.mapillary.com/app/?pKey=${id}&focus=photo`,
    title: d.is_pano ? "Панорама 360°" : "Снимок улицы", author: d.creator?.username || "",
    date: d.captured_at ? new Date(d.captured_at).toLocaleDateString("ru") : "", license: "CC BY-SA 4.0",
    aspect: d.is_pano ? 0.5 : d.height && d.width ? d.height / d.width : 0.75 };
  mlyInfo.set(id, info);
  return info;
}

async function showMapillaryInfo(f, lngLat) {
  const id = String(f.properties.image_id ?? f.properties.id);
  const key = `mly/${id}`;
  if (trailPoiHover === key && trailPoiPopup?.isOpen()) return;
  trailPoiHover = key;
  const info = await loadMlyInfo(id).catch(() => null);
  if (trailPoiHover !== key || !info) return;
  trailPoiHover = null;
  const coordinates = f.geometry.type === "Point" ? f.geometry.coordinates : [lngLat.lng, lngLat.lat];
  showPhotoInfo({ geometry: { type: "Point", coordinates }, properties: info });
  trailPoiPopup?.setOffset(f.geometry.type === "Point" ? 10 : 6);
}

onHover(MLY_LAYERS, (evt) => showMapillaryInfo(evt.features[0], evt.lngLat));
map.on("click", MLY_LAYERS, (evt) => showMapillaryInfo(evt.features[0], evt.lngLat));
map.on("dblclick", (evt) => {
  const f = mlyAt(evt.point);
  if (!f || !canOpenGallery()) return;
  evt.preventDefault();
  openMapillaryViewer(String(f.properties.image_id ?? f.properties.id));
});

// просмотр в отдельном окне (одно и то же, как у галереи)
function openMapillaryViewer(id) {
  openSideWindow(`viewer.html?id=${encodeURIComponent(id)}`, "travel-earth-mapillary");
}

// где сейчас камера просмотра: точка со взглядом, карта подвигается, если точка у края
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data?.mapillary) return;
  const src = map.getSource("ov-mly-pos");
  if (!src) return;
  const m = e.data.mapillary;
  if (m.closed) { src.setData({ type: "FeatureCollection", features: [] }); return; }
  src.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [m.lng, m.lat] },
    properties: { bearing: m.bearing || 0 } }] });
  if (m.moved) keepInView([m.lng, m.lat]);
});

// ---------- мои фото (папка на этом компьютере) ----------

// Пункт 3 плана фото: свои снимки из папки на компьютере (путь задаётся в ⚙ настройках —
// своя папка у каждой машины). Браузер не пускает страницу на диск по пути вроде
// E:\MyFotos — папку один раз выбирают в системном окне (File System Access API, Chrome и
// Edge на компьютере; на телефоне слоя нет), её «ключ» (handle) хранится в IndexedDB этого
// браузера, снимки никуда не отправляются. После перезапуска Chrome может спросить
// разрешение снова — тогда кнопка «Открыть мои фото» (нужен щелчок пользователя).
// Альбом = папка со снимками. Обход папки: у каждого альбома ищется первый снимок с GPS
// (EXIF, библиотека exifr) — точка альбома на глобусе, видна на любом масштабе до «3 км».
// Потом в фоне читаются координаты всех снимков (альбомы ближе к центру карты — первыми),
// они — точками со «3 км» и миниатюрами с «1 км», как у Commons, и в той же ленте. EXIF
// кэшируется в IndexedDB (путь + размер + дата файла), второй запуск — без чтения снимков.
// Миниатюры — встроенная в EXIF (быстро) или уменьшенный снимок, если он повёрнут.
// Щелчок по альбому — перелёт к нему, двойной — альбом в окне галереи (все снимки папки);
// двойной по снимку — тот же альбом с этого снимка; галерея ведёт карту (перелёт к снимку)
const MY_COLOR = "#7c4dff";
const MY_IMAGE_RE = /\.(jpe?g|webp|png)$/i;
const MY_TEXT_RE = /\.(txt|md)$/i;
const MY_ALBUM_PROBE = 25; // сколько снимков альбома пробовать в поисках координат на первом проходе
const myPhotoFeatures = new Map(); // "my/12" → feature снимка с координатами
const myFiles = new Map(); // "my/12" → { handle, name, path, album, rec }
const myAlbums = new Map(); // "album/3" → { id, name, path, files: ["my/12", …], point, indexed }
let myDir = null;
let myScan = null; // идущий обход
let myFileSeq = 0, myAlbumSeq = 0;
let myStatus = "";
const myData = () => ({ type: "FeatureCollection", features: [
  ...[...myAlbums.values()].filter((a) => a.point).map((a) => ({ type: "Feature", geometry: { type: "Point", coordinates: a.point },
    properties: { album: a.id, kind: "album", title: a.name, path: a.path, count: a.files.length, excursion: a.excursion?.title || "" } })),
  ...myPhotoFeatures.values()] });
let myDataTimer = 0;
function refreshMyData() {
  clearTimeout(myDataTimer);
  myDataTimer = setTimeout(() => { map.getSource("ov-myphotos")?.setData(myData()); updatePhotoStrip(); }, 300);
}

// IndexedDB: settings — выбранная папка, exif — кэш координат по пути файла
let myDbOpen = null;
const myDb = () => (myDbOpen ||= new Promise((resolve, reject) => {
  const req = indexedDB.open("travel-earth-my-photos", 2);
  // 2: geo — где находится место из экскурсии (Nominatim), чтобы не спрашивать второй раз
  req.onupgradeneeded = () => {
    for (const name of ["settings", "exif", "geo"]) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
}));
async function idb(store, mode, fn) {
  const db = await myDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

let exifrLoad = null;
const loadExifr = () => (exifrLoad ||= new Promise((resolve, reject) => {
  const script = Object.assign(document.createElement("script"), { src: "https://unpkg.com/exifr@7.1.3/dist/full.umd.js" });
  script.onload = () => resolve(window.exifr);
  script.onerror = () => { exifrLoad = null; reject(new Error("exifr")); };
  document.head.append(script);
}));

function setMyStatus(text) {
  myStatus = text;
  const node = document.getElementById("my-photos-status");
  if (node) node.textContent = text;
}

function addMyPhotos(before) {
  for (const [id, data] of photoImages) if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: 2 });
  map.addSource("ov-myphotos", { type: "geojson", data: myData() });
  const kind = (k) => ["==", ["get", "kind"], k];
  map.addLayer({ id: "ov-my-albums", type: "circle", source: "ov-myphotos", maxzoom: photoDotZoom(), filter: kind("album"),
    paint: { "circle-color": MY_COLOR, "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 5, 10, 7],
      "circle-stroke-color": "#fff", "circle-stroke-width": 2 } }, before);
  map.addLayer({ id: "ov-my-dots", type: "circle", source: "ov-myphotos", minzoom: photoDotZoom(), filter: kind("photo"),
    paint: { "circle-color": MY_COLOR, "circle-radius": 4, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } }, before);
  map.addLayer({ id: "ov-my-photos", type: "symbol", source: "ov-myphotos", minzoom: photoMinZoom(), filter: ["all", kind("photo"), ["has", "img"]],
    layout: { "icon-image": ["get", "img"], "icon-padding": 4 } }, before);
  map.addLayer({ id: "ov-my-selected", type: "symbol", source: "ov-myphotos", minzoom: photoDotZoom(),
    filter: ["==", ["get", "photo"], selectedPhoto || ""],
    layout: { "icon-image": "photo-selected", "icon-size": 1.4, "icon-allow-overlap": true, "icon-ignore-placement": true } }, before);
  raiseTrailPoi();
  initMyPhotos();
}

// выбранная папка из IndexedDB; есть разрешение — обход, нет — кнопка «Открыть мои фото»
async function initMyPhotos() {
  if (myDir || !("showDirectoryPicker" in window)) { updateMyThumbs(); return; }
  const handle = await idb("settings", "readonly", (st) => st.get("dir")).catch(() => null);
  renderMySettings(handle);
  if (!handle) { setMyStatus(""); return; }
  if (await handle.queryPermission({ mode: "read" }) === "granted") startMyScan(handle);
  else showMyAccessButton(handle);
}

function showMyAccessButton(handle) {
  showFolderAccessButton("my-photos-access", CHIP_ICONS.myphotos, `Открыть мои фото (${handle.name})`, handle, startMyScan);
}

// после перезапуска Chrome разрешение на папку даётся только щелчком — кнопки вверху по центру
function showFolderAccessButton(id, icon, label, handle, start) {
  let bar = document.getElementById("access-bar");
  if (!bar) document.body.append(bar = Object.assign(document.createElement("div"), { id: "access-bar", className: "access-bar" }));
  let btn = document.getElementById(id);
  if (!btn) bar.append(btn = Object.assign(document.createElement("button"), { id, className: "folder-access" }));
  btn.innerHTML = `${icon}<span></span>`;
  btn.lastChild.textContent = label;
  btn.hidden = false;
  btn.onclick = async () => {
    if (await handle.requestPermission({ mode: "read" }) !== "granted") return;
    btn.hidden = true;
    start(handle);
  };
}

async function pickMyFolder() {
  let handle;
  try { handle = await window.showDirectoryPicker({ id: "travel-earth-photos", mode: "read" }); } catch { return; }
  await idb("settings", "readwrite", (st) => st.put(handle, "dir"));
  resetMyPhotos();
  renderMySettings(handle);
  if (!activeOverlays.has("myphotos")) toggleOverlay("myphotos");
  startMyScan(handle);
}

async function forgetMyFolder() {
  await idb("settings", "readwrite", (st) => st.delete("dir"));
  resetMyPhotos();
  renderMySettings(null);
  setMyStatus("");
}

function resetMyPhotos() {
  myDir = null;
  myScan = null;
  myPhotoFeatures.clear();
  myFiles.clear();
  myAlbums.clear();
  if (selectedPhoto?.startsWith("my/")) selectPhoto(null);
  refreshMyData();
}

function renderMySettings(handle) {
  const name = document.getElementById("my-photos-folder");
  if (!name) return;
  const supported = "showDirectoryPicker" in window;
  name.textContent = !supported ? "нужен Chrome или Edge на компьютере" : handle ? handle.name : "не выбрана";
  document.getElementById("my-photos-pick").disabled = !supported;
  document.getElementById("my-photos-pick").textContent = handle ? "Выбрать другую…" : "Выбрать папку…";
  document.getElementById("my-photos-forget").hidden = !handle;
  document.getElementById("my-photos-status").textContent = myStatus;
}

async function startMyScan(handle) {
  myDir = handle;
  const scan = myScan = {};
  const exifr = await loadExifr().catch(() => null);
  if (!exifr) { setMyStatus("Не загрузилась библиотека чтения EXIF — проверьте интернет"); return; }
  const keys = await idb("exif", "readonly", (st) => st.getAllKeys()).catch(() => []);
  const values = await idb("exif", "readonly", (st) => st.getAll()).catch(() => []);
  const cache = new Map(keys.map((k, i) => [k, values[i]]));
  const pending = [];
  const flush = () => {
    const batch = pending.splice(0);
    if (batch.length) idb("exif", "readwrite", (st) => { for (const [k, v] of batch) st.put(v, k); }).catch(() => {});
  };
  let checked = 0, located = 0;
  const report = (done) => setMyStatus(`${done ? "Готово" : "Читаю папку…"} Альбомов на карте: ${[...myAlbums.values()].filter((a) => a.point).length} из ${myAlbums.size}, снимков с координатами: ${located}, проверено: ${checked}`);

  // координаты и дата снимка — из кэша или из EXIF
  const exifOf = async (id) => {
    const file = myFiles.get(id);
    if (file.rec) return file.rec;
    const f = await file.handle.getFile();
    const hit = cache.get(file.path);
    if (hit && hit.size === f.size && hit.mtime === f.lastModified) return (file.rec = hit);
    let rec = { size: f.size, mtime: f.lastModified };
    try {
      const e = await exifr.parse(f, { tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: false, jfif: false, ihdr: false, translateValues: false });
      if (Number.isFinite(e?.latitude) && Number.isFinite(e?.longitude) && (e.latitude || e.longitude)) rec = { ...rec, lat: e.latitude, lon: e.longitude };
      if (e?.DateTimeOriginal instanceof Date) rec.date = e.DateTimeOriginal.getTime();
      if (e?.Orientation) rec.orient = e.Orientation;
    } catch { /* без EXIF */ }
    checked++;
    pending.push([file.path, rec]);
    if (pending.length >= 200) flush();
    return (file.rec = rec);
  };
  const addPhotoFeature = (id) => {
    const file = myFiles.get(id);
    if (!file.rec?.lat || myPhotoFeatures.has(id)) return;
    located++;
    const album = myAlbums.get(file.album);
    myPhotoFeatures.set(id, { type: "Feature", geometry: { type: "Point", coordinates: [file.rec.lon, file.rec.lat] },
      properties: { photo: id, kind: "photo", album: album.id, albumName: album.name, title: file.name,
        caption: album.excursion?.captions[file.name.toLowerCase()] || "",
        date: file.rec.date ? new Date(file.rec.date).toLocaleDateString("ru") : "", z: 0 } });
  };

  // проход 1: папки и первая точка каждого альбома
  const walk = async (dir, path) => {
    const files = [], dirs = [], texts = [];
    try {
      for await (const [name, h] of dir.entries()) {
        if (h.kind === "directory") { if (!name.startsWith(".")) dirs.push([name, h]); }
        else if (MY_IMAGE_RE.test(name)) files.push([name, h]);
        else if (MY_TEXT_RE.test(name)) texts.push([name, h]);
      }
    } catch { return; }
    if (scan !== myScan) return;
    if (files.length) {
      const album = { id: `album/${++myAlbumSeq}`, name: dir.name, path, files: [], point: null, indexed: false };
      myAlbums.set(album.id, album);
      for (const [name, h] of files.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
        const id = `my/${++myFileSeq}`;
        myFiles.set(id, { handle: h, name, path: `${path}/${name}`, album: album.id, rec: null });
        album.files.push(id);
      }
      if (texts.length) album.excursion = await readExcursion(texts, files.map(([name]) => name)).catch(() => null);
      for (const id of album.files.slice(0, MY_ALBUM_PROBE)) {
        const rec = await exifOf(id);
        if (rec.lat) { album.point = [rec.lon, rec.lat]; addPhotoFeature(id); break; }
      }
      refreshMyData();
      report(false);
    }
    for (const [name, h] of dirs.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) await walk(h, `${path}/${name}`);
  };
  setMyStatus("Читаю папку…");
  await walk(handle, handle.name);

  // проход 2: все снимки, альбомы ближе к центру карты — первыми
  for (;;) {
    if (scan !== myScan) return;
    const c = map.getCenter();
    const rest = [...myAlbums.values()].filter((a) => !a.indexed);
    if (!rest.length) break;
    const dist = (a) => (a.point ? Math.hypot(a.point[0] - c.lng, a.point[1] - c.lat) : 1e9);
    const album = rest.reduce((best, a) => (dist(a) < dist(best) ? a : best));
    for (const id of album.files) {
      const rec = await exifOf(id);
      if (rec.lat && !album.point) album.point = [rec.lon, rec.lat];
      addPhotoFeature(id);
    }
    album.indexed = true;
    refreshMyData();
    report(false);
    updateMyThumbs();
  }
  flush();
  report(true);
}

// Экскурсия: текстовые файлы (.txt, .md) в папке альбома. Формат простой, для Блокнота:
//   # Название экскурсии        — первая строка с «#» (иначе — имя файла)
//   ## Раздел                   — подзаголовок (остановка)
//   20260802_042559.jpg         — строка, где только имя снимка из этой папки:
//   Текст под ней — подпись      к этому снимку относится абзац сразу под ней
//   Остальное — абзацы рассказа (пустая строка — новый абзац)
// Кодировка — UTF-8, а если не читается — Windows-1251 (старый Блокнот). Несколько файлов —
// по порядку имён, один за другим
async function readExcursion(texts, photoNames) {
  const names = new Map(photoNames.map((n) => [n.toLowerCase(), n]));
  const blocks = [], captions = {};
  let title = "", para = [], photo = null;
  const endPara = () => {
    if (!para.length) return;
    const text = para.join(" ");
    if (photo) { captions[photo.toLowerCase()] = text; blocks.push({ type: "photo", file: photo, text }); photo = null; }
    else blocks.push({ type: "p", text });
    para = [];
  };
  for (const [name, h] of texts.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
    const bytes = await (await h.getFile()).arrayBuffer();
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { text = new TextDecoder("windows-1251").decode(bytes); }
    for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { endPara(); continue; }
      const heading = line.match(/^(#{1,3})\s+(.+)/);
      if (heading) {
        endPara();
        if (photo) { blocks.push({ type: "photo", file: photo, text: "" }); photo = null; }
        if (heading[1] === "#" && !title) title = heading[2];
        else blocks.push({ type: "h", text: heading[2] });
        continue;
      }
      const file = names.get(line.toLowerCase());
      if (file) {
        endPara();
        if (photo) blocks.push({ type: "photo", file: photo, text: "" });
        photo = file;
        continue;
      }
      para.push(line);
    }
    endPara();
    if (photo) { blocks.push({ type: "photo", file: photo, text: "" }); photo = null; }
    if (!title) title = name.replace(MY_TEXT_RE, "");
  }
  return blocks.length || title ? { title, blocks, captions } : null;
}

// миниатюры снимков в кадре (со «3 км» — для ленты, с «1 км» — и на карте)
const myThumbQueue = [];
const myThumbBusy = new Map(); // id → Promise url
let myThumbActive = 0;
function updateMyThumbs() {
  if (!activeOverlays.has("myphotos") || map.getZoom() < photoDotZoom()) return;
  const b = map.getBounds(), c = map.getCenter();
  myThumbQueue.length = 0;
  myThumbQueue.push(...[...myPhotoFeatures.values()]
    .filter((f) => !f.properties.img && !myThumbBusy.has(f.properties.photo) && b.contains(f.geometry.coordinates))
    .sort((a, b2) => Math.hypot(a.geometry.coordinates[0] - c.lng, a.geometry.coordinates[1] - c.lat)
      - Math.hypot(b2.geometry.coordinates[0] - c.lng, b2.geometry.coordinates[1] - c.lat))
    .slice(0, 120));
  while (myThumbActive < 2 && myThumbQueue.length) {
    myThumbActive++;
    ensureMyThumb(myThumbQueue.shift()).catch(() => {}).finally(() => { myThumbActive--; updateMyThumbs(); });
  }
}
map.on("idle", updateMyThumbs);

function ensureMyThumb(f) {
  const id = f.properties.photo;
  if (f.properties.thumb) return Promise.resolve(f.properties.thumb);
  if (!myThumbBusy.has(id)) myThumbBusy.set(id, makeMyThumb(id));
  return myThumbBusy.get(id);
}

async function makeMyThumb(id) {
  const file = myFiles.get(id), f = myPhotoFeatures.get(id);
  const blobFile = await file.handle.getFile();
  let blob = null;
  // встроенная миниатюра EXIF — быстро, но без поворота: только у неповёрнутых снимков
  // (снимок, до которого обход ещё не дошёл, — поворот читается здесь же)
  const orient = file.rec ? file.rec.orient : await (await loadExifr()).orientation(blobFile).catch(() => undefined);
  if (!(orient > 1)) {
    try {
      const t = await (await loadExifr()).thumbnail(blobFile);
      if (t) blob = new Blob([t], { type: "image/jpeg" });
    } catch { /* нет встроенной */ }
  }
  const bmp = await createImageBitmap(blob || blobFile, blob ? {} : { resizeWidth: 320, resizeQuality: "medium" });
  if (!blob) {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    canvas.getContext("2d").drawImage(bmp, 0, 0);
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  }
  const aspect = bmp.height / bmp.width;
  bmp.close();
  const url = URL.createObjectURL(blob);
  file.thumb = url;
  // снимку без координат (он есть только в галерее альбома) картинка на карте не нужна
  if (!f) return url;
  const img = `my-${id.slice(3)}`;
  photoImages.set(img, await photoThumb(blob));
  if (!map.hasImage(img)) try { map.addImage(img, photoImages.get(img), { pixelRatio: 2 }); } catch { /* стиль меняется */ }
  Object.assign(f.properties, { img, thumb: url, aspect });
  refreshMyData();
  return url;
}

// Для галереи альбома (она зовёт их через window.opener). Раньше галерея получала сразу
// все снимки папки как оригиналы и ставила их же в ленту миниатюр — на альбоме в 1000
// снимков по 12 Мп браузер вис (Грегори). Теперь список — только имена, миниатюра делается
// по запросу, когда её клетка ленты видна (по одной), оригинал — только у открытого снимка
function myFileThumb(id) {
  const f = myPhotoFeatures.get(id), file = myFiles.get(id);
  if (f) return ensureMyThumb(f);
  if (!file) return Promise.reject(new Error("нет файла"));
  if (file.thumb) return Promise.resolve(file.thumb);
  if (!myThumbBusy.has(id)) myThumbBusy.set(id, makeMyThumb(id));
  return myThumbBusy.get(id);
}
const myFullUrls = new Map(); // последние открытые оригиналы, id → blob URL
async function myFileFull(id) {
  if (myFullUrls.has(id)) return myFullUrls.get(id);
  const url = URL.createObjectURL(await myFiles.get(id).handle.getFile());
  myFullUrls.set(id, url);
  for (const [old, oldUrl] of myFullUrls) {
    if (myFullUrls.size <= 8) break;
    URL.revokeObjectURL(oldUrl);
    myFullUrls.delete(old);
  }
  return url;
}
window.myGalleryThumb = myFileThumb;
window.myGalleryFull = myFileFull;

// в окне снимка — сам файл вместо миниатюры (ссылка освобождается, когда окно закроется)
async function showMyPhotoFull(id, imgEl) {
  const file = myFiles.get(id);
  if (!file || !imgEl) return;
  const url = URL.createObjectURL(await file.handle.getFile());
  imgEl.src = url;
  trailPoiPopup?.once("close", () => URL.revokeObjectURL(url));
}

// альбом в окне галереи: все снимки папки (и без координат); миниатюры и оригиналы галерея
// просит у этого окна сама (myGalleryThumb / myGalleryFull), по мере надобности
function openAlbumGallery(albumId, startId) {
  const album = myAlbums.get(albumId);
  if (!album || !canOpenGallery()) return;
  const photos = album.files.map((id) => {
    const file = myFiles.get(id);
    return { photo: id, my: true, title: file.name, thumb: file.thumb || myPhotoFeatures.get(id)?.properties.thumb || "",
      caption: album.excursion?.captions[file.name.toLowerCase()] || "",
      date: file.rec?.date ? new Date(file.rec.date).toLocaleDateString("ru") : "", license: `Альбом «${album.name}»` };
  });
  localStorage.setItem(PHOTO_GALLERY_KEY, JSON.stringify({ photos, start: Math.max(0, album.files.indexOf(startId)),
    excursion: album.excursion ? { title: album.excursion.title, blocks: album.excursion.blocks } : null }));
  openSideWindow(`gallery.html?t=${Date.now()}`, "travel-earth-gallery");
}

// альбом: наведение — название и число снимков, щелчок — перелёт, двойной — галерея
const albumAt = (point) => (map.getLayer("ov-my-albums") ? map.queryRenderedFeatures(point, { layers: ["ov-my-albums"] })[0] : null);
function showAlbumInfo(f) {
  const p = f.properties;
  if (trailPoiHover === p.album && trailPoiPopup?.isOpen()) return;
  trailPoiHover = p.album;
  openMediaPopup(f.geometry.coordinates, 10, "260px", `<div class="popup-title">${escapeHtml(p.title)}</div>`
    + `<div class="popup-kind">${escapeHtml(`Альбом · ${p.count} фото`)}</div>`
    + (p.excursion ? `<div class="popup-row">${escapeHtml(`Экскурсия: ${p.excursion}`)}</div>` : "")
    + `<div class="popup-row popup-muted">${escapeHtml(canOpenGallery() ? "Щелчок — к альбому, двойной — открыть" : "Нажмите — к альбому")}</div>`);
  trailPoiPopup.on("close", () => { if (trailPoiHover === p.album) trailPoiHover = null; });
  keepTrailPoiInfoOnHover();
}
function flyToAlbum(albumId) {
  const album = myAlbums.get(albumId);
  if (!album?.point) return;
  const pts = album.files.map((id) => myPhotoFeatures.get(id)?.geometry.coordinates).filter(Boolean);
  const lons = pts.map((c) => c[0]), lats = pts.map((c) => c[1]);
  if (pts.length > 1 && Math.max(...lons) - Math.min(...lons) + Math.max(...lats) - Math.min(...lats) > 0.0005) {
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
      { padding: { top: 90, bottom: 130, left: 110, right: 90 }, maxZoom: 17, duration: 2500 });
  } else map.flyTo({ center: album.point, zoom: 16, duration: 2500 });
}
onHover("ov-my-albums", (evt) => showAlbumInfo(evt.features[0]));
map.on("click", "ov-my-albums", (evt) => flyToAlbum(evt.features[0].properties.album));
map.on("dblclick", (evt) => {
  const a = albumAt(evt.point);
  if (!a || !canOpenGallery()) return;
  evt.preventDefault();
  openAlbumGallery(a.properties.album, null);
});

// ---------- экскурсии (наброски будущих путешествий) ----------

// Грегори: «наброски для будущих путешествий с опорой на туристические тропы и готовые
// статьи или видео в YouTube … дайджест из нескольких источников, подробности будут мешать;
// точная локация не нужна». Экскурсия — текстовый файл (.md или .txt, Блокнот) в своей папке,
// выбранной в ⚙ настройках (handle в IndexedDB, только в этом браузере; файлы с «_» в начале
// имени — черновики и шаблоны, не читаются). Формат дайджеста — TOUR_TEMPLATE ниже и
// _Шаблон экскурсии.md. Место («Место:», «Регион:») — название, его находит Nominatim (кэш
// geo в IndexedDB, запросы раз в секунду) или «широта, долгота». На карте: точка
// экскурсии с названием (на любом масштабе, до ~50 км), остановки — номера по порядку,
// пунктир между ними — набросок маршрута. Щелчок — панель дайджеста справа (маршрут,
// точки, особенности, справка и выдержки — их можно послушать голосом браузера, источники);
// щелчок по остановке в панели — карта перелетает к ней. Файлы перечитываются, когда окно
// снова в фокусе — правка в Блокноте видна сразу после переключения
const TOUR_COLOR = "#ef6c00";
const TOUR_TEXT_RE = /\.(md|txt)$/i;
const TOUR_LAYERS = ["ov-tour-marks", "ov-tour-labels", "ov-tour-stops", "ov-tour-sel"];
let tourSel = null; // { tour, n } — выделенная остановка
let tourEditing = false; // в панели открыта правка файла — перечитывание её не трогает
const tourSelFilter = () => ["all", ["==", ["get", "kind"], "stop"], ["==", ["get", "tour"], tourSel?.tour || ""], ["==", ["get", "n"], tourSel?.n || -1]];

// выделить остановку на карте и в панели (Грегори: «выделять точки при клике на панели и в
// панели при клике на карте»); null — снять
function selectTourStop(tour, n) {
  tourSel = tour ? { tour, n } : null;
  if (map.getLayer("ov-tour-sel")) map.setFilter("ov-tour-sel", tourSelFilter());
  for (const sec of tourPanel.querySelectorAll(".tour-section[data-n]")) {
    const on = tourSel?.tour === tourPanelId && Number(sec.dataset.n) === tourSel?.n;
    sec.classList.toggle("current", on);
    if (on) {
      sec.classList.add("open");
      sec.classList.remove("shut");
      tourPanel.classList.remove("min");
      sec.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
}
const TOUR_KEYS = { "место": "place", "регион": "region", "тропа": "trail", "длина": "length", "время": "time",
  "сложность": "difficulty", "сезон": "season", "точки": "points", "особенности": "features", "справка": "history",
  "выдержка": "quote", "выдержки": "quote", "источник": "sources", "источники": "sources", "теги": "tags", "идея": "idea", "маршрут": "route", "страна": "country", "город": "city", "тип": "kind", "значок": "icon" };
const TOUR_LIST_KEYS = new Set(["features", "sources", "quote", "history", "points"]);
let tourDir = null;
const tours = new Map(); // путь файла → { id, file, mtime, title, region, tags, sources, sections, point }
let tourStatus = "";
let tourGeoQueue = Promise.resolve();

// поля строки «Ключ: значение»; несколько фактов можно писать одной строкой через «·», как в
// шаблоне: «Длина: 11 км · Время: 4 ч · Сложность: средняя». Кусок без знакомого ключа
// остаётся в значении предыдущего поля; строка не с поля — null
function tourFields(line) {
  const fields = [];
  for (const part of line.split(/\s+·\s+/)) {
    const m = part.match(/^([А-Яа-яЁё]+)\s*:\s*(.*)$/);
    const key = m && TOUR_KEYS[m[1].toLowerCase()];
    if (key) fields.push([key, m[2]]);
    else if (fields.length) fields[fields.length - 1][1] += ` · ${part}`;
    else return null;
  }
  return fields;
}

// разбор файла: «# Название», поля «Ключ: значение», «## Раздел» (остановка, если есть «Место:»),
// списки «- …» к последнему полю-списку (по умолчанию — особенности), остальное — абзацы
function parseTour(text, file) {
  const tour = { title: "", region: "", country: "", city: "", kind: "", icon: "", tags: "", sources: [], idea: [], sections: [] };
  let target = tour, key = null;
  const add = (k, v) => {
    if (!v) return;
    if (TOUR_LIST_KEYS.has(k) || k === "idea") (target[k] ||= []).push(v);
    else target[k] = v;
  };
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    // пустая строка заканчивает справку, выдержку и простое поле; списки продолжаются
    if (!line) { if (key && !["features", "points", "sources"].includes(key)) key = null; continue; }
    if (line.startsWith(">")) { add("quote", line.replace(/^>\s*/, "")); key = "quote"; continue; }
    let m;
    if ((m = line.match(/^#\s+(.+)/)) && !tour.title) { tour.title = m[1]; continue; }
    if ((m = line.match(/^##+\s+(.+)/))) {
      target = { title: m[1], paras: [] };
      tour.sections.push(target);
      key = null;
      continue;
    }
    const fields = tourFields(line);
    if (fields) {
      for (const [k, v] of fields) {
        key = k;
        if (target === tour && ["place", "trail", "length", "time", "difficulty", "points", "features", "history", "quote"].includes(key) && !tour.sections.length) {
          tour.sections.push(target = { title: "", paras: [] }); // поля остановки до первого «##» — безымянный раздел
        }
        add(key, v);
      }
      continue;
    }
    if ((m = line.match(/^[-*•]\s+(.+)/))) { add(key && TOUR_LIST_KEYS.has(key) ? key : target === tour ? "idea" : "features", m[1]); continue; }
    if (key && TOUR_LIST_KEYS.has(key) && key !== "features" && key !== "points" && key !== "sources") { add(key, line); continue; }
    if (target === tour) tour.idea.push(line);
    else target.paras.push(line);
  }
  tour.title ||= file.replace(TOUR_TEXT_RE, "");
  return tour;
}

// «Название — https://…» или просто ссылка → { text, url }
function tourSource(line) {
  const m = line.match(/https?:\/\/\S+/);
  if (!m) return { text: line, url: "" };
  const text = line.replace(m[0], "").replace(/[\s—–:-]+$/, "").trim();
  const host = new URL(m[0]).hostname.replace(/^www\./, "");
  return { text: text || host, url: m[0], video: /youtube\.com|youtu\.be|vimeo\.com/.test(host) };
}

// место по названию: «32.76, -16.91» — как есть, иначе Nominatim (кэш в IndexedDB)
// Остановка ищется рядом с точкой региона (near): короткое название вроде «Sorrento» или
// «Vesuvio» без региона Nominatim находил в США (жалоба Грегори — точки «ушли на американский
// континент»). Поэтому viewbox ±2,5° вокруг региона (bounded=0 — только предпочтение), а если
// всё равно дальше TOUR_NEAR_KM — повтор с регионом в запросе; не помогло — места нет (null)
const TOUR_NEAR_KM = 800;
const kmBetween = ([lon1, lat1], [lon2, lat2]) => 6371 * Math.acos(Math.min(1,
  Math.sin(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
  + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180)));

async function tourGeocode(query, near = null, region = "") {
  const m = query.match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return [Number(m[2]), Number(m[1])];
  let point = await tourGeocodeOnce(query, near);
  if (point && near && kmBetween(point, near) > TOUR_NEAR_KM && region) {
    point = await tourGeocodeOnce(`${query}, ${region}`, near);
    if (point && kmBetween(point, near) > TOUR_NEAR_KM) point = null;
  }
  return point;
}

async function tourGeocodeOnce(query, near) {
  // кэш — по запросу и окрестности: одно и то же название в разных поездках — разные места
  const key = near ? `${query.toLowerCase()}@${near.map((v) => v.toFixed(1)).join(",")}` : query.toLowerCase();
  const hit = await idb("geo", "readonly", (st) => st.get(key)).catch(() => undefined);
  if (hit !== undefined) return hit;
  const run = tourGeoQueue.then(async () => {
    const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", "accept-language": uiLanguageCode(),
      ...(near && { viewbox: [near[0] - 2.5, near[1] + 2.5, near[0] + 2.5, near[1] - 2.5].join(","), bounded: "0" }) });
    const res = await fetch(`${NOMINATIM_URL}?${params}`).catch(() => null);
    const [found] = res?.ok ? await res.json() : [];
    const point = found ? [Number(found.lon), Number(found.lat)] : null;
    if (res?.ok) await idb("geo", "readwrite", (st) => st.put(point, key)).catch(() => {});
    await new Promise((r) => setTimeout(r, 1100)); // правило Nominatim — не чаще раза в секунду
    return point;
  });
  tourGeoQueue = run.catch(() => null);
  return run;
}

const tourData = () => {
  const features = [];
  for (const t of tours.values()) {
    const stops = t.sections.filter((sec) => sec.point);
    // пунктир — только у поездки-маршрута (поле «Маршрут:»); у подборки вариантов остановки не по порядку
    if (t.route && stops.length > 1) {
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: stops.map((sec) => sec.point) },
        properties: { kind: "route", tour: t.id } });
    }
    // остановки в одном месте (одна деревня — две тропы) разводятся на экране по кругу на 22 px,
    // чтобы номера не слипались на любом масштабе
    const same = new Map();
    stops.forEach((sec) => {
      const key = sec.point.join(","), k = same.get(key) || 0;
      same.set(key, k + 1);
      const off = k ? [22 * Math.cos(k * 2.1), 22 * Math.sin(k * 2.1)] : [0, 0];
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: sec.point },
        properties: { kind: "stop", tour: t.id, n: sec.n, title: sec.title, hover: `tour/${t.id}/${sec.n}`, off, textOff: off.map((v) => v / 11) } });
    });
    const at = t.point || stops[0]?.point;
    if (at) features.push({ type: "Feature", geometry: { type: "Point", coordinates: at },
      properties: { kind: "tour", tour: t.id, title: t.title, hover: `tour/${t.id}` } });
  }
  return { type: "FeatureCollection", features };
};
const refreshTours = () => map.getSource("ov-tours")?.setData(tourData());

// кружок остановки: оранжевый в белой (у выделенной — розовой) обводке, 22 px; номер — текстом поверх
function tourStopImage(ring = "#fff") {
  const ctx = new OffscreenCanvas(44, 44).getContext("2d");
  ctx.beginPath();
  ctx.arc(22, 22, 21, 0, 2 * Math.PI);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(22, 22, 17, 0, 2 * Math.PI);
  ctx.fillStyle = TOUR_COLOR;
  ctx.fill();
  return ctx.getImageData(0, 0, 44, 44);
}

// Поиск экскурсий — режим строки поиска (Грегори, 2026-10-01): значок карты рядом с лупой
// переключает строку в «Найти экскурсию» и обратно. Ввод — фильтр по названию, региону,
// стране, городу, типу и тегам. Список — страны (флаг, светло-синие); страна или город с
// одной экскурсией — без группы, сама экскурсия; с несколькими — группа, свёрнута, пока не
// раскрыть (города — светло-зелёные). При вводе группы с находками раскрываются сами.
// Клавиатура: ↓/↑ — по строкам (текст в строке поиска остаётся), пробел или →/← — раскрыть/
// свернуть группу, Enter — выбрать (без выделения — первая найденная), Esc — назад/закрыть.
// После выбора текст стирается. Список до кнопки «Слои», фон полупрозрачный
let tourMode = false;
const tourList = document.getElementById("tour-list");
const tourOpen = new Set(); // раскрытые группы: "c:Италия", "g:Италия/Сицилия"
let tourCursor = null; // ключ выделенной строки
const tourCountry = (t) => t.country || (t.region.includes(",") ? t.region.split(",").pop().trim() : t.region) || "Без страны";
// флаги — картинками flagcdn: эмодзи-флагов в Windows нет (вместо флага две буквы)
const COUNTRY_CODES = {
  "австрия": "at", "албания": "al", "армения": "am", "бельгия": "be", "болгария": "bg", "босния и герцеговина": "ba",
  "великобритания": "gb", "венгрия": "hu", "германия": "de", "греция": "gr", "грузия": "ge", "дания": "dk",
  "египет": "eg", "израиль": "il", "индия": "in", "индонезия": "id", "иордания": "jo", "ирландия": "ie",
  "исландия": "is", "испания": "es", "италия": "it", "кипр": "cy", "китай": "cn", "латвия": "lv", "литва": "lt",
  "люксембург": "lu", "мальта": "mt", "марокко": "ma", "мексика": "mx", "нидерланды": "nl", "норвегия": "no",
  "оаэ": "ae", "польша": "pl", "португалия": "pt", "румыния": "ro", "сербия": "rs", "словакия": "sk",
  "словения": "si", "сша": "us", "таиланд": "th", "тунис": "tn", "турция": "tr", "финляндия": "fi",
  "франция": "fr", "хорватия": "hr", "черногория": "me", "чехия": "cz", "швейцария": "ch", "швеция": "se",
  "эстония": "ee", "япония": "jp", "вьетнам": "vn", "канада": "ca", "бразилия": "br", "аргентина": "ar",
  "чили": "cl", "перу": "pe", "куба": "cu", "шри-ланка": "lk", "мальдивы": "mv", "казахстан": "kz",
  "узбекистан": "uz", "азербайджан": "az", "сербия": "rs", "северная македония": "mk", "андорра": "ad", "монако": "mc",
};
const TOUR_PIN = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;

// Значок экскурсии (поле «Значок:», иначе по «Тип:») — монохромный, в оранжевом кружке, в
// списке и в шапке панели. Любой другой короткий текст (эмодзи, буква) — как есть
function tourIcon(t) {
  const city = placeIcon("M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z");
  const beach = placeIcon("M13.13 14.56l1.43-1.43 6.44 6.44L19.57 21zm4.29-5.73l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.02l-.01.01c-.38 3.01 1.17 6.88 4.3 10.02l5.73-5.73c-3.13-3.13-7.01-4.68-10.02-4.3z");
  const castle = placeIcon("M2 5h3v2h2V5h3v2h4V5h3v2h2V5h3v5h-2v11h-7v-4a2 2 0 0 0-4 0v4H4V10H2V5z");
  const wine = placeIcon("M6 3v6c0 2.97 2.16 5.43 5 5.91V19H8v2h8v-2h-3v-4.09c2.84-.48 5-2.94 5-5.91V3H6zm10 5H8V5h8v3z");
  const church = placeIcon("M18 12.22V9l-5-2.5V5h2V3h-2V1h-2v2H9v2h2v1.5L6 9v3.22L2 14v8h8v-4a2 2 0 0 1 4 0v4h8v-8l-4-1.78z");
  const park = placeIcon("M17 12h2L12 2 5.05 12H7l-3.9 6h6.92v4h3.96v-4H21z");
  const food = placeIcon("M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z");
  const museum = placeIcon("M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z");
  const map = {
    "город": city, "города": city, "по стране": CHIP_ICONS.tours, "страна": CHIP_ICONS.tours, "по региону": CHIP_ICONS.tours,
    "горы": CHIP_ICONS.hillshade, "вулкан": CHIP_ICONS.hillshade, "вулканы": CHIP_ICONS.hillshade,
    "море": beach, "пляж": beach, "пляжи": beach, "поход": CHIP_ICONS.hiking, "пешком": CHIP_ICONS.hiking,
    "тропы": CHIP_ICONS.hiking, "пешие тропы": CHIP_ICONS.hiking, "замок": castle, "крепость": castle, "крепости": castle,
    "музей": museum, "музеи": museum, "история": museum, "исторические": museum, "гастро": food, "еда": food,
    "вино": wine, "храм": church, "церковь": church, "храмы": church, "природа": park, "лес": park,
    "поезд": CHIP_ICONS.railways, "лодка": PIN_GLYPHS.boat && placeIcon(PIN_GLYPHS.boat), "остров": beach, "фото": CHIP_ICONS.photos,
  };
  const key = (t.icon || t.kind || "").trim().toLowerCase();
  if (map[key]) return map[key];
  if (t.icon && [...t.icon.trim()].length <= 2) return `<span class="tour-icon-text">${escapeHtml(t.icon.trim())}</span>`;
  return TOUR_PIN;
}

function setTourMode(on) {
  tourMode = on;
  const input = el("search-input");
  el("search-tour-btn").classList.toggle("on", on);
  el("search-tour-btn").title = on ? "Скрыть экскурсии и вернуться к поиску мест" : "Экскурсии: показать на карте, найти, список по странам";
  input.placeholder = on ? "Найти экскурсию" : "Поиск места";
  input.value = "";
  el("search-clear-btn").hidden = true;
  clearSearchResults();
  tourCursor = null;
  tourList.hidden = !on;
  // экскурсии на карте — только пока кнопка нажата (Грегори)
  if (on !== activeOverlays.has("tours") && "showDirectoryPicker" in window) toggleOverlay("tours");
  if (on) { renderTourList(); input.focus(); }
}

function chooseTour(t) {
  tourList.hidden = true;
  tourCursor = null;
  el("search-input").value = "";
  el("search-clear-btn").hidden = true;
  el("search-input").blur();
  openTour(t.id);
}

function renderTourList() {
  const q = el("search-input").value.trim().toLowerCase();
  const all = [...tours.values()].filter((t) => !q
    || [t.title, t.region, t.country, t.city, t.kind, t.tags].join(" ").toLowerCase().includes(q));
  const tree = new Map(); // страна → город → экскурсии
  for (const t of all) {
    const c = tourCountry(t);
    if (!tree.has(c)) tree.set(c, new Map());
    const g = t.city || "";
    if (!tree.get(c).has(g)) tree.get(c).set(g, []);
    tree.get(c).get(g).push(t);
  }
  // все сворачиваемые группы: страны всегда, города — если в них больше одной экскурсии
  const groupKeys = [];
  for (const [country, cities] of tree) {
    groupKeys.push(`c:${country}`);
    for (const [city, ts] of cities) if (city && ts.length > 1) groupKeys.push(`g:${country}/${city}`);
  }
  const rows = [];
  const row = (key, cls, html, onClick) => {
    const r = Object.assign(document.createElement("button"), { className: `tour-row ${cls}`, innerHTML: html });
    r.dataset.key = key;
    r.addEventListener("click", onClick);
    rows.push(r);
    return r;
  };
  const flag = (c) => (COUNTRY_CODES[c.toLowerCase()] ? `<img class="tour-flag" alt="" src="https://flagcdn.com/w40/${COUNTRY_CODES[c.toLowerCase()]}.png">` : `<span class="tour-flag"></span>`);
  const chevron = (open) => `<span class="tour-row-chevron${open ? " open" : ""}">${CHEVRON_ICON}</span>`;
  const tourRow = (t) => row(`t:${t.id}`, "tour-row-item",
    `<span class="tour-row-pin">${tourIcon(t)}</span><span class="tour-row-text"><span class="tour-row-title">${escapeHtml(t.title)}</span>`
    + `<span class="tour-row-sub">${escapeHtml([t.kind, t.region].filter(Boolean).join(" · "))}</span></span>`, () => chooseTour(t));
  const toggle = (key) => () => { tourOpen.has(key) ? tourOpen.delete(key) : tourOpen.add(key); tourCursor = key; renderTourList(); };
  // свернуть/развернуть все — первой строкой
  if (groupKeys.length && !q) {
    const allOpen = groupKeys.every((k) => tourOpen.has(k));
    row("all", "tour-row-all", `<span class="tour-row-name">${allOpen ? "Свернуть все" : "Развернуть все"}</span>`
      + `<span class="tour-row-chevron${allOpen ? " open" : ""}">${allOpen ? UNFOLD_ICON : FOLD_ICON}</span>`, () => {
      if (allOpen) for (const k of groupKeys) tourOpen.delete(k); else for (const k of groupKeys) tourOpen.add(k);
      tourCursor = "all";
      renderTourList();
    });
  }
  for (const country of [...tree.keys()].sort((a, b) => a.localeCompare(b, "ru"))) {
    const cities = tree.get(country);
    const count = [...cities.values()].flat().length;
    // страна — всегда отдельной строкой-группой, даже с одной экскурсией (Грегори)
    const ck = `c:${country}`;
    const cOpen = !!q || tourOpen.has(ck);
    row(ck, "tour-row-country", `${flag(country)}<span class="tour-row-name">${escapeHtml(country)}</span>`
      + `<span class="tour-row-count">${count}</span>${chevron(cOpen)}`, toggle(ck));
    if (!cOpen) continue;
    // «по стране» (без города) — первыми, дальше города по алфавиту
    for (const city of [...cities.keys()].sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0) || a.localeCompare(b, "ru"))) {
      const ts = cities.get(city).sort((a, b) => a.title.localeCompare(b.title, "ru"));
      if (!city || ts.length === 1) { for (const t of ts) tourRow(t).classList.add("in-country"); continue; }
      const gk = `g:${country}/${city}`;
      const gOpen = !!q || tourOpen.has(gk);
      row(gk, "tour-row-group in-country", `<span class="tour-row-name">${escapeHtml(city)}</span>`
        + `<span class="tour-row-count">${ts.length}</span>${chevron(gOpen)}`, toggle(gk));
      if (gOpen) for (const t of ts) tourRow(t).classList.add("in-group");
    }
  }
  if (!rows.length) {
    rows.push(Object.assign(document.createElement("div"), { className: "tour-list-empty", textContent: tours.size ? "Ничего не нашлось"
      : tourDir ? "В папке экскурсий нет файлов" : "Папка экскурсий не выбрана — ⚙ настройки" }));
  }
  tourList.replaceChildren(...rows);
  markTourCursor();
}

function markTourCursor() {
  for (const r of tourList.querySelectorAll(".tour-row")) {
    const on = r.dataset.key === tourCursor;
    r.classList.toggle("active", on);
    if (on) r.scrollIntoView({ block: "nearest" });
  }
}

function tourKeydown(e) {
  const rows = [...tourList.querySelectorAll(".tour-row")];
  const i = rows.findIndex((r) => r.dataset.key === tourCursor);
  const cur = rows[i];
  const isGroup = cur && !cur.classList.contains("tour-row-item");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    tourList.hidden = false;
    if (rows.length) tourCursor = rows[Math.min(rows.length - 1, i + 1)].dataset.key;
    markTourCursor();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    tourCursor = i > 0 ? rows[i - 1].dataset.key : null;
    markTourCursor();
  } else if ((e.key === " " || e.key === "ArrowRight" || e.key === "ArrowLeft") && isGroup) {
    e.preventDefault();
    const open = tourOpen.has(tourCursor);
    if (e.key === " " || (e.key === "ArrowRight") !== open) cur.click();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (cur) cur.click();
    else tourList.querySelector(".tour-row-item")?.click();
  } else if (e.key === "Escape") {
    if (tourCursor) { tourCursor = null; markTourCursor(); } else { tourList.hidden = true; el("search-input").blur(); }
  }
}

function updateTourFinder() {
  if (tourMode && !tourList.hidden) renderTourList();
}

function addTours(before) {
  map.addSource("ov-tours", { type: "geojson", data: tourData() });
  const kind = (k) => ["==", ["get", "kind"], k];
  map.addLayer({ id: "ov-tour-route", type: "line", source: "ov-tours", minzoom: 6, filter: kind("route"),
    paint: { "line-color": TOUR_COLOR, "line-width": 2, "line-opacity": 0.8, "line-dasharray": [2, 2] } }, before);
  if (!map.hasImage("tour-stop")) map.addImage("tour-stop", tourStopImage(), { pixelRatio: 2 });
  map.addLayer({ id: "ov-tour-stops", type: "symbol", source: "ov-tours", minzoom: 6, filter: kind("stop"),
    layout: { "icon-image": "tour-stop", "icon-offset": ["array", "number", 2, ["get", "off"]],
      "text-field": ["to-string", ["get", "n"]], "text-font": styleFont(), "text-size": 11,
      "text-offset": ["array", "number", 2, ["get", "textOff"]],
      "icon-allow-overlap": true, "text-allow-overlap": true, "icon-ignore-placement": true, "text-ignore-placement": true },
    paint: { "text-color": "#fff" } }, before);
  // выделенная остановка — крупнее, в розовом кольце, как выделенный снимок
  if (!map.hasImage("tour-stop-sel")) map.addImage("tour-stop-sel", tourStopImage(PHOTO_COLOR), { pixelRatio: 2 });
  map.addLayer({ id: "ov-tour-sel", type: "symbol", source: "ov-tours", minzoom: 6, filter: tourSelFilter(),
    layout: { "icon-image": "tour-stop-sel", "icon-size": 1.35, "icon-offset": ["array", "number", 2, ["get", "off"]],
      "text-field": ["to-string", ["get", "n"]], "text-font": styleFont(), "text-size": 14,
      "text-offset": ["array", "number", 2, ["get", "textOff"]],
      "icon-allow-overlap": true, "text-allow-overlap": true, "icon-ignore-placement": true, "text-ignore-placement": true },
    paint: { "text-color": "#fff" } }, before);
  map.addLayer({ id: "ov-tour-marks", type: "circle", source: "ov-tours", maxzoom: 9, filter: kind("tour"),
    paint: { "circle-color": TOUR_COLOR, "circle-radius": 7, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } }, before);
  map.addLayer({ id: "ov-tour-labels", type: "symbol", source: "ov-tours", maxzoom: 9, filter: kind("tour"),
    layout: { "text-field": ["get", "title"], "text-font": styleFont(), "text-size": 12, "text-anchor": "left",
      "text-offset": [0.9, 0], "text-optional": true },
    // на тёмной карте и спутнике — светлые с тёмной обводкой (Грегори: «в инверсию в зависимости от фона»)
    paint: darkBasemap() ? { "text-color": "#ffe0b2", "text-halo-color": "rgba(0,0,0,0.85)", "text-halo-width": 1.5 }
      : { "text-color": "#8a3c00", "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.5 } }, before);
  raiseTrailPoi();
  initTours();
  updateTourFinder();
}

async function initTours() {
  if (tourDir || !("showDirectoryPicker" in window)) return;
  const handle = await idb("settings", "readonly", (st) => st.get("tours")).catch(() => null);
  renderTourSettings(handle);
  if (!handle) return;
  if (await handle.queryPermission({ mode: "read" }) === "granted") readTours(handle);
  else showFolderAccessButton("tours-access", CHIP_ICONS.tours, `Открыть экскурсии (${handle.name})`, handle, readTours);
}

function setTourStatus(text) {
  tourStatus = text;
  const node = document.getElementById("tours-status");
  if (node) node.textContent = text;
}

// все .md/.txt папки и подпапок; изменённые (по дате файла) — разобрать заново, места — найти
async function readTours(handle) {
  tourDir = handle;
  const seen = new Set();
  const walk = async (dir, path) => {
    for await (const [name, h] of dir.entries()) {
      if (name.startsWith("_") || name.startsWith(".")) continue;
      if (h.kind === "directory") await walk(h, `${path}/${name}`);
      else if (TOUR_TEXT_RE.test(name)) {
        const id = `${path}/${name}`;
        seen.add(id);
        const file = await h.getFile();
        if (tours.get(id)?.mtime === file.lastModified) continue;
        const bytes = await file.arrayBuffer();
        let text;
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { text = new TextDecoder("windows-1251").decode(bytes); }
        tours.set(id, { id, file: name, handle: h, mtime: file.lastModified, ...parseTour(text, name) });
      }
    }
  };
  try { await walk(handle, handle.name); } catch { setTourStatus("Папка недоступна"); return; }
  for (const id of tours.keys()) if (!seen.has(id)) tours.delete(id);
  const list = [...tours.values()];
  // номера — только у остановок с местом, по порядку
  for (const t of list) { let n = 0; for (const sec of t.sections) sec.n = sec.place ? ++n : 0; }
  refreshTours();
  setTourStatus(`Экскурсий: ${list.length}`);
  for (const t of list) {
    if (t.region && !t.point) t.point = await tourGeocode(t.region).catch(() => null);
    for (const sec of t.sections) if (sec.place && !sec.point) sec.point = await tourGeocode(sec.place, t.point, t.region).catch(() => null);
    refreshTours();
    if (tourPanelId === t.id && !tourEditing) renderTourPanel(t.id);
  }
  const lost = list.flatMap((t) => t.sections.filter((sec) => sec.place && !sec.point).map((sec) => sec.place));
  updateTourFinder();
  setTourStatus(`Экскурсий: ${list.length}${lost.length ? `; не нашлись места: ${lost.join(", ")}` : ""}`);
}
addEventListener("focus", () => { if (tourDir && activeOverlays.has("tours")) readTours(tourDir); });

async function pickTourFolder() {
  let handle;
  try { handle = await window.showDirectoryPicker({ id: "travel-earth-tours", mode: "read" }); } catch { return; }
  await idb("settings", "readwrite", (st) => st.put(handle, "tours"));
  tours.clear();
  renderTourSettings(handle);
  if (!activeOverlays.has("tours")) toggleOverlay("tours");
  readTours(handle);
}

async function forgetTourFolder() {
  await idb("settings", "readwrite", (st) => st.delete("tours"));
  tourDir = null;
  tours.clear();
  refreshTours();
  closeTourPanel();
  renderTourSettings(null);
  setTourStatus("");
}

function renderTourSettings(handle) {
  const name = document.getElementById("tours-folder");
  if (!name) return;
  const supported = "showDirectoryPicker" in window;
  name.textContent = !supported ? "нужен Chrome или Edge на компьютере" : handle ? handle.name : "не выбрана";
  document.getElementById("tours-pick").disabled = !supported;
  document.getElementById("tours-pick").textContent = handle ? "Выбрать другую…" : "Выбрать папку…";
  document.getElementById("tours-forget").hidden = !handle;
  document.getElementById("tours-status").textContent = tourStatus;
}

// панель дайджеста справа
const SPEAK_ICON = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const PLAY_ICON = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
let tourPanelId = null;
const tourPanel = Object.assign(document.createElement("aside"), { className: "tour-panel", hidden: true });
document.body.append(tourPanel);

function closeTourPanel() {
  stopTourPlay();
  tourPanel.hidden = true;
  tourPanelId = null;
  tourEditing = false;
  speechSynthesis?.cancel();
  selectTourStop(null);
}

// ---------- обзорная экскурсия: озвучка с переходами по точкам и слайд-шоу ----------

// Грегори: «обзорная озвучка с переходами по точкам, возможно слайд-шоу». Кнопка ▶ в шапке
// панели: вступление (название и идея, вся поездка в кадре), затем по порядку каждая остановка
// с местом — подсвечивается, карта перелетает к ней, читается номер, название, точки,
// особенности, справка и выдержка; пока читается — слайд-шоу фото этого места: сначала свои
// (слой «Мои фото», снимки ближе 1 км), затем общедоступные из Commons (поиск вокруг точки,
// кэш tourSlideCache). Полоска плеера под шапкой: назад, пауза, вперёд, стоп и «3 / 7 ·
// название». Пауза = остановить чтение; продолжение — с начала текущей остановки (пауза
// онлайн-голосов в Chrome ненадёжна). Любая кнопка «Послушать» или закрытие панели — стоп
let tourPlay = null; // { id, stops, i, paused, run }
const PAUSE_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
const PREV_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>`;
const NEXT_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`;
const STOP_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>`;
const PLAY_BIG_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tourSlides = Object.assign(document.createElement("div"), { className: "tour-slides", hidden: true });
tourSlides.innerHTML = `<img alt=""><img alt=""><div class="tour-slides-caption"></div>`;
document.body.append(tourSlides);
const tourSlideCache = new Map(); // "lon,lat" → [{ url, caption }]
let slideTimer = 0;

// что читать на остановке
function stopNarration(sec) {
  return [
    `${sec.n}. ${sec.title || sec.place}.`,
    sec.points?.length && `Точки: ${sec.points.join(", ").replace(/\s*→\s*/g, ", ")}.`,
    sec.features?.length && sec.features.map((f) => f.replace(/[.;]?$/, ".")).join(" "),
    sec.paras?.join(" "),
    sec.history?.join(" "),
    sec.quote?.join(" "),
  ].filter(Boolean).join(" ");
}

function startTourPlay(id, from = 0) {
  const t = tours.get(id);
  if (!t) return;
  speechSynthesis?.cancel();
  for (const b of document.querySelectorAll(".speaking")) b.classList.remove("speaking");
  const stops = t.sections.filter((sec) => sec.n && sec.point);
  tourPlay = { id, stops, i: from, paused: false, run: {} };
  tourPanel.classList.remove("min");
  playTourStep();
}

function stopTourPlay() {
  if (!tourPlay) return;
  tourPlay.run = null;
  tourPlay = null;
  speechSynthesis?.cancel();
  hideSlides();
  renderTourPlayer();
}

async function playTourStep() {
  const play = tourPlay;
  if (!play) return;
  const run = play.run = {}; // новая попытка — предыдущая, увидев чужой run, сама выходит
  const alive = () => tourPlay === play && play.run === run && !play.paused;
  renderTourPlayer();
  const t = tours.get(play.id);
  if (play.i < 0) {
    // вступление: вся поездка в кадре и сразу картинки — пока они грузятся, начинается рассказ
    openTour(play.id);
    const first = t.point || play.stops[0]?.point;
    if (first) showSlides(first);
    await speakText([t.title, ...t.idea].join(". "));
  } else {
    const sec = play.stops[play.i];
    selectTourStop(play.id, sec.n);
    // картинки новой остановки — сразу, ещё во время перелёта
    showSlides(sec.point);
    // точка — в свободной части кадра: справа панель, внизу слева слайд-шоу
    const narrow = matchMedia("(max-width: 600px)").matches;
    map.flyTo({ center: sec.point, zoom: Math.max(14, Math.min(map.getZoom(), 15)), duration: 3000,
      offset: narrow ? [0, 110] : [-200, -140] });
    await new Promise((r) => { map.once("moveend", r); setTimeout(r, 4000); });
    if (!alive()) return;
    await speakText(stopNarration(sec));
  }
  if (!alive()) return;
  await wait(1200);
  if (!alive()) return;
  if (play.i + 1 >= play.stops.length) { stopTourPlay(); return; }
  play.i++;
  playTourStep();
}

// выбранная рукой остановка (на карте или в панели) во время аудиогида — рассказ переходит
// к ней и дальше идёт по порядку от неё (Грегори: «после выбора точки продолжать с учётом
// нового порядка»; раньше аудиогид выбора не замечал и шёл своим порядком)
function jumpTourPlay(tour, n) {
  if (!tourPlay || tourPlay.id !== tour) return false;
  const i = tourPlay.stops.findIndex((sec) => sec.n === n);
  if (i < 0) return false;
  tourPlay.i = i;
  tourPlay.paused = false;
  speechSynthesis.cancel();
  playTourStep();
  return true;
}

function tourPlayGo(delta) {
  if (!tourPlay) return;
  tourPlay.i = Math.max(-1, Math.min(tourPlay.stops.length - 1, tourPlay.i + delta));
  tourPlay.paused = false;
  speechSynthesis.cancel();
  playTourStep();
}

function tourPlayPause() {
  if (!tourPlay) return;
  tourPlay.paused = !tourPlay.paused;
  if (tourPlay.paused) { tourPlay.run = null; speechSynthesis.cancel(); clearInterval(slideTimer); renderTourPlayer(); }
  else playTourStep();
}

// полоска плеера под шапкой панели
// плеер аудиогида — всегда в строке кнопок шапки: «плей» запускает аудиогид, остальные
// кнопки работают, пока он идёт; под названием — «3 / 7 · остановка» (Грегори: отдельная
// кнопка-наушники убрана, плеер сверху всегда — больше места названию)
function renderTourPlayer() {
  const bar = tourPanel.querySelector(".tour-player");
  if (!bar) return;
  const id = tourPanelId;
  const play = tourPlay?.id === id ? tourPlay : null;
  const b = (icon, title, fn, off) => {
    const x = Object.assign(document.createElement("button"), { className: "tour-edit", title, innerHTML: icon, disabled: !!off });
    x.addEventListener("click", fn);
    return x;
  };
  const main = b(play && !play.paused ? PAUSE_ICON : PLAY_BIG_ICON,
    !play ? "Аудиогид: рассказ с переходами по точкам и слайд-шоу" : play.paused ? "Продолжить" : "Пауза",
    () => (play ? tourPlayPause() : startTourPlay(id, -1)));
  main.classList.toggle("on", !!play);
  bar.replaceChildren(b(PREV_ICON, "Назад", () => tourPlayGo(-1), !play), main,
    b(NEXT_ICON, "Дальше", () => tourPlayGo(1), !play), b(STOP_ICON, "Стоп", stopTourPlay, !play));
  const label = tourPanel.querySelector(".tour-player-label");
  const sec = play?.stops[play.i];
  label.hidden = !play;
  label.textContent = !play ? "" : play.i < 0 ? "Вступление" : `${play.i + 1} / ${play.stops.length} · ${sec.title || sec.place}`;
}

// слайд-шоу: свои снимки ближе 1 км, потом Commons вокруг точки; смена раз в 5 с с растворением
async function showSlides(point) {
  clearInterval(slideTimer);
  const key = point.join(",");
  const play = tourPlay;
  let slides = tourSlideCache.get(key);
  if (!slides) {
    slides = [];
    const near = (c) => Math.hypot((c[0] - point[0]) * Math.cos((point[1] * Math.PI) / 180), c[1] - point[1]) < 0.009;
    for (const f of myPhotoFeatures.values()) {
      if (slides.length >= 6) break;
      if (near(f.geometry.coordinates)) {
        slides.push({ mine: f.properties.photo, title: f.properties.title, date: f.properties.date, album: f.properties.albumName,
          caption: `${f.properties.albumName} · ${f.properties.date || f.properties.title}` });
      }
    }
    try {
      const q = (params) => fetch(`${COMMONS_API}?${new URLSearchParams({ action: "query", format: "json", formatversion: 2, origin: "*", ...params })}`)
        .then((r) => r.json()).then((d) => d.query || {});
      const found = ((await q({ list: "geosearch", gscoord: `${point[1]}|${point[0]}`, gsradius: 1000, gsnamespace: 6, gslimit: 40 })).geosearch || [])
        .filter((g) => /\.(jpe?g|webp)$/i.test(g.title)).slice(0, 10 - slides.length);
      if (found.length) {
        const pages = (await q({ pageids: found.map((g) => g.pageid).join("|"), prop: "imageinfo", iiprop: "url|size|extmetadata",
          iiurlwidth: 960, iiextmetadatafilter: "Artist|LicenseShortName" })).pages || [];
        // по расстоянию от точки, как их отдал geosearch
        const order = new Map(found.map((g, i) => [g.pageid, i]));
        pages.sort((a, b) => order.get(a.pageid) - order.get(b.pageid));
        for (const pg of pages) {
          const ii = pg.imageinfo?.[0];
          if (!ii?.thumburl) continue;
          const meta = ii.extmetadata || {};
          const author = stripHtml(meta.Artist?.value || ""), license = meta.LicenseShortName?.value || "";
          slides.push({ url: ii.thumburl, full: ii.url, width: ii.width, page: ii.descriptionurl, pageid: pg.pageid, author, license,
            title: pg.title.replace(/^File:/, "").replace(/\.\w+$/, "").replace(/_/g, " "),
            caption: [author, license, "Wikimedia Commons"].filter(Boolean).join(" · ") });
        }
      }
    } catch { /* без Commons — только свои */ }
    tourSlideCache.set(key, slides);
  }
  if (tourPlay !== play || !slides.length) { if (!slides.length) hideSlides(); return; }
  let k = 0, front = 0;
  tourSlides.slides = slides;
  // открытая галерея слайд-шоу — получает фото новой остановки
  if (slideGallery && !slideGallery.closed) sendSlidesToGallery(0, true);
  const imgs = tourSlides.querySelectorAll("img");
  const show = async () => {
    const sl = slides[k++ % slides.length];
    const url = sl.mine ? await myFileFull(sl.mine).catch(() => "") : sl.url;
    if (!url || tourPlay !== play) return;
    const next = imgs[1 - front];
    const index = (k - 1) % slides.length;
    next.onload = () => {
      tourSlides.current = index;
      if (slideGallery && !slideGallery.closed) slideGallery.postMessage({ galleryShow: index }, location.origin);
      next.classList.add("on");
      imgs[front].classList.remove("on");
      front = 1 - front;
      tourSlides.querySelector(".tour-slides-caption").textContent = sl.caption;
    };
    next.src = url;
  };
  tourSlides.hidden = false;
  // выбор снимка в галерее — его же в слайд-шоу, отсчёт смены заново
  tourSlides.showAt = (i) => {
    clearInterval(slideTimer);
    k = i;
    show();
    if (slides.length > 1) slideTimer = setInterval(show, 5000);
  };
  await show();
  if (slides.length > 1) slideTimer = setInterval(show, 5000);
}

// двойной щелчок по слайд-шоу — эти же фото в окне галереи, с текущего (Грегори: «фотки в новое
// окно; на полный экран не надо»). Свои снимки галерея читает через главное окно, как альбом
tourSlides.title = "Двойной щелчок — фото в отдельном окне";
// Галерея слайд-шоу живая (Грегори: «альбом, открытый во время экскурсии, интерактивным, и
// фотографии сменялись по ходу экскурсии»): на новой остановке в неё приходят новые фото,
// смена слайда — переход к тому же снимку в галерее, а выбор снимка в галерее — его же в
// слайд-шоу (сообщения galleryShow / gallery: "photo"; петли нет — текущий снимок не повторяется)
let slideGallery = null;
const slideId = (sl) => sl.mine || `photo/${sl.pageid}`;
function sendSlidesToGallery(start, reload) {
  const slides = tourSlides.slides;
  if (!slides?.length) return;
  const sec = tourPlay?.stops?.[tourPlay.i];
  const photos = slides.map((sl) => (sl.mine
    ? { photo: sl.mine, my: true, title: sl.title, date: sl.date, license: sl.album ? `Альбом «${sl.album}»` : "", thumb: myFiles.get(sl.mine)?.thumb || "" }
    : { photo: slideId(sl), title: sl.title, author: sl.author, license: sl.license, page: sl.page, thumb: sl.url, full: sl.full, fullWidth: sl.width }));
  localStorage.setItem(PHOTO_GALLERY_KEY, JSON.stringify({ photos, start, slides: true, stop: sec ? `${sec.n}. ${sec.title || sec.place}` : "" }));
  if (reload) slideGallery.postMessage({ galleryReload: true }, location.origin);
}
tourSlides.addEventListener("dblclick", () => {
  if (!tourSlides.slides?.length) return;
  slideGallery = null;
  sendSlidesToGallery(tourSlides.current || 0, false);
  slideGallery = openSideWindow(`gallery.html?t=${Date.now()}`, "travel-earth-gallery");
});

function hideSlides() {
  clearInterval(slideTimer);
  tourSlides.hidden = true;
  for (const img of tourSlides.querySelectorAll("img")) { img.classList.remove("on"); img.removeAttribute("src"); }
}

// Голос — один из установленных в системе и браузере (своего синтеза у страницы нет). Лучшие —
// «естественные» онлайн-голоса: в Edge «Microsoft Svetlana/Dmitry Online (Natural)», в Chrome
// «Google русский»; простые голоса Windows (Irina, Pavel) — роботизированные. По умолчанию
// берётся лучший из найденных, выбор и скорость — в ⚙ настройках (localStorage, этот браузер).
// Текст читается по предложениям: Chrome обрывает длинную фразу онлайн-голоса через ~15 с
const VOICE_KEY = "travel-earth.voice", VOICE_RATE_KEY = "travel-earth.voice-rate";
const voiceRank = (v) => (/natural|neural|online/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : 2);
function ruVoices() {
  if (!("speechSynthesis" in window)) return [];
  return speechSynthesis.getVoices().filter((v) => /^ru/i.test(v.lang)).sort((a, b) => voiceRank(a) - voiceRank(b) || a.name.localeCompare(b.name));
}
const pickVoice = () => { const list = ruVoices(); return list.find((v) => v.name === localStorage.getItem(VOICE_KEY)) || list[0] || null; };

function speak(text, btn) {
  if (!("speechSynthesis" in window)) return;
  const was = btn?.classList.contains("speaking");
  stopTourPlay();
  speechSynthesis.cancel();
  for (const b of document.querySelectorAll(".speaking")) b.classList.remove("speaking");
  if (was) return;
  btn?.classList.add("speaking");
  speakText(text).then(() => btn?.classList.remove("speaking"));
}

// прочитать текст выбранным голосом; промис — когда дочитано (или прервано cancel)
function speakText(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !text) { resolve(); return; }
    const voice = pickVoice(), rate = Number(localStorage.getItem(VOICE_RATE_KEY)) || 1;
    const parts = text.match(/[^.!?…]+[.!?…]*\s*/g)?.map((x) => x.trim()).filter(Boolean) || [text];
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = voice?.lang || "ru-RU";
      if (voice) u.voice = voice;
      u.rate = rate;
      if (i === parts.length - 1) u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
    // Chrome иногда не присылает onend — тогда «дочитано», когда синтезатор замолчал
    const poll = setInterval(() => {
      if (!speechSynthesis.speaking && !speechSynthesis.pending) { clearInterval(poll); resolve(); }
    }, 700);
  });
}

function renderVoiceSettings() {
  const select = document.getElementById("voice-select");
  if (!select) return;
  const list = ruVoices(), current = pickVoice();
  select.replaceChildren(...list.map((v) => Object.assign(document.createElement("option"), {
    value: v.name, selected: v === current,
    textContent: `${v.name.replace(/^Microsoft\s+/, "").replace(/\s*-\s*Russian.*$/i, "")}${voiceRank(v) < 2 ? " — хороший" : ""}` })));
  if (!list.length) select.append(Object.assign(document.createElement("option"), { textContent: "русских голосов нет" }));
  select.disabled = !list.length;
  document.getElementById("voice-rate").value = localStorage.getItem(VOICE_RATE_KEY) || "1";
  document.getElementById("voice-hint").hidden = list.some((v) => voiceRank(v) < 2);
}
if ("speechSynthesis" in window) speechSynthesis.addEventListener("voiceschanged", renderVoiceSettings);

// Свёртка (Грегори: «пункты подсобрать, свернуть отдельно экскурсию и текст»): кнопка в шапке
// сворачивает текст всех пунктов (остаются номер, заголовок и строка фактов), стрелка у пункта —
// раскрывает/сворачивает только его; вторая кнопка сворачивает всю панель до шапки. Выбор
// запоминается (localStorage). Выделенная остановка всегда раскрыта
const TOUR_TEXT_KEY = "travel-earth.tour-text", TOUR_MIN_KEY = "travel-earth.tour-min", TOUR_AUDIO_KEY = "travel-earth.tour-audio";
const FOLD_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 18.59 8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zm9.18-13.18L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10l4.59-4.59z"/></svg>`;
const UNFOLD_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>`;
const COLLAPSE_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>`;
const EXPAND_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 19H5V5h14v14zM5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5z"/></svg>`;
const CHEVRON_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>`;

// стрелка пункта: в развёрнутом режиме — сворачивает его (.shut), в режиме «только пункты» — раскрывает (.open)
function foldButton(box) {
  const b = Object.assign(document.createElement("button"), { className: "tour-fold", title: "Свернуть / развернуть", innerHTML: CHEVRON_ICON });
  b.addEventListener("click", () => box.classList.toggle(tourPanel.classList.contains("titles") ? "open" : "shut"));
  return b;
}

function renderTourPanel(id) {
  const t = tours.get(id);
  if (!t) { closeTourPanel(); return; }
  tourPanelId = id;
  const h = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || "", textContent: text || "" });
  const speakBtn = (text) => {
    const b = Object.assign(document.createElement("button"), { className: "tour-speak", title: "Послушать", innerHTML: SPEAK_ICON });
    b.addEventListener("click", () => speak(text, b));
    return b;
  };
  tourEditing = false;
  const close = Object.assign(document.createElement("button"), { className: "tour-close", title: "Закрыть", textContent: "×" });
  close.addEventListener("click", closeTourPanel);
  const edit = Object.assign(document.createElement("button"), { className: "tour-edit", title: "Править файл экскурсии", innerHTML: EDIT_ICON });
  edit.addEventListener("click", () => editTour(id));
  const head = h("div", "tour-head");
  const title = h("h2", "", t.title);
  title.title = t.title;
  // свернуть: текст пунктов (остаются заголовки) и всю панель (остаётся шапка) — отдельно
  const textBtn = Object.assign(document.createElement("button"), { className: "tour-edit" });
  const setTextBtn = () => {
    const folded = tourPanel.classList.contains("titles");
    textBtn.innerHTML = folded ? UNFOLD_ICON : FOLD_ICON;
    textBtn.title = folded ? "Показать текст пунктов" : "Только пункты — свернуть текст";
  };
  textBtn.addEventListener("click", () => {
    const folded = !tourPanel.classList.contains("titles");
    tourPanel.classList.toggle("titles", folded);
    for (const box of tourPanel.querySelectorAll(".tour-section.open")) box.classList.remove("open");
    localStorage.setItem(TOUR_TEXT_KEY, folded ? "titles" : "full");
    setTextBtn();
  });
  const minBtn = Object.assign(document.createElement("button"), { className: "tour-edit" });
  const setMinBtn = () => {
    const min = tourPanel.classList.contains("min");
    minBtn.innerHTML = min ? EXPAND_ICON : COLLAPSE_ICON;
    minBtn.title = min ? "Развернуть экскурсию" : "Свернуть экскурсию";
  };
  minBtn.addEventListener("click", () => {
    const min = !tourPanel.classList.contains("min");
    tourPanel.classList.toggle("min", min);
    localStorage.setItem(TOUR_MIN_KEY, min ? "1" : "0");
    setMinBtn();
  });
  tourPanel.classList.toggle("titles", localStorage.getItem(TOUR_TEXT_KEY) === "titles");
  tourPanel.classList.toggle("min", localStorage.getItem(TOUR_MIN_KEY) === "1");
  setTextBtn();
  setMinBtn();
  const bar = h("div", "tour-bar");
  bar.append(h("div", "tour-player"), h("span", "tour-bar-gap"), textBtn, tourHelpButton(), edit, minBtn, close);
  const titleRow = h("div", "tour-title-row");
  const icon = h("span", "tour-row-pin tour-title-icon");
  icon.innerHTML = tourIcon(t);
  titleRow.append(icon, title);
  head.append(bar, titleRow, h("div", "tour-player-label"));
  const nodes = [head];
  // шапка экскурсии (регион, маршрут, идея) — тоже пункт, сворачивается как остальные
  const about = h("section", "tour-section tour-about");
  const aboutHead = h("div", "tour-sec-row");
  aboutHead.append(h("div", "tour-sec-title", "Об экскурсии"), foldButton(about));
  const aboutBody = h("div", "tour-sec-body");
  const meta = [t.region, t.tags].filter(Boolean).join(" · ");
  if (meta) aboutBody.append(h("div", "tour-meta", meta));
  if (t.route) aboutBody.append(h("div", "tour-points", `Маршрут: ${t.route}`));
  for (const line of t.idea) aboutBody.append(h("p", "tour-idea", line));
  if (aboutBody.childNodes.length) { about.append(aboutHead, aboutBody); nodes.push(about); }
  for (const sec of t.sections) {
    const box = h("section", "tour-section");
    if (sec.n) box.dataset.n = sec.n;
    if (sec.n && tourSel?.tour === id && tourSel.n === sec.n) box.classList.add("current", "open");
    const title = h(sec.point ? "button" : "div", "tour-sec-title");
    if (sec.n) title.append(h("span", "tour-num", String(sec.n)));
    title.append(sec.title || sec.place || "");
    if (sec.point) {
      title.title = "Показать на карте";
      title.addEventListener("click", () => {
        if (jumpTourPlay(id, sec.n)) return;
        selectTourStop(id, sec.n);
        map.flyTo({ center: sec.point, zoom: Math.max(map.getZoom(), 12), duration: 2000 });
      });
    }
    const row = h("div", "tour-sec-row");
    const body = h("div", "tour-sec-body");
    const facts = [sec.trail, sec.length, sec.time, sec.difficulty, sec.season].filter(Boolean).join(" · ");
    // факты — в строке заголовка, чтобы и в свёрнутом виде было видно главное
    row.append(title, foldButton(box));
    box.append(row);
    if (facts) box.append(h("div", "tour-facts", facts));
    box.append(body);
    if (sec.points?.length) body.append(h("div", "tour-points", `Точки: ${sec.points.join(" → ")}`));
    if (sec.features?.length) {
      const ul = h("ul", "tour-features");
      for (const f of sec.features) ul.append(h("li", "", f));
      body.append(ul);
    }
    for (const para of sec.paras || []) body.append(h("p", "", para));
    for (const [k, cls, label] of [["history", "tour-history", "Справка"], ["quote", "tour-quote", "Из источника"]]) {
      if (!sec[k]?.length) continue;
      const text = sec[k].join(" ");
      const block = h("div", cls);
      const top = h("div", "tour-block-head");
      // справку и выдержку можно свернуть до строки с кнопкой «Послушать»; последний выбор —
      // для всех плашек (localStorage)
      const fold = Object.assign(document.createElement("button"), { className: "tour-block-toggle", title: "Свернуть / развернуть текст" });
      fold.append(h("span", "", label), Object.assign(document.createElement("span"), { className: "tour-block-chevron", innerHTML: CHEVRON_ICON }));
      fold.addEventListener("click", () => {
        const shut = !block.classList.contains("shut");
        block.classList.toggle("shut", shut);
        localStorage.setItem(TOUR_AUDIO_KEY, shut ? "shut" : "open");
      });
      if (localStorage.getItem(TOUR_AUDIO_KEY) === "shut") block.classList.add("shut");
      top.append(fold, speakBtn(text));
      block.append(top, h("p", "", text));
      body.append(block);
    }
    if (!body.childNodes.length) box.querySelector(".tour-fold").remove();
    nodes.push(box);
  }
  if (t.sources.length) {
    const box = h("section", "tour-section tour-sources");
    const row = h("div", "tour-sec-row");
    row.append(h("div", "tour-sec-title", "Источники"), foldButton(box));
    const body = h("div", "tour-sec-body");
    box.append(row, body);
    for (const line of t.sources) {
      const src = tourSource(line);
      const line_ = h("div", "tour-source");
      if (src.url) {
        const a = Object.assign(document.createElement("a"), { href: src.url, target: "_blank", rel: "noopener" });
        if (src.video) a.innerHTML = PLAY_ICON;
        a.append(src.text);
        line_.append(a);
      } else line_.textContent = src.text;
      body.append(line_);
    }
    nodes.push(box);
  }
  tourPanel.replaceChildren(...nodes);
  tourPanel.classList.remove("editing");
  tourPanel.hidden = false;
  renderTourPlayer();
}

// Правка файла прямо в панели: страница не может запустить Блокнот, зато может записать в
// файл выбранной папки (File System Access API) — при первом сохранении Chrome спросит
// разрешение на изменение файлов. Ctrl+S — сохранить, Esc — отмена. Сохраняется в UTF-8
const EDIT_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
// «Информация» — как писать файл экскурсии (Грегори: «кнопка Информация с синтаксисом файла»);
// раскрывается под шапкой, в просмотре и в правке, повторное нажатие — прячет
const INFO_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`;
const TOUR_HELP = [
  ["# Название", "название поездки — первая строка"],
  ["Регион: Мадейра, Португалия", "точка поездки на глобусе (достаточно названия)"],
  ["Теги: пешком, водопады", "строкой под названием"],
  ["Страна: Италия\nГород: Рим\nТип: город", "группы в списке экскурсий: страна → город; тип — подписью"],
  ["Значок: замок", "значок в списке и в панели: город, горы, море, поход, замок, музей, гастро, вино, храм, природа, поезд, лодка, фото — или эмодзи; нет поля — по «Тип:»"],
  ["Маршрут: A → B → C", "поездка по порядку — пунктир между остановками; нет поля — остановки просто варианты"],
  ["Источники:\n- Статья — https://…\n- Видео — https://youtu.be/…", "ссылки внизу панели; YouTube — со значком ▶"],
  ["Просто текст в шапке", "идея поездки"],
  ["## Остановка", "раздел; с полем «Место:» — номер на карте"],
  ["Место: Rabaçal, Madeira", "название места или «32.76, -16.91»"],
  ["Тропа: PR 6\nДлина: 11 км · Время: 4 ч\nСложность: средняя · Сезон: весна", "факты — каждый с новой строки или несколько в строке через «·»; в панели — одной строкой"],
  ["Точки: Старт → Водопад", "основные точки"],
  ["Особенности:\n- взять фонарик", "список"],
  ["Справка: текст…", "историческая справка — можно послушать"],
  ["> выдержка", "цитата из источника — можно послушать"],
  ["## Советы", "раздел без «Место:» — без номера на карте"],
  ["_Черновик.md", "файлы с «_» в начале имени карта не читает"],
];
function tourHelpButton() {
  const b = Object.assign(document.createElement("button"), { className: "tour-edit", title: "Как писать файл экскурсии", innerHTML: INFO_ICON });
  b.addEventListener("click", () => {
    const open = tourPanel.querySelector(".tour-help");
    if (open) { open.remove(); b.classList.remove("on"); return; }
    const box = Object.assign(document.createElement("div"), { className: "tour-help" });
    box.append(Object.assign(document.createElement("div"), { className: "tour-help-title", textContent: "Как писать файл экскурсии (.md или .txt, Блокнот)" }));
    for (const [code, note] of TOUR_HELP) {
      const row = Object.assign(document.createElement("div"), { className: "tour-help-row" });
      row.append(Object.assign(document.createElement("pre"), { textContent: code }),
        Object.assign(document.createElement("span"), { textContent: note }));
      box.append(row);
    }
    b.closest(".tour-head").after(box);
    b.classList.add("on");
  });
  return b;
}

async function editTour(id) {
  const t = tours.get(id);
  if (!t?.handle) return;
  stopTourPlay();
  const bytes = await (await t.handle.getFile()).arrayBuffer();
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { text = new TextDecoder("windows-1251").decode(bytes); }
  tourEditing = true;
  speechSynthesis?.cancel();
  const h = (tag, cls, txt) => Object.assign(document.createElement(tag), { className: cls || "", textContent: txt || "" });
  const area = Object.assign(document.createElement("textarea"), { className: "tour-editor", value: text, spellcheck: true });
  const status = h("span", "tour-edit-status");
  const save = h("button", "text-btn tour-save", "Сохранить");
  const cancel = h("button", "text-btn tour-cancel", "Отмена");
  const doSave = async () => {
    try {
      if (await t.handle.queryPermission({ mode: "readwrite" }) !== "granted"
        && await t.handle.requestPermission({ mode: "readwrite" }) !== "granted") { status.textContent = "Нет разрешения на запись"; return; }
      const w = await t.handle.createWritable();
      await w.write(area.value);
      await w.close();
    } catch (err) { status.textContent = `Не сохранилось: ${err.message}`; return; }
    tourEditing = false;
    t.mtime = null;
    await readTours(tourDir);
    renderTourPanel(id);
  };
  save.addEventListener("click", doSave);
  cancel.addEventListener("click", () => renderTourPanel(id));
  area.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); doSave(); }
    else if (e.key === "Escape") renderTourPanel(id);
  });
  const head = h("div", "tour-head");
  const editTitle = h("div", "tour-title-row");
  editTitle.append(h("h2", "", `Правка: ${t.file}`), tourHelpButton());
  head.append(editTitle);
  // путь к файлу — ссылкой: открывает файл в новой вкладке. Запустить Блокнот или другую
  // программу страница не может, полного пути на диске не знает — только путь в выбранной папке
  const link = Object.assign(document.createElement("a"), { className: "tour-file-link", href: "#", textContent: t.id,
    title: "Открыть файл в новой вкладке. Сам файл — в выбранной папке экскурсий на этом компьютере" });
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    const file = await t.handle.getFile();
    const url = URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: "text/plain;charset=utf-8" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  const fileRow = h("div", "tour-file");
  fileRow.append("Файл: ", link);
  const bar = h("div", "tour-edit-bar");
  bar.append(save, cancel, status);
  tourPanel.replaceChildren(head, fileRow, area, bar, h("div", "tour-file", "Ctrl+S — сохранить, Esc — отмена. Как писать файл — кнопка «i» вверху"));
  tourPanel.classList.add("editing");
  area.focus();
  area.setSelectionRange(0, 0);
  area.scrollTop = 0;
}

function openTour(id) {
  renderTourPanel(id);
  const pts = (tours.get(id)?.sections || []).map((sec) => sec.point).filter(Boolean);
  if (pts.length > 1) {
    const lons = pts.map((c) => c[0]), lats = pts.map((c) => c[1]);
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
      { padding: { top: 90, bottom: 130, left: 90, right: 420 }, maxZoom: 13, duration: 2500 });
  } else if (pts.length || tours.get(id)?.point) map.flyTo({ center: pts[0] || tours.get(id).point, zoom: 10, duration: 2500 });
}

const tourAt = (point) => {
  const layers = TOUR_LAYERS.filter((l) => map.getLayer(l));
  return layers.length ? map.queryRenderedFeatures(point, { layers })[0] : null;
};
onHover(TOUR_LAYERS, (evt) => {
  const p = evt.features[0].properties;
  if (trailPoiHover === p.hover && trailPoiPopup?.isOpen()) return;
  trailPoiHover = p.hover;
  const t = tours.get(p.tour);
  openMediaPopup(evt.features[0].geometry.coordinates, 12, "260px",
    `<div class="popup-title">${escapeHtml(p.kind === "stop" ? `${p.n}. ${p.title}` : p.title)}</div>`
    + `<div class="popup-kind">${escapeHtml(p.kind === "stop" ? `Экскурсия «${t?.title || ""}»` : [t?.region, "экскурсия"].filter(Boolean).join(" · "))}</div>`
    + `<div class="popup-row popup-muted">Щелчок — открыть</div>`);
  trailPoiPopup.on("close", () => { if (trailPoiHover === p.hover) trailPoiHover = null; });
  keepTrailPoiInfoOnHover();
});
map.on("click", TOUR_LAYERS, (evt) => {
  const p = evt.features[0].properties;
  trailPoiPopup?.remove();
  if (p.kind === "stop") {
    if (tourPanelId !== p.tour || tourEditing) renderTourPanel(p.tour);
    if (!jumpTourPlay(p.tour, p.n)) selectTourStop(p.tour, p.n);
  } else openTour(p.tour);
});

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
    // картинки на уровень детальнее, ужатые вдвое (tileSize 128): линии тропы в два раза
    // тоньше и чётче — растянутые 256-е тайлы давали широкую мутную полосу
    map.addSource(`ov-${id}`, { type: "raster", tileSize: 128, maxzoom: 18, attribution: TRAILS_ATTRIBUTION,
      tiles: [`https://tile.waymarkedtrails.org/${overlay.trails}/{z}/{x}/{y}.png`] });
    map.addLayer({ id: `ov-${id}`, type: "raster", source: `ov-${id}`, minzoom: TRAILS_MIN_ZOOM, maxzoom: TRAILS_VECTOR_ZOOM }, before);
    addTrailLines(id, before);
  } else if (id === "beaches") {
    addBeaches(firstPoiLayer());
  } else if (id === "surf") {
    addSurf(firstPoiLayer());
  } else if (id === "photos") {
    addPhotos(firstPoiLayer());
  } else if (id === "mapillary") {
    addMapillary(firstPoiLayer());
  } else if (id === "myphotos") {
    addMyPhotos(firstPoiLayer());
  } else if (id === "tours") {
    addTours(firstPoiLayer());
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
  if (id === "photos") { selectPhoto(null); updatePhotoStrip(); }
  if (id === "mapillary" && map.getSource("ov-mly-pos")) map.removeSource("ov-mly-pos");
  if (id === "myphotos") { if (selectedPhoto?.startsWith("my/")) selectPhoto(null); updatePhotoStrip(); }
  if (id === "tours") { closeTourPanel(); updateTourFinder(); }
  for (const sourceId of [`ov-${id}`, `ov-${id}-vec`]) if (map.getSource(sourceId)) map.removeSource(sourceId);
  if (overlay.trails && !trailOverlayActive()) {
    for (const layerId of TRAIL_POI_LAYERS) if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource("ov-trail-poi-far")) map.removeSource("ov-trail-poi-far");
  }
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
  el("layers-chips").replaceChildren(...OVERLAYS.filter((o) => !o.hidden && (o.available?.() ?? true)).map((o) => {
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
// остальных мест: как только шкала масштаба показывает 5 км и меньше (шкала берёт
// круглое число не длиннее 100 px, "5 км" — пока в 100 px меньше 10 км). Пороговый зум
// зависит от широты, поэтому пересчитывается после каждого движения
const AIRPORT_MAX_METERS_PER_100PX = 10000;
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

// значки чипов — монохромные Material Icons, как условные обозначения на картах, а не цветные
// эмодзи (кровать выбивалась из ряда, 🍴 в шрифте Windows не узнать): прибор, кровать, билет,
// колонны, автобус, тележка
const placeIcon = (d) => `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="${d}"/></svg>`;
const HOTEL_ICON = placeIcon("M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z");

const CATEGORIES = [
  { id: "food", name: "Рестораны", icon: placeIcon("M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"), color: "#f57c00",
    subclasses: ["restaurant", "cafe", "fast_food", "food_court", "bar", "pub", "biergarten", "ice_cream"] },
  { id: "hotels", name: "Гостиницы", icon: HOTEL_ICON, color: "#8e24aa",
    subclasses: ["hotel", "hostel", "guest_house", "motel", "apartment", "chalet", "camp_site", "caravan_site"] },
  { id: "fun", name: "Развлечения", icon: placeIcon("M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-1.99.9-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2zm-4.42 4.8L12 14.5l-3.58 2.3 1.08-4.12-3.29-2.69 4.24-.25L12 5.8l1.54 3.95 4.24.25-3.29 2.69 1.09 4.11z"), color: "#d81b60",
    subclasses: ["attraction", "viewpoint", "theme_park", "zoo", "petting_zoo", "aquarium", "castle", "monument", "theatre", "cinema", "arts_centre", "escape_game"] },
  { id: "museums", name: "Музеи", icon: placeIcon("M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z"), color: "#3949ab", subclasses: ["museum", "gallery"] },
  // вокзалы, станции, метро, паромы и аэропорты (airports — из отдельного слоя), а
  // остановки (stops) — только на крупном масштабе. station — и ж/д станции, и станции
  // канатных дорог (class aerialway); станции фуникулёров в тайлах не отличить от ж/д —
  // их находит updateFunicularStations по рельсам фуникулёра рядом. lifts — фуникулёры и
  // канатные дороги поверх: их станции ищутся отдельно, а рельсы и тросы подсвечены.
  // modes: цвет и значок флажка по виду транспорта — первое совпадение по subclass/class
  { id: "transport", name: "Транспорт", icon: placeIcon(PIN_GLYPHS.bus), color: "#00897b", airports: true, lifts: true,
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
  { id: "shops", name: "Магазины", icon: placeIcon("M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"), color: "#1e88e5", subcategories: [
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
  if (map.getLayer("ov-trail-poi-far")) {
    map.setLayerZoomRange("ov-trail-poi-far", trailPoiMinZoom(), TRAIL_POI_ZOOM);
    map.setLayerZoomRange("ov-trail-poi-near-far", trailPoiNearZoom(), TRAIL_POI_ZOOM);
    map.setLayerZoomRange("ov-trail-poi-extra-near", trailPoiNearZoom(), 24);
  }
  for (const id of BEACH_LAYERS) if (map.getLayer(id)) map.setLayerZoomRange(id, beachMinZoom(), 24);
  if (map.getLayer("ov-my-albums")) {
    map.setLayerZoomRange("ov-my-albums", 0, photoDotZoom());
    map.setLayerZoomRange("ov-my-dots", photoDotZoom(), 24);
    map.setLayerZoomRange("ov-my-photos", photoMinZoom(), 24);
    map.setLayerZoomRange("ov-my-selected", photoDotZoom(), 24);
  }
  if (map.getLayer("ov-photos")) {
    map.setLayerZoomRange("ov-photos", photoMinZoom(), 24);
    map.setLayerZoomRange("ov-photo-dots", photoDotZoom(), 24);
    map.setLayerZoomRange("ov-photo-selected", photoDotZoom(), 24);
  }
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
  return type ? loadOsmTags(`${type}/${Math.floor(featureId / 10)}`) : null;
}

// osm — "node/123"
async function loadOsmTags(osm) {
  const resp = await fetch(`https://api.openstreetmap.org/api/0.6/${osm}.json`);
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

// ---------- подсказка у значков троп ----------

// При наведении (на телефоне — по касанию): вид точки, название, высота, описание,
// направления указателя. Теги — из OSM API (как у флажков мест), не дольше 1 с, чтобы
// подсказка не запаздывала. Подсказка не прячется, пока курсор на ней: в ней бывает ссылка на сайт
const TRAIL_POI_KIND_NAMES = {
  info: "Информация", guidepost: "Указатель", board: "Информационный щит", map: "Карта местности",
  viewpoint: "Смотровая площадка", tower: "Смотровая вышка", lighthouse: "Маяк", attraction: "Достопримечательность",
  campsite: "Кемпинг", picnic_site: "Место для пикника", firepit: "Кострище",
  drinking_water: "Питьевая вода", toilets: "Туалет",
  beach: "Пляж", beach_resort: "Пляжный курорт", surfing: "Сёрфинг", kitesurfing: "Кайтсёрфинг", windsurfing: "Виндсёрфинг",
};
// у пляжей — чем покрыт и есть ли спасатели
const BEACH_SURFACE_NAMES = { sand: "песок", fine_gravel: "мелкая галька", gravel: "галька", pebblestone: "галька",
  shingle: "галька", rock: "камни", stone: "камни", grass: "трава", concrete: "бетон" };
const beachFacts = (tags) => [BEACH_SURFACE_NAMES[tags.surface],
  (tags.supervised === "yes" || tags.lifeguard === "yes") && "спасатели"].filter(Boolean).join(", ");
// значки со своей подсказкой при наведении
const HOVER_POI_LAYERS = [...TRAIL_POI_LAYERS, ...BEACH_LAYERS, "ov-surf", "ov-photos", "ov-photo-selected", "ov-my-photos", "ov-my-selected"];
let trailPoiPopup = null;
let trailPoiHover = null;

async function showTrailPoiInfo(f) {
  if (f.properties.photo) return showPhotoInfo(f);
  const key = f.source === "te-poi" ? f.id : f.properties.osm;
  if (trailPoiHover === key && trailPoiPopup?.isOpen()) return;
  trailPoiHover = key;
  // точки из списка Google — без OSM, название и заметка в самой точке
  let tags = String(key).startsWith("list/") ? { name: f.properties.name, description: f.properties.note } : trailPoiTags.get(key);
  if (!tags) {
    tags = await withTimeout((f.source === "te-poi" ? loadPoiTags(f.id) : loadOsmTags(key)).catch(() => null), 1000, null);
    if (tags) trailPoiTags.set(key, tags);
  }
  // пока ждали ответа, курсор ушёл
  if (trailPoiHover !== key) return;
  tags ||= {};
  const p = f.properties;
  const kind = [TRAIL_POI_KIND_NAMES[p.kind || trailPoiKindOf(p)],
    tags.ele && `${Math.round(tags.ele).toLocaleString("ru")} м`].filter(Boolean).join(" · ");
  const name = tags[`name:${uiLanguageCode()}`] || tags.name || p[`name:${uiLanguageCode()}`] || p.name;
  const facts = beachFacts(tags);
  const rows = [facts && facts[0].toUpperCase() + facts.slice(1), tags.description, tags.inscription, tags.destination && `→ ${tags.destination.replace(/;/g, ", ")}`]
    .filter(Boolean).map((t) => `<div class="popup-row">${escapeHtml(t)}</div>`).join("");
  trailPoiPopup?.remove();
  trailPoiPopup = new maplibregl.Popup({ offset: 14, maxWidth: "260px", closeButton: false })
    .setLngLat(f.geometry.coordinates)
    .setHTML(`<div class="popup-title">${escapeHtml(name || kind)}</div>`
      + (name && kind ? `<div class="popup-kind">${escapeHtml(kind)}</div>` : "")
      + (rows || tags.opening_hours || tags.website ? `<div class="popup-details">${rows}${poiDetailsHtml(tags)}</div>` : ""))
    .addTo(map);
  keepTrailPoiInfoOnHover();
}

// фото: снимок крупнее (размер задан заранее — окно не прыгает, пока грузится), подпись,
// автор, дата и лицензия (Commons требует их указывать), щелчок по снимку — страница на Commons
function showPhotoInfo(f) {
  const p = f.properties;
  if (trailPoiHover === p.photo && trailPoiPopup?.isOpen()) return;
  // тот же снимок в ленте — подсветить и прокрутить к нему
  for (const [id, el] of photoStripItems) el.classList.toggle("hover", id === p.photo);
  photoStripItems.get(p.photo)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  trailPoiHover = p.photo;
  const width = 260, height = Math.min(220, Math.round(width * p.aspect)); // высокие — обрезаются, чтобы окно не уходило под ленту
  const mine = p.photo.startsWith("my/");
  const link = (html) => (p.page ? `<a href="${escapeHtml(p.page)}" target="_blank" rel="noopener">${html}</a>` : `<span>${html}</span>`);
  const meta = [p.author, p.date, p.license].filter(Boolean).join(" · ");
  openMediaPopup(f.geometry.coordinates, (p.photo === selectedPhoto ? 1.4 : 1) * PHOTO_SIZE / 2 + 4, `${width + 20}px`,
    link(`<img class="popup-photo" width="${width}" height="${height}" alt="" src="${escapeHtml(p.thumb.replace(/\/\d+px-/, "/330px-"))}">`)
      + `<div class="popup-title">${escapeHtml(p.title)}</div>`
      + (meta ? `<div class="popup-kind">${escapeHtml(meta)}</div>` : "")
      + (p.caption ? `<div class="popup-row popup-caption">${escapeHtml(p.caption.length > 220 ? `${p.caption.slice(0, 217)}…` : p.caption)}</div>` : "")
      + `<div class="popup-row">${mine ? escapeHtml(`Альбом «${p.albumName}»`) : link(p.photo.startsWith("mly/") ? "Mapillary" : "Wikimedia Commons")}</div>`);
  // у маленьких снимков нет миниатюры 330 px — тогда та, что на карте
  trailPoiPopup.getElement().querySelector("img").addEventListener("error", (e) => { e.target.src = p.thumb; }, { once: true });
  trailPoiPopup.on("close", () => {
    if (trailPoiHover === p.photo) trailPoiHover = null;
    if (selectedPhoto === p.photo) selectPhoto(null);
  });
  if (mine) showMyPhotoFull(p.photo, trailPoiPopup.getElement().querySelector(".popup-photo"));
  if (canOpenGallery()) {
    const mly = p.photo.startsWith("mly/");
    trailPoiPopup.getElement().querySelector(".popup-photo").title = mly ? "Двойной щелчок — просмотр" : mine ? "Двойной щелчок — альбом" : "Двойной щелчок — галерея";
    trailPoiPopup.getElement().querySelector(".popup-photo").parentElement.addEventListener("dblclick", (e) => {
      e.preventDefault();
      if (mly) openMapillaryViewer(p.photo.slice(4)); else openPhotoGallery(f);
    });
  }
  keepTrailPoiInfoOnHover();
}

const PHOTO_LAYERS = ["ov-photos", "ov-photo-selected", "ov-my-photos", "ov-my-selected"];
const photoAt = (point) => map.queryRenderedFeatures(point, { layers: PHOTO_LAYERS.filter((id) => map.getLayer(id)) })[0];
// щелчок по снимку на карте — то же, что в ленте; мимо — закрыть окно снимка
map.on("click", (evt) => {
  const f = photoAt(evt.point);
  if (f) selectPhoto(photoById(f.properties.photo) || f);
  else if (/^(photo|mly|my|album|tour)\//.test(String(trailPoiHover)) && !mlyAt(evt.point) && !albumAt(evt.point) && !tourAt(evt.point)) trailPoiPopup?.remove();
});
// двойной щелчок по снимку — галерея вместо приближения карты
map.on("dblclick", (evt) => {
  const f = photoAt(evt.point);
  if (!f || !canOpenGallery()) return;
  evt.preventDefault();
  openPhotoGallery(photoById(f.properties.photo) || f);
});

// Окно снимка или альбома (trailPoiPopup). closeOnClick: false — на телефоне касание
// сначала даёт mousemove, и click того же касания закрыл бы окно; мимо снимка окно закрывает
// свой обработчик map.on("click"). На узком экране окно у точки уходило за край (Грегори) —
// там оно карточкой над лентой во всю ширину (.photo-sheet: положение задаёт CSS поверх
// того, что MapLibre пишет каждый кадр) и переносится в body: #map — position: fixed, свой
// слой наложения, внутри него карточку накрыли бы «Слои» и кнопки
function openMediaPopup(lngLat, offset, maxWidth, html) {
  trailPoiPopup?.remove();
  trailPoiPopup = new maplibregl.Popup({ offset, maxWidth, closeButton: false, closeOnClick: false,
    className: matchMedia("(max-width: 600px)").matches ? "photo-sheet" : "" })
    .setLngLat(lngLat).setHTML(html).addTo(map);
  if (trailPoiPopup.getElement().classList.contains("photo-sheet")) document.body.append(trailPoiPopup.getElement());
  return trailPoiPopup;
}

function keepTrailPoiInfoOnHover() {
  const el = trailPoiPopup.getElement();
  el.addEventListener("mouseenter", () => clearTimeout(trailPoiHideTimer));
  el.addEventListener("mouseleave", hideTrailPoiInfoSoon);
}

// с значка на подсказку курсор идёт через пустое место — прячем с задержкой и только
// если курсор не на самой подсказке
let trailPoiHideTimer = 0;
function hideTrailPoiInfoSoon() {
  clearTimeout(trailPoiHideTimer);
  trailPoiHideTimer = setTimeout(() => {
    if (trailPoiPopup?.getElement()?.matches(":hover")) return;
    if (selectedPhoto && trailPoiHover === selectedPhoto) return;
    trailPoiHover = null;
    trailPoiPopup?.remove();
  }, 300);
}

// вид точки из тайла — то же, что TRAIL_POI_KIND, для подсказки
function trailPoiKindOf(p) {
  if (p.class === "information") return ["guidepost", "board", "map"].includes(p.subclass) ? p.subclass : "info";
  if (p.class === "attraction") return p.subclass === "viewpoint" ? "viewpoint" : "attraction";
  return p.class;
}

// касание пальцем тоже присылает mousemove — подсказку по нему не открываем: окно успевало
// появиться под пальцем, и click того же касания доставался окну, а не карте (снимок не
// выделялся). На касание подсказка открывается по click
let touchPointer = false;
map.getContainer().addEventListener("pointerdown", (e) => { touchPointer = e.pointerType === "touch"; }, true);
map.getContainer().addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") touchPointer = false; }, true);
onHover(HOVER_POI_LAYERS, (evt) => showTrailPoiInfo(evt.features[0]));

// подсказка при наведении мыши на слой; уход — прячет с задержкой (hideTrailPoiInfoSoon)
function onHover(layers, show) {
  map.on("mousemove", layers, (evt) => {
    if (touchPointer) return;
    clearTimeout(trailPoiHideTimer);
    show(evt);
  });
  map.on("mouseleave", layers, () => { if (!touchPointer) hideTrailPoiInfoSoon(); });
}
map.on("click", HOVER_POI_LAYERS, (evt) => { if (!evt.features[0].properties.photo) showTrailPoiInfo(evt.features[0]); });

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
    poiKindName(f) || MAP_INFO_KIND_NAMES[p.class],
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
  return `<div class="popup-title">${escapeHtml(name || kind)}</div>`
    + (name && kind ? `<div class="popup-kind">${escapeHtml(kind)}</div>` : "")
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

const ownInfoLayers = () => [...POI_LAYERS, ...HOVER_POI_LAYERS, ...MLY_LAYERS, "ov-my-albums", ...TOUR_LAYERS].filter((id) => map.getLayer(id));

// значок карты в нескольких пикселях от точки, о котором щелчок покажет подсказку
// Значки мест без названия (пикник, навес, туалет) — тоже, если вид известен
const MAP_POI_KIND_NAMES = {
  shelter: "Навес", picnic_shelter: "Навес для пикника", bench: "Скамейка", water_point: "Питьевая вода",
  playground: "Детская площадка", parking: "Парковка", bicycle_parking: "Велопарковка", information: "Информация",
  place_of_worship: "Храм", fuel: "Заправка", atm: "Банкомат", bank: "Банк", post_office: "Почта", police: "Полиция",
  hospital: "Больница", doctors: "Врач", dentist: "Стоматолог", school: "Школа", kindergarten: "Детский сад",
  library: "Библиотека", swimming_pool: "Бассейн", sports_centre: "Спортивный центр", pitch: "Спортплощадка",
  golf_course: "Гольф", spring: "Родник", waterfall: "Водопад", cave_entrance: "Пещера", ruins: "Руины",
  memorial: "Мемориал", artwork: "Арт-объект", fountain: "Фонтан", wayside_shrine: "Придорожная часовня",
};
const poiKindName = (f) => f.sourceLayer === "poi" && (POI_CLASS_KIND_NAMES[f.properties.class] || POI_KIND_NAMES[f.properties.subclass]
  || TRAIL_POI_KIND_NAMES[f.properties.subclass] || MAP_POI_KIND_NAMES[f.properties.subclass] || MAP_POI_KIND_NAMES[f.properties.class]);
function mapInfoHit({ x, y }) {
  return map.queryRenderedFeatures([[x - 8, y - 8], [x + 8, y + 8]]).find((f) => f.layer.type === "symbol"
    && MAP_INFO_SOURCE_LAYERS.includes(f.sourceLayer) && (f.properties.name || poiKindName(f)) && !POI_LAYERS.includes(f.layer.id));
}

map.on("click", async (evt) => {
  // щелчок по флажку места или по маркеру поиска — у них свои попапы
  if (evt.originalEvent.target !== map.getCanvas()) return;
  // щелчок мимо глобуса, по звёздам, — не на Земле, координат у него нет
  if (map.transform.isPointOnMapSurface?.(evt.point) === false) return;
  if (map.queryRenderedFeatures(evt.point, { layers: ownInfoLayers() }).length) return;
  // первый щелчок только закрывает открытое: попап, список поиска, меню
  if (poiPopup?.isOpen() || mapPopup?.isOpen() || searchMarker?.getPopup()?.isOpen()
    || !el("search-results").hidden || !el("lang-menu").hidden || !el("shop-menu").hidden) return;
  const hit = mapInfoHit(evt.point);
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

// над всем, о чём щелчок или наведение что-то покажет, курсор — стрелка вместо ладони
// (Грегори); проверка — раз за кадр, пока кнопка мыши не нажата (при перетаскивании — ладонь)
let cursorCheck = null;
map.on("mousemove", (evt) => {
  if (evt.originalEvent.buttons) return;
  if (!cursorCheck) requestAnimationFrame(() => {
    const point = cursorCheck;
    cursorCheck = null;
    const info = map.queryRenderedFeatures(point, { layers: ownInfoLayers() }).length || mapInfoHit(point);
    map.getCanvas().style.cursor = info ? "default" : "";
  });
  cursorCheck = evt.point;
});
map.on("mouseout", () => { map.getCanvas().style.cursor = ""; });

// любое окно на карте закрывается, как только карта начала двигаться или приближаться
map.on("movestart", (evt) => {
  for (const popup of [poiPopup, mapPopup, trailPoiPopup, searchMarker?.getPopup()]) {
    if (popup?.isOpen()) popup.remove();
  }
  trailPoiHover = null;
  // снимок, выбранный в галерее, остаётся выделенным, пока карту двигает сама галерея
  if (selectedPhoto && !(galleryFocus && !evt.originalEvent)) selectPhoto(null);
});

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
  if (tourMode) { tourKeydown(evt); return; }
  if (evt.key === "Enter") runSearch();
  if (evt.key === "Escape") clearSearchResults();
});
el("search-input").addEventListener("input", () => {
  el("search-clear-btn").hidden = !el("search-input").value;
  if (tourMode) { tourCursor = null; tourList.hidden = false; renderTourList(); return; }
  // стёрли запрос — снова видна история, начали печатать — она прячется
  showSearchHistory();
});
el("search-input").addEventListener("focus", () => {
  if (tourMode) { tourList.hidden = false; renderTourList(); } else showSearchHistory();
});
// клик мимо поиска закрывает список
document.addEventListener("click", (evt) => {
  // строка списка экскурсий, по которой щёлкнули, к этому моменту уже перерисована (вне DOM)
  if (!evt.target.isConnected) return;
  if (!evt.target.closest(".search-wrap")) { clearSearchResults(); tourList.hidden = true; }
});
el("search-btn").addEventListener("click", () => {
  if (!tourMode) { runSearch(); return; }
  const cur = tourList.querySelector(".tour-row.active") || tourList.querySelector(".tour-row-item");
  if (tourList.hidden) { tourList.hidden = false; renderTourList(); } else cur?.click();
});
el("search-tour-btn").addEventListener("click", () => setTourMode(!tourMode));
// после перезапуска кнопка — как была (слой «Экскурсии» помнится в списке включённых слоёв)
if (activeOverlays.has("tours")) {
  tourMode = true;
  el("search-tour-btn").classList.add("on");
  el("search-input").placeholder = "Найти экскурсию";
}
el("search-clear-btn").addEventListener("click", () => {
  if (tourMode) {
    el("search-input").value = "";
    el("search-clear-btn").hidden = true;
    tourCursor = null;
    renderTourList();
    el("search-input").focus();
    return;
  }
  el("search-input").value = "";
  el("search-clear-btn").hidden = true;
  clearSearchResults();
  searchMarker?.remove();
  searchMarker = null;
  el("search-input").focus();
  showSearchHistory();
});

// ---------- элементы управления справа внизу ----------

function openAboutModal() {
  el("about-modal").hidden = false;
  idb("settings", "readonly", (st) => st.get("dir")).catch(() => null).then((handle) => renderMySettings(handle || myDir));
  idb("settings", "readonly", (st) => st.get("tours")).catch(() => null).then((handle) => renderTourSettings(handle || tourDir));
  renderVoiceSettings();
}
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
el("my-photos-pick").addEventListener("click", pickMyFolder);
el("tours-pick").addEventListener("click", pickTourFolder);
el("tours-forget").addEventListener("click", forgetTourFolder);
el("voice-select").addEventListener("change", (e) => localStorage.setItem(VOICE_KEY, e.target.value));
el("voice-rate").addEventListener("change", (e) => localStorage.setItem(VOICE_RATE_KEY, e.target.value));
el("voice-test").addEventListener("click", (e) => speak("Левады строили с пятнадцатого века, чтобы уводить воду с дождливого севера острова на солнечный юг.", e.currentTarget));
el("my-photos-forget").addEventListener("click", forgetMyFolder);
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
