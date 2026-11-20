// Pre-deploy check: script syntax, game.json / site.json fields, the built page has the SEO + GA4 head. Exit 1 on any problem.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const ROOT = path.resolve(import.meta.dirname, "..");
const bad = [];
for (const f of ["game.js", "models.js", "scene.js", "sky.js"]) {
  try { execFileSync(process.execPath, ["--check", path.join(ROOT, f)], { stdio: "pipe" }); } catch (e) { bad.push(`${f}: ${String(e.stderr).split("\n").slice(0, 4).join(" ")}`); }
}
try { execFileSync(process.execPath, ["--input-type=module", "--check"], { input: fs.readFileSync(path.join(ROOT, "share-bar.js")), stdio: "pipe" }); } catch (e) { bad.push(`share-bar.js: ${e.stderr}`); }
const game = JSON.parse(fs.readFileSync(path.join(ROOT, "game.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(game.version || "")) bad.push("game.json version");
for (const k of ["name", "nameEn", "domain", "description", "genre", "ogImage"]) if (!site[k]) bad.push(`site.json ${k}`);
if (!/約\d+分/.test(site.description)) bad.push("site.json description needs 約N分");
if (!site.gaId) bad.push("site.json gaId is empty");
if (!fs.existsSync(path.join(ROOT, "assets/og-image.png"))) bad.push("assets/og-image.png missing");
const pub = path.join(ROOT, "public/index.html");
if (fs.existsSync(pub)) {
  const html = fs.readFileSync(pub, "utf8");
  for (const s of ['property="og:image"', "application/ld+json", "googletagmanager.com/gtag/js", 'rel="canonical"']) if (!html.includes(s)) bad.push(`public/index.html lacks ${s}`);
  if ((html.match(/name="description"/g) || []).length !== 1) bad.push("public/index.html: description meta count != 1");
  for (const f of ["game.json", "og-image.png", "share-bar.js"]) if (!fs.existsSync(path.join(ROOT, "public", f))) bad.push(`public/${f} missing`);
} else bad.push("public/ not built (node tools/build-site.js)");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
for (const s of ['data-share="title"', 'data-share="ending"', "β版"]) if (!html.includes(s)) bad.push(`index.html lacks ${s}`);
if (bad.length) { console.error("check FAILED\n- " + bad.join("\n- ")); process.exit(1); }
console.log(`check OK (v${game.version}, GA ${site.gaId})`);
