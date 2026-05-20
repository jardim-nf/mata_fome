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
              // Firebase é o pacote mais denso
              if (id.includes('@firebase') || id.includes('firebase')) return 'vendor-firebase';
              
              // React & Routings
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
              
              // Exportação de PDF (muito pesado para estar na main bundle)
              if (id.includes('html2pdf') || id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg') || id.includes('purify')) return 'vendor-pdf';
              
              // Gráficos e Reports (pesado, mas só usado pelos admin)
              if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'vendor-charts';
              
              // UI Componentes
              if (id.includes('framer-motion') || id.includes('react-icons') || id.includes('lucide-react')) return 'vendor-ui';
              
              // Utilitários pequenos agrupados
              if (id.includes('date-fns') || id.includes('axios') || id.includes('yup')) return 'vendor-utils';
              
              // Tudo que sobrar no node_modules vai num chunk principal terceiro
              return 'vendor-core';
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