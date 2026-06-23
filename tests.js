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

// ---- NEW: kinetic energy, Mach, and transonic ranges ----------------------
// These cover the additive ballistics keys (energyFtLb, mach) and the new
// Ballistics.transonicRanges() helper. The seed SIX5 fixture above carries no
// bullet weight, so we add it here (140 gr, matching the 6.5 CM preset/seed)
// only for the energy math — drop/drift/velocity are weight-independent.
const SIX5_140 = Object.assign({}, SIX5, { bulletWeightGr: 140 });
const ke = Ballistics.solve(SIX5_140, conditions(0, 12, 0));

// 8. Muzzle kinetic energy. row[0] sits at ~0.5 yd (a hair of drag already
// shed), so it lands just under the textbook muzzle figure of ~2351 ft-lb.
near("muzzle energy ~2351 ft-lb", ke.rows[0].energyFtLb, 2351, 5);

// Verify the grains->slugs->KE formula independently of ballistics.js:
//   massSlugs = grains / 7000 / 32.174 ; KE = 0.5 * mass * v^2
const massSlugsIndependent = 140 / 7000 / 32.174;
const keMuzzleIndependent = 0.5 * massSlugsIndependent * 2750 * 2750;
near("independent KE formula (140gr @ 2750) ~2350.5", keMuzzleIndependent, 2350.5, 0.5);
// And the row[0] energy should equal that formula evaluated at row[0]'s speed.
const e0Expected = 0.5 * massSlugsIndependent * ke.rows[0].velocityFps * ke.rows[0].velocityFps;
near("energyFtLb matches 0.5*m*v^2 at row[0]", ke.rows[0].energyFtLb, e0Expected, 0.001);

// 9. Energy decreases monotonically with range and stays positive.
const eMuzzle = ke.rows[0].energyFtLb;
const e500 = ke.holdAt(500).energyFtLb;
check("energy at 500 yd < muzzle energy", e500 < eMuzzle);
check("energy at 500 yd > 0", e500 > 0);

// 10. Mach key present and plausible. At the muzzle, mach ~ v / speedOfSound.
const sos59 = 49.0223 * Math.sqrt(59 + 459.67); // speedOfSound(59 F)
const machMuzzleExpected = ke.rows[0].velocityFps / sos59;
near("muzzle mach ~ v/speedOfSound", ke.rows[0].mach, machMuzzleExpected, 0.005);
near("muzzle mach ~ 2750/sos", ke.rows[0].mach, 2750 / sos59, 0.02);
check("mach decreases with range", ke.holdAt(500).mach < ke.rows[0].mach);

// 11. transonicRanges() for the seed 6.5 CM load: stays supersonic in-table,
// so subsonicYd is null within 1000 yd and transonicYd (if any) is > 1000.
const tr65 = Ballistics.transonicRanges(ke.rows);
check("6.5 CM: subsonicYd null within 1000 yd",
      tr65.subsonicYd === null || tr65.subsonicYd > 1000);
check("6.5 CM: transonicYd null or > 1000 yd",
      tr65.transonicYd === null || tr65.transonicYd > 1000);

// 12. transonicRanges() for a load that DOES go subsonic in-table:
// .308 Win 175gr @ 2600, G7 0.243. Expect transonic ~750-850, subsonic ~950-1000.
const W308 = {
  name: ".308 Win", bc: 0.243, dragModel: "G7", bulletWeightGr: 175,
  muzzleVelocityFps: 2600, zeroDistanceYd: 100, sightHeightIn: 1.5
};
const tr308 = Ballistics.transonicRanges(Ballistics.solve(W308, conditions(0, 12, 0)).rows);
check(".308: transonicYd is a number", typeof tr308.transonicYd === "number");
check(".308: subsonicYd is a number", typeof tr308.subsonicYd === "number");
near(".308: transonic crossing ~800 yd", tr308.transonicYd, 800, 60);
near(".308: subsonic crossing ~975 yd", tr308.subsonicYd, 975, 40);
check(".308: transonicYd < subsonicYd", tr308.transonicYd < tr308.subsonicYd);

// 13. Existing-output guard: prove the additive change did NOT move the
// trajectory. These dropMil values were captured from the current solver
// output BEFORE relying on them; if they drift, the additive edit broke math.
near("UNCHANGED: dropMil at 500 yd", std.holdAt(500).dropMil, 2.910549, 0.0005);
near("UNCHANGED: dropMil at 1000 yd", std.holdAt(1000).dropMil, 8.911066, 0.0005);

// ---- Shot-log analytics ---------------------------------------------------
const Shots = require("./shots.js");

// Helper to fake a shot with a given impact offset (mils) and hit flag.
function shot(windMil, elevMil, hit) {
  return { offsetWindMil: windMil, offsetElevMil: elevMil, hit: hit, distanceYd: 500 };
}

// A group consistently 0.5 mil low should report that as elevation bias.
const lowGroup = [shot(0, -0.5, true), shot(0.1, -0.4, true), shot(-0.1, -0.6, false)];
const lowStats = Shots.analyze(lowGroup);
near("analyze: detects low bias", lowStats.biasElevMil, -0.5, 0.1);
near("analyze: hit rate", lowStats.hitRate, 2 / 3, 0.01);
check("analyze: low-bias insight mentions coming up",
      Shots.insights(lowStats).some((t) => t.toLowerCase().includes("up")));

// A centered but scattered group: tiny bias, larger spread -> technique tip.
const looseGroup = [shot(1, 1, true), shot(-1, -1, true), shot(1, -1, false), shot(-1, 1, true)];
const looseStats = Shots.analyze(looseGroup);
near("analyze: centered group has ~0 bias", looseStats.biasMag, 0, 0.05);
check("analyze: wide spread flagged", looseStats.precisionMeanMil > 1.0);
check("analyze: spread insight mentions fundamentals/spread",
      Shots.insights(looseStats).some((t) => /spread|fundamental/i.test(t)));

// Empty input is handled gracefully.
check("analyze: empty list -> count 0", Shots.analyze([]).count === 0);

// ---- Summary --------------------------------------------------------------
console.log("\n" + passed + " passed, " + failed + " failed\n");
process.exit(failed > 0 ? 1 : 0);
