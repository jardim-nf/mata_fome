import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react()],
    build: {
      target: 'es2015',
      cssMinify: true,
      sourcemap: false,
      chunkSizeWarningLimit: 500,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics', 'firebase/functions', 'firebase/storage'],
            'vendor-ui': ['framer-motion', 'lucide-react', 'react-icons', 'aos'],
            'vendor-charts': ['chart.js', 'react-chartjs-2', 'chartjs-plugin-datalabels'],
            'vendor-pdf': ['jspdf', 'html2canvas', 'react-to-print'],
            'vendor-utils': ['axios', 'date-fns', 'yup', 'uuid'],
          }
        }
      }
    },
    define: {
      'process.env': Object.fromEntries(
        Object.entries(env).filter(([key]) => key.startsWith('VITE_'))
      )
    }
  };
});