// src/pages/admin/ImportarCardapioMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, writeBatch, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { 
  FaUpload, 
  FaFileImport, 
  FaStore, 
  FaArrowLeft, 
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle
} from 'react-icons/fa';

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="bg-yellow-500 w-10 h-10 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-black font-bold text-xl">D</span>
            </div>
            <div>
              <span className="text-gray-900 font-bold text-2xl group-hover:text-yellow-600 transition-colors duration-300">
                DEU FOME
              </span>
              <span className="block text-xs text-gray-500 font-medium">IMPORTAR CARDÁPIO</span>
            </div>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-black font-bold text-sm">M</span>
              </div>
              <div className="text-right">
                <p className="text-gray-900 text-sm font-semibold">Master Admin</p>
                <p className="text-gray-500 text-xs">{userEmailPrefix}</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-sm"
            >
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Componente de Card
const Card = ({ title, children, className = '' }) => (
  <div className={`bg-white rounded-2xl p-6 border border-gray-200 shadow-sm ${className}`}>
    {title && (
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <FaFileImport className="mr-2 text-yellow-600" />
        {title}
      </h3>
    )}
    {children}
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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json') {
        toast.error('Por favor, selecione um arquivo JSON.');
        return;
      }
      setFile(selectedFile);
      setImportStats(null); // Reset stats quando novo arquivo é selecionado
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
      const produtosCollectionRef = collection(db, 'produtos');

      // 1. DELETAR produtos antigos deste estabelecimento
      console.log(`Buscando produtos antigos do estabelecimento ${selectedEstabelecimentoId} para deletar...`);
      const q = query(produtosCollectionRef, where('estabelecimentoId', '==', selectedEstabelecimentoId));
      const oldProductsSnapshot = await getDocs(q);
      
      let deletedCount = 0;
      if (!oldProductsSnapshot.empty) {
        deletedCount = oldProductsSnapshot.size;
        console.log(`Deletando ${deletedCount} produtos antigos.`);
        oldProductsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      }

      // 2. ADICIONAR os novos produtos
      let addedCount = 0;
      let categoriesCount = 0;
      
      dataToImport.categorias.forEach(categoria => {
        if (categoria.itens && Array.isArray(categoria.itens)) {
          categoriesCount++;
          categoria.itens.forEach(item => {
            const itemId = item.id || item.nome.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]+/g, '');
            const productRef = doc(produtosCollectionRef, itemId);
            
            const newProductData = {
              ...item,
              categoria: categoria.nome,
              ordemCategoria: categoria.ordem || 0,
              estabelecimentoId: selectedEstabelecimentoId,
              updatedAt: new Date()
            };
            
            batch.set(productRef, newProductData);
            addedCount++;
          });
        }
      });

      await batch.commit();

      // Log de auditoria
      await auditLogger(
        'CARDAPIO_IMPORTADO_OTIMIZADO',
        { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
        { 
          type: 'estabelecimento', 
          id: selectedEstabelecimentoId, 
          name: estabelecimentosList.find(e => e.id === selectedEstabelecimentoId)?.nome 
        },
        { 
          fileName: file.name, 
          produtosAdicionados: addedCount,
          produtosRemovidos: deletedCount,
          categoriasProcessadas: categoriesCount
        }
      );

      // Estatísticas da importação
      setImportStats({
        produtosAdicionados: addedCount,
        produtosRemovidos: deletedCount,
        categoriasProcessadas: categoriesCount,
        fileName: file.name
      });

      toast.success(`Cardápio importado com sucesso! ${addedCount} produtos processados.`);
      setFile(null);

    } catch (error) {
      console.error("Erro na importação:", error);
      toast.error(`Erro na importação: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const selectedEstabelecimento = estabelecimentosList.find(e => e.id === selectedEstabelecimentoId);

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900">
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-semibold">Carregando...</p>
      </div>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      
      <main className="max-w-4xl mx-auto">
        {/* Header da Página */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Importar Cardápio
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Importe cardápios em massa para estabelecimentos usando arquivos JSON
          </p>
        </div>

        {/* Botões de Navegação */}
        <div className="flex justify-between items-center mb-8">
          <Link 
            to="/master-dashboard" 
            className="flex items-center space-x-3 px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-300 shadow-sm"
          >
            <FaArrowLeft />
            <span>Voltar ao Dashboard</span>
          </Link>
        </div>

        {/* Formulário de Importação */}
        <Card title="Configuração da Importação">
          <form onSubmit={handleImport} className="space-y-6">
            {/* Seleção de Estabelecimento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estabelecimento
              </label>
              <div className="flex items-center space-x-3">
                <FaStore className="text-gray-400 text-xl" />
                <select
                  value={selectedEstabelecimentoId}
                  onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                  className="flex-grow px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-300 bg-white"
                  required
                >
                  <option value="">Selecione um estabelecimento</option>
                  {estabelecimentosList.map(est => (
                    <option key={est.id} value={est.id}>
                      {est.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Upload de Arquivo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Arquivo JSON do Cardápio
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-yellow-400 transition-colors duration-300">
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
                  <FaUpload className="text-gray-400 text-3xl mb-3" />
                  <span className="text-gray-600 font-medium">
                    {file ? file.name : 'Clique para selecionar o arquivo JSON'}
                  </span>
                  <span className="text-gray-400 text-sm mt-1">
                    Formato suportado: JSON
                  </span>
                </label>
              </div>
            </div>

            {/* Informações do Estabelecimento Selecionado */}
            {selectedEstabelecimento && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <FaExclamationTriangle className="text-yellow-600 text-xl" />
                  <div>
                    <p className="text-yellow-800 font-medium">
                      Importação para: {selectedEstabelecimento.nome}
                    </p>
                    <p className="text-yellow-600 text-sm">
                      Esta ação substituirá todos os produtos existentes deste estabelecimento.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Botão de Importação */}
            <button
              type="submit"
              disabled={!selectedEstabelecimentoId || !file || importing}
              className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-yellow-500 text-white font-semibold rounded-xl hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-sm"
            >
              {importing ? (
                <>
                  <FaSpinner className="animate-spin" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <FaFileImport />
                  <span>Importar Cardápio</span>
                </>
              )}
            </button>
          </form>
        </Card>

        {/* Estatísticas da Importação */}
        {importStats && (
          <Card title="Resultado da Importação" className="mt-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <FaCheckCircle className="text-green-600 text-2xl" />
                <h4 className="text-green-800 font-bold text-lg">
                  Importação Concluída com Sucesso!
                </h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <p className="text-2xl font-bold text-green-600">
                    {importStats.produtosAdicionados}
                  </p>
                  <p className="text-green-700 text-sm">Produtos Adicionados</p>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <p className="text-2xl font-bold text-yellow-600">
                    {importStats.categoriasProcessadas}
                  </p>
                  <p className="text-yellow-700 text-sm">Categorias Processadas</p>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <p className="text-2xl font-bold text-blue-600">
                    {importStats.produtosRemovidos}
                  </p>
                  <p className="text-blue-700 text-sm">Produtos Removidos</p>
                </div>
              </div>
              
              <p className="text-green-600 text-sm mt-4 text-center">
                Arquivo: {importStats.fileName}
              </p>
            </div>
          </Card>
        )}

        {/* Informações de Ajuda */}
        <Card title="Como Funciona" className="mt-6">
          <div className="space-y-3 text-gray-600">
            <p>• Selecione o estabelecimento que receberá o cardápio</p>
            <p>• Faça upload de um arquivo JSON com a estrutura correta</p>
            <p>• Todos os produtos existentes serão substituídos pelos novos</p>
            <p>• Os produtos serão organizados por categorias automaticamente</p>
          </div>
        </Card>
      </main>
    </div>
  );
}

export default ImportarCardapioMaster;