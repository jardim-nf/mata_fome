import React, { createContext, useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { IoNotifications } from 'react-icons/io5';

// Ícone do Push
const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/754/754862.png"; 

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { userData } = useAuth();
    const navigate = useNavigate();
    
    const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
    const isFirstLoad = useRef(true);
    const [permission, setPermission] = useState(Notification.permission);

    // 1. QUEM PODE OUVIR (ADICIONEI VARIAÇÕES DE ESCRITA)
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

    // 2. BUSCA ROBUSTA DO ID DO ESTABELECIMENTO
    // O garçom pode ter o ID salvo em lugares diferentes dependendo de como foi criado
    const getEstabelecimentoId = (user) => {
        if (!user) return null;
        if (user.estabelecimentosGerenciados && user.estabelecimentosGerenciados.length > 0) return user.estabelecimentosGerenciados[0];
        if (user.estabelecimentoId) return user.estabelecimentoId;
        if (user.idEstabelecimento) return user.idEstabelecimento; // Algumas bases usam esse
        return null;
    };

    const solicitarPermissaoManual = () => {
        toast.info(
            <div onClick={() => {
                Notification.requestPermission().then(p => {
                    setPermission(p);
                    if (p === 'granted') {
                        audioRef.current.play().catch(() => {}); 
                        new Notification("Sistema Ativo", { body: "Sons ativados!" });
                    }
                });
            }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IoNotifications size={24} className="text-blue-500" />
                <div>
                    <strong>ATIVAR ALERTAS</strong>
                    <p className="text-xs">Toque para ligar o som de pedidos</p>
                </div>
            </div>,
            { position: "top-center", autoClose: false, closeOnClick: true }
        );
    };

    useEffect(() => {
        // A) Verifica cargo (Case Insensitive)
        if (!userData || !userData.role) return;
        const userRole = userData.role.toLowerCase();
        const temPermissao = cargosPermitidos.some(c => c.toLowerCase() === userRole);

        if (!temPermissao) return;

        // B) Pega ID com segurança
        const estabelecimentoId = getEstabelecimentoId(userData);

        if (!estabelecimentoId) {
            console.log("⚠️ Usuário sem estabelecimento vinculado para notificações.");
            return;
        }

        console.log(`🔔 Monitorando pedidos em: ${estabelecimentoId} (Cargo: ${userRole})`);

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
                        dispararAlerta(change.doc.data(), change.doc.id);
                    }
                }
            });

            if (isFirstLoad.current) {
                setTimeout(() => { isFirstLoad.current = false; }, 2000);
            }
        });

        return () => unsubscribe();
    }, [userData]);

    const dispararAlerta = (pedido, id) => {
        const nome = pedido.cliente?.nome || 'Novo Cliente';
        const valor = pedido.totalFinal ? `R$ ${Number(pedido.totalFinal).toFixed(2)}` : '';
        const titulo = `NOVO PEDIDO: #${id.slice(-4)}`;

        // SOM
        try {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.log("Áudio bloqueado. Interaja com a página."));
        } catch (e) {}

        // VIBRAÇÃO (Celular)
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);

        // TOAST VERDE
        toast.success(
            <div onClick={() => { window.focus(); navigate('/painel'); }} className="cursor-pointer">
                <p className="font-black text-lg">🔔 {titulo}</p>
                <p className="text-sm font-semibold">{nome} - {valor}</p>
            </div>,
            { 
                position: "top-right", 
                autoClose: false, // Fica na tela até clicar
                hideProgressBar: false,
                theme: "colored", 
                icon: "🛵" 
            }
        );

        // PUSH NATIVO
        if (Notification.permission === "granted") {
            try {
                const notif = new Notification(titulo, {
                    body: `${nome} fez um pedido. Toque para ver.`,
                    icon: LOGO_URL,
                    tag: id
                });
                notif.onclick = function() {
                    window.focus();
                    navigate('/painel');
                    this.close();
                };
            } catch (e) {}
        }
    };

    return (
        <NotificationContext.Provider value={{ solicitarPermissaoManual }}>
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext;