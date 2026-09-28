import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
const jsClick = (sel, text) => page.evaluate(([s, t]) => {
  const el = [...document.querySelectorAll(s)].find((x) => x.textContent.includes(t));
  if (el) { el.click(); return "ok"; } return "NOT-FOUND:" + t;
}, [sel, text]);
for (const [s, t] of [["button","Jugar partido"],[".team-card","Real Madrid"],[".team-card","Barcelona"],["button","Continuar"],["button","Ver alineaciones"],["button","¡A jugar!"]]) {
  await jsClick(s, t); await page.waitForTimeout(400);
}
// Elegir duración 3 min para el test (la más corta)
const t0 = Date.now();
let last = "";
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const st = window.__store?.getState();
    const eng = window.__match?.engine;
    if (!st || !eng) return "no-engine";
    return `phase=${st.phase} storeClock=${st.clock.toFixed(0)} engineMT=${eng.matchTime.toFixed(1)} dur=${st.durationMin}`;
  }).catch(() => "eval-fail");
  const line = `+${((Date.now() - t0) / 1000).toFixed(0)}s ${info}`;
  if (line !== last) { console.log(line); last = line; }
  if (String(info).includes("fulltime")) break;
}
console.log("pageerrors:", errs.length ? errs.join(" | ") : "none");
await browser.close();
