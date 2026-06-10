/* =========================================================================
   tests.js  —  AUTOMATED CHECKS FOR THE BALLISTICS MATH
   -------------------------------------------------------------------------
   Run it from the RangeHUD folder with:

       node tests.js

   It prints a line per check and exits with code 1 if anything fails, so it
   doubles as a guard you can run after editing ballistics.js. No testing
   framework — just a couple of tiny helper functions, so you can read it all.

   WHY test the math and not the buttons? The math is where a silent mistake
   would quietly give you a wrong firing solution. The buttons you'd notice.
   ========================================================================= */

const Ballistics = require("./ballistics.js");

// ---- Tiny test helpers ----------------------------------------------------
let passed = 0;
let failed = 0;

// Check that a condition is true.
function check(name, condition) {
  if (condition) {
    passed++;
    console.log("  PASS  " + name);
  } else {
    failed++;
    console.log("  FAIL  " + name);
  }
}

// Check that a number is close to an expected value (within a tolerance).
function near(name, actual, expected, tolerance) {
  const ok = Math.abs(actual - expected) <= tolerance;
  check(name + " (got " + actual.toFixed(3) + ", want " + expected + " +/- " + tolerance + ")", ok);
}

// ---- Test fixtures --------------------------------------------------------

// The pre-loaded example load.
const SIX5 = {
  name: "6.5 CM", bc: 0.305, dragModel: "G7",
  muzzleVelocityFps: 2750, zeroDistanceYd: 100, sightHeightIn: 1.5
};

// Build a conditions object the way app.js does (wind clock -> crosswind).
function conditions(windMph, clock, inclineDeg, tempF, pressureInHg) {
  const angle = clock * 30 * Math.PI / 180;
  return {
    crosswindMph: windMph * Math.abs(Math.sin(angle)),
    tempF: (tempF === undefined) ? 59 : tempF,
    pressureInHg: (pressureInHg === undefined) ? 29.92 : pressureInHg,
    inclineDeg: inclineDeg || 0
  };
}

// ---- The checks -----------------------------------------------------------
console.log("\nRangeHUD ballistics tests\n");

// 1. The bullet is on the line of sight at the zero distance.
const std = Ballistics.solve(SIX5, conditions(0, 12, 0));
near("zeroed at 100 yd", std.holdAt(100).dropMil, 0, 0.05);

// 2. Known-good 6.5 Creedmoor numbers (loose bounds vs published data).
const d500 = std.holdAt(500), d1000 = std.holdAt(1000);
check("500 yd drop ~10 MOA", d500.dropMOA > 9.3 && d500.dropMOA < 10.6);
check("1000 yd drop ~8.9 mil", d1000.dropMil > 8.4 && d1000.dropMil < 9.4);
check("1000 yd still supersonic-ish (>1300 fps)", d1000.velocityFps > 1300);

// 3. Drop grows with distance (monotonic).
check("drop increases with range", std.holdAt(300).dropMil < std.holdAt(500).dropMil &&
                                    std.holdAt(500).dropMil < std.holdAt(800).dropMil);

// 4. Wind: a 1 o'clock wind is half-value vs a 3 o'clock (full value) wind.
const full = Ballistics.solve(SIX5, conditions(10, 3, 0)).holdAt(1000).driftMil;
const half = Ballistics.solve(SIX5, conditions(10, 1, 0)).holdAt(1000).driftMil;
near("1 o'clock wind is half of 3 o'clock", half, full / 2, full * 0.05);

// 5. A pure headwind (12 o'clock) produces no sideways drift.
near("headwind has no drift", Ballistics.solve(SIX5, conditions(10, 12, 0)).holdAt(1000).driftMil, 0, 0.02);

// 6. Incline correction: 45 degrees reduces drop by cos(45) = 0.707.
const flat = std.holdAt(1000).dropMil;
const inclined = Ballistics.solve(SIX5, conditions(0, 12, 45)).holdAt(1000).dropMil;
near("45 deg incline applies cos factor", inclined, flat * Math.cos(45 * Math.PI / 180), 0.05);

// 7. Atmosphere: cold (dense) air drags more, so MORE drop than hot (thin) air.
const cold = Ballistics.solve(SIX5, conditions(0, 12, 0, 10, 29.92)).holdAt(1000).dropMil;
const hot = Ballistics.solve(SIX5, conditions(0, 12, 0, 100, 29.92)).holdAt(1000).dropMil;
check("colder air drops more than hot air", cold > hot);

// ---- Summary --------------------------------------------------------------
console.log("\n" + passed + " passed, " + failed + " failed\n");
process.exit(failed > 0 ? 1 : 0);
