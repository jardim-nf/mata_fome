import { useEffect } from 'react';
import { toast as rtToast } from 'react-toastify';

const getToastConfig = (type, opts) => {
    const bgColors = {
        success: '#10B981',
        error: '#EF4444',
        info: '#3B82F6',
        warning: '#F59E0B'
    };
    return {
        position: "top-center",
        autoClose: 1200,
        hideProgressBar: true,
        closeButton: false,
        theme: "dark",
        ...opts,
        style: {
            borderRadius: '50px',
            minHeight: '40px',
            padding: '8px 20px',
            fontWeight: '900',
            fontSize: '13px',
            color: '#FFFFFF',
            backgroundColor: bgColors[type] || '#1F2937',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            width: 'fit-content',
            maxWidth: '90%',
            margin: '10px auto',
            pointerEvents: 'auto',
            ...opts?.style
        }
    };
};

const toast = {
    success: (msg, opts) => rtToast.success(msg, getToastConfig('success', opts)),
    error: (msg, opts) => rtToast.error(msg, getToastConfig('error', opts)),
    info: (msg, opts) => rtToast.info(msg, getToastConfig('info', opts)),
    warning: (msg, opts) => rtToast.warning(msg, getToastConfig('warning', opts)),
    loading: (msg, opts) => rtToast.loading(msg, { position: "top-center", ...opts }),
    update: (id, opts) => rtToast.update(id, { position: "top-center", ...opts }),
    dismiss: (id) => rtToast.dismiss(id),
};
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
