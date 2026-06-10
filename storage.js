/* =========================================================================
   storage.js  —  SAVING & LOADING PROFILES
   -------------------------------------------------------------------------
   `localStorage` is a tiny key-value store built into every browser. It only
   holds strings, and it survives page reloads (it lives on your device). To
   store an object (like a profile) we convert it to text with JSON.stringify,
   and convert it back with JSON.parse.

   This file exposes a global `Storage` object.
   ========================================================================= */

// The "keys" under which we save our data in localStorage.
const PROFILES_KEY = "rangehud.profiles";
const ACTIVE_KEY = "rangehud.activeId";

// The example profile we pre-load the very first time the app runs.
const EXAMPLE_PROFILE = {
  id: "example-65cm",
  name: "6.5 Creedmoor",
  caliber: "6.5 Creedmoor",
  bulletWeightGr: 140,
  bc: 0.305,
  dragModel: "G7",
  muzzleVelocityFps: 2750,
  zeroDistanceYd: 100,
  sightHeightIn: 1.5
};

// Load all profiles. If there are none yet, seed with the example.
function loadProfiles() {
  const text = localStorage.getItem(PROFILES_KEY);
  if (!text) {
    const seeded = [EXAMPLE_PROFILE];
    saveProfiles(seeded);
    return seeded;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    // If the stored data is somehow corrupted, fall back to the example.
    return [EXAMPLE_PROFILE];
  }
}

// Save the whole list of profiles back to localStorage.
function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

// Remember which profile is currently selected.
function getActiveId() {
  return localStorage.getItem(ACTIVE_KEY);
}

function setActiveId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

// The public API for this file.
const Storage = {
  loadProfiles: loadProfiles,
  saveProfiles: saveProfiles,
  getActiveId: getActiveId,
  setActiveId: setActiveId
};
