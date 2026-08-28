/* ============================================================
   EcoDash - utils.js
   ------------------------------------------------------------
   Small mathematics + random-number helpers used all over the
   game. Keeping them in ONE file means the rest of the code stays
   clean, and it also demonstrates the "mathematical calculations"
   the assignment asks for (clamping, lerping, seeded random etc).

   Exposed as:  EC.Utils
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});

  const Utils = {

    /* ---- basic math ---- */

    // Keep a number between min and max.
    clamp(value, min, max) {
      return value < min ? min : value > max ? max : value;
    },

    // Linear interpolation between a and b using t (0..1).
    // Used everywhere for smooth transitions (tweens).
    lerp(a, b, t) {
      return a + (b - a) * t;
    },

    // Angle-aware version of lerp: interpolates through the SHORTEST
    // arc so angles don't spin the long way around (Math.PI*2 issue).
    lerpAngle(a, b, t) {
      let delta = (b - a) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      return a + delta * t;
    },

    // Euclidean distance between two points (Pythagoras).
    dist(x1, y1, x2, y2) {
      return Math.hypot(x2 - x1, y2 - y1);
    },

    /* ---- random numbers ----
       Math.random() is fine for most gameplay. We also keep a
       SEEDED generator (mulberry32) below so the terrain is built
       the same way every run - great for consistency.            */

    rand(min, max) {
      return min + Math.random() * (max - min);
    },

    randInt(min, max) {
      return Math.floor(Utils.rand(min, max + 1));
    },

    choice(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },

    // Deterministic pseudo-random generator (seeds map to worlds).
    mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    /* ---- colour helpers ----
       We describe colours as objects { r, g, b } so we can lerp and
       darken them mathematically, then convert to "rgb(...)" for the
       canvas. This powers the day/night cycle and the night dimming. */

    cssColour(c) {
      return "rgb(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + ")";
    },

    // Blend two {r,g,b} colours together (t 0..1).
    mixColour(c1, c2, t) {
      return {
        r: Utils.lerp(c1.r, c2.r, t),
        g: Utils.lerp(c1.g, c2.g, t),
        b: Utils.lerp(c1.b, c2.b, t)
      };
    },

    // Darken / brighten one {r,g,b} colour by an ambient factor
    // (1 = full colour, 0 = black). Used to dim the world at night.
    shadeColour(c, factor) {
      const f = Utils.clamp(factor, 0, 1);
      return {
        r: c.r * f,
        g: c.g * f,
        b: c.b * f
      };
    },

    /* ---- easing ----
       These are the "tween" functions that power the smoothness.
       They come from the 12 principles of animation (easing = the
       idea that things accelerate and decelerate naturally instead
       of moving at constant speed).                                  */

    easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    },

    easeInOutQuad(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
  };

  // Small compatibility shim: roundRect() only exists in newer
  // browsers, so we add it ourselves if it is missing.
  if (typeof CanvasRenderingContext2D !== "undefined" &&
      !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  EC.Utils = Utils;
})();