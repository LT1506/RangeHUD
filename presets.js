/* =========================================================================
   presets.js  —  A SMALL "GUN LIBRARY" OF COMMON CARTRIDGES
   -------------------------------------------------------------------------
   This is plain reference data — a few well-known cartridges with typical
   bullet/velocity numbers — so you don't have to type everything from scratch.

   IMPORTANT: this file is READ-ONLY. Nothing here is ever saved on its own.
   Picking one in the "Add from library" dropdown just PRE-FILLS the New
   Profile form with these values; you still press Save to create a real
   profile (which goes through the same save path as a hand-typed one). So
   tweak any number before saving, and your saved profiles are never touched
   by changes to this list.

   Each entry mirrors a profile MINUS its id (the id is created at save time).
   Note these are starting estimates — true them to your own rifle/range data.

   This file exposes a global `PRESETS` array.
   ========================================================================= */
const PRESETS = [
  { name: ".223 Remington",     caliber: ".223 Remington",     bulletWeightGr: 77,  dragModel: "G7", bc: 0.187, muzzleVelocityFps: 2750, zeroDistanceYd: 100, sightHeightIn: 1.5 },
  { name: ".308 Winchester",    caliber: ".308 Winchester",    bulletWeightGr: 175, dragModel: "G7", bc: 0.243, muzzleVelocityFps: 2600, zeroDistanceYd: 100, sightHeightIn: 1.5 },
  { name: "6.5 Creedmoor",      caliber: "6.5 Creedmoor",      bulletWeightGr: 140, dragModel: "G7", bc: 0.305, muzzleVelocityFps: 2750, zeroDistanceYd: 100, sightHeightIn: 1.5 },
  { name: ".300 Win Mag",       caliber: ".300 Win Mag",       bulletWeightGr: 190, dragModel: "G7", bc: 0.283, muzzleVelocityFps: 2900, zeroDistanceYd: 100, sightHeightIn: 1.5 },
  { name: ".30-06 Springfield", caliber: ".30-06 Springfield", bulletWeightGr: 168, dragModel: "G7", bc: 0.218, muzzleVelocityFps: 2700, zeroDistanceYd: 100, sightHeightIn: 1.5 },
  { name: "6mm Creedmoor",      caliber: "6mm Creedmoor",      bulletWeightGr: 108, dragModel: "G7", bc: 0.270, muzzleVelocityFps: 2960, zeroDistanceYd: 100, sightHeightIn: 1.5 },
  { name: ".243 Winchester",    caliber: ".243 Winchester",    bulletWeightGr: 95,  dragModel: "G7", bc: 0.239, muzzleVelocityFps: 2950, zeroDistanceYd: 100, sightHeightIn: 1.5 },
  { name: "7mm Rem Mag",        caliber: "7mm Rem Mag",        bulletWeightGr: 162, dragModel: "G7", bc: 0.327, muzzleVelocityFps: 2940, zeroDistanceYd: 100, sightHeightIn: 1.5 },
  { name: ".22 LR",             caliber: ".22 LR",             bulletWeightGr: 40,  dragModel: "G1", bc: 0.138, muzzleVelocityFps: 1080, zeroDistanceYd: 100, sightHeightIn: 1.5 },
  { name: ".300 Blackout",      caliber: ".300 Blackout",      bulletWeightGr: 125, dragModel: "G7", bc: 0.143, muzzleVelocityFps: 2200, zeroDistanceYd: 100, sightHeightIn: 1.5 }
];
