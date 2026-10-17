// Строит country-borders.json — границы стран для оффлайн-определения страны альбома
// (без Nominatim и его лимита запросов). Источник: Natural Earth 1:50m admin-0 countries
// (уже содержит русские названия в NAME_RU) — упрощён до {iso, name, geometry}, координаты
// округлены до 3 знаков (~100м), этого достаточно для точки на уровне страны.
// Перезапускать редко — только если нужно обновить границы или повысить точность.
//   node tools/build-country-borders.mjs
import fs from "node:fs";
import path from "node:path";

const SOURCE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const OUT_FILE = path.join(import.meta.dirname, "..", "country-borders.json");

const round = (n) => Math.round(n * 1000) / 1000;
const roundRing = (ring) => ring.map(([lon, lat]) => [round(lon), round(lat)]);
const roundGeom = (g) => {
  if (g.type === "Polygon") return { type: g.type, coordinates: g.coordinates.map(roundRing) };
  if (g.type === "MultiPolygon") return { type: g.type, coordinates: g.coordinates.map((poly) => poly.map(roundRing)) };
  return g;
};

const source = await (await fetch(SOURCE_URL)).json();
const dropped = [];
const features = source.features.map((f) => {
  const iso = f.properties.ISO_A2 !== "-99" ? f.properties.ISO_A2 : f.properties.ISO_A2_EH;
  if (!iso || iso === "-99") { dropped.push(f.properties.NAME); return null; }
  return { type: "Feature", properties: { iso, name: f.properties.NAME_RU }, geometry: roundGeom(f.geometry) };
}).filter(Boolean);

if (dropped.length) console.log("пропущены (нет ISO2):", dropped.join(", "));
fs.writeFileSync(OUT_FILE, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`записано ${features.length} стран в ${OUT_FILE} (${fs.statSync(OUT_FILE).size} байт)`);
