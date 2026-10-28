// Service worker che decifra: con il codice salvato nel browser, ogni richiesta della app
// viene servita dal blocco cifrato corrispondente in _/ (anche offline, dalla cache).
const SCOPE = new URL('./', self.location).pathname, ID = new URL('./', self.location).pathname, BLOCCHI = 'cifra-blocchi', MAPPE = 'cifra-mappe';
let mappa = null;

const chiave = () => new Promise(ok => {
  const r = indexedDB.open('cifra', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('k');
  r.onerror = () => ok(null);
  r.onsuccess = () => { const g = r.result.transaction('k').objectStore('k').get(ID); g.onsuccess = () => ok(g.result || null); g.onerror = () => ok(null); };
});
const togliChiave = () => new Promise(ok => {
  const r = indexedDB.open('cifra', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('k');
  r.onsuccess = () => { const t = r.result.transaction('k', 'readwrite'); t.objectStore('k').delete(ID); t.oncomplete = ok; t.onerror = ok; };
  r.onerror = ok;
});
const apri = async (k, buf) => crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, k, buf.slice(12));

async function leggiMappa(k, rete) {
  if (mappa && !rete) return mappa;
  const url = SCOPE + '_/m', cache = await caches.open(MAPPE);
  let res = await fetch(url, { cache: 'no-cache' }).then(r => r.ok ? (cache.put(url, r.clone()), r) : null).catch(() => null);
  const nuova = !!res;
  res = res || await cache.match(url);
  if (!res) return mappa;
  try { mappa = JSON.parse(new TextDecoder().decode(await apri(k, await res.arrayBuffer()))); }
  catch { mappa = null; await togliChiave(); return null; } // codice cambiato: si torna alla schermata del codice
  if (nuova) { // via dalla cache i blocchi delle versioni precedenti
    const vivi = new Set(Object.values(mappa).map(v => SCOPE + '_/' + v[0])), c = await caches.open(BLOCCHI);
    for (const r of await c.keys()) { const p = new URL(r.url).pathname; if (p.startsWith(SCOPE + '_/') && !vivi.has(p)) c.delete(r); }
  }
  return mappa;
}
async function blocco(nome) {
  const url = SCOPE + '_/' + nome, cache = await caches.open(BLOCCHI);
  const hit = await cache.match(url);
  if (hit) return hit.arrayBuffer();
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  await cache.put(url, r.clone());
  return r.arrayBuffer();
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  // via le cache in chiaro delle versioni non cifrate
  for (const k of await caches.keys()) if (!k.startsWith('cifra-')) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(SCOPE)) return;
  let rel = decodeURIComponent(u.pathname.slice(SCOPE.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (rel.startsWith('_/')) return;
  e.respondWith((async () => {
    const k = await chiave();
    const m = k && await leggiMappa(k, e.request.mode === 'navigate');
    const voce = m && m[rel];
    if (!voce) return fetch(e.request);
    try {
      return new Response(await apri(k, await blocco(voce[0])), { headers: { 'Content-Type': voce[1] } });
    } catch { return fetch(e.request); }
  })());
});
