// src/components/MasterNotifications.jsx
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Caminho correto para firebase.js
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

function MasterNotifications() {
  const { currentUser, isMasterAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;

    // Apenas Master Admin recebe notificações
    const q = query(
      collection(db, 'masterNotifications'),
      // Opcional: where('masterAdminUid', '==', currentUser.uid), // Se as notificações forem por UID de admin
      orderBy('timestamp', 'desc'),
      limit(10) // Limita para as 10 notificações mais recentes
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(fetchedNotifications);
      setUnreadCount(fetchedNotifications.filter(n => !n.isRead).length);
    }, (err) => {
      console.error("Erro ao carregar notificações:", err);
    });

    return () => unsubscribe();
  }, [currentUser, isMasterAdmin]);

  // Fechar o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(prev => !prev);
    // Ao abrir, marca todas as notificações visíveis como lidas
    if (!isOpen && unreadCount > 0) {
      notifications.filter(n => !n.isRead).forEach(async (notif) => {
        try {
          await updateDoc(doc(db, 'masterNotifications', notif.id), { isRead: true });
        } catch (e) {
          console.error("Erro ao marcar notificação como lida:", e);
        }
      });
    }
  };

  const handleNotificationClick = (notification) => {
    // Exemplo de navegação baseada no tipo de alvo
    if (notification.target && notification.target.type === 'estabelecimento') {
      navigate(`/master/estabelecimentos/${notification.target.id}/editar`);
    } else if (notification.target && notification.target.type === 'usuario') {
      navigate(`/master/usuarios/${notification.target.id}/editar`);
    }
    setIsOpen(false); // Fecha o dropdown
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={toggleDropdown} className="relative p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.002 2.002 0 0118 14.59V13a3 3 0 00-3-3H9a3 3 0 00-3 3v1.59c0 .537-.213 1.052-.595 1.405L4 17h5m6 0a6 6 0 00-6 6"></path></svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-lg text-gray-800">Notificações</h3>
          </div>
          {notifications.length === 0 ? (
            <p className="text-gray-500 p-4 text-center">Nenhuma notificação recente.</p>
          ) : (
            <ul>
              {notifications.map(notif => (
                <li key={notif.id} 
                    className={`p-4 border-b border-gray-100 cursor-pointer ${!notif.isRead ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                    onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex justify-between items-start">
                    <p className={`font-semibold ${!notif.isRead ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {notif.title}
                    </p>
                    <span className="text-xs text-gray-500 ml-2">
                      {notif.timestamp && notif.timestamp.toDate ? formatDistanceToNow(notif.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : 'Recentemente'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 break-words">{notif.message}</p>
                  {notif.target && notif.target.name && (
                      <p className="text-xs text-gray-500 mt-1">Alvo: {notif.target.name}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default MasterNotifications;