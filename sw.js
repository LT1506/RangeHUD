/* =========================================================================
   sw.js  —  THE SERVICE WORKER (offline support)
   -------------------------------------------------------------------------
   This script runs in the background, separate from the page. Its job is to
   sit between the app and the network and answer requests from a cache so the
   app works even with no internet.

   Lifecycle: the browser fires "install" once, then "activate", then "fetch"
   for every request the page makes.
   ========================================================================= */

// Bump this version string whenever you change the cached files, so the
// browser throws away the old cache and grabs the new one.
const CACHE_NAME = "rangehud-v4";

// The "app shell": every file needed to run RangeHUD offline.
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./ballistics.js",
  "./storage.js",
  "./shots.js",
  "./platform.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

// INSTALL: download and store all the app files.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // activate the new worker immediately
});

// ACTIVATE: delete any old caches from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH: answer requests. We use "cache first" for our own files (instant,
// offline), but let anything cross-origin (like the weather API) go straight
// to the network so live data still works when you're online.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) {
    return; // not ours — let the browser handle it normally
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          // Save a copy for next time, then return the response.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
      );
    })
  );
});
