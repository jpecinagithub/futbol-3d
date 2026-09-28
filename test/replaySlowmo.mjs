// Verifica la repetición a cámara lenta + descarga como vídeo (punto 2):
// - la fase "replay" dura claramente más que a 1x (slow-mo 0,4x)
// - el rótulo indica cámara lenta
// - al terminar aparece el botón de descarga y el vídeo (.webm) se descarga
// Uso: node test/replaySlowmo.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";

const errors = [];
const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({
  viewport: { width: 960, height: 540 },
  acceptDownloads: true,
});
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));
await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
const jsClick = (sel, text) => page.evaluate(([s, t]) => {
  const el = [...document.querySelectorAll(s)].find((x) => x.textContent.includes(t));
  if (!el) return "NOT-FOUND:" + t; el.click(); return "ok";
}, [sel, text]);
await jsClick("button", "Jugar partido"); await page.waitForTimeout(400);
await jsClick(".team-card", "Real Madrid"); await page.waitForTimeout(400);
await jsClick(".team-card", "Barcelona"); await page.waitForTimeout(400);
await jsClick("button", "Continuar"); await page.waitForTimeout(600);
await jsClick("button", "Ver alineaciones"); await page.waitForTimeout(600);
await jsClick("button", "¡A jugar!");
const phase = () => page.evaluate(() => window.__store.getState().phase);
await page.waitForFunction(
  () => { const m = window.__match; return m && m.engine.deadBall && m.engine.deadBall.state === "OPEN_PLAY"; },
  null,
  { polling: 200, timeout: 60000 }
);
await page.waitForTimeout(1500);

const results = [];
const check = (name, ok, extra = "") =>
  results.push((ok ? "OK   " : "FAIL ") + name + (extra ? " - " + extra : ""));

// Provocar el gol y esperar a la repetición
await page.evaluate(() => window.__match.provokeGoal("home"));
await page.waitForFunction(() => window.__store.getState().phase === "replay",
  null,
  { polling: 500, timeout: 120000 });

const label = await page.evaluate(() => document.querySelector(".replay-tag")?.textContent || "");
check("rótulo indica cámara lenta", label.includes("LENTA"), label);

const t0 = Date.now();
await page.waitForFunction(() => window.__store.getState().phase === "playing",
  null,
  { polling: 1000, timeout: 300000 });
const replaySecs = (Date.now() - t0) / 1000;
// A 1x el metraje de 2-3 s duraría ~25-35 s con este render; a 0,4x debe
// superar holgadamente los 45 s.
check("repetición a cámara lenta (duración real)", replaySecs > 45,
  replaySecs.toFixed(1) + " s");

const videoUrl = await page.evaluate(() => window.__store.getState().replayVideo);
check("vídeo de la repetición publicado", typeof videoUrl === "string" && videoUrl.startsWith("blob:"),
  String(videoUrl).slice(0, 40));

const btnVisible = await page.evaluate(() => {
  const b = document.querySelector(".replay-download");
  if (!b) return false;
  const r = b.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
});
check("botón de descarga visible", btnVisible);

let dlSize = 0;
if (btnVisible) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.click(".replay-download"),
  ]);
  const path = "/tmp/repeticion-gol.webm";
  await download.saveAs(path);
  dlSize = fs.statSync(path).size;
}
check("vídeo descargado no vacío", dlSize > 1000, dlSize + " bytes");

console.log(results.join("\n"));
console.log("errores de consola:", errors.length ? errors : "ninguno");
await browser.close();
if (results.some((x) => x.startsWith("FAIL")) || errors.length) process.exit(1);
