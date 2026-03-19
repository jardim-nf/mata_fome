import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';

import { useAuth } from '../context/AuthContext';
import { useAI } from '../context/AIContext';
import { useCart } from '../hooks/useCart';
import { useEstablishment } from '../hooks/useEstablishment';

import CardapioItem from '../components/CardapioItem';
import EstablishmentHeader from '../components/menu/EstablishmentHeader';
import CategoryFilter from '../components/menu/CategoryFilter';
import CustomerForm from '../components/menu/CustomerForm';
import CartSection from '../components/menu/CartSection';
import CartBar from '../components/menu/CartBar';
import AuthModal from '../components/menu/AuthModal';

import { estoqueService } from '../services/estoqueService';

const VariacoesModal = lazy(() => import('../components/VariacoesModal'));
const PaymentModal = lazy(() => import('../components/PaymentModal'));
const RaspadinhaModal = lazy(() => import('../components/RaspadinhaModal'));
const AIChatAssistant = lazy(() => import('../components/ai/AIChatAssistant'));
const AIWidgetButton = lazy(() => import('../components/AIWidgetButton'));
const ReviewModal = lazy(() => import('../components/ReviewModal'));

const auth = getAuth();

function normalizarTexto(texto) {
  if (!texto) return '';
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function cleanData(obj) {
  if (obj === null || obj === undefined) return obj;
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value === undefined) {
      acc[key] = null;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (value instanceof Date || value.seconds !== undefined || ('_methodName' in value)) {
        acc[key] = value;
      } else {
        acc[key] = cleanData(value);
      }
    } else if (Array.isArray(value)) {
      acc[key] = value.map(item => typeof item === 'object' ? cleanData(item) : item);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export default function Menu() {
  const { estabelecimentoSlug } = useParams();
  const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin, logout } = useAuth();
  const { isWidgetOpen } = useAI();

  // Dados do estabelecimento
  const { loading, allProdutos, estabelecimentoInfo, actualEstabelecimentoId, ordemCategorias, bairrosDisponiveis, coresEstabelecimento } = useEstablishment(estabelecimentoSlug);

  // Carrinho
  const { carrinho, setCarrinho, subtotalCalculado, adicionarItem, alterarQuantidade, removerItem, limparCarrinho, adicionarBrinde, carrinhoRecuperado, descartarRecuperacao } = useCart();

  // Tempo
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // 🔁 Pedir de Novo — pegar itens salvos do histórico
  useEffect(() => {
    if (loading || allProdutos.length === 0) return;
    const repetir = localStorage.getItem('ideafood_repetir_pedido');
    if (!repetir) return;
    localStorage.removeItem('ideafood_repetir_pedido');
    try {
      const itens = JSON.parse(repetir);
      let adicionados = 0;
      itens.forEach(item => {
        const produtoEncontrado = allProdutos.find(p => p.nome === item.nome);
        if (produtoEncontrado) {
          for (let i = 0; i < (item.quantidade || 1); i++) {
            adicionarItem({ ...produtoEncontrado, observacao: item.observacoes || '' });
          }
          adicionados++;
        }
      });
      if (adicionados > 0) {
        toast.success(`🔁 ${adicionados} ${adicionados === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho!`);
      }
    } catch {}
  }, [loading, allProdutos]);

  // Dados do cliente
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [complemento, setComplemento] = useState('');
  const [pontoReferencia, setPontoReferencia] = useState('');
  const [isRetirada, setIsRetirada] = useState(false);
  const [taxaEntregaCalculada, setTaxaEntregaCalculada] = useState(0);

  // Auth modal
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [forceLogin, setForceLogin] = useState(false);
  const [isRegisteringInModal, setIsRegisteringInModal] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [emailAuthModal, setEmailAuthModal] = useState('');
  const [passwordAuthModal, setPasswordAuthModal] = useState('');
  const [nomeAuthModal, setNomeAuthModal] = useState('');
  const [telefoneAuthModal, setTelefoneAuthModal] = useState('');
  const [ruaAuthModal, setRuaAuthModal] = useState('');
  const [numeroAuthModal, setNumeroAuthModal] = useState('');
  const [bairroAuthModal, setBairroAuthModal] = useState('');
  const [cidadeAuthModal, setCidadeAuthModal] = useState('');
  const [referenciaAuthModal, setReferenciaAuthModal] = useState('');

  // Cupom
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);

  // UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [produtosFiltrados, setProdutosFiltrados] = useState([]);
  const [visibleItemsCount, setVisibleItemsCount] = useState({});
  const [itemParaVariacoes, setItemParaVariacoes] = useState(null);
  const [triggerCheckout, setTriggerCheckout] = useState(false);

  // Pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pedidoParaPagamento, setPedidoParaPagamento] = useState(null);
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [ultimoPedidoId, setUltimoPedidoId] = useState(null);

  // Raspadinha
  const [showRaspadinha, setShowRaspadinha] = useState(false);
  const [jaJogouRaspadinha, setJaJogouRaspadinha] = useState(false);
  const [premioRaspadinha, setPremioRaspadinha] = useState(null);
  const [valorGatilhoRaspadinha, setValorGatilhoRaspadinha] = useState(9999);

  // IA
  const [showAICenter, setShowAICenter] = useState(false);
  const [deveReabrirChat, setDeveReabrirChat] = useState(false);

  // Horário funcionamento
  const isLojaAberta = useMemo(() => {
    if (!estabelecimentoInfo) return false;
    const dias = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
    const diaKey = dias[currentTime.getDay()];

    const calcTempo = (str) => {
      const [h, m] = str.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    const verificar = (abertura, fechamento) => {
      try {
        const agora = currentTime.getHours() * 60 + currentTime.getMinutes();
        const abre = calcTempo(abertura);
        const fecha = calcTempo(fechamento);
        if (abre === fecha) return true;
        return abre < fecha ? (agora >= abre && agora <= fecha) : (agora >= abre || agora <= fecha);
      } catch { return true; }
    };

    if (estabelecimentoInfo.horariosFuncionamento) {
      const config = estabelecimentoInfo.horariosFuncionamento[diaKey];
      if (!config?.ativo) return false;
      return verificar(config.abertura, config.fechamento);
    }
    if (estabelecimentoInfo.horaAbertura && estabelecimentoInfo.horaFechamento) {
      return verificar(estabelecimentoInfo.horaAbertura, estabelecimentoInfo.horaFechamento);
    }
    return true;
  }, [estabelecimentoInfo, currentTime]);

  // Taxas
  const taxaAplicada = useMemo(() => {
    if (isRetirada || premioRaspadinha?.type === 'frete') return 0;
    return taxaEntregaCalculada;
  }, [isRetirada, taxaEntregaCalculada, premioRaspadinha]);

  const finalOrderTotal = useMemo(() => {
    return Math.max(0, subtotalCalculado + taxaAplicada - discountAmount);
  }, [subtotalCalculado, taxaAplicada, discountAmount]);

  // Efeitos
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) { setForceLogin(true); setShowLoginPrompt(true); }
      else { setForceLogin(false); setShowLoginPrompt(false); }
    }
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (!authLoading && currentUser && currentClientData) {
      setNomeCliente(currentClientData.nome || '');
      setTelefoneCliente(currentClientData.telefone || '');
      if (currentClientData.endereco) {
        setRua(currentClientData.endereco.rua || '');
        setNumero(currentClientData.endereco.numero || '');
        setBairro(currentClientData.endereco.bairro || '');
        setCidade(currentClientData.endereco.cidade || '');
        setPontoReferencia(currentClientData.endereco.referencia || '');
      }
    }
  }, [currentUser, currentClientData, authLoading]);

  useEffect(() => {
    if (triggerCheckout && carrinho.length > 0) {
      setTriggerCheckout(false);
      setTimeout(() => {
        scrollToResumo();
        toast.info('👇 Confira seu pedido e finalize aqui!', { autoClose: 4000 });
      }, 200);
    }
  }, [carrinho, triggerCheckout]);

  useEffect(() => {
    let p = [...allProdutos];
    if (searchTerm) p = p.filter(prod => prod.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    setProdutosFiltrados(p);
  }, [allProdutos, searchTerm]);

  useEffect(() => {
    if (estabelecimentoInfo?.valorMinimoRaspadinha) {
      setValorGatilhoRaspadinha(parseFloat(estabelecimentoInfo.valorMinimoRaspadinha));
    } else {
      setValorGatilhoRaspadinha(100);
    }
  }, [estabelecimentoInfo]);

  useEffect(() => {
    if (subtotalCalculado >= valorGatilhoRaspadinha && !jaJogouRaspadinha && !premioRaspadinha) {
      const timer = setTimeout(() => setShowRaspadinha(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [subtotalCalculado, jaJogouRaspadinha, premioRaspadinha, valorGatilhoRaspadinha]);

  useEffect(() => {
    const calcularTaxa = async () => {
      if (!actualEstabelecimentoId || !bairro || isRetirada) { setTaxaEntregaCalculada(0); return; }
      try {
        const taxasSnap = await getDocs(collection(db, 'estabelecimentos', actualEstabelecimentoId, 'taxasDeEntrega'));
        const bairroNorm = normalizarTexto(bairro);
        let taxa = 0;
        taxasSnap.forEach(doc => {
          if (normalizarTexto(doc.data().nomeBairro || '').includes(bairroNorm))
            taxa = Number(doc.data().valorTaxa);
        });
        setTaxaEntregaCalculada(taxa);
      } catch { setTaxaEntregaCalculada(0); }
    };
    const timer = setTimeout(calcularTaxa, 800);
    return () => clearTimeout(timer);
  }, [bairro, actualEstabelecimentoId, isRetirada]);

  // Memos do menu
  const menuAgrupado = useMemo(() =>
    produtosFiltrados.reduce((acc, p) => {
      const cat = p.categoria || 'Outros';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {}),
  [produtosFiltrados]);

  const categoriasOrdenadas = useMemo(() =>
    Object.keys(menuAgrupado).sort((a, b) => {
      if (!ordemCategorias.length) return a.localeCompare(b);
      return ordemCategorias.indexOf(a) - ordemCategorias.indexOf(b);
    }),
  [menuAgrupado, ordemCategorias]);

  // Callbacks
  const scrollToResumo = useCallback(() => {
    const el = document.getElementById('resumo-carrinho');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-4', 'ring-green-400');
      setTimeout(() => el.classList.remove('ring-4', 'ring-green-400'), 1000);
    }
  }, []);

  const handleCategoryClick = (cat) => {
    setSelectedCategory(cat);
    if (cat === 'Todos') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const el = document.getElementById(`categoria-${cat}`);
    if (el) {
      const offsetPosition = el.getBoundingClientRect().top + window.pageYOffset - 180;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const handleAbrirLogin = () => { setIsRegisteringInModal(false); setShowLoginPrompt(true); };

  const enrichWithGlobalAdicionais = useCallback((item) => {
    const termosAdicionais = ['adicionais','adicional','extra','extras','complemento','complementos','acrescimo','acrescimos','molho','molhos','opcoes','opções'];
    const categoriasBloqueadas = ['bomboniere','doce','chocolate','bebida','refrigerante','suco','agua','cerveja','drink','alcool','sobremesa','sorvete','gelado','mercearia','tabacaria','cigarro'];
    const catNorm = normalizarTexto(item.categoria || '');

    if (termosAdicionais.some(t => catNorm.includes(t))) return item;
    if (categoriasBloqueadas.some(b => catNorm.includes(b))) return item;

    const globais = allProdutos.filter(p => termosAdicionais.some(t => normalizarTexto(p.categoria || '').includes(t)));
    const idsExistentes = new Set((item.adicionais || []).map(a => a.id));
    return { ...item, adicionais: [...(item.adicionais || []), ...globais.filter(g => !idsExistentes.has(g.id))] };
  }, [allProdutos]);

  const handleAdicionarRapido = useCallback((item) => {
    if (!isLojaAberta) return toast.error('A loja está fechada no momento!');
    if (!currentUser) { handleAbrirLogin(); return; }
    adicionarItem(item);
    if (item.isBuyNow) setTriggerCheckout(true);
  }, [isLojaAberta, currentUser, adicionarItem]);

  const handleAbrirModalProduto = useCallback((item) => {
    if (!isLojaAberta) return toast.error('A loja está fechada no momento!');
    if (!currentUser) { toast.info('Faça login para continuar.'); handleAbrirLogin(); return; }
    const itemComAdicionais = enrichWithGlobalAdicionais({ ...item, observacao: '' });
    const temOpcoes = itemComAdicionais.variacoes?.length > 0 || itemComAdicionais.adicionais?.length > 0;
    if (temOpcoes) setItemParaVariacoes(itemComAdicionais);
    else handleAdicionarRapido(itemComAdicionais);
  }, [isLojaAberta, currentUser, enrichWithGlobalAdicionais, handleAdicionarRapido]);

  const handleComprarAgora = useCallback((item) => {
    if (!isLojaAberta) return toast.error('A loja está fechada no momento!');
    if (!currentUser) { toast.info('Faça login para continuar.'); handleAbrirLogin(); return; }
    const itemComAdicionais = enrichWithGlobalAdicionais({ ...item, observacao: '', isBuyNow: true });
    const temOpcoes = itemComAdicionais.variacoes?.length > 0 || itemComAdicionais.adicionais?.length > 0;
    if (temOpcoes) setItemParaVariacoes(itemComAdicionais);
    else handleAdicionarRapido(itemComAdicionais);
  }, [isLojaAberta, currentUser, enrichWithGlobalAdicionais, handleAdicionarRapido]);

  const handleConfirmarVariacoes = (itemConfigurado) => {
    adicionarItem({ ...itemConfigurado, precoFinal: Number(itemConfigurado.precoFinal || 0) });
    setItemParaVariacoes(null);
    if (itemConfigurado.isBuyNow) setTriggerCheckout(true);
  };

  const handleLogout = async () => {
    try { await logout(); limparCarrinho(); window.location.reload(); }
    catch (e) { console.error(e); }
  };

  // Auth handlers
  const handleLoginModal = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
      toast.success('Login realizado com sucesso!');
      setShowLoginPrompt(false);
      if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); }
    } catch (error) {
      if (['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].includes(error.code)) {
        toast.error('E-mail ou senha incorretos.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        toast.error('Erro ao entrar: ' + error.message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterModal = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
      const enderecoData = { rua: ruaAuthModal || '', numero: numeroAuthModal || '', bairro: bairroAuthModal || '', cidade: cidadeAuthModal || '', referencia: referenciaAuthModal || '' };
      await setDoc(doc(db, 'usuarios', cred.user.uid), { email: emailAuthModal, nome: nomeAuthModal, telefone: telefoneAuthModal, endereco: enderecoData, isAdmin: false, isMasterAdmin: false, estabelecimentos: [], estabelecimentosGerenciados: [], criadoEm: Timestamp.now() });
      await setDoc(doc(db, 'clientes', cred.user.uid), { nome: nomeAuthModal, telefone: telefoneAuthModal, email: emailAuthModal, endereco: enderecoData, criadoEm: Timestamp.now() });
      toast.success('Conta criada!');
      setShowLoginPrompt(false);
      if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); }
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') toast.error('Este e-mail já está cadastrado.');
      else toast.error('Erro ao criar conta: ' + error.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Cupom
  const handleApplyCoupon = async () => {
    if (!couponCodeInput) return;
    setCouponLoading(true);
    try {
      const q = query(
        collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons'),
        where('codigo', '==', couponCodeInput.trim().toUpperCase()),
        where('ativo', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) { toast.error('Cupom inválido ou expirado.'); return; }

      const cupom = snap.docs[0].data();
      if (cupom.validadeFim.toDate() < new Date()) { toast.error('Este cupom já expirou.'); return; }
      if (cupom.minimoPedido && subtotalCalculado < cupom.minimoPedido) {
        toast.warn(`Valor mínimo: R$ ${cupom.minimoPedido.toFixed(2)}`); return;
      }

      let valorDesc = 0;
      if (cupom.tipoDesconto === 'percentual') valorDesc = (subtotalCalculado * cupom.valorDesconto) / 100;
      else if (cupom.tipoDesconto === 'valorFixo') valorDesc = cupom.valorDesconto;
      else if (cupom.tipoDesconto === 'freteGratis') valorDesc = taxaAplicada;

      setAppliedCoupon(cupom);
      setDiscountAmount(valorDesc);
      toast.success('Cupom aplicado com sucesso!');
    } catch { toast.error('Erro ao validar cupom.'); }
    finally { setCouponLoading(false); }
  };

  const handleRemoveCoupon = () => { setAppliedCoupon(null); setDiscountAmount(0); setCouponCodeInput(''); };

  // Checkout
  const prepararParaPagamento = () => {
    if (!isLojaAberta) return toast.error('A loja está fechada no momento!');
    if (!currentUser) return handleAbrirLogin();
    if (carrinho.length === 0) return toast.warn('Carrinho vazio.');
    if (!nomeCliente.trim()) { toast.error('Preencha seu NOME.'); document.getElementById('input-nome')?.focus(); return; }
    if (!telefoneCliente.trim()) { toast.error('Preencha seu TELEFONE.'); document.getElementById('input-telefone')?.focus(); return; }
    if (!isRetirada && !bairro) { toast.error('Selecione o BAIRRO.'); return; }
    if (!isRetirada && (!rua.trim() || !numero.trim())) { toast.error('Preencha o ENDEREÇO.'); return; }

    const formatarItem = (item) => {
      let nome = item.nome;
      if (item.variacaoSelecionada?.nome) nome += ` - ${item.variacaoSelecionada.nome}`;
      if (item.adicionaisSelecionados?.length > 0) nome += ` (+ ${item.adicionaisSelecionados.map(a => a.nome).join(', ')})`;
      if (item.observacao) nome += ` (Obs: ${item.observacao})`;
      return nome;
    };

    setPedidoParaPagamento({
      vendaId: `ord_${Date.now()}`,
      cliente: { nome: nomeCliente, telefone: telefoneCliente, endereco: isRetirada ? null : { rua, numero, bairro, cidade, complemento, referencia: pontoReferencia }, userId: currentUser.uid },
      estabelecimentoId: actualEstabelecimentoId,
      itens: carrinho.map(item => ({ nome: formatarItem(item), quantidade: item.qtd, preco: Number(item.precoFinal), adicionais: item.adicionaisSelecionados || [], variacao: item.variacaoSelecionada || null, produtoIdOriginal: item.id, categoriaId: item.categoriaId })),
      totalFinal: Number(finalOrderTotal),
      taxaEntrega: Number(taxaAplicada),
      createdAt: serverTimestamp(),
      status: 'aguardando_pagamento'
    });
    setShowPaymentModal(true);
  };

  const handlePagamentoSucesso = async (result) => {
    if (processandoPagamento) return;
    setProcessandoPagamento(true);
    try {
      let formaPagamento = 'A Combinar';
      let trocoPara = '';
      if (result.method === 'pix') formaPagamento = 'pix';
      else if (result.method === 'pix_manual') formaPagamento = 'pix_manual';
      else if (result.method === 'card') formaPagamento = result.details?.type || 'cartao';
      else if (result.method === 'cash') { formaPagamento = 'dinheiro'; trocoPara = result.details?.trocoPara || ''; }

      const pedidoFinal = cleanData({
        ...pedidoParaPagamento,
        status: 'recebido',
        formaPagamento,
        metodoPagamento: formaPagamento,
        trocoPara: Number(trocoPara) || 0,
        desconto: discountAmount,
        totalFinal: finalOrderTotal,
        tipoEntrega: isRetirada ? 'retirada' : 'delivery'
      });

      const idPedido = result.vendaId || pedidoParaPagamento.vendaId;
      await setDoc(doc(db, 'estabelecimentos', actualEstabelecimentoId, 'pedidos', idPedido), pedidoFinal);

      try { await estoqueService.darBaixaEstoque(actualEstabelecimentoId, carrinho); }
      catch (e) { console.warn('Erro estoque:', e); }

      setShowOrderConfirmationModal(true);
      setUltimoPedidoId(idPedido);
      limparCarrinho();
      setShowPaymentModal(false);
      toast.success('Pedido enviado com sucesso!');
      // Pedir permissão para notificações push
      import('../utils/notifications.js').then(({ pedirPermissaoNotificacao }) => pedirPermissaoNotificacao());
    } catch (e) {
      console.error('Erro ao salvar pedido:', e);
      toast.error('Erro ao finalizar pedido. Tente novamente.');
    } finally {
      setProcessandoPagamento(false);
    }
  };

  const handleGanharRaspadinha = (premio) => {
    setShowRaspadinha(false);
    setJaJogouRaspadinha(true);
    setPremioRaspadinha(premio);
    if (premio.type === 'desconto') {
      setDiscountAmount(subtotalCalculado * (premio.valor / 100));
      toast.success(`🎉 Ganhou ${premio.valor}% de desconto!`);
    } else if (premio.type === 'frete') {
      setTaxaEntregaCalculada(0);
      toast.success('🎉 Ganhou Frete Grátis!');
    } else if (premio.type === 'brinde') {
      adicionarBrinde(premio.produto);
      toast.success(`🎉 Ganhou ${premio.produto.nome}!`);
    }
  };

  // Guards
  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" /></div>;
  }

  if (currentUser && (isAdmin || isMasterAdmin)) {
    return (
      <div className="p-10 text-center">
        Acesso Admin. Saia para ver o cardápio.
        <button onClick={handleLogout} className="block mx-auto mt-4 bg-red-600 text-white p-2 rounded">Sair</button>
      </div>
    );
  }

  return (
    <div className="w-full relative min-h-screen text-left" style={{ backgroundColor: coresEstabelecimento.background, color: coresEstabelecimento.texto.principal, paddingBottom: '150px' }}>
      <div className="max-w-7xl mx-auto px-4 w-full">

        <EstablishmentHeader
          estabelecimentoInfo={estabelecimentoInfo}
          coresEstabelecimento={coresEstabelecimento}
          isLojaAberta={isLojaAberta}
          currentTime={currentTime}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <CategoryFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          categorias={categoriasOrdenadas}
          selectedCategory={selectedCategory}
          onCategoryClick={handleCategoryClick}
          coresEstabelecimento={coresEstabelecimento}
        />

        {/* Sugestões Inteligentes */}
        {carrinho.length > 0 && (() => {
          const categoriasNoCarrinho = new Set(carrinho.map(c => (c.categoria || '').toLowerCase()));
          const idsNoCarrinho = new Set(carrinho.map(c => c.id));
          
          // Regras de sugestão por categoria
          const sugestaoMap = {
            'lanches': ['bebidas', 'refrigerante', 'sucos', 'sobremesas', 'porcoes'],
            'hamburgueres': ['bebidas', 'refrigerante', 'acompanhamentos', 'porcoes'],
            'hambúrgueres': ['bebidas', 'refrigerante', 'acompanhamentos', 'porcoes'],
            'pizzas': ['bebidas', 'refrigerante', 'sobremesas'],
            'hot dog': ['bebidas', 'refrigerante', 'porcoes'],
            'esfihas': ['bebidas', 'refrigerante', 'sobremesas'],
            'acai': ['complementos', 'adicionais'],
            'bebidas': ['lanches', 'hamburgueres', 'pizzas', 'porcoes'],
            'porcoes': ['bebidas', 'refrigerante', 'sucos'],
          };
          
          const catsSugeridas = new Set();
          categoriasNoCarrinho.forEach(cat => {
            const norms = Object.entries(sugestaoMap);
            norms.forEach(([key, vals]) => {
              if (cat.includes(key)) vals.forEach(v => catsSugeridas.add(v));
            });
          });
          
          // Se não achou sugestões por regra, sugere as mais populares
          if (catsSugeridas.size === 0) {
            catsSugeridas.add('bebidas');
            catsSugeridas.add('sobremesas');
          }
          
          const sugestoes = allProdutos.filter(p => {
            if (idsNoCarrinho.has(p.id)) return false;
            if (p.ativo === false) return false;
            const catNorm = (p.categoria || '').toLowerCase();
            return [...catsSugeridas].some(s => catNorm.includes(s));
          }).slice(0, 4);
          
          if (sugestoes.length === 0) return null;
          
          return (
            <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
              <h3 className="text-base font-black text-gray-800 mb-3 flex items-center gap-2">
                💡 Vai bem com o que você pediu
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {sugestoes.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAbrirModalProduto(item)}
                    className="bg-white rounded-xl p-3 border border-amber-100 flex items-center gap-3 hover:shadow-md hover:border-amber-200 transition-all text-left active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{item.nome}</p>
                      <p className="text-[10px] font-bold text-emerald-600">
                        R$ {(Number(item.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Produtos */}
        {categoriasOrdenadas.map(cat => {
          const items = menuAgrupado[cat];
          const visible = visibleItemsCount[cat] || 4;
          return (
            <div key={cat} id={`categoria-${cat}`} className="mb-8">
              <h2 className="text-2xl font-bold mb-4">{cat}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {items.slice(0, visible).map(item => (
                  <div key={item.id} className={`bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 p-2 ${!isLojaAberta ? 'opacity-75 grayscale-[0.3]' : ''}`}>
                    <CardapioItem item={item} onAddItem={() => handleAbrirModalProduto(item)} onPurchase={() => handleComprarAgora(item)} coresEstabelecimento={coresEstabelecimento} />
                  </div>
                ))}
              </div>
              {items.length > 4 && (
                <button onClick={() => setVisibleItemsCount(p => ({ ...p, [cat]: visible >= items.length ? 4 : (p[cat] || 4) + 4 }))} className="w-full mt-4 py-2 bg-gray-100 rounded-lg text-gray-500 font-bold">
                  {visible >= items.length ? 'Ver menos' : 'Ver mais'}
                </button>
              )}
            </div>
          );
        })}

        {/* Formulário e carrinho */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 mt-12 pb-24">
          <CustomerForm
            nomeCliente={nomeCliente} setNomeCliente={setNomeCliente}
            telefoneCliente={telefoneCliente} setTelefoneCliente={setTelefoneCliente}
            rua={rua} setRua={setRua}
            numero={numero} setNumero={setNumero}
            bairro={bairro} setBairro={setBairro}
            pontoReferencia={pontoReferencia} setPontoReferencia={setPontoReferencia}
            isRetirada={isRetirada} setIsRetirada={setIsRetirada}
            bairrosDisponiveis={bairrosDisponiveis}
          />
          <CartSection
            carrinho={carrinho}
            subtotalCalculado={subtotalCalculado}
            taxaAplicada={taxaAplicada}
            discountAmount={discountAmount}
            finalOrderTotal={finalOrderTotal}
            isRetirada={isRetirada}
            bairro={bairro}
            bairrosDisponiveis={bairrosDisponiveis}
            isLojaAberta={isLojaAberta}
            couponCodeInput={couponCodeInput} setCouponCodeInput={setCouponCodeInput}
            appliedCoupon={appliedCoupon} couponLoading={couponLoading}
            onApplyCoupon={handleApplyCoupon} onRemoveCoupon={handleRemoveCoupon}
            alterarQuantidade={alterarQuantidade} removerItem={removerItem}
            onCheckout={prepararParaPagamento}
          />
        </div>
      </div>
      {/* Banner de Recuperação de Carrinho */}
      {carrinhoRecuperado && carrinho.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-[200] px-4 animate-slide-up">
          <div className="max-w-lg mx-auto bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 shadow-2xl shadow-orange-300/50">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <p className="font-black text-sm">🛒 Ei, você esqueceu algo!</p>
                <p className="text-[11px] opacity-90">{carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'} no carrinho — R$ {subtotalCalculado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={descartarRecuperacao} className="px-3 py-2 bg-white/20 text-white rounded-xl text-xs font-bold hover:bg-white/30 transition-all">
                  Descartar
                </button>
                <button onClick={() => { setCarrinhoRecuperado?.(false); scrollToResumo(); }} className="px-3 py-2 bg-white text-orange-600 rounded-xl text-xs font-black hover:bg-orange-50 transition-all">
                  Ver Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barra fixa */}
      <CartBar
        carrinho={carrinho}
        finalOrderTotal={finalOrderTotal}
        isWidgetOpen={isWidgetOpen}
        coresEstabelecimento={coresEstabelecimento}
        onScrollToResumo={scrollToResumo}
      />

      {/* Modais lazy */}
      <Suspense fallback={null}>
        {itemParaVariacoes && (
          <VariacoesModal item={itemParaVariacoes} onConfirm={handleConfirmarVariacoes} onClose={() => setItemParaVariacoes(null)} coresEstabelecimento={coresEstabelecimento} />
        )}
        {showPaymentModal && pedidoParaPagamento && (
          <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} amount={finalOrderTotal} orderId={pedidoParaPagamento.vendaId} cartItems={carrinho} onSuccess={handlePagamentoSucesso} coresEstabelecimento={coresEstabelecimento} pixKey={estabelecimentoInfo?.chavePix} establishmentName={estabelecimentoInfo?.nome} estabelecimentoId={actualEstabelecimentoId} hasMercadoPago={!!estabelecimentoInfo?.tokenMercadoPago || !!estabelecimentoInfo?.mercadoPagoAccessToken} />
        )}
        {showRaspadinha && (
          <RaspadinhaModal onGanhar={handleGanharRaspadinha} onClose={() => setShowRaspadinha(false)} config={estabelecimentoInfo?.raspadinhaConfig} />
        )}
        {estabelecimentoInfo && (showAICenter || isWidgetOpen) && (
          <AIChatAssistant estabelecimento={estabelecimentoInfo} produtos={allProdutos} carrinho={carrinho} clienteNome={nomeCliente} taxaEntrega={taxaEntregaCalculada} enderecoAtual={{ rua, numero, bairro, cidade }} isRetirada={isRetirada} onAddDirect={() => 'ADDED'} onCheckout={prepararParaPagamento} onClose={() => setShowAICenter(false)} onRequestLogin={() => { setShowAICenter(false); setDeveReabrirChat(true); handleAbrirLogin(); }} onSetDeliveryMode={(modo) => setIsRetirada(modo === 'retirada')} onUpdateAddress={(dados) => { if (dados.rua) setRua(dados.rua); if (dados.numero) setNumero(dados.numero); if (dados.bairro) setBairro(dados.bairro); if (dados.cidade) setCidade(dados.cidade); if (dados.referencia) setComplemento(dados.referencia); }} />
        )}
        <AIWidgetButton bottomOffset={carrinho.length > 0 ? '100px' : '24px'} />
      </Suspense>

      {/* Modal de confirmação */}
      {showOrderConfirmationModal && (
        <div className="fixed inset-0 bg-black/80 z-[5000] flex items-center justify-center p-4 text-gray-900">
          <div className="bg-white p-8 rounded-2xl text-center shadow-2xl max-w-sm w-full">
            <h2 className="text-3xl font-bold mb-2">🎉 Sucesso!</h2>
            <p className="text-gray-500 text-sm mb-6">Seu pedido foi enviado e está sendo preparado</p>
            <div className="space-y-3">
              <button onClick={() => { setShowOrderConfirmationModal(false); setTimeout(() => setShowReviewModal(true), 500); }} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-600 transition-all">
                ⭐ Avaliar Pedido
              </button>
              <button onClick={() => setShowOrderConfirmationModal(false)} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Auth */}
      <AuthModal
        show={showLoginPrompt}
        forceLogin={forceLogin}
        isRegistering={isRegisteringInModal}
        setIsRegistering={setIsRegisteringInModal}
        loginLoading={loginLoading}
        emailAuthModal={emailAuthModal} setEmailAuthModal={setEmailAuthModal}
        passwordAuthModal={passwordAuthModal} setPasswordAuthModal={setPasswordAuthModal}
        nomeAuthModal={nomeAuthModal} setNomeAuthModal={setNomeAuthModal}
        telefoneAuthModal={telefoneAuthModal} setTelefoneAuthModal={setTelefoneAuthModal}
        ruaAuthModal={ruaAuthModal} setRuaAuthModal={setRuaAuthModal}
        numeroAuthModal={numeroAuthModal} setNumeroAuthModal={setNumeroAuthModal}
        bairroAuthModal={bairroAuthModal} setBairroAuthModal={setBairroAuthModal}
        cidadeAuthModal={cidadeAuthModal} setCidadeAuthModal={setCidadeAuthModal}
        referenciaAuthModal={referenciaAuthModal} setReferenciaAuthModal={setReferenciaAuthModal}
        bairrosDisponiveis={bairrosDisponiveis}
        onLogin={handleLoginModal}
        onRegister={handleRegisterModal}
        onClose={() => setShowLoginPrompt(false)}
      />

      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>

      {/* Review Modal */}
      <Suspense fallback={null}>
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          pedidoId={ultimoPedidoId}
          estabelecimentoId={actualEstabelecimentoId}
          clienteNome={nomeCliente}
          clienteId={currentUser?.uid}
        />
      </Suspense>
    </div>
  );
}