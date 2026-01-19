import React, { createContext, useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { IoNotifications, IoVolumeMute } from 'react-icons/io5';

// Som de "Ding Dong" em Base64 (Carrega instantaneamente, não precisa de internet)
const SOM_BASE64 = "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
// (Nota: Usei uma string curta de exemplo. Se quiser o som real, mantenha o link ou use um arquivo local mp3 na pasta public)
// Vou usar o LINK EXTERNO novamente, mas com um backup, pois base64 muito longo polui o código aqui.
const SOM_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/754/754862.png"; 

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { userData } = useAuth();
    const navigate = useNavigate();
    
    const audioPlayerRef = useRef(null);
    const [audioUnlocked, setAudioUnlocked] = useState(false);
    const isFirstLoad = useRef(true);
    const [permission, setPermission] = useState(Notification.permission);

    const cargosPermitidos = [
        'admin', 'masterAdmin', 'masteradmin', 
        'garcom', 'garçom', 'Garçom', 'Garcom', 
        'cozinha', 'Cozinha', 'atendente', 'gerente'
    ];

    useEffect(() => {
        if (permission === 'default') {
            Notification.requestPermission().then(p => setPermission(p));
        }
    }, []);

    const getEstabelecimentoId = (user) => {
        if (!user) return null;
        if (user.estabelecimentosGerenciados?.[0]) return user.estabelecimentosGerenciados[0];
        if (user.estabelecimentoId) return user.estabelecimentoId;
        if (user.idEstabelecimento) return user.idEstabelecimento;
        return null;
    };

    // Tocar Som Forçado
    const playSound = async () => {
        const player = audioPlayerRef.current;
        if (!player) return;

        try {
            player.currentTime = 0;
            // Tenta tocar
            await player.play();
            setAudioUnlocked(true);
        } catch (error) {
            console.warn("🔇 Som bloqueado pelo navegador (AutoPlay Policy).");
            setAudioUnlocked(false);
        }
    };

    const solicitarPermissaoManual = () => {
        playSound();
        toast.info("🔊 Testando som... Se ouviu, está ok!");
    };

    useEffect(() => {
        if (!userData || !userData.role) return;
        
        const userRole = userData.role.toLowerCase();
        const temPermissao = cargosPermitidos.some(c => userRole.includes(c.toLowerCase()));
        
        if (!temPermissao) return;

        const estabelecimentoId = getEstabelecimentoId(userData);
        if (!estabelecimentoId) return;

        console.log(`📡 ESCUTANDO PEDIDOS... (Estab: ${estabelecimentoId})`);

        // 1. DELIVERY
        const qDelivery = query(
            collection(db, 'pedidos'),
            where('estabelecimentoId', '==', estabelecimentoId),
            where('status', 'in', ['pendente', 'aguardando_pagamento', 'recebido']),
            limit(5)
        );

        // 2. SALÃO (Sem filtro de status para garantir que pegamos tudo)
        const qSalao = query(
            collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), // Monitorando MESAS também se mudar status
            limit(20)
        );
        
        // Listener específico para PEDIDOS do salão
        const qPedidosSalao = query(
            collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos'),
            limit(5)
        );

        const handleSnapshot = (snapshot, origem) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data();
                    
                    // Lógica para ignorar o carregamento inicial
                    if (isFirstLoad.current) return;

                    // Se for modificação de mesa (ex: mudou de livre para ocupada)
                    if (origem === 'MesaStatus' && change.type === 'modified') {
                        // Não necessariamente toca alarme, mas podemos logar
                        return; 
                    }

                    // Se for novo pedido
                    console.log(`🔔 NOVO EVENTO [${origem}]:`, data);
                    dispararAlerta(data, change.doc.id, origem);
                }
            });
        };

        const unsubDelivery = onSnapshot(qDelivery, (snap) => handleSnapshot(snap, 'Delivery'));
        const unsubPedidosSalao = onSnapshot(qPedidosSalao, (snap) => handleSnapshot(snap, 'Mesa'));

        // Delay inicial de 3s
        setTimeout(() => { 
            isFirstLoad.current = false; 
            console.log("✅ Sistema pronto para novos alertas.");
        }, 3000);

        return () => {
            unsubDelivery();
            unsubPedidosSalao();
        };
    }, [userData]);

    const dispararAlerta = (pedido, id, origem = 'Novo') => {
        // Filtra para não tocar se for apenas uma atualização técnica
        // (Adapte conforme os status que você usa)
        const statusIgnorados = ['finalizado', 'cancelado'];
        if (statusIgnorados.includes(pedido.status)) return;

        const titulo = `🔔 ${origem === 'Mesa' ? 'PEDIDO NA MESA' : 'NOVO DELIVERY'}`;
        const corpo = pedido.mesaNumero ? `Mesa ${pedido.mesaNumero} chamando!` : `Novo pedido recebido!`;

        // 1. TOCA SOM
        playSound();

        // 2. VIBRA
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);

        // 3. TOAST
        toast.success(
            <div onClick={() => { window.focus(); navigate('/painel'); }} className="cursor-pointer">
                <p className="font-black text-lg">{titulo}</p>
                <p className="text-sm font-semibold">{corpo}</p>
                <p className="text-xs mt-1 underline">Ver Detalhes</p>
            </div>,
            { 
                position: "top-right", 
                autoClose: false, // Fica na tela até clicar
                hideProgressBar: false,
                closeOnClick: true,
                theme: "colored", 
                icon: "🔔" 
            }
        );

        // 4. PUSH
        if (Notification.permission === "granted") {
            try {
                const notif = new Notification(titulo, {
                    body: corpo,
                    icon: LOGO_URL,
                    requireInteraction: true,
                    tag: id
                });
                notif.onclick = function() { window.focus(); navigate('/painel'); this.close(); };
            } catch (e) {}
        }
    };

    return (
        <NotificationContext.Provider value={{ solicitarPermissaoManual }}>
            {/* Elemento de áudio fixo no DOM */}
            <audio ref={audioPlayerRef} src={SOM_URL} preload="auto" />
            
            {!audioUnlocked && !isFirstLoad.current && (
                <div 
                    onClick={solicitarPermissaoManual}
                    className="fixed bottom-4 right-4 bg-red-600 text-white p-3 rounded-full shadow-lg z-50 cursor-pointer animate-bounce"
                    title="Som bloqueado. Clique para ativar."
                >
                    <IoVolumeMute size={24} />
                </div>
            )}
            
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext;