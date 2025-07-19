// src/pages/admin/ImportarCardapioMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'; // Importe setDoc
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

function ImportarCardapioMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
  const [cardapioJson, setCardapioJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false); // Estado para indicar que a importação está em andamento
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      // Bloqueio de acesso se não for Master Admin
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Esta página é exclusiva do Administrador Master.');
        navigate('/master-dashboard');
        setLoading(false);
        return;
      }

      // Carregar lista de estabelecimentos para o dropdown
      const fetchEstabelecimentos = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'estabelecimentos'));
          const listaEstab = querySnapshot.docs.map(doc => ({
            id: doc.id,
            nome: doc.data().nome
          }));
          setEstabelecimentos(listaEstab);
          if (listaEstab.length > 0) {
            setSelectedEstabelecimentoId(listaEstab[0].id); // Seleciona o primeiro por padrão
          }
        } catch (err) {
          console.error("Erro ao carregar lista de estabelecimentos:", err);
          setError("Erro ao carregar estabelecimentos para importação.");
          toast.error("Erro ao carregar estabelecimentos.");
        } finally {
          setLoading(false);
        }
      };

      fetchEstabelecimentos();
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  const handleImport = async (e) => {
    e.preventDefault();
    setImporting(true); // Inicia o estado de importação
    setError(''); // Limpa erros anteriores

    if (!selectedEstabelecimentoId) {
      setError('Por favor, selecione um estabelecimento.');
      setImporting(false);
      return;
    }
    if (!cardapioJson.trim()) {
      setError('Por favor, cole o JSON do cardápio.');
      setImporting(false);
      return;
    }

    try {
      const parsedCardapio = JSON.parse(cardapioJson); // Tenta parsear o JSON

      // Valida que o JSON tem as chaves esperadas 'cardapio' e 'informacoes_contato'
      if (!parsedCardapio.cardapio || !Array.isArray(parsedCardapio.cardapio) || !parsedCardapio.informacoes_contato) {
          setError('JSON inválido. Certifique-se de que ele contém as chaves "cardapio" (array) e "informacoes_contato" (objeto) no nível superior.');
          setImporting(false);
          return;
      }
      
      // Objeto com os dados do cardápio e informações de contato para atualizar
      const dataToUpdate = {
        cardapio: parsedCardapio.cardapio,
        informacoes_contato: parsedCardapio.informacoes_contato
      };

      const estabRef = doc(db, 'estabelecimentos', selectedEstabelecimentoId);
      // Usa set com merge: true para atualizar apenas os campos fornecidos,
      // sem apagar outros campos existentes no documento do estabelecimento.
      await setDoc(estabRef, dataToUpdate, { merge: true });

      toast.success('Cardápio importado/atualizado com sucesso!');
      setCardapioJson(''); // Limpa o campo JSON após o sucesso
    } catch (err) {
      console.error("Erro ao importar cardápio:", err);
      // Mensagem de erro mais específica se o JSON for inválido
      if (err instanceof SyntaxError) {
          setError('Erro de JSON: Verifique a sintaxe do JSON (vírgulas, aspas, chaves).');
      } else {
          setError('Erro ao importar cardápio. Tente novamente.');
      }
      toast.error('Erro ao importar cardápio. JSON inválido ou erro no envio.');
    } finally {
      setImporting(false); // Finaliza o estado de importação
    }
  };

  // Mensagens de carregamento e erro para a página
  if (loading) {
    return <div className="text-center p-4">Carregando ferramenta de importação...</div>;
  }
  if (error) { // Exibe erros relacionados ao carregamento inicial ou seleção
    return <div className="text-center p-4 text-red-600">Erro: {error}</div>;
  }
  // Bloqueio de acesso se usuário não for Master Admin (já é tratado no useEffect)
  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white shadow-lg rounded-lg my-8">
      <Link to="/master-dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Voltar ao Dashboard Master
      </Link>
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Importar/Atualizar Cardápio</h1>
      
      <form onSubmit={handleImport} className="space-y-4">
        <div>
          <label htmlFor="estabelecimentoSelect" className="block text-sm font-medium text-gray-700">
            Selecionar Estabelecimento *
          </label>
          <select
            id="estabelecimentoSelect"
            value={selectedEstabelecimentoId}
            onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            required
            disabled={importing || estabelecimentos.length === 0} // Desabilita se estiver importando ou não houver estab.
          >
            {estabelecimentos.length === 0 ? (
              <option value="">Carregando estabelecimentos...</option>
            ) : (
              estabelecimentos.map(estab => (
                <option key={estab.id} value={estab.id}>{estab.nome}</option>
              ))
            )}
          </select>
          {estabelecimentos.length === 0 && !loading && !error && (
            <p className="text-red-500 text-sm mt-2">Nenhum estabelecimento encontrado. Cadastre um primeiro.</p>
          )}
        </div>

        <div>
          <label htmlFor="cardapioJson" className="block text-sm font-medium text-gray-700">
            Colar JSON Completo do Cardápio *
          </label>
          <textarea
            id="cardapioJson"
            rows="15"
            value={cardapioJson}
            onChange={(e) => setCardapioJson(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm font-mono text-sm p-2"
            placeholder={`Exemplo: \n{\n  "cardapio": [\n    {\n      "categoria": "Hambúrgueres",\n      "itens": [\n        { "nome": "X-Burguer", "preco": 25.00 }\n      ]\n    }\n  ],\n  "informacoes_contato": {\n    "telefone_whatsapp": "11999999999"\n  }\n}`}
            required
            disabled={importing}
          ></textarea>
          <p className="mt-1 text-xs text-gray-500">Cole o objeto JSON completo que contém os campos "cardapio" (array de categorias) e "informacoes_contato" (objeto) no nível superior.</p>
        </div>
        
        {error && <p className="text-red-500 text-center">{error}</p>} {/* Erros do formulário */}
        {importing && <p className="text-center text-blue-600 mt-2">Importando, por favor aguarde...</p>}

        <button type="submit" disabled={importing || !selectedEstabelecimentoId || !cardapioJson.trim()}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          {importing ? 'Importando...' : 'Importar/Atualizar Cardápio'}
        </button>
      </form>
    </div>
  );
}

export default ImportarCardapioMaster;