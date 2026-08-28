# Code Walkthrough — EcoDash (Defence Preparation)

**WAS262 SF1** · This guide explains every module the way you'd explain them at the live code defence. Read it *after* opening the code, then re-derive each idea on paper.

---

## 0. Golden rule for the defence
The lecturer will **modify your code live**. So you must be able to predict what a small change does. For each module ask yourself: *“If they delete this line / change this constant, what happens?”* The main constants to know are in `game.js` (scoring/drain), `drone.js` (physics), `obstacles.js` (collision radii) and `world.js` (chunk size, ground).

---

## 1. Load order & namespace
`index.html` loads scripts in a fixed order (classic scripts, no modules — simpler to debug):
`utils → input → storage → audio → celestial → weather → particles → world → drone → obstacles → hud → game → main`.

Every file adds to one shared namespace object `window.EcoDash` (aliased `EC`). `main.js` then creates `new EC.Game('#game')` and stores it as `window.game` so you can type `game` in the console.

**Defence question:** *“Why a global namespace instead of ES modules?”* — file:// works everywhere, no CORS/build step, and the examiners can open any single file in the browser console. Downsides (no static imports) are acceptable here.

---

## 2. `utils.js` — math library
- `clamp(v,a,b)` — keep value in range.
- `lerp(a,b,t)` and `lerpAngle(a,b,t)` (angle-aware wrap-around; used for wind direction & sun).
- `TAU` = 2π; degrees↔radians helpers.
- `mulberry32(seed)` — tiny deterministic PRNG. **Why?** The world must look the *same every run* at the same location: `world.js` seeds per chunk index, so `worldAt(x)` is a pure function of `x`.
- `mixColour(c1,c2,t)` — interpolates/blends two `{r,g,b}` colours; `shadeColour(c,f)` darkens by an ambient factor. Powers the day/night palette blending, night dimming and zone glows.
- `easeOutCubic` etc. — animation fades.
- `roundRect` polyfill — rounded rectangles for HUD panels (safety, since some old browsers lack it).

