import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query, addDoc, Timestamp } from 'firebase/firestore';
import { FaArrowLeft, FaRocket, FaBoxOpen, FaBolt, FaBullhorn, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { IoLogOutOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function MasterMensagens() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  const [mensagens, setMensagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});

  // Megafone State
  const [modalMegafone, setModalMegafone] = useState(false);
  const [loadingMegafone, setLoadingMegafone] = useState(false);
  const [novoAviso, setNovoAviso] = useState({ titulo: '', mensagem: '', tipo: 'info', alvo: 'todos' });

  const fetchMensagens = async () => {
    setLoading(true);
    try {
      const estabSnap = await getDocs(collection(db, 'estabelecimentos'));
      const emap = {};
      estabSnap.forEach(d => {
          emap[d.id] = d.data().nome || d.id;
      });
      setEstabMap(emap);

      const snap = await getDocs(query(collectionGroup(db, 'campanhas')));
      let data = snap.docs.map(d => ({ id: d.id, ...d.data(), _path: d.ref.path }));
      
      const snapAvisos = await getDocs(query(collection(db, 'avisos_gerais')));
      let avisosData = snapAvisos.docs.map(d => ({ id: d.id, ...d.data(), _path: 'global', isAvisoGeral: true }));

      let combined = [...data, ...avisosData];

      // Sorting in memory by date descending
      combined.sort((a, b) => {
        const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dB - dA;
      });

      // Take top 50 for performance
      setMensagens(combined.slice(0, 50));
    } catch (err) {
      console.error('Erro ao buscar campanhas globais', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    fetchMensagens();
  }, [currentUser, isMasterAdmin]);

  const dispararMegafone = async (e) => {
    e.preventDefault();
    if (!novoAviso.titulo || !novoAviso.mensagem) return toast.warn("Preencha título e mensagem.");
    
    setLoadingMegafone(true);
    try {
      await addDoc(collection(db, 'avisos_gerais'), {
        titulo: novoAviso.titulo,
        mensagem: novoAviso.mensagem,
        tipo: novoAviso.tipo,
        alvo: novoAviso.alvo,
        ativo: true,
        createdAt: Timestamp.now()
      });
      toast.success("Broadcast disparado com sucesso!");
      setModalMegafone(false);
      setNovoAviso({ titulo: '', mensagem: '', tipo: 'info', alvo: 'todos' });
      fetchMensagens();
    } catch (err) {
      console.error("Erro disparar megafone:", err);
      toast.error("Erro: " + (err.message || "ao disparar aviso"));
    } finally {
      setLoadingMegafone(false);
    }
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-[#FF3B30] min-h-screen bg-[#F5F5F7]">Acesso Negado</div>;

  return (
    <div className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Rede Neural de Mensagens</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <span className="bg-[#F5F5F7] border border-[#E5E5EA] text-[#86868B] text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">CRM & Disparos</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Campanhas da Rede</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Exibindo os disparos mais recentes processados em todas as franquias.</p>
          </div>
          <button 
            onClick={() => setModalMegafone(true)}
            className="bg-[#1D1D1F] text-white px-6 py-4 rounded-full font-bold text-sm shadow-sm flex items-center gap-3 hover:bg-black hover:scale-105 active:scale-95 transition-all"
          >
             <FaBullhorn /> Disparar Megafone
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-[#E5E5EA] border-t-black rounded-full animate-spin"></div>
                <span className="text-[#86868B] font-bold text-sm">Sincronizando infraestrutura de comunicação...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mensagens.length > 0 ? mensagens.map(msg => {
              const dDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
              let estabId = 'desconhecido';
              let realNome = 'Aviso / Megafone Global';
              
              if (!msg.isAvisoGeral) {
                if (msg._path) {
                  const parts = msg._path.split('/');
                  const idx = parts.indexOf('estabelecimentos');
                  if (idx >= 0) estabId = parts[idx+1];
                }
                realNome = estabMap[estabId] || estabId;
              } else if (msg.alvo && msg.alvo !== 'todos') {
                realNome = `Direto para: ${estabMap[msg.alvo] || msg.alvo}`;
              }

              const formattedType = msg.isAvisoGeral ? 'Aviso Master' : (msg.tipo ? msg.tipo.replace(/_/g, ' ') : 'Campanha de Marketing');
              
              return (
                <div key={msg.id} className="bg-white border border-[#E5E5EA] p-6 rounded-[2rem] shadow-sm hover:shadow-md hover:border-black/20 transition-all duration-300 relative group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-[1rem] bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#1D1D1F] shadow-sm mb-2 shrink-0 group-hover:scale-105 transition-transform">
                        <FaRocket size={16} />
                    </div>
                    <span className="text-[10px] bg-[#F5F5F7] text-[#86868B] font-bold px-3 py-1.5 rounded-full border border-[#E5E5EA]">
                        {dDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-[#1D1D1F] uppercase tracking-widest mb-3 line-clamp-1" title={formattedType}>
                    {formattedType}
                  </h3>
                  
                  <div className="bg-[#F5F5F7] p-4 rounded-[1.5rem] mb-6 flex-1 border border-[#E5E5EA] border-dashed">
                      <p className="text-sm font-semibold text-[#1D1D1F] line-clamp-4 leading-relaxed">
                        {msg.texto || msg.mensagem || 'Conteúdo inativo ou em branco...'}
                      </p>
                  </div>

                  <div className="pt-4 border-t border-[#F5F5F7]">
                    <p className="text-[10px] uppercase font-bold text-[#86868B] tracking-widest mb-2">Franquia Emissora</p>
                    <p className="text-xs font-bold text-[#86868B] uppercase truncate bg-[#F5F5F7] px-3 py-2 rounded-xl" title={realNome}>
                        {realNome}
                    </p>
                  </div>
                </div>
              );
            }) : (
               <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-[#E5E5EA] shadow-sm">
                 <div className="w-16 h-16 bg-[#F5F5F7] border border-[#E5E5EA] rounded-full mx-auto flex items-center justify-center mb-4">
                    <FaBoxOpen className="text-2xl text-[#86868B]" />
                 </div>
                 <h3 className="text-lg font-bold text-[#1D1D1F] tracking-tight">Sem Envios Recentes</h3>
                 <p className="text-[#86868B] font-medium text-sm mt-1">Nenhuma loja registrou disparos até o momento.</p>
               </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL MEGAFONE GLOBAL */}
      {modalMegafone && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-[#E5E5EA] flex justify-between items-center bg-[#F5F5F7]">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center">
                    <FaBullhorn />
                 </div>
                 <div>
                     <h2 className="text-lg font-black text-[#1D1D1F] tracking-tight">Megafone Global</h2>
                     <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest">Disparo para toda a rede</p>
                 </div>
              </div>
              <button onClick={() => setModalMegafone(false)} className="w-8 h-8 flex items-center justify-center bg-white border border-[#E5E5EA] rounded-full text-[#86868B] hover:text-black">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={dispararMegafone} className="p-6 space-y-5">
              
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-xs font-medium text-blue-800 mb-2">
                  Esta mensagem aparecerá como um pop-up de aviso obrigatório para o público alvo selecionado assim que entrar no sistema. Eles não poderão ignorar sem marcar como lido.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">Público Alvo da Mensagem</label>
                <select 
                  value={novoAviso.alvo}
                  onChange={(e) => setNovoAviso({...novoAviso, alvo: e.target.value})}
                  className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                >
                  <option value="todos">🌐 Toda a Rede (Global)</option>
                  {Object.entries(estabMap).sort((a,b) => a[1].localeCompare(b[1])).map(([id, nome]) => (
                    <option key={id} value={id}>🏪 Apenas: {nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">Título do Aviso</label>
                <input 
                  type="text" 
                  value={novoAviso.titulo}
                  onChange={(e) => setNovoAviso({ ...novoAviso, titulo: e.target.value })}
                  className="w-full bg-[#F5F5F7] border border-[#E5E5EA] focus:bg-white rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-all"
                  placeholder="Ex: Nova Atualização de Pagamento"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">Nível de Importância</label>
                <select 
                  value={novoAviso.tipo}
                  onChange={(e) => setNovoAviso({...novoAviso, tipo: e.target.value})}
                  className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                >
                  <option value="info">💬 Informativo / Atualização</option>
                  <option value="urgente">🚨 Urgente / Queda de Sistema</option>
                  <option value="dica">💡 Dica de Sucesso / Vendas</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">Mensagem Coletiva</label>
                <textarea 
                  value={novoAviso.mensagem}
                  onChange={(e) => setNovoAviso({ ...novoAviso, mensagem: e.target.value })}
                  className="w-full bg-[#F5F5F7] border border-[#E5E5EA] focus:bg-white rounded-xl px-4 py-3 text-sm resize-none h-32 outline-none transition-all"
                  placeholder="Escreva a mensagem para os lojistas..."
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loadingMegafone}
                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {loadingMegafone ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><FaRocket /> Enviar Disparo</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterMensagens;
