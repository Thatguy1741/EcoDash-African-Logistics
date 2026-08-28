/* ============================================================
   EcoDash - weather.js
   ------------------------------------------------------------
   GLOBAL WEATHER = the WIND system.
   Real delivery drones are pushed around by the wind. Here the
   wind strength and direction change SLOWLY over time using sine
   waves (Math.sin drives the oscillation):

       this.targetStrength = 0.5 + 0.5 * sin(time * 0.043)
                 ~ oscillates gently between 0 and 1

   The drone's physics reads windX()/windY() as an extra sideways
   ACCELERATION, so a strong crosswind makes the drone drift off
   course - the player must counter-steer. This is one of the
   "environmental conditions that influence gameplay".

   Storm cells (rain + turbulence) live in obstacles.js; the wind
   here is the ambient, always-on weather.

   Exposed as:  EC.Weather
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});
  const U = EC.Utils;

  // How strong the wind's sideways push can be (px per second^2).
  const WIND_FORCE = 95;

  // Pre-made streak lines used for the wind visualisation.
  const STREAKS = [];
  for (let i = 0; i < 26; i++) {
    STREAKS.push({
      x: Math.random(),
      y: Math.random() * 0.9 + 0.05,
      len: 20 + Math.random() * 45,
      speed: 0.5 + Math.random() * 1.2
    });
  }

  const Weather = {
    strength: 0.3,        // current effective wind (0..1)
    targetStrength: 0.3,
    angle: 0.1,           // radians; 0 = blowing from the west (rightward)
    updateTimer: 0,
    elapsed: 0,

    update(dt, totalTime) {
      this.elapsed += dt;

      // Two slow sine waves shape the wind mood (strength + shift).
      this.targetStrength = U.clamp(
        0.25 + 0.5 * (0.5 + 0.5 * Math.sin(totalTime * 0.043)),
        0,
        1
      );
      this.angle = 0.12 * Math.sin(totalTime * 0.031);

      // Smoothly glide the current strength toward the target so the
      // wind never "jumps".
      this.strength = U.lerp(this.strength, this.targetStrength, Math.min(1, dt * 0.6));
    },

    /* Wind as an ACCELERATION (px/s^2) the drone applies each frame.
       cos(angle) = horizontal push, sin(angle) = vertical push.    */
    windX() {
      return Math.cos(this.angle) * this.strength * WIND_FORCE;
    },
    windY() {
      return Math.sin(this.angle) * this.strength * WIND_FORCE * 0.5;
    },

    // Normalised 0..1 value the HUD uses for its arrow + audio gain.
    get strength01() {
      return this.strength;
    },

    /* Subtle diagonal streak lines drifting across the screen. */
    render(ctx, W, H, time) {
      if (this.strength < 0.04) return;
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, " + (this.strength * 0.16).toFixed(3) + ")";
      ctx.lineWidth = 1;

      const dx = Math.cos(this.angle);
      const dy = Math.sin(this.angle);
      for (const s of STREAKS) {
        // Wrap x so lines stream continuously right-to-left-ish.
        const drift = (time * s.speed * 26) % (W + 200);
        const x = (s.x * W + W + 200 - drift) % (W + 200) - 100;
        const y = s.y * H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - dx * s.len, y - dy * s.len);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  EC.Weather = Weather;
})();