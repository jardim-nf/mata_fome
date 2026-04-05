importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuração publicamente exposta do Firebase (idêntica ao frontend)
const firebaseConfig = {
  apiKey: "AIzaSyAyd7CwO4G8slFVDzS4lmNILa9O3eXSq_o",
  authDomain: "matafome-98455.firebaseapp.com",
  projectId: "matafome-98455",
  storageBucket: "matafome-98455.firebasestorage.app",
  messagingSenderId: "39869963505",
  appId: "1:39869963505:web:13567bd25520a6499f5d50"
};

// Inicializa o Firebase app no Service Worker
firebase.initializeApp(firebaseConfig);

// Inicializa o Firebase Cloud Messaging (FCM)
const messaging = firebase.messaging();

// Lida com mensagens recebidas quando o app está em Background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em background ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
