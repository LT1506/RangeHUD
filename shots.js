/* =========================================================================
   shots.js  —  RANGE LOG STORAGE + ACCURACY ANALYTICS
   -------------------------------------------------------------------------
   Pure logic, no DOM (same idea as ballistics.js). It stores a list of
   "shot" records in localStorage and turns them into useful statistics.

   A shot record looks like this (all the angular numbers are in MILS):
     {
       id, timestamp, profileName, distanceYd,
       windSpeedMph, windClock, windSide, tempF, pressureInHg,
       shotAngleDeg,                  // measured by the glasses (or typed)
       predDropMil, predWindMil,      // what the app told you to hold
       hit,                           // true / false
       offsetWindMil,                 // + = impact RIGHT of aim, - = LEFT
       offsetElevMil                  // + = impact HIGH,          - = LOW
     }

   WHY mils for the offset? An angle is distance-independent, so a 0.3-mil
   error at 300 yards and at 800 yards are directly comparable. That's what
   lets us spot a *pattern* instead of just a pile of inches.

   Exposes a global `Shots` object.
   ========================================================================= */

const SHOTS_KEY = "rangehud.shots";

function loadShots() {
  const text = localStorage.getItem(SHOTS_KEY);
  if (!text) return [];
  try { return JSON.parse(text); } catch (e) { return []; }
}

function saveShots(shots) {
  localStorage.setItem(SHOTS_KEY, JSON.stringify(shots));
}

function addShot(shot) {
  const shots = loadShots();
  shots.push(shot);
  saveShots(shots);
  return shots;
}

function deleteShot(id) {
  const shots = loadShots().filter((s) => s.id !== id);
  saveShots(shots);
  return shots;
}

function clearShots() {
  saveShots([]);
}

// Small average helper.
function average(numbers) {
  if (numbers.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) sum += numbers[i];
  return sum / numbers.length;
}

/* -------------------------------------------------------------------------
   THE HEART OF IT: analyze()
   -------------------------------------------------------------------------
   Turns a list of shots into two very different ideas:

     ACCURACY (bias): where is the *center* of your group relative to your
       aim? A consistent offset means your zero / DOPE / wind call is off by
       a fixed amount — fixable by dialing.

     PRECISION (spread): how tightly are the shots packed around their OWN
       center? Wide spread means inconsistency (fundamentals, wind reading) —
       NOT something dialing can fix.

   Separating these is the whole point: a tight group in the wrong place is a
   different problem from a loose group in the right place.
   ------------------------------------------------------------------------- */
function analyze(shots) {
  const n = shots.length;
  if (n === 0) return { count: 0 };

  const hits = shots.filter((s) => s.hit).length;

  // Group center = the average impact offset. This IS the bias.
  const biasWindMil = average(shots.map((s) => s.offsetWindMil));
  const biasElevMil = average(shots.map((s) => s.offsetElevMil));

  // Distance of each shot from the group's own center (its scatter).
  const radii = shots.map((s) =>
    Math.hypot(s.offsetWindMil - biasWindMil, s.offsetElevMil - biasElevMil)
  );

  return {
    count: n,
    hits: hits,
    hitRate: hits / n,
    biasWindMil: biasWindMil,     // + right, - left
    biasElevMil: biasElevMil,     // + high,  - low
    biasMag: Math.hypot(biasWindMil, biasElevMil),
    precisionMeanMil: average(radii),               // average scatter
    precisionMaxMil: Math.max.apply(null, radii)    // worst shot (extreme spread)
  };
}

/* -------------------------------------------------------------------------
   insights(): plain-language coaching from the stats
   -------------------------------------------------------------------------
   Heuristics, not gospel — but they point you at the RIGHT fix (dial vs
   technique). We only call something a bias when it's at least as big as the
   normal scatter, so we don't "correct" what is really just randomness.
   ------------------------------------------------------------------------- */
function insights(stats) {
  if (!stats.count) return ["No shots logged yet."];

  const tips = [];
  const e = stats.biasElevMil;
  const w = stats.biasWindMil;
  const scatter = stats.precisionMeanMil;

  // Elevation bias -> dialing correction.
  if (Math.abs(e) >= 0.2 && Math.abs(e) >= scatter) {
    tips.push(
      "Centers " + Math.abs(e).toFixed(1) + " mil " + (e > 0 ? "high" : "low") +
      " — come " + (e > 0 ? "down" : "up") + " " + Math.abs(e).toFixed(1) +
      " mil (adjust hold or re-true)."
    );
  }
  // Windage bias -> hold/zero correction.
  if (Math.abs(w) >= 0.2 && Math.abs(w) >= scatter) {
    tips.push(
      "Centers " + Math.abs(w).toFixed(1) + " mil " + (w > 0 ? "right" : "left") +
      " — favor " + (w > 0 ? "left" : "right") + " " + Math.abs(w).toFixed(1) +
      " mil (wind call or zero)."
    );
  }
  // Centered but loose -> technique, not dialing.
  if (tips.length === 0 && scatter > 0.5) {
    tips.push(
      "Center is good, but spread is wide (" + scatter.toFixed(1) +
      " mil avg) — this is fundamentals / wind reading, not dialing."
    );
  }
  if (tips.length === 0) {
    tips.push("Tight and centered — nice shooting.");
  }
  return tips;
}

// The public API.
const Shots = {
  loadShots: loadShots,
  addShot: addShot,
  deleteShot: deleteShot,
  clearShots: clearShots,
  analyze: analyze,
  insights: insights
};

// Make it require()-able under Node for tests (skipped in the browser).
if (typeof module !== "undefined" && module.exports) {
  module.exports = Shots;
}
