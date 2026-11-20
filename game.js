(() => {
  "use strict";

  const ITEMS = [
    { type: "oak", name: "まるい木", category: "nature" },
    { type: "pine", name: "針葉樹", category: "nature" },
    { type: "flower", name: "野の花", category: "nature" },
    { type: "bench", name: "ベンチ", category: "props" },
    { type: "lamp", name: "庭灯", category: "props" },
    { type: "house", name: "赤屋根の家", category: "props" },
    // Gifts: each one arrives with a 庭だより letter (unlock = letters finished).
    { type: "bush", name: "茂み", category: "nature", unlock: 1 },
    { type: "mushroom", name: "きのこ", category: "nature", unlock: 2 },
    { type: "rock", name: "苔むした岩", category: "nature", unlock: 3 },
    { type: "fence", name: "木の柵", category: "props", unlock: 4 },
    { type: "crate", name: "木箱", category: "props", unlock: 5 },
    { type: "sign", name: "立て札", category: "props", unlock: 6 }
  ];
  const unlockAt = Object.fromEntries(ITEMS.map(item => [item.type, item.unlock || 0]));
  const PLANTS = ["oak", "pine", "flower", "bush", "mushroom"];
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
  const byId = id => document.getElementById(id);
  const cellKey = (x, y) => x + ":" + y;
  const normalizeAngle = angle => ((angle % TAU) + TAU) % TAU;
  const isPlanted = obj => obj.id.startsWith("planted-");
  const isTree = obj => obj.type === "oak" || obj.type === "pine";
  const beside = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  const besidePath = obj => (obj.x === 1 || obj.x === 3) && obj.y >= 3;
  const nearPond = (x, y) => [[4, 4], [4, 5], [5, 4], [5, 5]].some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) === 1);
  function placedBeside(list, type, neighborTest) {
    return list.some(obj => isPlanted(obj) && obj.type === type &&
      list.some(neighbor => neighbor !== obj && neighborTest(neighbor) && beside(obj, neighbor)));
  }
  const plantedCount = list => list.filter(isPlanted).length;
  const flowerCount = list => list.filter(obj => isPlanted(obj) && obj.type === "flower").length;
  // 庭だより: one letter at a time. `type` is the tool the letter asks for (its cells glow on the island),
  // `gift` the tool that arrives when it is done, `visit` what the player sees change in the garden.
  const QUESTS = [
    { title: "野の花を2つ植えよう", type: "flower", test: list => flowerCount(list) >= 2, gift: "bush" },
    { title: "木のとなりにベンチを置こう", type: "bench", test: list => placedBeside(list, "bench", isTree), gift: "mushroom" },
    { title: "ベンチのとなりに庭灯を置こう", type: "lamp", test: list => placedBeside(list, "lamp", n => n.type === "bench"), gift: "rock", visit: "青い小鳥がベンチに遊びにきました" },
    { title: "木の根もとに、きのこを置こう", type: "mushroom", test: list => placedBeside(list, "mushroom", isTree), gift: "fence" },
    { title: "木の柵を2つ、となりあわせに置こう", type: "fence", test: list => placedBeside(list, "fence", n => n.type === "fence"), gift: "crate" },
    { title: "家のとなりに木箱を置こう", type: "crate", test: list => placedBeside(list, "crate", n => n.type === "house"), gift: "sign" },
    { title: "小道のそばに立て札を立てよう", type: "sign", test: list => list.some(obj => isPlanted(obj) && obj.type === "sign" && besidePath(obj)), visit: "小道に立て札が立ちました。庭だよりは、あと1通です" },
    { title: "植えたもの・置いたものを15こにしよう", type: null, test: list => plantedCount(list) >= 15, gift: "dusk", visit: "島に夕暮れがきました" }
  ];

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
    let dusk = false;
    let seen = new Set(ITEMS.filter(item => !item.unlock).map(item => item.type));
    let hadSave = false;

    function validSnapshot(data) {
      if (!data || !Number.isInteger(data.completed) || data.completed < 0 || data.completed > QUESTS.length ||
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
        hadSave = true;
        dusk = completed >= QUESTS.length && data.dusk === true;
        if (Array.isArray(data.seen)) for (const type of data.seen) if (Object.hasOwn(names, type)) seen.add(type);
        if (Object.hasOwn(names, data.selected) && unlocked(data.selected)) selected = data.selected;
        if (Number.isFinite(data.angle)) angle = normalizeAngle(data.angle);
        if (Array.isArray(data.history)) history = data.history.slice(-25).filter(validSnapshot);
      } catch {
        // The starter garden stays playable if the previous save was interrupted.
      }
    }

    function save() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, objects, completed, history, angle: rotation?.end ?? angle, dusk, seen: [...seen], selected }));
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

    const unlocked = type => completed >= (unlockAt[type] || 0);
    const quest = () => QUESTS[completed] || null;
    const track = (name, params) => { try { if (typeof window.gtag === "function") window.gtag("event", name, params); } catch {} };

    function updateGoals() {
      const before = completed;
      while (completed < QUESTS.length && QUESTS[completed].test(objects)) completed++;
      if (completed === before) return false;
      const done = QUESTS[completed - 1];
      track("quest_complete", { quest: completed });
      const gift = done.gift && done.gift !== "dusk" ? "道具箱に「" + names[done.gift] + "」が届きました" : "";
      if (completed === QUESTS.length) {
        dusk = true;
        notify("庭だよりをぜんぶ達成！　" + done.visit, 5200);
        chime([523.25, 659.25, 783.99, 1046.5], 0.44);
        track("garden_complete", {});
        setTimeout(showComplete, 900);
      } else {
        notify("お題達成！　" + [done.visit, gift].filter(Boolean).join("。"), 4200);
        chime([523.25, 659.25, 783.99], 0.35);
      }
      if (done.gift && names[done.gift]) buildPalette();
      return true;
    }

    // Cells where the current letter's tool would finish the letter (they glow on the island).
    function hintCells() {
      const q = quest();
      if (!q || !q.type || removing || selected !== q.type) return [];
      const cells = [];
      for (let y = 0; y <= 6; y++) for (let x = 0; x <= 6; x++) {
        if (!canPlace(q.type, x, y)) continue;
        const trial = objects.concat({ id: "planted-" + cellKey(x, y), type: q.type, x, y, turn: 0 });
        if (q.test(trial)) cells.push({ x, y });
      }
      // Letters that need more than one placement (2 flowers, 2 fences): every free cell is a step forward.
      return cells.length ? cells : freeCells().map(cell => ({ ...cell, soft: true }));
    }
    function freeCells() {
      if (removing) return [];
      const cells = [];
      for (let y = 0; y <= 6; y++) for (let x = 0; x <= 6; x++) if (canPlace(selected, x, y)) cells.push({ x, y });
      return cells;
    }

    function updateQuestUI() {
      const q = quest();
      const count = byId("quest-count");
      const title = byId("quest-title");
      const progress = byId("quest-progress");
      const pick = byId("quest-pick");
      const note = byId("quest-note");
      let text = q ? q.title : "庭だよりをぜんぶ達成しました";
      if (q && q.type === "flower" && flowerCount(objects) === 1) text = "野の花をあと1つ植えよう";
      if (q && !q.type) text = q.title + "（いま" + plantedCount(objects) + "こ）";
      if (title) title.textContent = text;
      if (count) count.textContent = completed + " / " + QUESTS.length;
      if (note) {
        note.textContent = !q ? "夕暮れボタンで、灯りのともる庭を眺められます" :
          q.type ? (selected === q.type && !removing ? "島の上の金色の場所に置くと達成です" : "「" + names[q.type] + "」をえらぶと、置く場所が光ります") :
          "どこに何を置いても数に入ります";
      }
      if (pick) {
        const show = Boolean(q && q.type && (selected !== q.type || removing));
        pick.hidden = !show;
        if (show) pick.textContent = names[q.type] + "をえらぶ";
      }
      if (progress) {
        let partial = 0;
        if (q && q.type === "flower") partial = Math.min(flowerCount(objects), 2) / 2;
        if (q && !q.type) partial = Math.min(plantedCount(objects), 15) / 15;
        const value = Math.round((completed + partial) / QUESTS.length * 100);
        progress.style.width = value + "%";
        progress.setAttribute("aria-valuenow", String(value));
      }
      const duskButton = byId("dusk");
      if (duskButton) {
        duskButton.hidden = completed < QUESTS.length;
        setPressed(duskButton, dusk);
      }
      canvas.closest(".view")?.classList.toggle("dusk", dusk);
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
        const open = unlocked(item.type);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "item-card" + (open ? "" : " locked") + (open && !seen.has(item.type) ? " new" : "");
        if (open) button.dataset.type = item.type;
        else {
          button.disabled = true;
          button.setAttribute("aria-label", "まだ届いていない道具（庭だより" + item.unlock + "通目のごほうび）");
        }
        const icon = document.createElement("canvas");
        icon.className = "item-art";
        icon.setAttribute("aria-hidden", "true");
        icon.width = 74;
        icon.height = 64;
        scene.icon(icon, item.type);
        const label = document.createElement("span");
        label.className = "item-name";
        label.textContent = open ? item.name : "お題" + item.unlock + "で届く";
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
      const hadGifts = completed;
      objects = previous.objects;
      completed = previous.completed;
      if (completed < QUESTS.length) dusk = false;
      if (!unlocked(selected)) selected = "flower";
      if (completed !== hadGifts) buildPalette();
      updateControls();
      save();
      notify("ひとつ前の庭に戻しました");
      chime([440]);
      requestDraw();
    }

    // A fence runs east-west; it turns to join a fence already standing north or south of it.
    function fenceTurn(type, tile) {
      if (type !== "fence") return 0;
      const fenceAt = (x, y) => objectAt({ x, y })?.type === "fence";
      const ns = fenceAt(tile.x, tile.y - 1) || fenceAt(tile.x, tile.y + 1);
      const ew = fenceAt(tile.x - 1, tile.y) || fenceAt(tile.x + 1, tile.y);
      return ns && !ew ? Math.PI / 2 : 0;
    }

    function objectAt(tile) {
      return tile && objects.find(obj => obj.x === tile.x && obj.y === tile.y);
    }

    // A house is wide: next to the pond its walls would stand in the water and on the jetty.
    function canPlace(type, x, y) {
      return !objectAt({ x, y }) && scene.canPlant(x, y) && !(type === "house" && nearPond(x, y));
    }

    function canUse(tile) {
      if (!tile) return false;
      const object = objectAt(tile);
      return removing ? Boolean(object && object.id !== HOUSE_ID) : canPlace(selected, tile.x, tile.y);
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
          (object ? "ここには" + names[object.type] + "があります" :
            selected === "house" && scene.canPlant(tile.x, tile.y) ? "家は池から1マスはなして建てましょう" :
            "小道と池はそのままに。空いている草地を選んでください"));
        return;
      }
      remember();
      if (removing) {
        objects = objects.filter(obj => obj !== object);
        notify(names[object.type] + "を片づけました");
        chime([392]);
      } else {
        objects = objects.concat({ id: "planted-" + cellKey(tile.x, tile.y), type: selected, x: tile.x, y: tile.y, turn: fenceTurn(selected, tile) });
        if (!updateGoals()) {
          const partial = selected === "flower" && completed === 0 ? "（" + Math.min(2, flowerCount(objects)) + " / 2）" : "";
          notify(names[selected] + (PLANTS.includes(selected) ? "を植えました" : "を置きました") + partial);
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
      const needle = byId("compass-needle");
      if (needle) needle.style.transform = "rotate(" + Math.round((angle - DEFAULT_ANGLE) * 180 / Math.PI) + "deg)";
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
        highlight: point ? { x: point.x, y: point.y, valid: canUse(point), type: selected, turn: fenceTurn(selected, point) } : null,
        hints: hintCells(), dots: freeCells(), dusk
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
      if (!seen.has(selected)) {
        seen.add(selected);
        button.classList.remove("new");
        save();
      }
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
    byId("quest-pick")?.addEventListener("click", () => {
      const q = quest();
      if (!q || !q.type || !unlocked(q.type)) return;
      selected = q.type;
      removing = false;
      seen.add(selected);
      if (category !== "all" && ITEMS.find(item => item.type === selected)?.category !== category) category = "all";
      buildPalette();
      save();
      notify("光っている場所をタップすると" + names[selected] + (PLANTS.includes(selected) ? "を植えます" : "を置きます"));
      requestDraw();
    });
    byId("dusk")?.addEventListener("click", () => {
      if (completed < QUESTS.length) return;
      dusk = !dusk;
      updateControls();
      save();
      chime(dusk ? [392, 523.25] : [523.25, 659.25]);
      requestDraw();
    });
    const openDialog = dialog => { if (dialog && !dialog.open) dialog.showModal(); };
    byId("help")?.addEventListener("click", () => openDialog(helpDialog));
    for (const dialog of document.querySelectorAll("dialog")) {
      dialog.addEventListener("click", event => {
        const closer = event.target.closest("[data-close]");
        if (closer) { dialog.close(); return; }
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
      });
    }
    function showComplete() {
      const dialog = byId("complete-dialog");
      if (!dialog || dialog.open) return;
      for (const open of document.querySelectorAll("dialog[open]")) open.close();
      dialog.showModal();
    }
    // Read-only view for the headless checks (tools/play/*.mjs).
    window.__komorebi = { state: () => ({ angle: rotation?.end ?? angle, completed, quests: QUESTS.length, selected, removing, dusk, hints: hintCells(), free: freeCells(), objects: objects.map(o => ({ ...o })) }) };
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
    // The title card: what this is, what to do, and share / other games (fleet rule). It waits for the player.
    const welcome = byId("welcome-dialog");
    if (welcome) {
      const start = byId("welcome-start");
      if (start && hadSave) start.textContent = "庭のつづきへ";
      openDialog(welcome);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
})();
