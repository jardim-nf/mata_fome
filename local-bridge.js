const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = 4000;

io.on('connection', (socket) => {
  console.log(`[Bridge] Nova conexão recebida: ${socket.id}`);

  socket.on('run_command', (data) => {
    const command = data.command;
    if (!command) return;

    // Whitelist por segurança básica
    if (!command.startsWith('npm ') && !command.startsWith('npx ') && !command.startsWith('yarn ') && !command.startsWith('git ')) {
      socket.emit('command_stderr', `[Segurança] Comando rejeitado: ${command}. Apenas comandos npm, npx, yarn ou git são permitidos.\n`);
      socket.emit('command_exit', { code: 1 });
      return;
    }

    console.log(`[Bridge] Executando comando: ${command}`);
    socket.emit('command_stdout', `\n$ ${command}\n`);

    // Parse do comando
    const [cmd, ...args] = command.split(' ');

    const child = spawn(cmd, args, { 
      cwd: process.cwd(), 
      shell: true,
      env: process.env
    });

    child.stdout.on('data', (data) => {
      socket.emit('command_stdout', data.toString());
    });

    child.stderr.on('data', (data) => {
      socket.emit('command_stderr', data.toString());
    });

    child.on('close', (code) => {
      console.log(`[Bridge] Comando "${command}" finalizou com código ${code}`);
      socket.emit('command_exit', { code });
    });
    
    child.on('error', (err) => {
      socket.emit('command_stderr', `Erro fatal ao executar: ${err.message}\n`);
      socket.emit('command_exit', { code: 1 });
    });
  });

  // Evento para leitura de arquivo (Agentic Tool)
  socket.on('read_file', (data) => {
    try {
      const targetPath = data.path;
      if (!targetPath) {
        socket.emit('read_file_error', 'Nenhum caminho fornecido.');
        return;
      }
      
      const absolutePath = path.resolve(process.cwd(), targetPath);
      
      // Directory Traversal Prevention: Ensure file is inside project root
      if (!absolutePath.startsWith(process.cwd())) {
        socket.emit('read_file_error', 'Acesso negado: O caminho está fora da pasta do projeto.');
        return;
      }

      if (!fs.existsSync(absolutePath)) {
        socket.emit('read_file_error', `Arquivo não encontrado: ${targetPath}`);
        return;
      }

      let content = fs.readFileSync(absolutePath, 'utf8');
      
      // Limit return size to prevent token overflow in LLM (e.g., 5000 chars)
      if (content.length > 5000) {
        content = content.substring(0, 5000) + '\n\n...[ARQUIVO TRUNCADO POR SER MUITO GRANDE]...';
      }

      console.log(`[Bridge] Agente solicitou leitura do arquivo: ${targetPath}`);
      socket.emit('file_content', { path: targetPath, content: content });
    } catch (err) {
      console.error(`[Bridge] Erro ao ler arquivo: ${err.message}`);
      socket.emit('read_file_error', err.message);
    }
  });

  // Evento para escrita de arquivo (Auto-Coding)
  socket.on('write_file', (data) => {
    try {
      const targetPath = data.path;
      const content = data.content;
      if (!targetPath) {
        socket.emit('write_file_error', 'Nenhum caminho fornecido.');
        return;
      }
      
      const absolutePath = path.resolve(process.cwd(), targetPath);
      
      // Directory Traversal Prevention: Ensure file is inside project root
      if (!absolutePath.startsWith(process.cwd())) {
        socket.emit('write_file_error', 'Acesso negado: O caminho está fora da pasta do projeto.');
        return;
      }

      // Ensure directory exists
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(absolutePath, content, 'utf8');
      
      console.log(`[Bridge] Agente escreveu no arquivo: ${targetPath}`);
      socket.emit('write_file_success', { path: targetPath });
    } catch (err) {
      console.error(`[Bridge] Erro ao escrever arquivo: ${err.message}`);
      socket.emit('write_file_error', err.message);
    }
  });

  // Evento para Web Browsing / Search
  socket.on('web_search', async (data) => {
    try {
      const query = data.query;
      if (!query) {
        socket.emit('web_search_error', 'Nenhuma query fornecida.');
        return;
      }

      console.log(`[Bridge] Agente solicitou web_search: "${query}"`);
      
      // If it's a URL, fetch it directly
      if (query.startsWith('http')) {
        const response = await axios.get(query, { timeout: 10000 });
        const $ = cheerio.load(response.data);
        $('script, style').remove();
        let text = $('body').text().replace(/\s+/g, ' ').trim();
        if (text.length > 5000) text = text.substring(0, 5000) + '...[TRUNCADO]';
        socket.emit('web_search_success', { result: text });
        return;
      }

      // Otherwise do a DuckDuckGo HTML search
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      let results = [];
      
      $('.result').each((i, el) => {
        if (i >= 5) return; // limit to top 5
        const title = $(el).find('.result__title').text().trim();
        const snippet = $(el).find('.result__snippet').text().trim();
        const link = $(el).find('.result__url').attr('href');
        results.push(`Título: ${title}\nLink: ${link}\nResumo: ${snippet}`);
      });

      const finalResult = results.length > 0 ? results.join('\n\n') : 'Nenhum resultado encontrado.';
      socket.emit('web_search_success', { result: finalResult });
      
    } catch (err) {
      console.error(`[Bridge] Erro no web_search: ${err.message}`);
      socket.emit('web_search_error', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Bridge] Cliente desconectado: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 IdeaERP Local Bridge rodando na porta ${PORT}`);
  console.log(`🛡️ Aceitando apenas conexões para comandos npm/npx/yarn.`);
});
