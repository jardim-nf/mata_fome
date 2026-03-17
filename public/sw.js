self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // O Firebase Firestore cuida do offline automaticamente
});