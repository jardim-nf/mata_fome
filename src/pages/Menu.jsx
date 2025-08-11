// src/pages/Menu.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, getDoc as getDocFirestore, setDoc as setDocFirestore, runTransaction, doc, orderBy, onSnapshot } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import AdicionaisModal from '../components/AdicionaisModal';
import { v4 as uuidv4 } from 'uuid'; // Para gerar IDs únicos para itens no carrinho

function Menu() {
  const { estabelecimentoSlug } = useParams();
  const navigate = useNavigate();
  const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin } = useAuth();

  // Seus estados existentes
  const [carrinho, setCarrinho] = useState([]);
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [complemento, setComplemento] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [trocoPara, setTrocoPara] = useState('');
  const [taxasBairro, setTaxasBairro] = useState([]);
  const [taxaEntregaCalculada, setTaxaEntregaCalculada] = useState(0);
  const [bairroNaoEncontrado, setBairroNaoEncontrado] = useState(false);
  const [isRetirada, setIsRetirada] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando Cardápio...");
  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
  const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);
  const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
  const [confirmedOrderDetails, setConfirmedOrderDetails] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isRegisteringInModal, setIsRegisteringInModal] = useState(false);
  const [emailAuthModal, setEmailAuthModal] = useState('');
  const [passwordAuthModal, setPasswordAuthModal] = useState('');
  const [nomeAuthModal, setNomeAuthModal] = useState('');
  const [telefoneAuthModal, setTelefoneAuthModal] = useState('');
  const [ruaAuthModal, setRuaAuthModal] = useState('');
  const [numeroAuthModal, setNumeroAuthModal] = useState('');
  const [bairroAuthModal, setBairroAuthModal] = useState('');
  const [cidadeAuthModal, setCidadeAuthModal] = useState('');
  const [complementoAuthModal, setComplementoAuthModal] = useState('');
  const [errorAuthModal, setErrorAuthModal] = useState('');
  const auth = getAuth(); // Instância do Auth SDK para o modal de login/cadastro
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [availableCategories, setAvailableCategories] = useState([]);
  const [itemParaAdicionais, setItemParaAdicionais] = useState(null);

  // Estado para controlar a quantidade de itens visíveis por categoria (para "Ver mais/menos")
  const [visibleItemsCount, setVisibleItemsCount] = useState({});

  // Cálculos do pedido
  const subtotalCalculado = carrinho.reduce((acc, item) => acc + (item.precoFinal * item.qtd), 0);
  const taxaAplicada = isRetirada ? 0 : taxaEntregaCalculada;
  const totalPedidoComTaxa = subtotalCalculado + taxaAplicada;
  const finalOrderTotal = Math.max(0, totalPedidoComTaxa - discountAmount);

  // Funções para "Ver mais/menos" itens em categorias
  const handleShowMore = (categoryName) => {
    setVisibleItemsCount(prev => ({
      ...prev,
      [categoryName]: (prev[categoryName] || 3) + 3 // Mostra mais 3
    }));
  };

  const handleShowLess = (categoryName) => {
    setVisibleItemsCount(prev => ({
      ...prev,
      [categoryName]: 3 // Volta a mostrar apenas 3
    }));
  };
  
  // Efeito para debounce da busca
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, 300);
    return () => { clearTimeout(handler); };
  }, [searchTerm]);

  // Efeito para controlar o prompt de login/cadastro
  useEffect(() => {
    if (authLoading === false) {
      if (currentUser === null) {
        setShowLoginPrompt(true);
        console.log("Menu Debug: Usuário não logado. Mostrando prompt de login.");
      } else {
        setShowLoginPrompt(false);
        console.log("Menu Debug: Usuário logado. Escondendo prompt de login.");
      }
    }
  }, [authLoading, currentUser]);
  
  // Efeito para preencher dados do cliente logado ou do localStorage
  useEffect(() => {
    if (!authLoading) {
      if (currentUser && currentClientData) {
        console.log("Menu Debug: Preenchendo dados do cliente logado.");
        console.log("Menu Debug: Conteúdo de currentClientData:", currentClientData); // Log para ver o conteúdo
        
        setNomeCliente(currentClientData.nome || '');
        setTelefoneCliente(currentClientData.telefone || '');
        if (currentClientData.endereco) {
          setRua(currentClientData.endereco.rua || '');
          setNumero(currentClientData.endereco.numero || '');
          setBairro(currentClientData.endereco.bairro || '');
          setCidade(currentClientData.endereco.cidade || '');
          setComplemento(currentClientData.endereco.complemento || '');
          setIsRetirada(false);
        } else {
          setIsRetirada(true);
        }
      } else {
        console.log("Menu Debug: Preenchendo dados do cliente do localStorage (não logado ou dados ausentes).");
        const storedNome = localStorage.getItem('nomeCliente') || '';
        const storedTelefone = localStorage.getItem('telefoneCliente') || '';
        const storedRua = localStorage.getItem('rua') || '';
        const storedNumero = localStorage.getItem('numero') || '';
        const storedBairro = localStorage.getItem('bairro') || '';
        const storedCidade = localStorage.getItem('cidade') || '';
        const storedComplemento = localStorage.getItem('complemento') || '';
        setNomeCliente(storedNome);
        setTelefoneCliente(storedTelefone);
        setRua(storedRua);
        setNumero(storedNumero);
        setBairro(storedBairro);
        setCidade(storedCidade);
        setComplemento(storedComplemento);
        if (storedRua && storedNumero && storedBairro && storedCidade) {
          setIsRetirada(false);
        } else {
          setIsRetirada(true);
        }
      }
    }
  }, [currentUser, currentClientData, authLoading]);
  
  // Efeito para carregar taxas de entrega
  useEffect(() => {
    console.log("Menu Debug: Carregando taxas de entrega.");
    const taxasRef = collection(db, 'taxasDeEntrega');
    const q = query(taxasRef, orderBy('nomeBairro'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setTaxasBairro(data);
      console.log("Menu Debug: Taxas de entrega carregadas:", data.length, "bairros.");
    }, (error) => {
      console.error("Menu Debug: Erro ao carregar taxas de entrega:", error);
      toast.error("Erro ao carregar taxas de entrega.");
    });
    return () => unsubscribe();
  }, []);
  
  // Efeito para calcular taxa de entrega
  useEffect(() => {
    console.log("Menu Debug: Calculando taxa de entrega. IsRetirada:", isRetirada, "Bairro:", bairro, "Cidade:", cidade);
    if (isRetirada) {
      setTaxaEntregaCalculada(0);
      setBairroNaoEncontrado(false);
      return;
    }
    if (bairro.trim() === "" || cidade.trim() === "") {
      setTaxaEntregaCalculada(0);
      setBairroNaoEncontrado(false);
      return;
    }
    const bairroEncontrado = taxasBairro.find((taxa) => taxa.nomeBairro.toLowerCase() === bairro.trim().toLowerCase());
    if (bairroEncontrado) {
      setTaxaEntregaCalculada(bairroEncontrado.valorTaxa);
      setBairroNaoEncontrado(false);
      console.log("Menu Debug: Bairro encontrado. Taxa:", bairroEncontrado.valorTaxa);
    } else {
      setTaxaEntregaCalculada(0);
      setBairroNaoEncontrado(true);
      console.log("Menu Debug: Bairro não encontrado na lista de taxas.");
    }
  }, [bairro, cidade, taxasBairro, isRetirada]);
  
  // >>>>> useEffect PRINCIPAL PARA BUSCAR ESTABELECIMENTO E CARDAPIO <<<<<
  useEffect(() => {
    console.log("Menu Debug: [useEffect] Carregando estabelecimento e cardápio. Slug da URL:", estabelecimentoSlug);

    if (!estabelecimentoSlug || estabelecimentoSlug.trim() === '') {
      console.warn("Menu Debug: Slug do estabelecimento vazio ou não fornecido na URL.");
      setNomeEstabelecimento("Nenhum estabelecimento selecionado.");
      setProdutos([]);
      setActualEstabelecimentoId(null);
      return;
    }
    const fetchEstabelecimentoAndCardapio = async () => {
      try {
        const estabelecimentosRef = collection(db, 'estabelecimentos');
        // Consulta o Firestore para encontrar o estabelecimento pelo slug
        const q = query(estabelecimentosRef, where('slug', '==', estabelecimentoSlug));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const estabelecimentoDoc = querySnapshot.docs[0];
          const data = estabelecimentoDoc.data();
          const idDoEstabelecimentoReal = estabelecimentoDoc.id;
          
          console.log("Menu Debug: Estabelecimento encontrado no Firestore:", data.nome, "ID:", idDoEstabelecimentoReal, "Ativo:", data.ativo);

          // Verifica se o estabelecimento está ativo
          if (!data.ativo) { 
            setNomeEstabelecimento("Estabelecimento inativo.");
            toast.error("Estabelecimento está inativo no momento. Por favor, tente mais tarde.");
            setProdutos([]);
            setActualEstabelecimentoId(null);
            return;
          }

          setEstabelecimentoInfo(data);
          setNomeEstabelecimento(data.nome || "Cardápio");
          setActualEstabelecimentoId(idDoEstabelecimentoReal);

          // Buscar itens do cardápio da subcoleção
          const cardapioRef = collection(db, 'estabelecimentos', idDoEstabelecimentoReal, 'cardapio');
          const cardapioSnapshot = await getDocs(cardapioRef);
          
          let produtosDaSubcolecao = cardapioSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log("Menu Debug: Itens do cardápio brutos carregados:", produtosDaSubcolecao.length, "itens.");

          // Processamento de categorias e visibilidade de itens
          const uniqueCategories = new Set(['Todos']);
          const initialVisibleCounts = {};
          produtosDaSubcolecao.forEach(produto => {
            if (produto.categoria) {
              uniqueCategories.add(produto.categoria);
              initialVisibleCounts[produto.categoria] = 3; // Inicializa cada categoria para mostrar 3
            }
          });
          setAvailableCategories(Array.from(uniqueCategories));
          setVisibleItemsCount(initialVisibleCounts); // Define o estado inicial de contagem

          // Aplica filtro de categoria e busca (já existia)
          let produtosFiltrados = produtosDaSubcolecao;
          if (selectedCategory && selectedCategory !== 'Todos') {
            produtosFiltrados = produtosFiltrados.filter(item => item.categoria && item.categoria.toLowerCase() === selectedCategory.toLowerCase());
            console.log("Menu Debug: Produtos filtrados por categoria:", selectedCategory, "-", produtosFiltrados.length, "itens.");
          }
          if (debouncedSearchTerm.trim() !== '') {
            const lowerCaseSearchTerm = debouncedSearchTerm.trim().toLowerCase();
            produtosFiltrados = produtosFiltrados.filter(item => (item.nome && item.nome.toLowerCase().includes(lowerCaseSearchTerm)) || (item.descricao && item.descricao.toLowerCase().includes(lowerCaseSearchTerm)));
            console.log("Menu Debug: Produtos filtrados por busca:", debouncedSearchTerm, "-", produtosFiltrados.length, "itens.");
          }
          
          produtosFiltrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
          setProdutos(produtosFiltrados);
          console.log("Menu Debug: Produtos finais setados. Total:", produtosFiltrados.length);

        } else {
          console.warn("Menu Debug: Estabelecimento não encontrado para o slug:", estabelecimentoSlug);
          setNomeEstabelecimento("Estabelecimento não encontrado.");
          toast.error("Estabelecimento não encontrado. Verifique o link.");
          setProdutos([]);
          setActualEstabelecimentoId(null);
        }
      } catch (error) {
        console.error("Menu Debug: Erro ao carregar estabelecimento ou cardápio:", error);
        setNomeEstabelecimento("Erro ao carregar cardápio.");
        toast.error("Erro ao carregar cardápio. Tente novamente.");
        setProdutos([]);
        setActualEstabelecimentoId(null);
      }
    };
    fetchEstabelecimentoAndCardapio();
  }, [estabelecimentoSlug, selectedCategory, debouncedSearchTerm]);


  useEffect(() => {
    console.log("Menu Debug: Verificando reorderItems do localStorage.");
    const storedReorderItems = localStorage.getItem('reorderItems');
    if (storedReorderItems) {
      try {
        const parsedItems = JSON.parse(storedReorderItems);
        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
          setCarrinho(prevCarrinho => {
            const newCarrinho = [...prevCarrinho];
            parsedItems.forEach(reorderItem => {
              const existing = newCarrinho.find(item => item.id === reorderItem.id);
              if (existing) {
                existing.qtd += reorderItem.qtd;
              } else {
                newCarrinho.push(reorderItem);
              }
            });
            return newCarrinho;
          });
          toast.success('Seu pedido anterior foi carregado no carrinho!');
          console.log("Menu Debug: reorderItems carregados do localStorage.");
        }
      } catch (e) {
        console.error("Menu Debug: Erro ao parsear reorderItems do localStorage:", e);
        toast.error('Erro ao carregar re-pedido do histórico.');
      } finally {
        localStorage.removeItem('reorderItems');
      }
    }
  }, []);
  
  // Funções para adicionar/remover itens do carrinho, aplicar cupom, etc.
  const handleAbrirModalAdicionais = (item) => {
    console.log("Menu Debug: Abrindo modal de adicionais para item:", item.nome);
    if (item.adicionais && Array.isArray(item.adicionais) && item.adicionais.length > 0) {
      setItemParaAdicionais(item);
    } else {
      adicionarItemSimplesAoCarrinho(item);
    }
  };
  const handleFecharModal = () => {
    console.log("Menu Debug: Fechando modal de adicionais.");
    setItemParaAdicionais(null);
  };
  const adicionarItemSimplesAoCarrinho = (item) => {
    console.log("Menu Debug: Adicionando item simples ao carrinho:", item.nome);
    console.log("Menu Debug: Status de currentUser para adicionar ao carrinho:", currentUser ? `Logado (${currentUser.uid})` : "NÃO LOGADO"); 
    
    if (!currentUser) {
        toast.warn('Para adicionar itens, por favor, faça login ou cadastre-se.');
        setShowLoginPrompt(true);
        console.log("Menu Debug: Não há currentUser, interrompendo adição ao carrinho."); 
        return;
    }

    const itemExistente = carrinho.find(p => p.id === item.id && (!p.adicionais || p.adicionais.length === 0));
    console.log("Menu Debug: Item existente no carrinho (se encontrado):", itemExistente); 

    if (itemExistente) {
        setCarrinho(prevCarrinho => { 
            const newCarrinho = prevCarrinho.map(p => 
                p.cartItemId === itemExistente.cartItemId ? { ...p, qtd: p.qtd + 1 } : p
            );
            console.log("Menu Debug: Quantidade de item existente aumentada. Novo carrinho:", newCarrinho); 
            return newCarrinho;
        });
    } else {
        const novoItemNoCarrinho = { ...item, qtd: 1, cartItemId: uuidv4(), precoFinal: item.preco, adicionais: [] };
        setCarrinho(prevCarrinho => { 
            const newCarrinho = [...prevCarrinho, novoItemNoCarrinho];
            console.log("Menu Debug: Novo item adicionado ao carrinho. Novo carrinho:", newCarrinho); 
            return newCarrinho;
        });
    }
    toast.success(`${item.nome} adicionado ao carrinho!`);
    console.log("Menu Debug: Toast de sucesso exibido para adição ao carrinho."); 
  };
  const handleConfirmarAdicionais = (itemConfigurado) => {
    console.log("Menu Debug: Adicionais confirmados para item:", itemConfigurado.nome);
    console.log("Menu Debug: Status de currentUser para confirmar adicionais:", currentUser ? `Logado (${currentUser.uid})` : "NÃO LOGADO"); 

    if (!currentUser) { // Adicionado check de currentUser aqui também
        toast.warn('Para adicionar itens com adicionais, por favor, faça login ou cadastre-se.');
        setShowLoginPrompt(true);
        console.log("Menu Debug: Não há currentUser para confirmar adicionais, interrompendo.");
        return;
    }

    const novoItemNoCarrinho = { ...itemConfigurado, qtd: 1, cartItemId: uuidv4() };
    setCarrinho(prevCarrinho => [...prevCarrinho, novoItemNoCarrinho]);
    toast.success(`${itemConfigurado.nome} foi adicionado ao carrinho!`);
    handleFecharModal();
    console.log("Menu Debug: Item com adicionais adicionado ao carrinho. Novo carrinho:", carrinho); // Note: carrinho aqui pode ser o valor antigo devido ao closure
  };
  const removerDoCarrinho = (cartItemId) => {
    console.log("Menu Debug: Tentando remover item do carrinho com ID:", cartItemId);
    const produtoNoCarrinho = carrinho.find((p) => p.cartItemId === cartItemId);
    if (!produtoNoCarrinho) return;
    if (produtoNoCarrinho.qtd === 1) {
      setCarrinho(carrinho.filter((p) => p.cartItemId !== cartItemId));
      toast.info(`${produtoNoCarrinho.nome} removido do carrinho.`);
    } else {
      setCarrinho(carrinho.map((p) => (p.cartItemId === cartItemId ? { ...p, qtd: p.qtd - 1 } : p)));
      toast.info(`Quantidade de ${produtoNoCarrinho.nome} reduzida.`);
    }
  };
  const handleApplyCoupon = async () => {
    console.log("Menu Debug: Tentando aplicar cupom:", couponCodeInput);
    if (!currentUser) { toast.warn('Você precisa estar logado para aplicar um cupom.'); return; }
    if (!couponCodeInput.trim()) { toast.warn('Por favor, digite o código do cupom.'); return; }
    setCouponLoading(true); setAppliedCoupon(null); setDiscountAmount(0);
    try {
      const couponsRef = collection(db, 'cupons');
      const q = query(couponsRef, where('codigo', '==', couponCodeInput.toUpperCase().trim()));
      const couponSnap = await getDocs(q);
      if (couponSnap.empty) { toast.error('Cupom inválido ou não encontrado.'); setCouponLoading(false); return; }
      const couponDoc = couponSnap.docs[0];
      const couponData = { id: couponDoc.id, ...couponDoc.data() };
      const now = Timestamp.now();
      if (!couponData.ativo) { toast.error('Cupom inativo.'); setCouponLoading(false); return; }
      if (couponData.validadeInicio && couponData.validadeInicio.seconds > now.seconds) { toast.error('Cupom ainda não válido.'); setCouponLoading(false); return; }
      if (couponData.validadeFim && couponData.validadeFim.seconds < now.seconds) { toast.error('Cupom expirado.'); setCouponLoading(false); return; }
      if (couponData.usosMaximos !== null && couponData.usosAtuais >= couponData.usosMaximos) { toast.error('Cupom atingiu o limite máximo de usos.'); setCouponLoading(false); return; }
      if (couponData.minimoPedido !== null && subtotalCalculado < couponData.minimoPedido) { toast.error(`Pedido mínimo de R$ ${couponData.minimoPedido.toFixed(2).replace('.', ',')} para usar este cupom.`); setCouponLoading(false); return; }
      if (couponData.estabelecimentosId && couponData.estabelecimentosId.length > 0 && !couponData.estabelecimentosId.includes(actualEstabelecimentoId)) { toast.error('Este cupom não é válido para este estabelecimento.'); setCouponLoading(false); return; }
      if (couponData.usosPorUsuario !== null) {
        const userCouponUsageRef = doc(db, 'clientes', currentUser.uid, 'couponUsage', couponData.id);
        const userCouponUsageSnap = await getDocFirestore(userCouponUsageRef);
        if (userCouponUsageSnap.exists() && userCouponUsageSnap.data().count >= couponData.usosPorUsuario) { toast.error('Você já usou este cupom o número máximo de vezes.'); setCouponLoading(false); return; }
      }
      let calculatedDiscount = 0;
      if (couponData.tipoDesconto === 'percentual') { calculatedDiscount = subtotalCalculado * (couponData.valorDesconto / 100); }
      else if (couponData.tipoDesconto === 'valorFixo') { calculatedDiscount = couponData.valorDesconto; if (calculatedDiscount > subtotalCalculado) { calculatedDiscount = subtotalCalculado; } }
      else if (couponData.tipoDesconto === 'freteGratis') { calculatedDiscount = taxaAplicada; }
      setAppliedCoupon(couponData); setDiscountAmount(calculatedDiscount);
      toast.success(`Cupom ${couponData.codigo} aplicado! Desconto de R$ ${calculatedDiscount.toFixed(2).replace('.', ',')}.`);
      setCouponLoading(false);
    } catch (error) {
      console.error("Menu Debug: Erro ao aplicar cupom:", error); toast.error('Erro ao aplicar cupom. Tente novamente.');
      setCouponLoading(false); setAppliedCoupon(null); setDiscountAmount(0);
    }
  };
  const removeAppliedCoupon = () => {
    console.log("Menu Debug: Removendo cupom aplicado.");
    setAppliedCoupon(null); setDiscountAmount(0); setCouponCodeInput(''); toast.info('Cupom removido.');
  };
  const enviarPedido = async () => {
    console.log("Menu Debug: Tentando enviar pedido.");
    if (!currentUser) { toast.warn('Você precisa estar logado para enviar um pedido.'); setShowLoginPrompt(true); return; }
    if (!actualEstabelecimentoId) { toast.error('Erro: Estabelecimento não carregado corretamente. Por favor, recarregue a página.'); return; }
    if (!nomeCliente.trim() || !telefoneCliente.trim() || carrinho.length === 0 || !formaPagamento) { toast.warn('Por favor, preencha todos os seus dados (Nome, Telefone), adicione itens ao carrinho e selecione uma forma de pagamento.'); return; }
    if (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())) { toast.warn('Para entrega, por favor, preencha o endereço completo (Rua, Número, Bairro, Cidade).'); return; }
    if (!isRetirada && bairroNaoEncontrado && taxaEntregaCalculada === 0) {
      const confirmacao = window.confirm(`O bairro "${bairro.trim()}" não foi encontrado na nossa lista de áreas de entrega e a taxa é R$ 0,00. Deseja continuar? (Podem ser aplicadas taxas adicionais na entrega)`);
      if (!confirmacao) { return; }
    }
    let valorTrocoPara = null;
    if (formaPagamento === 'dinheiro' && trocoPara.trim() !== '') {
      const trocoNum = Number(trocoPara);
      if (trocoNum > finalOrderTotal) { valorTrocoPara = trocoNum; }
      else { toast.warn(`O valor para troco (R$ ${trocoNum.toFixed(2).replace('.', ',')}) deve ser maior que o total do pedido (R$ ${finalOrderTotal.toFixed(2).replace('.', ',')}).`); return; }
    }
    const pedido = {
      cliente: {
        nome: nomeCliente.trim(),
        telefone: telefoneCliente.trim(),
        endereco: isRetirada ? null : {
          rua: rua.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          complemento: complemento.trim() || null
        },
        userId: currentUser.uid
      },
      estabelecimentoId: actualEstabelecimentoId,
      itens: carrinho.map(item => ({
        nome: item.nome,
        quantidade: item.qtd,
        preco: Number(item.precoFinal),
        imageUrl: item.imageUrl || null,
        adicionais: item.adicionais || []
      })),
      status: 'recebido',
      criadoEm: Timestamp.now(),
      formaPagamento: formaPagamento,
      trocoPara: valorTrocoPara,
      taxaEntrega: taxaAplicada,
      totalFinal: finalOrderTotal,
      tipoEntrega: isRetirada ? 'retirada' : 'delivery',
      ...(formaPagamento === 'pix' && { statusPagamentoPix: 'aguardando_pagamento', }),
      ...(appliedCoupon && { cupomAplicado: { id: appliedCoupon.id, codigo: appliedCoupon.codigo, tipoDesconto: appliedCoupon.tipoDesconto, valorDesconto: appliedCoupon.valorDesconto, descontoCalculado: discountAmount } })
    };
    try {
      if (appliedCoupon) {
        await runTransaction(db, async (transaction) => {
          const couponRef = doc(db, 'cupons', appliedCoupon.id);
          const userCouponUsageRef = doc(db, 'clientes', currentUser.uid, 'couponUsage', appliedCoupon.id);
          const couponSnap = await transaction.get(couponRef);
          const userCouponUsageSnap = await transaction.get(userCouponUsageRef);
          if (!couponSnap.exists()) { throw new Error("Cupom não existe mais!"); }
          const currentUsosAtuais = couponSnap.data().usosAtuais || 0;
          if (couponSnap.data().usosMaximos !== null && currentUsosAtuais >= couponSnap.data().usosMaximos) { throw new Error("Cupom já atingiu o limite total de usos."); }
          let currentUserUses = 0;
          if (appliedCoupon.usosPorUsuario !== null) {
            if (userCouponUsageSnap.exists()) { currentUserUses = userCouponUsageSnap.data().count || 0; }
            if (currentUserUses >= appliedCoupon.usosPorUsuario) { throw new Error("Você já usou este cupom o número máximo de vezes."); }
          }
          transaction.update(couponRef, { usosAtuais: currentUsosAtuais + 1 });
          if (appliedCoupon.usosPorUsuario !== null) { transaction.set(userCouponUsageRef, { count: currentUserUses + 1 }, { merge: true }); }
        });
      }
      const docRef = await addDoc(collection(db, 'pedidos'), pedido);
      setConfirmedOrderDetails({
        id: docRef.id, cliente: pedido.cliente, itens: pedido.itens, subtotal: subtotalCalculado, taxaEntrega: taxaAplicada, totalFinal: finalOrderTotal, formaPagamento: formaPagamento, trocoPara: valorTrocoPara, tipoEntrega: pedido.tipoEntrega, cupomAplicado: appliedCoupon ? { codigo: appliedCoupon.codigo, desconto: discountAmount } : null
      });
      setShowOrderConfirmationModal(true);
      toast.success('Seu pedido foi enviado com sucesso! 🎉');
      setCarrinho([]); setFormaPagamento(''); setTrocoPara(''); setTaxaEntregaCalculada(0); setBairroNaoEncontrado(false); setCouponCodeInput(''); setAppliedCoupon(null); setDiscountAmount(0);
    } catch (error) {
      console.error("Menu Debug: Erro ao enviar pedido ou aplicar cupom (transação): ", error);
      if (error.message && (error.message.includes("limite total de usos") || error.message.includes("máximo de vezes") || error.message.includes("Cupom não existe mais"))) { toast.error(`❌ Erro no cupom: ${error.message}`); }
      else { toast.error(`❌ Ocorreu um erro ao enviar seu pedido. Por favor, tente novamente.`); }
    }
  };
  const handleLoginModal = async (e) => {
    console.log("Menu Debug: Tentando login via modal.");
    e.preventDefault(); setErrorAuthModal('');
    try {
      await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
      toast.success('Login realizado com sucesso!');
      setShowLoginPrompt(false); setIsRegisteringInModal(false); setEmailAuthModal(''); setPasswordAuthModal(''); setErrorAuthModal(''); setNomeAuthModal(''); setTelefoneAuthModal(''); setRuaAuthModal(''); setNumeroAuthModal(''); setBairroAuthModal(''); setCidadeAuthModal(''); setComplementoAuthModal('');
    } catch (error) {
      let msg = "Erro no login. Verifique suas credenciais.";
      if (error.code === 'auth/user-not-found') msg = "Usuário não encontrado. Crie uma conta.";
      else if (error.code === 'auth/wrong-password') msg = "Senha incorreta.";
      else if (error.code === 'auth/invalid-email') msg = "Email inválido.";
      setErrorAuthModal(msg); toast.error(msg); console.error("Menu Debug: Login error:", error);
    }
  };
  const handleRegisterModal = async (e) => {
    console.log("Menu Debug: Tentando cadastro via modal.");
    e.preventDefault(); setErrorAuthModal('');
    if (!nomeAuthModal.trim() || !telefoneAuthModal.trim() || !emailAuthModal.trim() || !passwordAuthModal.trim() || !ruaAuthModal.trim() || !numeroAuthModal.trim() || !bairroAuthModal.trim() || !cidadeAuthModal.trim()) {
      setErrorAuthModal('Por favor, preencha todos os campos obrigatórios, incluindo o endereço completo.');
      toast.error('Por favor, preencha todos os campos obrigatórios, incluindo o endereço completo.'); return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
      const user = userCredential.user;
      await setDocFirestore(doc(db, 'clientes', user.uid), {
        nome: nomeAuthModal.trim(), telefone: telefoneAuthModal.trim(), email: emailAuthModal.trim(),
        endereco: {
          rua: ruaAuthModal.trim(), numero: numeroAuthModal.trim(), bairro: bairroAuthModal.trim(), cidade: cidadeAuthModal.trim(), complemento: complementoAuthModal.trim() || null
        },
        criadoEm: Timestamp.now(),
      });
      toast.success('Cadastro realizado com sucesso! Você está logado.');
      setShowLoginPrompt(false); setIsRegisteringInModal(false); setEmailAuthModal(''); setPasswordAuthModal(''); setNomeAuthModal(''); setTelefoneAuthModal(''); setRuaAuthModal(''); setNumeroAuthModal(''); setBairroAuthModal(''); setCidadeAuthModal(''); setComplementoAuthModal(''); setErrorAuthModal('');
    } catch (error) {
      let msg = "Erro no cadastro. Tente novamente.";
      if (error.code === 'auth/email-already-in-use') msg = "Este email já está cadastrado.";
      else if (error.code === 'auth/weak-password') msg = "Senha muito fraca (mín. 6 caracteres).";
      setErrorAuthModal(msg); toast.error(msg); console.error("Menu Debug: Registration error:", error);
    }
  };
  
  if (authLoading) {
    console.log("Menu Debug: authLoading TRUE, mostrando mensagem de verificação de login.");
    return (<div className="flex justify-center items-center h-screen bg-black"> <p className="text-[var(--marrom-escuro)]">Verificando status de login...</p> </div>);
  }
  if (isAdmin || isMasterAdmin) {
    console.log("Menu Debug: Usuário é admin ou master admin. Redirecionando da página de cardápio.");
    useEffect(() => {
      toast.error('Acesso negado. Esta página é exclusiva para clientes. Redirecionando...');
      const timer = setTimeout(() => {
        if (isMasterAdmin) { navigate('/master-dashboard'); }
        else if (isAdmin) { navigate('/painel'); }
        else { navigate('/'); }
      }, 1500);
      return () => clearTimeout(timer);
    }, [isAdmin, isMasterAdmin, navigate]);
    return (<div className="flex justify-center items-center h-screen bg-gray-100"> <div className="text-center p-8 bg-white rounded-lg shadow-md"> <h2 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h2> <p className="text-gray-700">Esta área é exclusiva para clientes. Você será redirecionado.</p> </div> </div>);
  }

  console.log("Menu Debug: [RENDER] - Renderizando componente Menu. Nome Estabelecimento:", nomeEstabelecimento, "Actual Estabelecimento ID:", actualEstabelecimentoId);

  return (
    <div className="p-4 max-w-3xl mx-auto pb-48 md:pb-0">
      <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-4">
        Cardápio de {nomeEstabelecimento}
      </h1>
      {estabelecimentoInfo && estabelecimentoInfo.descricao && (
        <p className="text-center text-[var(--cinza-texto)] mb-8">{estabelecimentoInfo.descricao}</p>
      )}

      <div className="mb-8 p-4 bg-white rounded-lg shadow-md border border-gray-200">
        <div className="mb-4">
          <label htmlFor="search" className="sr-only">Buscar no Cardápio</label>
          <input type="text" id="search" placeholder="Buscar por nome ou descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {availableCategories.map((category) => (<button key={category} onClick={() => setSelectedCategory(category)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${selectedCategory === category ? 'bg-[var(--vermelho-principal)] text-black' : 'bg-gray-200 text-[var(--marrom-escuro)] hover:bg-gray-300'}`} > {category} </button>))}
          {(searchTerm !== '' || selectedCategory !== 'Todos') && (<button onClick={() => { setSearchTerm(''); setSelectedCategory('Todos'); }} className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-400 text-black hover:bg-gray-500 transition-colors duration-200" > Limpar Filtros </button>)}
        </div>
      </div>

      {(() => {
        const menuAgrupado = produtos.reduce((acc, produto) => { const categoria = produto.categoria || 'Outros'; if (!acc[categoria]) { acc[categoria] = []; } acc[categoria].push(produto); return acc; }, {});
        const categorias = Object.keys(menuAgrupado);
        if (produtos.length === 0 && nomeEstabelecimento === "Carregando Cardápio...") { return <p className="text-center text-[var(--marrom-escuro)] italic mt-8">Carregando cardápio...</p>; }
        if (categorias.length === 0) { return <p className="text-center text-gray-500 italic mt-8">Nenhum item disponível com os filtros selecionados.</p>; }
        
        return categorias.map(categoria => {
          const itemsNestaCategoria = menuAgrupado[categoria];
          const totalItemsVisiveis = visibleItemsCount[categoria] || 3;
          const todosItensVisiveis = totalItemsVisiveis >= itemsNestaCategoria.length;

          return (
            <div key={categoria} className="mt-8">
              <h2 className="text-2xl font-bold mb-4 text-[var(--marrom-escuro)] border-b-2 border-[var(--vermelho-principal)] pb-2">{categoria}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {itemsNestaCategoria.slice(0, totalItemsVisiveis).map((item) => (
                  <CardapioItem
                    key={item.id}
                    item={item}
                    // Certifique-se que cartItem realmente reflete o item no carrinho
                    cartItem={carrinho.find(p => p.id === item.id && 
                      JSON.stringify(p.adicionais || []) === JSON.stringify(item.adicionais || [])
                    )} 
                    onAddItem={handleAbrirModalAdicionais}
                    removeFromCart={removerDoCarrinho}
                  />
                ))}
              </div>
              {itemsNestaCategoria.length > 3 && (
                <div className="text-center mt-6">
                  {todosItensVisiveis ? (
                    <button
                      onClick={() => handleShowLess(categoria)}
                      className="bg-gray-200 hover:bg-gray-300 text-[var(--marrom-escuro)] font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
                    >
                      Ver menos
                    </button>
                  ) : (
                    <button
                        onClick={() => handleShowMore(categoria)}
                        className="border-2 border-[var(--vermelho-principal)] text-[var(--vermelho-principal)] font-semibold py-2 px-6 rounded-lg hover:bg-[var(--vermelho-principal)] hover:text-white transition-colors duration-300"
                    >
                        Ver mais
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        });
      })()}

      {/* O restante do seu JSX para carrinho, formulários e modais permanece igual */}
      <div className="bg-white p-6 mt-10 rounded-lg shadow-xl border border-gray-200">
        <h2 className="font-bold text-2xl mb-4 text-[var(--marrom-escuro)]">Seu Pedido</h2>
        {carrinho.length === 0 ? ( <p className="text-gray-500 italic text-center py-4">🛒 Nenhum item adicionado ainda. Comece a escolher!</p> ) : ( <> <ul className="mb-4 space-y-3"> {carrinho.map((item) => ( <li key={item.cartItemId} className="bg-gray-50 p-3 rounded-md border border-gray-100"> <div className="flex justify-between items-start"> <div className="flex-1 mr-2"> <span className="font-medium text-[var(--cinza-texto)]"> {item.nome} <span className="text-sm text-gray-500">({item.qtd}x)</span> </span> {item.adicionais && item.adicionais.length > 0 && ( <div className="text-xs text-gray-500 pl-2 mt-1"> {item.adicionais.map(ad => `+ ${ad.nome}`).join(', ')} </div> )} </div> <div className="flex items-center gap-3"> <button onClick={() => removerDoCarrinho(item.cartItemId)} className="bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" aria-label={`Remover um ${item.nome}`}>-</button> <span className="font-semibold text-[var(--marrom-escuro)]">R$ {(item.precoFinal * item.qtd).toFixed(2).replace('.', ',')}</span> <button onClick={() => adicionarItemSimplesAoCarrinho(item)} className="bg-green-500 hover:bg-green-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" aria-label={`Adicionar mais um ${item.nome}`} disabled={!item.ativo}>+</button> </div> </div> </li> ))} </ul> <div className="border-t border-gray-200 pt-4 mt-4 text-[var(--marrom-escuro)]"> <div className="flex justify-between items-center text-lg mb-1"><span>Subtotal:</span><span>R$ {subtotalCalculado.toFixed(2).replace('.', ',')}</span></div> {!isRetirada && taxaEntregaCalculada > 0 && (<div className="flex justify-between items-center text-lg mb-2"><span>Taxa de Entrega ({bairro.trim() || 'Não Informado'}):</span><span>R$ {taxaEntregaCalculada.toFixed(2).replace('.', ',')}</span></div>)} {!isRetirada && bairroNaoEncontrado && taxaEntregaCalculada === 0 && (<p className="text-sm text-orange-600 mb-2">Atenção: O bairro digitado não foi encontrado na lista de taxas. Taxa de entrega pode ser reavaliada.</p>)} <div className="mt-4 pt-4 border-t border-gray-200"> {!appliedCoupon ? (<div className="flex items-center gap-2"> <input type="text" placeholder="Código do Cupom" value={couponCodeInput} onChange={(e) => setCouponCodeInput(e.target.value)} className="flex-1 border border-gray-300 rounded-md px-3 py-2" disabled={couponLoading} /> <button onClick={handleApplyCoupon} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-semibold" disabled={couponLoading || !couponCodeInput.trim()} > {couponLoading ? 'Aplicando...' : 'Aplicar'} </button> </div>) : (<div className="flex justify-between items-center bg-green-50 p-2 rounded-md"> <p className="text-green-800 font-semibold">Cupom Aplicado: {appliedCoupon.codigo}</p> <button onClick={removeAppliedCoupon} className="text-red-600 hover:underline text-sm" > Remover </button> </div>)} {discountAmount > 0 && appliedCoupon?.tipoDesconto !== 'freteGratis' && (<div className="flex justify-between items-center text-lg mt-2 text-green-700"><span>Desconto:</span><span>- R$ {discountAmount.toFixed(2).replace('.', ',')}</span></div>)} {discountAmount > 0 && appliedCoupon?.tipoDesconto === 'freteGratis' && (<div className="flex justify-between items-center text-lg mt-2 text-green-700"><span>Frete Grátis:</span><span>- R$ {discountAmount.toFixed(2).replace('.', ',')}</span></div>)} </div> <div className="flex justify-between items-center text-2xl font-bold mt-4"><span>TOTAL:</span><span>R$ {finalOrderTotal.toFixed(2).replace('.', ',')}</span></div> </div> </> )} </div>
      <div className="bg-white p-6 mt-6 rounded-lg shadow-xl border border-gray-200"> {/* Div principal de "Seus Dados" */}
        <h3 className="font-bold text-xl mb-3 text-[var(--marrom-escuro)]">Seus Dados</h3>
        <div className="mb-4">
          <label htmlFor="nomeCliente" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Seu Nome *</label>
          <input
            id="nomeCliente"
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
            placeholder="Ex: Ana Silva"
            required
          />
        </div>
        <div className="mb-6">
          <label htmlFor="telefoneCliente" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Seu Telefone (com DDD) *</label>
          <input
            id="telefoneCliente"
            value={telefoneCliente}
            onChange={(e) => setTelefoneCliente(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
            placeholder="Ex: 22999999999"
            type="tel"
            required
          />
        </div>
        <div className="mb-6 pt-4 border-t border-gray-200">
          <h3 className="font-bold text-xl mb-3 text-[var(--marrom-escuro)]">Tipo de Entrega *</h3>
          <div className="space-y-3">
            <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
              <input type="radio" name="deliveryType" value="retirada" checked={isRetirada === true} onChange={() => setIsRetirada(true)} className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]" /> Retirada no Estabelecimento
            </label>
            <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer"> {/* Corrigido: 'cinho' para 'cinza' */}
              <input type="radio" name="deliveryType" value="entrega" checked={isRetirada === false} onChange={() => setIsRetirada(false)} className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]" /> Entrega no meu Endereço
            </label>
          </div> {/* Fecha div.space-y-3 */}
        </div> {/* Fecha div.mb-6 pt-4 border-t */}
        {!isRetirada && (
          <>
            <div className="mb-4">
              <label htmlFor="rua" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Rua *</label>
              <input id="rua" value={rua} onChange={(e) => setRua(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="Ex: Rua das Flores" required={!isRetirada} readOnly={!!currentUser && currentClientData?.endereco?.rua} />
            </div>
            <div className="mb-4 flex gap-4">
              <div className="flex-1">
                <label htmlFor="numero" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Número *</label>
                <input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="Ex: 123" required={!isRetirada} readOnly={!!currentUser && currentClientData?.endereco?.numero} />
              </div>
              <div className="flex-1">
                <label htmlFor="bairro" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Bairro *</label>
                <input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="Ex: Centro" required={!isRetirada} readOnly={!!currentUser && currentClientData?.endereco?.bairro} />
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="cidade" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Cidade *</label>
              <input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="Ex: Rio de Janeiro" required={!isRetirada} readOnly={!!currentUser && currentClientData?.endereco?.cidade} />
            </div>
            <div className="mb-6">
              <label htmlFor="complemento" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Complemento / Ponto de Referência</label>
              <input id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="Ex: Apt 101, Próximo à praça" readOnly={!!currentUser && currentClientData?.endereco?.complemento} />
            </div>
          </>
        )}
        <div className="pt-6 mt-6 border-t border-gray-200">
          <h3 className="font-bold text-xl mb-3 text-[var(--marrom-escuro)]">Forma de Pagamento *</h3>
          <div className="space-y-3">
            <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
              <input type="radio" name="paymentMethod" value="pix" checked={formaPagamento === 'pix'} onChange={(e) => setFormaPagamento(e.target.value)} className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]" /> PIX
            </label>
            <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
              <input type="radio" name="paymentMethod" value="cartao" checked={formaPagamento === 'cartao'} onChange={(e) => setFormaPagamento(e.target.value)} className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]" /> Cartão (Crédito/Débito na entrega)
            </label>
            <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
              <input type="radio" name="paymentMethod" value="dinheiro" checked={formaPagamento === 'dinheiro'} onChange={(e) => setFormaPagamento(e.target.value)} className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]" /> Dinheiro
            </label>
          </div>
          {formaPagamento === 'dinheiro' && (<div className="mt-4"> <label htmlFor="troco" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1"> Precisa de troco para? (Opcional) </label> <input id="troco" type="number" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder={`Ex: R$ ${(finalOrderTotal + 10).toFixed(2).replace('.', ',')}`} /> </div>)}
        </div>
      </div> {/* FECHA div principal de "Seus Dados" (linha 645) */}
      {carrinho.length > 0 && ( <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 p-4 shadow-lg z-50 md:relative md:p-0 md:mt-8 md:border-none md:shadow-none"> <button onClick={enviarPedido} className={`px-6 py-3 rounded-lg transition duration-300 ease-in-out w-full text-lg font-semibold shadow-lg ${(!nomeCliente.trim() || !telefoneCliente.trim() || (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())) || carrinho.length === 0 || !formaPagamento || !currentUser) ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`} disabled={!nomeCliente.trim() || !telefoneCliente.trim() || (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())) || carrinho.length === 0 || !formaPagamento || !currentUser} > Enviar Pedido Agora! </button> </div> )}
      {showOrderConfirmationModal && confirmedOrderDetails && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]"> <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full relative"> <h2 className="text-2xl font-bold text-[var(--vermelho-principal)] mb-4 text-center">Pedido Enviado! 🎉</h2> <p className="text-gray-700 text-center mb-6"> Seu pedido foi registrado com sucesso! O estabelecimento está processando sua solicitação. Você receberá atualizações em breve. </p> <div className="mb-6 border-t border-b border-gray-200 py-4"> <p className="font-semibold text-lg text-[var(--marrom-escuro)] mb-2">Resumo do Pedido:</p> <p><strong>ID do Pedido:</strong> {confirmedOrderDetails.id.substring(0, 8)}...</p> <p><strong>Total:</strong> R$ {confirmedOrderDetails.totalFinal.toFixed(2).replace('.', ',')}</p> <p><strong>Pagamento:</strong> {confirmedOrderDetails.formaPagamento.charAt(0).toUpperCase() + confirmedOrderDetails.formaPagamento.slice(1)}</p> <p><strong>Entrega:</strong> {confirmedOrderDetails.tipoEntrega === 'retirada' ? 'Retirada' : 'Delivery'}</p> {confirmedOrderDetails.cupomAplicado && (<p className="text-green-700"><strong>Cupom:</strong> {confirmedOrderDetails.cupomAplicado.codigo} (- R$ {confirmedOrderDetails.cupomAplicado.desconto.toFixed(2).replace('.', ',')})</p>)} </div> <button onClick={() => { setShowOrderConfirmationModal(false); navigate(`/cardapio/${estabelecimentoSlug}`); }} className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition duration-300 ease-in-out w-full text-lg font-semibold" > Pedido Concluído! Voltar ao Cardápio </button> </div> </div>)}
      {showLoginPrompt && (<div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[1000]"> <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full relative text-center"> <button onClick={() => { setShowLoginPrompt(false); setErrorAuthModal(''); setEmailAuthModal(''); setPasswordAuthModal(''); setNomeAuthModal(''); setTelefoneAuthModal(''); setRuaAuthModal(''); setNumeroAuthModal(''); setBairroAuthModal(''); setCidadeAuthModal(''); setComplementoAuthModal(''); setIsRegisteringInModal(false); }} className="absolute top-2 right-3 text-gray-600 hover:text-red-600 text-xl" aria-label="Fechar" > &times; </button> <h2 className="text-2xl font-bold text-[var(--vermelho-principal)] mb-4">{isRegisteringInModal ? 'Cadastre-se' : 'Faça Login'}</h2> <p className="text-gray-700 mb-6">{isRegisteringInModal ? 'Preencha seus dados para criar uma conta.' : 'Para acessar o cardápio e fazer pedidos, você precisa estar logado.'}</p> {errorAuthModal && <p className="text-red-500 text-sm mb-4">{errorAuthModal}</p>} {isRegisteringInModal ? (<form onSubmit={handleRegisterModal} className="space-y-4"> <input type="text" placeholder="Seu Nome Completo" className="w-full border rounded p-2" value={nomeAuthModal} onChange={(e) => setNomeAuthModal(e.target.value)} required /> <input type="tel" placeholder="Seu Telefone (com DDD)" className="w-full border rounded p-2" value={telefoneAuthModal} onChange={(e) => setTelefoneAuthModal(e.target.value)} required /> <input type="email" placeholder="Email" className="w-full border rounded p-2" value={emailAuthModal} onChange={(e) => setEmailAuthModal(e.target.value)} required /> <input type="password" placeholder="Senha (mín. 6 caracteres)" className="w-full border rounded p-2" value={passwordAuthModal} onChange={(e) => setPasswordAuthModal(e.target.value)} required /> <input type="text" placeholder="Rua *" className="w-full border rounded p-2" value={ruaAuthModal} onChange={(e) => setRuaAuthModal(e.target.value)} required /> <input type="text" placeholder="Número *" className="w-full border rounded p-2" value={numeroAuthModal} onChange={(e) => setNumeroAuthModal(e.target.value)} required /> <input type="text" placeholder="Bairro *" className="w-full border rounded p-2" value={bairroAuthModal} onChange={(e) => setBairroAuthModal(e.target.value)} required /> <input type="text" placeholder="Cidade *" className="w-full border rounded p-2" value={cidadeAuthModal} onChange={(e) => setCidadeAuthModal(e.target.value)} required /> <input type="text" placeholder="Complemento (Opcional)" className="w-full border rounded p-2" value={complementoAuthModal} onChange={(e) => setComplementoAuthModal(e.target.value)} /> <button type="submit" className="w-full bg-[var(--vermelho-principal)] text-black py-2 rounded hover:bg-red-700">Cadastrar e Entrar</button> <p className="text-sm text-gray-600">Já tem uma conta?{' '}<button type="button" onClick={() => setIsRegisteringInModal(false)} className="text-[var(--vermelho-principal)] underline">Fazer Login</button></p> </form>) : (<form onSubmit={handleLoginModal} className="space-y-4"> <input type="email" placeholder="Email" className="w-full border rounded p-2" value={emailAuthModal} onChange={(e) => setEmailAuthModal(e.target.value)} required /> <input type="password" placeholder="Senha" className="w-full border rounded p-2" value={passwordAuthModal} onChange={(e) => setPasswordAuthModal(e.target.value)} required /> <button type="submit" className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-700">Entrar</button> <p className="text-sm text-gray-600">Não tem uma conta?{' '}<button type="button" onClick={() => setIsRegisteringInModal(true)} className="text-[var(--vermelho-principal)] underline">Cadastre-se</button></p> </form>)} </div> </div>)}
      {itemParaAdicionais && (
        <AdicionaisModal
          item={itemParaAdicionais}
          onConfirm={handleConfirmarAdicionais}
          onClose={handleFecharModal}
        />
      )}
    </div>
  );
}

export default Menu;