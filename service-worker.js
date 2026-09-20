const CACHE_VERSION = "v3";
const CACHE_PREFIX = "webendra-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
// Exact content-version URLs preserve unchanged portraits across shell upgrades.
const IMAGE_CACHE = `${CACHE_PREFIX}images`;
const APP_FILES = [
  "/",
  "/index.html",
  "/styles.css",
  "/catalogue.js",
  "/app.js",
  "/theme.js",
  "/manifest.webmanifest",
  "/assets/webendra-logo.png",
  "/assets/webendra-icon-192.png",
  "/assets/webendra-maskable-512.png",
  "/assets/webendra-apple-touch.png",
  "/assets/esewa-qr.png",
];
const APP_PATHS = new Set(APP_FILES);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_FILES.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== IMAGE_CACHE)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

function isCharacterImage(url) {
  return url.origin === self.location.origin && /^\/assets\/[^/]+\.png$/.test(url.pathname) &&
    !APP_PATHS.has(url.pathname);
}

function isSuccessfulImage(response) {
  return response.ok && response.headers.get("content-type")?.toLowerCase().startsWith("image/");
}

async function networkFirst(request, cacheName, cacheKey = request) {
  let response;
  try {
    response = await fetch(request, { cache: "no-cache" });
  } catch (error) {
    const cached = await caches.match(cacheKey, { cacheName });
    if (cached) return cached;
    throw error;
  }
  if (response.ok) {
    try {
      const cache = await caches.open(cacheName);
      await cache.put(cacheKey, response.clone());
    } catch {
      // A full or disabled cache must not prevent online viewing.
    }
  }
  return response;
}

async function viewedImage(request) {
  const versioned = /^[a-f0-9]{16}$/.test(new URL(request.url).searchParams.get("v") || "");
  if (versioned) {
    const cached = await caches.match(request, { cacheName: IMAGE_CACHE });
    if (cached) return cached;
  }
  let response;
  try {
    response = await fetch(request, { cache: "no-cache" });
  } catch (error) {
    const cached = await caches.match(request, { cacheName: IMAGE_CACHE });
    if (cached) return cached;
    throw error;
  }
  if (isSuccessfulImage(response)) {
    try {
      const cache = await caches.open(IMAGE_CACHE);
      await cache.put(request, response.clone());
      // Retire older versions only after the new portrait is safely cached.
      const pathname = new URL(request.url).pathname;
      const keys = await cache.keys();
      await Promise.all(keys
        .filter((key) => new URL(key.url).pathname === pathname && key.url !== request.url)
        .map((key) => cache.delete(key)));
    } catch {
      // A full or disabled cache must not prevent online viewing.
    }
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/index.html"));
  } else if (isCharacterImage(url) && request.destination === "image") {
    event.respondWith(viewedImage(request));
  } else if (APP_PATHS.has(url.pathname)) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
  }
});

// The first displayed image can load before this worker controls the page.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_VIEWED_IMAGE") return;
  const url = new URL(event.data.url, self.location.origin);
  if (!isCharacterImage(url)) return;
  event.waitUntil(viewedImage(new Request(url, { mode: "same-origin" })).catch(() => {}));
});
