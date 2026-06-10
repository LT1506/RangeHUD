/* =========================================================================
   ballistics.js  —  THE MATH ONLY
   -------------------------------------------------------------------------
   This file knows nothing about buttons, screens, or HTML. It just takes
   numbers in and gives numbers out. That makes it easy to reason about and
   easy to test on its own.

   It exposes one global object called `Ballistics` (see the very bottom).
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. PHYSICAL CONSTANTS
   ------------------------------------------------------------------------- */

// Acceleration from gravity, in feet per second per second.
const GRAVITY = 32.174;

// Standard sea-level atmosphere (the conditions BCs are defined against).
const STD_TEMP_F = 59;        // degrees Fahrenheit
const STD_PRESSURE_INHG = 29.92; // inches of mercury
const STD_DENSITY = 0.0023769;   // slugs per cubic foot (a "slug" is a unit of mass)

// This single magic number folds together a bunch of unit conversions so that
// our drag formula can use the ballistic coefficient as a plain number.
// (If you're curious where it comes from: it's  0.5 * 32.174 * PI / 576 .
//  In the full derivation the bullet's weight and diameter cancel out, which
//  is the whole reason the ballistic coefficient exists.)
const DRAG_CONST = 0.08774;

// Converts miles-per-hour into feet-per-second.
const MPH_TO_FPS = 1.46667;

// Converts a small angle (in radians) into MOA and mils.
const RAD_TO_MOA = 3437.747; // 1 radian = 3437.747 minutes of angle
const RAD_TO_MIL = 1000;     // 1 milliradian = 1/1000 radian, so radians * 1000 = mils


/* -------------------------------------------------------------------------
   2. DRAG CURVES (G1 and G7)
   -------------------------------------------------------------------------
   A bullet's air resistance changes a LOT with speed (especially near the
   speed of sound). These tables describe the "drag coefficient" (Cd) of a
   standard projectile shape at various Mach numbers (Mach = speed / speed of
   sound). G1 is a flat-base shape; G7 is a long boat-tail shape (better for
   modern long-range bullets like the 6.5 Creedmoor example).

   Each entry is [Mach, Cd]. We look up Cd by finding where our current Mach
   falls and drawing a straight line between the two nearest points.
   ------------------------------------------------------------------------- */

const G1_TABLE = [
  [0.00, 0.2629], [0.40, 0.2104], [0.50, 0.2032], [0.60, 0.2034],
  [0.70, 0.2165], [0.80, 0.2546], [0.85, 0.2901], [0.90, 0.3415],
  [0.95, 0.4084], [1.00, 0.4805], [1.05, 0.5427], [1.10, 0.5883],
  [1.15, 0.6191], [1.20, 0.6393], [1.30, 0.6589], [1.40, 0.6625],
  [1.50, 0.6573], [1.60, 0.6474], [1.80, 0.6210], [2.00, 0.5934],
  [2.20, 0.5685], [2.40, 0.5481], [2.60, 0.5306], [2.80, 0.5148],
  [3.00, 0.5000]
];

const G7_TABLE = [
  [0.00, 0.1198], [0.50, 0.1194], [0.70, 0.1202], [0.80, 0.1242],
  [0.85, 0.1306], [0.90, 0.1464], [0.95, 0.2054], [1.00, 0.3803],
  [1.05, 0.4043], [1.10, 0.4014], [1.15, 0.3955], [1.20, 0.3884],
  [1.30, 0.3732], [1.40, 0.3580], [1.50, 0.3440], [1.60, 0.3315],
  [1.70, 0.3209], [1.80, 0.3117], [1.90, 0.3042], [2.00, 0.2980],
  [2.10, 0.2922], [2.20, 0.2864], [2.30, 0.2807], [2.40, 0.2752],
  [2.50, 0.2697], [2.60, 0.2643], [2.70, 0.2592], [2.80, 0.2541],
  [3.00, 0.2447]
];

// Given a drag model name and a Mach number, return the drag coefficient.
// This is "linear interpolation": find the bracketing points and blend them.
function dragCoefficient(model, mach) {
  const table = (model === "G1") ? G1_TABLE : G7_TABLE;

  // Below or above the table, just clamp to the end values.
  if (mach <= table[0][0]) return table[0][1];
  if (mach >= table[table.length - 1][0]) return table[table.length - 1][1];

  for (let i = 0; i < table.length - 1; i++) {
    const [m1, cd1] = table[i];
    const [m2, cd2] = table[i + 1];
    if (mach >= m1 && mach <= m2) {
      const fraction = (mach - m1) / (m2 - m1); // 0..1 between the two points
      return cd1 + fraction * (cd2 - cd1);
    }
  }
  return table[table.length - 1][1]; // safety net (shouldn't reach here)
}


/* -------------------------------------------------------------------------
   3. ATMOSPHERE
   -------------------------------------------------------------------------
   Denser air = more drag. We compare the current air density to the standard
   density and get a ratio we can multiply into the drag.
   ------------------------------------------------------------------------- */

