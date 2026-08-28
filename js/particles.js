/* ============================================================
   EcoDash - particles.js
   ------------------------------------------------------------
   A lightweight particle system used for:
     - dust puffs when the drone bumps into things / touches ground
     - electric sparks when the drone hits an obstacle
     - drifting leaves in the wind ("secondary motion")
     - gold sparkles inside solar microgrid recharge zones
     - celebratory confetti on successful deliveries

   Why particles? They are textbook "secondary motion" from the
   12 principles of animation - the small reaction effects that
   follow the main action. They are drawn in WORLD space and the
   renderer subtracts the camera offset so they scroll with the
   terrain, exactly like the drone does.

   Exposed as:  new EC.ParticleSystem()
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});
  const U = EC.Utils;

  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.time = 0;
    }

    add(opts) {
      this.particles.push({
        type: opts.type || "dust",
        x: opts.x, y: opts.y,
        vx: opts.vx || 0, vy: opts.vy || 0,
        life: opts.life || 0.8,
        maxLife: opts.life || 0.8,
        size: opts.size || 3,
        color: opts.color,
        gravity: opts.gravity || 0,
        drag: opts.drag || 0.9,
        seed: Math.random() * 100  // per-particle random offset (leaf sway)
      });
    }

    /* ----- convenient burst helpers used by the Game class ----- */

    // Soft puffs of earth-coloured dust.
    dust(x, y, count, scale) {
      for (let i = 0; i < count; i++) {
        this.add({
          type: "dust",
          x: x + U.rand(-8, 8), y: y + U.rand(-6, 6),
          vx: U.rand(-60, 60), vy: U.rand(-90, -10),
          life: U.rand(0.5, 1.1),
          size: U.rand(2.5, 5) * (scale || 1),
          color: "#c8a06a",
          gravity: 60, drag: 1.8
        });
      }
    }

    // Bright electric sparks for a collision.
    sparks(x, y, count) {
      for (let i = 0; i < count; i++) {
        const a = U.rand(0, Math.PI * 2);
        const sp = U.rand(120, 320);
        this.add({
          type: "spark",
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: U.rand(0.25, 0.6),
          size: U.rand(1.5, 3),
          color: Math.random() < 0.5 ? "#ffe9a8" : "#ffcf6a",
          gravity: 320, drag: 1.2
        });
      }
    }

    // Leaves blown by the wind (gentle downward flutter).
    leaves(x, y, count, camWind) {
      for (let i = 0; i < count; i++) {
        this.add({
          type: "leaf",
          x: x + U.rand(-40, 40), y: y + U.rand(-20, 20),
          vx: U.rand(40, 90) + (camWind || 0) * 50, vy: U.rand(-6, 18),
          life: U.rand(1.2, 2.4),
          size: U.rand(2, 4),
          color: U.choice(["#7a8f4e", "#94a864", "#c0a057"]),
          gravity: 22, drag: 0.6
        });
      }
    }

    // Golden sparkles (solar recharge).
    sparkle(x, y, count) {
      for (let i = 0; i < count; i++) {
        const a = U.rand(0, Math.PI * 2);
        const sp = U.rand(8, 40);
        this.add({
          type: "glow",
          x: x + U.rand(-12, 12), y: y + U.rand(-12, 12),
          vx: Math.cos(a) * sp / 8, vy: Math.sin(a) * sp / 8 - 12,
          life: U.rand(0.5, 1.0),
          size: U.rand(2, 3.5),
          color: "#ffe9a8",
          gravity: -14, drag: 0.95
        });
      }
    }

    // Multi-coloured confetti when a delivery lands.
    confetti(x, y, count) {
      const colours = ["#e8a94c", "#efe3c2", "#7a8f4e", "#d95d39", "#3fa7b6"];
      for (let i = 0; i < count; i++) {
        const a = U.rand(-Math.PI, 0); // launch upward
        const sp = U.rand(90, 220);
        this.add({
          type: "dust",
          x: x, y: y + 6,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: U.rand(0.8, 1.6),
          size: U.rand(2, 4.5),
          color: U.choice(colours),
          gravity: 300, drag: 1.4
        });
      }
    }

    /* ----- simulation ----- */
    update(dt) {
      this.time += dt;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0 || p.x < -200000) {
          this.particles.splice(i, 1);
          continue;
        }

        // Drag is exponential damping: v *= e^(-drag*dt).
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
        p.vy += p.gravity * dt;

        // Leaves sway side-to-side using a sine wave - secondary motion.
        if (p.type === "leaf") {
          p.x += Math.sin(this.time * 3 + p.seed) * 22 * dt;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    /* ----- drawing (world space, camera offset applied) ----- */
    render(ctx, camX) {
      for (const p of this.particles) {
        // Fade out smoothly at the end of their life.
        const a = Math.min(1, p.life / (p.maxLife * 0.5));
        ctx.globalAlpha = a;

        if (p.type === "glow" || p.type === "spark") {
          ctx.globalAlpha = a * 0.5;
          const glowR = p.size * 3;
          const g = ctx.createRadialGradient(p.x - camX, p.y, 0, p.x - camX, p.y, glowR);
          g.addColorStop(0, p.color);
          g.addColorStop(1, "rgba(255, 233, 168, 0)");
          ctx.fillStyle = g;
          ctx.fillRect(p.x - camX - glowR, p.y - glowR, glowR * 2, glowR * 2);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x - camX, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    clear() {
      this.particles.length = 0;
    }
  }

  EC.ParticleSystem = ParticleSystem;
})();