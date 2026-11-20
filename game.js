(() => {
  "use strict";

  const ITEMS = [
    { type: "oak", name: "まるい木", category: "nature" },
    { type: "pine", name: "針葉樹", category: "nature" },
    { type: "flower", name: "野の花", category: "nature" },
    { type: "bench", name: "ベンチ", category: "props" },
    { type: "lamp", name: "庭灯", category: "props" },
    { type: "house", name: "赤屋根の家", category: "props" }
  ];
  const names = Object.fromEntries(ITEMS.map(item => [item.type, item.name]));
  const DEFAULT_ANGLE = -0.55;
  const TAU = Math.PI * 2;
  const STORE_KEY = "komorebi-garden.v1";
  const HOUSE_ID = "original-house";
  const starterSpots = [
    ["house", 2, 2], ["oak", 0, 3], ["pine", 3, 0], ["pine", 5, 1],
    ["oak", 6, 3], ["bench", 3, 5], ["flower", 1, 5], ["flower", 4, 3], ["lamp", 1, 2]
  ];
  const startObjects = starterSpots.map(([type, x, y], index) => ({
    id: index === 0 ? HOUSE_ID : "original-" + index, type, x, y, turn: 0
  }));
  const originalById = new Map(startObjects.map(obj => [obj.id, obj]));
  const directions = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
  const byId = id => document.getElementById(id);
  const cellKey = (x, y) => x + ":" + y;
  const normalizeAngle = angle => ((angle % TAU) + TAU) % TAU;
  const isPlanted = obj => obj.id.startsWith("planted-");
  const isTree = obj => obj.type === "oak" || obj.type === "pine";

  function run() {
    const canvas = byId("world");
    const scene = new window.GardenScene(canvas);
    const palette = byId("palette-items");
    const categoryTabs = byId("category-tabs");
    const messageBox = byId("toast");
    const helpDialog = byId("help-dialog");
    let objects = startObjects.slice();
    let completed = 0;
    let history = [];
    let angle = DEFAULT_ANGLE;
    let selected = "flower";
    let category = "all";
    let removing = false;
    let point = null;
    let drag = null;
    let lastPointer = null;
    let audio = null;
    let soundOn = false;
    let messageTimer = 0;
    let saveAvailable = true;
    let lastFrame = -Infinity;
    let renderId = 0;
    let rotation = null;

    function validSnapshot(data) {
      if (!data || !Number.isInteger(data.completed) || data.completed < 0 || data.completed > 3 ||
          !Array.isArray(data.objects) || data.objects.length > 49) return false;
      const occupied = new Set();
      const ids = new Set();
      for (const obj of data.objects) {
        if (!obj || typeof obj.id !== "string" || !Object.hasOwn(names, obj.type) ||
            !Number.isInteger(obj.x) || !Number.isInteger(obj.y) ||
            obj.x < 0 || obj.x > 6 || obj.y < 0 || obj.y > 6 ||
            (obj.turn !== undefined && !Number.isFinite(obj.turn))) return false;
        const key = cellKey(obj.x, obj.y);
        if (occupied.has(key) || ids.has(obj.id)) return false;
        if (isPlanted(obj)) {
          if (obj.id !== "planted-" + key || !scene.canPlant(obj.x, obj.y)) return false;
        } else {
          const original = originalById.get(obj.id);
          if (!original || original.type !== obj.type || original.x !== obj.x || original.y !== obj.y) return false;
        }
        occupied.add(key);
        ids.add(obj.id);
      }
      return ids.has(HOUSE_ID);
    }

    function load() {
      let raw;
      try {
        raw = localStorage.getItem(STORE_KEY);
      } catch {
        saveAvailable = false;
        return;
      }
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data.version !== 1 || !validSnapshot(data)) return;
        objects = data.objects;
        completed = data.completed;
        if (Number.isFinite(data.angle)) angle = normalizeAngle(data.angle);
        if (Array.isArray(data.history)) history = data.history.slice(-25).filter(validSnapshot);
      } catch {
        // The starter garden stays playable if the previous save was interrupted.
      }
    }

    function save() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, objects, completed, history, angle: rotation?.end ?? angle }));
        saveAvailable = true;
      } catch {
        saveAvailable = false;
      }
      updateSaveLabel();
    }

    function updateSaveLabel() {
      const status = byId("save-label");
      if (status) status.textContent = saveAvailable ? "自動保存" : "この画面のみ";
    }

    function notify(text, duration = 2300) {
      if (!messageBox) return;
      clearTimeout(messageTimer);
      messageBox.textContent = text;
      messageBox.classList.add("show", "visible");
      messageTimer = setTimeout(() => messageBox.classList.remove("show", "visible"), duration);
    }

    function chime(notes, length = 0.24) {
      if (!soundOn || !audio || audio.state !== "running") return;
      for (const [i, frequency] of notes.entries()) {
        const start = audio.currentTime + i * 0.105;
        const wave = audio.createOscillator();
        const gain = audio.createGain();
        wave.type = "sine";
        wave.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.055, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
        wave.connect(gain).connect(audio.destination);
        wave.start(start);
        wave.stop(start + length + 0.02);
        wave.onended = () => { wave.disconnect(); gain.disconnect(); };
      }
    }

    async function toggleSound() {
      if (soundOn) {
        soundOn = false;
        updateControls();
        return;
      }
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error();
        if (!audio) audio = new Audio();
        await audio.resume();
        soundOn = true;
        chime([523.25, 783.99]);
      } catch {
        notify("このブラウザでは音を再生できません");
      }
      updateControls();
    }

    const flowers = () => objects.filter(obj => isPlanted(obj) && obj.type === "flower").length;
    const beside = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
    function placedBeside(type, neighborTest) {
      return objects.some(obj => isPlanted(obj) && obj.type === type &&
        objects.some(neighbor => neighborTest(neighbor) && beside(obj, neighbor)));
    }
    const goals = [
      () => flowers() >= 2,
      () => placedBeside("bench", isTree),
      () => placedBeside("lamp", neighbor => neighbor.type === "bench")
    ];

    function updateGoals() {
      const before = completed;
      while (completed < goals.length && goals[completed]()) completed++;
      if (completed === before) return false;
      if (completed === 3) {
        notify("3つのお題を達成！　青い小鳥が遊びにきました", 5200);
        chime([523.25, 659.25, 783.99, 1046.5], 0.44);
      } else {
        notify(completed === 1 ? "お題達成！　次は木のとなりにベンチを置こう" : "お題達成！　次はベンチのとなりに庭灯を置こう", 3700);
        chime([523.25, 659.25, 783.99], 0.35);
      }
      return true;
    }

    function updateQuestUI() {
      const titles = ["野の花を2つ植えよう", "木のとなりにベンチを置こう", "ベンチのとなりに庭灯を置こう", "青い小鳥が遊びにきました"];
      const count = byId("quest-count");
      const title = byId("quest-title");
      const progress = byId("quest-progress");
      if (title) title.textContent = completed === 0 && flowers() === 1 ? "野の花をあと1つ植えよう" : titles[completed];
      if (count) count.textContent = completed + " / 3";
      if (progress) {
        const partial = completed === 0 ? Math.min(flowers(), 2) / 2 : 0;
        const value = Math.round((completed + partial) / goals.length * 100);
        progress.style.width = value + "%";
        progress.setAttribute("aria-valuenow", String(value));
      }
      const dots = byId("quest-dots");
      if (dots) Array.from(dots.children).forEach((dot, i) => dot.classList.toggle("done", i < completed));
    }

    function setPressed(button, on) {
      if (!button) return;
      button.setAttribute("aria-pressed", String(on));
      button.classList.toggle("active", on);
    }

    function updateControls() {
      const undoButton = byId("undo");
      if (undoButton) undoButton.disabled = history.length === 0;
      setPressed(byId("remove"), removing);
      setPressed(byId("sound"), soundOn);
      if (byId("sound")) byId("sound").setAttribute("aria-label", soundOn ? "音をオフにする" : "音をオンにする");
      canvas.classList.toggle("removing", removing);
      if (byId("selection-label")) byId("selection-label").textContent = removing ? "片づけたいものを選択" : names[selected] + "を配置";
      if (byId("placed-count")) byId("placed-count").textContent = String(objects.filter(isPlanted).length);
      for (const button of palette.querySelectorAll("[data-type]")) {
        const active = !removing && button.dataset.type === selected;
        setPressed(button, active);
        button.classList.toggle("selected", active);
      }
      if (categoryTabs) {
        for (const button of categoryTabs.querySelectorAll("[data-cat]")) setPressed(button, button.dataset.cat === category);
      }
      updateQuestUI();
      updateSaveLabel();
    }

    function buildPalette() {
      palette.replaceChildren();
      for (const item of ITEMS) {
        if (category !== "all" && category !== item.category) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "item-card";
        button.dataset.type = item.type;
        const icon = document.createElement("canvas");
        icon.className = "item-art";
        icon.setAttribute("aria-hidden", "true");
        icon.width = 74;
        icon.height = 64;
        scene.icon(icon, item.type);
        const label = document.createElement("span");
        label.className = "item-name";
        label.textContent = item.name;
        button.append(icon, label);
        palette.append(button);
      }
      updateControls();
    }

    function remember() {
      history.push({ objects, completed });
      if (history.length > 25) history.shift();
    }

    function undo() {
      const previous = history.pop();
      if (!previous) return;
      objects = previous.objects;
      completed = previous.completed;
      updateControls();
      save();
      notify("ひとつ前の庭に戻しました");
      chime([440]);
      requestDraw();
    }

    function objectAt(tile) {
      return tile && objects.find(obj => obj.x === tile.x && obj.y === tile.y);
    }

    function canUse(tile) {
      if (!tile) return false;
      const object = objectAt(tile);
      return removing ? Boolean(object && object.id !== HOUSE_ID) : !object && scene.canPlant(tile.x, tile.y);
    }

    function useTile(tile) {
      if (!tile) {
        notify(removing ? "島の上で片づけたいものを選んでください" : "島の草地を選んでください");
        return;
      }
      const object = objectAt(tile);
      if (!canUse(tile)) {
        notify(removing ?
          (object?.id === HOUSE_ID ? "最初からある赤屋根の家は、この庭の目印です" : "ここには片づけるものがありません") :
          (object ? "ここには" + names[object.type] + "があります" : "小道と池はそのままに。空いている草地を選んでください"));
        return;
      }
      remember();
      if (removing) {
        objects = objects.filter(obj => obj !== object);
        notify(names[object.type] + "を片づけました");
        chime([392]);
      } else {
        objects = objects.concat({ id: "planted-" + cellKey(tile.x, tile.y), type: selected, x: tile.x, y: tile.y, turn: 0 });
        if (!updateGoals()) {
          const partial = selected === "flower" && completed === 0 ? "（" + Math.min(2, flowers()) + " / 2）" : "";
          notify(names[selected] + (["oak", "pine", "flower"].includes(selected) ? "を植えました" : "を置きました") + partial);
          chime([659.25, 880], 0.21);
        }
      }
      updateControls();
      save();
      requestDraw();
    }

    function pick(clientX, clientY) {
      if (removing && typeof scene.pickObject === "function") {
        const obj = scene.pickObject(clientX, clientY, angle, objects);
        if (obj && typeof obj.x === "number") return { x: obj.x, y: obj.y };
      }
      return scene.pick(clientX, clientY, angle);
    }

    function updateDirection() {
      const label = byId("orientation");
      if (label) {
        const index = Math.round(normalizeAngle(angle - DEFAULT_ANGLE) / (Math.PI / 4)) % directions.length;
        label.textContent = directions[index];
      }
    }

    function rotate(sign) {
      const start = angle;
      const goal = (rotation?.end ?? start) + sign * Math.PI / 4;
      point = null;
      rotation = { start, end: goal, since: performance.now() };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        angle = normalizeAngle(goal);
        rotation = null;
        updateDirection();
      }
      save();
      requestDraw();
    }

    function render(now) {
      if (rotation) {
        const p = Math.min(1, (now - rotation.since) / 210);
        angle = rotation.start + (rotation.end - rotation.start) * (1 - Math.pow(1 - p, 3));
        if (p === 1) {
          angle = normalizeAngle(angle);
          rotation = null;
          if (lastPointer) point = pick(lastPointer.x, lastPointer.y);
        }
        updateDirection();
      }
      scene.render({
        objects, angle, completed, time: now, mode: removing ? "remove" : "plant",
        highlight: point ? { x: point.x, y: point.y, valid: canUse(point), type: selected } : null
      });
    }

    function frame(now) {
      renderId = 0;
      if (document.hidden) return;
      if (now - lastFrame >= 1000 / 30 - 1 || rotation || drag?.moving) {
        render(now);
        lastFrame = now;
      }
      renderId = requestAnimationFrame(frame);
    }

    function requestDraw() {
      lastFrame = -Infinity;
      if (!renderId && !document.hidden) renderId = requestAnimationFrame(frame);
    }

    canvas.tabIndex = 0;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      canvas.focus({ preventScroll: true });
      rotation = null;
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startAngle: angle, moving: false };
      canvas.setPointerCapture(event.pointerId);
      point = pick(event.clientX, event.clientY);
      requestDraw();
    });

    canvas.addEventListener("pointermove", event => {
      if (!event.isPrimary) return;
      if (drag && event.pointerId !== drag.id) return;
      lastPointer = event.pointerType === "touch" ? null : { x: event.clientX, y: event.clientY };
      if (drag) {
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moving && Math.hypot(dx, dy) > 8) {
          drag.moving = true;
          canvas.classList.add("dragging");
        }
        if (drag.moving) {
          point = null;
          angle = drag.startAngle + dx / Math.max(240, canvas.clientWidth * 0.72) * Math.PI;
          updateDirection();
          requestDraw();
          return;
        }
      }
      if (!rotation) point = pick(event.clientX, event.clientY);
      requestDraw();
    });

    function release(event, cancelled) {
      if (!drag || event.pointerId !== drag.id) return;
      const wasMoving = drag.moving;
      drag = null;
      canvas.classList.remove("dragging");
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (wasMoving) {
        angle = normalizeAngle(angle);
        save();
      } else if (!cancelled) {
        useTile(pick(event.clientX, event.clientY));
      }
      point = cancelled || event.pointerType === "touch" ? null : pick(event.clientX, event.clientY);
      requestDraw();
    }

    canvas.addEventListener("pointerup", event => release(event, false));
    canvas.addEventListener("pointercancel", event => release(event, true));
    canvas.addEventListener("lostpointercapture", event => release(event, true));
    canvas.addEventListener("pointerleave", () => {
      lastPointer = null;
      if (!drag) { point = null; requestDraw(); }
    });
    canvas.addEventListener("blur", () => { point = null; requestDraw(); });
    canvas.addEventListener("keydown", event => {
      const key = event.key.toLowerCase();
      if (key === "enter" || key === " ") {
        event.preventDefault();
        if (event.repeat) return;
        point ??= { x: 3, y: 3 };
        useTile(point);
      } else if (key === "q" || key === "e") {
        event.preventDefault();
        rotate(key === "q" ? -1 : 1);
      } else if (key.startsWith("arrow")) {
        event.preventDefault();
        lastPointer = null;
        const screen = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
        if (!screen) return;
        if (!point) {
          point = { x: 3, y: 3 };
        } else {
          const dx = screen[0] * Math.cos(angle) + screen[1] * Math.sin(angle);
          const dy = -screen[0] * Math.sin(angle) + screen[1] * Math.cos(angle);
          const clamp = n => Math.max(0, Math.min(6, n));
          point = Math.abs(dx) >= Math.abs(dy) ?
            { x: clamp(point.x + Math.sign(dx)), y: point.y } :
            { x: point.x, y: clamp(point.y + Math.sign(dy)) };
        }
        requestDraw();
      } else if (key === "z" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        undo();
      }
    });

    palette.addEventListener("click", event => {
      const button = event.target.closest("[data-type]");
      if (!button || !palette.contains(button)) return;
      selected = button.dataset.type;
      removing = false;
      updateControls();
      requestDraw();
    });
    categoryTabs?.addEventListener("click", event => {
      const button = event.target.closest("[data-cat]");
      if (!button) return;
      category = button.dataset.cat;
      if (category !== "all" && ITEMS.find(item => item.type === selected)?.category !== category) {
        selected = ITEMS.find(item => item.category === category).type;
      }
      removing = false;
      buildPalette();
      requestDraw();
    });
    byId("rotate-left")?.addEventListener("click", () => rotate(-1));
    byId("rotate-right")?.addEventListener("click", () => rotate(1));
    byId("undo")?.addEventListener("click", undo);
    byId("remove")?.addEventListener("click", () => {
      removing = !removing;
      updateControls();
      requestDraw();
    });
    byId("sound")?.addEventListener("click", toggleSound);
    byId("help")?.addEventListener("click", () => {
      if (helpDialog && !helpDialog.open) helpDialog.showModal();
    });
    byId("close-help")?.addEventListener("click", () => helpDialog?.close());
    helpDialog?.addEventListener("click", event => {
      if (event.target !== helpDialog) return;
      const r = helpDialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) helpDialog.close();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && renderId) {
        cancelAnimationFrame(renderId);
        renderId = 0;
      } else requestDraw();
    });
    window.addEventListener("resize", requestDraw);
    load();
    buildPalette();
    updateDirection();
    requestDraw();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
})();
