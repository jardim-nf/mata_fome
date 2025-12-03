// src/pages/AdminOrderCategories.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext'; // <--- 1. Importar AuthContext
import GerenciarOrdemCategoria from '../components/GerenciarOrdemCategoria';
import { toast } from 'react-toastify';

const AdminOrderCategories = () => {
  const navigate = useNavigate();
  const { estabelecimentosGerenciados } = useAuth(); // <--- 2. Pegar a lista do contexto
  
  // 3. Definir o ID corretamente (pega o primeiro da lista)
  const estabelecimentoId = estabelecimentosGerenciados && estabelecimentosGerenciados.length > 0 
    ? estabelecimentosGerenciados[0] 
    : null;

  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([]);
  const [ordemAtual, setOrdemAtual] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState('');

  // Buscar dados do estabelecimento e categorias
  useEffect(() => {
    const fetchData = async () => {
      // 4. Verificação de segurança
      if (!estabelecimentoId) {
        console.warn('⚠️ Nenhum estabelecimento gerenciado encontrado.');
        setLoading(false);
        return;
      }

      console.log('🎯 Buscando dados para estabelecimento:', estabelecimentoId);

      try {
        // Buscar dados do estabelecimento
        const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
        const estabelecimentoDoc = await getDoc(estabelecimentoRef);

        if (estabelecimentoDoc.exists()) {
          const data = estabelecimentoDoc.data();
          console.log('✅ Estabelecimento:', data.nome);
          setNomeEstabelecimento(data.nome); // Salva o nome para exibir na tela
          
          // Se já existe ordem definida, usar ela
          if (data.ordemCategorias && data.ordemCategorias.length > 0) {
            console.log('📋 Ordem atual encontrada:', data.ordemCategorias);
            setOrdemAtual(data.ordemCategorias);
          }
        }

        // Buscar categorias do cardápio usando o ID correto
        await fetchCategoriasDoCardapio(estabelecimentoId);

      } catch (error) {
        console.error('💥 Erro ao buscar dados:', error);
        toast.error('Erro ao carregar dados do estabelecimento');
        
        // Fallback
        const categoriasMock = getCategoriasMock();
        setCategoriasDisponiveis(categoriasMock);
        setOrdemAtual(categoriasMock);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [estabelecimentoId, navigate]); // <--- 5. Recarrega se o ID mudar

  // Buscar categorias reais do cardápio
  const fetchCategoriasDoCardapio = async (idDoEstabelecimento) => {
    try {
      console.log('🔍 Buscando categorias reais do cardápio...');
      
      const cardapioRef = collection(db, 'estabelecimentos', idDoEstabelecimento, 'cardapio');
      const snapshot = await getDocs(cardapioRef);
      
      console.log('📊 Categorias encontradas:', snapshot.size);
      
      const categorias = [];
      
      snapshot.forEach((doc) => {
        const categoriaData = doc.data();
        if (categoriaData.nome) {
          categorias.push(categoriaData.nome.trim());
        }
      });

      if (categorias.length === 0) {
        toast.info('Nenhuma categoria encontrada no cardápio.');
        setCategoriasDisponiveis([]);
        return;
      }

      const categoriasUnicas = [...new Set(categorias)];
      setCategoriasDisponiveis(categoriasUnicas);

      // Buscar ordem atual atualizada
      const estabelecimentoRef = doc(db, 'estabelecimentos', idDoEstabelecimento);
      const estabelecimentoDoc = await getDoc(estabelecimentoRef);
      
      if (estabelecimentoDoc.exists()) {
        const data = estabelecimentoDoc.data();
        
        if (data.ordemCategorias && data.ordemCategorias.length > 0) {
          const ordemFiltrada = data.ordemCategorias.filter(categoria => 
            categoriasUnicas.includes(categoria)
          );
          const categoriasNovas = categoriasUnicas.filter(categoria => 
            !ordemFiltrada.includes(categoria)
          );
          setOrdemAtual([...ordemFiltrada, ...categoriasNovas]);
        } else {
          setOrdemAtual(categoriasUnicas.sort((a, b) => a.localeCompare(b)));
        }
      }

    } catch (error) {
      console.error('❌ Erro ao buscar categorias:', error);
      toast.error('Erro ao carregar categorias');
    }
  };

  const getCategoriasMock = () => {
    return ["BEBIDAS", "PETISCOS", "LANCHES", "COMBOS"];
  };

  const salvarOrdemNoFirebase = async (novaOrdem) => {
    if (!estabelecimentoId) {
      toast.error('ID do estabelecimento não encontrado');
      return;
    }

    try {
      console.log('💾 Salvando ordem no Firebase:', novaOrdem);
      
      const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabelecimentoRef, {
        ordemCategorias: novaOrdem,
        atualizadoEm: new Date()
      });
      
      setOrdemAtual(novaOrdem);
      toast.success('✅ Ordem salva com sucesso!');
      
      await atualizarOrdemNosProdutos(novaOrdem);
      
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
      toast.error('Erro ao salvar ordem');
    }
  };

  const atualizarOrdemNosProdutos = async (novaOrdem) => {
    try {
      const cardapioRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
      const snapshot = await getDocs(cardapioRef);
      const updates = []; // Array de Promises
      
      // Criar um mapa de ordem para acesso rápido: { "BEBIDAS": 1, "LANCHES": 2 }
      const ordemMap = {};
      novaOrdem.forEach((cat, index) => {
        ordemMap[cat] = index + 1;
      });
      
      snapshot.forEach((docSnapshot) => {
        const produto = docSnapshot.data();
        const novaPosicao = ordemMap[produto.nome]; // produto.nome é a Categoria (baseado na sua lógica)
        
        if (novaPosicao !== undefined) {
           updates.push(
             updateDoc(docSnapshot.ref, { 
               ordem: novaPosicao,
               atualizadoEm: new Date() 
             })
           );
        }
      });
      
      if (updates.length > 0) {
        await Promise.all(updates);
        console.log(`📦 Ordem atualizada em ${updates.length} produtos/categorias.`);
      }
      
    } catch (error) {
      console.error('❌ Erro não-crítico ao atualizar produtos:', error);
    }
  };

  const handleClose = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ordenar Categorias</h1>
              <p className="text-gray-600 mt-1">Arraste para definir a ordem no cardápio</p>
            </div>
            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              Voltar
            </button>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-900">
              🎯 Estabelecimento: {nomeEstabelecimento || 'Carregando...'}
            </h3>
            <p className="text-green-700 text-sm">
              {categoriasDisponiveis.length} categorias encontradas
            </p>
          </div>

          {categoriasDisponiveis.length > 0 ? (
            <GerenciarOrdemCategoria
              key={estabelecimentoId} // <--- Força recriar se mudar o estabelecimento
              estabelecimentoId={estabelecimentoId}
              categorias={categoriasDisponiveis}
              ordemAtual={ordemAtual}
              onClose={handleClose}
              onSave={salvarOrdemNoFirebase}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Nenhuma categoria encontrada.</p>
              <button onClick={() => navigate('/admin/gerenciar-cardapio')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                Gerenciar Cardápio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrderCategories;