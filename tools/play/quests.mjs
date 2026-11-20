// Plays every 庭だより letter through the real UI (quest button -> glowing cell), then the ending card and dusk.
// node tools/play/quests.mjs --out D:/komorebi-stages/quests [--phone] [--url ...]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launch } from "../cdp.mjs";

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", "D:/komorebi-stages/quests");
const PHONE = args.includes("--phone");
let URL = arg("--url", "");
fs.mkdirSync(OUT, { recursive: true });
let server = null;
if (!URL) {
  server = spawn(process.execPath, [path.join(import.meta.dirname, "../serve.js"), "--port", "8797"], { stdio: "ignore" });
  URL = "http://localhost:8797/";
  await new Promise((r) => setTimeout(r, 700));
}
const label = PHONE ? "phone" : "pc";
const page = await launch(PHONE ? { width: 390, height: 844, mobile: true, dpr: 2 } : { width: 1280, height: 720 });
const S = () => page.eval(`window.__komorebi.state()`);
const shot = async (n) => { await page.sleep(400); await page.shot(path.join(OUT, `${label}-${n}.png`)); };
const CELL = `(gx, gy) => {
  const c = document.getElementById('world'), b = c.getBoundingClientRect();
  const A = window.__komorebi.state().angle, F = 72, T = Math.PI * 2;
  const a = (((Math.round(A * F / T) % F) + F) % F) * T / F;
  const x = (gx - 3) * 28, y = (gy - 3) * 28;
  const px = x * Math.cos(a) - y * Math.sin(a), py = (x * Math.sin(a) + y * Math.cos(a)) * 0.58;
  const cx = Math.round(c.width * .5), cy = Math.round(c.height * .495);
  return { x: b.left + (cx + px) * b.width / c.width, y: b.top + (cy + py) * b.height / c.height };
}`;
const tap = async (gx, gy) => { await page.eval(`window.scrollTo(0,0)`); const p = await page.eval(`(${CELL})(${gx},${gy})`); await page.click(Math.round(p.x), Math.round(p.y)); await page.sleep(150); };
const btn = async (sel) => { const r = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.hidden) return null; e.scrollIntoView({block:'center'}); const b = e.getBoundingClientRect(); return [b.left + b.width/2, b.top + b.height/2]; })()`); if (!r) return false; await page.click(Math.round(r[0]), Math.round(r[1])); await page.sleep(200); return true; };
const toast = () => page.eval(`document.getElementById('toast').textContent`);
const log = [];
try {
  await page.goto(URL);
  await page.eval(`localStorage.clear()`);
  await page.goto(URL);
  await page.waitFor(`window.__komorebi`, 15000);
  await page.sleep(500);
  await shot("00-title");
  await btn("#welcome-start");
  for (let guard = 0; guard < 40; guard++) {
    const st = await S();
    if (st.completed >= st.quests) break;
    await page.eval(`window.scrollTo(0,0)`);
    await shot(`q${st.completed + 1}-a-letter`);
    if (await btn("#quest-pick")) { await page.eval(`window.scrollTo(0,0)`); await shot(`q${st.completed + 1}-b-hints`); }
    let s2 = await S();
    let cell = s2.hints[0];
    if (!cell) {
      // the count letter: any tool, any free cell
      const types = await page.eval(`[...document.querySelectorAll('#palette-items [data-type]')].map(b => b.dataset.type)`);
      await btn(`#palette-items [data-type="${types[guard % types.length]}"]`);
      s2 = await S();
      cell = s2.free[0];
    }
    if (!cell) { log.push(`no cell for letter ${st.completed + 1}`); break; }
    await tap(cell.x, cell.y);
    const after = await S();
    log.push(`letter ${st.completed + 1}: placed ${after.selected} at ${cell.x},${cell.y} -> completed ${after.completed}; "${await toast()}"`);
    if (after.completed > st.completed) await shot(`q${st.completed + 1}-c-done`);
  }
  await page.sleep(1300);
  log.push(`complete dialog open: ${await page.eval(`document.getElementById('complete-dialog').open`)}`);
  await shot("90-complete");
  await btn("#complete-dialog [data-close]");
  await page.eval(`window.scrollTo(0,0)`);
  await shot("91-dusk");
  for (let i = 0; i < 2; i++) await btn("#rotate-right");
  await page.eval(`window.scrollTo(0,0)`);
  await shot("92-dusk-rot");
  await btn("#dusk");
  await page.eval(`window.scrollTo(0,0)`);
  await shot("93-day");
  // undo across the last letter gives the dusk back up; redo it
  await btn("#undo");
  log.push(`after undo: ${JSON.stringify((({ completed, dusk, selected }) => ({ completed, dusk, selected }))(await S()))}`);
  await page.goto(URL);
  await page.waitFor(`window.__komorebi`, 15000);
  await page.sleep(400);
  log.push(`after reload: completed ${(await S()).completed}, start label "${await page.eval(`document.getElementById('welcome-start').textContent`)}"`);
  await shot("94-reload-title");
  log.push(`errors ${JSON.stringify(page.errors)}`);
} finally {
  fs.writeFileSync(path.join(OUT, `${label}-log.txt`), log.join("\n") + "\n");
  console.log(log.join("\n"));
  await page.close();
  if (server) server.kill();
}
