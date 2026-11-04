// Family Worship service worker: makes the app installable and usable offline.
// `npm run build` copies this to dist/sw.js with the __PLACEHOLDERS__ filled in
// (scripts/stamp-sw.mjs).
//
// Two caches:
// - The app shell (page, code, icons, catechisms, creeds, hymns, plans) in a cache named
//   after VERSION, a hash of every published file: each release replaces it.
// - Bible books in BIBLE_CACHE, filled as each book is first opened. Its name is a
//   hash of the Bible files only, so app releases keep the books already saved.

const VERSION = "__VERSION__";
const CACHE = `family-worship-${VERSION}`;
const BIBLE_CACHE = "family-worship-bible-__BIBLE_VERSION__";
const SHELL = __SHELL__;

self.addEventListener("install", (event) => {
    event.waitUntil(
        // cache: "reload" skips the browser's HTTP cache, so a release can't
        // pick up the previous release's files.
        caches.open(CACHE)
            .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys
                .filter((k) => k.startsWith("family-worship-") && k !== CACHE && k !== BIBLE_CACHE)
                .map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== "GET" || url.origin !== location.origin) return;

    if (req.mode === "navigate") {
        // Network first, so an online visit always gets the current version
        event.respondWith(
            fetch(req).catch(() => caches.match("./index.html", { ignoreSearch: true, ignoreVary: true }))
        );
        return;
    }

    const cacheName = url.pathname.includes("/data/bible/") ? BIBLE_CACHE : CACHE;
    event.respondWith(
        caches.open(cacheName).then(async (cache) => {
            const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
            if (hit) return hit;
            const res = await fetch(req);
            if (res.ok) cache.put(req, res.clone());
            return res;
        })
    );
});
