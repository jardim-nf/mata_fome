// src/pages/admin/ImportarCardapioMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';

// --- Componente de Header Master Dashboard (reutilizado) ---
// Normalmente, isso estaria em um Layout.jsx ou componente separado.
function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Você foi desconectado com sucesso!');
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error('Ocorreu um erro ao tentar desconectar.');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-black shadow-md border-b border-gray-800">
      <div className="font-extrabold text-2xl text-white cursor-pointer hover:text-gray-200 transition-colors duration-300" onClick={() => navigate('/')}>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-white text-md font-medium">Olá, {userEmailPrefix}!</span>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
            Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-white border border-gray-600 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-800 hover:border-gray-500"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
// --- Fim DashboardHeader ---


function ImportarCardapioMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); // Importa logout para o Header

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estabelecimentosList, setEstabelecimentosList] = useState([]);
  const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  useEffect(() => {
    if (!isMasterAdmin || !currentUser) return;

    const fetchEstabelecimentos = async () => {
      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
        setEstabelecimentosList(list);
        setLoading(false);
      } catch (err) {
        console.error("Erro ao carregar lista de estabelecimentos:", err);
        setError("Erro ao carregar lista de estabelecimentos.");
        setLoading(false);
      }
    };
    fetchEstabelecimentos();
  }, [isMasterAdmin, currentUser]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!selectedEstabelecimentoId) {
      toast.error('Por favor, selecione um estabelecimento.');
      return;
    }
    if (!file) {
      toast.error('Por favor, selecione um arquivo para importar.');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fileContent = event.target.result;
          let dataToImport;

          if (file.type === 'application/json') {
            dataToImport = JSON.parse(fileContent);
          } else {
            throw new Error('Formato de arquivo não suportado. Use JSON.');
          }

          if (!dataToImport || !Array.isArray(dataToImport.categorias)) {
            throw new Error('Estrutura de arquivo JSON inválida. Espera um objeto com "categorias".');
          }

          const batch = writeBatch(db);
          const cardapioCollectionRef = collection(db, 'estabelecimentos', selectedEstabelecimentoId, 'cardapio');
          
          // Primeiramente, vamos DELETAR todas as categorias e itens existentes para evitar duplicidade
          // NOTA: Isso pode ser demorado para cardápios grandes e pode atingir limites do batch.
          // Uma abordagem mais robusta seria primeiro deletar categorias, depois itens, ou
          // usar Cloud Functions para lidar com isso no backend.
          const existingCategoriesSnapshot = await getDocs(cardapioCollectionRef);
          for (const catDoc of existingCategoriesSnapshot.docs) {
              const itemsCollectionRef = collection(catDoc.ref, 'itens');
              const existingItemsSnapshot = await getDocs(itemsCollectionRef);
              for (const itemDoc of existingItemsSnapshot.docs) {
                  batch.delete(itemDoc.ref); // Deleta itens
              }
              batch.delete(catDoc.ref); // Deleta categoria
          }


          dataToImport.categorias.forEach(categoria => {
            const categoriaId = categoria.id || categoria.nome.toLowerCase().replace(/\s/g, '-');
            const categoriaRef = doc(cardapioCollectionRef, categoriaId);
            batch.set(categoriaRef, { nome: categoria.nome, ordem: categoria.ordem || 0 });

            if (categoria.itens && Array.isArray(categoria.itens)) {
              categoria.itens.forEach(item => {
                const itemId = item.id || item.nome.toLowerCase().replace(/\s/g, '-');
                const itemRef = doc(categoriaRef, 'itens', itemId);
                batch.set(itemRef, item);
              });
            }
          });

          await batch.commit();

          auditLogger(
              'CARDAPIO_IMPORTADO',
              { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
              { type: 'estabelecimento', id: selectedEstabelecimentoId, name: estabelecimentosList.find(e => e.id === selectedEstabelecimentoId)?.nome || 'N/A' },
              { fileName: file.name, fileSize: file.size, numCategorias: dataToImport.categorias.length }
          );

          toast.success('Cardápio importado com sucesso!');
          setFile(null);
          setSelectedEstabelecimentoId('');
        } catch (parseError) {
          setError(`Erro ao processar o arquivo: ${parseError.message}`);
          toast.error(`Erro ao processar o arquivo: ${parseError.message}`);
        } finally {
          setImporting(false);
        }
      };

      reader.readAsText(file);

    } catch (err) {
      setError(`Erro no upload do arquivo: ${err.message}`);
      toast.error(`Erro no upload do arquivo: ${err.message}`);
      setImporting(false);
    }
  };

  if (authLoading || loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <p className="text-xl text-black">Carregando...</p>
        </div>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4"> {/* Adiciona pt-24 para compensar o header fixo */}
      {/* Header (reutilizado do MasterDashboard) */}
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} /> 
      
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
        {/* Título da Página e Botão Voltar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl font-extrabold text-black text-center sm:text-left">
            Importar Cardápio
            <div className="w-24 h-1 bg-yellow-500 mx-auto sm:mx-0 mt-2 rounded-full"></div>
          </h1>
          <Link 
            to="/master-dashboard" 
            className="bg-gray-200 text-gray-700 font-semibold px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-300 flex items-center gap-2 shadow-md"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
            Voltar
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
            <p className="font-bold">Erro na Importação:</p>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleImport} className="space-y-6">
          {/* Seleção do Estabelecimento */}
          <div>
            <label htmlFor="estabelecimentoSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o Estabelecimento:
            </label>
            <select
              id="estabelecimentoSelect"
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2.5 bg-white text-gray-800 focus:border-yellow-500 focus:ring-yellow-500 transition-colors duration-300"
              value={selectedEstabelecimentoId}
              onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
              required
              disabled={importing}
            >
              <option value="">-- Selecione --</option>
              {estabelecimentosList.map(estab => (
                <option key={estab.id} value={estab.id}>{estab.nome}</option>
              ))}
            </select>
          </div>

          {/* Seleção do Arquivo de Cardápio (JSON) */}
          <div>
            <label htmlFor="cardapioFile" className="block text-sm font-medium text-gray-700 mb-2">
              Arquivo do Cardápio (JSON):
            </label>
            <div className="flex items-center space-x-3"> {/* Aumentei o espaçamento */}
              <input
                type="file"
                id="cardapioFile"
                accept=".json" // Aceita apenas arquivos JSON
                onChange={handleFileChange}
                className="hidden" // Esconde o input de arquivo padrão
                required
                disabled={importing}
              />
              <label 
                htmlFor="cardapioFile" 
                className="cursor-pointer bg-yellow-500 hover:bg-yellow-600 text-black px-5 py-2.5 rounded-lg font-bold shadow-md transition-colors duration-300 flex-shrink-0" // Botão mais robusto
              >
                Escolher arquivo
              </label>
              <span className="text-sm text-gray-700 truncate"> {/* Adicionado truncate */}
                {file ? file.name : "Nenhum arquivo selecionado"}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Formato esperado: Arquivo JSON contendo uma estrutura de cardápio com "categorias" e "itens".
            </p>
          </div>

          {/* Botão de Importar */}
          <button
            type="submit"
            disabled={importing}
            className="w-full px-6 py-3 bg-black text-white text-lg font-bold rounded-lg shadow-md hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-300 mt-8"
          >
            {importing ? 'Importando...' : 'Importar Cardápio'}
          </button>
        </form>

        {/* Seção da Estrutura JSON Esperada - Melhor Visibilidade e Estilo */}
        <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-inner"> {/* Sombra interna */}
          <h3 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
            Estrutura JSON Esperada
          </h3>
          <pre className="bg-gray-800 p-4 rounded-lg text-sm text-yellow-100 overflow-x-auto leading-relaxed font-mono relative"> {/* Fundo escuro, texto claro */}
            <button
                onClick={() => navigator.clipboard.writeText(`{
  "categorias": [
    {
      "id": "lanches", // Opcional, se não houver, usará o nome para o ID
      "nome": "Lanches",
      "ordem": 1,
      "itens": [
        {
          "id": "x-tudo",
          "nome": "X-Tudo",
          "descricao": "Pão, bife, queijo, presunto, ovo, bacon, alface, tomate, milho, batata palha",
          "preco": 25.00,
          "disponivel": true,
          "imageUrl": "https://example.com/x-tudo.jpg",
          "adicionais": [
            {
              "id": "bacon-extra",
              "nome": "Bacon Extra",
              "preco": 5.00
            }
          ]
        }
      ]
    }
  ]
}`)}
                className="absolute top-2 right-2 bg-gray-700 text-gray-300 px-3 py-1 rounded-md text-xs hover:bg-gray-600 transition-colors duration-200"
            >
                Copiar
            </button>
            <code>
{`{
  "categorias": [
    {
      "id": "lanches", // Opcional, se não houver, usará o nome para o ID
      "nome": "Lanches",
      "ordem": 1,
      "itens": [
        {
          "id": "x-tudo",
          "nome": "X-Tudo",
          "descricao": "Pão, bife, queijo, presunto, ovo, bacon, alface, tomate, milho, batata palha",
          "preco": 25.00,
          "disponivel": true,
          "imageUrl": "https://example.com/x-tudo.jpg",
          "adicionais": [
            {
              "id": "bacon-extra",
              "nome": "Bacon Extra",
              "preco": 5.00
            }
          ]
        },
        {
          "id": "x-salada",
          "nome": "X-Salada",
          "descricao": "Pão, bife, queijo, alface, tomate",
          "preco": 20.00,
          "disponivel": true,
          "imageUrl": "https://example.com/x-salada.jpg"
        }
      ]
    },
    {
      "id": "bebidas",
      "nome": "Bebidas",
      "ordem": 2,
      "itens": [
        {
          "id": "coca-cola",
          "nome": "Coca-Cola Lata",
          "descricao": "Lata 350ml",
          "preco": 6.00,
          "disponivel": true
        }
      ]
    }
  ]
}`}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}

export default ImportarCardapioMaster;