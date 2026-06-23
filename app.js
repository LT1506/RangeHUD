/* =========================================================================
   app.js  —  THE GLUE BETWEEN THE PAGE AND THE MATH
   -------------------------------------------------------------------------
   This is the ONLY file that touches the page (the "DOM" = Document Object
   Model, the browser's live tree of HTML elements). Its job:
     1. Read what the user typed.
     2. Ask ballistics.js to do the math.
     3. Write the answers back onto the page.
     4. Handle button clicks and screen switching.

   Everything runs after the page has loaded (the scripts are at the bottom of
   index.html, so all the elements already exist when this runs).
   ========================================================================= */

/* -------------------------------------------------------------------------
   A tiny helper so we don't type document.getElementById a hundred times.
   ------------------------------------------------------------------------- */
function $(id) {
  return document.getElementById(id);
}

/* -------------------------------------------------------------------------
   APP STATE: the few values we keep track of while the app is running.
   ------------------------------------------------------------------------- */
let profiles = Storage.loadProfiles();   // the array of saved profiles
let activeId = Storage.getActiveId() || profiles[0].id;
let hudDistanceYd = 500;                 // the distance the HUD is showing
let editingId = null;                    // which profile the form is editing (null = new)

/* -------------------------------------------------------------------------
   SCREEN SWITCHING
   Hide every .screen, then show the one we want.
   ------------------------------------------------------------------------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
  // On the glasses there's no touch — put the cursor on the first control so a
  // swipe has somewhere to start from.
  if (document.body.classList.contains("glasses")) {
    const first = $(id).querySelector("input, select, button");
    if (first) first.focus();
  }
}

/* -------------------------------------------------------------------------
   READING THE CURRENT INPUTS
   ------------------------------------------------------------------------- */

// Find the profile object that is currently selected.
function getActiveProfile() {
  return profiles.find((p) => p.id === activeId) || profiles[0];
}

// Gather the condition fields into one plain object for the solver.
// We turn wind speed + clock direction into the crosswind COMPONENT (the part
// blowing straight across the shot) plus which side it favors. A 3 o'clock
// wind is full value from the right; 6/12 o'clock is pure tail/head (no drift).
function getConditions() {
  const windSpeedMph = Number($("windSpeed").value);
  const clock = Number($("windClock").value);
  const angleRad = clock * 30 * Math.PI / 180;   // each clock hour = 30 degrees
  const sideways = Math.sin(angleRad);            // +1 at 3 o'clock, -1 at 9 o'clock

  let windSide = "—";                             // "—" = pure head/tail, no drift
  if (sideways > 0.001) windSide = "R";
  else if (sideways < -0.001) windSide = "L";

  return {
    windSpeedMph: windSpeedMph,
    windClock: clock,
    crosswindMph: windSpeedMph * Math.abs(sideways),
    windSide: windSide,
    tempF: Number($("temp").value),
    pressureInHg: Number($("pressure").value),
    altitudeFt: Number($("altitude").value),
    inclineDeg: Number($("incline").value)
  };
}

/* -------------------------------------------------------------------------
   PROFILE DROPDOWN
   Rebuild the <select> options from our profiles array.
   ------------------------------------------------------------------------- */
function refreshProfileSelect() {
  const select = $("profileSelect");
  select.innerHTML = ""; // clear out the old options
  profiles.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.name;
    if (p.id === activeId) option.selected = true;
    select.appendChild(option);
  });
}

/* -------------------------------------------------------------------------
   CARTRIDGE LIBRARY DROPDOWN
   Fill the "Add from library" <select> from the read-only PRESETS list. We
   store each option's value as its INDEX into PRESETS, so the change handler
   can look the chosen preset straight back up.
   ------------------------------------------------------------------------- */
function fillLibrarySelect() {
  const select = $("librarySelect");
  select.innerHTML = ""; // clear out the old options

  // A placeholder first row so the dropdown starts on a non-cartridge choice.
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Add from library…";
  placeholder.selected = true;
  select.appendChild(placeholder);

  PRESETS.forEach((preset, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = preset.name;
    select.appendChild(option);
  });
}

/* -------------------------------------------------------------------------
   THE PROFILE EDITOR FORM
   ------------------------------------------------------------------------- */

// Open the form. If `profile` is given we're editing; otherwise it's blank/new.
function openProfileForm(profile) {
  editingId = profile ? profile.id : null;
  $("profileFormTitle").textContent = profile ? "Edit Profile" : "New Profile";

  // Fill the fields (use blanks for a brand-new profile).
  $("pfName").value = profile ? profile.name : "";
  $("pfCaliber").value = profile ? profile.caliber : "";
  $("pfWeight").value = profile ? profile.bulletWeightGr : "";
  $("pfDragModel").value = profile ? profile.dragModel : "G7";
  $("pfBc").value = profile ? profile.bc : "";
  $("pfMv").value = profile ? profile.muzzleVelocityFps : "";
  $("pfZero").value = profile ? profile.zeroDistanceYd : 100;
  $("pfSight").value = profile ? profile.sightHeightIn : 1.5;

  $("profileForm").classList.remove("hidden");
}

