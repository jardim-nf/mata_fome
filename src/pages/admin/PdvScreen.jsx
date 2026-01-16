// src/pages/admin/PdvScreen.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext'; // ✅ CORREÇÃO 1: Usando o Hook
import { vendaService } from '../../services/vendaService';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

// --- COMPONENTES AUXILIARES (MODAIS) ---
// Extraídos para fora para evitar re-renderizações desnecessárias

const ModalSelecaoVariacao = ({ produto, onClose, onConfirm }) => {
  if (!produto) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-fade-in-up">
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
          <h3 className="font-bold text-lg">{produto.name}</h3>
          <button onClick={onClose} className="text-white hover:bg-blue-700 rounded-full p-1 w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4">Selecione uma opção:</p>
          <div className="grid gap-3">
            {produto.variacoes.map((v) => (
              <button
                key={v.id}
                onClick={() => onConfirm(produto, v)}
                className="flex justify-between items-center p-4 border rounded-xl hover:border-blue-500 hover:bg-blue-50 transition group"
              >
                <span className="font-bold text-gray-800">{v.nome}</span>
                <span className="text-green-600 font-bold bg-green-50 px-3 py-1 rounded-lg group-hover:bg-white">
                  R$ {Number(v.preco).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ModalRecibo = ({ visivel, dados, onClose, onNovaVenda }) => {
  if (!visivel || !dados) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm shadow-2xl overflow-hidden relative animate-bounce-in">
        <div className="h-4 w-full bg-gray-800 absolute top-0 left-0"></div>
        <div className="p-8 pt-10 font-mono text-sm text-gray-700">
          <div className="text-center mb-6 border-b-2 border-dashed border-gray-300 pb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">✅</div>
            <h2 className="text-xl font-bold text-gray-900 uppercase">Venda Finalizada</h2>
            <p className="text-gray-500 mt-1">{new Date().toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">ID: {dados.id?.slice(-6).toUpperCase()}</p>
          </div>
          <div className="space-y-3 mb-6 max-h-40 overflow-y-auto custom-scrollbar">
            {dados.itens.map((item, index) => (
              <div key={index} className="flex justify-between items-start border-b border-gray-100 pb-2">
                <div><span className="font-bold mr-2">{item.quantity}x</span>{item.name}</div>
                <div className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="border-t-2 border-dashed border-gray-300 pt-4 space-y-2 mb-6">
            <div className="flex justify-between text-xl font-bold text-gray-900"><span>TOTAL</span><span>R$ {dados.total.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm mt-2 bg-gray-50 p-2 rounded"><span>Pagamento:</span><span className="uppercase font-bold">{dados.formaPagamento}</span></div>
            {dados.troco > 0 && <div className="flex justify-between text-sm px-2 text-green-700 font-bold"><span>Troco:</span><span>R$ {dados.troco.toFixed(2)}</span></div>}
          </div>
          <div className="grid grid-cols-2 gap-3 no-print">
            <button onClick={() => window.print()} className="py-3 border-2 rounded-xl font-bold hover:bg-gray-50">🖨️ Imprimir</button>
            <button onClick={onNovaVenda} className="py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg">✨ Nova</button>
          </div>
        </div>
        <div className="bg-gray-100 h-6 w-full relative -bottom-3" style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, white 50%), linear-gradient(-45deg, transparent 50%, white 50%)', backgroundSize: '20px 20px', backgroundRepeat: 'repeat-x' }}></div>
      </div>
    </div>
  );
};

const ModalFinalizacao = ({ 
  visivel, venda, onClose, onFinalizar, salvando, 
  formaPagamento, setFormaPagamento, valorRecebido, setValorRecebido, troco 
}) => {
  if (!visivel || !venda) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fade-in-up">
        <div className="bg-green-600 p-6 rounded-t-2xl text-center text-white relative">
            <button onClick={onClose} className="absolute right-4 top-4 text-white hover:text-gray-200 text-xl">✕</button>
            <h2 className="text-2xl font-bold">💰 Finalizar</h2>
        </div>
        <div className="p-6 border-b text-center"><div className="text-3xl font-bold">R$ {venda.total.toFixed(2)}</div></div>
        <div className="p-6 border-b">
          <h3 className="font-semibold mb-3">Pagamento</h3>
          <div className="grid grid-cols-2 gap-3">
            {['dinheiro', 'cartao', 'pix', 'debito'].map(f => (
              <button key={f} onClick={() => { setFormaPagamento(f); if (f !== 'dinheiro') setValorRecebido(''); }} className={`p-3 rounded-xl border-2 capitalize font-bold transition-all ${formaPagamento === f ? 'border-green-500 bg-green-50 text-green-700 scale-105 shadow-sm' : 'border-gray-200 hover:bg-gray-50'}`}>{f}</button>
            ))}
          </div>
        </div>
        {formaPagamento === 'dinheiro' && (
          <div className="p-6 bg-gray-50 border-b animate-fade-in">
            <label className="block font-bold mb-2">Valor Recebido</label>
            <input 
                type="number" 
                step="0.01" 
                className="w-full p-3 border rounded-xl text-xl text-center font-bold focus:ring-2 focus:ring-green-500 outline-none" 
                value={valorRecebido} 
                onChange={e => setValorRecebido(e.target.value)} 
                autoFocus 
            />
            {troco > 0 && <div className="mt-3 text-center text-green-700 font-bold text-lg">Troco: R$ {troco.toFixed(2)}</div>}
          </div>
        )}
        <div className="p-6 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors">Voltar</button>
          <button onClick={onFinalizar} disabled={salvando} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50">{salvando ? '...' : 'Confirmar (F10)'}</button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

const PdvScreen = () => {
  // Dados do Usuário e Contexto
  const { userData, currentUser } = useAuth(); // ✅ Hook corrigido

  // Estados Principais
  const [vendaAtual, setVendaAtual] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);

  // Estados de Filtro e Busca
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [busca, setBusca] = useState('');

  // Estados de Modais
  const [mostrarFinalizacao, setMostrarFinalizacao] = useState(false);
  const [mostrarAtalhos, setMostrarAtalhos] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [mostrarNfce, setMostrarNfce] = useState(false);
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [dadosRecibo, setDadosRecibo] = useState(null);

  // Seleção de Variação
  const [produtoParaSelecao, setProdutoParaSelecao] = useState(null);

  // Estados da Venda
  const [formaPagamento, setFormaPagamento] = useState('');
  const [valorRecebido, setValorRecebido] = useState('');
  const [troco, setTroco] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [dadosCliente, setDadosCliente] = useState({ nome: '', cpf: '', email: '' });

  const inputBuscaRef = useRef(null);

  // 1. IDENTIFICAÇÃO DO ESTABELECIMENTO
  const estabelecimentosGerenciados = useMemo(() => userData?.estabelecimentosGerenciados || [], [userData]);
  const primeiroEstabelecimento = estabelecimentosGerenciados[0] || currentUser?.uid;

  // UTILS
  const formatarNomeCategoriaDinamica = (categoria) => {
    if (!categoria) return 'Geral';
    return categoria.charAt(0).toUpperCase() + categoria.slice(1).replace(/-/g, ' ');
  };

  const getIconeCategoriaDinamico = (categoria) => {
    if (!categoria) return '🍽️';
    const lower = categoria.toLowerCase();
    if (lower.includes('bebida') || lower.includes('suco')) return '🥤';
    if (lower.includes('lanche') || lower.includes('burger')) return '🍔';
    if (lower.includes('pizza')) return '🍕';
    if (lower.includes('sobremesa') || lower.includes('doce')) return '🍰';
    return '🍽️';
  };

  // 2. BUSCA DE PRODUTOS E VARIAÇÕES
  useEffect(() => {
    if (!primeiroEstabelecimento) {
      setCarregandoProdutos(false);
      return;
    }
    setCarregandoProdutos(true);

    const categoriasRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio');
    const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));

    const unsubscribeCategorias = onSnapshot(qCategorias, (catSnap) => {
      const categoriesData = catSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        icon: getIconeCategoriaDinamico(doc.data().nome || doc.id)
      }));

      setCategorias([
        { id: 'todos', name: 'Todos', icon: '🍽️' },
        ...categoriesData.map(c => ({
          id: c.nome || c.id,
          originalId: c.id,
          name: c.nome || formatarNomeCategoriaDinamica(c.id),
          icon: c.icon
        }))
      ]);

      if (catSnap.empty) {
        setProdutos([]);
        setCarregandoProdutos(false);
        return;
      }

      const unsubscribers = [];
      let allItemsMap = new Map(); // Usar Map para evitar duplicatas e updates desordenados
      let catsProcessed = 0;

      catSnap.forEach(catDoc => {
        const itemsRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catDoc.id, 'itens');
        const qItems = query(itemsRef);

        const unsubscribeItems = onSnapshot(qItems, (itemsSnap) => {
          const itemsDaCategoria = itemsSnap.docs.map(itemDoc => {
            const data = itemDoc.data();

            // TRATAMENTO DE VARIAÇÕES
            const variacoes = Array.isArray(data.variacoes) ? data.variacoes.filter(v => v.ativo) : [];
            let precoBase = Number(data.preco || 0);
            let temVariacoes = false;

            if (variacoes.length > 0) {
              const precosVars = variacoes.map(v => Number(v.preco)).filter(p => p > 0);
              if (precosVars.length > 0) {
                precoBase = Math.min(...precosVars);
                temVariacoes = true;
              }
            }

            return {
              ...data,
              id: itemDoc.id,
              categoria: catDoc.data().nome || formatarNomeCategoriaDinamica(catDoc.id),
              categoriaId: catDoc.id,
              price: precoBase,
              name: data.nome,
              variacoes: variacoes,
              temVariacoes: temVariacoes,
              emEstoque: data.estoque > 0 || !data.controlarEstoque
            };
          });

          const itensAtivos = itemsDaCategoria.filter(i => i.ativo !== false);
          
          // Atualiza o Map global com os itens desta categoria
          allItemsMap.set(catDoc.id, itensAtivos);
          
          // Reconstrói o array plano de produtos
          const flatProdutos = Array.from(allItemsMap.values()).flat();
          setProdutos(flatProdutos);

          catsProcessed++;
          if (catsProcessed >= catSnap.size) setCarregandoProdutos(false);
        });
        unsubscribers.push(unsubscribeItems);
      });
      // Safety timeout
      setTimeout(() => setCarregandoProdutos(false), 2000);
      return () => unsubscribers.forEach(unsub => unsub());
    });
    return () => unsubscribeCategorias();
  }, [primeiroEstabelecimento]);

  // ATALHOS
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'F1') { event.preventDefault(); inputBuscaRef.current?.focus(); }
      else if (event.key === 'F2') { event.preventDefault(); if (!vendaAtual) iniciarVendaBalcao(); }
      else if (event.key === 'F10') { event.preventDefault(); if (vendaAtual?.itens.length > 0) setMostrarFinalizacao(true); }
      else if (event.key === 'Escape') {
        event.preventDefault();
        if (produtoParaSelecao) setProdutoParaSelecao(null);
        else if (mostrarFinalizacao) setMostrarFinalizacao(false);
        else if (mostrarRecibo) setMostrarRecibo(false);
        else if (mostrarAtalhos) setMostrarAtalhos(false);
        else if (vendaAtual) cancelarVenda();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vendaAtual, mostrarFinalizacao, mostrarRecibo, mostrarAtalhos, produtoParaSelecao]);

  // FILTROS OTIMIZADOS
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(produto => {
      const categoriaMatch = categoriaAtiva === 'todos' || produto.categoria === categoriaAtiva || produto.categoriaId === categoriaAtiva;
      const buscaMatch = produto.name?.toLowerCase().includes(busca.toLowerCase());
      return categoriaMatch && buscaMatch;
    });
  }, [produtos, categoriaAtiva, busca]);

  // TROCO
  useEffect(() => {
    if (formaPagamento === 'dinheiro' && valorRecebido && vendaAtual) {
      setTroco(Math.max(0, parseFloat(valorRecebido) - vendaAtual.total));
    } else {
      setTroco(0);
    }
  }, [valorRecebido, formaPagamento, vendaAtual]);

  // AÇÕES
  const iniciarVendaBalcao = () => {
    setVendaAtual({ id: Date.now().toString(), tipo: 'balcao', itens: [], status: 'aberta', total: 0 });
    setMostrarFinalizacao(false);
    setBusca('');
    setDadosCliente({ nome: '', cpf: '', email: '' });
  };

  const handleProdutoClick = (produto) => {
    if (!vendaAtual) { alert('Inicie uma venda primeiro (F2)'); return; }

    if (produto.temVariacoes && produto.variacoes.length > 0) {
      if (produto.variacoes.length === 1 && (produto.variacoes[0].nome === 'Padrão' || produto.variacoes[0].nome === 'Único')) {
        adicionarItemAoCarrinho(produto, produto.variacoes[0]);
      } else {
        setProdutoParaSelecao(produto);
      }
    } else {
      adicionarItemAoCarrinho(produto, null);
    }
  };

  const adicionarItemAoCarrinho = (produto, variacaoSelecionada) => {
    setVendaAtual(prev => {
      const variacaoId = variacaoSelecionada ? variacaoSelecionada.id : 'padrao';
      const uniqueItemId = `${produto.id}-${variacaoId}`;

      const itemExistente = prev.itens.find(item => item.uniqueItemId === uniqueItemId);

      const nomeFinal = variacaoSelecionada && variacaoSelecionada.nome !== 'Padrão'
        ? `${produto.name} (${variacaoSelecionada.nome})`
        : produto.name;

      const precoFinal = variacaoSelecionada ? Number(variacaoSelecionada.preco) : Number(produto.price);

      let novosItens;
      if (itemExistente) {
        novosItens = prev.itens.map(item =>
          item.uniqueItemId === uniqueItemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        novosItens = [...prev.itens, {
          id: Date.now().toString(),
          uniqueItemId: uniqueItemId,
          productId: produto.id,
          variationId: variacaoId,
          name: nomeFinal,
          price: precoFinal,
          quantity: 1
        }];
      }

      const total = novosItens.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return { ...prev, itens: novosItens, total };
    });

    setProdutoParaSelecao(null);
    inputBuscaRef.current?.focus();
  };

  const removerItem = (itemId) => {
    if (!vendaAtual) return;
    setVendaAtual(prev => {
      const novosItens = prev.itens.filter(item => item.id !== itemId);
      const total = novosItens.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return { ...prev, itens: novosItens, total };
    });
  };

  const ajustarQuantidade = (itemId, novaQuantidade) => {
    if (!vendaAtual) return;
    if (novaQuantidade <= 0) { removerItem(itemId); return; }
    setVendaAtual(prev => {
      const novosItens = prev.itens.map(item =>
        item.id === itemId ? { ...item, quantity: novaQuantidade } : item
      );
      const total = novosItens.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return { ...prev, itens: novosItens, total };
    });
  };

  const finalizarVenda = async () => {
    if (!formaPagamento) return alert('Selecione uma forma de pagamento');
    if (formaPagamento === 'dinheiro' && (!valorRecebido || parseFloat(valorRecebido) < vendaAtual.total)) return alert('Valor insuficiente');

    setSalvando(true);
    try {
      const vendaData = {
        estabelecimentoId: primeiroEstabelecimento,
        tipo: 'balcao',
        status: 'finalizada',
        formaPagamento,
        valorRecebido: formaPagamento === 'dinheiro' ? parseFloat(valorRecebido) : vendaAtual.total,
        troco: formaPagamento === 'dinheiro' ? troco : 0,
        total: vendaAtual.total,
        itens: vendaAtual.itens,
        usuarioId: currentUser?.uid,
        cliente: dadosCliente.nome || 'Balcão',
        data: new Date()
      };

      const resultado = await vendaService.salvarVenda(vendaData);
      if (resultado.success) {
        setDadosRecibo({ ...vendaData, id: resultado.vendaId || '000000' });
        setMostrarFinalizacao(false);
        setVendaAtual(null);
        setFormaPagamento('');
        setValorRecebido('');
        setTroco(0);
        setMostrarRecibo(true);
      } else { alert('Erro: ' + resultado.error); }
    } catch (e) { alert('Erro ao finalizar'); }
    finally { setSalvando(false); }
  };

  const cancelarVenda = () => {
    if (vendaAtual?.itens.length > 0 && !window.confirm('Cancelar venda?')) return;
    setVendaAtual(null);
    setMostrarFinalizacao(false);
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ESQUERDA: CATÁLOGO */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
            <h1 className="text-2xl font-bold text-gray-800">PDV <span className="text-sm font-normal text-gray-500">Caixa</span></h1>
            {!vendaAtual ? (
              <button onClick={iniciarVendaBalcao} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow hover:bg-green-700 transition transform hover:scale-105">🛒 Abrir Caixa (F2)</button>
            ) : <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold animate-pulse">Venda Aberta</span>}
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm space-y-4">
            <input 
                ref={inputBuscaRef} 
                type="text" 
                placeholder="Buscar produto (F1)..." 
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
                value={busca} 
                onChange={e => setBusca(e.target.value)} 
            />
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categorias.map(cat => (
                <button 
                    key={cat.id} 
                    onClick={() => setCategoriaAtiva(cat.name === 'Todos' ? 'todos' : cat.name)} 
                    className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition flex gap-2 ${((categoriaAtiva === 'todos' && cat.name === 'Todos') || categoriaAtiva === cat.name) ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <span>{cat.icon}</span>{cat.name}
                </button>
              ))}
            </div>
          </div>

          {carregandoProdutos ? (
            <div className="text-center py-20 text-gray-500 flex flex-col items-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>Carregando...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 h-[60vh] overflow-y-auto content-start pr-2 custom-scrollbar">
              {produtosFiltrados.map(produto => (
                <button
                  key={produto.id}
                  onClick={() => handleProdutoClick(produto)}
                  className="bg-white border hover:border-blue-500 hover:shadow-lg transition rounded-xl p-4 flex flex-col items-start text-left group h-full relative"
                >
                  <div className="text-3xl mb-2 bg-gray-50 w-12 h-12 flex items-center justify-center rounded-lg shadow-inner">{getIconeCategoriaDinamico(produto.categoria)}</div>
                  <h3 className="font-bold text-gray-800 leading-tight mb-1 line-clamp-2">{produto.name}</h3>

                  {produto.temVariacoes && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mb-1 font-bold">Opções</span>
                  )}

                  <div className="mt-auto pt-2 w-full flex justify-between items-center">
                    <div className="flex flex-col">
                      {produto.temVariacoes && <span className="text-[10px] text-gray-500">A partir de</span>}
                      <span className="font-bold text-green-600">R$ {produto.price.toFixed(2)}</span>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-md text-gray-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">+</span>
                  </div>
                </button>
              ))}
              {produtosFiltrados.length === 0 && <div className="col-span-full text-center py-10 text-gray-400">Nenhum produto encontrado.</div>}
            </div>
          )}
        </div>

        {/* DIREITA: CUPOM */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-lg h-[calc(100vh-2rem)] sticky top-4 flex flex-col">
            <div className="p-4 border-b bg-gray-50 rounded-t-2xl"><h2 className="font-bold text-gray-700">Cupom</h2><div className="text-xs text-gray-500">{new Date().toLocaleDateString()}</div></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {vendaAtual ? (
                vendaAtual.itens.length > 0 ? (
                  vendaAtual.itens.map(item => (
                    <div key={item.uniqueItemId || item.id} className="flex justify-between items-start group border-b border-dashed border-gray-100 pb-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{item.name}</div>
                        <div className="text-sm text-gray-500">{item.quantity}x R$ {item.price.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-800">R$ {(item.quantity * item.price).toFixed(2)}</div>
                        <div className="flex gap-1 justify-end mt-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => ajustarQuantidade(item.id, item.quantity - 1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 font-bold">-</button>
                          <button onClick={() => ajustarQuantidade(item.id, item.quantity + 1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 font-bold">+</button>
                          <button onClick={() => removerItem(item.id)} className="w-6 h-6 bg-red-100 text-red-600 rounded hover:bg-red-200 font-bold">x</button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : <div className="text-center text-gray-400 py-10">Carrinho vazio</div>
              ) : <div className="text-center text-gray-400 py-10 flex flex-col items-center h-full justify-center opacity-50"><span className="text-6xl mb-4">🏪</span><p>Caixa Fechado</p></div>}
            </div>
            {vendaAtual && (
              <div className="p-4 bg-gray-50 border-t rounded-b-2xl space-y-3">
                <div className="flex justify-between items-center text-xl font-bold text-gray-800"><span>Total</span><span>R$ {vendaAtual.total.toFixed(2)}</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="bg-purple-100 text-purple-700 py-3 rounded-xl font-bold hover:bg-purple-200 transition">NFC-e (F12)</button>
                  <button onClick={cancelarVenda} className="bg-red-100 text-red-700 py-3 rounded-xl font-bold hover:bg-red-200 transition">Cancelar</button>
                  <button onClick={() => setMostrarFinalizacao(true)} className="col-span-2 bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg transition transform active:scale-95">Finalizar Venda (F10)</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ModalSelecaoVariacao
        produto={produtoParaSelecao}
        onClose={() => setProdutoParaSelecao(null)}
        onConfirm={adicionarItemAoCarrinho}
      />

      <ModalFinalizacao
        visivel={mostrarFinalizacao}
        venda={vendaAtual}
        onClose={() => setMostrarFinalizacao(false)}
        onFinalizar={finalizarVenda}
        salvando={salvando}
        formaPagamento={formaPagamento}
        setFormaPagamento={setFormaPagamento}
        valorRecebido={valorRecebido}
        setValorRecebido={setValorRecebido}
        troco={troco}
      />

      <ModalRecibo
        visivel={mostrarRecibo}
        dados={dadosRecibo}
        onClose={() => setMostrarRecibo(false)}
        onNovaVenda={() => { setMostrarRecibo(false); iniciarVendaBalcao(); }}
      />

      <button onClick={() => setMostrarAtalhos(!mostrarAtalhos)} className="fixed bottom-4 left-4 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 z-40 transition-transform hover:scale-110">⌨️</button>
      {mostrarAtalhos && <div className="fixed bottom-16 left-4 bg-white p-4 rounded-xl shadow-xl border z-40 w-64 text-sm"><h3 className="font-bold mb-2">Atalhos</h3><ul className="space-y-2 text-gray-600"><li>F1: Buscar</li><li>F2: Nova Venda</li><li>F10: Finalizar</li><li>ESC: Voltar</li></ul></div>}
    </div>
  );
};

export default PdvScreen;