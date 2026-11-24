// Service worker : cache hors ligne de l'application (stratégie « réseau d'abord, cache en secours »).
const CACHE = 'generation-aja-v6';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './src/main.js', './src/state/store.js', './src/state/firebase-config.js', './src/ui/components.js',
  './src/engine/rng.js', './src/engine/players.js', './src/engine/progression.js', './src/engine/match.js', './src/engine/lineup.js',
  './src/engine/league.js', './src/engine/setup.js', './src/engine/activities.js', './src/engine/events.js', './src/engine/week.js',
  './src/engine/keymatch.js', './src/engine/community.js', './src/engine/projection.js', './src/engine/contracts.js',
  './src/screens/home.js', './src/screens/team.js', './src/screens/u19.js', './src/screens/player.js', './src/screens/map.js',
  './src/screens/messages.js', './src/screens/supporter.js', './src/screens/heritage.js', './src/screens/community.js', './src/screens/profile.js', './src/state/backend.js', './src/state/backend-config.js', './src/state/telemetry.js', './src/engine/migrations.js', './src/screens/contracts.js', './src/ui/negotiation.js', './src/screens/match.js', './src/screens/table.js', './src/screens/gold.js', './src/screens/welcome.js',
  './src/data/players.json', './src/data/clubs.json', './src/data/fixtures.json', './src/data/cities.json', './src/data/sponsors.json',
  './src/data/academy.json', './src/data/commentary.json', './src/data/territory.json', './src/data/heritage.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // l'API n'est jamais mise en cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
