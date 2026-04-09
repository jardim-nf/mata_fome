import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { IoNotifications, IoReceipt } from 'react-icons/io5';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';

export default function WaiterCallWidget({ estabelecimentoId }) {
    const location = useLocation();
    const [mesaNumero, setMesaNumero] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const mesaParam = params.get('mesa');
        if (mesaParam) {
            setMesaNumero(mesaParam);
        }
    }, [location.search]);

    if (!mesaNumero || !estabelecimentoId) return null;

    const handleCall = async (tipo) => {
        setLoading(true);
        try {
            // Find mesa in firestore
            const mesasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'mesas');
            const q = query(mesasRef, where('numero', '==', mesaNumero.toString()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast.error(`A mesa ${mesaNumero} não foi encontrada no sistema.`);
                setLoading(false);
                setIsOpen(false);
                return;
            }

            const mesaDoc = querySnapshot.docs[0];
            const updates = tipo === 'garcom' 
                ? { chamandoGarcom: true } 
                : { pedindoConta: true };

            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaDoc.id), updates);
            toast.success(tipo === 'garcom' ? 'Garçom chamado com sucesso!' : 'Conta solicitada com sucesso!');
            setIsOpen(false);
        } catch (error) {
            console.error('Erro ao chamar mesa:', error);
            toast.error('Erro de conexão ao chamar garçom.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-32 right-4 z-[9999] flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom flex-col-reverse">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${isOpen ? 'bg-gray-800 text-white' : 'bg-yellow-400 text-yellow-900'} active:scale-95`}
            >
                <IoNotifications size={28} className={isOpen ? '' : 'animate-bounce'} />
            </button>

            {isOpen && (
                <div className="flex flex-col gap-2 mb-2 items-end">
                    <button 
                        onClick={() => handleCall('conta')}
                        disabled={loading}
                        className="flex items-center gap-2 bg-white text-gray-800 px-4 py-2.5 rounded-2xl shadow-xl font-bold text-sm hover:bg-gray-50 border border-gray-100"
                    >
                        <span className="whitespace-nowrap">Pedir a Conta</span>
                        <div className="bg-yellow-100 p-1.5 rounded-full text-yellow-600"><IoReceipt /></div>
                    </button>
                    
                    <button 
                        onClick={() => handleCall('garcom')}
                        disabled={loading}
                        className="flex items-center gap-2 bg-white text-gray-800 px-4 py-2.5 rounded-2xl shadow-xl font-bold text-sm hover:bg-gray-50 border border-gray-100"
                    >
                        <span className="whitespace-nowrap">Chamar Garçom</span>
                        <div className="bg-blue-100 p-1.5 rounded-full text-blue-600"><IoNotifications /></div>
                    </button>
                </div>
            )}
        </div>
    );
}