## 3. `input.js` — inputs, dedup + touch
- Maps keys to logical **actions** (`UP, LEFT, RIGHT, BRAKE, PAUSE, MUTE, CONFIRM`), never hard-coding keys across the codebase. That one change is the key design.
- `_actionSet` + `repeat-guard`: a held `W` counts once, not once per frame → *this matters for frame-rate-independent behaviour*.
- On-screen touch macros (Left/Right/Thrust/Brake buttons) also feed the same action set, so mobile uses zero extra logic.
- Emits `repeatenot` clear event on window `blur` (so a stuck key doesn't keep the drone thrusting).

## 4. `storage.js` — saving
- `EC.storage.topScores()` reads `localStorage['ecodash.scores']` (JSON array), inserts a new score, keeps top 5, writes back.
- Also saves a per-run flag `ecodash.newBest` to flash the “NEW HIGH SCORE” badge on the game-over screen.
- **Defence:** tie to rubric clause 2.4: score persistence in the browser, no server needed. `localStorage` is synchronous & simple; a `Map`/indexedDB would be overkill.

## 5. `audio.js` — procedural Web Audio (no files)
- One `AudioContext` created on the first user gesture (browsers block autoplay).
- **Music:** a kalimba-style pentatonic melody built from oscillators + gain envelopes (pentatonic avoids dissonance over the length of a run).
- **SFX:** bump (short noise burst), alert, chime (parcel), charge (rising pitch = recharge), crash.
- Two `filtered noise` loops: motor hum + wind, gain tied to `game` state + `weather.strength01`.
- Everything synthesized — so the repo contains *zero audio assets*, ideal for a small submission.

## 6. `celestial.js`
> **This is the AI-blind feature — you must be able to defend it as 100% yours (and it is one of the 10 UX/feature marks).**

- `period` (default 90s sim time per full day) advances in `update`.
- Sun position: `sunX/H·(cosφ) + offset`, `sunY = H/2 − sin φ·(H/3)`, `φ ∈ [0..π]` — animates along a half-circle arc (dawn horizon → noon top → dusk opposite horizon).
- Moon mirrors the sun: 180° of phase (`φ + π`).
- Night palette #1 → dawn/day #2 → dusk #3 → night, via `mixHex` keyframing on `phaseFrac`, plus stars fade in after dusk and **only when the sun is actually below the horizon** (`sunVisible` check — this gate was a later bug fix: dawn glow used to leak through the mountains).
- Depth effect: celestial sky is drawn first; the parallax `world.js` mountains sit over its lower part → the glow is clipped naturally by the terrain, which is exactly what a real horizon does.
- A small “sun/moon icon + %” readout on screen communicates current light for gameplay (players learn night → solar only via zones).

## 7. `weather.js` — wind
- Wind is an **acceleration vector**, recomputed each frame: `angle = lerp over sin(time·w1)`, `strength01 = 0.25 + 0.75·smoothstep(sin(time·w2)·0.5+0.5)`.
- Used by `drone.update` as `aw = cos(angle)·g, ay += sin(angle)·g`.
- Visualisation: an on-screen arrow plus procedural grass/leaf/particle gusts.

## 8. `particles.js` — FX
- Small pool of particles with position, velocity, life, colour, size; `update(dt)` & `render(ctx)`.
- Emitters used: dust (crash/landing), sparks (storm), leaves (wind gust), confetti (parcel chime), sun-glint particles over solar zones.
- OOP pattern the examiners like: one class, no per-particle `new` each frame → pooled & cheap.

## 9. `world.js` — procedural parallax terrain
- Fixed internal canvas 960×540, `GROUND_Y = 452`.
- Layers back→front: celestial sky → far mountain ridge → hills band 1 → hills band 2 → **ground strip** (textured dirt, potholes, road, trucks) → gameplay elements.
- Ground is chunk-built: `ensureTo(xMax)` builds chunk `i` at `[i·CHUNK, (i+1)·CHUNK)` deterministically from seed = chunk index → truck positions, pothole positions, trees, villages all *deterministic*.
- Villages contain small huts + a central beacon position; beacon positions map to spawn sites used by `obstacles.js`.
- Parallax factor per layer gives depth with far layers moving slowest (`scroll = camX·factor`).

## 10. `drone.js` — the player object
State: `heading` (radians, pointing where nose points), position `x,y`, speed `speed` (scalar), plus `throttle` display value.

- **Thrust:** `ax = cos(heading)·THRUST`, `ay = sin(heading)·THRUST` → then `ax += windX`, windY; gravity constant `g`. Euler: `vx += ax·dt`, `x += vx·dt`, etc.
- **Drag model you can defend:** `vel *= exp(-DRAG·dt)`; if braking, `DRAG·3`. That's *frame-independent* because it's `ν₀·e^(−kΔt)` — doubling dt doesn't double the loss. This was the single most important rewrite from the first AI draft (which used an instant-clamp).
- **Ground reaction:** when `y ≥ GROUND_Y`, the drone rebounds up (elastic bounce `vy·−0.4`) and small dust particles spawn; flying too level into the ground adds hull damage via the game's ground-hit logic.
- **Battery:** `drain dt/s` (see game), solar recharge only allowed when inside a solar zone and the zone is charged.

## 11. `obstacles.js` — collision + zones
- **Broad-phase:** each obstacle stores a world `x`; the game only tests `if (|ob.x − drone.x| < ob.radius + DRONE_RADIUS)` → cheap, O(n) but with most obstacles inactive.
- **Narrow-phase helpers:**
  - `circleRect(cx,cy,r, rx,ry,rw,rh)` — find closest point on rect, distance → circle test (used for trunks/towers which are rectangles).
  - `circleCircle(...)` — `hyp²` compare against squared radii (avoids a sqrt per frame).
- **Bird flocks:** a `BirdObstacle` spawns a small flock flying across the path; collisions also count the flock's *near-miss* (miss within radius but no hit) → adds a combo bonus → rewards skilled piloting without crashing.
- **Zones (`SolarZone`, `LoadShedZone`, `StormCell`, `DeliveryBeacon`)**: geometric circle areas with gameplay effects:
  - solar → battery recharge + also adds a "recharged" chime;
  - Load-shed → alternates on/off via deterministic timer; **when off it cancels any recharge** (turns microgrid dead);
  - storm → extra battery drain + strong wind bias + sparks FX;
  - beacon → delivery pickup: score, combos, confetti, new beacon spawns ahead.
- **Obstacle creation** keyword `OBSTACLE_COUNT` scales with distance so difficulty ramps.

## 12. `hud.js` — heads-up display
- Panels (rounded rects) for battery & hull, mission stats (score, combo, speed km/h in-game, distance, grade so far), wind arrow, beacon arrow, toasts, and the "NEW HIGH SCORE" flash.
- Draw order: world → entities → FX → HUD → overlays → all inside the Game's single draw call.

## 13. `game.js` — state machine + rules
States: `menu → playing ⇄ paused → gameover`.

- **State machine:** `setState/enterState`. Each state's `update`/`draw` are switched in `update(dt)`/`draw(ctx)`.
- **Scoring:** parcels give base + combo; combo from close passes & near-misses; distance in km; efficiency grade = `parcels / reserveSpent%` (A+ ≥ 2.0 · base… exact tables commented in code) — this is the rubric's “score & save” measurable.
- **Battery model** (this is a good “explain the drain” line):
  - base `0.85%/s`, thrust `+1.4·throttle`, storm `+1.7`, wind `+0.6·strength01`.
  - recharge `+7%/s` in a charged solar zone; load-shed overrides.
- **Collision pass:** loop obstacles → broad phase → narrow phase → on hit: `flashTimer` invulnerability, screen shake via `world.shake`, knockback velocity, hull −N, FX, audio bump; ground-hit & death by hull ≤ 0 or battery = 0 → gameover.
- **Restart:** resets everything to fresh mission (camera, drone, obstacles), keeps scores.

## 14. `main.js`
- Creates game, starts RAF loop with fixed `FPS` clamp and `dt` cap (so tab-switching doesn't spiral the simulation), resizes the canvas to CSS size keeping 960×540 internal.
- Adds `window.addEventListener('resize', ...)` so the game scales to fit while keeping aspect ratio.

---

## 15. Top likely “modify-my-code” defence spots

| If the lecturer does this… | What happens (and what you'd say) |
|---|---|
| Changes `THRUST` in `drone.js` | Push feels weaker/stronger; the drone is harder to keep aloft → you'd need more thrust or weaker gravity to compensate. |
| Removes `Math.exp(-drag*dt)` | Drone stops dead on key release (no glide). Discuss exponential damping. |
| Sets `GROUND_Y=0` | Everything intersects the ground; the drone can only fly below the horizon line? No—the ground band draws from y=0. Explain geometry. |
| Puts `Camera forced to x = 0` | Screens stay static; world can't scroll to villages; deliveries impossible past first beacon. |
| Deletes `localStorage` line | run works, but scores aren't remembered after refresh — rubric clause 2.4 fails. |
| Replaces `mulberry32` with `Math.random` | same-looking terrain differs between runs; chapter 9 logic breaks. |
| Ties `dt` to a fixed 60 instead of real elapsed | On 144Hz monitors the game runs ~2.4× too fast; that's exactly why `dt` is used everywhere. |

---

## 16. Feature matrix → mark checklist

| Item | File(s) | Status |
|---|---|---|
| Player movement & physics | `drone.js` | ✔ trig cos/sin + drag |
| Obstacles & collisions | `obstacles.js`, `game.js` | ✔ |
| UX & original AI-blind feature | `celestial.js`, `hud.js`, CSS | ✔ (feature = day/night) |
| Score & local storage | `game.js`, `storage.js` | ✔ |
| OOP & modular code | all | ✔ |
| GitHub ≥ 8 commits | git history | ✔ see `git log` |
| Report: African problem | `docs/african-context-report.md` | ✔ fill academic refs |
| AI log | `docs/ai-reflection-log.md` | ✔ write real date/name |
| Wireframe | `docs/wireframe.html` | ✔ sketch on paper for submission |
| Live demo + defence | — | ✔ practice this walkthrough