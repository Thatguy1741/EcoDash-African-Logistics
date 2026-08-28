/* ============================================================
   EcoDash - drone.js
   ------------------------------------------------------------
   THE PLAYER - a solar-powered delivery drone.

   This is where most of the "physics" lives:
     - thrust is applied along the drone's NOSE ANGLE using
       trigonometry:  ax = cos(heading) * thrust
                       ay = sin(heading) * thrust
     - GRAVITY always pulls down
     - a hover lift counteracts gravity (so the drone can float)
     - DRAG damps the velocity exponentially  v *= e^(-drag*dt)
       (this is what makes movement feel smooth, not twitchy)
     - the WIND (from weather.js) pushes the drone sideways
     - pressing brake adds a big extra drag ("parachute")
     - the SOLAR RESERVE (battery) depletes under load and is
       recharged inside solar microgrid zones (handled in game.js)

   Object Oriented Programming: everything about the drone -
   its position, velocity, angle, battery, integrity, drawing -
   is encapsulated in this one class.

   Exposed as:  new EC.Drone(...)
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});
  const U = EC.Utils;

  // Tuning constants (px, seconds, radians).
  const GRAVITY = 170;       // downward pull  px/s^2
  const HOVER_LIFT = 205;    // lift that fights gravity px/s^2
  const THRUST = 520;        // max engine thrust along the nose
  const ROTATE_SPEED = 2.8;  // radians per second
  const DRAG = 0.42;         // base exponential damping 1/s
  const BRAKE_DRAG = 2.6;    // extra damping while braking
  const MAX_SPEED = 360;     // terminal speed px/s
  const TOP_CLAMP = 26;      // how high the drone may climb

  class Drone {
    constructor(opts) {
      opts = opts || {};
      this.worldX = opts.worldX || 600;   // x in WORLD space
      this.y = opts.y || 250;             // y on screen (camera is vertical-fixed)
      this.vx = 130;                      // start cruising forward
      this.vy = 0;
      this.heading = 0;                   // radians, 0 = facing right
      this.visualTilt = 0;                // smoothed angle used for drawing
      this.size = 14;                     // collision radius (px)

      // Resources -------------------------------------------------
      this.battery = 100;                 // "Solar Reserve" 0..100 %
      this.integrity = 100;               // hull strength 0..100

      // Effects ----------------------------------------------------
      this.time = 0;
      this.flashTimer = 0;                // invulnerability blink countdown
      this.throttle = 0;                  // smoothed 0..1 throttle ratio
    }

    /* ==================== physics update ==================== */

    update(dt, input, wind) {
      this.time += dt;
      if (this.flashTimer > 0) this.flashTimer -= dt;

      // --- 1) inputs: rotate the nose ----------------------------
      if (input.isAction("left")) this.heading -= ROTATE_SPEED * dt;
      if (input.isAction("right")) this.heading += ROTATE_SPEED * dt;

      // --- 2) throttle ramps smoothly (no instant jumps) ----------
      const targetThrottle = input.isAction("throttle") ? 1 : 0;
      this.throttle = U.lerp(this.throttle, targetThrottle, Math.min(1, dt * 6));

      // --- 3) acceleration vector --------------------------------
      // Thrust is split into an X and a Y part using cos & sin.
      let ax = Math.cos(this.heading) * THRUST * this.throttle;
      let ay = Math.sin(this.heading) * THRUST * this.throttle;

      // Gravity and hover lift (throttle also adds a bit of lift).
      ay += GRAVITY;
      ay -= HOVER_LIFT * (1 + 0.4 * this.throttle);

      // Wind pushes us around.
      ax += wind.windX();
      ay += wind.windY();

      // --- 4) drag (damping) -------------------------------------
      const drag = input.isAction("brake") ? DRAG + BRAKE_DRAG : DRAG;
      this.vx *= Math.exp(-drag * dt);
      this.vy *= Math.exp(-drag * 0.85 * dt);

      // --- 5) integrate: velocity += accel*dt, pos += vel*dt -----
      this.vx += ax * dt;
      this.vy += ay * dt;

      // --- 6) terminal velocity clamp ----------------------------
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > MAX_SPEED) {
        this.vx *= MAX_SPEED / speed;
        this.vy *= MAX_SPEED / speed;
      }

      this.worldX += this.vx * dt;
      this.y += this.vy * dt;

      // --- 7) keep the drone inside the top of the screen --------
      if (this.y < TOP_CLAMP + this.size) {
        this.y = TOP_CLAMP + this.size;
        this.vy = Math.abs(this.vy) * 0.3; // soft bounce off the ceiling
      }

      // --- 8) smoothing for the visible tilt ----------------------
      this.visualTilt = U.lerpAngle(this.visualTilt, this.heading, Math.min(1, dt * 6));
    }

    /* ==================== resource helpers ==================== */

    // Add (or subtract) battery percentage points.
    addBattery(delta) {
      this.battery = U.clamp(this.battery + delta, 0, 100);
    }

    // Apply hull damage; returns true if the drone is "destroyed".
    damage(amount) {
      this.integrity = U.clamp(this.integrity - amount, 0, 100);
      return this.integrity <= 0;
    }

    // Trigger a short invulnerability blink.
    startFlash(time) {
      this.flashTimer = time || 0.7;
    }

    // Knock the drone back away from a collision point.
    knockback(fromX, fromY, strength) {
      const angle = Math.atan2(this.y - fromY, this.worldX - fromX);
      this.vx += Math.cos(angle) * strength;
      this.vy += Math.sin(angle) * strength - 60;
    }

    /* ==================== drawing ==================== */

    draw(ctx, camX, nightFactor) {
      // Blink while invulnerable (alternates every ~0.08s).
      if (this.flashTimer > 0 && Math.floor(this.time * 24) % 2 === 0) return;

      const sx = this.worldX - camX;
      const hover = Math.sin(this.time * 2.2) * 1.6; // gentle idle bobbing
      const tilt = this.visualTilt;

      ctx.save();
      ctx.translate(sx, this.y + hover);
      ctx.rotate(tilt);

      // Subtle shadow cast on the ground (world position varies).
      ctx.save();
      ctx.rotate(-tilt);
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.ellipse(3, 150, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* --- rotor blades (spinning propellers) ------------------- */
      const spin = this.time * 42;
      ctx.save();
      ctx.translate(-4, -14);
      ctx.rotate(spin);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "#efe3c2";
      ctx.beginPath();
      ctx.ellipse(11, 0, 11, 2.6, 0, 0, Math.PI * 2);
      ctx.ellipse(-11, 0, 11, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* --- body -------------------------------------------------- */
      // Fuselage (rounded "pod").
      ctx.fillStyle = "#efe3c2";
      ctx.beginPath();
      ctx.roundRect(-16, -11, 34, 20, 8);
      ctx.fill();

      // Cabin glass (tinted).
      ctx.fillStyle = "rgba(90, 160, 200, 0.9)";
      ctx.beginPath();
      ctx.roundRect(0, -9, 12, 16, 5);
      ctx.fill();

      // Solar wings - the panels that recharge us in the sun!
      const wingGrad = ctx.createLinearGradient(0, 0, 0, 10);
      wingGrad.addColorStop(0, "#ffd76a");
      wingGrad.addColorStop(1, "#e8a94c");
      ctx.fillStyle = wingGrad;
      ctx.beginPath();
      ctx.roundRect(2, -16, 34, 4, 2);   // top-left panel
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(2, 12, 34, 4, 2);    // bottom-left panel
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-20, -13, 4, 26, 2); // side panel
      ctx.fill();

      // Tail.
      ctx.fillStyle = "#d95d39";
      ctx.beginPath();
      ctx.moveTo(-14, -4);
      ctx.lineTo(-26, -8);
      ctx.lineTo(-26, 2);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();

      // Small status LED on top (green when charged, red when dead).
      ctx.fillStyle = this.battery > 20 ? "#5ed47e" : "#ff5a4a";
      ctx.beginPath();
      ctx.arc(-4, -12, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      /* --- headlight at night (drawn outside the rotation) ------- */
      if (nightFactor > 0.35) {
        const beam = ctx.createLinearGradient(sx + 12, this.y, sx + 90, this.y);
        beam.addColorStop(0, "rgba(255, 230, 150, " + (0.4 * nightFactor).toFixed(2) + ")");
        beam.addColorStop(1, "rgba(255, 230, 150, 0)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(sx + 14, this.y - 5);
        ctx.lineTo(sx + 95, this.y - 16);
        ctx.lineTo(sx + 95, this.y + 16);
        ctx.lineTo(sx + 14, this.y + 5);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  EC.Drone = Drone;
})();