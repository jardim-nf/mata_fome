import React, { createContext, useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { IoNotifications } from 'react-icons/io5';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { userData } = useAuth();
    const navigate = useNavigate();
    
    // Som de notificação
    const audioRef = useRef(new Audio('/campanha.mp3'));
    const isFirstLoad = useRef(true);
    const [permission, setPermission] = useState(Notification.permission);

    // 1. TENTA PEDIR PERMISSÃO AO CARREGAR (Pode ser bloqueado pelo navegador)
    useEffect(() => {
        if (permission === 'default') {
            solicitarPermissaoManual();
        }
    }, []);

    // 2. FUNÇÃO PARA ATIVAR MANUALMENTE (Resolve o bloqueio)
    const solicitarPermissaoManual = () => {
        toast.info(
            <div onClick={() => {
                Notification.requestPermission().then(p => {
                    setPermission(p);
                    if (p === 'granted') {
                        new Notification("Sistema Ativo", { body: "Notificações habilitadas com sucesso!" });
                        // Toca um som mudo ou baixo só para destravar o áudio do navegador
                        audioRef.current.play().catch(() => {}); 
                    }
                });
            }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IoNotifications size={24} />
                <div>
                    <strong>Ativar Notificações</strong>
                    <p className="text-xs">Clique aqui para receber alertas de pedidos</p>
                </div>
            </div>,
            {
                position: "top-center",
                autoClose: false, // Fica na tela até clicar
                closeOnClick: true,
                draggable: false,
                theme: "light",
                style: { border: "2px solid #3b82f6" }
            }
        );
    };

    // 3. MONITORAMENTO DE PEDIDOS
    useEffect(() => {
        const estabelecimentoId = userData?.estabelecimentosGerenciados?.[0];
        if (!estabelecimentoId) return;

        const q = query(
            collection(db, 'pedidos'),
            where('estabelecimentoId', '==', estabelecimentoId),
            where('status', 'in', ['pendente', 'aguardando_pagamento', 'recebido']), 
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    if (!isFirstLoad.current) {
                        const pedido = change.doc.data();
                        const pedidoId = change.doc.id;
                        
                        dispararAlerta(pedido, pedidoId);
                    }
                }
            });

            if (isFirstLoad.current) isFirstLoad.current = false;
        });

        return () => unsubscribe();
    }, [userData]);

    // 4. DISPARADOR CENTRAL
    const dispararAlerta = (pedido, id) => {
        // Tocar Som
        try {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.log("Som bloqueado (falta interação do usuário)"));
        } catch (e) { console.error(e); }

        // Nome e Valor
        const nome = pedido.cliente?.nome || 'Cliente';
        const valor = pedido.totalFinal ? `R$ ${Number(pedido.totalFinal).toFixed(2)}` : '';

        // Notificação Interna (Toast)
        toast.success(
            <div onClick={() => navigate('/painel')} className="cursor-pointer">
                <p className="font-bold">🔔 Novo Pedido! #{id.slice(-4)}</p>
                <p className="text-sm">{nome} - {valor}</p>
            </div>,
            { position: "top-right", autoClose: 10000, theme: "colored", icon: "🛵" }
        );

        // Notificação do Sistema (Push)
        if (Notification.permission === "granted") {
            const notif = new Notification("NOVO PEDIDO CHEGOU! 🛵", {
                body: `${nome} fez um pedido de ${valor}. Clique para atender.`,
                icon: 'https://cdn-icons-png.flaticon.com/512/754/754862.png', // Ícone de delivery
                requireInteraction: true, // Fica na tela até o usuário fechar
                tag: id
            });

            notif.onclick = function() {
                window.focus(); // Traz a janela pra frente
                navigate('/painel');
                this.close();
            };
        }
    };

    return (
        <NotificationContext.Provider value={{ solicitarPermissaoManual }}>
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext;