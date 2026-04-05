import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { FaArrowLeft, FaRocket, FaClock, FaBoxOpen } from 'react-icons/fa';

function MasterMensagens() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
  const [mensagens, setMensagens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    
    // Express Implementation: Fetch global campaigns without index
    const fetchMensagens = async () => {
      setLoading(true);
      try {
        // Without an index on createdAt across campanhas, we just fetch all and limit in memory, or we can fetch a few if it gets heavy
        // This is a naive express fetch. For production, composite indexes are recommended.
        const snap = await getDocs(query(collectionGroup(db, 'campanhas')));
        let data = snap.docs.map(d => ({ id: d.id, ...d.data(), _path: d.ref.path }));
        
        // Sorting in memory by date descending
        data.sort((a, b) => {
          const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return dB - dA;
        });

        // Take top 50 for performance
        setMensagens(data.slice(0, 50));
      } catch (err) {
        console.error('Erro ao buscar campanhas globais', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMensagens();
  }, [currentUser, isMasterAdmin]);

  if (authLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-red-500">Acesso Negado</div>;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 min-h-screen font-sans p-6">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => navigate('/master-dashboard')} className="text-slate-400 hover:text-indigo-600 flex items-center gap-2 mb-6 text-sm font-bold transition-colors">
          <FaArrowLeft /> Voltar ao Master
        </button>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
            <FaRocket className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rede: Mensagens do Bot</h1>
            <p className="text-slate-500 text-sm mt-1">Disparos automáticos e campanhas (Exibindo os 50 mais recentes)</p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">Carregando inteligência da rede...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mensagens.length > 0 ? mensagens.map(msg => {
              const dDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
              let estabId = 'desconhecido';
              if (msg._path) {
                const parts = msg._path.split('/');
                const idx = parts.indexOf('estabelecimentos');
                if (idx >= 0) estabId = parts[idx+1];
              }
              
              return (
                <div key={msg.id} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{msg.tipo || 'Campanha'}</span>
                    <span className="text-[10px] text-slate-400">{dDate.toLocaleDateString('pt-BR')}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 line-clamp-3 mb-4">{msg.texto || msg.mensagem || 'Sem conteúdo...'}</p>
                  <div className="pt-3 border-t border-slate-50 flex items-center gap-2">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Loja:</span>
                    <span className="text-xs font-bold text-slate-700 truncate">{estabId}</span>
                  </div>
                </div>
              );
            }) : (
               <div className="col-span-full py-10 text-center border border-dashed rounded-xl border-slate-200">
                 <FaBoxOpen className="mx-auto text-3xl text-slate-300 mb-2" />
                 <p className="text-slate-500 font-medium">Nenhuma mensagem registrada nas lojas.</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MasterMensagens;
