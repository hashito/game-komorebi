// Every placeable model at 8 view angles, enlarged, on the grass colour: does it read as what it is from every side?
// node tools/play/models.mjs --out D:/komorebi-stages/models.png [--types oak,pine]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launch } from "../cdp.mjs";

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", "D:/komorebi-stages/models.png");
const TYPES = arg("--types", "house,oak,pine,flower,bench,lamp,bush,mushroom,rock,crate,fence,sign,well,pond,birdhouse");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const port = 8796;
const server = spawn(process.execPath, [path.join(import.meta.dirname, "../serve.js"), "--port", String(port)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
const page = await launch({ width: 1600, height: 1400 });
try {
  await page.goto(`http://localhost:${port}/`);
  await page.waitFor(`window.GardenModels`, 15000);
  const ok = await page.eval(`(() => {
    const types = ${JSON.stringify(TYPES.split(","))}.filter(t => window.GardenModels.get(t));
    const S = 0.58, Z = 3, cellW = 84, cellH = 84;
    const out = document.createElement('canvas');
    out.width = 90 + cellW * Z * 8 / 2; out.height = types.length * cellH * Z / 2 + 30;
    const o = out.getContext('2d'); o.imageSmoothingEnabled = false;
    o.fillStyle = '#a5b96d'; o.fillRect(0, 0, out.width, out.height);
    o.fillStyle = '#334536'; o.font = 'bold 14px sans-serif';
    types.forEach((t, row) => {
      const m = window.GardenModels.get(t);
      o.fillText(t, 6, row * cellH * Z / 2 + 60);
      for (let k = 0; k < 8; k++) {
        const a = -0.55 + k * Math.PI / 4;
        const d = Math.ceil(m.size * 1.45) + 4, head = m.slices.length - 1, tall = Math.ceil(d * S) + head + 5;
        const c = document.createElement('canvas'); c.width = d; c.height = tall;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        const px = Math.floor(d / 2), py = Math.ceil(d * S / 2) + head + 1, co = Math.cos(a), si = Math.sin(a);
        for (let z = 0; z < m.slices.length; z++) { x.setTransform(co, si * S, -si, co * S, px, py - z); x.drawImage(m.slices[z], -m.pivotX, -m.pivotY); }
        const z2 = Math.min(Z, Math.floor((cellH * Z / 2 - 6) / tall), Math.floor((cellW * Z / 2 - 6) / d));
        o.drawImage(c, 90 + k * cellW * Z / 2 + (cellW * Z / 2 - d * z2) / 2, row * cellH * Z / 2 + 4 + (cellH * Z / 2 - tall * z2), d * z2, tall * z2);
      }
    });
    window.__sheet = out.toDataURL('image/png');
    return types.length;
  })()`);
  const data = await page.eval(`window.__sheet`);
  fs.writeFileSync(OUT, Buffer.from(data.split(",")[1], "base64"));
  console.log(`models: ${ok} rows -> ${OUT}; errors ${JSON.stringify(page.errors)}`);
} finally {
  await page.close();
  server.kill();
}
