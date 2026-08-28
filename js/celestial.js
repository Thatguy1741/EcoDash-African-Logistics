/* ============================================================
   EcoDash - celestial.js
   ------------------------------------------------------------
   ============  AI-BLIND FEATURE  ============
   THE DAY / NIGHT CYCLE
   ------------------------------------------------------------
   This module is the project's "original feature" that must be
   implemented WITHOUT Generative AI (see README + AI Reflection
   Log). It drives a complete in-game day/night cycle:
     - the sun rises, arcs across the sky and sets
     - the moon follows at night
     - stars fade in after sunset
     - the whole sky palette blends smoothly through
       night -> dawn -> day -> dusk -> night

   HOW IT WORKS (read this - you must be able to explain it):
   ------------------------------------------------------------
   1. CYCLE PHASE
      The game keeps a running clock (this.time). Dividing it by
      the cycle length and keeping the remainder gives a phase
      number from 0 to 1 that maps to a 24-hour day:
          0.00 = midnight     0.25 = sunrise
          0.50 = noon         0.75 = sunset

   2. SUN POSITION (trigonometry)
      The sun traces a semi-circle arc. We use Math.sin() to get
      its HEIGHT and Math.cos() to get its LEFT-RIGHT position:
          angle = sunriseToSunsetProgress * PI     (0..PI)
      This is exactly how you'd place a point on a circle using
      parametric equations (x = cos(a), y = sin(a)). At angle 0
      the sun sits on the horizon on the left; at the middle of
      the day the sun is directly overhead; at PI it sets on the
      right.

   3. DAYLIGHT / NIGHT FACTOR
      sin(angle) is 0 at the horizon and 1 at the top of the arc.
      We use it as our "daylight amount" (0..1). The night factor
      is simply 1 - daylight. Everything that needs dimming (world
      colours, obstacles, drone headlight, HUD) reads this value.
      The nice part: because sin is smooth, dawn and dusk fade in
      gradually instead of snapping.

   4. COLOUR BLENDING
      We store the sky colours at two extremes (bright day and
      deep night) as {r,g,b} objects and mathematicaly LERP between
      them using the daylight amount. Near sunrise/sunset we mix in
      a warm "dusk" palette to fake the golden-hour glow.

   Exposed as:  EC.Celestial
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});
  const U = EC.Utils;

  // Full day/night cycle duration in real seconds (5 minutes).
  const CYCLE_SECONDS = 300;

  // Extreme sky palettes (top, bottom) as {r,g,b} objects.
  const PAL_DAY = { top: { r: 64, g: 148, b: 216 }, bottom: { r: 178, g: 224, b: 236 } };
  const PAL_NIGHT = { top: { r: 6, g: 10, b: 34 }, bottom: { r: 22, g: 28, b: 66 } };
  const PAL_DUSK = { top: { r: 54, g: 22, b: 78 }, bottom: { r: 255, g: 122, b: 52 } };

  // Pre-computed star field (positions stored as 0..1 ratios so the
  // same stars work whatever the canvas size).
  const STARS = [];
  for (let i = 0; i < 130; i++) {
    STARS.push({
      x: Math.random(),
      y: Math.random() * 0.75,
      r: 0.4 + Math.random() * 1.1,
      twinkle: 1 + Math.random() * 3
    });
  }

  const Celestial = {
    time: 0,
    phase: 0.25,       // start just before sunrise so it feels hopeful
    nightFactor: 0,
    dayLight: 1,
    period: "DAWN",

    /* ---------- update: advance the clock ---------- */
    update(dt) {
      this.time += dt;
      this.phase = (this.time / CYCLE_SECONDS) % 1;

      // Sunrise fraction 0..1 across the daylight half of the day.
      let dayF = 0;
      if (this.phase >= 0.25 && this.phase <= 0.75) {
        dayF = (this.phase - 0.25) / 0.5;
      }

      // Sun angle: 0 at sunrise ... PI at sunset.
      const sunAngle = dayF * Math.PI;
      this.dayLight = Math.max(0, Math.sin(sunAngle)); // 0..1 height
      this.nightFactor = 1 - this.dayLight;

      // Human-readable time of day (0 hours = midnight).
      this.hourOfDay = (this.phase * 24) % 24;

      // Stripe label for the HUD.
      if (this.phase < 0.21) this.period = "NIGHT";
      else if (this.phase < 0.29) this.period = "DAWN";
      else if (this.phase < 0.71) this.period = "DAY";
      else if (this.phase < 0.79) this.period = "DUSK";
      else this.period = "NIGHT";
    },

    /* ---------- render: paint the sky, sun, moon & stars ---------- */
    render(ctx, W, H, groundY) {
      const dl = this.dayLight;
      const nf = this.nightFactor;

      /* (a) work out the sun / moon screen positions ------------- */
      let sunX = -200, sunY = -200, sunVisible = false;
      if (this.phase >= 0.25 && this.phase <= 0.75) {
        const dayF = (this.phase - 0.25) / 0.5;
        const a = dayF * Math.PI;
        sunVisible = true;
        // Parametric circle: cos gives horizontal, sin gives vertical.
        sunX = W * 0.5 - Math.cos(a) * W * 0.42;
        sunY = groundY - Math.sin(a) * groundY * 0.62;
      }

      let moonX = -200, moonY = -200, moonVisible = false;
      if (this.phase < 0.25 || this.phase > 0.75) {
        let g = this.phase < 0.25 ? (this.phase + 0.25) / 0.5 : (this.phase - 0.75) / 0.5;
        const a = g * Math.PI;
        moonVisible = true;
        moonX = W * 0.5 + Math.cos(a) * W * 0.42;
        moonY = groundY - Math.sin(a) * groundY * 0.5;
      }

      /* (b) blend the sky gradient colours ----------------------- */
      let top = U.mixColour(PAL_NIGHT.top, PAL_DAY.top, dl);
      let bottom = U.mixColour(PAL_NIGHT.bottom, PAL_DAY.bottom, dl);

      // Golden-hour glow: strongest when the sun is level with -
      // or just below - the horizon (small sin value = near horizon).
      // Only applies during daylight so midnight stays cool & dark.
      let glow = 0;
      if (sunVisible) glow = dl < 0.3 ? (0.3 - dl) / 0.3 : 0;
      top = U.mixColour(top, PAL_DUSK.top, glow * 0.8);
      bottom = U.mixColour(bottom, PAL_DUSK.bottom, glow);

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, U.cssColour(top));
      sky.addColorStop(0.72, U.cssColour(U.mixColour(top, bottom, 0.5)));
      sky.addColorStop(1, U.cssColour(bottom));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      /* (c) stars - only fade in once night arrives --------------- */
      if (nf > 0.03) {
        for (const s of STARS) {
          const tw = 0.55 + 0.45 * Math.sin(this.time * s.twinkle + s.x * 40);
          ctx.globalAlpha = nf * tw;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      /* (d) the sun ------------------------------------------------- */
      if (sunVisible) {
        // Outer glow (radial gradient that fades out).
        const glowR = 150;
        const g = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, glowR);
        g.addColorStop(0, "rgba(255, 220, 140, " + (0.55 * dl).toFixed(3) + ")");
        g.addColorStop(1, "rgba(255, 220, 140, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);

        // The disc (dimmer / more orange near the horizon).
        const disc = U.mixColour({ r: 255, g: 245, b: 200 }, { r: 255, g: 150, b: 70 }, glow);
        ctx.fillStyle = U.cssColour(disc);
        ctx.beginPath();
        ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
        ctx.fill();
      }

      /* (e) the moon -------------------------------------------------- */
      if (moonVisible) {
        ctx.save();
        const mg = ctx.createRadialGradient(moonX, moonY, 5, moonX, moonY, 110);
        mg.addColorStop(0, "rgba(210, 220, 255, 0.5)");
        mg.addColorStop(1, "rgba(210, 220, 255, 0)");
        ctx.fillStyle = mg;
        ctx.fillRect(moonX - 110, moonY - 110, 220, 220);

        ctx.fillStyle = "#e8e6df";
        ctx.beginPath();
        ctx.arc(moonX, moonY, 20, 0, Math.PI * 2);
        ctx.fill();

        // Simple craters for character.
        ctx.fillStyle = "rgba(180, 178, 170, 0.5)";
        ctx.beginPath(); ctx.arc(moonX - 6, moonY - 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(moonX + 6, moonY + 6, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      /* (f) warm horizon haze where the earth meets the sky ---------- */
      const haze = ctx.createLinearGradient(0, groundY - 90, 0, groundY);
      haze.addColorStop(0, "rgba(255, 190, 120, 0)");
      haze.addColorStop(1, "rgba(255, 190, 120, " + (0.12 + glow * 0.5).toFixed(3) + ")");
      ctx.fillStyle = haze;
      ctx.fillRect(0, groundY - 90, W, 90);
    }
  };

  EC.Celestial = Celestial;
})();