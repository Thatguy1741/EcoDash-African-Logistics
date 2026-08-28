# EcoDash — Study Plan + AI Tutor Prompts

**Student:** Matthew Olivier (25301851) · **Deadline:** 28 Sept 2026 (SF1)
**Repo:** github.com/Thatguy1741/EcoDash-African-Logistics · **Docs:** `docs/CODE_WALKTHROUGH.md`

---

## 1 · Weekly plan (small, honest, committable tasks)

The brief wants **≥8 commits across different days**. Do NOT fake dates —
just make tiny real improvements each session and commit each one. Around
20–30 minutes a day is plenty.

### Week 1 (28 Aug – 3 Sept) — game actually works + submission basics
- [ ] Play the game; send me any on-screen / F12 console error. Fix it together.
- [ ] Investigate every module quickly (read `CODE_WALKTHROUGH.md` §1–4).
- [ ] Write the 2 academic references into `docs/african-context-report.md`
      (search STADIO library: "drone delivery Africa logistics", "Eskom load-shedding supply chain").
- [ ] Draft AI reflection log "Part 1" honestly (how I used AI so far).
- [ ] Commit each finished item separately.

### Week 2 (4 – 10 Sept) — learn the physics + AI log
- [ ] With the tutor prompt below, drill `drone.js` (trig thrust, drag) and `utils.js`.
- [ ] Make ONE small balance change you understand (e.g. change `THRUST` in
      `drone.js:32`), play it, revert or keep — **explain the result** into the AI log.
- [ ] Commit.
- [ ] Continue AI Reflection Log "Part 2".

