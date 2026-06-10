# RangeHUD

A web-based rifle ballistics HUD built in plain HTML, CSS, and vanilla JavaScript.
No frameworks, no build tools. Designed to be readable end-to-end and glasses-ready.

## Run locally
Serve the folder over http (needed for the offline service worker and precise GPS):

    python -m http.server 8000

Then open http://localhost:8000

Add ?glasses=1 to the URL to preview the small monocular layout.
