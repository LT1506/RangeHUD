/* =========================================================================
   sw.js  —  THE SERVICE WORKER (offline support)
   -------------------------------------------------------------------------
   This script runs in the background and sits between the app and the network.

   STRATEGY: NETWORK-FIRST.
   We always try to fetch the latest file from the network and only fall back
   to the cached copy when you're offline. This matters a lot for the glasses:
   they load the app from our URL, so we must NOT pin an old cached version
   (an earlier "cache-first" version did exactly that and froze the app).
   ========================================================================= */

// Bump this whenever the cached file list changes.
const CACHE_NAME = "rangehud-v13";

// The "app shell": everything needed to run RangeHUD offline.
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./ballistics.js",
  "./storage.js",
  "./shots.js",
  "./platform.js",
  "./presets.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

// INSTALL: pre-cache the shell so an offline first-launch still works.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting(); // take over right away
});

// ACTIVATE: delete every old cache so stale code can't survive an update.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH: network-first for our own files; let cross-origin (weather) pass through.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) {
    return; // not ours — normal handling (e.g. the weather API)
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Got it from the network — refresh the cache and return it.
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)) // offline — use the cached copy
  );
});
