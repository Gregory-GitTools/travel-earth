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
  { id: "voyager", name: "Пастельная", hint: "CARTO Voyager", style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json" },
  { id: "liberty", name: "Яркая", hint: "OpenFreeMap Liberty", style: "https://tiles.openfreemap.org/styles/liberty" },
  { id: "bright", name: "Контрастная", hint: "OpenFreeMap Bright", style: "https://tiles.openfreemap.org/styles/bright" },
  { id: "positron", name: "Светлая", hint: "CARTO Positron", style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
  { id: "dark", name: "Тёмная", hint: "CARTO Dark Matter", style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
];
const BASEMAP_STORAGE_KEY = "travel-earth.basemap";
let currentBasemap = BASEMAPS.find((b) => b.id === localStorage.getItem(BASEMAP_STORAGE_KEY)) || BASEMAPS[1];

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
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
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
let lastMapBasemap = currentBasemap === SATELLITE ? BASEMAPS[1] : currentBasemap;

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

// ---------- категории мест (как чипы "Рестораны", "Гостиницы"… в Google Maps) ----------

// Места берутся прямо из векторных тайлов OpenFreeMap (слой poi схемы OpenMapTiles) —
// это те же тайлы, что и у карты, поэтому точки появляются сразу, без сервера поиска.
// Раньше здесь был Overpass API: 10–15 с на каждый сдвиг карты и частые 504.
// subclass в тайлах — исходное значение тега OSM (restaurant, supermarket, museum…),
// по нему и фильтруем. Точки в тайлах есть с zoom 12, но до 14 — только значимые,
// поэтому "не найдено" можно утверждать лишь с 14-го
const POI_MIN_ZOOM = 12;
const POI_FULL_ZOOM = 14;

// у эмодзи кровати цветная картинка, выбивающаяся из ряда, — вместо неё монохромный
// значок в стиле Material Icons ("hotel")
const HOTEL_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/></svg>`;

const CATEGORIES = [
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
  { id: "food", name: "Рестораны", icon: "🍴", color: "#f57c00",
    subclasses: ["restaurant", "cafe", "fast_food", "food_court", "bar", "pub", "biergarten", "ice_cream"] },
  { id: "hotels", name: "Гостиницы", icon: HOTEL_ICON, color: "#8e24aa",
    subclasses: ["hotel", "hostel", "guest_house", "motel", "apartment", "chalet", "camp_site", "caravan_site"] },
  { id: "fun", name: "Развлечения", icon: "📷", color: "#d81b60",
    subclasses: ["attraction", "viewpoint", "theme_park", "zoo", "petting_zoo", "aquarium", "castle", "monument", "theatre", "cinema", "arts_centre", "escape_game"] },
  { id: "museums", name: "Музеи", icon: "🏛️", color: "#3949ab", subclasses: ["museum", "gallery"] },
  { id: "transport", name: "Транспорт", icon: "🚌", color: "#00897b",
    subclasses: ["bus_stop", "bus_station", "station", "halt", "tram_stop", "ferry_terminal"] },
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
  bus_stop: "Остановка автобуса", bus_station: "Автовокзал", station: "Станция", halt: "Остановка поезда",
  tram_stop: "Остановка трамвая", ferry_terminal: "Паромный терминал",
};

// что сейчас показано: категория или профиль магазинов — { id, name, color, subclasses }
let activePoi = null;
let activeChipId = null;
// профиль, который включает клик по самому чипу "Магазины" (стрелка рядом меняет его)
let shopProfile = SHOPS.subcategories[0];

// открытый попап места — закрывается при смене или выключении фильтра, иначе висит без точки
let poiPopup = null;

function setActivePoi(chipId, poi) {
  poiPopup?.remove();
  activeChipId = poi ? chipId : null;
  activePoi = poi;
  renderCategoryChips();
  applyPoiLayer();
  updatePoiStatus();
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
  menu.style.left = `${rect.left}px`;
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

function showStatus(text) {
  el("map-status").textContent = text;
  el("map-status").hidden = !text;
}

function applyPoiLayer() {
  if (!map.getLayer("poi")) return;
  // пока категория не выбрана, слой скрыт — тогда MapLibre и тайлы мест не грузит
  map.setLayoutProperty("poi", "visibility", activePoi ? "visible" : "none");
  if (!activePoi) return;
  map.setFilter("poi", ["in", ["get", "subclass"], ["literal", activePoi.subclasses]]);
  map.setLayoutProperty("poi", "icon-image", pinImage(activePoi.color));
}

// флажок-булавка цвета категории — заметнее точки, не теряется среди подписей карты.
// Картинки рисуются по требованию и после смены стиля (setStyle их удаляет) — заново
function pinImage(color) {
  const id = `pin-${color}`;
  if (map.hasImage(id)) return id;
  const w = 44, h = 58; // в двойном размере: pixelRatio 2 — чётко на любом экране
  const ctx = Object.assign(document.createElement("canvas"), { width: w, height: h }).getContext("2d");
  ctx.beginPath();
  ctx.moveTo(22, 55);
  ctx.bezierCurveTo(18, 42, 4, 34, 4, 21);
  ctx.arc(22, 21, 18, Math.PI, 0);
  ctx.bezierCurveTo(40, 34, 26, 42, 22, 55);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(22, 21, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  map.addImage(id, ctx.getImageData(0, 0, w, h), { pixelRatio: 2 });
  return id;
}

function updatePoiStatus() {
  if (!activePoi) { showStatus(""); return; }
  const zoomIn = `Приблизьте карту, чтобы увидеть: ${activePoi.name.toLowerCase()}`;
  if (map.getZoom() < POI_MIN_ZOOM) { showStatus(zoomIn); return; }
  // пока тайлы грузятся, надпись не трогаем — иначе она мигала бы при каждом сдвиге
  if (!map.areTilesLoaded()) return;
  const found = map.queryRenderedFeatures({ layers: ["poi"] }).length;
  if (found) showStatus("");
  // до POI_FULL_ZOOM в тайлах лишь часть мест — пустота ещё не значит, что их нет
  else if (map.getZoom() < POI_FULL_ZOOM) showStatus(zoomIn);
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

map.on("click", "poi", async (evt) => {
  const f = evt.features[0];
  const p = f.properties;
  const name = p[`name:${uiLanguageCode()}`] || p.name;
  const kind = POI_KIND_NAMES[p.subclass] || p.subclass;
  poiPopup?.remove();
  const popup = poiPopup = new maplibregl.Popup({ offset: 8, maxWidth: "260px" })
    .setLngLat(f.geometry.coordinates)
    .setHTML(`<div class="popup-title">${escapeHtml(name || kind)}</div>`
      + (name ? `<div class="popup-kind">${escapeHtml(kind)}</div>` : "")
      + `<div class="popup-details"><div class="popup-row popup-muted">Загрузка…</div></div>`)
    .addTo(map);
  const details = popup.getElement().querySelector(".popup-details");
  try {
    const tags = await loadPoiTags(f.id);
    details.innerHTML = tags ? poiDetailsHtml(tags) : "";
  } catch (err) {
    console.warn("OSM API", err);
    details.innerHTML = "";
  }
});
map.on("mouseenter", "poi", () => { map.getCanvas().style.cursor = "pointer"; });
map.on("mouseleave", "poi", () => { map.getCanvas().style.cursor = ""; });

// setStyle заменяет стиль целиком вместе с проекцией и своими слоями — поэтому globe,
// язык подписей и слой мест выставляются заново после каждой загрузки стиля
map.on("style.load", () => {
  map.setProjection({ type: "globe" });
  applyLabelLanguage();
  // свой источник, а не источник стиля: у стилей CARTO другие тайлы, без subclass
  map.addSource("te-poi", OPENMAPTILES_SOURCE);
  map.addLayer({
    id: "poi",
    type: "symbol",
    source: "te-poi",
    "source-layer": "poi",
    minzoom: POI_MIN_ZOOM,
    layout: {
      visibility: "none",
      "icon-anchor": "bottom",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.8, 17, 1.1],
      // показываются все найденные места, даже если флажки перекрываются
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
  applyPoiLayer();
});

renderCategoryChips();

// ---------- поиск ----------

// Nominatim (геокодер OpenStreetMap): бесплатный, но правила использования запрещают
// автодополнение на каждую букву — поэтому поиск только по Enter/кнопке
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
let searchMarker = null;

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
    list.replaceChildren(...results.map((r) => {
      const item = document.createElement("button");
      item.className = "search-item";
      const [title, ...rest] = r.display_name.split(", ");
      item.innerHTML = `<span class="search-item-title"></span><span class="search-item-sub"></span>`;
      item.firstChild.textContent = title;
      item.lastChild.textContent = rest.join(", ");
      item.addEventListener("click", () => showSearchResult(r, title));
      return item;
    }));
  } catch (err) {
    console.error("Nominatim", err);
    list.innerHTML = `<div class="search-note">Поиск не удался — проверьте интернет и попробуйте ещё раз</div>`;
  }
}

function showSearchResult(r, title) {
  clearSearchResults();
  el("search-input").value = title;
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
});
el("search-btn").addEventListener("click", runSearch);
el("search-clear-btn").addEventListener("click", () => {
  el("search-input").value = "";
  el("search-clear-btn").hidden = true;
  clearSearchResults();
  searchMarker?.remove();
  searchMarker = null;
  el("search-input").focus();
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

// Пока глобус виден целиком на звёздном небе, наклон и поворот только сбивают с толку —
// шар и так крутится мышью. Они включаются, когда шкала масштаба показывает не больше
// 100 км, а при отдалении карта сама возвращается к северу вверх и виду сверху
const TILT_MAX_METERS_PER_100PX = 100000;
let tiltLocked = null;

function metersPer100px() {
  const { lat } = map.getCenter();
  return (100 * 40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
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
  // Выпрямляем не прямо из moveend, а с паузой: moveend приходит изнутри кадра анимации
  // MapLibre, и новый easeTo оттуда ломает её внутреннюю очередь ("Attempting to run(),
  // but is already running") — отрисовка останавливается навсегда, глобус "виснет"
  clearTimeout(straightenTimer);
  if (locked) straightenTimer = setTimeout(straighten, 300);
}

let straightenTimer;
function straighten() {
  // пока пользователь тащит или крутит карту — не перебиваем его; следующий moveend
  // после его жеста снова запланирует выравнивание
  if (!tiltLocked || map.isMoving()) return;
  // доли градуса не выпрямляем — иначе easeTo мог бы запускаться снова и снова
  if (Math.abs(map.getBearing()) > 0.1 || map.getPitch() > 0.1) {
    // неспешно и с затуханием к концу, чтобы глобус мягко "вставал на место"
    map.easeTo({ bearing: 0, pitch: 0, duration: 2400, easing: (t) => 1 - (1 - t) ** 3 });
  }
}

map.on("moveend", updateTiltLock);
updateTiltLock();

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
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
