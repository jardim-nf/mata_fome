import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { 
  FaStore, 
  FaCloudUploadAlt, 
  FaFileCode, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaArrowLeft, 
  FaTrash,
  FaPlusCircle,
  FaExchangeAlt,
  FaBolt
} from 'react-icons/fa';
import { IoLogOutOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- LÓGICA DE NEGÓCIO (Mantida Intacta) ---
function converterJSONParaSistema(seuJSON) {
  const cardapioConvertido = {
    categorias: seuJSON.categorias.map(categoria => ({
      nome: categoria.nome,
      ordem: categoria.ordem || 0,
      observacao: categoria.observacao || '',
      itens: categoria.itens.map(item => {
        const variacoes = item.variacoes.map((variacao, index) => ({
          id: `var-${index + 1}`,
          nome: variacao.tipo,
          preco: Number(variacao.preco),
          descricao: variacao.descricao || '',
          ativo: true
        }));

        return {
          nome: item.nome,
          descricao: item.descricao || '',
          preco: Math.min(...variacoes.map(v => Number(v.preco))),
          variacoes: variacoes,
          ativo: true,
          estoque: 0,
          estoqueMinimo: 0,
          custo: 0
        };
      })
    }))
  };
  return cardapioConvertido;
}

// --- Componentes Visuais Bento ---
const StatBox = ({ label, value, icon, colorClass }) => (
    <div className={`bg-white p-6 rounded-[2rem] border border-[#E5E5EA] shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow`}>
        <div className={`w-14 h-14 rounded-[1rem] flex items-center justify-center text-xl font-black ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-black tracking-widest uppercase text-[#86868B]">{label}</p>
            <p className="text-3xl font-black text-[#1D1D1F]">{value}</p>
        </div>
    </div>
);

function ImportarCardapioMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [estabelecimentosList, setEstabelecimentosList] = useState([]);
  const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        navigate('/master-dashboard');
        return;
      }
      setLoading(false);
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      if (!isMasterAdmin || !currentUser) return;
      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome'));
        const querySnapshot = await getDocs(q);
        setEstabelecimentosList(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        toast.error('Erro ao carregar estabelecimentos.');
      }
    };
    fetchEstabelecimentos();
  }, [isMasterAdmin, currentUser]);

  // Handlers de Arquivo
  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) validateAndSetFile(e.target.files[0]);
  };

  const validateAndSetFile = (selectedFile) => {
    if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json')) {
        toast.error('Apenas arquivos .json são permitidos.');
        return;
    }
    setFile(selectedFile);
    setImportStats(null);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!selectedEstabelecimentoId || !file) return toast.warn('Preencha todos os campos.');

    setImporting(true);
    setImportStats(null);

    try {
      const fileContent = await file.text();
      const dataToImport = JSON.parse(fileContent); 
      let dadosParaImportar = dataToImport;
      
      // Detecção de formato antigo e conversão
      if (dataToImport.categorias && dataToImport.categorias[0]?.itens?.[0]?.variacoes?.[0]?.tipo) {
        dadosParaImportar = converterJSONParaSistema(dataToImport);
      }

      if (!dadosParaImportar || !Array.isArray(dadosParaImportar.categorias)) {
        throw new Error('JSON inválido. Estrutura "categorias" não encontrada.');
      }

      const batch = writeBatch(db);
      const estabelecimentoDocRef = doc(db, 'estabelecimentos', selectedEstabelecimentoId);
      const categoriasCollectionRef = collection(estabelecimentoDocRef, 'cardapio');

      // 1. Limpeza (Deletar antigo)
      const oldCategoriesSnapshot = await getDocs(query(categoriasCollectionRef));
      let deletedItemsCount = 0;
      
      for (const categoryDoc of oldCategoriesSnapshot.docs) {
        const itemsSnapshot = await getDocs(query(collection(categoriasCollectionRef, categoryDoc.id, 'itens')));
        itemsSnapshot.docs.forEach(itemDoc => {
            batch.delete(itemDoc.ref);
            deletedItemsCount++;
        });
        batch.delete(categoryDoc.ref);
      }

      // 2. Inserção (Novos dados)
      let addedItemsCount = 0;
      dadosParaImportar.categorias.forEach(categoria => {
        const categoryId = categoria.nome.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]+/g, '');
        const categoryDocRef = doc(categoriasCollectionRef, categoryId);
        
        batch.set(categoryDocRef, {
          nome: categoria.nome,
          ordem: categoria.ordem || 0,
          observacao: categoria.observacao || '',
          updatedAt: new Date()
        });

        const itemsCollectionRef = collection(categoryDocRef, 'itens');
        if (categoria.itens) {
          categoria.itens.forEach(item => {
            const itemId = item.id || item.nome.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]+/g, '');
            batch.set(doc(itemsCollectionRef, itemId), {
              ...item,
              categoriaNome: categoria.nome, 
              estabelecimentoId: selectedEstabelecimentoId,
              updatedAt: new Date()
            });
            addedItemsCount++;
          });
        }
      });

      await batch.commit();
      
      const stats = {
        produtosAdicionados: addedItemsCount,
        produtosRemovidos: deletedItemsCount,
        categoriasProcessadas: dadosParaImportar.categorias.length,
        fileName: file.name,
        conversaoEfetuada: dataToImport !== dadosParaImportar
      };

      await auditLogger('CARDAPIO_IMPORTADO', 
        { uid: currentUser.uid, email: currentUser.email }, 
        { id: selectedEstabelecimentoId }, 
        stats
      );

      setImportStats(stats);
      toast.success(`Importação concluída! ${addedItemsCount} itens processados.`);
      setFile(null);

    } catch (error) {
      console.error(error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const selectedEstabelecimento = estabelecimentosList.find(e => e.id === selectedEstabelecimentoId);

  if (authLoading || loading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Importador Universal</h1>
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

      <main className="max-w-4xl mx-auto mt-12 pb-12">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col mb-10 px-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <span className="bg-[#1D1D1F] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-2"><FaBolt className="text-yellow-400" /> Ferramenta de Carga</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Importar Cardápio</h1>
            <p className="text-[#86868B] text-sm mt-2 font-medium">Substitua o catálogo de produtos de qualquer operação enviando um arquivo JSON master.</p>
        </div>

        {/* Card Principal de Importação */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-[#E5E5EA] overflow-hidden mb-8">
            <div className="p-8 md:p-10">
                <form onSubmit={handleImport} className="space-y-8">
                    
                    {/* Seleção de Loja */}
                    <div>
                        <label className="block text-[11px] font-black text-[#86868B] uppercase tracking-widest mb-3">Selecione a Loja Alvo</label>
                        <div className="relative">
                            <select
                                value={selectedEstabelecimentoId}
                                onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                                className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] font-bold text-sm rounded-2xl block p-5 transition-all hover:border-[#86868B] focus:border-black appearance-none cursor-pointer"
                                required
                            >
                                <option value="" disabled hidden>Selecione uma loja...</option>
                                {estabelecimentosList.map(est => (
                                    <option key={est.id} value={est.id}>{est.nome}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[#86868B] font-bold text-[10px]">▼</div>
                        </div>
                    </div>

                    {/* Área de Drag & Drop */}
                    <div>
                        <label className="block text-[11px] font-black text-[#86868B] uppercase tracking-widest mb-3">Arquivo JSON de Origem</label>
                        <div
                            className={`relative border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300 cursor-pointer group ${
                                dragActive 
                                ? 'border-[#1D1D1F] bg-black/5' 
                                : 'border-[#E5E5EA] bg-[#F5F5F7] hover:bg-white hover:border-[#1D1D1F]'
                            }`}
                            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                        >
                            <input type="file" accept=".json" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" id="file-upload" />
                            
                            <div className="flex flex-col items-center pointer-events-none">
                                <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-6 transition-colors shadow-sm ${dragActive ? 'bg-[#1D1D1F] text-white' : 'bg-white border border-[#E5E5EA] text-[#1D1D1F] group-hover:scale-110'}`}>
                                    {file ? <FaFileCode className="text-3xl" /> : <FaCloudUploadAlt className="text-3xl text-[#86868B]" />}
                                </div>
                                <p className="text-xl font-bold text-[#1D1D1F] transition-colors tracking-tight">
                                    {file ? file.name : 'Arraste o arquivo ou clique aqui'}
                                </p>
                                <p className="text-sm font-semibold text-[#86868B] mt-2">
                                    {file ? `${(file.size / 1024).toFixed(2)} KB` : 'Suporta apenas arquivos no formato JSON'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Aviso e Botão */}
                    {selectedEstabelecimento && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500 shrink-0">
                                <FaExclamationTriangle size={16} />
                            </div>
                            <div className="text-sm text-red-800 leading-relaxed font-medium">
                                <span className="font-bold block text-red-900 mb-1">Ação Irreversível</span>
                                Iniciar a importação para <strong className="text-black bg-white px-1.5 py-0.5 rounded shadow-sm mx-1">{selectedEstabelecimento.nome}</strong> apagará completamente o cardápio atuante. Certifique-se da escolha antes de acionar.
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!selectedEstabelecimentoId || !file || importing}
                        className="w-full py-5 bg-[#1D1D1F] text-white rounded-[1.5rem] font-bold text-lg hover:bg-black hover:scale-[1.01] transition-all shadow-sm disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95"
                    >
                        {importing ? (
                            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Injetando Dados...</>
                        ) : (
                            <>Executar Importação Global</>
                        )}
                    </button>
                </form>
            </div>
        </div>

        {/* Resultado (Stats) */}
        {importStats && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6 px-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <FaCheckCircle className="text-emerald-500 text-sm" />
                    </div>
                    <h3 className="font-bold text-[#1D1D1F] text-xl tracking-tight">Operação Concluída com Sucesso</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                    <StatBox label="Novos Produtos" value={importStats.produtosAdicionados} icon={<FaPlusCircle />} colorClass="bg-emerald-50 text-emerald-600 border border-emerald-100" />
                    <StatBox label="Categorias" value={importStats.categoriasProcessadas} icon={<FaStore />} colorClass="bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA]" />
                    <StatBox label="Substituídos" value={importStats.produtosRemovidos} icon={<FaTrash />} colorClass="bg-red-50 text-red-500 border border-red-100" />
                </div>

                {importStats.conversaoEfetuada && (
                    <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl text-blue-800 text-sm flex items-center gap-3 font-semibold shadow-sm">
                        <FaExchangeAlt className="text-blue-500" /> Estrutura antiga detectada e convertida para o motor de cardápio atual (Mata Fome v2 JSON Spec).
                    </div>
                )}
            </div>
        )}

        {/* Guia Rápido */}
        <div className="mt-16 pt-10 border-t border-[#E5E5EA]">
            <h4 className="text-[11px] font-black text-[#86868B] uppercase tracking-widest mb-8 text-center md:text-left">Critérios de Carga</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col gap-3">
                    <div className="w-10 h-10 rounded-[1rem] bg-white border border-[#E5E5EA] shadow-sm flex items-center justify-center font-black text-[#1D1D1F] text-sm">01</div>
                    <div>
                        <p className="font-bold text-[#1D1D1F] text-base mb-1">Matriz Obrigatória</p>
                        <p className="text-sm text-[#86868B] font-medium leading-relaxed">O arquivo matriz deve encapsular todo seu conteúdo num array root sinalizado por "categorias".</p>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="w-10 h-10 rounded-[1rem] bg-white border border-[#E5E5EA] shadow-sm flex items-center justify-center font-black text-[#1D1D1F] text-sm">02</div>
                    <div>
                        <p className="font-bold text-[#1D1D1F] text-base mb-1">Retrocompatibilidade</p>
                        <p className="text-sm text-[#86868B] font-medium leading-relaxed">JSONs exportados nas versões legadas do sistema terão as chaves e valores auto-convertidos no push.</p>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="w-10 h-10 rounded-[1rem] bg-white border border-[#E5E5EA] shadow-sm flex items-center justify-center font-black text-[#1D1D1F] text-sm">03</div>
                    <div>
                        <p className="font-bold text-[#1D1D1F] text-base mb-1">Overwrite Silencioso</p>
                        <p className="text-sm text-[#86868B] font-medium leading-relaxed">A carga nova é destrutiva para o cardápio da loja-alvo. Mantenha controle de versão de exportação.</p>
                    </div>
                </div>
            </div>
        </div>

      </main>

      {/* ESTILOS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default ImportarCardapioMaster;