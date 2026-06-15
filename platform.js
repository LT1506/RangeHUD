/* =========================================================================
   platform.js  —  THE OUTPUT / PLATFORM ADAPTER
   -------------------------------------------------------------------------
   WHY THIS FILE EXISTS
   The ballistics math and the app logic shouldn't care WHERE the answer is
   shown or HOW the user steps the distance. A phone shows a big card and uses
   taps; the Meta Ray-Ban Display shows a tiny in-lens card and uses Neural
   Band swipes/pinches (and can speak). This file is the single place that
   knows about those differences, so the rest of the app stays the same.

   Meta's web-app path for the glasses is "standard HTML, CSS, and JavaScript"
   with access to motion/orientation, phone GPS, Neural Band input, and local
   storage — all of which RangeHUD already uses. So most of the app ports as-is;
   this adapter just smooths over the two real differences: INPUT and OUTPUT.

   Exposes a global `Platform` object.
   ========================================================================= */

const Platform = {

  /* -----------------------------------------------------------------------
     1. WHICH DEVICE ARE WE ON?
     -----------------------------------------------------------------------
     We can't reliably sniff the glasses yet, so for now we use a manual flag:
     open the app with "?glasses=1" on the URL to turn on glasses mode. When
     Meta documents a real way to detect the device, add it here — this is the
     ONLY place that decision lives.
     ----------------------------------------------------------------------- */
  isGlasses: function () {
    return new URLSearchParams(location.search).get("glasses") === "1";
  },

  /* -----------------------------------------------------------------------
     2. OUTPUT: turn a computed solution into display-ready shapes
     -----------------------------------------------------------------------
     One function, three formats:
       - card:  the fields the big HUD already shows
       - line:  a single compact string (good for a tiny lens or a log)
       - speech: a natural sentence to read aloud
     This is the heart of the "output adapter": the math produces numbers, and
     this decides how they become something a human reads or hears.
     ----------------------------------------------------------------------- */
  formatSolution: function (ctx) {
    // ctx = { profileName, distanceYd, hold, windSide, inclineDeg }
    const elevMil = ctx.hold.dropMil;
    const elevMOA = ctx.hold.dropMOA;
    const windMil = Math.abs(ctx.hold.driftMil);
    const noWind = windMil < 0.05;
    const side = ctx.windSide; // "L", "R", or "—"

    // A tiny one-liner, e.g. "600yd  UP 6.2  L 0.8"
    const windPart = noWind ? "no wind" : (side + " " + windMil.toFixed(1));
    const line = ctx.distanceYd + "yd  UP " + elevMil.toFixed(1) + "  " + windPart;

    // A spoken sentence, e.g. "600 yards. Up 6.2 mils. Hold left 0.8 mils."
    const sideWord = side === "L" ? "left" : (side === "R" ? "right" : "");
    let speech = ctx.distanceYd + " yards. Up " + elevMil.toFixed(1) + " mils.";
    if (!noWind) speech += " Hold " + sideWord + " " + windMil.toFixed(1) + " mils.";
    if (ctx.inclineDeg) speech += " " + ctx.inclineDeg + " degree angle.";

    return {
      card: { elevMil: elevMil, elevMOA: elevMOA, windMil: windMil, windSide: side },
      line: line,
      speech: speech
    };
  },

  /* -----------------------------------------------------------------------
     3. OUTPUT: speak a string aloud
     -----------------------------------------------------------------------
     Uses the browser's built-in Speech Synthesis. On the glasses this comes
     out the speakers — arguably the BEST way to get a firing solution while
     you're behind the rifle and can't look away.
     ----------------------------------------------------------------------- */
  speak: function (text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); // stop anything already talking
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  },

  /* -----------------------------------------------------------------------
     4. INPUT: directional intents, many input sources
     -----------------------------------------------------------------------
     The Neural Band's vocabulary is: swipe up/down/left/right + pinch (select)
     + pinch-back. Meta delivers swipes as ARROW KEYS and pinch as ENTER, so we
     map those (and touch swipes, for phone testing) to one set of callbacks and
     let each screen decide what a direction means:

       { onUp, onDown, onLeft, onRight, onSelect, onBack }

     e.g. the HUD uses up/down for distance and left/right to pick a button;
     pinch (onSelect) presses it.
     ----------------------------------------------------------------------- */
  bindInputs: function (actions) {
    function call(name) { if (actions[name]) actions[name](); }

    // ---- Keyboard / Neural-Band swipes (arrows) + pinch (Enter) ----
    document.addEventListener("keydown", function (e) {
      switch (e.key) {
        case "ArrowUp": call("onUp"); break;
        case "ArrowDown": call("onDown"); break;
        case "ArrowLeft": call("onLeft"); break;
        case "ArrowRight": call("onRight"); break;
        case "Enter": call("onSelect"); break;
        case "Escape": call("onBack"); break;
        default: return;
      }
    });

    // ---- Touch swipes (phones) ----
    let startX = 0, startY = 0;
    document.addEventListener("touchstart", function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });
    document.addEventListener("touchend", function (e) {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return; // too small = a tap
      if (Math.abs(dx) > Math.abs(dy)) call(dx > 0 ? "onRight" : "onLeft");
      else call(dy > 0 ? "onDown" : "onUp");
    });
  }
};