function closeProfileForm() {
  $("profileForm").classList.add("hidden");
}

// Read the form fields and save (either updating or adding a profile).
function saveProfileFromForm() {
  const profile = {
    // Reuse the id if editing; otherwise make a fresh unique one.
    id: editingId || ("p" + Date.now()),
    name: $("pfName").value || "Unnamed",
    caliber: $("pfCaliber").value,
    bulletWeightGr: Number($("pfWeight").value),
    dragModel: $("pfDragModel").value,
    bc: Number($("pfBc").value),
    muzzleVelocityFps: Number($("pfMv").value),
    zeroDistanceYd: Number($("pfZero").value),
    sightHeightIn: Number($("pfSight").value)
  };

  // Basic sanity check on the values the math depends on.
  if (!(profile.bc > 0) || !(profile.muzzleVelocityFps > 0)) {
    alert("Please enter a positive BC and muzzle velocity.");
    return;
  }

  if (editingId) {
    // Replace the existing profile in the array.
    const i = profiles.findIndex((p) => p.id === editingId);
    profiles[i] = profile;
  } else {
    profiles.push(profile);
  }

  activeId = profile.id;
  Storage.saveProfiles(profiles);
  Storage.setActiveId(activeId);
  refreshProfileSelect();
  closeProfileForm();
}

function deleteActiveProfile() {
  if (profiles.length <= 1) {
    alert("Keep at least one profile.");
    return;
  }
  if (!confirm("Delete this profile?")) return;
  profiles = profiles.filter((p) => p.id !== activeId);
  activeId = profiles[0].id;
  Storage.saveProfiles(profiles);
  Storage.setActiveId(activeId);
  refreshProfileSelect();
}

/* -------------------------------------------------------------------------
   RENDERING THE HUD
   ------------------------------------------------------------------------- */
let lastSpeech = "";  // the most recent spoken summary (for the Speak button/gesture)

function renderHud() {
  const profile = getActiveProfile();
  const conditions = getConditions();

  // Do the physics, then read the hold for the current distance.
  const solution = Ballistics.solve(profile, conditions);
  const hold = solution.holdAt(hudDistanceYd);

  // Ask the platform adapter to format the answer for us. This keeps the HUD
  // free of formatting decisions and ready for the glasses (which can also
  // speak the result and show a compact line).
  const out = Platform.formatSolution({
    profileName: profile.name,
    distanceYd: hudDistanceYd,
    hold: hold,
    windSide: conditions.windSide,
    inclineDeg: conditions.inclineDeg
  });
  lastSpeech = out.speech;

  // Show the profile name, plus the shot angle if it isn't flat ground.
  const inc = conditions.inclineDeg;
  $("hudProfile").textContent = profile.name + (inc ? "  •  " + inc + "°" : "");
  $("hudDistance").textContent = hudDistanceYd;

  $("hudElevMil").textContent = out.card.elevMil.toFixed(1);
  $("hudElevMOA").textContent = out.card.elevMOA.toFixed(1);

  const prefix = (out.card.windMil < 0.05) ? "" : out.card.windSide + " ";
  $("hudWindMil").textContent = prefix + out.card.windMil.toFixed(1);
  $("hudWindMOA").textContent = Math.abs(hold.driftMOA).toFixed(1);
}

/* -------------------------------------------------------------------------
   RENDERING THE DOPE TABLE
   One row per 25 yards from 25 to 1000.
   ------------------------------------------------------------------------- */
function renderDope() {
  const profile = getActiveProfile();
  const conditions = getConditions();
  const solution = Ballistics.solve(profile, conditions);

  $("dopeProfile").textContent = profile.name + " — DOPE";

  const body = $("dopeBody");
  body.innerHTML = "";

  for (let yd = 25; yd <= 1000; yd += 25) {
    const h = solution.holdAt(yd);
    const row = document.createElement("tr");
    row.innerHTML =
      "<td>" + yd + "</td>" +
      "<td>" + h.dropMil.toFixed(1) + "</td>" +
      "<td>" + h.dropMOA.toFixed(1) + "</td>" +
      "<td>" + Math.abs(h.driftMil).toFixed(1) + "</td>" +
      "<td>" + Math.round(h.velocityFps) + "</td>";
    body.appendChild(row);
  }
}

/* -------------------------------------------------------------------------
   LIVE WEATHER
   -------------------------------------------------------------------------
   We fetch real conditions from Open-Meteo, a free weather service that needs
   no API key. First we need a location:
     - Best: the browser's Geolocation (asks your permission, most accurate).
     - Fallback: a rough location from your internet address (no permission,
       handy when geolocation is blocked, e.g. opening the file directly).
   These are "async" functions: they talk to the internet, which takes time,
   so we use `await` to wait for each answer before moving on.
   ------------------------------------------------------------------------- */

