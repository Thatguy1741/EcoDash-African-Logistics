/* ============================================================
   EcoDash - world.js
   ------------------------------------------------------------
   The WORLD is the scrolling African terrain behind the drone:
     - two parallax hill bands + silhouetted acacia trees
     - the ground strip (dirt, grass lip) with:
         * rivers (soaked, winding strips)
         * potholes (dark ellipses)
         * a road with a moving delivery truck
         * SA-style roadworks barriers ("construction zones")
         * rocks and grass tufts
     - villages (round huts) that are our DELIVERY TARGETS
     - all colours dim at night via the celestial nightFactor

   TERRAIN GENERATION (mathematics at work):
   The world is basically infinite. We split it into CHUNK-sized
   strips and build each strip on demand with a SEEDED random
   number generator (mulberry32). Because the seed depends only on
   the chunk index, the same terrain always appears in the same
   place - no tearing, no spawning in the middle of a river.

   Parallax (a classic animation & game-design trick): the far hill
   band scrolls at 25% of the camera speed, the near band at 55%,
   and the ground at 100%. Our eyes read that difference as depth.

   Exposed as:  new EC.World(groundY)
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});
  const U = EC.Utils;

  const CHUNK = 2000;      // world pixels per chunk
  const SOIL = { r: 152, g: 112, b: 70 };
  const SOIL_DARK = { r: 120, g: 86, b: 52 };
  const GRASS = { r: 138, g: 148, b: 66 };
  const ROCK = { r: 168, g: 150, b: 122 };
  const WATER = { r: 88, g: 160, b: 190 };
  const ROAD = { r: 96, g: 88, b: 82 };

  class World {
    constructor(groundY) {
      this.groundY = groundY;
      this.time = 0;
      this.chunks = {};    // chunkIndex -> decorations
      this.villages = [];  // delivery targets: {x, seed, delivered, huts}
      this.trucks = [];    // moving traffic: {x, speed}
      this.lastCamX = -1000; // camera state for truck culling (set in draw)
      this.lastCamW = 0;
    }

    /* ==================== procedural generation ==================== */

    // Make sure every chunk up to worldX has been built.
    ensureTo(worldX) {
      const endChunk = Math.floor((worldX + CHUNK) / CHUNK);
      for (let i = 0; i <= endChunk; i++) {
        if (!this.chunks[i]) this.chunks[i] = this.buildChunk(i);
      }
    }

    // Build one strip of terrain. Deterministic thanks to mulberry32.
    buildChunk(index) {
      const rnd = U.mulberry32(index * 9301 + 49297);
      const chunk = {
        grasses: [], rocks: [], potholes: [], rivers: [], road: null
      };
      const x0 = index * CHUNK;

      // The decorative "trail" of grass tufts - constant across the world.
      for (let gx = x0 + 24; gx < x0 + CHUNK; gx += 14 + rnd() * 46) {
        chunk.grasses.push({ x: gx, s: 0.6 + rnd() * 0.8 });
      }

      // Occasional rocks littering the ground.
      if (rnd() < 0.5) {
        const n = Math.floor(2 + rnd() * 6);
        for (let i = 0; i < n; i++) {
          chunk.rocks.push({ x: x0 + rnd() * CHUNK, s: 4 + rnd() * 9 });
        }
      }

      // Pothole clusters (a very real South African delivery hazard!).
      if (rnd() < 0.65) {
        const n = Math.floor(2 + rnd() * 8);
        const cx = x0 + rnd() * (CHUNK - 320);
        for (let i = 0; i < n; i++) {
          chunk.potholes.push({
            x: cx + rnd() * 300,
            w: 12 + rnd() * 22,
            h: 4 + rnd() * 6,
            d: 0.25 + rnd() * 0.35
          });
        }
      }

      // River crossings (avoid when they appear - soak the drone!).
      if (rnd() < 0.35) {
        chunk.rivers.push({ x: x0 + rnd() * (CHUNK - 260), w: 90 + rnd() * 120, seed: rnd() * 10 });
      }

      // A road + moving truck every so often.
      if (rnd() < 0.4) {
        chunk.road = { x: x0 + rnd() * (CHUNK - 700), len: 500 + rnd() * 700 };
        this.trucks.push({
          x: chunk.road.x + 40 + rnd() * 200,
          speed: 95 + rnd() * 60
        });
      }

      // Villages - our delivery destinations (one per chunk, mostly).
      if (rnd() < 0.75) {
        const vx = x0 + 400 + rnd() * (CHUNK - 800);
        const huts = [];
        const hutCount = Math.floor(3 + rnd() * 3);
        for (let i = 0; i < hutCount; i++) {
          huts.push({ dx: -(hutCount * 45) / 2 + i * 90 + (rnd() - 0.5) * 40, s: 9 + rnd() * 5 });
        }
        this.villages.push({
          x: vx,
          seed: rnd() * 100,
          delivered: false,
          huts: huts,
          accent: U.choice([{ h: { r: 186, g: 128, b: 82 }, r: { r: 214, g: 172, b: 96 } },
                            { h: { r: 170, g: 116, b: 74 }, r: { r: 198, g: 158, b: 88 } }])
        });
      }

      return chunk;
    }

    /* ==================== simulation ==================== */

    update(dt) {
      this.time += dt;
      // Trucks drive forward (their world x increases over time).
      for (const truck of this.trucks) truck.x += truck.speed * dt;
      // Cull trucks that have driven way off screen left.
      this.trucks = this.trucks.filter((t) => t.x > this.lastCamX - this.lastCamW - 200);
    }

    /* ==================== drawing ==================== */

    draw(ctx, camX, W, H, ghostStartX, lastTruckX) {
      this.lastCamX = camX;
      this.lastCamW = W;

      const nf = EC.Celestial.nightFactor;      // 0 = bright day, 1 = night
      const amb = 1 - nf * 0.52;                // how much the ground "survives"
      const view0 = camX - 60, view1 = camX + W + 60;
      const gY = this.groundY;

      /* --- distant mountain chain (parallax ~0.12) ------------------ */
      this.drawRidge(ctx, camX, H, 0.12, gY - 90, 90, 0.000031, 7.3, U.shadeColour({ r: 120, g: 96, b: 110 }, amb));

      /* --- far hill band (parallax 0.25) ----------------------------- */
      const farCol = U.shadeColour({ r: 168, g: 138, b: 96 }, amb);
      this.drawHillBand(ctx, camX, W, H, 0.25, gY - 26, 30, 0.00035, 11.7, farCol);
      this.drawAcacias(ctx, camX, W, 0.25, gY - 8, U.shadeColour({ r: 96, g: 74, b: 44 }, amb));

      /* --- near hill band (parallax 0.55) ---------------------------- */
      const nearCol = U.shadeColour({ r: 132, g: 116, b: 66 }, amb);
      this.drawHillBand(ctx, camX, W, H, 0.55, gY + 4, 22, 0.00052, 21.3, nearCol);
      this.drawAcacias(ctx, camX, W, 0.55, gY + 6, U.shadeColour({ r: 70, g: 62, b: 34 }, amb));

      /* --- the ground itself (1:1 scroll) --------------------------- */
      this.drawGroundStrip(ctx, camX, W, H, amb);

      // Iterate only the chunks currently on screen.
      const c0 = Math.floor(view0 / CHUNK), c1 = Math.floor(view1 / CHUNK);
      for (let i = Math.max(0, c0); i <= c1; i++) {
        const chunk = this.chunks[i];
        if (!chunk) continue;

        // Rocks + potholes + grasses (simple culling per item).
        for (const r of chunk.rocks) this.drawRock(ctx, r.x - camX, gY, r.s, amb);
        for (const p of chunk.potholes) {
          const sx = p.x - camX;
          if (sx > -80 && sx < W + 80) this.drawPothole(ctx, sx, gY, p, amb);
        }
        for (const gp of chunk.grasses) {
          const sx = gp.x - camX;
          if (sx > -10 && sx < W + 10) this.drawGrass(ctx, sx, gY, gp.s, amb);
        }
        for (const river of chunk.rivers) this.drawRiver(ctx, river, camX, gY, amb);

        // Road + truck.
        if (chunk.road) this.drawRoad(ctx, chunk.road, camX, gY, amb);
      }

      // Trucks (they live outside chunks).
      for (const truck of this.trucks) this.drawTruck(ctx, truck.x - camX, gY, amb);

      // Villages always drawn last so hut light glows sit on the ground.
      for (const v of this.villages) {
        const sx = v.x - camX;
        if (sx > -260 && sx < W + 260) this.drawVillage(ctx, v, sx, gY, amb);
      }
    }

    /* ==================== terrain painters ==================== */

    drawRidge(ctx, camX, H, par, baseY, amp, freq, seed, colour) {
      ctx.fillStyle = U.cssColour(colour);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let sx = 0; sx <= 960 + 24; sx += 24) {
        const wx = camX * par + sx;
        const y = baseY + Math.sin(wx * freq + seed) * amp;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(960, H);
      ctx.closePath();
      ctx.fill();
    }

    drawHillBand(ctx, camX, W, H, par, baseY, amp, freq, seed, colour) {
      ctx.fillStyle = U.cssColour(colour);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let sx = 0; sx <= W + 24; sx += 24) {
        const wx = camX * par + sx;
        const y = baseY
          + Math.sin(wx * freq + seed) * amp
          + Math.sin(wx * freq * 0.53 + seed * 2.0) * amp * 0.45
          + Math.sin(wx * freq * 2.1 + seed * 3.0) * amp * 0.12;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }

    // Silhouetted flat-topped acacia trees on a hill band.
    drawAcacias(ctx, camX, W, par, baseY, colour) {
      const step = 210;
      const x0 = Math.floor((camX * par) / step) * step;
      ctx.fillStyle = U.cssColour(colour);
      for (let wx = x0; wx < camX * par + W + step; wx += step) {
        const rnd = U.mulberry32(Math.abs(Math.floor(wx / step)) * 1013 + 77);
        if (rnd() < 0.4) {
          const sx = wx - camX * par;
          const size = 14 + rnd() * 22;
          const trunk = size * 0.9;
          const y = baseY + Math.sin(wx * 0.0011 + 4) * 8;
          // Trunk
          ctx.fillRect(sx, y - trunk, 3, trunk);
          // Flat umbrella canopy
          ctx.beginPath();
          ctx.ellipse(sx + 1.5, y - trunk - 4, size, size * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawGroundStrip(ctx, camX, W, H, amb) {
      const gY = this.groundY;
      const soil = U.cssColour(U.shadeColour(SOIL, amb));
      const grass = U.cssColour(U.shadeColour(GRASS, amb));

      // Dirt block.
      ctx.fillStyle = soil;
      ctx.fillRect(0, gY, W, H - gY);

      // Ribbed texture: cracks / tire grooves across the ground.
      ctx.strokeStyle = U.cssColour(U.shadeColour(SOIL_DARK, amb));
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 70; i++) {
        const sx = ((i * 97 + Math.floor(camX / 120) * 31) % (W + 80)) - 40;
        const row = (i % 5) * 8;
        const sway = Math.sin((camX + sx) * 0.05) * 8;
        ctx.beginPath();
        ctx.moveTo(sx, gY + 8 + row);
        ctx.lineTo(sx + 6 + sway, gY + 24 + row);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Grass lip along the top edge of the ground.
      ctx.fillStyle = grass;
      ctx.fillRect(0, gY, W, 7);

      // Dark edge line (marks the true ground collision line).
      ctx.fillStyle = U.cssColour(U.shadeColour(SOIL_DARK, amb));
      ctx.fillRect(0, gY + 7, W, 2);
    }

    drawGrass(ctx, sx, gY, s, amb) {
      ctx.strokeStyle = U.cssColour(U.shadeColour(GRASS, amb));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(sx + i * 2, gY + 2);
        ctx.lineTo(sx + i * 2 + 1, gY - 3 - (i % 2) * s);
      }
      ctx.stroke();
    }

    drawRock(ctx, sx, gY, s, amb) {
      const c = U.cssColour(U.shadeColour(ROCK, amb));
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(sx, gY + 12, s * 1.2, s * 0.62, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.ellipse(sx - s * 0.3, gY + 9, s * 0.6, s * 0.3, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    drawPothole(ctx, sx, gY, p, amb) {
      ctx.fillStyle = U.cssColour(U.shadeColour({ r: 66, g: 46, b: 30 }, amb));
      ctx.beginPath();
      ctx.ellipse(sx, gY + 16, p.w, p.h, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = U.cssColour(U.shadeColour({ r: 40, g: 28, b: 20 }, amb));
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    drawRiver(ctx, river, camX, gY, amb) {
      const x0 = river.x - camX;
      const width = river.w;
      if (x0 > 1000 || x0 + width < -100) return;

      const water = U.cssColour(U.shadeColour(WATER, U.lerp(1, 0.75, EC.Celestial.nightFactor)));
      const bank = U.cssColour(U.shadeColour({ r: 176, g: 128, b: 74 }, amb));
      ctx.fillStyle = water;
      ctx.beginPath();
      ctx.moveTo(x0, gY + 6);
      for (let dx = 0; dx <= width; dx += 14) {
        ctx.lineTo(x0 + dx, gY + 6 + Math.sin((river.x + dx) * 0.05 + river.seed) * 4);
      }
      ctx.lineTo(x0 + width, gY + 60);
      ctx.lineTo(x0 + width, gY + 70 + Math.sin((river.seed) * 3) * 2);
      for (let dx = width; dx >= 0; dx -= 14) {
        ctx.lineTo(x0 + dx, gY + 70 + Math.sin((river.x + dx) * 0.05 + river.seed) * 4);
      }
      ctx.closePath();
      ctx.fill();

      // Wet banks on both edges.
      ctx.fillStyle = bank;
      ctx.fillRect(x0 - 6, gY + 4, width + 12, 4);
    }

    drawRoad(ctx, road, camX, gY, amb) {
      const x0 = road.x - camX;
      if (x0 > 1100 || x0 + road.len < -100) return;
      const c = U.cssColour(U.shadeColour(ROAD, amb));
      const y = gY + 52;
      ctx.fillStyle = c;
      ctx.fillRect(x0, y, road.len, 26);
      // Dashed centre line.
      ctx.fillStyle = U.cssColour(U.shadeColour({ r: 232, g: 216, b: 176 }, amb));
      for (let dx = 10; dx < road.len; dx += 34) {
        ctx.fillRect(x0 + dx, y + 12, 18, 2.5);
      }
      // Roadworks barrier (SA construction zone!) - placed
      // deterministically so it doesn't flicker between frames.
      if (Math.floor(road.x / 140) % 5 === 2) {
        this.drawBarrier(ctx, x0 + road.len * 0.55, y + 26, amb);
      }
    }

    drawBarrier(ctx, sx, y, amb) {
      const yellow = U.cssColour(U.shadeColour({ r: 228, g: 194, b: 60 }, amb));
      const black = U.cssColour(U.shadeColour({ r: 30, g: 24, b: 18 }, amb));
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 === 0 ? yellow : black;
        ctx.fillRect(sx + i * 8, y - 8, 8, 16);
      }
      ctx.fillStyle = black;
      ctx.fillRect(sx - 4, y - 14, 42, 4);
    }

    drawTruck(ctx, sx, gY, amb) {
      if (sx < -160 || sx > 1100) return;
      const body = U.cssColour(U.shadeColour({ r: 58, g: 138, b: 96 }, amb));
      const cab = U.cssColour(U.shadeColour({ r: 44, g: 102, b: 74 }, amb));
      const y = gY + 32;
      ctx.fillStyle = body;
      ctx.fillRect(sx, y, 46, 22);          // cargo box
      ctx.fillStyle = cab;
      ctx.fillRect(sx + 46, y + 6, 20, 16); // cab
      ctx.fillStyle = U.cssColour(U.shadeColour({ r: 30, g: 24, b: 18 }, amb));
      ctx.beginPath(); ctx.arc(sx + 10, y + 22, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 54, y + 22, 7, 0, Math.PI * 2); ctx.fill();
    }

    /* -------------------- villages (delivery targets) -------------------- */

    drawVillage(ctx, v, sx, gY, amb) {
      const nf = EC.Celestial.nightFactor;
      const wall = U.cssColour(U.shadeColour(v.accent.h, amb));
      const roof = U.cssColour(U.shadeColour(v.accent.r, amb));

      // Huts (round wall + cone roof) around the village centre.
      for (const hut of v.huts) {
        const hx = sx + hut.dx;
        const s = hut.s;

        // Wall
        ctx.fillStyle = wall;
        ctx.beginPath();
        ctx.ellipse(hx, gY - 6, s, s * 0.75, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Roof (cone)
        ctx.fillStyle = roof;
        ctx.beginPath();
        ctx.moveTo(hx - s * 0.95, gY - 6);
        ctx.quadraticCurveTo(hx, gY - 6 - s * 0.35, hx + s * 0.95, gY - 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = U.cssColour(U.shadeColour({ r: 120, g: 92, b: 52 }, amb));
        ctx.lineWidth = 1;
        ctx.stroke();

        // Door
        ctx.fillStyle = U.cssColour(U.shadeColour({ r: 72, g: 50, b: 32 }, amb));
        ctx.fillRect(hx - 3, gY - 9, 6, 9);

        // Window that glows warmly at night.
        const winAlpha = 0.55 * (0.3 + 0.9 * nf);
        if (winAlpha > 0.02) {
          ctx.fillStyle = "rgba(255, 214, 130, " + winAlpha.toFixed(2) + ")";
          ctx.fillRect(hx + s * 0.2, gY - 14, 5, 5);
        }
      }

      // Village flag pole (green & gold).
      ctx.strokeStyle = U.cssColour(U.shadeColour({ r: 180, g: 160, b: 120 }, amb));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 90, gY);
      ctx.lineTo(sx + 90, gY - 34);
      ctx.stroke();
      ctx.fillStyle = U.cssColour(U.shadeColour({ r: 60, g: 148, b: 82 }, amb));
      ctx.fillRect(sx + 90, gY - 34, 20, 10);
      ctx.fillStyle = U.cssColour(U.shadeColour({ r: 220, g: 174, b: 60 }, amb));
      ctx.fillRect(sx + 90, gY - 24, 20, 6);

      // A delivered village gets a bright star marker.
      if (v.delivered) {
        const tw = 0.6 + 0.4 * Math.sin(this.time * 4 + v.seed);
        ctx.fillStyle = "rgba(255, 233, 168, " + (0.35 + 0.4 * tw).toFixed(2) + ")";
        this.drawStar(ctx, sx + 2, gY - 52, 6 + tw * 2);
      }

      // Warm campfire glow at night.
      if (nf > 0.3) {
        const flick = 0.5 + 0.5 * Math.sin(this.time * 9 + v.seed);
        ctx.fillStyle = "rgba(255, 160, 70, " + (0.25 * nf * flick).toFixed(2) + ")";
        ctx.beginPath();
        ctx.arc(sx - 70, gY - 3, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawStar(ctx, x, y, r) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.4;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  EC.World = World;
})();