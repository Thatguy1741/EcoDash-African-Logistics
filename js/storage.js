/* ============================================================
   EcoDash - storage.js
   ------------------------------------------------------------
   Persists high scores in the browser using localStorage, which
   satisfies the assignment requirement: "Local storage".
   (Note: opening the page via the file:// protocol still allows
   localStorage - it is stored per page URL.)

   Each saved entry looks like:
     { score, distanceKm, deliveries, grade, date }

   Exposed as:  EC.Storage
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});

  const KEY = "ecodash_highscores_v1";
  const MAX_ENTRIES = 5;

  // 'grade' is the energy-efficiency letter (A+ ... D) computed in
  // game.js. We store the label for display in the Hall of Fame.
  function defaultEntry() {
    return { score: 0, distanceKm: 0, deliveries: 0, grade: "D", date: "" };
  }

  const Storage = {

    // Read the saved list (always returns an array).
    loadScores() {
      try {
        const raw = localStorage.getItem(KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (err) {
        // Corrupt storage must never crash the game.
        return [];
      }
    },

    // Highest score so far (0 if none yet).
    bestScore() {
      const list = this.loadScores();
      return list.length ? list[0].score : 0;
    },

    // Non-destructive write that keeps the list sorted (descending)
    // and capped at MAX_ENTRIES. Returns { list, rank } where rank is
    // the position of the brand-new entry, or -1 if it didn't place.
    addScore(entry) {
      const fresh = Object.assign(defaultEntry(), entry);
      fresh.score = Math.round(fresh.score) || 0;
      fresh.distanceKm = Number(fresh.distanceKm.toFixed(2)) || 0;
      fresh.date = fresh.date || new Date().toLocaleDateString();

      const list = this.loadScores();
      list.push(fresh);
      list.sort((a, b) => b.score - a.score); // highest first
      const trimmed = list.slice(0, MAX_ENTRIES);

      const rank = trimmed.indexOf(fresh);
      try {
        localStorage.setItem(KEY, JSON.stringify(trimmed));
      } catch (err) {
        /* storage full / private mode - ignore, scores just won't save */
      }
      return { list: trimmed, rank: rank };
    },

    // Format used by the HUD / game-over list.
    renderScores(list) {
      return list.map((item) => ({
        score: item.score,
        label: item.distanceKm + " km · " + item.deliveries + " parcels · " + item.grade + " · " + item.date
      }));
    }
  };

  EC.Storage = Storage;
})();