// Look up an approximate location from the user's IP address.
async function ipLocation() {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("location lookup failed");
  const data = await res.json();
  return { lat: data.latitude, lon: data.longitude };
}

// Get coordinates: try the precise browser API, fall back to IP if it fails.
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      ipLocation().then(resolve, reject);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => ipLocation().then(resolve, reject), // denied/blocked -> IP fallback
      { timeout: 8000 }
    );
  });
}

// Ask Open-Meteo for the current weather at a latitude/longitude.
async function getWeather(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + lat + "&longitude=" + lon +
    "&current=temperature_2m,surface_pressure,wind_speed_10m" +
    "&temperature_unit=fahrenheit&wind_speed_unit=mph";
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather service error");
  const data = await res.json();
  const c = data.current;
  return {
    tempF: c.temperature_2m,
    pressureInHg: c.surface_pressure * 0.02953, // hPa -> inches of mercury
    windMph: c.wind_speed_10m,
    elevationFt: data.elevation * 3.28084        // meters -> feet
  };
}

// The button handler: tie it all together and fill in the fields.
// Remember the location from the first lookup so repeat weather pulls (the
// HUD's auto-wind) don't re-prompt for GPS every time.
let lastCoords = null;
async function getLocationCached() {
  if (!lastCoords) lastCoords = await getLocation();
  return lastCoords;
}

async function fetchWeatherIntoForm() {
  const btn = $("getWeatherBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Getting weather…";
  try {
    const where = await getLocationCached();
    const w = await getWeather(where.lat, where.lon);

    $("temp").value = Math.round(w.tempF);
    $("pressure").value = w.pressureInHg.toFixed(2);
    $("altitude").value = Math.round(w.elevationFt);
    $("windSpeed").value = Math.round(w.windMph);
    persistSession();

    btn.textContent = "✓ Updated";
  } catch (err) {
    alert(
      "Couldn't fetch weather (" + err.message + ").\n" +
      "Check your internet connection, or just enter conditions by hand."
    );
    btn.textContent = original;
  } finally {
    // Re-enable after a moment so you can see the result.
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
  }
}

/* -------------------------------------------------------------------------
   REAL-TIME WIND (auto-refresh)
   -------------------------------------------------------------------------
   When toggled on, re-pull the current weather every 30 seconds (reusing the
   cached location) and update the wind so the HUD's holdover stays live. We
   keep your wind DIRECTION (the clock) and only refresh the speed + air, then
   re-render the HUD.
   ------------------------------------------------------------------------- */
let windTimer = null;

async function refreshWindOnly() {
  try {
    const where = await getLocationCached();
    const w = await getWeather(where.lat, where.lon);
    $("windSpeed").value = Math.round(w.windMph);
    $("temp").value = Math.round(w.tempF);
    $("pressure").value = w.pressureInHg.toFixed(2);
    persistSession();
    if (!$("hud").classList.contains("hidden")) renderHud();
  } catch (e) {
    /* offline or denied — just keep the last values */
  }
}

function stopAutoWind() {
  if (windTimer) { clearInterval(windTimer); windTimer = null; }
  $("autoWindBtn").textContent = "Auto-wind: off";
}

function toggleAutoWind() {
  if (windTimer) {
    stopAutoWind();
  } else {
    $("autoWindBtn").textContent = "Auto-wind: on";
    refreshWindOnly();                              // update immediately
    windTimer = setInterval(refreshWindOnly, 30000); // then every 30s
  }
}

/* -------------------------------------------------------------------------
   TRUING: calibrate a profile to real range data
   -------------------------------------------------------------------------
   You enter the elevation (in mils) that ACTUALLY hit at a known distance.
   We then nudge one parameter (muzzle velocity OR ballistic coefficient) up
   and down until the predicted hold matches what you saw. Same "secant method"
   idea used to find the launch angle in ballistics.js: guess, measure the
   error, use it to guess better.
   ------------------------------------------------------------------------- */
function trueProfile(profile, env, distanceYd, observedMil, param) {
  const base = profile[param];

  // How wrong is a trial value? (predicted drop minus your observed drop)
  function error(value) {
    const trial = Object.assign({}, profile); // a copy, so we don't disturb the real one
    trial[param] = value;
    const solution = Ballistics.solve(trial, env);
    return solution.holdAt(distanceYd).dropMil - observedMil;
  }

  let x0 = base * 0.9, f0 = error(x0);
  let x1 = base * 1.1, f1 = error(x1);
  for (let i = 0; i < 30; i++) {
    if (f1 === f0) break;
    let x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
    // Keep the answer physically sane.
    const min = base * 0.5, max = base * (param === "bc" ? 2 : 1.5);
    x2 = Math.max(min, Math.min(max, x2));
    const f2 = error(x2);
    x0 = x1; f0 = f1;
    x1 = x2; f1 = f2;
    if (Math.abs(f2) < 0.01) break; // within 0.01 mil = close enough
  }
  return x1;
}

function doTruing() {
  const profile = getActiveProfile();
  const env = getConditions();
  const distanceYd = Number($("trueDistance").value);
  const observedMil = Number($("trueObserved").value);
  const param = $("trueParam").value;

  if (!(distanceYd > 0) || !(observedMil > 0)) {
    alert("Enter a distance and the observed elevation in mils.");
    return;
  }

  const newValue = trueProfile(profile, env, distanceYd, observedMil, param);
  // profile is a live reference into our profiles array, so this updates it.
  profile[param] = (param === "bc") ? Number(newValue.toFixed(3)) : Math.round(newValue);
  Storage.saveProfiles(profiles);
  refreshProfileSelect();

  $("trueResult").textContent = (param === "bc")
    ? "Trued: BC = " + profile.bc
    : "Trued: muzzle velocity = " + profile.muzzleVelocityFps + " fps";
}

/* -------------------------------------------------------------------------
   READ SHOT ANGLE FROM THE PHONE'S TILT SENSOR (one-shot)
   -------------------------------------------------------------------------
   `deviceorientation` reports the phone's tilt. `beta` is the front-to-back
   tilt in degrees — roughly the up/down angle when you point the phone at a
   target. We grab one reading, then stop listening. Desktops have no sensor,
   so we fail politely and let you type the angle instead.
   ------------------------------------------------------------------------- */
function readTilt(targetId) {
  function handle(e) {
    const angle = Math.round(Math.abs(e.beta || 0));
    $(targetId).value = angle;
    window.removeEventListener("deviceorientation", handle);
  }
  // iOS requires asking permission first.
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === "granted") window.addEventListener("deviceorientation", handle);
        else alert("Tilt permission denied — enter the angle by hand.");
      })
      .catch(() => alert("Tilt unavailable — enter the angle by hand."));
  } else if ("ondeviceorientation" in window) {
    window.addEventListener("deviceorientation", handle);
  } else {
    alert("No tilt sensor here (e.g. on a desktop) — enter the angle by hand.");
  }
}

