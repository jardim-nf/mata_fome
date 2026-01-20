import React, { createContext, useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { IoVolumeMute } from 'react-icons/io5';

const NotificationContext = createContext();

const isBrowser =
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined';

const isIOS =
  isBrowser && /iPad|iPhone|iPod/.test(navigator.userAgent);

const SOM_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/754/754862.png";

export const NotificationProvider = ({ children }) => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const isFirstLoad = useRef(true);

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [permission, setPermission] = useState(
    isBrowser && 'Notification' in window ? Notification.permission : 'denied'
  );

  const cargosPermitidos = [
    'admin','masteradmin','garcom','garçom','cozinha','atendente','gerente'
  ];

  /* 🔐 NOTIFICAÇÃO — SOMENTE FORA DO iOS */
  useEffect(() => {
    if (!isBrowser || isIOS) return;
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission()
        .then(p => setPermission(p))
        .catch(() => {});
    }
  }, []);

  /* 🔊 SOM — SOMENTE APÓS CLIQUE */
  const playSound = async () => {
    if (!audioRef.current || isIOS) return;
    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setAudioUnlocked(true);
    } catch {
      setAudioUnlocked(false);
    }
  };

  const solicitarPermissaoManual = () => {
    playSound();
    toast.info("🔊 Som ativado!");
  };

  /* 🔥 FIRESTORE LISTENERS */
  useEffect(() => {
    if (!userData?.role) return;

    const role = userData.role.toLowerCase();
    if (!cargosPermitidos.some(c => role.includes(c))) return;

    const estabelecimentoId =
      userData.estabelecimentosGerenciados?.[0] ||
      userData.estabelecimentoId ||
      userData.idEstabelecimento;

    if (!estabelecimentoId) return;

    const q = query(
      collection(db, 'pedidos'),
      where('estabelecimentoId', '==', estabelecimentoId),
      where('status', 'in', ['pendente', 'recebido']),
      limit(5)
    );

    const unsub = onSnapshot(q, snap => {
      snap.docChanges().forEach(change => {
        if (isFirstLoad.current) return;
        if (change.type === 'added') {
          dispararAlerta(change.doc.data(), change.doc.id);
        }
      });
    });

    setTimeout(() => { isFirstLoad.current = false; }, 3000);

    return () => unsub();
  }, [userData]);

  const dispararAlerta = (pedido, id) => {
    playSound();

    toast.success(
      <div onClick={() => navigate('/painel')} className="cursor-pointer">
        <p className="font-bold">🔔 Novo pedido</p>
        <p className="text-sm">Clique para ver</p>
      </div>,
      { autoClose: false }
    );

    if (!isIOS && permission === 'granted') {
      try {
        const n = new Notification("Novo Pedido", {
          body: "Clique para visualizar",
          icon: LOGO_URL,
          tag: id
        });
        n.onclick = () => navigate('/painel');
      } catch {}
    }
  };

  return (
    <NotificationContext.Provider value={{ solicitarPermissaoManual }}>
      {/* ÁUDIO SOMENTE APÓS INTERAÇÃO */}
      {!isIOS && <audio ref={audioRef} src={SOM_URL} preload="none" />}

      {!audioUnlocked && !isFirstLoad.current && !isIOS && (
        <div
          onClick={solicitarPermissaoManual}
          className="fixed bottom-4 right-4 bg-red-600 text-white p-3 rounded-full z-50 cursor-pointer animate-bounce"
        >
          <IoVolumeMute size={24} />
        </div>
      )}

      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