// Air density (slugs/ft^3) from temperature and pressure (the ideal gas law).
function airDensity(tempF, pressureInHg) {
  const tempRankine = tempF + 459.67;            // absolute temperature
  const stdTempRankine = STD_TEMP_F + 459.67;
  const ratio = (pressureInHg / STD_PRESSURE_INHG) * (stdTempRankine / tempRankine);
  return STD_DENSITY * ratio;
}

// Speed of sound (ft/s) depends on temperature only.
function speedOfSound(tempF) {
  const tempRankine = tempF + 459.67;
  return 49.0223 * Math.sqrt(tempRankine);
}

// Handy helper: what's the standard air pressure at a given altitude?
// Lets the UI offer "set pressure from altitude" so you don't have to look it up.
function pressureForAltitude(altitudeFt) {
  return STD_PRESSURE_INHG * Math.pow(1 - 6.8753e-6 * altitudeFt, 5.2559);
}


/* -------------------------------------------------------------------------
   4. THE TRAJECTORY SIMULATION
   -------------------------------------------------------------------------
   We track the bullet in a vertical plane:
     x = distance downrange (feet)
     y = height relative to the LINE OF SIGHT (feet). Negative means below it.
   The bullet starts at the muzzle, which sits `sight height` BELOW the scope's
   line of sight. We launch it at a small upward angle and step forward in time.
   ------------------------------------------------------------------------- */

const TIME_STEP = 0.0005; // seconds per step. Smaller = more accurate, slower.
const SAMPLE_STEP_FT = 15; // record the bullet's state every 15 ft (= 5 yards)

// Run one simulation with a given launch angle, out to `maxRangeFt`.
// Returns an array of samples: { xFt, yFt, timeS, velocityFps }.
function trace(profile, env, launchAngleRad, maxRangeFt) {
  const rho = airDensity(env.tempF, env.pressureInHg);
  const sos = speedOfSound(env.tempF);
  const sightHeightFt = profile.sightHeightIn / 12;

  // Start position: x=0, and y is sight height BELOW the line of sight.
  let x = 0;
  let y = -sightHeightFt;
  let t = 0;

  // Start velocity, split into horizontal and vertical parts.
  let vx = profile.muzzleVelocityFps * Math.cos(launchAngleRad);
  let vy = profile.muzzleVelocityFps * Math.sin(launchAngleRad);

  const samples = [];
  let nextSampleX = 0;

  // Keep stepping until we reach the max range (or run out of patience).
  while (x < maxRangeFt && t < 10) {
    const speed = Math.sqrt(vx * vx + vy * vy);
    const mach = speed / sos;
    const cd = dragCoefficient(profile.dragModel, mach);

    // Drag deceleration magnitude (points backwards along the velocity).
    const dragDecel = DRAG_CONST * rho * speed * speed * cd / profile.bc;

    // Acceleration components: drag opposes motion, gravity pulls down.
    const ax = -dragDecel * (vx / speed);
    const ay = -dragDecel * (vy / speed) - GRAVITY;

    // Step forward (simple Euler integration).
    vx += ax * TIME_STEP;
    vy += ay * TIME_STEP;
    x += vx * TIME_STEP;
    y += vy * TIME_STEP;
    t += TIME_STEP;

    // Record a sample every SAMPLE_STEP_FT feet.
    if (x >= nextSampleX) {
      samples.push({ xFt: x, yFt: y, timeS: t, velocityFps: Math.sqrt(vx * vx + vy * vy) });
      nextSampleX += SAMPLE_STEP_FT;
    }
  }
  return samples;
}

// Read the bullet's height (yFt) at a specific downrange distance, by
// interpolating between the two nearest samples.
function heightAtRange(samples, xFt) {
  if (samples.length === 0) return 0;
  if (xFt <= samples[0].xFt) return samples[0].yFt;
  for (let i = 0; i < samples.length - 1; i++) {
    if (xFt >= samples[i].xFt && xFt <= samples[i + 1].xFt) {
      const f = (xFt - samples[i].xFt) / (samples[i + 1].xFt - samples[i].xFt);
      return samples[i].yFt + f * (samples[i + 1].yFt - samples[i].yFt);
    }
  }
  return samples[samples.length - 1].yFt;
}

// Find the launch angle that makes the bullet cross the line of sight exactly
// at the zero distance. We use the "secant method": guess, see how wrong we
// are, and use that to make a better guess. A few rounds nail it.
function findLaunchAngle(profile, env) {
  const zeroFt = profile.zeroDistanceYd * 3;
  const measure = (angle) => heightAtRange(trace(profile, env, angle, zeroFt + 30), zeroFt);

  let a0 = 0.0,  f0 = measure(a0);
  let a1 = 0.02, f1 = measure(a1);
  for (let i = 0; i < 25; i++) {
    if (f1 === f0) break;
    const a2 = a1 - f1 * (a1 - a0) / (f1 - f0);
    const f2 = measure(a2);
    a0 = a1; f0 = f1;
    a1 = a2; f1 = f2;
    if (Math.abs(f2) < 0.0005) break; // within ~0.006 inch of the line of sight
  }
  return a1;
}


