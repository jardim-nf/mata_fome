// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // A forma correta de resolver o caminho no Vite
      '@': path.resolve(new URL('.', import.meta.url).pathname, './src'),
    },
  },
});