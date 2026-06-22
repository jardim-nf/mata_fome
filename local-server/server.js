// local-server/server.js
// Servidor Local de Sincronização + Execução Real do Squad de Agentes

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Carregar chaves de API do arquivo .env na raiz do projeto
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Configuração do Socket.io permitindo qualquer origem (CORS aberto para a rede local)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 4000;

// Track active squad executions for cancel support
const activeSquadRuns = new Map();

// Permite servir a interface gerada do React (Build final) na mesma porta 4000
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// -------------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------------

// Health check & diagnostics endpoint
app.get('/api/health', (req, res) => {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    ai: {
      openai: hasOpenAI,
      gemini: hasGemini,
      engine: hasGemini ? 'gemini' : hasOpenAI ? 'openai' : 'none'
    },
    activeSquadRuns: activeSquadRuns.size,
    connectedClients: io.engine.clientsCount
  });
});

// Direciona qualquer rota (como /pdv, /master-dashboard) para o React lidar internamente
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// -------------------------------------------------------------------
// Socket.io Event Handlers
// -------------------------------------------------------------------
io.on('connection', (socket) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] 🔌 Novo Cliente Conectado: ${socket.id}`);

  // Emit server status on connection
  socket.emit('SQUAD_STATUS', {
    ready: true,
    aiEngine: process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'none',
    hasApiKey: !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)
  });

  // ---------------------------------------------------------------
  // Evento: Executar o Squad de Agentes Real
  // ---------------------------------------------------------------
  socket.on('RUN_SQUAD_REAL', async (payload) => {
    const { requirement, validationCommand } = payload;
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] 🤖 [Squad Real] Iniciando para: "${requirement}" (CMD: ${validationCommand})`);

    // Create an AbortController-like mechanism for cancellation
    const runId = `${socket.id}_${Date.now()}`;
    const runState = { cancelled: false };
    activeSquadRuns.set(runId, runState);

    // Notify front-end which run ID this is
    socket.emit('SQUAD_REAL_EVENT', { name: 'run_id', data: runId });

    try {
      // Importação dinâmica do módulo ES (squad.js)
      const { runSquad } = await import('../agent-squad/squad.js');

      const waitUserApproval = (plano) => {
        return new Promise((resolve) => {
          if (runState.cancelled) {
            resolve({ approved: false, feedback: 'Cancelado' });
            return;
          }

          const handleResponse = (response) => {
            socket.off('disconnect', handleDisconnect);
            resolve(response);
          };

          const handleDisconnect = () => {
            socket.off('USER_APPROVAL_RESPONSE', handleResponse);
            resolve({ approved: false, feedback: 'Cliente desconectado' });
          };

          socket.once('USER_APPROVAL_RESPONSE', handleResponse);
          socket.once('disconnect', handleDisconnect);
        });
      };

      await runSquad(requirement, {
        validationCommand: validationCommand || 'npm run build',
        maxCorrecoes: 4,
        waitUserApproval,
        onEvent: (name, data) => {
          // Check if cancelled before emitting
          if (runState.cancelled) return;

          // Envia o evento do andamento em tempo real para o cliente
          socket.emit('SQUAD_REAL_EVENT', { name, data });
        }
      });

      if (!runState.cancelled) {
        console.log(`[${new Date().toLocaleTimeString()}] ✅ [Squad Real] Execução finalizada com sucesso.`);
      }
    } catch (err) {
      if (!runState.cancelled) {
        console.error(`[${new Date().toLocaleTimeString()}] ❌ [Squad Real] Erro:`, err.message);
        socket.emit('SQUAD_REAL_EVENT', { name: 'error', data: err.message });
      }
    } finally {
      activeSquadRuns.delete(runId);
    }
  });

  // ---------------------------------------------------------------
  // Evento: Cancelar Squad em execução
  // ---------------------------------------------------------------
  socket.on('SQUAD_CANCEL', (payload) => {
    const { runId } = payload || {};
    const ts = new Date().toLocaleTimeString();

    if (runId && activeSquadRuns.has(runId)) {
      activeSquadRuns.get(runId).cancelled = true;
      activeSquadRuns.delete(runId);
      console.log(`[${ts}] 🛑 [Squad Real] Execução ${runId} cancelada pelo usuário.`);
      socket.emit('SQUAD_REAL_EVENT', { name: 'cancelled', data: 'Execução cancelada pelo administrador.' });
    } else {
      // Cancel all runs for this socket
      for (const [id, state] of activeSquadRuns.entries()) {
        if (id.startsWith(socket.id)) {
          state.cancelled = true;
          activeSquadRuns.delete(id);
        }
      }
      console.log(`[${ts}] 🛑 [Squad Real] Todas as execuções de ${socket.id} foram canceladas.`);
      socket.emit('SQUAD_REAL_EVENT', { name: 'cancelled', data: 'Todas as execuções canceladas.' });
    }
  });

  // ---------------------------------------------------------------
  // Eventos de Sincronização de Mesas (IdeaFood)
  // ---------------------------------------------------------------

  // Quando um celular envia um evento de que a mesa mudou, avisamos os outros
  socket.on('MESA_UPDATED', (payload) => {
    console.log(`[${new Date().toLocaleTimeString()}] 🔄 Mesa Atualizada:`, payload);
    // Envia o evento (broadcast) para TODOS os outros conectados, incluindo o PC do caixa
    socket.broadcast.emit('SYNC_MESA', payload);
  });

  // Abertura de Mesa
  socket.on('MESA_ABERTA', (payload) => {
    console.log(`[${new Date().toLocaleTimeString()}] 🚪 Mesa Aberta:`, payload);
    socket.broadcast.emit('SYNC_MESA_ABERTA', payload);
  });

  // Garçom ou Conta Solicitada
  socket.on('ALERTA_MESA', (payload) => {
    console.log(`[${new Date().toLocaleTimeString()}] 🔔 Alerta Mesa:`, payload);
    socket.broadcast.emit('SYNC_ALERTA', payload);
  });

  socket.on('disconnect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] ❌ Cliente Desconectado: ${socket.id}`);
    // Clean up any active runs for this socket
    for (const [id, state] of activeSquadRuns.entries()) {
      if (id.startsWith(socket.id)) {
        state.cancelled = true;
        activeSquadRuns.delete(id);
      }
    }
  });
});

// -------------------------------------------------------------------
// Startup
// -------------------------------------------------------------------
const getLocalIp = () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Pega um IPv4 não interno (que não seja 127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};

const localIp = getLocalIp();
const hasAI = !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
const aiEngine = process.env.GEMINI_API_KEY ? 'Google Gemini' : process.env.OPENAI_API_KEY ? 'OpenAI' : 'NENHUMA';

server.listen(PORT, () => {
  console.log('');
  console.log('=============================================');
  console.log('🚀 Servidor Local IdeaFood v2.0 INICIADO');
  console.log('=============================================');
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🎯 IP na rede: ${localIp}`);
  console.log(`🌐 URL: http://${localIp}:${PORT}`);
  console.log(`🤖 Motor de IA: ${aiEngine}`);
  console.log(`🔑 API Key configurada: ${hasAI ? 'SIM ✅' : 'NÃO ❌'}`);
  console.log(`📊 Health check: http://${localIp}:${PORT}/api/health`);
  console.log('=============================================');
  if (!hasAI) {
    console.log('');
    console.log('⚠️  ATENÇÃO: Nenhuma chave de API (GEMINI_API_KEY ou OPENAI_API_KEY)');
    console.log('   foi encontrada no arquivo .env. O Squad de Agentes Real NÃO');
    console.log('   funcionará sem uma chave válida.');
    console.log('');
  }
});
