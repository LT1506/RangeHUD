# RangeHUD Visual Redesign — "Precision Instrument" (v15)

**Date:** 2026-06-24
**Goal:** Make RangeHUD look its best and be the most intuitive — a polished, calm, premium "precision instrument" look — WITHOUT adding features or changing any ballistics math. Approved via visual mockups (see `.superpowers/preview.html`).

## Scope & hard constraints
- **CSS-led restyle + light markup reorg.** Touch `style.css`, `index.html` (structure/classes), and `app.js` only where markup/classes require it. **Do NOT touch ballistics math** (`ballistics.js`) or any solver output.
- **Preserve all behavior and JS hooks.** Every element `id` the JS reads/writes (e.g. `pfName`, `profileSelect`, `librarySelect`, `hud*`, dope/table ids, weather/auto-wind buttons, screen ids) MUST be kept. Reorganizing Setup markup is allowed, but IDs and event wiring stay intact. Glasses form navigation (`enableFormKeyNav`) must still find inputs/selects/buttons.
- **Stay vanilla** HTML/CSS/JS, no frameworks/build/npm. Beginner-readable, plain-language comments.
- **Glasses readability is paramount.** The live in-lens HUD background must stay effectively **pure/near black** for maximum contrast and waveguide transparency — the charcoal radial-gradient "panel" look is for Setup/DOPE/cards and the faux-lens preview, NOT a washed-out HUD background on the real device. Keep `#hud` background near-black (e.g. `#06080a`), gradient at most extremely subtle.
- Tests (`node tests.js`) must stay green (style change shouldn't affect them; confirm anyway).
- Bump `APP_VERSION` v14→**v15** and `sw.js` `CACHE_NAME` rangehud-v14→**v15**.

## Design tokens (update :root)
- `--bg:#0d1014` (page sections), page backdrop `#070809`, `--card/--panel:#20262e`
- `--line:#2c343d`, `--line-soft:#1a2027`
- `--text:#e7ecf1`, `--muted:#8b97a5`, `--muted2:#6d7884`
- `--accent (amber):#f4b740` (refined from the old #ffcc33), `--accent-2 (cyan):#4fd1ff`, `--good:#7fcf6a`, `--danger:#ff5c5c`
- Font: `"Segoe UI", system-ui, -apple-system, Roboto, sans-serif`
- Numbers/data: **font-weight 800** (extra-bold) for primary values; labels uppercase, letter-spaced, `--muted2`.

## Per-screen
**HUD** (glanceable): near-black bg. Profile (uppercase, muted) → distance (muted) → thin gradient divider → ELEVATION label + giant amber number (weight 800, the dominant element) → WIND label + secondary number (lighter weight, ~half size) → tertiary TOF/fps/ftlb line (small, muted, bold values). Keep the elevation-dominant hierarchy already in place; just apply the new palette/weights/divider. Glasses sizes already tuned — keep elevation dominant in `body.glasses`.

**Setup** (intuitive): reorganize into three labeled sections with small uppercase section headers + amber dot:
1. **Rifle & Load** — profile select + New/Edit/Delete + "Add from library".
2. **Conditions** — **"Auto-fill from weather" button promoted to the TOP** of this section; manual fields (wind, o'clock, incline, temp, pressure, altitude) in tidy 2-up grids inside a card.
3. **Target** — distance, styled larger/amber (it's the most-changed value).
Then ONE obvious amber **primary** action ("Show HUD →"), with DOPE / Range log as quieter outline/secondary buttons. Cards use the panel bg + soft inner translucency.

**DOPE**: amber sticky headers, calm row dividers (`--line-soft`) instead of heavy zebra, tighter compact columns; keep the supersonic/transonic caption + transonic/subsonic row shading (amber/red) already implemented.

**Range Log / analysis & Log-shot target**: apply the same tokens for consistency — card style, amber stat numbers, muted uppercase labels; impact grid stays functional (just colors aligned to tokens).

## Verification
- `node tests.js` stays green.
- Manual: open the app; each screen matches the approved preview; all controls still work (profile CRUD, add-from-library, weather, auto-wind, distance stepping, DOPE render, log shot, screen nav). `?glasses=1`: HUD readable, near-black bg, elevation dominant; form nav still reaches every control.
- Build tag reads v15.

## Out of scope
No new features (spin drift / MPBR / etc. remain deferred). No math changes.
