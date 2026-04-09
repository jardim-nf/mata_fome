const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Configuração do Socket.io permitindo qualquer origem (CORS aberto para a rede local)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 4000;

app.get('/', (req, res) => {
  res.send('Servidor Local IdeaFood Operacional 🚀');
});

io.on('connection', (socket) => {
  console.log(`🔌 Novo Cliente Conectado: ${socket.id}`);

  // Quando um celular envia um evento de que a mesa mudou, avisamos os outros
  socket.on('MESA_UPDATED', (payload) => {
    console.log('🔄 Mesa Atualizada:', payload);
    // Envia o evento (broadcast) para TODOS os outros conectados, incluindo o PC do caixa
    socket.broadcast.emit('SYNC_MESA', payload);
  });

  // Abertura de Mesa
  socket.on('MESA_ABERTA', (payload) => {
    console.log('🚪 Mesa Aberta:', payload);
    socket.broadcast.emit('SYNC_MESA_ABERTA', payload);
  });

  // Garçom ou Conta Solicitada
  socket.on('ALERTA_MESA', (payload) => {
    console.log('🔔 Alerta Mesa:', payload);
    socket.broadcast.emit('SYNC_ALERTA', payload);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Cliente Desconectado: ${socket.id}`);
  });
});

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

server.listen(PORT, () => {
  console.log('=============================================');
  console.log(`🚀 Servidor Local IdeaFood INICIADO`);
  console.log(`🎯 Para rodar nos Celulares, configure o IP: ${localIp}`);
  console.log(`📡 Escutando na porta: ${PORT}`);
  console.log('=============================================');
});
