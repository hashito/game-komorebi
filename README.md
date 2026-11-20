# こもれびの庭 / KOMOREBI GARDEN

空に浮かぶ小さな「ひだまり島」に木や野の花、ベンチや庭灯を置いて、島をくるりと回して眺めるドット絵の箱庭ゲーム（key `komorebi`, β）。
https://komorebi.autoarticles.net/

The original build came from a GPT agent as `komorebi-garden.zip` (first commit, unchanged). It is not a game-kit 3D game:
plain scripts, a 2D canvas and sprite stacking (each model is a stack of horizontal pixel slices, drawn rotated and squashed).

## Files

| file | what |
|---|---|
| `index.html`, `style.css` | page, title card (`#welcome-dialog`), help, ending card (`#complete-dialog`), phone layout (A12 sizes at <= 740 px) |
| `models.js` | the pixel models (`window.GardenModels.get(type)`) |
| `scene.js` | the island, projection, picking, hint marks, dusk (`window.GardenScene`) |
| `sky.js` | the sky backdrop |
| `game.js` | tools, 庭だより letters (`QUESTS`), gifts (`ITEMS[].unlock`), save (localStorage `komorebi-garden.v1`), undo |
| `share-bar.js` | copy of game-kit `js/share-bar.js` (X / share / copy / 他のゲームを遊ぶ, GA4 events) |
| `game.json` | version and release notes; `site.json` SEO / portal card; `assets/og-image.png` |

## Commands

```
node tools/serve.js                 # http://localhost:8000/ (source)
node tools/build-site.js            # public/ with SEO, OGP, JSON-LD, GA4 (site.json)
node tools/serve.js --public        # what Firebase serves
node tools/play/review.mjs --out D:/komorebi-stages/review   # headless PC 1280x720 + phone 390x844: every tool, rotate, undo, remove, sound, reload, off-route taps
node tools/play/quests.mjs --out D:/komorebi-stages/quests [--phone]   # all 8 letters through the UI, ending card, dusk
node tools/play/models.mjs --out D:/komorebi-stages/models.png         # every model at 8 angles
node tools/check.mjs                # syntax + data checks (run before deploy; deploy only on exit 0)
firebase deploy --only hosting      # project komorebi-hashito
```

Headless checks only (no visible browser window). `window.__komorebi.state()` is a read-only view for the scripts.
