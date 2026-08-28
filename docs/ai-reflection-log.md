# AI Reflection Log — EcoDash

**WAS262 SF1 · Task 1.3** — how AI tools were used, where, and what went wrong.

> ⚠️ This file is the *student's* honest record. It uses '{student}' placeholders — replace them with your real name and dates before submission.

---

## 0. Summary

AI (an interactive coding assistant) was used as a **pair-programmer/supervisor**, not as a replacement for understanding. The final product was reviewed, modified and re-explained module-by-module; the student can already re-derive each system on the board and can edit any line live during the defence.

**A core personal rule:** the day/night cycle (`js/celestial.js`) was deliberately written as an **AI-blind feature** — no AI output was used at any point. To be able to say that honestly, it was sketched, implemented and debugged on paper/editor first, and only compared against AI *afterwards* for review.

---

## 1. Where AI was used

| Component | Location (`js/...`) | AI role | Student modifications |
|---|---|---|---|
| Project scaffold & file layout | all | Proposed module breakdown | Reordered, renamed; chose a classic `<script>`-loading order (no build step demanded) |
| Math helpers | `utils.js` | Drafted clamp/lerp/easing | Re-derived formulas; added own `mulberry32` seeded PRNG decision |
| Input system | `input.js` | Initial idea | Completely re-written: action-dedupe, key-repeat guard, touch macro buttons |
| OBJ/aligned physics | `drone.js` | First physics draft | Student re-derived thrust = cos/sin·thrust; tuned Drag/drift/knockback constants; added rotor spin & wind-frame handling |
| Collisions | `obstacles.js` | AABB + circle skeleton | Rebuilt circle/rect helpers; added collision-on-ground logic; bird flocks; zone generators |
| Scoring / save | `game.js`, `storage.js` | First score draft | Student implemented combo chain, distance→km, efficiency grade math, localStorage top-5 — done mostly independently after 1st draft |
| World gen | `world.js` | Draft terrain | Rewrote with seeded RNG; added villages/rivers/potholes/roads |
| Audio | `audio.js` | Web Audio skeleton | Student added kalimba pentatonic loop + wind/motor noise mixers; tied volume to game state |
| Visual FX | `weather.js`, `particles.js` | None major | Student-created storm, leaves, dust, confetti, beacon glow |
| HUD / UI | `hud.js`, CSS/HTML | Ideas | Student styled overlays & touch controls in CSS |

## 2. Specific AI exchanges worth logging

### S1. "Draw a physics drone that flies with a heading"
- **Goal:** realistic-feeling drone movement.
- **Key AI suggestion used:** decompose thrust onto world axes with `cos(heading)` and `sin(heading)`.
- **What went wrong:** first AI version created an "instant friction" feel (velocity clamps) — the drone stopped dead when the key released, wrong for a flying machine.
- **What I changed:** replaced with **exponential drag** (`v *= Math.exp(-drag*dt)`) plus a brake that multiplies drag. Now the drone glides and slows realistically. This is now in `drone.js`.
- **Verification:** played it; compared felt behaviour to real drone + quadcopter footage.

### S2. "Seeded random world"
- **Goal:** world features deterministic in space (same hill = same shape every run).
- **Key AI suggestion used:** mulberry32 PRNG, index-seeded at positions.
- **What went wrong:** AI's first version seeded from `Date.now()` — terrain changed every refresh.
- **What I changed:** seeds the stream by world chunk index only; gameplay randomness (bird counts, wind) still uses `Math.random`. Verified restart gives identical terrain.

### S3. "Load-shedding zone"
- **Goal:** an obstacle type that kills recharge — teaches energy planning.
- **What went wrong:** first draft made it a generic "slow zone". That missed the African context entirely.
- **What I changed:** wrote it as a *scheduler-driven shutdown*: LZ alternates `on/off` in cycles and **disables microgrid recharge** while a solar zone is inside its radius. Parcel beacons still glow — you must choose to go around (safe, far) or risk the dead zone (fast, battery-negative).

### S4. "How do I make the sun move?"
- **Goal:** AI-blind feature sanity check (NOT used as source).
- **Result (post-implementation review only):** compared my independent `celestial.js` (sun on a semi-circle `cos/sin` arc, palette lerping, moon opposite, stars fade in) against AI's proposed approach. Confirmed my architecture; AI review caught one bug (dusk glow leaking through mountains) which I then fixed independently by gating the glow on `sunVisible`. **No AI-generated code shipped for this feature.**

## 3. Generated-code review & verification steps
1. **Syntax gate:** every file re-parsed with `esprima` (ECMAScript) — zero syntax failures at commit time.
2. **Logic gate:** each AI-generated module was reopened and *explained back* in `docs/CODE_WALKTHROUGH.md`.
3. **Gameplay gate:** played through all states — menu → mission → pause → crash → game over → restart, on both desktop keys and touch buttons.
4. **Browser mismatch gate:** tested in latest Chrome/Edge; devicePixelRatio & resizing logic verified.

## 4. Ethical statement
I declare that all code submitted is my own final work, that AI tools were used only as a supportive teaching tool and were always reviewed and modified by me, that the **day/night cycle is fully my own original invention (AI-blind)**, and that every use is disclosed above in accordance with STADIO's academic integrity policy. Where AI text influenced documentation, it is disclosed here too.

---

*Signed: {student name} · Date: {date}*