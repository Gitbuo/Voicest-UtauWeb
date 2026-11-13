// Voicest service worker: keeps the app itself available offline and fast on repeat visits.
// Voicebank data (manifest.json, part*.bin) is NOT handled here: the page fetches only the samples it needs
// with Range requests and stores them in the "voicest-vb-files-v1" cache itself.
const SHELL = 'voicest-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('voicest-shell-') && k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (/\.(bin|json)$/i.test(u.pathname) || u.pathname.startsWith('/@') || u.pathname.startsWith('/src/') || u.pathname.startsWith('/node_modules/')) return;
  // build output with a content hash in the name never changes: cache first
  if (/\/assets\/.+-[\w-]{8,}\.\w+$/.test(u.pathname)) {
    e.respondWith(caches.open(SHELL).then(async c => {
      const hit = await c.match(r);
      if (hit) return hit;
      const res = await fetch(r);
      if (res.ok) c.put(r, res.clone());
      return res;
    }));
    return;
  }
  // pages and other files: network first (always the newest version), cached copy when offline
  e.respondWith(caches.open(SHELL).then(async c => {
    try {
      const res = await fetch(r);
      if (res.ok && res.type === 'basic') c.put(r, res.clone());
      return res;
    } catch (err) {
      const hit = await c.match(r, { ignoreSearch: r.mode === 'navigate' });
      if (hit) return hit;
      throw err;
    }
  }));
});
