// src/pages/AdminOrderCategories.jsx - VERSÃO FINAL FUNCIONAL
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import GerenciarOrdemCategoria from '../components/GerenciarOrdemCategoria';
import { toast } from 'react-toastify';

const AdminOrderCategories = () => {
  const navigate = useNavigate();
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([]);
  const [ordemAtual, setOrdemAtual] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabelecimentoId, setEstabelecimentoId] = useState('');

  // Buscar dados do estabelecimento e categorias
  useEffect(() => {
    const fetchData = async () => {
      const estabelecimentoIdToUse = '2eNNjBwmDHUyLlYVnMSH';
      
      console.log('🎯 Buscando dados para estabelecimento:', estabelecimentoIdToUse);
      setEstabelecimentoId(estabelecimentoIdToUse);

      try {
        // Buscar dados do estabelecimento
        const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoIdToUse);
        const estabelecimentoDoc = await getDoc(estabelecimentoRef);

        if (estabelecimentoDoc.exists()) {
          const data = estabelecimentoDoc.data();
          console.log('✅ Estabelecimento:', data.nome);
          
          // Se já existe ordem definida, usar ela
          if (data.ordemCategorias && data.ordemCategorias.length > 0) {
            console.log('📋 Ordem atual encontrada:', data.ordemCategorias);
            setOrdemAtual(data.ordemCategorias);
          }
        }

        // Buscar categorias do cardápio
        await fetchCategoriasDoCardapio(estabelecimentoIdToUse);

      } catch (error) {
        console.error('💥 Erro ao buscar dados:', error);
        toast.error('Erro ao carregar dados do estabelecimento');
        
        // Fallback para dados mockados
        const categoriasMock = getCategoriasMock();
        setCategoriasDisponiveis(categoriasMock);
        setOrdemAtual(categoriasMock);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // Buscar categorias - AGORA USANDO OS NOMES DOS PRODUTOS COMO CATEGORIAS
// Buscar categorias - CORREÇÃO: BUSCAR CATEGORIAS REAIS DO CARDÁPIO
const fetchCategoriasDoCardapio = async (estabelecimentoId) => {
  try {
    console.log('🔍 Buscando categorias reais do cardápio...');
    
    // Buscar TODAS as categorias (coleções dentro de cardapio)
    const cardapioRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
    const snapshot = await getDocs(cardapioRef);
    
    console.log('📊 Categorias encontradas:', snapshot.size);
    
    const categorias = [];
    
    // CADA DOCUMENTO É UMA CATEGORIA
    snapshot.forEach((doc) => {
      const categoriaData = doc.data();
      
      // Usar o NOME da categoria (campo "nome" do documento)
      if (categoriaData.nome) {
        console.log(`✅ Adicionando categoria: "${categoriaData.nome}"`);
        categorias.push(categoriaData.nome.trim());
      }
    });

    console.log('📋 Categorias encontradas:', categorias);

    if (categorias.length === 0) {
      console.log('ℹ️ Nenhuma categoria encontrada');
      toast.info('Nenhuma categoria encontrada no cardápio.');
      setCategoriasDisponiveis([]);
      return;
    }

    // Remover duplicatas
    const categoriasUnicas = [...new Set(categorias)];
    setCategoriasDisponiveis(categoriasUnicas);

    // Buscar ordem atual do estabelecimento
    const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
    const estabelecimentoDoc = await getDoc(estabelecimentoRef);
    
    if (estabelecimentoDoc.exists()) {
      const data = estabelecimentoDoc.data();
      
      // Se já existe ordem definida, usar ela
      if (data.ordemCategorias && data.ordemCategorias.length > 0) {
        console.log('📋 Ordem atual encontrada no Firebase:', data.ordemCategorias);
        
        // Filtrar apenas categorias que ainda existem
        const ordemFiltrada = data.ordemCategorias.filter(categoria => 
          categoriasUnicas.includes(categoria)
        );
        
        // Adicionar categorias novas que não estão na ordem
        const categoriasNovas = categoriasUnicas.filter(categoria => 
          !ordemFiltrada.includes(categoria)
        );
        
        const novaOrdemCompleta = [...ordemFiltrada, ...categoriasNovas];
        setOrdemAtual(novaOrdemCompleta);
      } else {
        // Se não há ordem definida, usar ordem alfabética
        const novaOrdem = categoriasUnicas.sort((a, b) => a.localeCompare(b));
        console.log('🔤 Ordem alfabética definida:', novaOrdem);
        setOrdemAtual(novaOrdem);
      }
    }

  } catch (error) {
    console.error('❌ Erro ao buscar categorias:', error);
    toast.error('Erro ao carregar categorias do cardápio');
    
    // Fallback para dados mockados
    const categoriasMock = getCategoriasMock();
    setCategoriasDisponiveis(categoriasMock);
    setOrdemAtual(categoriasMock);
  }
};

  // Dados mockados baseados nos produtos reais
  const getCategoriasMock = () => {
    return [
      "BEBIDAS",
      "PETISCOS", 
      "LANCHES NA BAGUETE",
      "OS CLÁSSICOS",
      "GRANDES FOMES", 
      "OS NOVATOS",
      "OS QUERIDINHOS"
    ];
  };

  // Função para salvar a ordem no Firebase
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
      toast.success('✅ Ordem das categorias salva com sucesso!');
      
      // Atualizar também a ordem nos produtos (opcional)
      await atualizarOrdemNosProdutos(novaOrdem);
      
    } catch (error) {
      console.error('❌ Erro ao salvar ordem no Firebase:', error);
      toast.error('Erro ao salvar ordem das categorias');
    }
  };

  // Função opcional para atualizar a ordem nos produtos também
  const atualizarOrdemNosProdutos = async (novaOrdem) => {
    try {
      const cardapioRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
      const snapshot = await getDocs(cardapioRef);
      
      const updates = [];
      
      snapshot.forEach((doc) => {
        const produto = doc.data();
        const posicao = novaOrdem.indexOf(produto.nome);
        
        if (posicao !== -1) {
          updates.push(
            updateDoc(doc.ref, {
              ordem: posicao + 1,
              atualizadoEm: new Date()
            })
          );
        }
      });
      
      await Promise.all(updates);
      console.log('📦 Ordem atualizada nos produtos');
      
    } catch (error) {
      console.error('❌ Erro ao atualizar ordem nos produtos:', error);
      // Não mostrar erro para o usuário, é opcional
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
          <p className="mt-4 text-gray-600">Carregando categorias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Ordenar Categorias do Cardápio
              </h1>
              <p className="text-gray-600 mt-1">
                Arraste e solte para definir a ordem de exibição no cardápio
              </p>
            </div>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Voltar ao Dashboard
            </button>
          </div>

          {/* Informações do estabelecimento */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-900">
                  🎯 Estabelecimento: MeGusta
                </h3>
                <p className="text-green-700 text-sm">
                  {categoriasDisponiveis.length} categorias encontradas
                </p>
                <p className="text-green-600 text-xs mt-1">
                  💡 As categorias são os nomes dos produtos do cardápio
                </p>
              </div>
            </div>
          </div>

          {/* Componente de ordenação */}
          {categoriasDisponiveis.length > 0 ? (
            <GerenciarOrdemCategoria
              estabelecimentoId={estabelecimentoId}
              categorias={categoriasDisponiveis}
              ordemAtual={ordemAtual}
              onClose={handleClose}
              onSave={salvarOrdemNoFirebase}
            />
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma categoria encontrada
              </h3>
              <p className="text-gray-500 mb-4">
                Adicione produtos ao seu cardápio para ver as categorias aqui.
              </p>
              <button
                onClick={() => navigate('/admin/gerenciar-cardapio')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
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