// Off-route play: mouse drag-rotate, touch drag on a phone, keyboard (arrows / Enter / Q / E / Ctrl+Z), reload mid-rotation,
// remove mode toggled mid-drag, a corrupt save. node tools/play/offroute.mjs --out D:/komorebi-stages/offroute
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launch } from "../cdp.mjs";
const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "D:/komorebi-stages/offroute";
fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(import.meta.dirname, "../serve.js"), "--port", "8794"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
const URL = "http://localhost:8794/";
const log = [];
const S = (p) => p.eval(`window.__komorebi.state()`);
async function boot(p, clear = true) {
  await p.goto(URL); if (clear) await p.eval(`localStorage.clear()`); await p.goto(URL);
  await p.waitFor("window.__komorebi", 15000); await p.sleep(300);
  await p.eval(`document.querySelectorAll('dialog[open]').forEach(d => d.close())`);
}
const center = (p) => p.eval(`(() => { const b = document.getElementById('world').getBoundingClientRect(); return [Math.round(b.left + b.width/2), Math.round(b.top + b.height/2)]; })()`);
try {
  // PC: mouse drag
  let p = await launch({ width: 1280, height: 720 });
  await boot(p);
  const [cx, cy] = await center(p);
  const a0 = (await S(p)).angle;
  await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 10; i++) await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx + i * 20, y: cy, button: "left", buttons: 1 });
  // toggle remove mode mid-drag (keyboard focus stays on the canvas)
  await p.eval(`document.getElementById('remove').click()`);
  await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx + 200, y: cy, button: "left", buttons: 0, clickCount: 1 });
  const s1 = await S(p);
  log.push(`mouse drag 200px: angle ${a0.toFixed(2)} -> ${s1.angle.toFixed(2)}, objects ${s1.objects.length} (no placement on drag), removing ${s1.removing}`);
  await p.eval(`document.getElementById('remove').click()`);
  await p.shot(path.join(OUT, "pc-drag.png"));
  // keyboard
  await p.eval(`document.getElementById('world').focus()`);
  const n0 = (await S(p)).objects.length;
  for (const k of ["ArrowUp", "ArrowLeft", "ArrowLeft", "Enter"]) { await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: { ArrowUp: 38, ArrowLeft: 37, Enter: 13 }[k] }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k }); await p.sleep(60); }
  const n1 = (await S(p)).objects.length;
  for (const k of ["q", "q", "e"]) { await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: "Key" + k.toUpperCase(), text: k }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: "Key" + k.toUpperCase() }); await p.sleep(250); }
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", modifiers: 2 });
  await p.sleep(200);
  log.push(`keyboard: objects ${n0} -> Enter ${n1} -> Ctrl+Z ${(await S(p)).objects.length}; toast "${await p.eval(`document.getElementById('toast').textContent`)}"`);
  // reload mid-rotation
  await p.eval(`document.getElementById('rotate-right').click(); document.getElementById('rotate-right').click()`);
  const goal = (await S(p)).angle;
  await boot(p, false);
  log.push(`reload mid-rotation: saved goal ${goal.toFixed(2)} -> after reload ${(await S(p)).angle.toFixed(2)}`);
  // corrupt save
  await p.eval(`localStorage.setItem('komorebi-garden.v1', '{"version":1,"objects":[{"id":"x"}],"completed":99}')`);
  await boot(p, false);
  log.push(`corrupt save: completed ${(await S(p)).completed}, objects ${(await S(p)).objects.length} (starter garden)`);
  await p.eval(`localStorage.setItem('komorebi-garden.v1', '{not json')`);
  await boot(p, false);
  log.push(`broken JSON save: objects ${(await S(p)).objects.length}`);
  // an original-build save (3 letters done) still loads: letter 4 active, 3 gifts open
  await p.eval(`localStorage.setItem('komorebi-garden.v1', JSON.stringify({version:1, completed:3, angle:0.2, history:[], objects:[["house",2,2],["oak",0,3],["pine",3,0],["pine",5,1],["oak",6,3],["bench",3,5],["flower",1,5],["flower",4,3],["lamp",1,2]].map(([type,x,y],i)=>({id:i===0?'original-house':'original-'+i,type,x,y,turn:0}))}))`);
  await boot(p, false);
  log.push(`old 3-letter save: completed ${(await S(p)).completed}, open tools ${await p.eval(`document.querySelectorAll('#palette-items [data-type]').length`)}`);
  log.push(`pc errors ${JSON.stringify(p.errors)}`);
  await p.close();
  // phone: touch drag and tap
  p = await launch({ width: 390, height: 844, mobile: true, dpr: 2 });
  await boot(p);
  const [tx, ty] = await center(p);
  const b0 = (await S(p)).angle;
  const tp = (type, x, y) => p.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  await tp("touchStart", tx, ty);
  for (let i = 1; i <= 8; i++) await tp("touchMove", tx - i * 15, ty);
  await tp("touchEnd", tx - 120, ty);
  await p.sleep(200);
  const s2 = await S(p);
  log.push(`touch drag: angle ${b0.toFixed(2)} -> ${s2.angle.toFixed(2)}, objects ${s2.objects.length}`);
  const free = s2.free[0];
  const pt = await p.eval(`(() => { const c = document.getElementById('world'), b = c.getBoundingClientRect(); const A = window.__komorebi.state().angle, F = 72, T = Math.PI*2; const a = (((Math.round(A*F/T)%F)+F)%F)*T/F; const x = (${free.x}-3)*28, y = (${free.y}-3)*28; const px = x*Math.cos(a)-y*Math.sin(a), py = (x*Math.sin(a)+y*Math.cos(a))*0.58; return [b.left + (Math.round(c.width*.5)+px)*b.width/c.width, b.top + (Math.round(c.height*.495)+py)*b.height/c.height]; })()`);
  await tp("touchStart", pt[0], pt[1]); await tp("touchEnd", pt[0], pt[1]); await p.sleep(250);
  log.push(`touch tap on free ${free.x},${free.y}: objects ${(await S(p)).objects.length}; toast "${await p.eval(`document.getElementById('toast').textContent`)}"`);
  await p.shot(path.join(OUT, "phone-touch.png"));
  // phone layout: nothing wider than the screen
  log.push(`phone horizontal overflow: ${await p.eval(`document.documentElement.scrollWidth > innerWidth`)}`);
  log.push(`phone errors ${JSON.stringify(p.errors)}`);
  await p.close();
} finally {
  fs.writeFileSync(path.join(OUT, "log.txt"), log.join("\n") + "\n");
  console.log(log.join("\n"));
  server.kill();
}
