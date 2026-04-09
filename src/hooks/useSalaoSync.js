import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { tocarCampainha } from '../utils/audioUtils';
import { useLocalSync } from '../context/LocalSyncContext';

export function useSalaoSync(setMesas) {
    const { socket, isConnected } = useLocalSync();

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleSyncExata = (payload) => {
            setMesas(prev => {
                const isExisting = prev.find(m => m.id === payload.id);
                if (isExisting) {
                    return prev.map(m => m.id === payload.id ? { ...m, ...payload } : m);
                } else {
                    return [...prev, payload];
                }
            });
        };

        socket.on('SYNC_MESA_ABERTA', handleSyncExata);
        socket.on('SYNC_MESA', handleSyncExata);
        socket.on('SYNC_ALERTA', (payload) => {
             if (payload.chamandoGarcom) {
                tocarCampainha();
                toast.warning(`🛎️ Mesa ${payload.numero} está chamando! (Via REDE LOCAL)`);
             }
             handleSyncExata(payload);
        });

        return () => {
            socket.off('SYNC_MESA_ABERTA');
            socket.off('SYNC_MESA');
            socket.off('SYNC_ALERTA');
        };
    }, [socket, isConnected, setMesas]);

    return { socket, isConnected };
}
