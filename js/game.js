/* ============================================================
   EcoDash - game.js
   ------------------------------------------------------------
   THE GAME CLASS - the conductor of the whole orchestra.

   It owns:
     - the canvas + the main update()/draw() game loop
     - the STATE MACHINE: menu -> playing -> paused -> gameover
     - spawning of obstacles & zones + difficulty scaling
     - ALL collision reactions (hits, near-misses, ground)
     - battery drain / recharge logic (+ energy efficiency)
     - scoring, combo, deliveries, distance
     - game over + saving scores to local storage
     - the DOM UI (menu / pause / game-over screens, buttons)

   This is deliberate layering:
       Game (rules, scoring, flow)
         -> Drone (physics)        <- subject to Game's decisions
         -> World / Obstacles      <- give the drone something to do
         -> Celestial / Weather    <- ambient context
         -> Particles / HUD / Audio <- feedback & polish

   Exposed as:  new EC.Game(canvasElement)
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});
  const U = EC.Utils;

  const W = 960;        // internal canvas width
  const H = 540;        // internal canvas height
  const GROUND_Y = 452; // y where the ground line sits

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.W = W;
      this.H = H;
      this.GROUND_Y = GROUND_Y;

      // Crisp rendering on high-DPI screens: scale the backing
      // store but keep all logic in logical 960x540 units.
      this.dpr = window.devicePixelRatio || 1;
      canvas.width = W * this.dpr;
      canvas.height = H * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Ambient systems (created once, reused every mission).
      this.celestial = EC.Celestial;               // day/night cycle
      this.weather = EC.Weather;                   // global wind
      this.particles = new EC.ParticleSystem();    // dust / sparks / leaves
      this.hud = new EC.HUD();                     // on-canvas HUD
      this.world = new EC.World(GROUND_Y);         // terrain + villages

      this.time = 0;            // global clock (kept across states)
      this.cameraX = 0;
      this.state = "menu";
      this.drone = null;

      // Mission entities are created empty up-front so the MENU screen
      // (which draws the same scene) never iterates an undefined array.
      this.obstacles = [];
      this.solarZones = [];
      this.loadZones = [];
      this.storms = [];
      this.activeDelivery = null;

      this.world.ensureTo(1500);

      this.bindUI();
      this.setupTouch();
      this.setupKeyboard();
      this.refreshOverlays();

      // Start the loop. Wrapped in try/catch so that if ANY error
      // happens the game keeps running and prints the error on the
      // canvas + console instead of silently freezing.
      this.lastTs = performance.now();
      this.tick = (ts) => {
        const dt = Math.min(0.033, (ts - this.lastTs) / 1000);
        this.lastTs = ts;
        try {
          if (this.state === "playing") this.updatePlaying(dt);
          else if (this.state === "menu") this.updateMenu(dt);
          this.draw(dt);
        } catch (err) {
          this.drawError(err);
        }
        requestAnimationFrame(this.tick);
      };
      requestAnimationFrame(this.tick);
    }

    // Show any runtime error on screen so it can be reported, and
    // log it to the DevTools console for full detail.
    drawError(err) {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(25, 8, 8, 0.94)";
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.fillStyle = "#ffb3a3";
      ctx.font = "14px Consolas, monospace";
      ctx.textAlign = "left";
      let y = 34;
      const line = (txt) => {
        if (y > this.H - 8) return;
        ctx.fillText((txt || "").slice(0, 130), 22, y);
        y += 18;
      };
      line("GAME ERROR - copy this to the console report:");
      line("  " + err.message);
      (err.stack || err.toString() || "").split("\n").slice(0, 9).forEach((s) => line(s.trim()));
      if (console && console.error) console.error("EcoDash error:", err);
    }

    /* ==================== mission setup ==================== */

    newMission() {
      this.drone = new EC.Drone({ worldX: 600, y: 250 });
      // Match the camera to the drone at spawn.
      this.cameraX = Math.max(0, this.drone.worldX - 320);

      this.obstacles = [];
      this.solarZones = [];
      this.loadZones = [];
      this.storms = [];
      this.activeDelivery = null;
      this.deliveredCount = 0;

      this.missionScore = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.distancePx = 0;
      this.distanceKm = 0;
      this.batteryUsed = 0;
      this.missionTime = 0;

      this.spawnNextX = this.cameraX + this.W * 0.8;
      this.spawnCount = 0;

      this.gameOverReason = null;
      this.newHighRank = -1;
      this.shake = 0;
      this.lowBeepTick = 0;
      this.inSolar = false;
      this.inLoad = false;
      this.inStorm = false;

      this.particles.clear();
      this.hud.toasts.length = 0;
      this.world.trucks.length = 0;
      this.weather.strength = 0.3;
    }

    startMission() {
      this.newMission();
      this.state = "playing";
      EC.Audio.unlock();
      EC.Audio.playClick();
      this.refreshOverlays();
    }

    /* ==================== updates ==================== */

    updateMenu(dt) {
      this.time += dt;
      this.celestial.update(dt);
      this.weather.update(dt, this.time);
      // Gentle auto-scroll so the menu scene feels alive.
      this.cameraX += 7 * dt;
      this.world.ensureTo(this.cameraX + this.W + 900);
      this.world.update(dt);
    }

    difficulty() {
      return Math.min(1, this.distanceKm / 30);
    }

    updatePlaying(dt) {
      this.time += dt;
      this.missionTime += dt;
      const d = this.drone;

      // ---- ambient systems ----
      this.celestial.update(dt);
      this.weather.update(dt, this.time);
      this.world.update(dt);
      this.world.ensureTo(this.cameraX + this.W + 900);
      this.particles.update(dt);

      // ---- which zones is the drone inside? ----
      let insideSolar = false, insideLoad = false, insideStorm = false;
      for (const z of this.solarZones) if (z.contains(d.worldX, d.y)) insideSolar = true;
      for (const z of this.loadZones) { z.update(dt); if (z.contains(d.worldX, d.y)) insideLoad = true; }
      for (const s of this.storms) { s.update(dt); if (s.contains(d.worldX, d.y)) insideStorm = true; }
      this.inSolar = insideSolar;
      this.inLoad = insideLoad;
      this.inStorm = insideStorm;

      // ---- drone physics + storm turbulence ----
      d.update(dt, EC.Input, this.weather);
      if (insideStorm) {
        // Turbulence: buffets the drone with sine-shaped gusts.
        d.vy += Math.sin(this.time * 8.0) * 85 * dt;
        d.vx += Math.cos(this.time * 6.3) * 55 * dt;
      }

      // ---- camera follows the drone smoothly ----
      const targetCam = d.worldX - 320;
      this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 4.5);
      this.cameraX = Math.max(0, this.cameraX);

      // ---- SCORING: distance + passive trickle ----
      this.distancePx += Math.max(0, d.vx) * dt;
      this.distanceKm = this.distancePx / 50;
      this.missionScore += Math.max(0, d.vx) * dt * 0.02;
      this.difficulty(); // updates internal ramp (kept simple)

      // ---- combo timer ----
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }

      // ---- battery / solar reserve accounting ----
      let drain = 0.85;                    // idle autopilot draw %/s
      drain += d.throttle * 1.4;           // engine burns reserve
      drain += this.weather.strength01 * 0.6; // fighting wind costs more
      if (insideStorm) drain += 1.7;       // storm cell: heavy drain
      const recharge = insideSolar && !insideLoad ? 7.0 : 0.0;

      d.addBattery((recharge - drain) * dt);
      this.batteryUsed += drain * dt;

      // Recharge sparkles + sound.
      if (recharge > 0 && Math.random() < 0.35) {
        this.particles.sparkle(d.worldX, d.y, 1);
        if (Math.random() < 0.02) EC.Audio.playCharge();
      }

      // Low-battery warning beep (once per ~1.6s).
      if (d.battery > 0 && d.battery <= 25) {
        this.lowBeepTick -= dt;
        if (this.lowBeepTick <= 0) {
          EC.Audio.playAlert();
          this.lowBeepTick = 1.6;
        }
      }

      // Engine & wind sound levels follow the situation.
      EC.Audio.setHover(d.throttle);
      EC.Audio.setWind(this.weather.strength01 + (insideStorm ? 0.4 : 0));

      // ---- ambient wind-blown leaves ----
      if (Math.random() < this.weather.strength01 * 0.05) {
        this.particles.leaves(this.cameraX + this.W + 20, U.rand(100, 420), 1, this.weather.strength01);
      }

      // ---- spawn new content ahead of the camera ----
      this.ensureSpawning();
      this.ensureDelivery();

      // ---- keep obstacles animating (birds fly, trees sway) ----
      for (const ob of this.obstacles) ob.update(dt, this.time);

      // ---- DEGRADE: flying the drone into the ground ----
      if (d.y > GROUND_Y - 15) {
        this.groundHit();
        if (this.state !== "playing") return;
      }

      // ---- colliding with obstacles & near-miss scoring ----
      this.updateCollisions(dt);
      if (this.state !== "playing") return;

      // ---- cleanup: remove anything far behind the camera ----
      this.obstacles = this.obstacles.filter((o) => o.rightEdge() > this.cameraX - 500);
      this.solarZones = this.solarZones.filter((z) => z.rightEdge() > this.cameraX - 500);
      this.loadZones = this.loadZones.filter((z) => z.rightEdge() > this.cameraX - 500);
      this.storms = this.storms.filter((s) => s.rightEdge() > this.cameraX - 500);

      // ---- delivery pickup ----
      if (this.activeDelivery && this.activeDelivery.take(d)) {
        this.completeDelivery();
      }

      // ---- death by battery ----
      if (d.battery <= 0) {
        this.endGame("SOLAR RESERVE DEPLETED - mission over");
        return;
      }

      this.hud.update(dt);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 18);
    }

    /* ==================== collisions ==================== */

    updateCollisions(dt) {
      const d = this.drone;
      for (const ob of this.obstacles) {
        let hit = false;
        for (const c of ob.colliders()) {
          if (c.kind === "circle" && EC.Obstacle.circleHits(d, c)) hit = true;
          else if (c.kind === "rect" && EC.Obstacle.rectHits(d, c)) hit = true;
        }

        if (hit && d.flashTimer <= 0) {
          this.hitObstacle(ob);
        } else if (!ob.passed && ob.rightEdge() < d.worldX - 10) {
          // The obstacle has sailed past without being hit.
          ob.passed = true;
          if (ob.near) this.recordNearMiss(ob);
        }

        // Remember close approaches for the near-miss bonus.
        if (!ob.passed && !ob.near) {
          const ep = ob.epicenter();
          if (U.dist(d.worldX, d.y, ep.x, ep.y) < 128) ob.near = true;
        }
      }
    }

    hitObstacle(ob) {
      const d = this.drone;
      EC.Audio.playBump(ob.damage >= 20);
      this.particles.sparks(d.worldX, d.y, 14);
      this.particles.dust(d.worldX, d.y + 4, 6);

      const epic = ob.epicenter();
      d.knockback(epic.x, epic.y, ob.damage >= 20 ? 200 : 130);
      d.addBattery(-5);
      d.startFlash(0.75);
      this.combo = 0;
      this.comboTimer = 0;
      this.shake = 10;
      this.hud.addToast("COLLISION!", "-" + ob.damage + " HULL", "#ff8a70");

      if (d.damage(ob.damage)) {
        this.endGame("CRASHED INTO " + ob.type.toUpperCase());
      }
    }

    groundHit() {
      const d = this.drone;
      d.y = GROUND_Y - 15;
      d.vy = -150;               // bounce upward
      d.vx *= 0.6;               // scrub forward speed
      EC.Audio.playBump(false);
      this.particles.dust(d.worldX, GROUND_Y, 14, 1.4);
      d.addBattery(-3);
      d.startFlash(0.8);
      this.combo = 0;
      this.comboTimer = 0;
      this.shake = 8;
      this.hud.addToast("GROUND SCRAPE", "-14 HULL", "#ffb3a3");

      // Bonus drama: a little restart of the rotor (just cosmetic).
      if (d.damage(14)) this.endGame("GROUND CRASH");
    }

    recordNearMiss(ob) {
      this.missionScore += 10;
      EC.Audio.playNearMiss();
      this.hud.addToast("CLOSE PASS", "+10", "#9adcff");
    }

    /* ==================== spawning ==================== */

    ensureSpawning() {
      const edge = this.cameraX + this.W + 620;
      while (this.spawnNextX < edge) {
        this.spawnFeature(this.spawnNextX);
        // Gaps shrink slowly as difficulty rises -> more pressure.
        this.spawnNextX += U.rand(620, 1040) * (1 - this.difficulty() * 0.35);
      }
    }

    spawnFeature(x) {
      const roll = Math.random();

      if (roll < 0.15) {
        // Storm cell.
        this.storms.push(new EC.StormCell(x, 175, 235));
      } else if (roll < 0.28) {
        // Load-shedding zone (either alone, or wrapped over a solar zone).
        const lz = new EC.LoadShedZone(x, 235, 210, GROUND_Y);
        this.loadZones.push(lz);
      } else if (roll < 0.5) {
        // Solar microgrid zone (sometimes partially load-shed).
        const sz = new EC.SolarZone(x, 230, 175, GROUND_Y);
        this.solarZones.push(sz);
        if (Math.random() < 0.25) {
          this.loadZones.push(new EC.LoadShedZone(x + U.rand(-140, 140), 235, 200, GROUND_Y));
        }
      } else if (roll < 0.8) {
        // Obstacle cluster (1-2 solid obstacles).
        const count = Math.random() < 0.35 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const kind = this.pickObstacleKind();
          const px = x + i * U.rand(90, 170);
          this.obstacles.push(EC.Obstacle.create(kind, px, GROUND_Y, this.difficulty()));
        }
      }
      // else: nothing - a gap lets the player breathe.
    }

    pickObstacleKind() {
      const diff = this.difficulty();
      const r = Math.random();
      if (diff < 0.1) return "tree";                // early: mostly trees
      if (r < 0.5) return "tree";
      if (r < 0.8) return "bird";
      return "tower";
    }

    // Keep one glowing delivery beacon alive at a village up ahead.
    ensureDelivery() {
      if (this.activeDelivery) return;
      let target = null;
      for (const v of this.world.villages) {
        if (v.delivered) continue;
        if (v.x < this.cameraX + this.W * 0.35) continue;
        target = v;
        break; // villages are generated in order, so first = nearest
      }
      if (target) {
        this.activeDelivery = new EC.DeliveryBeacon(target.x, 320, GROUND_Y);
        this.activeDelivery.village = target;
      }
    }

    completeDelivery() {
      const b = this.activeDelivery;
      this.deliveredCount += 1;
      const pts = Math.round(250 * (1 + this.combo * 0.5));
      this.missionScore += pts;
      this.combo += 1;
      this.comboTimer = 8;
      this.drone.addBattery(12); // community solar reward
      if (b.village) b.village.delivered = true;

      EC.Audio.playChime();
      this.particles.confetti(b.x, b.y, 34);
      this.hud.addToast("PARCEL DELIVERED", b.cargo + "  +" + pts, "#7dff9a");
      this.activeDelivery = null;
    }

    /* ==================== game over ==================== */

    endGame(reason) {
      this.state = "gameover";
      this.gameOverReason = reason;
      EC.Audio.stopHover();
      EC.Input.releaseAll();

      // ---- energy efficiency grade ----
      // deliveries achieved per full 100% of solar reserve spent.
      const drain = Math.max(0.0001, this.batteryUsed);
      const effort = this.deliveredCount / (drain / 100);
      const grade = effort >= 5 ? "A+" : effort >= 3.5 ? "A" : effort >= 2 ? "B"
                 : effort >= 1 ? "C" : "D";

      const entry = {
        score: Math.round(this.missionScore),
        distanceKm: this.distanceKm,
        deliveries: this.deliveredCount,
        grade: grade
      };
      const saved = EC.Storage.addScore(entry);
      this.newHighRank = saved.rank;

      this.renderGameOverUI(entry, grade, saved.list);
      this.refreshOverlays(); // make the game-over screen VISIBLE
    }

    renderGameOverUI(entry, grade, list) {
      const $ = (id) => document.getElementById(id);
      $("go-reason").textContent = this.gameOverReason;
      $("go-score").textContent = entry.score;
      $("go-km").textContent = entry.distanceKm.toFixed(1) + " km";
      $("go-deliveries").textContent = entry.deliveries;
      $("go-grade").textContent = grade;

      const newHigh = this.newHighRank === 0;
      $("go-new-high").classList.toggle("hidden", !newHigh);

      const ol = $("go-highscore-list");
      ol.innerHTML = "";
      list.forEach((item, idx) => {
        const label = item.label ||
          item.distanceKm.toFixed(2) + " km · " + item.deliveries + " parcels · " +
          item.grade + " · " + (item.date || "");
        const li = document.createElement("li");
        li.innerHTML = "<span>" + (idx + 1) + ". " + item.score + " pts</span>" +
                       "<span>" + label + "</span>";
        if (idx === this.newHighRank) li.classList.add("new-entry");
        ol.appendChild(li);
      });
    }

    refreshScores() {
      const list = EC.Storage.renderScores(EC.Storage.loadScores());
      const ol = document.getElementById("highscore-list");
      if (list.length === 0) {
        ol.innerHTML = '<li class="empty">No missions recorded yet</li>';
        return;
      }
      ol.innerHTML = "";
      list.forEach((item, idx) => {
        const li = document.createElement("li");
        li.innerHTML = "<span>" + (idx + 1) + ". " + item.score + " pts</span><span>" + item.label + "</span>";
        ol.appendChild(li);
      });
    }

    refreshOverlays() {
      const $ = (id) => document.getElementById(id);
      $("menu-screen").classList.toggle("hidden", this.state !== "menu");
      $("pause-screen").classList.toggle("hidden", this.state !== "paused");
      $("gameover-screen").classList.toggle("hidden", this.state !== "gameover");
      document.getElementById("btn-pause").style.visibility =
        this.state === "playing" || this.state === "paused" ? "visible" : "hidden";
      if (this.state === "menu") this.refreshScores();
    }

    pause() {
      if (this.state !== "playing") return;
      this.state = "paused";
      EC.Input.releaseAll();
      EC.Audio.stopHover();
      this.refreshOverlays();
    }

    resume() {
      if (this.state !== "paused") return;
      this.state = "playing";
      EC.Audio.unlock();
      this.refreshOverlays();
    }

    toMenu() {
      this.state = "menu";
      this.drone = null;
      EC.Input.releaseAll();
      EC.Audio.stopHover();
      this.refreshOverlays();
    }

    restart() {
      EC.Audio.unlock();
      this.newMission();
      this.state = "playing";
      this.refreshOverlays();
    }

    toggleMute() {
      const muted = !EC.Audio.isMuted();
      EC.Audio.setMuted(muted);
      document.getElementById("mute-label").textContent = muted ? "Sound Off" : "Sound On";
    }

    /* ==================== UI wiring ==================== */

    bindUI() {
      const $ = (id) => document.getElementById(id);
      $("btn-start").addEventListener("click", () => this.startMission());
      $("btn-resume").addEventListener("click", () => this.resume());
      $("btn-retry").addEventListener("click", () => this.restart());
      $("btn-go-menu").addEventListener("click", () => this.toMenu());
      $("btn-pause-restart").addEventListener("click", () => this.restart());
      $("btn-pause-menu").addEventListener("click", () => this.toMenu());
      $("btn-pause").addEventListener("click", () =>
        this.state === "playing" ? this.pause() : this.resume());
      $("btn-mute").addEventListener("click", () => this.toggleMute());

      // First user gesture anywhere unlocks WebAudio.
      const unlockOnce = () => {
        EC.Audio.unlock();
        this.canvas.removeEventListener("click", unlockOnce);
      };
      this.canvas.addEventListener("click", unlockOnce);
    }

    setupKeyboard() {
      EC.Input.on("anykey", () => EC.Audio.unlock());

      EC.Input.on("control", (code) => {
        if (code === "Enter") {
          if (this.state === "menu") this.startMission();
          else if (this.state === "gameover") this.restart();
          else if (this.state === "paused") this.resume();
        } else if (code === "KeyP" || code === "Escape") {
          if (this.state === "playing") this.pause();
          else if (this.state === "paused") this.resume();
        } else if (code === "KeyM") {
          this.toggleMute();
        }
      });
    }

    setupTouch() {
      const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      if (!isTouch) return;
      document.body.classList.add("touch");

      const hold = (btn, on) => {
        const action = btn.dataset.action;
        EC.Input.setVirtual(action, on);
        btn.classList.toggle("pressed", on);
      };
      document.querySelectorAll(".touch-btn").forEach((btn) => {
        btn.addEventListener("pointerdown", (e) => { e.preventDefault(); hold(btn, true); });
        btn.addEventListener("pointerup", (e) => { e.preventDefault(); hold(btn, false); });
        btn.addEventListener("pointercancel", () => hold(btn, false));
        btn.addEventListener("pointerleave", () => hold(btn, false));
      });
    }

    /* ==================== drawing ==================== */

    draw(dt) {
      const ctx = this.ctx;
      const nf = EC.Celestial.nightFactor;

      // ---- 1) sky (day/night cycle) ----
      EC.Celestial.render(ctx, this.W, this.H, GROUND_Y);

      // ---- 2) world + gameplay ----
      ctx.save();
      if (this.shake > 0) {
        ctx.translate(U.rand(-this.shake, this.shake) * 0.5, U.rand(-this.shake, this.shake) * 0.5);
      }

      this.world.draw(ctx, this.cameraX, this.W, this.H);

      // Solar zones (red = grid down because of load-shedding).
      for (const z of this.solarZones) {
        const disabled = this.loadZones.some((lz) => lz.contains(z.x, z.y));
        z.draw(ctx, this.cameraX, nf, this.time, disabled);
      }
      for (const z of this.loadZones) z.draw(ctx, this.cameraX, nf, this.time);
      for (const s of this.storms) s.draw(ctx, this.cameraX, nf, this.time);

      if (this.activeDelivery) {
        this.activeDelivery.draw(ctx, this.cameraX, nf, this.time, false);
      }

      for (const ob of this.obstacles) {
        const sx = ob.x - this.cameraX;
        if (sx > -320 && sx < this.W + 320) ob.draw(ctx, this.cameraX, nf, this.time);
      }

      if (this.drone) this.drone.draw(ctx, this.cameraX, nf);

      this.particles.render(ctx, this.cameraX);
      EC.Weather.render(ctx, this.W, this.H, this.time);

      ctx.restore();

      // ---- 3) HUD on top of everything ----
      if (this.drone) this.hud.draw(ctx, this);

      // ---- 4) cinematic vignette + danger pulses ----
      this.drawVignette(nf);
    }

    drawVignette(nf) {
      const ctx = this.ctx;
      const v = ctx.createRadialGradient(480, 270, 200, 480, 270, 560);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, this.W, this.H);

      // Red pulse when the hull is nearly gone.
      const d = this.drone;
      if (d && d.integrity < 30 && this.state === "playing") {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
        const g = ctx.createRadialGradient(480, 270, 150, 480, 270, 560);
        g.addColorStop(0, "rgba(200,40,30,0)");
        g.addColorStop(1, "rgba(200,40,30," + (0.28 * pulse).toFixed(3) + ")");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
      } else if (d && d.battery < 25 && this.state === "playing") {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
        const g = ctx.createRadialGradient(480, 270, 150, 480, 270, 560);
        g.addColorStop(0, "rgba(230,170,60,0)");
        g.addColorStop(1, "rgba(230,170,60," + (0.18 * pulse).toFixed(3) + ")");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
      }
    }
  }

  EC.Game = Game;
})();