/* -------------------------------------------------------------------------
   5. PUTTING IT TOGETHER: solve()
   -------------------------------------------------------------------------
   Given a profile and the current conditions, produce:
     - a table of "samples" (one row per 5 yards) with drop & drift
     - a holdAt(distanceYd) function that gives the hold for any distance
   ------------------------------------------------------------------------- */

function solve(profile, env) {
  const MAX_RANGE_YD = 1200;        // simulate a bit past 1000 so stepping works
  const maxRangeFt = MAX_RANGE_YD * 3;

  const launchAngle = findLaunchAngle(profile, env);
  const samples = trace(profile, env, launchAngle, maxRangeFt);

  // Crosswind component in ft/s. The app passes crosswindMph (the part of the
  // wind blowing straight across the shot); we fall back to windSpeedMph for
  // any caller that still treats wind as full value.
  const crosswindMph = (env.crosswindMph !== undefined) ? env.crosswindMph : env.windSpeedMph;
  const crosswindFps = crosswindMph * MPH_TO_FPS;
  const vx0 = profile.muzzleVelocityFps * Math.cos(launchAngle); // ~horizontal speed

  // Incline (uphill/downhill) reduces the felt drop by cos(angle) — the
  // classic "rifleman's rule". 0 degrees = flat ground = no change.
  const inclineRad = (env.inclineDeg || 0) * Math.PI / 180;
  const cosIncline = Math.cos(inclineRad);

  // Turn each raw sample into shooter-friendly numbers.
  // - Elevation hold: how far below the line of sight is the bullet? Aim up that much.
  // - Wind drift: the classic "lag time" formula. The bullet lags behind where
  //   it would be in a vacuum, and the wind pushes it sideways during that lag.
  const rows = samples.map((s) => {
    const rangeYd = s.xFt / 3;

    // Elevation: y is negative when below the sight line; the hold is positive.
    // Multiplying by cosIncline applies the uphill/downhill correction.
    const dropAngleRad = ((s.xFt > 0) ? (-s.yFt / s.xFt) : 0) * cosIncline;

    // Wind drift (feet). vacuumTime = how long it WOULD take with no drag.
    const vacuumTime = s.xFt / vx0;
    const driftFt = crosswindFps * (s.timeS - vacuumTime);
    const driftAngleRad = (s.xFt > 0) ? (driftFt / s.xFt) : 0;

    return {
      rangeYd: rangeYd,
      dropInches: -s.yFt * 12 * cosIncline,
      dropMOA: dropAngleRad * RAD_TO_MOA,
      dropMil: dropAngleRad * RAD_TO_MIL,
      driftInches: driftFt * 12,
      driftMOA: driftAngleRad * RAD_TO_MOA,
      driftMil: driftAngleRad * RAD_TO_MIL,
      velocityFps: s.velocityFps,
      timeS: s.timeS
    };
  });

  // Interpolate a hold for ANY distance (not just the 5-yard sample marks).
  function holdAt(distanceYd) {
    if (rows.length === 0) return null;
    if (distanceYd <= rows[0].rangeYd) return rows[0];
    for (let i = 0; i < rows.length - 1; i++) {
      if (distanceYd >= rows[i].rangeYd && distanceYd <= rows[i + 1].rangeYd) {
        const a = rows[i], b = rows[i + 1];
        const f = (distanceYd - a.rangeYd) / (b.rangeYd - a.rangeYd);
        const blend = (key) => a[key] + f * (b[key] - a[key]);
        return {
          rangeYd: distanceYd,
          dropInches: blend("dropInches"),
          dropMOA: blend("dropMOA"),
          dropMil: blend("dropMil"),
          driftInches: blend("driftInches"),
          driftMOA: blend("driftMOA"),
          driftMil: blend("driftMil"),
          velocityFps: blend("velocityFps"),
          timeS: blend("timeS")
        };
      }
    }
    return rows[rows.length - 1];
  }

  return { rows: rows, holdAt: holdAt };
}


/* -------------------------------------------------------------------------
   6. THE PUBLIC API
   -------------------------------------------------------------------------
   Everything above is private to this file. We only hand the outside world
   the few functions it actually needs, bundled on one global object.
   ------------------------------------------------------------------------- */
const Ballistics = {
  solve: solve,
  pressureForAltitude: pressureForAltitude
};

// When run under Node.js (e.g. our test file), hand the object to `require`.
// In a browser there is no `module`, so this line is simply skipped.
if (typeof module !== "undefined" && module.exports) {
  module.exports = Ballistics;
}
