// src/services/produtoService.js - VERSÃO CORRIGIDA PARA CAMINHO HIERÁRQUICO COM CÓDIGO DE BARRAS
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  deleteDoc
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

  formatarProdutoReal(id, data, categoriaId, categoriaNomeReal) {
    return {
      id,
      name: data.nome || data.name || 'Produto sem nome',
      price: Number(data.preco || data.price || data.valor || 0),
      category: categoriaId,
      categoriaNome: categoriaNomeReal || this.formatarNomeCategoria(categoriaId),
      descricao: data.descricao || data.description || '',
      emEstoque: data.disponivel !== false && data.estoque !== false,
      imagem: data.imagem || '',
      ativo: data.ativo !== false,
      // 👇 NOVO CAMPO: CÓDIGO DE BARRAS (GTIN/EAN)
      codigoBarras: data.codigoBarras || data.ean || data.gtin || '',
      // 👇 VARIAÇÕES E ADICIONAIS (para modal de pedido manual)
      variacoes: Array.isArray(data.variacoes) ? data.variacoes.filter(v => v.ativo !== false) : [],
      adicionais: Array.isArray(data.adicionais) ? data.adicionais : [],
      categoriaId: categoriaId,
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

        const categoriaData = docSnapshot.data();
        const categoriaNomeReal = categoriaData?.nome || this.formatarNomeCategoria(docSnapshot.id);

        console.log(`🔎 Lendo categoria: ${docSnapshot.id} (${categoriaNomeReal})`);
        
        // Caminho: estabelecimentos/{uid}/cardapio/{categoria}/itens
        const itensRef = collection(db, 'estabelecimentos', uid, 'cardapio', docSnapshot.id, 'itens');
        const itensSnapshot = await getDocs(itensRef);

        if (!itensSnapshot.empty) {
            itensSnapshot.forEach(itemDoc => {
                const data = itemDoc.data();
                todosProdutos.push(this.formatarProdutoReal(itemDoc.id, data, docSnapshot.id, categoriaNomeReal));
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

  async salvarProdutoCatalogo(estabelecimentoId, { nome, preco, categoriaNome, categoriaId }) {
    const uid = estabelecimentoId || auth.currentUser?.uid;
    if (!uid) {
      console.error('❌ Erro: ID do estabelecimento não fornecido para salvar produto.');
      return null;
    }
    
    try {
      const catId = categoriaId || categoriaNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
      
      // 1. Garante que a categoria existe
      const categoriaRef = doc(db, 'estabelecimentos', uid, 'cardapio', catId);
      await setDoc(categoriaRef, {
        nome: categoriaNome,
        ativo: true,
        ordem: 99
      }, { merge: true });

      // 2. Cria o item dentro da subcoleção 'itens' da categoria
      const novoItemRef = doc(collection(db, 'estabelecimentos', uid, 'cardapio', catId, 'itens'));
      const itemData = {
        nome: nome.trim(),
        preco: Number(preco) || 0,
        categoria: categoriaNome,
        categoriaId: catId,
        ativo: true,
        disponivel: true,
        estoque: 1,
        codigoBarras: '',
        imageUrl: '',
        exibirDelivery: false,
        exibirPdv: true,
        exibirSalao: false,
        fiscal: {
          ncm: '',
          cfop: '5102',
          unidade: 'UN',
          departamentoId: ''
        },
        variacoes: [{ id: `v-${Date.now()}`, nome: 'Padrão', preco: Number(preco) || 0, ativo: true, estoque: 1, custo: 0 }],
        criadoEm: new Date(),
        atualizadoEm: new Date()
      };
      
      await setDoc(novoItemRef, itemData);
      console.log(`✅ Produto/Serviço "${nome}" salvo com sucesso no catálogo na categoria "${categoriaNome}".`);
      return { id: novoItemRef.id, ...itemData };
    } catch (error) {
      console.error('❌ Erro ao salvar produto no catálogo:', error);
      throw error;
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

  async excluirProduto(estabelecimentoId, categoriaId, produtoId) {
    const uid = estabelecimentoId || auth.currentUser?.uid;
    if (!uid) {
      console.error('❌ Erro: ID do estabelecimento não fornecido para excluir produto.');
      return false;
    }
    try {
      const itemRef = doc(db, 'estabelecimentos', uid, 'cardapio', categoriaId, 'itens', produtoId);
      await deleteDoc(itemRef);
      console.log(`✅ Produto "${produtoId}" excluído com sucesso do catálogo.`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao excluir produto:', error);
      throw error;
    }
  },

  async debugEstruturaCompleta(uid) {
    return this.buscarProdutosUniversal(uid);
  },

  async verificarEstruturaCategorias() { return true; }
};
