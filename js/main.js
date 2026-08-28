/* ============================================================
   EcoDash - main.js
   ------------------------------------------------------------
   The entry point. Creates the Game and kicks everything off.
   We also expose the Game object on window as "game" so you can
   open the browser console (F12) and inspect / debug live, e.g.:

       game.drone.battery = 100      // reload the battery
       game.state                   // "playing"
       game.obstacles.length        // how many obstacles exist
       EC.Celestial.phase           // current day/night phase 0..1
       EC.Weather.strength01        // current wind power 0..1

   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});

  // Wait for the page (canvas) to be fully ready.
  function boot() {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;

    const game = new EC.Game(canvas);

    // Expose for console debugging (see header comment).
    window.game = game;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();