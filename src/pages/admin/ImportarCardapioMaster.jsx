// src/pages/admin/ImportarCardapioMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';

// Componente de Header atualizado
function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Master';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logout realizado com sucesso!');
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error('Erro ao fazer logout.');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-white shadow-lg border-b border-gray-200 backdrop-blur-sm bg-white/95">
      <div className="font-extrabold text-2xl text-gray-900 cursor-pointer hover:text-yellow-500 transition-colors duration-300 flex items-center gap-2" onClick={() => navigate('/')}>
        <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">DF</span>
        </div>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="hidden sm:flex items-center space-x-3 bg-gray-100 rounded-full px-4 py-2">
          <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">{userEmailPrefix.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-gray-700 text-sm font-medium">Olá, {userEmailPrefix}!</span>
        </div>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full bg-yellow-500 text-white font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-gray-700 border border-gray-300 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-50 hover:border-gray-400 transform hover:-translate-y-0.5 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Sair
        </button>
      </div>
    </header>
  );
}

// Componente de Card Atualizado
const Card = ({ title, children, className = '', icon }) => (
  <div className={`bg-white rounded-2xl shadow-lg p-8 border border-gray-200 hover:shadow-xl transition-all duration-300 ${className}`}>
    {title && (
      <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
        {icon}
        {title}
      </h3>
    )}
    {children}
  </div>
);

