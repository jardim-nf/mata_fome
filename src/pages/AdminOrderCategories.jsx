// src/pages/AdminOrderCategories.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import GerenciarOrdemCategoria from '../components/GerenciarOrdemCategoria';
import { toast } from 'react-toastify';
import { FaPlus, FaTrash } from 'react-icons/fa'; // Ícones para interface

const AdminOrderCategories = () => {
  const navigate = useNavigate();
  const { estabelecimentosGerenciados } = useAuth();
  
  const estabelecimentoId = estabelecimentosGerenciados && estabelecimentosGerenciados.length > 0 
    ? estabelecimentosGerenciados[0] 
    : null;

  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([]);
  const [ordemAtual, setOrdemAtual] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState('');
  
  // NOVO STATE: Para o input de nova categoria
  const [novaCategoria, setNovaCategoria] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!estabelecimentoId) {
        setLoading(false);
        return;
      }
      try {
        const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
        const estabelecimentoDoc = await getDoc(estabelecimentoRef);

        if (estabelecimentoDoc.exists()) {
          const data = estabelecimentoDoc.data();
          setNomeEstabelecimento(data.nome);
        }

        await fetchCategoriasDoCardapio(estabelecimentoId);

      } catch (error) {
        console.error('💥 Erro:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [estabelecimentoId, navigate]);

  const fetchCategoriasDoCardapio = async (idDoEstabelecimento) => {
    try {
      // 1. Buscar categorias que JÁ EXISTEM nos produtos
      const cardapioRef = collection(db, 'estabelecimentos', idDoEstabelecimento, 'cardapio');
      const snapshot = await getDocs(cardapioRef);
      
      const categoriasNosProdutos = [];
      snapshot.forEach((doc) => {
        const categoriaData = doc.data();
        if (categoriaData.nome) {
            categoriasNosProdutos.push(categoriaData.nome.trim());
        }
      });

      // 2. Buscar a ordem salva (que pode ter categorias vazias criadas manualmente)
      const estabelecimentoRef = doc(db, 'estabelecimentos', idDoEstabelecimento);
      const estabelecimentoDoc = await getDoc(estabelecimentoRef);
      
      let categoriasSalvasNoBanco = [];
      if (estabelecimentoDoc.exists()) {
        const data = estabelecimentoDoc.data();
        if (data.ordemCategorias && Array.isArray(data.ordemCategorias)) {
            categoriasSalvasNoBanco = data.ordemCategorias;
        }
      }

      // 3. MERGE INTELIGENTE: Junta o que tem produtos + o que foi salvo manualmente
      // Isso impede que categorias vazias sumam
      const todasCategoriasUnicas = [...new Set([...categoriasNosProdutos, ...categoriasSalvasNoBanco])];

      if (todasCategoriasUnicas.length === 0) {
        toast.info('Nenhuma categoria encontrada.');
        setCategoriasDisponiveis([]);
        return;
      }

      setCategoriasDisponiveis(todasCategoriasUnicas);

      // Se existir uma ordem salva, usamos ela como base e adicionamos as novas no final
      if (categoriasSalvasNoBanco.length > 0) {
        const novasQueNaoEstavamNaOrdem = todasCategoriasUnicas.filter(cat => !categoriasSalvasNoBanco.includes(cat));
        setOrdemAtual([...categoriasSalvasNoBanco, ...novasQueNaoEstavamNaOrdem]);
      } else {
        // Se não tem ordem salva, ordena alfabeticamente
        setOrdemAtual(todasCategoriasUnicas.sort((a, b) => a.localeCompare(b)));
      }

    } catch (error) {
      console.error('❌ Erro ao buscar categorias:', error);
      toast.error('Erro ao carregar categorias');
    }
  };

  // NOVA FUNÇÃO: Adicionar categoria manualmente
  const handleAddCategoria = () => {
    if (!novaCategoria.trim()) {
      toast.warning('Digite o nome da categoria');
      return;
    }

    const novaFormatada = novaCategoria.trim().toUpperCase(); // Padroniza para maiúsculo

    if (categoriasDisponiveis.includes(novaFormatada)) {
      toast.warning('Esta categoria já existe!');
      return;
    }

    // Adiciona na lista local e na ordem atual
    const novasCategorias = [...categoriasDisponiveis, novaFormatada];
    const novaOrdem = [novaFormatada, ...ordemAtual]; // Adiciona no TOPO para facilitar ver

    setCategoriasDisponiveis(novasCategorias);
    setOrdemAtual(novaOrdem);
    setNovaCategoria(''); // Limpa o input
    toast.success(`Categoria "${novaFormatada}" adicionada! Lembre de salvar.`);
  };

  const salvarOrdemNoFirebase = async (novaOrdem) => {
    if (!estabelecimentoId) return;

    try {
      const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabelecimentoRef, {
        ordemCategorias: novaOrdem,
        atualizadoEm: new Date()
      });
      
      setOrdemAtual(novaOrdem);
      toast.success('✅ Ordem e novas categorias salvas!');
      
      await atualizarOrdemNosProdutos(novaOrdem);
      
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
      toast.error('Erro ao salvar ordem');
    }
  };

  const atualizarOrdemNosProdutos = async (novaOrdem) => {
    // Mantive sua lógica original aqui
    try {
      const cardapioRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
      const snapshot = await getDocs(cardapioRef);
      const updates = [];
      
      const ordemMap = {};
      novaOrdem.forEach((cat, index) => {
        ordemMap[cat] = index + 1;
      });
      
      snapshot.forEach((docSnapshot) => {
        const produto = docSnapshot.data();
        // Verifica se a categoria do produto está no mapa
        if (produto.nome && ordemMap[produto.nome]) {
           updates.push(
             updateDoc(docSnapshot.ref, { 
               ordem: ordemMap[produto.nome],
               atualizadoEm: new Date() 
             })
           );
        }
      });
      
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    } catch (error) {
      console.error('❌ Erro não-crítico ao atualizar produtos:', error);
    }
  };

  const handleClose = () => {
    navigate('/dashboard');
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gerenciar Categorias</h1>
              <p className="text-gray-600 mt-1">Crie novas categorias ou reordene as existentes</p>
            </div>
            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              Voltar
            </button>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-900">
              🎯 Estabelecimento: {nomeEstabelecimento}
            </h3>
          </div>

          {/* --- NOVA ÁREA DE CRIAÇÃO --- */}
          <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Criar Nova Categoria</label>
            <div className="flex gap-2">
              <input 
                type="text"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddCategoria()}
                placeholder="Ex: PROMOÇÕES, BURGERS..."
                className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase"
              />
              <button 
                onClick={handleAddCategoria}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
              >
                <FaPlus /> Adicionar
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * A categoria será criada vazia. Você poderá adicionar produtos a ela depois.
            </p>
          </div>
          {/* --------------------------- */}

          {categoriasDisponiveis.length > 0 ? (
            <GerenciarOrdemCategoria
              key={estabelecimentoId}
              estabelecimentoId={estabelecimentoId}
              categorias={categoriasDisponiveis} // Passa todas (produtos + manuais)
              ordemAtual={ordemAtual}
              onClose={handleClose}
              onSave={salvarOrdemNoFirebase}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Nenhuma categoria encontrada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrderCategories;