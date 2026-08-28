/* ============================================================
   EcoDash - input.js
   ------------------------------------------------------------
   Keyboard + touch input.

   We map physical keys to four "actions" that the rest of the
   game understands:
        throttle  -> W / Up / Space   (thrust forward)
        left      -> A / Left
        right     -> D / Right        (rotate the nose)
        brake     -> S / Down         (parachute drag)

   Touch devices drive the same four actions through on-screen
   buttons (see index.html #touch-controls). Instead of a raw key
   value, the game asks Input.isAction("throttle") etc. This keeps
   the physics code readable and lets us rebind controls easily.

   Exposed as:  EC.Input
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});

  // Physical key code -> game action.
  const KEY_MAP = {
    KeyW: "throttle", ArrowUp: "throttle", Space: "throttle",
    KeyA: "left", ArrowLeft: "left",
    KeyD: "right", ArrowRight: "right",
    KeyS: "brake", ArrowDown: "brake"
  };

  // keysDown[action] is true while the physical key is held.
  const keysDown = {};

  // Virtual actions come from the touch buttons.
  const virtual = { throttle: false, left: false, right: false, brake: false };

  // Edge triggers: set to true on the frame the key goes down,
  // cleared by game code once it has been "consumed".
  const pressed = {};

  // Simple pub/sub so the Game class can listen for global presses
  // (e.g. Enter to start, P to pause) without polling.
  const listeners = {};

  const Input = {
    isAction(action) {
      return !!keysDown[action] || !!virtual[action];
    },

    // True once, on the frame the action was first pressed.
    popPressed(action) {
      const wasDown = !!pressed[action];
      pressed[action] = false;
      return wasDown;
    },

    // Touch buttons set these.
    setVirtual(action, on) {
      virtual[action] = !!on;
    },

    // Release everything (used when the game pauses / loses focus).
    releaseAll() {
      for (const key in keysDown) keysDown[key] = false;
      for (const key in virtual) virtual[key] = false;
    },

    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
    },

    emit(event, action) {
      (listeners[event] || []).forEach((fn) => fn(action));
    }
  };

  /* ---------- keyboard listeners ---------- */
  window.addEventListener("keydown", (e) => {
    const action = KEY_MAP[e.code];

    // Fire an event for ANY key (or action) - this also unlocks
    // the WebAudio context, because browsers require a user gesture.
    Input.emit("anykey", e.code);

    if (!action) {
      // Still tell the game (Enter / Escape / M are handled in game.js).
      // Ignore OS key-repeat so holding Enter doesn't spam start/restart.
      if (!e.repeat && (e.code === "Enter" || e.code === "Escape" || e.code === "KeyP" || e.code === "KeyM")) {
        Input.emit("control", e.code);
      }
      return;
    }

    // Prevent the browser scrolling or repeating these keys.
    e.preventDefault();
    if (!keysDown[action]) {
      pressed[action] = true;
      Input.emit("action", action);
    }
    keysDown[action] = true;
  });

  window.addEventListener("keyup", (e) => {
    const action = KEY_MAP[e.code];
    if (action) keysDown[action] = false;
  });

  // If the window loses focus, drop all held keys so nothing sticks.
  window.addEventListener("blur", () => Input.releaseAll());

  EC.Input = Input;
})();