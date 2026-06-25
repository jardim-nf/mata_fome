import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const LocalSyncContext = createContext();

export function LocalSyncProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [localServerIp, setLocalServerIp] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('localServerIp');
      if (saved) return saved;
      const host = window.location.hostname;
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return host;
      }
      return '127.0.0.1'; // Padrão automático para produção na nuvem
    }
    return '';
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!localServerIp) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }

    const host = localServerIp.includes(':') ? localServerIp : `${localServerIp}:4000`;
    const protocol = window.location.protocol === 'https:' ? 'ws' : 'http';
    const newSocket = io(`${protocol}://${host}`, {
      transports: ['websocket'], // Evita bloqueio de mixed-content no HTTPS
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 5000,
    });

    newSocket.on('connect', () => {
        console.log('Conectado ao servidor de sincronização local!');
        setIsConnected(true);
    });
    
    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('connect_error', (err) => {
        console.warn('Servidor local não encontrado ou internet caiu:', err.message);
        setIsConnected(false);
    });

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, [localServerIp]);

  const saveIp = (ip) => {
    localStorage.setItem('localServerIp', ip);
    setLocalServerIp(ip);
  };

  return (
    <LocalSyncContext.Provider value={{ socket, localServerIp, saveIp, isConnected }}>
      {children}
    </LocalSyncContext.Provider>
  );
}

export function useLocalSync() {
  return useContext(LocalSyncContext);
}