// Componente de Estatística
const StatCard = ({ number, label, color = 'blue' }) => {
  const colorClasses = {
    green: 'text-green-600 bg-green-50 border-green-200',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    blue: 'text-blue-600 bg-blue-50 border-blue-200',
    purple: 'text-purple-600 bg-purple-50 border-purple-200'
  };

  return (
    <div className={`bg-white rounded-xl p-6 border-2 text-center ${colorClasses[color]}`}>
      <p className="text-3xl font-bold mb-2">{number}</p>
      <p className="text-sm font-semibold">{label}</p>
    </div>
  );
};

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

  // Controle de acesso
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
      setLoading(false);
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // Buscar estabelecimentos
  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      if (!isMasterAdmin || !currentUser) return;

      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome'));
        const querySnapshot = await getDocs(q);
        const estabelecimentos = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEstabelecimentosList(estabelecimentos);
      } catch (error) {
        console.error("Erro ao carregar estabelecimentos:", error);
        toast.error('Erro ao carregar estabelecimentos.');
      }
    };

    fetchEstabelecimentos();
  }, [isMasterAdmin, currentUser]);

  // Handlers para drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type !== 'application/json') {
        toast.error('Por favor, selecione um arquivo JSON.');
        return;
      }
      setFile(selectedFile);
      setImportStats(null);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json') {
        toast.error('Por favor, selecione um arquivo JSON.');
        return;
      }
      setFile(selectedFile);
      setImportStats(null);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!selectedEstabelecimentoId || !file) {
      toast.error('Selecione um estabelecimento e um arquivo JSON.');
      return;
    }

    setImporting(true);
    setImportStats(null);

    try {
      const fileContent = await file.text();
      const dataToImport = JSON.parse(fileContent); 

      if (!dataToImport || !Array.isArray(dataToImport.categorias)) {
        throw new Error('Estrutura de arquivo JSON inválida. Espera um objeto com "categorias".');
      }

      const batch = writeBatch(db);
      
      // 🛑 1. DEFINIÇÃO DA REFERÊNCIA PRINCIPAL: estabelecimentos/{id}/cardapio
      const estabelecimentoDocRef = doc(db, 'estabelecimentos', selectedEstabelecimentoId);
      const categoriasCollectionRef = collection(estabelecimentoDocRef, 'cardapio'); // <-- Coleção das Categorias

      // --- DELEÇÃO DE DADOS ANTIGOS ---
      console.log(`[DEBUG] 1. Tentando buscar CATEGORIAS e ITENS antigos...`);
      
      let deletedCategoriesCount = 0;
      let deletedItemsCount = 0;

      try {
        // 1.1. Buscar TODAS as CATEGORIAS antigas
        const qCategories = query(categoriasCollectionRef); 
        const oldCategoriesSnapshot = await getDocs(qCategories);
        
        deletedCategoriesCount = oldCategoriesSnapshot.size;
        console.log(`[DEBUG] 1.1. Encontradas ${deletedCategoriesCount} categorias antigas.`);

        // 1.2. Iterar sobre CADA CATEGORIA para deletar seus ITENS e a própria Categoria
        for (const categoryDoc of oldCategoriesSnapshot.docs) {
          const categoryId = categoryDoc.id;
          
          // Referência para a subcoleção 'itens'
          const itemsCollectionRef = collection(categoriasCollectionRef, categoryId, 'itens');

          const qItems = query(itemsCollectionRef);
          const oldItemsSnapshot = await getDocs(qItems);
          
          // Marcar todos os itens da subcoleção 'itens' para deleção
          oldItemsSnapshot.docs.forEach(itemDoc => {
            batch.delete(itemDoc.ref);
            deletedItemsCount++;
          });

          // Marcar o documento da CATEGORIA pai para deleção
          batch.delete(categoryDoc.ref);
        }
        console.log(`[DEBUG] 1.3. ${deletedCategoriesCount} categorias e ${deletedItemsCount} itens marcados para deleção no batch.`);

      } catch (readError) {
        console.error("[ERRO CRÍTICO] Falha na busca/leitura dos dados antigos:", readError);
        throw new Error(`Falha na leitura (Regras de Segurança?): ${readError.message}`);
      }


      // --- ADIÇÃO DOS NOVOS DADOS ---
      let addedItemsCount = 0;
      
      dataToImport.categorias.forEach(categoria => {
        // 2.1. Crie o Documento da CATEGORIA (Slug do nome como ID)
        const categoryId = categoria.nome.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]+/g, '');
        const categoryDocRef = doc(categoriasCollectionRef, categoryId);
        
        const categoryData = {
          nome: categoria.nome,
          ordem: categoria.ordem || 0,
          updatedAt: new Date()
        };

        // Adicionar a Categoria como um Documento
        batch.set(categoryDocRef, categoryData);
        console.log(`[DEBUG] 2.1. Criando Categoria: ${categoria.nome} (ID: ${categoryId})`);

        // 2.2. Defina a Referência para a subcoleção 'itens' dentro da Categoria
        const itemsCollectionRef = collection(categoryDocRef, 'itens');

        if (categoria.itens && Array.isArray(categoria.itens)) {
          
          categoria.itens.forEach(item => {
            // Gerar ID do documento para o item (produto)
            const itemId = item.id || item.nome.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]+/g, '');
            const itemDocRef = doc(itemsCollectionRef, itemId);
            
            const newItemData = {
              ...item,
              // Mantendo o nome da categoria no produto para facilitar queries
              categoriaNome: categoria.nome, 
              estabelecimentoId: selectedEstabelecimentoId, // Manter o ID do estabelecimento no produto, mesmo aninhado, é uma boa prática
              updatedAt: new Date()
            };
            
            // Adicionar o Item (Produto) à subcoleção 'itens'
            batch.set(itemDocRef, newItemData);
            addedItemsCount++;
          });
        }
      });

      console.log(`[DEBUG] 2.2. Total de itens para adicionar ao Firebase: ${addedItemsCount}`);
      
      // --- COMMIT ---
      console.log("[DEBUG] 3. Tentando commitar o batch...");
      
      try {
          await batch.commit();
          console.log("[DEBUG] 3.1. Batch commitado com sucesso no Firebase!");
      } catch (commitError) {
          console.error("[ERRO CRÍTICO] Falha no commit do Batch:", commitError);
          throw new Error(`Falha na escrita (Regras de Segurança?): ${commitError.message}`);
      }
      
      await auditLogger(
        'CARDAPIO_IMPORTADO_OTIMIZADO_ANINHADO', // Atualizado o tipo de log para refletir a nova estrutura
        { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
        { 
          type: 'estabelecimento', 
          id: selectedEstabelecimentoId, 
          name: estabelecimentosList.find(e => e.id === selectedEstabelecimentoId)?.nome 
        },
        {
          fileName: file.name, 
          produtosAdicionados: addedItemsCount,
          produtosRemovidos: deletedItemsCount,
          categoriasProcessadas: dataToImport.categorias.length
        },
        null
      );

      // Estatísticas da importação
      setImportStats({
        produtosAdicionados: addedItemsCount,
        produtosRemovidos: deletedItemsCount,
        categoriasProcessadas: dataToImport.categorias.length,
        fileName: file.name
      });

      toast.success(`Cardápio importado com sucesso! ${addedItemsCount} produtos processados.`);
      setFile(null);

    } catch (error) {
      console.error("ERRO FINAL NA IMPORTAÇÃO (Pegou no catch principal):", error);
      toast.error(`Erro na importação: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const selectedEstabelecimento = estabelecimentosList.find(e => e.id === selectedEstabelecimentoId);

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mb-4"></div>
        <p className="text-xl text-gray-600 font-medium">Carregando...</p>
        <p className="text-sm text-gray-500 mt-2">Preparando ambiente de importação</p>
      </div>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen pt-24 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      
      <main className="max-w-4xl mx-auto">
        {/* Header da Página */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Importar Cardápio
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Importe cardápios completos para estabelecimentos usando arquivos JSON formatados
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Botões de Navegação */}
        <div className="flex justify-between items-center mb-8">
          <Link 
            to="/master-dashboard" 
            className="bg-white text-gray-700 font-semibold px-6 py-3 rounded-xl border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 flex items-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Voltar ao Dashboard
          </Link>
        </div>

        {/* Formulário de Importação */}
        <Card 
          title="Configuração da Importação" 
          icon={
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
            </svg>
          }
        >
          <form onSubmit={handleImport} className="space-y-8">
            {/* Seleção de Estabelecimento */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Estabelecimento Destino
              </label>
              <div className="relative">
                <select
                  value={selectedEstabelecimentoId}
                  onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                  className="w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-4 pl-12 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0 appearance-none"
                  required
                >
                  <option value="">Selecione um estabelecimento...</option>
                  {estabelecimentosList.map(est => (
                    <option key={est.id} value={est.id}>
                      {est.nome}
                    </option>
                  ))}
                </select>
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </div>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Upload de Arquivo com Drag & Drop */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Arquivo JSON do Cardápio
              </label>
              <div
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                  dragActive 
                    ? 'border-yellow-500 bg-yellow-50' 
                    : 'border-gray-300 bg-gray-50 hover:border-yellow-400 hover:bg-yellow-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  required
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
                  </svg>
                  <span className="text-gray-600 font-medium text-lg mb-2">
                    {file ? file.name : 'Clique ou arraste o arquivo JSON'}
                  </span>
                  <span className="text-gray-400 text-sm">
                    Formato suportado: JSON • Tamanho máximo: 10MB
                  </span>
                </label>
              </div>
            </div>

            {/* Informações do Estabelecimento Selecionado */}
            {selectedEstabelecimento && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <svg className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"/>
                  </svg>
                  <div>
                    <p className="text-yellow-800 font-semibold text-lg">
                      Importação para: {selectedEstabelecimento.nome}
                    </p>
                    <p className="text-yellow-600 mt-2">
                      <strong>Atenção:</strong> Esta ação substituirá **TODAS** as categorias e produtos existentes. 
                      Certifique-se de que o arquivo JSON está formatado corretamente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Botão de Importação */}
            <button
              type="submit"
              disabled={!selectedEstabelecimentoId || !file || importing}
              className="w-full px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-bold hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Processando Importação...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
                  </svg>
                  Iniciar Importação do Cardápio
                </>
              )}
            </button>
          </form>
        </Card>

        {/* Estatísticas da Importação */}
        {importStats && (
          <Card 
            title="Resultado da Importação" 
            className="mt-8"
            icon={
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            }
          >
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-green-800 font-bold text-xl">
                    Importação Concluída com Sucesso!
                  </h4>
                  <p className="text-green-600">
                    Arquivo processado: {importStats.fileName}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard 
                  number={importStats.produtosAdicionados} 
                  label="Produtos Adicionados" 
                  color="green"
                />
                <StatCard 
                  number={importStats.categoriasProcessadas} 
                  label="Categorias Processadas" 
                  color="yellow"
                />
                <StatCard 
                  number={importStats.produtosRemovidos} 
                  label="Itens Removidos" 
                  color="blue"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Informações de Ajuda */}
        <Card 
          title="Como Preparar o Arquivo JSON" 
          className="mt-8"
          icon={
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 text-sm font-bold">1</span>
                </div>
                <div>
                  <p className="text-gray-800 font-semibold">Estrutura do JSON</p>
                  <p className="text-gray-600 text-sm mt-1">
                    O arquivo deve conter um objeto com array "categorias", cada categoria com "itens"
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 text-sm font-bold">2</span>
                </div>
                <div>
                  <p className="text-gray-800 font-semibold">Produtos por Categoria</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Cada item deve ter nome, descrição, preço e outros campos necessários
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 text-sm font-bold">3</span>
                </div>
                <div>
                  <p className="text-gray-800 font-semibold">Substituição Total</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Todos os itens e categorias antigas serão removidos e substituídos pelos novos.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 text-sm font-bold">4</span>
                </div>
                <div>
                  <p className="text-gray-800 font-semibold">Organização Aninhada</p>
                  <p className="text-gray-600 text-sm mt-1">
                    O cardápio será salvo na estrutura: `estabelecimento/cardapio/categoria/itens/produto`
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

export default ImportarCardapioMaster;