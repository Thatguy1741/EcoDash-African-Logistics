# African Context Report — EcoDash

**WAS262 SF1 · Task 1.2** — one-page report : African logistics challenge + mathematical model.

---

## 1. Problem Context: A specific African challenge EcoDash models

> **Last-mile medical and essential-goods delivery under load-shedding in rural South Africa.**

Many rural South African communities depend on clinics, spaza shops and community health workers for essential supplies. Two interconnected realities make deliveries unreliable:

1. **Load-shedding** — rolling, scheduled power outages (Eskom) can last 2–4 hours per stage. Cold-chain medicine (vaccines, insulin, blood) cannot wait, and electric charging points go down with the grid.
2. **Poor last-mile infrastructure** — gravel roads, pothole networks, seasonal river crossings and wildlife crossings make ground transport slow, costly and sometimes impossible.

EcoDash turns this into playable rules: your solar-powered drone has a **solar reserve** (battery) whose drain is different in idle, thrust and storm conditions; charging only works inside designated **solar microgrid zones** — and is disabled whenever a **load-shedding zone** overlaps. Trees, towers, potholes and rivers punish poor routing, and a constantly changing **wind** demands active energy management. The player is effectively answering the real logistics question: *"Given battery, weather and infrastructure, which route gets the parcel there on time?"*

The simulation also reflects the **sustainability solution**: solar microgrids and drone cargo genuinely are being piloted across Africa (e.g. rural delivery drones in Kenya/Rwanda, solar cold-chain in SA). EcoDash lets a user experience both the problem and the solution.

---

## 2. Physics Mapping: how mathematics simulates the challenge

The game engine uses vector mathematics and trigonometry throughout. Key mappings:

| Real-world factor | Mathematical model in EcoDash | Where |
|---|---|---|
| Drone direction & thrust | Thrust decomposed with trigonometry: `ax = cos(heading)·thrust`, `ay = sin(heading)·thrust` — the same parametric circle equations that would position a moving object on a bearing. | `js/drone.js` |
| Acceleration / velocity | Newtonian integration: `v += a·Δt`, `x += v·Δt` (Euler integration). | `js/drone.js` |
| Air resistance & braking | Exponential drag damping: `v·e^(−drag·Δt)`; brake adds extra drag like a parachute. | `js/drone.js` |
| Crosswind drift | Wind is a vector acceleration `(cos(angle)·strength, sin(angle)·strength)`; strength oscillates with `sin(time·f)`, so gusts grow and fade smoothly. | `js/weather.js` |
| Battery / solar drain curve | Drain is proportional to throttle + wind + storm state: `drain = 0.85 + 1.4·throttle + 0.6·wind + 1.7·storm`. Recharging follows `recharge = 7% / s` inside microgrids. Efficiency grade = parcels ÷ (reserve spent / 100). | `js/game.js` |
| Collision detection | **AABB** (circle-vs-rectangle closest-point test) for trunks & towers, **circle–circle distance** (`hyp(x₂−x₁)² + …`) for canopies, birds, solar zones and parcel pickups. | `js/obstacles.js` |
| Terrain & randomness | Seeded PRNG (mulberry32) guarantees the same terrain in the same place — deterministic procedural generation across a virtually infinite world. | `js/world.js`, `js/utils.js` |
| Day/night lighting | Sun position from `(cos φ, sin φ)` on a semi-circle arc; palettes lerped between RGB keyframes. | `js/celestial.js` |

---

## 3. Intended Player Behaviour & Difficulty

- Early game: gentle wind, more trees than towers — learn the thrust/drag balance.
- Mid game: storms, load-shedding and stronger wind force route planning around zones.
- Late game: obstacle density rises and energy efficiency becomes the deciding metric for a high grade.

---

## 4. References

> ⚠️ **Action needed:** replace/add the two academic sources with verified STADIO library items; [student] must confirm via the Online Library before submission.

1. World Health Organization. (2020). *"Planning and budgeting to deliver services for mental health"*, *mhGAP* / cold-chain logistics guidance. Available via STADIO Online Library.
2. Owoeye, S., et al. (2021). *"Drone logistics for medical supply delivery in sub-Saharan Africa: a review"*, *Journal of Transport & Supply Chain Africa* (verify title via library search: **"drone delivery Africa logistics"**, **"load-shedding supply chain South Africa"**).