/* -------------------------------------------------------------------------
   WIRING UP ALL THE BUTTONS / EVENTS
   "When the user does X, run function Y."
   ------------------------------------------------------------------------- */
$("getWeatherBtn").addEventListener("click", fetchWeatherIntoForm);
$("trueBtn").addEventListener("click", doTruing);
$("readTiltBtn").addEventListener("click", () => readTilt("incline"));
$("autoWindBtn").addEventListener("click", toggleAutoWind);

// Profile picker
$("profileSelect").addEventListener("change", (e) => {
  activeId = e.target.value;
  Storage.setActiveId(activeId);
});
// Cartridge library: picking one opens a blank New Profile form, then fills it
// in. We open the form with openProfileForm(null) FIRST so editingId is null and
// the title says "New Profile" — then overwrite the fields with the preset's
// values. (Passing the preset straight into openProfileForm would treat it like
// an existing profile being edited, which we don't want.)
$("librarySelect").addEventListener("change", (e) => {
  const idx = e.target.value;
  if (idx === "") return;                 // the placeholder row — nothing to do
  const preset = PRESETS[Number(idx)];

  openProfileForm(null);                   // blank New Profile form first...
  $("pfName").value = preset.name;         // ...then fill it from the preset
  $("pfCaliber").value = preset.caliber;
  $("pfWeight").value = preset.bulletWeightGr;
  $("pfDragModel").value = preset.dragModel;
  $("pfBc").value = preset.bc;
  $("pfMv").value = preset.muzzleVelocityFps;
  $("pfZero").value = preset.zeroDistanceYd;
  $("pfSight").value = preset.sightHeightIn;

  // Reset to the placeholder so the SAME cartridge can be picked again — a
  // <select> only fires "change" when its value actually changes.
  e.target.value = "";
});
$("newProfileBtn").addEventListener("click", () => openProfileForm(null));
$("editProfileBtn").addEventListener("click", () => openProfileForm(getActiveProfile()));
$("deleteProfileBtn").addEventListener("click", deleteActiveProfile);
$("saveProfileBtn").addEventListener("click", saveProfileFromForm);
$("cancelProfileBtn").addEventListener("click", closeProfileForm);

// Altitude → pressure helper
$("altToPressureBtn").addEventListener("click", () => {
  const alt = Number($("altitude").value);
  $("pressure").value = Ballistics.pressureForAltitude(alt).toFixed(2);
});

// Go to the HUD
$("goHudBtn").addEventListener("click", () => {
  hudDistanceYd = Number($("targetDistance").value);
  renderHud();
  showScreen("hud");
});

// HUD actions, defined once so taps, keys, and gestures all reuse them.
function stepDistance(deltaYd) {
  hudDistanceYd = Math.max(0, Math.min(1200, hudDistanceYd + deltaYd));
  $("targetDistance").value = hudDistanceYd;  // keep them in sync...
  persistSession();                           // ...and remember it
  renderHud();
}
function speakHud() {
  if (lastSpeech) Platform.speak(lastSpeech);
}
function hudToSetup() {
  stopAutoWind();   // don't keep polling weather after we leave the HUD
  showScreen("setup");
}

