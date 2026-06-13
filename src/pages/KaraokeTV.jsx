import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FaMicrophoneAlt, FaMusic } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useParams } from 'react-router-dom';

export default function KaraokeTV() {
  const { estabelecimentoId } = useParams();
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    // Esconder a barra de rolagem do body quando estiver na TV
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    if (!estabelecimentoId) return;

    const q = query(
      collection(db, 'karaoke_queue'),
      where('estabelecimentoId', '==', estabelecimentoId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data = data.filter(d => d.status === 'waiting' || d.status === 'singing');
      
      data.sort((a, b) => {
        if (a.status === 'singing' && b.status !== 'singing') return -1;
        if (b.status === 'singing' && a.status !== 'singing') return 1;
        
        const timeA = a.createdAt?.toMillis() || Date.now();
        const timeB = b.createdAt?.toMillis() || Date.now();
        return timeA - timeB;
      });
      
      setQueue(data);
    });

    return () => unsubscribe();
  }, []);

  const singing = queue.filter(q => q.status === 'singing');
  const waiting = queue.filter(q => q.status === 'waiting');

  return (
    <div className="w-screen h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="p-6 md:p-10 flex items-center justify-between border-b border-gray-800 bg-[#111]">
        <div className="flex items-center gap-4">
            <FaMicrophoneAlt className="text-orange-500 text-5xl animate-pulse" />
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
                KARAOKÊ IDEA SYSTEM
            </h1>
        </div>
        <div className="text-xl text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
            Ao Vivo
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* CANTANDO AGORA - ÁREA PRINCIPAL */}
        <div className="flex-1 flex flex-col items-center justify-center p-10 bg-gradient-to-br from-[#1a0b08] to-[#0a0a0a] relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600 rounded-full blur-[150px] opacity-20"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-600 rounded-full blur-[150px] opacity-20"></div>

            <div className="z-10 text-center w-full max-w-4xl">
                <h2 className="text-3xl md:text-4xl text-gray-400 font-medium uppercase tracking-[0.2em] mb-8 flex items-center justify-center gap-4">
                    <FaMusic className="text-orange-500" /> Cantando Agora <FaMusic className="text-orange-500" />
                </h2>
                
                {singing.length > 0 ? (
                    singing.map(s => (
                        <div key={s.id} className="text-7xl md:text-9xl font-black text-white leading-tight break-words drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]">
                            {s.name}
                        </div>
                    ))
                ) : (
                    <div className="text-5xl md:text-7xl font-bold text-gray-600 italic">
                        Palco Livre
                    </div>
                )}
            </div>
        </div>

        {/* PRÓXIMOS DA FILA - SIDEBAR */}
        <div className="w-full lg:w-[35%] xl:w-[30%] bg-[#111] border-l border-gray-800 flex flex-col">
            <div className="p-8 bg-gray-900 border-b border-gray-800">
                <h3 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">
                    Próximos
                </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {waiting.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xl text-gray-500 font-medium">
                        Fila vazia
                    </div>
                ) : (
                    waiting.map((item, idx) => (
                        <div 
                            key={item.id} 
                            className={`flex items-center gap-6 p-6 rounded-2xl border ${idx === 0 ? 'bg-gradient-to-r from-orange-900/40 to-transparent border-orange-500/30' : 'bg-gray-800/50 border-gray-700/50'} transition-all`}
                        >
                            <span className={`text-4xl font-black ${idx === 0 ? 'text-orange-500' : 'text-gray-500'}`}>
                                {idx + 1}
                            </span>
                            <span className="text-3xl md:text-4xl font-bold text-gray-100 truncate">
                                {item.name}
                            </span>
                        </div>
                    ))
                )}
            </div>
            
            <div className="p-6 border-t border-gray-800 bg-black text-center text-gray-500 font-medium">
                Peça para o garçom colocar seu nome na fila!
            </div>
        </div>
      </div>
    </div>
  );
}
