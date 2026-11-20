// Live check: page loads, game.json version, GA4 collect request fires, phone screenshot. node tools/play/live.mjs --url https://... --out D:/...
import fs from "node:fs";
import path from "node:path";
import { launch } from "../cdp.mjs";
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const URL = arg("--url", "https://komorebi.autoarticles.net/");
const OUT = arg("--out", "D:/komorebi-stages/live");
fs.mkdirSync(OUT, { recursive: true });
const p = await launch({ width: 390, height: 844, mobile: true, dpr: 2 });
const hits = [];
try {
  await p.send("Network.enable");
  // collect GA4 hits by polling performance entries (no extra CDP listener needed)
  await p.goto(URL);
  await p.waitFor("window.__komorebi", 30000);
  await p.sleep(4000);
  const ga = await p.eval(`performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/g/collect') || n.includes('gtag/js')).map(n => n.split('?')[0] + ' ' + (n.match(/[?&](tid|id)=([^&]+)/) || ['', '', ''])[2])`);
  const ver = await p.eval(`fetch('game.json',{cache:'no-store'}).then(r => r.json()).then(g => g.version)`);
  const label = await p.eval(`document.getElementById('version-label').textContent`);
  await p.shot(path.join(OUT, "phone-title.png"));
  await p.eval(`document.querySelector('#welcome-dialog [data-close]').click()`);
  await p.sleep(600);
  await p.shot(path.join(OUT, "phone-garden.png"));
  console.log(JSON.stringify({ url: URL, version: ver, label, ga, errors: p.errors }, null, 1));
} finally { await p.close(); }