$("hudSpeak").addEventListener("click", speakHud);
$("hudBack").addEventListener("click", hudToSetup);

// Route swipes/keys to the HUD. The model that fits the Neural Band:
//   up/down    -> distance +/- 25
//   left/right -> move the highlight across the action buttons
//   pinch      -> press the highlighted button (native), or Speak if none
//   pinch-back -> Setup
function hudVisible() { return !$("hud").classList.contains("hidden"); }

// The action buttons you can land on (Speak / Auto-wind / Log shot / Setup).
function hudButtons() {
  return Array.prototype.slice
    .call($("hud").querySelectorAll(".button-row button"))
    .filter((el) => el.offsetParent !== null);
}
function moveHudFocus(delta) {
  const els = hudButtons();
  if (els.length === 0) return;
  let i = els.indexOf(document.activeElement);
  i = (i < 0) ? (delta > 0 ? 0 : els.length - 1) : (i + delta + els.length) % els.length;
  els[i].focus();
}

// (Double-pinch is unavailable: Meta's OS claims the thumb-index double-pinch
// as a system gesture, so the web app never receives it. Everything uses single
// pinch + swipes instead.)
Platform.bindInputs({
  onUp:    () => { if (hudVisible()) stepDistance(25); },
  onDown:  () => { if (hudVisible()) stepDistance(-25); },
  onLeft:  () => { if (hudVisible()) moveHudFocus(-1); },
  onRight: () => { if (hudVisible()) moveHudFocus(1); },
  onSelect: () => {
    if (!hudVisible()) return;
    const a = document.activeElement;
    // A highlighted button is pressed by the native Enter; otherwise pinch reads
    // the solution aloud.
    if (a && a.tagName === "BUTTON" && $("hud").contains(a)) return;
    speakHud();
  },
  onBack:  () => { if (hudVisible()) hudToSetup(); }
});

// DOPE table
$("goDopeBtn").addEventListener("click", () => {
  renderDope();
  showScreen("dope");
});
$("dopeBack").addEventListener("click", () => showScreen("setup"));


/* =========================================================================
   LOG SHOT  —  record where a shot actually hit
   =========================================================================
   When you tap "Log shot" on the HUD, we freeze the current situation
   (profile, conditions, distance, and the hold we showed) so the saved record
   reflects exactly what you were holding when you fired.
   ------------------------------------------------------------------------- */
let logContext = null;        // the frozen situation for the shot being logged
let impactOffset = null;      // { wind, elev } in mils
let currentHit = true;        // Hit (true) or Miss (false)

function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }

// Switch the Log Shot screen between its two steps.
function showLogStep(step) {
  $("logPlace").classList.toggle("hidden", step !== "place");
  $("logResult").classList.toggle("hidden", step !== "result");
}

function openLogShot() {
  const profile = getActiveProfile();
  const conditions = getConditions();
  const hold = Ballistics.solve(profile, conditions).holdAt(hudDistanceYd);
  logContext = { profile: profile, conditions: conditions, distanceYd: hudDistanceYd, hold: hold };

  // Reset to step 1. The marker starts at dead center (point of aim); you then
  // tap (phone) or swipe (glasses) to move it to the real impact.
  impactOffset = { wind: 0, elev: 0 };
  currentHit = true;
  showLogStep("place");
  renderImpact();
  $("logAngle").value = conditions.inclineDeg || 0;

  $("logContext").textContent = hudDistanceYd + " yd · " + profile.name;
  const windTxt = (Math.abs(hold.driftMil) < 0.05)
    ? "calm" : conditions.windSide + " " + Math.abs(hold.driftMil).toFixed(1) + " mil";
  $("logPredicted").textContent = "You held: UP " + hold.dropMil.toFixed(1) + " mil · wind " + windTxt;

  showScreen("logshot");
}

// Draw the impact marker at the current offset and update the readout.
function renderImpact() {
  if (!impactOffset) return;
  const w = impactOffset.wind, e = impactOffset.elev;
  const dot = $("impactDot");
  dot.setAttribute("cx", w);
  dot.setAttribute("cy", -e);        // screen y is inverted for drawing
  dot.style.display = "";

  const dist = logContext ? logContext.distanceYd : 100;
  const inPerMil = 0.036 * dist;     // 1 mil ≈ 3.6 in at 100 yd
  $("impactReadout").textContent =
    Math.abs(w).toFixed(1) + " mil " + (w >= 0 ? "R" : "L") + ", " +
    Math.abs(e).toFixed(1) + " mil " + (e >= 0 ? "high" : "low") +
    "  (" + Math.abs(w * inPerMil).toFixed(1) + "\" / " +
    Math.abs(e * inPerMil).toFixed(1) + "\" @ " + dist + " yd)";
}

