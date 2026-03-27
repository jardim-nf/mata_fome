// src/components/NovoPedidoDeliveryModal.jsx
import { useState, useEffect, useMemo } from 'react';
import { IoClose, IoSearch, IoAdd, IoRemove, IoTrash, IoChevronDown } from 'react-icons/io5';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { produtoService } from '../services/produtoService';
import VariacoesModal from './VariacoesModal';

export default function NovoPedidoDeliveryModal({ isOpen, onClose, onSave, estabelecimentoId }) {
  // --- Dados do cliente ---
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [pontoReferencia, setPontoReferencia] = useState('');
  const [bairro, setBairro] = useState('');

  // --- Taxa de entrega ---
  const [bairrosDisponiveis, setBairrosDisponiveis] = useState([]);
  const [taxaEntrega, setTaxaEntrega] = useState(0);
  const [showBairroDropdown, setShowBairroDropdown] = useState(false);

  // --- Produtos do banco ---
  const [produtos, setProdutos] = useState([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');

  // --- Carrinho ---
  const [carrinho, setCarrinho] = useState([]);

  // --- Modal de variações ---
  const [itemParaVariacao, setItemParaVariacao] = useState(null);

  // --- Observação ---
  const [observacao, setObservacao] = useState('');

  // Carrega produtos + bairros quando o modal abre
  useEffect(() => {
    if (isOpen && estabelecimentoId) {
      // Buscar produtos
      setLoadingProdutos(true);
      produtoService.buscarProdutosUniversal(estabelecimentoId)
        .then(prods => {
          setProdutos(prods.filter(p => p.ativo && p.emEstoque));
        })
        .catch(err => console.error('Erro ao buscar produtos:', err))
        .finally(() => setLoadingProdutos(false));

      // Buscar bairros e taxas de entrega
      getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega'))
        .then(snap => {
          const lista = [];
          snap.forEach(docSnap => {
            const data = docSnap.data();
            lista.push({
              id: docSnap.id,
              nome: data.nomeBairro || docSnap.id,
              taxa: Number(data.valorTaxa || 0),
            });
          });
          // Ordena alfabeticamente
          lista.sort((a, b) => a.nome.localeCompare(b.nome));
          setBairrosDisponiveis(lista);
        })
        .catch(err => console.error('Erro ao buscar bairros:', err));
    }
  }, [isOpen, estabelecimentoId]);

  // Quando seleciona um bairro, atualiza a taxa
  const selecionarBairro = (bairroItem) => {
    setBairro(bairroItem.nome);
    setTaxaEntrega(bairroItem.taxa);
    setShowBairroDropdown(false);
  };

  // Bairro manual (digitar nome) — tenta encontrar a taxa
  const handleBairroChange = (valor) => {
    setBairro(valor);
    setShowBairroDropdown(false);
    const normalizado = valor.toLowerCase().trim();
    const encontrado = bairrosDisponiveis.find(b =>
      b.nome.toLowerCase().trim() === normalizado ||
      b.nome.toLowerCase().trim().includes(normalizado)
    );
    if (encontrado) {
      setTaxaEntrega(encontrado.taxa);
    } else {
      setTaxaEntrega(0);
    }
  };

  // Categorias únicas
  const categorias = useMemo(() => {
    const cats = [...new Set(produtos.map(p => p.category))];
    return cats.sort();
  }, [produtos]);

  // Nomes legíveis das categorias
  const categoriaNomes = useMemo(() => {
    const map = {};
    produtos.forEach(p => { map[p.category] = p.categoriaNome || p.category; });
    return map;
  }, [produtos]);

  // Produtos filtrados
  const produtosFiltrados = useMemo(() => {
    let filtered = produtos;
    if (categoriaFiltro !== 'todas') {
      filtered = filtered.filter(p => p.category === categoriaFiltro);
    }
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(termo));
    }
    return filtered;
  }, [produtos, categoriaFiltro, busca]);

  // Totais
  const subtotalCarrinho = useMemo(() => {
    return carrinho.reduce((acc, item) => acc + ((item.precoFinal || item.price) * item.quantidade), 0);
  }, [carrinho]);

  const totalFinal = subtotalCarrinho + taxaEntrega;

  // Funções do carrinho
  const adicionarAoCarrinho = (produto) => {
    // Se o produto tem variações, abre o modal de variações
    if (produto.variacoes && produto.variacoes.length > 0) {
      setItemParaVariacao({
        ...produto,
        preco: produto.price,
        nome: produto.name,
        categoriaId: produto.categoriaId || produto.category,
      });
      return;
    }
    // Produto simples — adiciona direto
    setCarrinho(prev => {
      const idx = prev.findIndex(i => i.id === produto.id && !i._variacaoKey);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantidade: updated[idx].quantidade + 1 };
        return updated;
      }
      return [...prev, { ...produto, quantidade: 1 }];
    });
  };

  // Callback do VariacoesModal
  const handleVariacaoConfirmada = (itemComVariacao) => {
    const varNome = itemComVariacao.variacaoSelecionada?.nome || '';
    const varKey = `${itemComVariacao.id}_${varNome}_${(itemComVariacao.adicionaisSelecionados || []).map(a => a.nome).join(',')}`;
    setCarrinho(prev => {
      const idx = prev.findIndex(i => i._variacaoKey === varKey);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantidade: updated[idx].quantidade + 1 };
        return updated;
      }
      return [...prev, {
        ...itemComVariacao,
        name: itemComVariacao.nome || itemComVariacao.name,
        price: itemComVariacao.precoFinal || itemComVariacao.preco || itemComVariacao.price,
        precoFinal: itemComVariacao.precoFinal,
        quantidade: 1,
        _variacaoKey: varKey,
        _variacaoNome: varNome,
        _adicionaisNomes: (itemComVariacao.adicionaisSelecionados || []).map(a => a.nome),
        _observacao: itemComVariacao.observacao || '',
      }];
    });
    setItemParaVariacao(null);
  };

  const alterarQuantidade = (itemKey, delta) => {
    setCarrinho(prev => {
      return prev.map(item => {
        const key = item._variacaoKey || item.id;
        if (key !== itemKey) return item;
        const novaQtd = item.quantidade + delta;
        if (novaQtd <= 0) return null;
        return { ...item, quantidade: novaQtd };
      }).filter(Boolean);
    });
  };

  const removerDoCarrinho = (itemKey) => {
    setCarrinho(prev => prev.filter(i => (i._variacaoKey || i.id) !== itemKey));
  };

  const getQuantidadeNoCarrinho = (produtoId) => {
    const item = carrinho.find(i => i.id === produtoId);
    return item ? item.quantidade : 0;
  };

  // Salvar
  const handleSave = () => {
    if (!nomeCliente.trim() || !telefone.trim() || !endereco.trim()) {
      alert('Preencha nome, telefone e endereço.');
      return;
    }
    if (carrinho.length === 0) {
      alert('Adicione pelo menos um produto ao pedido.');
      return;
    }

    const pedidoData = {
      nomeCliente: nomeCliente.trim(),
      telefoneCliente: telefone.replace(/\D/g, ''),
      enderecoEntrega: endereco.trim(),
      pontoReferencia: pontoReferencia.trim(),
      bairro: bairro.trim(),
      taxaEntrega,
      observacao: observacao.trim(),
      itens: carrinho.map(i => ({
        nome: i.name,
        quantidade: i.quantidade,
        preco: i.precoFinal || i.price,
        precoFinal: (i.precoFinal || i.price) * i.quantidade,
        produtoId: i.id,
        categoria: i.category,
        variacao: i._variacaoNome || null,
        adicionais: i._adicionaisNomes || [],
        observacaoItem: i._observacao || '',
      })),
      subtotal: subtotalCarrinho,
      total: totalFinal,
    };

    onSave(pedidoData);
    // Limpa tudo
    setNomeCliente('');
    setTelefone('');
    setEndereco('');
    setPontoReferencia('');
    setBairro('');
    setTaxaEntrega(0);
    setObservacao('');
    setCarrinho([]);
    setBusca('');
    setCategoriaFiltro('todas');
    setItemParaVariacao(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">🛵 Novo Pedido Delivery</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors"><IoClose size={24} /></button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* === DADOS DO CLIENTE === */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">📋 Dados do Cliente</p>
            <input type="text" placeholder="Nome do Cliente *" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)}
              className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />
            <input type="tel" placeholder="Telefone (WhatsApp) *" value={telefone} onChange={e => setTelefone(e.target.value)}
              className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />
            <input type="text" placeholder="Endereço de Entrega *" value={endereco} onChange={e => setEndereco(e.target.value)}
              className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />
            <input type="text" placeholder="Ponto de Referência (opcional)" value={pontoReferencia} onChange={e => setPontoReferencia(e.target.value)}
              className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />

            {/* === BAIRRO + TAXA === */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Bairro"
                    value={bairro}
                    onChange={e => handleBairroChange(e.target.value)}
                    onFocus={() => bairrosDisponiveis.length > 0 && setShowBairroDropdown(true)}
                    className="w-full p-2.5 pr-8 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                  />
                  {bairrosDisponiveis.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowBairroDropdown(!showBairroDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <IoChevronDown size={16} />
                    </button>
                  )}

                  {/* Dropdown de bairros */}
                  {showBairroDropdown && bairrosDisponiveis.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                      {bairrosDisponiveis
                        .filter(b => !bairro || b.nome.toLowerCase().includes(bairro.toLowerCase()))
                        .map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => selecionarBairro(b)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center transition-colors border-b border-slate-50 last:border-0"
                        >
                          <span className="font-medium text-slate-700">{b.nome}</span>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            R$ {b.taxa.toFixed(2)}
                          </span>
                        </button>
                      ))}
                      {bairrosDisponiveis.filter(b => !bairro || b.nome.toLowerCase().includes(bairro.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-400 text-center">Nenhum bairro encontrado</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Taxa badge */}
                <div className={`shrink-0 flex items-center px-3 rounded-lg text-sm font-bold ${taxaEntrega > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                  {taxaEntrega > 0 ? `R$ ${taxaEntrega.toFixed(2)}` : 'Taxa: --'}
                </div>
              </div>
            </div>
          </div>

          {/* === SELEÇÃO DE PRODUTOS === */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">🍔 Produtos do Cardápio</p>

            {/* Busca */}
            <div className="relative">
              <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none" />
            </div>

            {/* Filtro por categoria */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button onClick={() => setCategoriaFiltro('todas')}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${categoriaFiltro === 'todas' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                Todas
              </button>
              {categorias.map(cat => (
                <button key={cat} onClick={() => setCategoriaFiltro(cat)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${categoriaFiltro === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {categoriaNomes[cat]}
                </button>
              ))}
            </div>

            {/* Lista de produtos */}
            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
              {loadingProdutos ? (
                <div className="p-6 text-center text-sm text-slate-400">⏳ Carregando cardápio...</div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">
                  {busca ? 'Nenhum produto encontrado' : 'Nenhum produto no cardápio'}
                </div>
              ) : (
                produtosFiltrados.map(prod => {
                  const qtdNoCarrinho = getQuantidadeNoCarrinho(prod.id);
                  return (
                    <div key={prod.id} className={`flex items-center justify-between p-2.5 hover:bg-blue-50/50 transition-colors ${qtdNoCarrinho > 0 ? 'bg-blue-50/30' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{prod.name}</p>
                        <p className="text-xs text-slate-400">
                          {categoriaNomes[prod.category]}
                          {prod.variacoes && prod.variacoes.length > 0 && (
                            <span className="ml-1 text-blue-500 font-semibold">• {prod.variacoes.length} variações</span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-emerald-600 mx-3 shrink-0">
                        {prod.variacoes && prod.variacoes.length > 0
                          ? `A partir de R$ ${Math.min(...prod.variacoes.map(v => Number(v.preco) || 0)).toFixed(2)}`
                          : `R$ ${prod.price.toFixed(2)}`}
                      </p>
                      {qtdNoCarrinho > 0 ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => alterarQuantidade(prod.id, -1)}
                            className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors">
                            <IoRemove size={14} />
                          </button>
                          <span className="text-sm font-bold text-blue-700 w-5 text-center">{qtdNoCarrinho}</span>
                          <button onClick={() => alterarQuantidade(prod.id, 1)}
                            className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors">
                            <IoAdd size={14} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => adicionarAoCarrinho(prod)}
                          className="shrink-0 px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1">
                          <IoAdd size={14} /> Add
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* === CARRINHO === */}
          {carrinho.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">🛒 Carrinho ({carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'})</p>
              <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-100">
                {carrinho.map(item => {
                  const itemKey = item._variacaoKey || item.id;
                  const precoUnit = item.precoFinal || item.price;
                  return (
                  <div key={itemKey} className="flex items-center justify-between p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      {item._variacaoNome && (
                        <p className="text-xs text-blue-500 font-medium">↳ {item._variacaoNome}</p>
                      )}
                      {item._adicionaisNomes && item._adicionaisNomes.length > 0 && (
                        <p className="text-xs text-purple-500">+ {item._adicionaisNomes.join(', ')}</p>
                      )}
                      {item._observacao && (
                        <p className="text-xs text-orange-500 italic">Obs: {item._observacao}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {item.quantidade}x R$ {precoUnit.toFixed(2)} = <span className="font-bold text-emerald-600">R$ {(precoUnit * item.quantidade).toFixed(2)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button onClick={() => alterarQuantidade(itemKey, -1)}
                        className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors">
                        <IoRemove size={12} />
                      </button>
                      <span className="text-sm font-bold w-4 text-center">{item.quantidade}</span>
                      <button onClick={() => alterarQuantidade(itemKey, 1)}
                        className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-emerald-100 hover:text-emerald-600 transition-colors">
                        <IoAdd size={12} />
                      </button>
                      <button onClick={() => removerDoCarrinho(itemKey)}
                        className="w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 transition-colors ml-1">
                        <IoTrash size={12} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observação */}
          <div>
            <textarea placeholder="Observações do pedido (opcional)" value={observacao} onChange={e => setObservacao(e.target.value)}
              className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none resize-none" rows="2" />
          </div>

          {/* === TOTAL DETALHADO === */}
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between items-center text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold">R$ {subtotalCarrinho.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 flex items-center gap-1">
                🛵 Taxa de entrega
                {bairro && <span className="text-xs text-slate-400">({bairro})</span>}
              </span>
              <span className={`font-semibold ${taxaEntrega > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                {taxaEntrega > 0 ? `R$ ${taxaEntrega.toFixed(2)}` : 'R$ 0,00'}
              </span>
            </div>
            <div className="border-t border-emerald-200 pt-1.5 flex justify-between items-center">
              <span className="text-sm font-bold text-emerald-800">Total do Pedido</span>
              <span className="text-xl font-black text-emerald-700">R$ {totalFinal.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={carrinho.length === 0}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20">
              Salvar Pedido
            </button>
          </div>
        </div>
      </div>

      {/* === MODAL DE VARIAÇÕES === */}
      {itemParaVariacao && (
        <VariacoesModal
          item={itemParaVariacao}
          onConfirm={handleVariacaoConfirmada}
          onClose={() => setItemParaVariacao(null)}
          estabelecimentoId={estabelecimentoId}
        />
      )}
    </div>
  );
}