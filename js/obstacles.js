/* ============================================================
   EcoDash - obstacles.js
   ------------------------------------------------------------
   Everything the drone must dodge or use:
     * AIR & GROUND OBSTACLES (Task 2.2)
         - Acacia trees      (fly over or clip the canopy)
         - Telecom towers    (tall, smash into the lattice)
         - Bird flocks       (wildlife crossing the sky)
     * ENVIRONMENTAL ZONES
         - StormCell         rain + turbulence (drains battery)
         - SolarZone         "solar microgrid" - RECHARGES you
         - LoadShedZone      turns charging OFF (SA reality!)
     * DeliveryBeacon       glowing parcel target at each village

   COLLISION DETECTION is done with TWO shapes per obstacle:
       { kind: "circle", x, y, r }
       { kind: "rect",   x, y, w, h }   (an AABB)
   each returned by colliders(). The Game compares these against
   the drone's position/radius each frame. Using circles for the
   canopy and an AABB for the tower trunk is realistic and cheap.

   Everything is drawn in WORLD space; draw() subtracts camX.

   Exposed:  EC.Obstacle (factory + collision helpers),
             EC.SolarZone, EC.LoadShedZone, EC.StormCell,
             EC.DeliveryBeacon
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});
  const U = EC.Utils;

  /* =================== collision math helpers =================== */

  // Circle vs circle: distance between centres < sum of radii.
  function circleHits(drone, c) {
    return U.dist(drone.worldX, drone.y, c.x, c.y) < drone.size + c.r;
  }

  // Circle vs AABB rectangle (find the closest point on the box to
  // the circle's centre, then measure the distance to that point).
  function rectHits(drone, r) {
    const cx = U.clamp(drone.worldX, r.x, r.x + r.w);
    const cy = U.clamp(drone.y, r.y, r.y + r.h);
    return U.dist(drone.worldX, drone.y, cx, cy) < drone.size;
  }

  /* ============================================================
     BASE OBSTACLE
     ============================================================ */
  class Obstacle {
    constructor(opts) {
      this.type = opts.type || "generic";
      this.x = opts.x;
      this.damage = opts.damage || 18;
      this.passed = false;   // has it flown past the drone yet?
      this.near = false;     // was it a CLOSE pass?
      this.dead = false;     // flag used by Game for removal
    }
    colliders() { return []; }
    leftEdge() { return this.x - 40; }
    rightEdge() { return this.x + 40; }
    // Approximate "middle" of the obstacle - used to judge close passes.
    epicenter() { return { x: this.x, y: (this.groundY || 452) - 100 }; }
    update() {}
  }

  /* ------------------------------------------------------------
     1) ACACIA TREE - wide umbrella canopy on a reachable trunk.
     All y positions are canvas coords measured down from the top,
     so everything is anchored to the ground line (this.groundY).
     ------------------------------------------------------------ */
  class TreeObstacle extends Obstacle {
    constructor(opts) {
      super(Object.assign({ type: "tree", damage: 20 }, opts));
      this.groundY = opts.groundY;
      this.canopyR = U.rand(46, 62);
      this.shed = U.rand(0, Math.PI * 2);
      this.lean = U.rand(-0.08, 0.08);
      this.canopyCy = this.groundY - 196;   // canopy centre (world y)
    }
    colliders() {
      return [
        // A circle for the leafy canopy ...
        { kind: "circle", x: this.x + this.lean * 8, y: this.canopyCy, r: this.canopyR },
        // ... and an AABB rectangle for the trunk below it.
        { kind: "rect", x: this.x - 9, y: this.groundY - 96, w: 18, h: 96 }
      ];
    }
    rightEdge() { return this.x + this.canopyR; }
    leftEdge() { return this.x - this.canopyR; }
    epicenter() { return { x: this.x, y: this.canopyCy }; }
    update(dt, time) { this.shake = Math.sin(time * 1.3 + this.shed) * 1.2; }
    draw(ctx, camX, nf) {
      const sx = this.x - camX;
      const gy = this.groundY;
      // Trunk
      ctx.fillStyle = U.cssColour(U.shadeColour({ r: 110, g: 82, b: 44 }, 1 - nf * 0.5));
      ctx.beginPath();
      ctx.roundRect(sx - 8, gy - 100, 16, 100, 4);
      ctx.fill();
      // Branches
      ctx.strokeStyle = U.cssColour(U.shadeColour({ r: 96, g: 70, b: 38 }, 1 - nf * 0.5));
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sx + 6, gy - 90);
      ctx.quadraticCurveTo(sx + 24, gy - 120, sx + 30, gy - 140);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 6, gy - 92);
      ctx.quadraticCurveTo(sx - 26, gy - 122, sx - 28, gy - 142);
      ctx.stroke();
      // Umbrella canopy (a few overlapping blobs).
      ctx.fillStyle = U.cssColour(U.shadeColour({ r: 78, g: 96, b: 40 }, 1 - nf * 0.45));
      const cy = this.canopyCy + this.shake;
      const cx = sx + this.lean * 8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.canopyR, this.canopyR * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 14, cy + 12, this.canopyR * 0.6, this.canopyR * 0.34, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 16, cy + 10, this.canopyR * 0.55, this.canopyR * 0.3, -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------
     2) TELECOM TOWER - tall lattice pylon (very common roadside).
     ------------------------------------------------------------ */
  class TowerObstacle extends Obstacle {
    constructor(opts) {
      super(Object.assign({ type: "tower", damage: 26 }, opts));
      this.groundY = opts.groundY;
      this.height = 210 + U.rand(0, 100);   // spans upward from ground
      this.width = 24;
      this.topY = this.groundY - this.height;
    }
    colliders() {
      return [{
        kind: "rect",
        x: this.x - this.width / 2,
        y: this.topY,
        w: this.width,
        h: this.height
      }];
    }
    rightEdge() { return this.x + this.width / 2; }
    leftEdge() { return this.x - this.width / 2; }
    epicenter() { return { x: this.x, y: this.topY + 30 }; }
    draw(ctx, camX, nf, time) {
      const sx = this.x - camX;
      const gy = this.groundY;
      const leg = U.cssColour(U.shadeColour({ r: 96, g: 100, b: 110 }, 1 - nf * 0.5));
      ctx.strokeStyle = leg;
      ctx.lineWidth = 3;

      // Two legs + cross-bracing between the top and the ground.
      for (let i = this.topY; i < gy; i += 22) {
        ctx.beginPath();
        ctx.moveTo(sx - this.width / 2, i);
        ctx.lineTo(sx + this.width / 2, i - 8);
        ctx.moveTo(sx + this.width / 2, i);
        ctx.lineTo(sx - this.width / 2, i - 8);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(sx - this.width / 2, gy);
      ctx.lineTo(sx - this.width / 2, this.topY);
      ctx.moveTo(sx + this.width / 2, gy);
      ctx.lineTo(sx + this.width / 2, this.topY);
      ctx.stroke();

      // Antenna dish.
      ctx.fillStyle = U.cssColour(U.shadeColour({ r: 160, g: 166, b: 176 }, 1 - nf * 0.5));
      ctx.beginPath();
      ctx.arc(sx, this.topY + 8, 7, 0, Math.PI * 2);
      ctx.fill();

      // Blinking aviation beacon - the classic navigation aid.
      const blink = Math.sin(time * 3.2) > 0.3;
      ctx.fillStyle = blink ? "rgba(255,60,50,0.95)" : "rgba(255,60,50,0.25)";
      ctx.beginPath();
      ctx.arc(sx, this.topY - 8, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------
     3) BIRD FLOCK - wildlife crossing the flight path.
     ------------------------------------------------------------ */
  class BirdObstacle extends Obstacle {
    constructor(opts) {
      super(Object.assign({ type: "bird", damage: 12 }, opts));
      this.count = Math.floor(3 + Math.random() * 4);
      this.spread = 18;
      this.vx = (Math.random() < 0.5 ? -1 : 1) * U.rand(28, 60); // crossing speed
      this.baseY = opts.y;
      this.bobPhase = U.rand(0, Math.PI * 2);
    }
    colliders() {
      const out = [];
      for (let i = 0; i < this.count; i++) {
        out.push({ kind: "circle", x: this.x + i * this.spread, y: this.birdY(i), r: 10 });
      }
      return out;
    }
    birdY(i) {
      return this.baseY + Math.sin(this.time * 2.4 + this.bobPhase + i * 0.7) * 10;
    }
    rightEdge() { return this.x + this.count * this.spread + 10; }
    leftEdge() { return this.x - 10; }
    epicenter() { return { x: this.x, y: this.baseY }; }
    update(dt, time) {
      this.time = time;
      this.x += this.vx * dt;
    }
    draw(ctx, camX, nf) {
      const flap = Math.sin(this.time * 14);
      ctx.fillStyle = U.cssColour(U.shadeColour({ r: 40, g: 34, b: 28 }, 1 - nf * 0.4));
      for (let i = 0; i < this.count; i++) {
        const bx = this.x - camX + i * this.spread;
        const by = this.birdY(i);
        ctx.save();
        ctx.translate(bx, by);
        ctx.beginPath();
        // Classic "V" bird silhouette with flapping wings.
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-9, -5 + flap * 5, -13, -2 + flap * 4);
        ctx.quadraticCurveTo(-6, -1, 0, 0);
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(9, -5 + flap * 5, 13, -2 + flap * 4);
        ctx.quadraticCurveTo(6, -1, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /* ============================================================
     FACTORY - pick an obstacle type, weighted by difficulty.
     "Difficulty" (0..1) makes later obstacles bigger / faster.
     ============================================================ */
  Obstacle.create = function (kind, x, groundY, difficulty, rnd) {
    const r = rnd || Math.random;
    switch (kind) {
      case "tree":
        return new TreeObstacle({ x: x, groundY: groundY });
      case "tower":
        return new TowerObstacle({ x: x, groundY: groundY });
      case "bird":
        return new BirdObstacle({ x: x, y: U.rand(90, groundY - 190), groundY: groundY });
      default:
        return new TreeObstacle({ x: x, groundY: groundY });
    }
  };

  Obstacle.circleHits = circleHits;
  Obstacle.rectHits = rectHits;

  /* ============================================================
     SOLAR MICROGRID ZONE - flies through it to RECHARGE.
     ============================================================ */
  class SolarZone {
    constructor(x, y, r, groundY) {
      this.x = x; this.y = y; this.r = r;
      this.groundY = groundY || 452;
      this.pulse = U.rand(0, Math.PI * 2);
    }
    contains(px, py) { return U.dist(this.x, this.y, px, py) < this.r; }
    rightEdge() { return this.x + this.r; }
    leftEdge() { return this.x - this.r; }

    draw(ctx, camX, nf, time, disabled) {
      const sx = this.x - camX;
      const pulse = 0.5 + 0.5 * Math.sin(time * 2 + this.pulse);

      // Flashing ring to draw the pilot's eye.
      ctx.save();
      const ringCol = disabled ? "rgba(255,80,60," : "rgba(255, 214, 130,";
      ctx.strokeStyle = ringCol + (0.35 + 0.35 * pulse).toFixed(2) + ")";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(sx, this.y, this.r * 0.92, -time * 0.4, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Soft golden dome (brighter at night so it's easy to spot).
      const glowA = 0.10 + 0.10 * nf + 0.05 * pulse;
      const g = ctx.createRadialGradient(sx, this.y, 5, sx, this.y, this.r);
      g.addColorStop(0, disabled ? "rgba(255,90,60," + glowA + ")" : "rgba(255,214,130," + glowA + ")");
      g.addColorStop(1, "rgba(255,214,130,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - this.r, this.y - this.r, this.r * 2, this.r * 2);

      // "Sun" symbol inside.
      const sunR = 16 + pulse * 4;
      ctx.fillStyle = disabled ? "rgba(255,90,60,0.9)" : "rgba(255,214,130,0.95)";
      ctx.beginPath();
      ctx.arc(sx, this.y, sunR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + time * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * (sunR + 6), this.y + Math.sin(a) * (sunR + 6));
        ctx.lineTo(sx + Math.cos(a) * (sunR + 14), this.y + Math.sin(a) * (sunR + 14));
        ctx.stroke();
      }

      // Charging pylon on the ground.
      const gy = this.groundY;
      ctx.fillStyle = disabled ? "rgba(120,60,50,0.9)" : "rgba(120, 84, 46, 0.9)";
      ctx.beginPath();
      ctx.roundRect(sx - 14, gy - 50, 28, 50, 4);
      ctx.fill();
      ctx.fillStyle = disabled ? "rgba(90,40,34,0.95)" : "rgba(232, 169, 76, 0.95)";
      ctx.beginPath();
      ctx.roundRect(sx - 22, gy - 52, 44, 9, 3);
      ctx.fill();

      // Label.
      ctx.font = "700 12px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = disabled ? "rgba(255,110,80,0.95)" : "rgba(255, 240, 200, 0.95)";
      ctx.fillText(disabled ? "GRID DOWN" : "SOLAR MICROGRID", sx, this.y + this.r + 22);
      ctx.restore();
    }
  }

  /* ============================================================
     LOAD-SHEDDING ZONE - charging stops while you're inside it.
     (Modelled on real SA scheduled blackouts.)
     ============================================================ */
  class LoadShedZone {
    constructor(x, y, r, groundY) {
      this.x = x; this.y = y; this.r = r;
      this.groundY = groundY || 452;
      this.flicker = 0;
    }
    contains(px, py) { return U.dist(this.x, this.y, px, py) < this.r; }
    rightEdge() { return this.x + this.r; }
    leftEdge() { return this.x - this.r; }
    update(dt) {
      // Random flicker timing.
      if (Math.random() < dt * 2.5) this.flicker = 1;
      this.flicker = Math.max(0, this.flicker - dt * 2);
    }
    draw(ctx, camX, nf, time) {
      const sx = this.x - camX;
      const flick = this.flicker;

      // Dark tinted disc - power is out in here.
      const tintA = (0.14 + flick * 0.2) * (0.7 + 0.3 * nf);
      ctx.fillStyle = "rgba(15, 12, 40, " + tintA.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(sx, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();

      // Intermittent red warning border.
      ctx.strokeStyle = "rgba(255,60,50," + (0.4 + flick * 0.5).toFixed(2) + ")";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(sx, this.y, this.r * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // A lone, powerless street lamp pole.
      const gy = this.groundY;
      ctx.strokeStyle = "rgba(60, 55, 70, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx - this.r * 0.5, gy);
      ctx.lineTo(sx - this.r * 0.5, gy - 110);
      ctx.lineTo(sx - this.r * 0.32, gy - 122);
      ctx.stroke();
      // Lamp head (dead, but flickers back for an instant now and then).
      ctx.fillStyle = flick > 0.5 ? "rgba(255,190,90,0.9)" : "rgba(90,84,100,0.9)";
      ctx.beginPath();
      ctx.arc(sx - this.r * 0.32, gy - 124, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "700 12px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255, 110, 80, 0.95)";
      ctx.fillText("LOAD-SHEDDING", sx, this.y + this.r + 22);
    }
  }

  /* ============================================================
     STORM CELL - rain + turbulence + battery drain. The rain
     hard to fly in. Drawn as a cloud + fast rain streaks.
     ============================================================ */
  class StormCell {
    constructor(x, y, r) {
      this.x = x; this.y = y; this.r = r;
      this.flash = 0;
      this.prep = [];
      for (let i = 0; i < 48; i++) {
        this.prep.push({ a: Math.random() * Math.PI * 2, d: Math.random() });
      }
    }
    contains(px, py) { return U.dist(this.x, this.y, px, py) < this.r; }
    rightEdge() { return this.x + this.r; }
    leftEdge() { return this.x - this.r; }
    update(dt) {
      if (Math.random() < dt * 1.2) this.flash = 0.18;
      this.flash = Math.max(0, this.flash - dt);
    }
    draw(ctx, camX, nf, time) {
      const sx = this.x - camX;

      // Cloud mass (grey puffs).
      ctx.fillStyle = "rgba(74, 76, 96, " + (0.5 + 0.2 * nf).toFixed(2) + ")";
      for (let i = 0; i < 5; i++) {
        const offX = (i - 2) * 26, offY = (i % 2) * 12 - 6;
        ctx.beginPath();
        ctx.ellipse(sx + offX, this.y - this.r * 0.34 + offY, this.r * 0.34, this.r * 0.22, i * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rain streaks streaming down.
      ctx.strokeStyle = "rgba(190, 210, 240, 0.33)";
      ctx.lineWidth = 1;
      const wrap = time * 300 % 40;
      for (let i = 0; i < 40; i++) {
        const a = this.prep[i].a, d = this.prep[i].d;
        const rx = sx + Math.cos(a) * d * this.r;
        const ry = this.y - this.r * 0.45 + Math.sin(a) * d * this.r * 0.9 + ((wrap + i * 11) % 46) - 20;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 12);
        ctx.stroke();
      }

      // Occasional lightning flash.
      if (this.flash > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, " + (this.flash * 2).toFixed(2) + ")";
        ctx.fillRect(sx - this.r, 0, this.r * 2, this.r);
        ctx.fillStyle = "rgba(255, 240, 200, 0.9)";
        ctx.beginPath();
        ctx.moveTo(sx + 10, this.y - this.r * 0.4);
        ctx.lineTo(sx - 4, this.y - this.r * 0.08);
        ctx.lineTo(sx + 6, this.y - this.r * 0.08);
        ctx.lineTo(sx - 6, this.y + this.r * 0.3);
        ctx.lineTo(sx + 8, this.y - this.r * 0.3);
        ctx.closePath();
        ctx.fill();
      }

      ctx.font = "700 12px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(220, 230, 250, 0.9)";
      ctx.fillText("STORM ZONE", sx, this.y + this.r + 16);
    }
  }

  /* ============================================================
     DELIVERY BEACON - the glowing parcel at each village.
     ============================================================ */
  class DeliveryBeacon {
    constructor(x, y, groundY) {
      this.x = x; this.y = y;
      this.groundY = groundY || 452;
      this.r = 84;                 // pickup radius
      this.radius = this.r;
      this.completed = false;
      this.born = performance.now() / 1000;
      this.cargo = U.choice(["MEDICAL SUPPLIES", "ESSENTIAL FOOD", "EMERGENCY KIT", "SCHOOL BOOKS", "SOLAR PANEL"]);
    }
    take(drone) {
      if (this.completed) return false;
      if (U.dist(drone.worldX, drone.y, this.x, this.y) < this.r + drone.size) {
        this.completed = true;
        return true;
      }
      return false;
    }
    draw(ctx, camX, nf, time, delivered) {
      const sx = this.x - camX;
      const gy = this.groundY;
      if (delivered) return;

      const bob = Math.sin(time * 2.2) * 7;
      const pulse = 0.5 + 0.5 * Math.sin(time * 3);

      // Expanding echo rings.
      for (let i = 0; i < 2; i++) {
        const phase = ((time * 0.8) + i * 0.5) % 1;
        ctx.strokeStyle = "rgba(120, 220, 140, " + ((1 - phase) * 0.5).toFixed(2) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, this.y, this.r * (0.3 + phase * 0.7) + bob * 0.1, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Glowing pillar of light reaching the parcel.
      const beam = ctx.createLinearGradient(sx, this.y - 70, sx, gy);
      beam.addColorStop(0, "rgba(120, 240, 150, " + (0.28 + pulse * 0.2).toFixed(2) + ")");
      beam.addColorStop(1, "rgba(120, 240, 150, 0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(sx - 8, this.y - 70);
      ctx.lineTo(sx - 20, gy);
      ctx.lineTo(sx + 20, gy);
      ctx.lineTo(sx + 8, this.y - 70);
      ctx.closePath();
      ctx.fill();

      // The parcel itself.
      ctx.save();
      ctx.translate(sx, this.y + bob);
      ctx.fillStyle = "#f2d08a";
      ctx.beginPath();
      ctx.roundRect(-12, -12, 24, 22, 4);
      ctx.fill();
      ctx.strokeStyle = "#c25b32";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
      ctx.moveTo(0, -12); ctx.lineTo(0, 8);
      ctx.stroke();
      ctx.restore();

      // Floating label.
      ctx.font = "800 13px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(230, 255, 220, 0.95)";
      ctx.fillText(this.cargo, sx, this.y - 46 + bob);
      ctx.font = "700 11px 'Segoe UI', sans-serif";
      ctx.fillText("FLY THROUGH TO DELIVER", sx, this.y - 30 + bob);
    }
  }

  EC.Obstacle = Obstacle;
  EC.TreeObstacle = TreeObstacle;
  EC.TowerObstacle = TowerObstacle;
  EC.BirdObstacle = BirdObstacle;
  EC.SolarZone = SolarZone;
  EC.LoadShedZone = LoadShedZone;
  EC.StormCell = StormCell;
  EC.DeliveryBeacon = DeliveryBeacon;
})();