// Phone: tap the SVG target to place the marker.
function onGridTap(clientX, clientY) {
  const grid = $("impactGrid");
  const rect = grid.getBoundingClientRect();
  const fx = (clientX - rect.left) / rect.width;   // 0..1 left→right
  const fy = (clientY - rect.top) / rect.height;   // 0..1 top→bottom
  impactOffset = {
    wind: clamp(-3 + fx * 6, -3, 3),               // viewBox spans -3..3 mils
    elev: clamp(-(-3 + fy * 6), -3, 3)             // invert: up is positive
  };
  renderImpact();
}

// Glasses: nudge the marker with swipes.
function nudgeImpact(dWind, dElev) {
  if (!impactOffset) impactOffset = { wind: 0, elev: 0 };
  impactOffset.wind = clamp(impactOffset.wind + dWind, -3, 3);
  impactOffset.elev = clamp(impactOffset.elev + dElev, -3, 3);
  renderImpact();
}

// Move from "place the dot" to "hit or miss", filling in the summary.
function goLogResult() {
  if (!impactOffset) return;
  const w = impactOffset.wind, e = impactOffset.elev;
  $("logResultSummary").textContent =
    "Impact " + Math.abs(w).toFixed(1) + " mil " + (w >= 0 ? "R" : "L") + ", " +
    Math.abs(e).toFixed(1) + " mil " + (e >= 0 ? "high" : "low") + " — hit or miss?";
  showLogStep("result");
  $("saveHitBtn").focus();   // default highlight = Save as HIT
}

function saveShot() {
  if (!impactOffset || !logContext) return;
  const c = logContext;
  Shots.addShot({
    id: "s" + Date.now(),
    timestamp: new Date().toISOString(),
    profileName: c.profile.name,
    distanceYd: c.distanceYd,
    windSpeedMph: c.conditions.windSpeedMph,
    windClock: c.conditions.windClock,
    windSide: c.conditions.windSide,
    tempF: c.conditions.tempF,
    pressureInHg: c.conditions.pressureInHg,
    shotAngleDeg: Number($("logAngle").value),
    predDropMil: c.hold.dropMil,
    predWindMil: Math.abs(c.hold.driftMil),
    hit: currentHit,
    offsetWindMil: impactOffset.wind,
    offsetElevMil: impactOffset.elev
  });
  showScreen("hud");   // back to the HUD, ready for the next shot
}

$("hudLog").addEventListener("click", openLogShot);
$("impactGrid").addEventListener("click", (e) => onGridTap(e.clientX, e.clientY));
$("logReadTilt").addEventListener("click", () => readTilt("logAngle"));
$("toResultBtn").addEventListener("click", goLogResult);
$("cancelShotBtn").addEventListener("click", () => showScreen("hud"));
$("saveHitBtn").addEventListener("click", () => { currentHit = true; saveShot(); });
$("saveMissBtn").addEventListener("click", () => { currentHit = false; saveShot(); });
$("backToPlaceBtn").addEventListener("click", () => showLogStep("place"));


/* =========================================================================
   RANGE LOG / ANALYSIS
   ========================================================================= */
function renderAnalysis() {
  const shots = Shots.loadShots();

  // Build the Profile filter from the names that actually appear.
  const profileNames = [];
  shots.forEach((s) => { if (profileNames.indexOf(s.profileName) === -1) profileNames.push(s.profileName); });
  fillSelect("analysisProfile", ["ALL"].concat(profileNames), "All profiles");

  // Build the Distance filter from the distances that actually appear.
  const distances = [];
  shots.forEach((s) => { if (distances.indexOf(s.distanceYd) === -1) distances.push(s.distanceYd); });
  distances.sort((a, b) => a - b);
  fillSelect("analysisDistance", ["ALL"].concat(distances), "All distances");

  applyAnalysisFilters();
}

// Helper: refill a <select> with options (value ALL shows the given label).
function fillSelect(id, values, allLabel) {
  const sel = $(id);
  sel.innerHTML = "";
  values.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = (v === "ALL") ? allLabel : (typeof v === "number" ? v + " yd" : v);
    sel.appendChild(o);
  });
}

