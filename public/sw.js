// Service Worker — IdeaFood PWA (v2 - Otimizado)
const CACHE_NAME = 'ideafood-v2';

// Recursos críticos cacheados na instalação
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/food.png',
  '/manifest.json',
];

// Instalação: cacheia recursos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => null))
      );
    })
  );
  self.skipWaiting();
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: estratégia inteligente por tipo de recurso
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora chamadas de API/Firebase (nunca cachear dados dinâmicos)
  if (
    url.hostname.includes('firebase') || 
    url.hostname.includes('googleapis') && !url.hostname.includes('fonts') ||
    url.hostname.includes('mercadopago') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('cloudfunctions')
  ) {
    return;
  }

  // Ignora requests não-GET
  if (event.request.method !== 'GET') return;

  // Navegação (SPA): network-first, fallback para cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Atualiza cache do index.html
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JS/CSS com hash no nome (assets/xxx-HASH.js): cache-first (imutáveis)
  if (url.pathname.startsWith('/assets/') && /\.[a-f0-9]{8,}\.(js|css)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Google Fonts: cache-first (raramente mudam)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Imagens/áudio: stale-while-revalidate
  if (['image', 'audio'].includes(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Demais assets (CSS não-hashed, scripts): stale-while-revalidate
  if (['script', 'style'].includes(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});

// 🔔 Push Notification — avisar cliente sobre status do pedido
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🍔 MataFome';
  const options = {
    body: data.body || 'Atualização do seu pedido!',
    icon: data.icon || '/food.png',
    badge: '/food.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'pedido-update',
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ver Pedido' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});