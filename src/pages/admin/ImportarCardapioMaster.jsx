// src/pages/admin/ImportarCardapioMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// Importações do Firestore atualizadas para incluir o que precisamos
import { collection, getDocs, doc, setDoc, addDoc, writeBatch } from 'firebase/firestore'; 
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
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Esta página é exclusiva do Administrador Master.');
        navigate('/master-dashboard');
        setLoading(false);
        return;
      }

      const fetchEstabelecimentos = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'estabelecimentos'));
          const listaEstab = querySnapshot.docs.map(doc => ({
            id: doc.id,
            nome: doc.data().nome
          }));
          setEstabelecimentos(listaEstab);
          if (listaEstab.length > 0) {
            setSelectedEstabelecimentoId(listaEstab[0].id);
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

  // ▼▼▼ FUNÇÃO DE IMPORTAÇÃO TOTALMENTE CORRIGIDA ▼▼▼
  const handleImport = async (e) => {
    e.preventDefault();
    setImporting(true);
    setError('');

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
      const parsedCardapio = JSON.parse(cardapioJson);

      if (!parsedCardapio.cardapio || !Array.isArray(parsedCardapio.cardapio) || !parsedCardapio.informacoes_contato) {
        setError('JSON inválido. Certifique-se de que ele contém as chaves "cardapio" (array) e "informacoes_contato" (objeto).');
        setImporting(false);
        return;
      }

      // --- INÍCIO DA LÓGICA CORRIGIDA ---

      // 1. ATUALIZAR INFORMAÇÕES DE CONTATO NO DOCUMENTO PRINCIPAL
      const estabRef = doc(db, 'estabelecimentos', selectedEstabelecimentoId);
      await setDoc(estabRef, { informacoes_contato: parsedCardapio.informacoes_contato }, { merge: true });
      console.log("Informações de contato atualizadas.");

      // 2. DELETAR O CARDÁPIO ANTIGO DA SUBCOLEÇÃO (PARA NÃO DUPLICAR)
      const subcolecaoRef = collection(db, 'estabelecimentos', selectedEstabelecimentoId, 'cardapio');
      const cardapioAntigoSnapshot = await getDocs(subcolecaoRef);
      
      if (!cardapioAntigoSnapshot.empty) {
        const batch = writeBatch(db); // Usar batch para deletar em massa é mais eficiente
        cardapioAntigoSnapshot.docs.forEach(documento => {
          batch.delete(documento.ref);
        });
        await batch.commit(); // Deleta todos os itens antigos de uma vez
        console.log("Cardápio antigo da subcoleção deletado.");
      }
      
      // 3. ADICIONAR OS NOVOS ITENS NA SUBCOLEÇÃO
      const novosItens = parsedCardapio.cardapio;
      for (const item of novosItens) {
        // addDoc cria um NOVO DOCUMENTO na subcoleção para cada item
        await addDoc(subcolecaoRef, item); 
      }
      console.log(`${novosItens.length} novos itens adicionados à subcoleção 'cardapio'.`);
      
      // --- FIM DA LÓGICA CORRIGIDA ---

      toast.success('Cardápio importado e subcoleção criada/atualizada com sucesso!');
      setCardapioJson(''); // Limpa o campo JSON
    } catch (err) {
      console.error("Erro ao importar cardápio:", err);
      if (err instanceof SyntaxError) {
        setError('Erro de JSON: Verifique a sintaxe do JSON (vírgulas, aspas, chaves).');
      } else {
        setError('Erro ao importar cardápio. Verifique o console para mais detalhes.');
      }
      toast.error('Erro ao importar cardápio.');
    } finally {
      setImporting(false); // Finaliza o estado de importação
    }
  };
  // ▲▲▲ FIM DA FUNÇÃO CORRIGIDA ▲▲▲

  if (loading) {
    return <div className="text-center p-4">Carregando ferramenta de importação...</div>;
  }
  
  if (!currentUser || !isMasterAdmin) {
    return null; // A lógica de redirecionamento já cuida disso
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
            disabled={importing || estabelecimentos.length === 0}
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
            placeholder={`Cole o objeto JSON completo aqui...`}
            required
            disabled={importing}
          ></textarea>
           <p className="mt-1 text-xs text-gray-500">Cole o objeto JSON completo que contém os campos "cardapio" (array) e "informacoes_contato" (objeto).</p>
        </div>
        
        {error && <p className="text-red-500 text-center">{error}</p>}
        {importing && <p className="text-center text-blue-600 mt-2">Importando, por favor aguarde...</p>}

        <button type="submit" disabled={importing || !selectedEstabelecimentoId || !cardapioJson.trim()}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
        >
          {importing ? 'Importando...' : 'Importar/Atualizar Cardápio'}
        </button>
      </form>
    </div>
  );
}

export default ImportarCardapioMaster;