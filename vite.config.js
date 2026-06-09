import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react(),
      // 🚨 PWA desativado temporariamente para resolver o problema de cache agressivo (tela branca / CTRL+SHIFT+R constante)
    ],
    server: {
      host: true, // Exibe o IP da rede local para testar no celular
      proxy: {
        // Proxy para Firebase Storage — resolve CORS em dev
        '/firebase-storage': {
          target: 'https://firebasestorage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/firebase-storage/, ''),
        },
        '/api/ncm': {
          target: 'https://brasilapi.com.br',
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'esnext',
      cssMinify: true,
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Isolar bibliotecas muito pesadas que não dependem diretamente da renderização principal do React
              if (id.includes('@firebase') || id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('html2pdf') || id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg') || id.includes('purify')) return 'vendor-pdf';
              
              // Deixa o Vite cuidar do resto (React, Recharts, UI) automaticamente
              // Isso resolve os bugs de 'forwardRef is undefined' causados pela conversão CJS/ESM
            }
          }
        }
      }
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    define: {
      'process.env': Object.fromEntries(
        Object.entries(env).filter(([key]) => key.startsWith('VITE_'))
      )
    }
  };
});