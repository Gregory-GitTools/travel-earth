// Снимает миниатюры для переключателя карт (icons/basemaps/<id>.jpg) — по одной на каждый
// вариант из BASEMAPS в app.js. Запускать заново, если добавился/поменялся стиль карты.
// Нужны Node 22+ и Chrome; сервер start.bat (порт 8643) должен быть запущен.
//   node tools/basemap-thumbnails.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const URL = "http://localhost:8643/";
const OUT_DIR = path.join(import.meta.dirname, "..", "icons", "basemaps");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
// окрестности Таллина: в кадре море, суша, дороги и город — видно характер каждого стиля
const VIEW = { center: [24.75, 59.42], zoom: 10 };
const SIZE = 240; // вырезается из центра окна, сохраняется в 2 раза меньше

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "te-thumbs-"));
const chrome = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--remote-debugging-port=9334", `--user-data-dir=${profile}`, "about:blank"]);

let targets;
for (let i = 0; i < 40 && !targets; i++) {
  try { targets = await (await fetch("http://127.0.0.1:9334/json")).json(); } catch { await sleep(250); }
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
};
const send = (method, params = {}) => new Promise((r) => {
  const id = ++nextId;
  pending.set(id, r);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;

const W = 800, H = 600;
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: URL });
await sleep(4000);
// прячем все элементы интерфейса поверх карты, чтобы они не попали в кадр
await evaluate(`document.head.insertAdjacentHTML("beforeend",
  "<style>body > :not(#map), .maplibregl-control-container { display: none !important; }</style>")`);

fs.mkdirSync(OUT_DIR, { recursive: true });
const ids = await evaluate("BASEMAPS.map((b) => b.id)");
for (const id of ids) {
  await evaluate(`selectBasemap(BASEMAPS.find((b) => b.id === "${id}"));
    map.jumpTo(${JSON.stringify(VIEW)}); true`);
  // ждём загрузки тайлов (событие idle в headless-режиме ненадёжно) + запас на отрисовку
  await evaluate(`new Promise((r) => {
    const t0 = Date.now();
    const check = () => (map.isStyleLoaded() && map.areTilesLoaded()) || Date.now() - t0 > 20000
      ? r(true) : setTimeout(check, 300);
    setTimeout(check, 1000);
  })`);
  await sleep(1500);
  const shot = await send("Page.captureScreenshot", {
    format: "jpeg", quality: 85,
    clip: { x: (W - SIZE) / 2, y: (H - SIZE) / 2, width: SIZE, height: SIZE, scale: 0.5 },
  });
  fs.writeFileSync(path.join(OUT_DIR, `${id}.jpg`), Buffer.from(shot.data, "base64"));
  console.log("готово:", id);
}

chrome.kill();
process.exit(0);
