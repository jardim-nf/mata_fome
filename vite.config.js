// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente do ficheiro .env
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // ADICIONE ESTE BLOCO 'server' para permitir acesso na rede local (opcional, ajuda a testar no celular)
    server: {
      host: true
    },
    // ADICIONE ESTE BLOCO 'build'
    build: {
      // 'es2015' garante compatibilidade com iOS mais antigos
      target: 'es2015', 
      // Opcional: minificação correta para evitar bugs no Safari
      cssMinify: true,
      sourcemap: false,
    },
    define: {
      // Expõe as variáveis de ambiente para a sua aplicação
      'process.env': env
    }
  }
});