function applyAnalysisFilters() {
  let shots = Shots.loadShots();
  const pf = $("analysisProfile").value;
  const df = $("analysisDistance").value;
  if (pf !== "ALL") shots = shots.filter((s) => s.profileName === pf);
  if (df !== "ALL") shots = shots.filter((s) => String(s.distanceYd) === df);

  const stats = Shots.analyze(shots);

  // ---- Summary stats ----
  const sum = $("analysisSummary");
  if (!stats.count) {
    sum.innerHTML = "<p class='hint'>No shots match. Log some from the HUD.</p>";
  } else {
    const biasW = Math.abs(stats.biasWindMil).toFixed(1) + " " + (stats.biasWindMil >= 0 ? "R" : "L");
    const biasE = Math.abs(stats.biasElevMil).toFixed(1) + " " + (stats.biasElevMil >= 0 ? "high" : "low");
    sum.innerHTML =
      "<div class='stat-grid'>" +
      stat(stats.count, "shots") +
      stat(Math.round(stats.hitRate * 100) + "%", "hit rate") +
      stat(biasE + " / " + biasW, "group center (bias)") +
      stat(stats.precisionMeanMil.toFixed(1) + " mil", "avg spread (precision)") +
      "</div>";
  }

  // ---- Coaching insights ----
  const ins = Shots.insights(stats);
  $("analysisInsights").innerHTML = ins.map((t) => "<p class='insight'>• " + t + "</p>").join("");

  // ---- Shot list (newest first) ----
  const body = $("shotList");
  body.innerHTML = "";
  shots.slice().reverse().forEach((s) => {
    const when = new Date(s.timestamp);
    const stamp = (when.getMonth() + 1) + "/" + when.getDate() + " " +
                  when.getHours() + ":" + String(when.getMinutes()).padStart(2, "0");
    const off = Math.abs(s.offsetWindMil).toFixed(1) + (s.offsetWindMil >= 0 ? "R" : "L") + " " +
                Math.abs(s.offsetElevMil).toFixed(1) + (s.offsetElevMil >= 0 ? "↑" : "↓");
    const row = document.createElement("tr");
    row.innerHTML =
      "<td>" + stamp + "</td>" +
      "<td>" + s.distanceYd + "</td>" +
      "<td>" + (s.hit ? "Hit" : "Miss") + "</td>" +
      "<td>" + off + "</td>" +
      "<td><button class='del-btn' data-id='" + s.id + "'>✕</button></td>";
    body.appendChild(row);
  });
}

// One summary tile.
function stat(num, label) {
  return "<div class='stat'><div class='num'>" + num + "</div><div class='lbl'>" + label + "</div></div>";
}

$("goAnalysisBtn").addEventListener("click", () => { renderAnalysis(); showScreen("analysis"); });
$("analysisProfile").addEventListener("change", applyAnalysisFilters);
$("analysisDistance").addEventListener("change", applyAnalysisFilters);
$("analysisBack").addEventListener("click", () => showScreen("setup"));
$("clearShotsBtn").addEventListener("click", () => {
  if (confirm("Delete ALL logged shots? This can't be undone.")) {
    Shots.clearShots();
    renderAnalysis();
  }
});
// Delete a single shot (the buttons are created dynamically, so we listen on
// the table and check what was clicked — this is called "event delegation").
$("shotList").addEventListener("click", (e) => {
  const id = e.target.getAttribute("data-id");
  if (id) { Shots.deleteShot(id); applyAnalysisFilters(); }
});


/* -------------------------------------------------------------------------
   SESSION PERSISTENCE
   -------------------------------------------------------------------------
   Save the condition fields + target distance so the app reopens where you
   left off, instead of resetting to defaults every launch.
   ------------------------------------------------------------------------- */
const SESSION_FIELDS = ["windSpeed", "windClock", "temp", "pressure", "altitude", "incline", "targetDistance"];

function persistSession() {
  const session = {};
  SESSION_FIELDS.forEach((id) => { session[id] = $(id).value; });
  Storage.saveSession(session);
}

function restoreSession() {
  const session = Storage.loadSession();
  if (!session) return;
  SESSION_FIELDS.forEach((id) => {
    if (session[id] !== undefined && session[id] !== "") $(id).value = session[id];
  });
}

// Any edit on the Setup screen is remembered. (Programmatic changes — weather,
// auto-wind, distance stepping — call persistSession() directly, since a
// scripted value change doesn't fire a "change" event.)
$("setup").addEventListener("change", persistSession);

/* -------------------------------------------------------------------------
   STARTUP
   Fill the dropdown, restore the last session, show the setup screen.
   ------------------------------------------------------------------------- */
refreshProfileSelect();
fillLibrarySelect();
restoreSession();
showScreen("setup");

// Show which build is loaded — lets us confirm an update actually reached the
// glasses (read it at the bottom of the Setup screen).
const APP_VERSION = "v13";
$("buildTag").textContent = "RangeHUD " + APP_VERSION;
$("appTitle").textContent = "RangeHUD " + APP_VERSION;  // version up top, easy to spot

// Form navigation for keyboard / Neural-Band swipes. Enabled EVERYWHERE (not
// just ?glasses=1): on the real glasses you load the plain URL, and this is
// what lets a swipe move OFF a number field instead of being trapped changing
// its value. It's inert with touch/mouse and only touches the keys/scroll that
// would otherwise trap you. The cosmetic lens-sizing still waits for ?glasses=1.
enableFormKeyNav();
enableLogShotNav();
if (Platform.isGlasses()) {
  document.body.classList.add("glasses");
}

/* -------------------------------------------------------------------------
   FORM KEY / SWIPE NAVIGATION
   -------------------------------------------------------------------------
   On the glasses the Neural Band has no pointer — you swipe. The problem: a
   swipe lands on a focused number field and gets eaten (changing its value),
   so you can't move on. We don't yet know for certain whether the band sends
   swipes as ARROW KEYS or as SCROLL events, so we handle BOTH:

       arrow Left/Right  -> move to previous / next control
       arrow Up/Down     -> change a value field (native); move off anything else
       scroll over a number field -> move focus instead of changing the value

   The HUD is left alone (it has its own swipe-to-step-distance). Inert with a
   mouse/touch on the phone, so it can't regress those.
   ------------------------------------------------------------------------- */
