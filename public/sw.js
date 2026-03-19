// Service Worker — IdeaFood PWA
const CACHE_NAME = 'ideafood-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/food.png',
  '/campainha.mp3',
];

// Instalação: cacheia recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignora erros de cache individuais
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url).catch(() => null))
        );
      });
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

// Fetch: estratégia inteligente
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora chamadas Firebase/API
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('mercadopago')) {
    return;
  }

  // Navegação: network-first (SPA)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets estáticos: cache-first
  if (event.request.destination === 'script' || event.request.destination === 'style' || event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
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