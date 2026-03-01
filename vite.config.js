// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    build: {
      // ESSA LINHA É A MÁGICA PARA O IOS:
      target: 'es2015', 
      cssMinify: true,
    },
    define: {
      'process.env': env
    }
  }
});