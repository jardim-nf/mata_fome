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
    
    // Som
    const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
    const isFirstLoad = useRef(true);
    const [permission, setPermission] = useState(Notification.permission);

    // 1. LISTA DE QUEM PODE OUVIR O BARULHO
    const cargosPermitidos = ['admin', 'masterAdmin', 'garcom', 'garçom', 'cozinha', 'atendente', 'gerente'];

    // 2. PEDIR PERMISSÃO AO CARREGAR
    useEffect(() => {
        if (permission === 'default') {
            Notification.requestPermission().then(p => setPermission(p));
        }
    }, []);

    // 3. BOTÃO MANUAL (Para destravar áudio)
    const solicitarPermissaoManual = () => {
        toast.info(
            <div onClick={() => {
                Notification.requestPermission().then(p => {
                    setPermission(p);
                    if (p === 'granted') {
                        const notif = new Notification("Sistema Conectado 🟢", { 
                            body: "Sons e Alertas ativados para a equipe!",
                            icon: LOGO_URL
                        });
                        audioRef.current.play().catch(() => {}); 
                    }
                });
            }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IoNotifications size={24} className="text-blue-500" />
                <div>
                    <strong>ATIVAR SONS</strong>
                    <p className="text-xs">Clique para receber pedidos</p>
                </div>
            </div>,
            {
                position: "top-center",
                autoClose: false,
                closeOnClick: true,
                draggable: false,
                theme: "light",
                style: { border: "2px solid #3b82f6", fontWeight: "bold" }
            }
        );
    };

    // 4. MONITORAMENTO INTELIGENTE
    useEffect(() => {
        // A) Verifica se o usuário existe e se tem cargo permitido
        if (!userData || !cargosPermitidos.includes(userData.role)) return;

        // B) Tenta achar o ID do estabelecimento em qualquer lugar comum
        const estabelecimentoId = userData.estabelecimentosGerenciados?.[0] || userData.estabelecimentoId || userData.idEstabelecimento;

        if (!estabelecimentoId) return;

        console.log("🔔 Monitorando pedidos para:", userData.role);

        const q = query(
            collection(db, 'pedidos'),
            where('estabelecimentoId', '==', estabelecimentoId),
            // Monitora status de entrada relevantes para a equipe
            where('status', 'in', ['pendente', 'aguardando_pagamento', 'recebido']), 
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    if (!isFirstLoad.current) {
                        const pedido = change.doc.data();
                        const pedidoId = change.doc.id;
                        
                        // Garante que só toca se for um pedido novo mesmo (redundância)
                        dispararAlerta(pedido, pedidoId);
                    }
                }
            });

            if (isFirstLoad.current) {
                // Pequeno delay para garantir que não toque na atualização de página
                setTimeout(() => { isFirstLoad.current = false; }, 2000);
            }
        });

        return () => unsubscribe();
    }, [userData]);

    // 5. DISPARADOR
    const dispararAlerta = (pedido, id) => {
        const nome = pedido.cliente?.nome || 'Novo Cliente';
        const valor = pedido.totalFinal ? `R$ ${Number(pedido.totalFinal).toFixed(2)}` : '';
        const titulo = `NOVO PEDIDO: #${id.slice(-4)}`;
        const corpo = `${nome} fez um pedido de ${valor}.`;

        // SOM
        try {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(error => {
                console.log("Áudio bloqueado. O usuário precisa interagir.");
            });
        } catch (e) { console.error(e); }

        // VIBRAÇÃO (Celular Garçom)
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);

        // TOAST VERDE
        toast.success(
            <div onClick={() => { window.focus(); navigate('/painel'); }} className="cursor-pointer">
                <p className="font-black text-lg">🔔 {titulo}</p>
                <p className="text-sm font-semibold">{corpo}</p>
                <p className="text-xs mt-1 underline">Toque para abrir</p>
            </div>,
            { 
                position: "top-right", 
                autoClose: false, // Fica na tela até alguém ver
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                theme: "colored", 
                icon: "🛵" 
            }
        );

        // PUSH NATIVO
        if (Notification.permission === "granted") {
            try {
                const notif = new Notification(titulo, {
                    body: corpo,
                    icon: LOGO_URL,
                    requireInteraction: true,
                    tag: id,
                    silent: false
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