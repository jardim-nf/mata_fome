import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false // Desativado para limpar o console (logs do Workbox: "No route found").
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'], // Cache agressivo
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 6000000, // 6MB - Garante que pacotes pesados como relatórios baixem no app
          navigateFallback: '/index.html',
          navigateFallbackAllowlist: [/^(?!\/__).*/], // Ignora rotas /__/, permitindo uso do Firebase Auth (OAuth) corretamente
          navigateFallbackDenylist: [/^\/_/, /\/firestore\.googleapis\.com\//, /\/identitytoolkit\.googleapis\.com\//],
          runtimeCaching: [
            {
              // Ignorar inteiramente APIs do Google/Firebase para evitar que o Cache quebre a conexão tempo real
              urlPattern: /^https:\/\/(firestore|securetoken|identitytoolkit)\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Fontes do Google
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 ano
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // O Firestore tem cache offline próprio, mas outras APIs externas (Mercado Pago, Firestorage Images via GET)...
              // Nós marcamos como StaleWhileRevalidate ou NetworkFirst dependendo da urgência
              urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|webp|gif)/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'external-images',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
                }
              }
            }
          ]
        },
        manifest: {
          short_name: "IdeaFood",
          name: "IdeaFood - PDV",
          description: "Plataforma de Delivery e PDV inteligente sem comissões.",
          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ],
          start_url: "/",
          background_color: "#F8FAFC",
          display: "standalone",
          scope: "/",
          theme_color: "#059669",
          orientation: "portrait"
        }
      })
    ],
    server: {
      proxy: {
        // Proxy para Firebase Storage — resolve CORS em dev
        '/firebase-storage': {
          target: 'https://firebasestorage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/firebase-storage/, ''),
        },
      },
    },
    build: {
      target: 'esnext',
      cssMinify: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
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