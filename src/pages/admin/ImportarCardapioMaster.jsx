// src/pages/admin/ImportarCardapioMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';

// Se você tiver um componente Layout, descomente a linha abaixo e as tags <Layout>
// import Layout from '../../Layout'; // Verifique o caminho exato!

function ImportarCardapioMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

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
          
          dataToImport.categorias.forEach(categoria => {
            const categoriaRef = doc(cardapioCollectionRef, categoria.id || categoria.nome.toLowerCase().replace(/\s/g, '-'));
            batch.set(categoriaRef, { nome: categoria.nome, ordem: categoria.ordem || 0 });

            if (categoria.itens && Array.isArray(categoria.itens)) {
              categoria.itens.forEach(item => {
                const itemRef = doc(categoriaRef, 'itens', item.id || item.nome.toLowerCase().replace(/\s/g, '-'));
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
      // <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl text-gray-700">Carregando...</p>
        </div>
      // </Layout>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    // <Layout>
      <div className="p-4 bg-gray-100 min-h-screen">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
          {/* Cabeçalho */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              Importar Cardápio para Estabelecimento
            </h1>
            {/* BOTÃO "VOLTAR" PADRONIZADO AQUI */}
            <Link 
              to="/master-dashboard" 
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
              Voltar
            </Link>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
              <p className="font-bold">Erro:</p>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleImport} className="space-y-6">
            <div>
              <label htmlFor="estabelecimentoSelect" className="block text-sm font-medium text-gray-700 mb-1">
                Selecione o Estabelecimento:
              </label>
              <select
                id="estabelecimentoSelect"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
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

            <div>
              <label htmlFor="cardapioFile" className="block text-sm font-medium text-gray-700 mb-1">
                Arquivo do Cardápio (JSON):
              </label>
              <div className="flex items-center space-x-2">
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
                  className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-semibold shadow-sm transition-colors duration-200"
                >
                  Escolher arquivo
                </label>
                <span className="text-sm text-gray-600">
                  {file ? file.name : "Nenhum arquivo selecionado"}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Formato esperado: Arquivo JSON contendo uma estrutura de cardápio com "categorias" e "itens".
              </p>
            </div>

            <button
              type="submit"
              disabled={importing}
              className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {importing ? 'Importando...' : 'Importar Cardápio'}
            </button>
          </form>

          {/* Seção da Estrutura JSON Esperada - Melhor Visibilidade */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Estrutura JSON Esperada:</h3>
            <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto text-gray-800 leading-normal">
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
    // </Layout>
  );
}

export default ImportarCardapioMaster;