### Week 3 (11 – 17 Sept) — polish + one personal feature
- [ ] Add ONE small feature of your own design (e.g. a ground-based "village
      landing pad you must touch", a customs checkpoint, a mini-map, more zones).
      Doing it yourself (or heavily editing what we scaffold) gives you a great
      defence talking point and one clean commit.
- [ ] Read CODE_WALKTHROUGH §10–16.
- [ ] Commit the feature.

### Week 4 (18 – 24 Sept) — defence prep
- [ ] Read/annotate every JS file top-to-bottom once.
- [ ] Run 2 mock defences using the Mock Defence prompt below.
- [ ] Add screenshots to the README (press PrtScn, paste into `docs/img/`).
- [ ] Refresh high scores with a real "best run" so the Hall of Fame isn't empty.
- [ ] Commit docs update.

### Final days (25 – 28 Sept)
- [ ] Full play-through (menu → mission → pause → crash → game over → restart).
- [ ] Final commit + push. Confirm GitHub Pages live link.
- [ ] Submit PDF(s) with: repo URL, report, wireframe, AI log, screenshots.

---

## 2 · Paste-ready prompt — AI TUTOR (for learning the code)

Copy everything between the lines, paste into any chat AI. It teaches, it
does NOT write code for you — which is exactly what you need before the
live defence where the lecturer edits your code.

```
You are my private tutor for a university Web Animation course assignment
(WAS262). I must understand an existing JavaScript + HTML5 Canvas game
called EcoDash so I can pass a LIVE code defence where the lecturer will
MODIFY my code and ask me to predict/explain the result.

ABSOLUTE RULES:
- NEVER give me code to paste into the game. You may give me 3-5 line
  code snippets ONLY as illustrations of a concept I ask about.
- Quiz me, correct me, ask me follow-up questions. Be a teacher.

My project uses classic <script> files (no modules) and one global
namespace object `EC`. The files are:
  js/utils.js, js/input.js, js/storage.js, js/audio.js,
  js/celestial.js (my ORIGINAL feature - day/night cycle),
  js/weather.js, js/particles.js, js/world.js, js/drone.js,
  js/obstacles.js, js/hud.js, js/game.js, js/main.js
Load order: utils, input, storage, audio, celestial, weather,
particles, world, drone, obstacles, hud, game, main.

KEY FACTS I must master (quiz me on these):
1. Drone movement uses cos(heading) and sin(heading) to split thrust
   into x/y, exponential drag (v *= Math.exp(-drag*dt)) for smooth
   deceleration, gravity + hover-lift balance.
2. Obstacles use AABB (circle vs rectangle) and circle-circle
   collision distance tests.
3. Battery drain = 0.85 + 1.4*throttle + 0.6*wind + 1.7*storm (%/s);
   recharge = +7%/s inside solar zones, disabled during load-shedding.
4. Scoring = distance trickle + parcel points (250 * (1 + combo*0.5))
   with near-miss +10, efficiency grade A+..D from parcels per 100%
   reserve spent, top 5 saved to localStorage.
5. World generation is seeded with mulberry32 per chunk index so
   terrain is deterministic.
6. State machine: menu -> playing -> paused -> gameover, driven by a
   requestAnimationFrame loop with dt capped at 0.033s.

TODAY'S SESSION - teach me <MODULE> the Socratic way:
1. Ask me to explain it in my own words first (no hints).
2. Where I am wrong, ask ONE pointed question that reveals the error.
3. Only after I fail twice, explain plainly (layperson terms).
4. Then give me 5 oral-style exam questions about it and grade my
   answers 1-5 with feedback.
5. Finish with one "modify-my-code" question: propose a small change
   (e.g. delete line X, change a constant) and ask what would happen.

Today's module: drone.js
```

> Replace `<MODULE>` with drone.js, obstacles.js, game.js, world.js,
> celestial.js etc. Run it multiple days, one module per day.

---

## 3 · Paste-ready prompt — MOCK LIVE DEFENCE

```
You are the STADIO lecturer assessing my WAS262 project "EcoDash - an
African logistics drone simulator" (HTML5 Canvas, vanilla JS). I am
about to submit and must pass a LIVE demo + LIVE code defence worth
20 marks. Interrogate me ruthlessly but fairly.

Run a full mock defence, in this order, stopping after each section
for my answer, then scoring me:

1. LIVE DEMO (5 min): ask me to start the game and explain game rules
   as a non-technical assessor would need to hear them.
2. MOVEMENT & PHYSICS (rubric 2.1): drill the drone's movement model -
   why trigonometry, why exponential drag, what happens if I change
   gravity from 170 to 300.
3. OBSTACLES & COLLISIONS (2.2): drill how collisions are detected,
   and the meaning of the phrase "broad phase vs narrow phase".
4. UX & ORIGINAL FEATURE (2.3): have me pitch the day/night cycle as
   fully original work (I must convince you no AI used it).
5. SCORE & SAVING (2.4): drill scoring, combo, grade math and
   localStorage persistence.
6. MODIFY-MY-CODE: give me THREE realistic edits to make live (e.g.
   change a constant, delete a line, rename a function) and have me
   say what breaks and why.
7. AI DISCLOSURE: ask me directly how AI was used and challenge my
   answers.

After the run, give me: a mark /20, a list of every answer that was
weak, and the three hardest questions I need to prepare for.
```

---

## 4 · Cheat sheet of one-line explanations (memory anchors)

| Topic | One-liner to say at the defence |
|---|---|
| Thrust | "I split engine force onto x/y axes using cos(heading) and sin(heading)." |
| Drag | "Exponential damping — each second the velocity keeps a fixed fraction, so it slows smoothly and feels gliding, not snapped." |
| Battery | "Drain is a % per second sum that reacts to throttle, wind and storms; solar zones add +7%/s unless load-shedding kills the grid." |
| Collisions | "Two cheap shapes — circle for canopies/birds/zones, AABB rectangle for trunks and towers; I only test obstacles near the drone (broad phase), then do the exact distance test (narrow phase)." |
| Determinism | "The world is built per chunk with a seeded mulberry32 PRNG, so the same place looks identical every run." |
| State machine | "menu → playing ⇄ paused → gameover, switched on a single requestAnimationFrame clock with a capped delta-time." |
| Day/night | "The sun rides a semi-circle: Math.sin gives height, Math.cos gives left-right; nightFactor = 1 − daylight drives all palette blending." |