// Use a versioned cache name unique to this project URL
const cachePrefix = "iskra-" + self.registration.scope;
const cacheName = cachePrefix + "v27";
const files = [
    "./", "index.html", "manifest.webmanifest",
    "css/styles.css", "css/print.css",
    "js/puzzles.js", "js/board.js", "js/progress.js", "js/app.js", "js/recording.js", "js/sensors.js", "js/pwa.js",
    "data/tasks.json", "img/icons.svg", "img/favicon.svg", "img/icon-192.png", "img/icon-512.png",
    "fonts/manrope-latin.woff2", "fonts/manrope-latin-ext.woff2"
];

// Cache the files needed for offline use
async function cacheFiles() {
    const cache = await caches.open(cacheName);
    await cache.addAll(files);
    // Activate the new worker without waiting for old tabs
    await self.skipWaiting();
}

// Delete this app's old caches; keep saved progress
async function removeOldCaches() {
    const names = await caches.keys();
    for (const name of names) {
        if (name.startsWith(cachePrefix) && name !== cacheName) {
            await caches.delete(name);
        }
    }
    // Handle requests from already open pages
    await self.clients.claim();
}

// Try cache, then network; use index.html for offline navigation
async function getResponse(request) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
        return await fetch(request);
    } catch (error) {
        if (request.mode === "navigate") return cache.match("index.html");
        throw error;
    }
}

// waitUntil waits for setup; respondWith supplies page responses
self.addEventListener("install", event => event.waitUntil(cacheFiles()));
self.addEventListener("activate", event => event.waitUntil(removeOldCaches()));
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET" || !event.request.url.startsWith(self.registration.scope)) return;
    event.respondWith(getResponse(event.request));
});