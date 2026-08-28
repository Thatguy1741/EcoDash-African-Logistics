# EcoDash — African Digital Logistics & Infrastructure Simulator

**WAS262 — Web Animation Scripting (SF1) · Individual Project**

EcoDash is an interactive 2D logistics simulation built with **HTML5 Canvas, CSS3 and Vanilla JavaScript (ES6+)**. You pilot a solar-powered delivery drone across a procedurally generated African landscape, delivering parcels to rural village beacons while managing your solar reserve, dodging obstacles and surviving storms and load-shedding.

---

## Project Description

Across Africa, delivering essential goods to rural and underserved communities is hard: poor roads, load-shedding, unpredictable weather and long distances affect the movement of medical supplies, food and educational resources. EcoDash models this through gameplay:

- **Solar Reserve management** – hovering, thrusting and flying into storms drains your battery; passing through **solar microgrid zones** recharges it.
- **Load-shedding** – some zones turn the grid (and your charging) OFF, just like real scheduled blackouts.
- **Wind** – a constantly changing crosswind pushes the drone off course; you must counter-steer using trigonometric thrust control.
- **Obstacles** – acacia trees, telecom towers and migrating bird flocks, plus ground hazards (potholes, rivers, roadworks) that punish low flying.
- **Deliveries** – reach glowing village beacons to earn Mission Score and combo multipliers.
- **Day/night cycle** – a full cinematic day passes as you play.

### Scoring & saving
Mission Score, distance travelled (km), deliveries, an **energy efficiency grade** (A+ … D based on parcels delivered per 100% reserve spent) and the top 5 **high scores** are saved in the browser's **localStorage**.

---

## Getting Started (Installation / Setup)

The project needs **no build tools and no dependencies**. Two ways to run it:

### 1. Just open it (double-click)
Open **`index.html`** directly in any modern browser (Chrome, Edge, Firefox, Safari). Everything loads from local files.

### 2. With a local server (recommended for GitHub Pages parity)
Use **VS Code + the "Live Server" extension**, or run one of:

```bash
# Python
python -m http.server 8000        # then visit http://localhost:8000

# or Node
npx serve .
```

> Why a server? File:// usually works fine for this project, but `localStorage`, audio and fonts behave identically (and more predictably) over `http://`.

### Deployment (GitHub Pages)
1. Create the public repository `EcoDash-African-Logistics`.
2. Push these files to the `main` branch (or a `gh-pages` branch).
3. GitHub → Settings → Pages → deploy from branch → **Done**.

---

## Project Folder Structure

```
EcoDash/
├── index.html              # Page structure, all screens, script tags
├── css/
│   └── style.css           # African-themed UI, overlays, touch controls
├── js/
│   ├── utils.js            # Math/colour/random/easing helpers
│   ├── input.js            # Keyboard + touch input manager
│   ├── storage.js          # localStorage high scores
│   ├── audio.js            # Procedural sound engine (Web Audio API)
│   ├── celestial.js        # ★ AI-BLIND FEATURE: day/night cycle
│   ├── weather.js          # Global wind system
│   ├── particles.js        # Dust / sparks / leaves / confetti
│   ├── world.js            # Procedural terrain + villages (parallax)
│   ├── drone.js            # Player drone physics (trig movement)
│   ├── obstacles.js        # Trees, towers, birds, zones, beacons
│   ├── hud.js              # On-canvas heads-up display
│   ├── game.js             # Game class: states, scoring, collisions
│   └── main.js             # Bootstrap / console-debug hook (window.game)
├── docs/
│   ├── african-context-report.md   # Task 1.2 African problem + math model
│   ├── ai-reflection-log.md        # Task 1.3 AI use log + ethics
│   └── wireframe.html              # Task 1.3 annotated wireframe
└── README.md               # This file
```

---

## Controls

| Action          | Keyboard          | Touch        |
|-----------------|-------------------|--------------|
| Thrust          | `W` / `↑` / `Space` | **Thrust** |
| Turn left       | `A` / `←`         | **Left**    |
| Turn right      | `D` / `→`         | **Right**   |
| Brake (drag)    | `S` / `↓`         | **Brake**   |
| Pause / Resume  | `P` / `Esc`       | Pause button |
| Sound on/off    | `M`               | Mute button |
| Start / Restart | `Enter`           | Start Mission |

**Console debugging:** open DevTools (F12) — a `game` object is exposed globally.

```js
game.drone.battery = 100;   // top up mid-flight
game.state                 // "playing" | "paused" | "menu" | "gameover"
EC.Celestial.phase         // 0..1 day/night phase
EC.Weather.strength01      // 0..1 current wind strength
```

---

## How it fulfils the assignment (rubric mapping)

| Assignment requirement | Where it lives |
|---|---|
| Player movement + physics (2.1) | `js/drone.js` — trig thrust `cos/sin`, drag, acceleration, battery |
| Obstacles & collision (2.2) | `js/obstacles.js` + `js/game.js` — AABB + circle collisions, storms, load-shedding |
| UX & original feature (2.3) | `js/celestial.js` (AI-blind: day/night), African theme in `world.js`, procedural audio, HUD, responsive touch UI |
| Score & local storage (2.4) | `js/game.js` + `js/storage.js` — high scores, distance, efficiency grade, start/pause/game-over/restart |
| Mathematics | `U.Utils` `js/utils.js` — lerp, seeded RNG (mulberry32), sin/cos sun path & hills & wings |
| OOP / modular JS | One class per concern (`Drone`, `World`, `Game`, `HUD`…) in separate files |
| Version control | 8+ meaningful commits spread across the semester (see commit history) |

---

## AI Usage Disclosure Table

| Component | AI used? | How it was used |
|---|---|---|
| Overall project structure / code scaffold | Yes | Generated with AI assistance (outlined in `docs/ai-reflection-log.md`); every module reviewed & re-explained by the student |
| Movement physics, collisions, scoring | Yes (edited) | AI drafts modified & parameter-tuned; student re-derived equations |
| **Day/night cycle** (`celestial.js`) | **No** | **Original AI-blind feature** — designed & implemented independently; full explanation in the AI Reflection Log |
| Terrain / village generation | Yes (edited) | AI-assisted; logic rewritten around a student-chosen seeded RNG |
| Sounds & music | Yes (edited) | Procedural Web Audio built with AI drafts, then modified |
| Documentation | Partly | Reports drafted by student with AI proof-reading |

*See the full `docs/ai-reflection-log.md` for prompts, outputs, problems found and modifications made.*

---

## Technologies

- 100% **HTML5 Canvas 2D API**
- **CSS3** (flexbox, gradients, responsive scaling, keyboard accessibility)
- **Vanilla JavaScript ES6+** (classes, arrow functions, template literals, modules as `window.EcoDash` namespace blocks)
- **Web Audio API** (synthesized music & SFX — no audio files)
- **localStorage** (persistent high scores)
- No frameworks, no game engines, no external libraries.

## References

- MDN Web Docs. *Canvas API*. Available at: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- MDN Web Docs. *Web Audio API*. Available at: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- (Academic sources in `docs/african-context-report.md` — to be verified via STADIO library)