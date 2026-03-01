// src/services/produtoService.js - VERSÃO CORRIGIDA PARA CAMINHO HIERÁRQUICO COM CÓDIGO DE BARRAS
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';// Importe auth para fallback

export const produtoService = {
  // Helper para formatar nomes
  formatarNomeCategoria(categoriaId) {
    const mapeamentoNomes = {
      'bebidas': 'Bebidas',
      'grandes-fomes': 'Grandes Fomes', 
      'lanches-na-baguete': 'Lanches na Baguete',
      'os-classicos': 'Os Clássicos',
      'os-novatos': 'Os Novatos',
      'os-queridinhos': 'Os Queridinhos',
      'petiscos': 'Petiscos'
    };
    return mapeamentoNomes[categoriaId] || categoriaId;
  },

  formatarProdutoReal(id, data, categoriaId) {
    return {
      id,
      name: data.nome || data.name || 'Produto sem nome',
      price: Number(data.preco || data.price || data.valor || 0),
      category: categoriaId,
      categoriaNome: this.formatarNomeCategoria(categoriaId),
      descricao: data.descricao || data.description || '',
      emEstoque: data.disponivel !== false && data.estoque !== false,
      imagem: data.imagem || '',
      ativo: data.ativo !== false,
      // 👇 NOVO CAMPO: CÓDIGO DE BARRAS (GTIN/EAN)
      codigoBarras: data.codigoBarras || data.ean || data.gtin || '',
      // 👇 ESTRUTURA FISCAL
      fiscal: data.fiscal || {
        ncm: '',
        cfop: '', // Ex: 5102 ou 5405
        cest: '', // Opcional/Obrigatório dependendo do NCM
        origem: '0', // 0 = Nacional, 1 = Estrangeira, etc.
        csosn: '102', // Padrão Simples Nacional: 102 = Tributada pelo Simples Nacional sem permissão de crédito
        unidade: 'UN', // UN, KG, LT, etc.
        aliquotaIcms: 0
      }
    };
  },

  // ✅ AGORA RECEBE O ID DO ESTABELECIMENTO
  async buscarProdutosUniversal(estabelecimentoId) {
    // Se não passar ID, tenta pegar do usuário logado
    const uid = estabelecimentoId || auth.currentUser?.uid;
    
    if (!uid) {
      console.error('❌ Erro: ID do estabelecimento não fornecido e usuário não logado.');
      return [];
    }

    console.log(`🚀 [PRODUTO] Buscando em: estabelecimentos/${uid}/cardapio`);
    
    try {
      const todosProdutos = [];
      
      // 1. Acessa a coleção 'cardapio' DENTRO do estabelecimento
      const cardapioRef = collection(db, 'estabelecimentos', uid, 'cardapio');
      const cardapioSnapshot = await getDocs(cardapioRef);

      if (cardapioSnapshot.empty) {
        console.warn(`⚠️ Nenhuma categoria encontrada para o ID: ${uid}`);
        return [];
      }

      console.log(`📂 Categorias encontradas: ${cardapioSnapshot.size}`);

      // 2. Para cada categoria encontrada, busca a subcoleção 'itens'
      for (const docSnapshot of cardapioSnapshot.docs) {
        // Ignora documentos de configuração se houver
        if (docSnapshot.id === 'config' || docSnapshot.id === 'layout') continue;

        console.log(`🔎 Lendo categoria: ${docSnapshot.id}`);
        
        // Caminho: estabelecimentos/{uid}/cardapio/{categoria}/itens
        const itensRef = collection(db, 'estabelecimentos', uid, 'cardapio', docSnapshot.id, 'itens');
        const itensSnapshot = await getDocs(itensRef);

        if (!itensSnapshot.empty) {
            itensSnapshot.forEach(itemDoc => {
                const data = itemDoc.data();
                todosProdutos.push(this.formatarProdutoReal(itemDoc.id, data, docSnapshot.id));
            });
        }
      }

      console.log(`✅ Total carregado: ${todosProdutos.length} produtos`);
      return todosProdutos;

    } catch (error) {
      console.error('❌ Erro crítico ao buscar produtos:', error);
      return [];
    }
  },

  async criarProdutosExemplo(estabelecimentoId) {
    const uid = estabelecimentoId || auth.currentUser?.uid;
    if (!uid) return 0;

    console.log(`📝 Criando exemplo em: estabelecimentos/${uid}/cardapio`);
    
    const produtosExemplo = [
      // Adicionado código de barras de exemplo para testes
      { nome: "X-Burger Clássico", preco: 25.90, descricao: "Pão, hambúrguer, queijo", categoria: "os-classicos", ncm: "21069090", cfop: "5102", codigoBarras: "7891234567890" },
      { nome: "Coca-Cola Lata", preco: 8.00, descricao: "350ml", categoria: "bebidas", ncm: "22021000", cfop: "5405", codigoBarras: "7894900011517" }, // Bebidas geralmente têm Substituição Tributária (5405)
      { nome: "Batata Frita", preco: 12.00, descricao: "Porção", categoria: "petiscos", ncm: "20041000", cfop: "5102", codigoBarras: "" }
    ];

    let count = 0;

    for (const produto of produtosExemplo) {
      try {
        // 1. Garante que a categoria existe
        const categoriaRef = doc(db, 'estabelecimentos', uid, 'cardapio', produto.categoria);
        await setDoc(categoriaRef, {
            nome: this.formatarNomeCategoria(produto.categoria),
            ativo: true,
            ordem: 1
        }, { merge: true });

        // 2. Cria o item dentro da categoria
        const novoItemRef = doc(collection(db, 'estabelecimentos', uid, 'cardapio', produto.categoria, 'itens'));
        await setDoc(novoItemRef, {
          nome: produto.nome,
          preco: produto.preco,
          descricao: produto.descricao,
          ativo: true,
          disponivel: true,
          estoque: true,
          // 👇 GRAVANDO O CÓDIGO DE BARRAS NO BANCO
          codigoBarras: produto.codigoBarras || '', 
          createdAt: new Date(),
          // 👇 GRAVANDO OS DADOS FISCAIS NO FIREBASE
          fiscal: {
            ncm: produto.ncm, 
            cfop: produto.cfop,
            cest: '',
            origem: '0',
            csosn: produto.cfop === '5405' ? '500' : '102', // 500 = ICMS cobrado anteriormente por substituição tributária
            unidade: 'UN',
            aliquotaIcms: 0
          }
        });
        count++;
      } catch (error) {
        console.error('Erro criar exemplo:', error);
      }
    }
    return count;
  },

  async debugEstruturaCompleta(uid) {
    return this.buscarProdutosUniversal(uid);
  },

  async verificarEstruturaCategorias() { return true; }
};
