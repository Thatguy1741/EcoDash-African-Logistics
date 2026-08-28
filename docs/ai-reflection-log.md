# AI Reflection Log — EcoDash

**WAS262 SF1 · Task 1.3** — an honest, dated record of how AI tools were used on this project, what was learned, and what went wrong.

**Student:** Matthew Olivier (25301851) · **Repo:** github.com/Thatguy1741/EcoDash-African-Logistics

---

## 1. What I created myself (framing)

Before this project I had only made small static HTML/CSS pages and basic
JavaScript exercises. For EcoDash I designed, planned and drove **the whole
concept**: an African logistics drone simulator with solar energy, load-shedding
and rural village deliveries. Every gameplay rule (battery economy, storms,
combo scoring, efficiency grade), the screen layout, the visual theme and the
delivery-flow were decided by me. The **day/night cycle** (`js/celestial.js`) is
the project's original feature and was built by me **without any AI output**
(see §5).

AI (an interactive coding mentor) was used like a pair-programmer to:
**learn** the Canvas/math techniques I needed, generate **first drafts** of
routines, and **help debug/fix** problems once I had tried them myself. Every
AI-provided piece was read, understood, edited and usually rewritten by me —
pasted code was never accepted on faith. That rule is what lets me stand up in
the live code defence and handle edits to any file.

---

## 2. Working sessions (diary)

### Session 1 — 28 Aug 2026 · Planning & scaffold
- **What I did myself:** chose the problem (last-mile delivery under load-shedding),
  wrote the one-page African-context draft, sketched the four screens (menu /
  playing / paused / game-over), planned the folder structure.
- **AI used for:** teaching me what a Canvas game loop looks like, file separation
  ideas, and checking my sketch made sense.
- **What I changed from the first idea:** my own sketch evolved — I merged
  "settings" into the pause screen and added a touch-control layer for tablets.
- **Result:** `index.html`, `css/style.css`, `docs/wireframe.html`.

### Session 2 — 28 Aug 2026 · Utilities, input, saving, audio
- **What I did myself:** planned `EC.Utils` needs (clamp, lerp, distance,
  random), decided to store high scores in `localStorage` capped at 5.
- **AI used for:** the exact trigonometry/easing helper formulas; first Web Audio
  draft.
- **Problems found (mine):** the AI's audio engine was a static chord loop — boring.
  I replaced it with a **kalimba pentatonic melody** and tied wind/motor noise to
  gameplay state.
- **Lesson learned:** sound design is about *mood over time*, not just "make noise".
- **Result:** `js/utils.js`, `js/storage.js`, `js/input.js`, `js/audio.js`.

### Session 3 — 28 Aug 2026 · Original feature: day/night cycle (AI-blind)
- **What I did myself:** planned the whole thing on paper:
  - a phase clock `0..1` mapping to a 24-hour day,
  - the sun riding a half-circle arc — `Math.sin` for height, `Math.cos` for
    left–right,
  - `nightFactor = 1 − daylight` driving every palette blend,
  - stars only fading in when the sun is truly below the horizon.
- **AI used:** none for building it. After it worked I asked the AI to *review*
  my code, which found one real bug (see below) and I fixed it myself.
- **Problems found:** my first version let the dawn glow leak through the
  mountains. I added a `sunVisible` gate so the glow only shows when the sun is
  on screen — squinting at the horizon while testing until it looked right.
- **Result:** `js/celestial.js`.

### Session 4 — 28 Aug 2026 · World + wind + effects
- **What I did myself:** decided on parallax scroll layers (far 25%, near 55%,
  ground 100%), villages as delivery targets, and a **seeded** PRNG
  (mulberry32) so the same place looks identical every run.
- **AI used for:** first draft of chunk-building; wind oscillation math.
- **Problems found (mine):** first AI terrain draft used `Date.now()` seeds, so
  the world changed every refresh. I switched to per-chunk indexing manually.
- **Debugging (AI helped):** the very first truck cull deleted every truck on
  frame one — the camera state wasn't initialised yet. AI walked me through
  reading the filter and I added safe defaults.
- **Result:** `js/world.js`, `js/weather.js`, `js/particles.js`.

### Session 5 — 28 Aug 2026 · Drone physics + obstacles
- **What I did myself:** set the feel I wanted — the drone must **glide**, not
  snap. Decided thrust along the nose using `cos(heading)`/`sin(heading)`
  (parametric circle maths), gravity + hover-lift balance, real battery costs.
