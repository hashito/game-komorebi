// Headless review: screenshots of every key point at PC 1280x720 and phone 390x844, plus off-route play.
// node tools/play/review.mjs --out D:/komorebi-stages/review [--url http://localhost:8795/] [--only pc|phone]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launch } from "../cdp.mjs";

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", "D:/komorebi-stages/review");
const ONLY = arg("--only", "");
let URL = arg("--url", "");
fs.mkdirSync(OUT, { recursive: true });
let server = null;
if (!URL) {
  const port = 8795;
  server = spawn(process.execPath, [path.join(import.meta.dirname, "../serve.js"), "--port", String(port), ...(args.includes("--public") ? ["--public"] : [])], { stdio: "ignore" });
  URL = `http://localhost:${port}/`;
  await new Promise((r) => setTimeout(r, 700));
}

const report = [];
const note = (s) => { report.push(s); console.log(s); };

// screen position of grid cell (gx, gy) at the current view angle (mirrors scene.js project())
const CELL = `(gx, gy) => {
  const c = document.getElementById('world'), b = c.getBoundingClientRect();
  let A = -0.55; try { if (window.__komorebi) A = window.__komorebi.state().angle; else { const sv = JSON.parse(localStorage.getItem('komorebi-garden.v1')); if (sv && Number.isFinite(sv.angle)) A = sv.angle; } } catch {}
  const F = 72, T = Math.PI * 2;
  const a = (((Math.round(A * F / T) % F) + F) % F) * T / F;
  const x = (gx - 3) * 28, y = (gy - 3) * 28;
  const px = x * Math.cos(a) - y * Math.sin(a), py = (x * Math.sin(a) + y * Math.cos(a)) * 0.58;
  const cx = Math.round(c.width * .5), cy = Math.round(c.height * .495);
  return { x: b.left + (cx + px) * b.width / c.width, y: b.top + (cy + py) * b.height / c.height };
}`;

async function run(label, opts) {
  const page = await launch(opts);
  const shot = async (name) => { await page.sleep(350); await page.shot(path.join(OUT, `${label}-${name}.png`)); };
  const cell = async (gx, gy) => page.eval(`(${CELL})(${gx},${gy})`);
  const tap = async (gx, gy) => { const p = await cell(gx, gy); await page.click(Math.round(p.x), Math.round(p.y)); await page.sleep(120); return p; };
  const btn = async (sel) => { const ok = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; })()`); if (!ok) throw new Error("no " + sel); await page.click(Math.round(ok[0]), Math.round(ok[1])); await page.sleep(150); };
  const toast = () => page.eval(`document.getElementById('toast')?.textContent || ''`);
  const scrollTop = () => page.eval(`window.scrollTo(0,0)`);
  await page.goto(URL);
  await page.eval(`localStorage.clear()`);
  await page.goto(URL);
  await page.waitFor(`document.querySelector('#palette-items [data-type]')`, 15000);
  await page.sleep(600);
  await shot("01-first");
  // first visit: does anything explain the goal before play?
  const dlg = await page.eval(`!!document.querySelector('dialog[open]')`);
  note(`${label}: dialog open on first visit: ${dlg}`);
  if (dlg) await shot("01b-first-dialog");
  if (!dlg) { await btn("#help"); await shot("02-help"); }
  // close whichever dialog is open
  await page.eval(`(() => { const b = document.querySelector('dialog[open] [data-close]'); if (b) b.click(); })()`);
  await page.sleep(300);
  await scrollTop();
  // place every tool on free cells
  const free = [[1, 1], [4, 1], [5, 3], [3, 3], [1, 4], [4, 6], [6, 5], [0, 1]];
  const types = await page.eval(`[...document.querySelectorAll('#palette-items [data-type]')].map(b => b.dataset.type)`);
  let k = 0;
  for (const t of types) {
    await btn(`#palette-items [data-type="${t}"]`);
    await scrollTop();
    const [gx, gy] = free[k++ % free.length];
    await tap(gx, gy);
    note(`${label}: place ${t} at ${gx},${gy} -> "${await toast()}"`);
    await shot(`03-place-${t}`);
  }
  // out of bounds / path / pond / occupied
  const c = await page.eval(`(() => { const b = document.getElementById('world').getBoundingClientRect(); return [b.left + 6, b.top + 6]; })()`);
  await page.click(Math.round(c[0]), Math.round(c[1]));
  note(`${label}: tap sky corner -> "${await toast()}"`);
  await tap(2, 5); note(`${label}: tap path -> "${await toast()}"`);
  await tap(5, 5); note(`${label}: tap pond -> "${await toast()}"`);
  await tap(2, 2); note(`${label}: tap house -> "${await toast()}"`);
  await shot("04-invalid");
  // rotate all directions
  for (let i = 0; i < 8; i++) { await btn("#rotate-right"); await scrollTop(); await shot(`05-rot-r${i + 1}`); }
  for (let i = 0; i < 2; i++) { await btn("#rotate-left"); }
  await scrollTop(); await shot("05-rot-l2");
  // spam rotate + place mid-rotation
  for (let i = 0; i < 6; i++) await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 1, y: 1, button: "left", clickCount: 1 }).catch(() => {});
  await btn("#rotate-right"); await tap(5, 2);
  note(`${label}: place mid-rotation -> "${await toast()}"`);
  await shot("06-place-mid-rotate");
  // undo + remove
  await btn("#undo"); note(`${label}: undo -> "${await toast()}"`);
  await btn("#remove"); await scrollTop(); await tap(1, 1); note(`${label}: remove 1,1 -> "${await toast()}"`);
  await tap(2, 2); note(`${label}: remove house -> "${await toast()}"`);
  await shot("07-remove");
  await btn("#remove");
  // spam clicks on one cell
  await btn(`#palette-items [data-type="flower"]`); await scrollTop();
  for (let i = 0; i < 10; i++) await tap(4, 2);
  note(`${label}: spam 10 taps on 4,2 -> "${await toast()}"`);
  // sound toggle
  await btn("#sound"); note(`${label}: sound pressed=${await page.eval(`document.getElementById('sound').getAttribute('aria-pressed')`)}`);
  await shot("08-sound");
  // save + reload
  const before = await page.eval(`localStorage.getItem('komorebi-garden.v1')?.length || 0`);
  await page.goto(URL);
  await page.waitFor(`document.querySelector('#palette-items [data-type]')`, 15000);
  await page.sleep(600);
  note(`${label}: save bytes before reload ${before}; dialog after reload: ${await page.eval(`!!document.querySelector('dialog[open]')`)}`);
  await page.eval(`(() => { const b = document.querySelector('dialog[open] [data-close]'); if (b) b.click(); })()`);
  await shot("09-reloaded");
  // full page
  await page.eval(`window.scrollTo(0, document.body.scrollHeight)`);
  await shot("10-bottom");
  note(`${label}: errors ${JSON.stringify(page.errors)}`);
  await page.close();
}

try {
  if (ONLY !== "phone") await run("pc", { width: 1280, height: 720 });
  if (ONLY !== "pc") await run("phone", { width: 390, height: 844, mobile: true, dpr: 2 });
} finally {
  fs.writeFileSync(path.join(OUT, "report.txt"), report.join("\n") + "\n");
  if (server) server.kill();
}
