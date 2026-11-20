// Renders the OG image source from the game itself: a sample garden (day), big, without UI. Then tools/make-og.py adds the title.
// node tools/play/og.mjs --out D:/komorebi-stages/og-src.png
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launch } from "../cdp.mjs";
const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "D:/komorebi-stages/og-src.png";
const server = spawn(process.execPath, [path.join(import.meta.dirname, "../serve.js"), "--port", "8798"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
const page = await launch({ width: 1500, height: 1000 });
const starter = [["house", 2, 2], ["oak", 0, 3], ["pine", 3, 0], ["pine", 5, 1], ["oak", 6, 3], ["bench", 3, 5], ["flower", 1, 5], ["flower", 4, 3], ["lamp", 1, 2]]
  .map(([type, x, y], i) => ({ id: i === 0 ? "original-house" : "original-" + i, type, x, y, turn: 0 }));
const planted = [["flower", 1, 3], ["flower", 3, 3], ["bush", 4, 0], ["oak", 1, 1], ["lamp", 3, 4], ["mushroom", 0, 2], ["fence", 5, 6], ["fence", 6, 5, Math.PI / 2], ["flower", 5, 2], ["pine", 4, 2], ["rock", 6, 2]]
  .map(([type, x, y, turn]) => ({ id: `planted-${x}:${y}`, type, x, y, turn: turn || 0 }));
const save = { version: 1, objects: [...starter, ...planted], completed: 3, history: [], angle: -0.55 + Math.PI / 4 * 0, dusk: false, seen: [] };
try {
  await page.goto("http://localhost:8798/");
  await page.eval(`localStorage.setItem('komorebi-garden.v1', ${JSON.stringify(JSON.stringify(save))})`);
  await page.goto("http://localhost:8798/");
  await page.waitFor("window.__komorebi", 15000);
  await page.eval(`(() => { document.querySelectorAll('dialog[open]').forEach(d => d.close());
    const s = document.createElement('style'); s.textContent = '.mast,.board-tools,.quest,.catalog,.site-foot,.island-tag,.compass,#toast{display:none!important} .layout{display:block;padding:0;max-width:none} .garden-frame{border:0;border-radius:0} .view{height:1000px!important}';
    document.head.appendChild(s); window.dispatchEvent(new Event('resize')); })()`);
  await page.sleep(1500);
  await page.shot(OUT);
  console.log("og source ->", OUT, JSON.stringify(page.errors));
} finally { await page.close(); server.kill(); }
