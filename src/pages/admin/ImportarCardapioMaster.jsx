// src/pages/admin/ImportarCardapioMaster.jsx
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
  FaSignOutAlt,
  FaTrash,
  FaPlusCircle,
  FaExchangeAlt
} from 'react-icons/fa';

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

// --- Header Minimalista (Reutilizado) ---
const DashboardHeader = ({ navigate, logout, currentUser }) => {
  const userEmailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : 'Admin';
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
           <div className="flex items-center gap-1">
              <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
                  <FaStore />
              </div>
              <span className="text-gray-900 font-extrabold text-xl tracking-tight">
                  Na<span className="text-yellow-500">Mão</span>
              </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">{userEmailPrefix}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Master Admin</span>
            </div>
            <button 
                onClick={logout} 
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                title="Sair"
            >
              <FaSignOutAlt />
            </button>
          </div>
      </div>
    </header>
  );
};

// --- Componentes Visuais ---
const StatBox = ({ label, value, icon, color }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">{label}</p>
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

  if (authLoading || loading) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="bg-gray-50 min-h-screen pt-20 pb-12 px-4 sm:px-6 font-sans text-gray-900">
      <DashboardHeader navigate={navigate} logout={logout} currentUser={currentUser} />
      
      <main className="max-w-4xl mx-auto">
        
        {/* Header da Página */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <button onClick={() => navigate('/master-dashboard')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors">
                    <FaArrowLeft /> Voltar ao Dashboard
                </button>
                <h1 className="text-3xl font-bold tracking-tight">Importar Cardápio</h1>
                <p className="text-gray-500 text-sm mt-1">Atualize o catálogo de produtos via arquivo JSON.</p>
            </div>
        </div>

        {/* Card Principal de Importação */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8">
                <form onSubmit={handleImport} className="space-y-8">
                    
                    {/* Seleção de Loja */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Loja de Destino</label>
                        <select
                            value={selectedEstabelecimentoId}
                            onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-black focus:border-transparent block p-4 transition-all"
                            required
                        >
                            <option value="">Selecione uma loja...</option>
                            {estabelecimentosList.map(est => (
                                <option key={est.id} value={est.id}>{est.nome}</option>
                            ))}
                        </select>
                    </div>

                    {/* Área de Drag & Drop */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Arquivo de Dados (JSON)</label>
                        <div
                            className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer group ${
                                dragActive 
                                ? 'border-yellow-400 bg-yellow-50' 
                                : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-black'
                            }`}
                            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                        >
                            <input type="file" accept=".json" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" id="file-upload" />
                            
                            <div className="flex flex-col items-center pointer-events-none">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${dragActive ? 'bg-white text-yellow-500' : 'bg-white text-gray-400 group-hover:text-black group-hover:shadow-md'}`}>
                                    {file ? <FaFileCode className="text-3xl" /> : <FaCloudUploadAlt className="text-3xl" />}
                                </div>
                                <p className="text-lg font-bold text-gray-700 group-hover:text-black transition-colors">
                                    {file ? file.name : 'Clique ou arraste o JSON aqui'}
                                </p>
                                <p className="text-sm text-gray-400 mt-2">
                                    {file ? `${(file.size / 1024).toFixed(2)} KB` : 'Suporta arquivos .json até 10MB'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Aviso e Botão */}
                    {selectedEstabelecimento && (
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex gap-3 items-start">
                            <FaExclamationTriangle className="text-orange-500 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-orange-800">
                                <span className="font-bold">Atenção:</span> Importar um novo cardápio para <strong>{selectedEstabelecimento.nome}</strong> apagará todos os produtos e categorias existentes nesta loja.
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!selectedEstabelecimentoId || !file || importing}
                        className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {importing ? (
                            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processando...</>
                        ) : (
                            <>Iniciar Importação</>
                        )}
                    </button>
                </form>
            </div>
        </div>

        {/* Resultado (Stats) */}
        {importStats && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-4">
                    <FaCheckCircle className="text-green-500 text-xl" />
                    <h3 className="font-bold text-gray-900 text-lg">Resumo da Operação</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatBox label="Novos Produtos" value={importStats.produtosAdicionados} icon={<FaPlusCircle />} color="bg-green-500" />
                    <StatBox label="Categorias" value={importStats.categoriasProcessadas} icon={<FaStore />} color="bg-black" />
                    <StatBox label="Itens Substituídos" value={importStats.produtosRemovidos} icon={<FaTrash />} color="bg-red-500" />
                </div>

                {importStats.conversaoEfetuada && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                        <FaExchangeAlt /> O sistema detectou um formato antigo e converteu o JSON automaticamente.
                    </div>
                )}
            </div>
        )}

        {/* Guia Rápido */}
        <div className="mt-12 border-t border-gray-200 pt-8">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Guia de Estrutura JSON</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-sm">1</div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm">Estrutura Raiz</p>
                        <p className="text-xs text-gray-500 mt-1">O arquivo deve conter um objeto principal com um array chamado "categorias".</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-sm">2</div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm">Conversão Automática</p>
                        <p className="text-xs text-gray-500 mt-1">JSONs de versões anteriores são adaptados automaticamente pelo sistema.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-sm">3</div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm">Backup Automático</p>
                        <p className="text-xs text-gray-500 mt-1">Não há desfazer. Certifique-se de ter um backup dos dados se necessário.</p>
                    </div>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
}

export default ImportarCardapioMaster;