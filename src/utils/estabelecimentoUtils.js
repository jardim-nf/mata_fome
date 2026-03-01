// src/utils/estabelecimentoUtils.js
import { doc, collection, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Verifica a estrutura completa de um estabelecimento
 * @param {string} estabelecimentoId - ID do estabelecimento a verificar
 */
export const verificarEstruturaEstabelecimento = async (estabelecimentoId) => {
  try {
    console.log(`🔍 Verificando estrutura do estabelecimento: ${estabelecimentoId}`);
    
    // 1. Verifica se o estabelecimento existe
    const estabDoc = await getDoc(doc(db, 'estabelecimentos', estabelecimentoId));
    
    if (!estabDoc.exists()) {
      console.log('❌ Estabelecimento não encontrado na coleção principal');
      return { success: false, error: 'Estabelecimento não existe' };
    }
    
    console.log('✅ Estabelecimento encontrado:', estabDoc.data());
    
    // 2. Verifica se tem a subcoleção 'cardapio'
    const cardapioSnapshot = await getDocs(
      collection(db, `estabelecimentos/${estabelecimentoId}/cardapio`)
    );
    
    console.log(`📋 Número de categorias no cardápio: ${cardapioSnapshot.docs.length}`);
    
    const categorias = cardapioSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('📂 Categorias encontradas:', categorias);
    
    // 3. Verifica itens em cada categoria
    const categoriasComItens = [];
    
    for (const categoria of categorias) {
      const itensSnapshot = await getDocs(
        collection(db, `estabelecimentos/${estabelecimentoId}/cardapio/${categoria.id}/itens`)
      );
      
      const itens = itensSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      categoriasComItens.push({
        ...categoria,
        itens: itens,
        quantidadeItens: itens.length
      });
      
      console.log(`🍔 Categoria "${categoria.nome}": ${itens.length} itens`);
    }
    
    return {
      success: true,
      estabelecimento: estabDoc.data(),
      categorias: categoriasComItens,
      totalCategorias: categorias.length,
      totalItens: categoriasComItens.reduce((total, cat) => total + cat.quantidadeItens, 0)
    };
    
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cria a estrutura completa do cardápio para um novo estabelecimento
 * @param {string} estabelecimentoId - ID do estabelecimento
 * @param {object} dadosEstabelecimento - Dados do estabelecimento
 */
export const criarEstruturaCardapioCompleta = async (estabelecimentoId, dadosEstabelecimento = {}) => {
  try {
    console.log(`🏗️ Criando estrutura completa para: ${estabelecimentoId}`);
    
    // 1. Cria/Atualiza documento do estabelecimento
    await setDoc(doc(db, 'estabelecimentos', estabelecimentoId), {
      nome: dadosEstabelecimento.nome || "Novo Estabelecimento",
      ativo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...dadosEstabelecimento
    });
    
    console.log('✅ Documento do estabelecimento criado');
    
    // 2. Categorias padrão do cardápio
    const categorias = [
      { id: 'lanches', nome: 'Lanches', ordem: 1, descricao: 'Deliciosos lanches artesanais' },
      { id: 'bebidas', nome: 'Bebidas', ordem: 2, descricao: 'Refrigerantes, sucos e cervejas' },
      { id: 'sobremesas', nome: 'Sobremesas', ordem: 3, descricao: 'Doces e sobremesas' }
    ];
    
    // 3. Itens padrão para cada categoria
    const itensPorCategoria = {
      lanches: [
        { nome: 'Hambúrguer Simples', preco: 25.90, descricao: 'Pão, carne, queijo e alface', ativo: true },
        { nome: 'Hambúrguer Duplo', preco: 35.90, descricao: 'Pão, 2 carnes, queijo e bacon', ativo: true },
        { nome: 'X-Bacon', preco: 29.90, descricao: 'Pão, carne, queijo e bacon crocante', ativo: true }
      ],
      bebidas: [
        { nome: 'Coca-Cola 350ml', preco: 8.90, descricao: 'Lata 350ml', ativo: true },
        { nome: 'Suco de Laranja', preco: 12.90, descricao: 'Suco natural 500ml', ativo: true },
        { nome: 'Água Mineral', preco: 5.90, descricao: 'Garrafa 500ml', ativo: true }
      ],
      sobremesas: [
        { nome: 'Brownie', preco: 15.90, descricao: 'Brownie de chocolate com nuts', ativo: true },
        { nome: 'Sorvete', preco: 12.90, descricao: 'Casquinha de sorvete', ativo: true }
      ]
    };
    
    // 4. Cria cada categoria e seus itens
    for (const categoria of categorias) {
      // Cria a categoria
      const categoriaRef = doc(collection(db, `estabelecimentos/${estabelecimentoId}/cardapio`), categoria.id);
      await setDoc(categoriaRef, {
        nome: categoria.nome,
        ordem: categoria.ordem,
        descricao: categoria.descricao,
        ativo: true,
        createdAt: new Date()
      });
      
      console.log(`✅ Categoria criada: ${categoria.nome}`);
      
      // Cria os itens da categoria
      const itens = itensPorCategoria[categoria.id] || [];
      for (const item of itens) {
        const itemRef = doc(collection(db, `estabelecimentos/${estabelecimentoId}/cardapio/${categoria.id}/itens`));
        await setDoc(itemRef, {
          ...item,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      console.log(`✅ ${itens.length} itens criados em ${categoria.nome}`);
    }
    
    console.log('🎉 Estrutura completa do cardápio criada com sucesso!');
    return { success: true, estabelecimentoId };
    
  } catch (error) {
    console.error('❌ Erro ao criar estrutura:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Função para debug rápido - use no console do navegador
 */
export const debugEstabelecimento = async (estabelecimentoId) => {
  const resultado = await verificarEstruturaEstabelecimento(estabelecimentoId);
  console.log('🔧 DEBUG RESULT:', resultado);
  return resultado;
};