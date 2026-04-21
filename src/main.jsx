// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// ============================================================
// 🚨 EMERGÊNCIA: REMOVEDOR DE SERVICE WORKER GLOBAL
// Se os clientes não conseguem abrir (tela de erro ou tela branca),
// geralmente é o Service Worker segurando um cache quebrado.
// Vamos matar ele sem dó em PROD e DEV.
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let reg of registrations) {
      reg.unregister();
      console.log('🧹[EMERGÊNCIA] Service Worker removido para evitar tela branca.');
    }
  }).catch(err => console.log('Erro ao remover SW:', err));
}

// 🚨 EMERGÊNCIA: LIMPAR CACHE LOCAL CORROMPIDO QUE POSSA CRASHAR A TELA
try {
  const wipeMarker = 'mf_emergency_wipe_v2';
  if (!localStorage.getItem(wipeMarker)) {
    console.log('🧹[EMERGÊNCIA] Limpando caches locais problemáticos de versões antigas...');
    
    // Deleta os caches de cardápio que podem ter formato antigo e causar crash
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('mf_cardapio_cache_')) {
        localStorage.removeItem(key);
      }
    });

    localStorage.setItem(wipeMarker, 'true');
    // Força recarregar uma vez para limpar state residual de memória
    window.location.reload();
  }
} catch (e) {
  // Try-catch silencioso para não crashar caso LocalStorage esteja bloqueado
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