- **AI used for:** basing the physics draft; then I re-derived the equations by
  hand in my notes.
- **Problems found (mine):** first version used "velocity clamping", which made
  the drone stop dead the instant you released a key. I replaced it with
  **exponential drag** (`v *= exp(-drag·dt)`) so it floats and slows naturally.
- **Debugging (AI helped):** bird flocks oriented wrong; load-shedding zone had
  two lamps. I traced and removed the overlap; AI suggested the circle+AABB
  collision "two shapes per obstacle" pattern, which I adopted and documented.
- **Result:** `js/drone.js`, `js/obstacles.js`.

### Session 6 — 28 Aug 2026 · Game class, HUD, bootstrap
- **What I did myself:** state machine (menu → playing ⇄ paused → gameover),
  scoring model (parcel points × combo, near-miss bonus, distance km), the
  **energy-efficiency grade** (parcels per 100% reserve spent → A+ … D), and
  the on-canvas HUD design.
- **AI used for:** reviewing my state-machine wiring; fixing my HUD text overlap.
- **Debugging (AI helped):** particles froze on screen — I'd forgotten to call
  `particles.update(dt)`. AI pointed me at the update loop.
- **Result:** `js/hud.js`, `js/game.js`, `js/main.js`.

### Session 7 — 28 Aug 2026 · First real play-test (in browser)
- **Found myself:** propeller drawn floating above the drone → moved the rotor
  group down 4px.
- **Found myself:** tree canopies hovered above the trunk → raised the canopy
  anchor so foliage actually sits on the branches.
- **Found (AI helped debug):** running out of battery froze the whole game —
  `endGame()` filled the game-over screen but never revealed it
  (`refreshOverlays()` was missing). Fixed and verified both crash types
  (crash + battery-out) now open the report screen cleanly.
- **Result:** these three fixes are today's commits.

---

### Session 8 — 28 Aug 2026 · Play-test checklist via DevTools console
- **Found myself:** after starting the game the drone felt right, but I was
  suspicious of how smooth it was — so I opened the DevTools Console while on
  the **menu screen** and watched one error repeat every frame:
  `TypeError: this.solarZones is not iterable (Game.draw)`.
- **Lesson learned:** `newMission()` created the zone arrays, but the menu
  screen draws the same scene *before* a mission exists. The arrays were
  undefined there, so `for (const z of this.solarZones)` threw once per frame
  (~60/sec). The game only "worked" after Start because starting created them.
- **AI role:** after I pasted the five-line error, the AI pointed out the
  constructor vs `newMission()` split and the principle *"anything draw touches
  must exist before the first frame"*. I moved the array initialisation into
  the `Game` constructor myself and confirmed the console stays silent.
- **Result:** `js/game.js` constructor change (commit `966814f`). Good habit I
  now use every session: play with F12 Console open.

---

## 3. Patterns I now own (knowledge gained)

- `cos/sin` to place anything on a circle/arc (sun, birds, sparks, thrust).
- Exponential damping vs clamping, and *why* exponential is frame-rate friendly.
- Broad-phase vs narrow-phase collision (near/`colliders()`/distance test).
- Deterministic procedural generation with a seeded PRNG.
- Canvas layering: sky → parallax → world → entities → FX → HUD → vignette.
- Why `AudioContext` needs a user gesture, and how a global namespace
  (`window.EcoDash = EC`) keeps classic scripts working without a build step.

## 4. One-line verification gate (applied before every commit)

Every file was re-parsed with an ECMAScript parser (esprima) → zero syntax
errors, then play-tested in Chrome; every commit in the repo passes that gate.

## 5. Original feature declaration — day/night cycle (AI-blind)

The day/night feature in `js/celestial.js` is **my own original work**:
designed, implemented and debugged by me, no AI-generated code. After
completion I asked an AI only to *review* it (it spotted the dawn-glow leak,
which I fixed myself). This satisfies the brief's requirement for an
"original feature implemented without AI", and I can defend every line of it.

## 6. Ethical statement

I declare that all code submitted is my own final work. AI tools were used
as a supportive teaching/mentor tool in the sessions logged above, always
reviewed, understood and modified by me, and never accepted on faith. Every
use is disclosed honestly here in keeping with STADIO's academic integrity
policy, so that the live code defence can confirm my understanding.

---

*Signed: Matthew Olivier · 25301851 · 28 Aug 2026 (ongoing — updated each working session)*