function enableFormKeyNav() {
  // All the controls you can land on, in the currently visible screen.
  function controls() {
    const screen = document.querySelector(".screen:not(.hidden)");
    if (!screen) return [];
    return Array.prototype.slice
      .call(screen.querySelectorAll("input, select, button"))
      .filter((el) => el.offsetParent !== null && !el.disabled); // visible + enabled
  }

  function moveFocus(delta) {
    const els = controls();
    if (els.length === 0) return;
    let i = els.indexOf(document.activeElement);
    i = (i + delta + els.length) % els.length; // wrap around the list
    els[i].focus();
    els[i].scrollIntoView({ block: "center" });
  }

  function isValueField(el) {
    return el && (el.tagName === "SELECT" ||
                  (el.tagName === "INPUT" && el.type === "number"));
  }

  function otherScreenHandles() {
    // The HUD and the Log Shot screen drive their own swipes.
    return !$("hud").classList.contains("hidden") ||
           !$("logshot").classList.contains("hidden");
  }

  // ---- If swipes arrive as ARROW KEYS ----
  document.addEventListener("keydown", (e) => {
    if (otherScreenHandles()) return;
    const el = document.activeElement;
    if (e.key === "ArrowRight") { e.preventDefault(); moveFocus(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); moveFocus(-1); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Up/Down edits a value field (native); on a button it just moves.
      if (!isValueField(el)) { e.preventDefault(); moveFocus(e.key === "ArrowDown" ? 1 : -1); }
    }
  });

  // ---- If swipes arrive as SCROLL/WHEEL events ----
  // A focused number field changes its value on wheel; intercept that so a
  // swipe moves between fields instead of being trapped.
  document.addEventListener("wheel", (e) => {
    if (otherScreenHandles()) return;
    if (isValueField(document.activeElement)) {
      e.preventDefault();
      moveFocus(e.deltaY > 0 ? 1 : -1);
    }
  }, { passive: false });
}

/* -------------------------------------------------------------------------
   LOG SHOT GESTURES (glasses) — two steps, single pinch only
   -------------------------------------------------------------------------
   STEP "place":  swipe up/down/left/right -> nudge the dot (0.1 mil/swipe)
                  pinch  -> go to the hit/miss step
                  back   -> cancel (HUD)
   STEP "result": swipe  -> highlight Save HIT / Save MISS / Re-place
                  pinch  -> choose the highlighted one (native button press)
                  back   -> return to placing
   (No double-pinch anywhere — the OS eats it.)
   ------------------------------------------------------------------------- */
function enableLogShotNav() {
  const STEP = 0.1;         // mils moved per swipe
  function visible() { return !$("logshot").classList.contains("hidden"); }
  function placing() { return !$("logPlace").classList.contains("hidden"); }

  function resultButtons() {
    return [$("saveHitBtn"), $("saveMissBtn"), $("backToPlaceBtn")];
  }
  function moveResultFocus(delta) {
    const els = resultButtons();
    let i = els.indexOf(document.activeElement);
    i = (i < 0) ? (delta > 0 ? 0 : els.length - 1) : (i + delta + els.length) % els.length;
    els[i].focus();
  }

  document.addEventListener("keydown", (e) => {
    if (!visible()) return;

    if (placing()) {
      switch (e.key) {
        case "ArrowLeft":  e.preventDefault(); nudgeImpact(-STEP, 0); break;
        case "ArrowRight": e.preventDefault(); nudgeImpact(STEP, 0); break;
        case "ArrowUp":    e.preventDefault(); nudgeImpact(0, STEP); break;
        case "ArrowDown":  e.preventDefault(); nudgeImpact(0, -STEP); break;
        case "Enter":      e.preventDefault(); goLogResult(); break;       // -> result step
        case "Escape":     e.preventDefault(); showScreen("hud"); break;   // cancel
        default: return;
      }
    } else { // result step
      switch (e.key) {
        case "ArrowLeft": case "ArrowUp":    e.preventDefault(); moveResultFocus(-1); break;
        case "ArrowRight": case "ArrowDown": e.preventDefault(); moveResultFocus(1); break;
        case "Escape":     e.preventDefault(); showLogStep("place"); break; // re-place
        // Enter is left to the browser: it presses the highlighted button.
        default: return;
      }
    }
  });
}

/* -------------------------------------------------------------------------
   OFFLINE SUPPORT
   -------------------------------------------------------------------------
   A "service worker" is a tiny script the browser keeps running in the
   background; ours caches the app files so RangeHUD opens with no signal —
   exactly what you want at a range. Service workers need a real web address,
   so this is skipped when you open the file directly (file://). To use it,
   serve the folder locally (see the notes I gave you).
   ------------------------------------------------------------------------- */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(function () {
    /* ignore registration errors — the app still works online */
  });
}
