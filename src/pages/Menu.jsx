// src/pages/Menu.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, addDoc, Timestamp, query, onSnapshot, orderBy } from 'firebase/firestore';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';

function Menu() {
  const { estabelecimentoId } = useParams();
  const navigate = useNavigate();
  const { currentUser, currentClientData, loading: authLoading } = useAuth();

  const [carrinho, setCarrinho] = useState([]);
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState(''); // Corrigido

  const [formaPagamento, setFormaPagamento] = useState('');
  const [trocoPara, setTrocoPara] = useState('');

  const [taxasBairro, setTaxasBairro] = useState([]);
  const [taxaEntregaCalculada, setTaxaEntregaCalculada] = useState(0);
  const [bairroNaoEncontrado, setBairroNaoEncontrado] = useState(false);

  // ESTADO: Para controlar o tipo de entrega (true para retirada, false para delivery)
  const [isRetirada, setIsRetirada] = useState(false); 

  const [produtos, setProdutos] = useState([]);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando Cardápio...");
  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);

  // NOVOS ESTADOS PARA O MODAL DE CONFIRMAÇÃO
  const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
  // Mantemos confirmedOrderDetails para exibir o resumo no modal
  const [confirmedOrderDetails, setConfirmedOrderDetails] = useState(null);


  // Efeito para carregar dados do cliente (logado ou localStorage)
  useEffect(() => {
    if (!authLoading) {
      if (currentUser && currentClientData) {
        setNomeCliente(currentClientData.nome || '');
        setTelefoneCliente(currentClientData.telefone || '');

        if (currentClientData.endereco) {
          setRua(currentClientData.endereco.rua || '');
          setNumero(currentClientData.endereco.numero || '');
          setBairro(currentClientData.endereco.bairro || '');
          setComplemento(currentClientData.endereco.complemento || '');
          setIsRetirada(false); // Se o usuário tem endereço, assume-se entrega
        } else {
          setIsRetirada(true); // Se não tem endereço, sugere retirada
        }
      } else {
        // Para usuários não logados, tenta carregar do localStorage
        const storedRua = localStorage.getItem('rua') || '';
        const storedNumero = localStorage.getItem('numero') || '';
        const storedBairro = localStorage.getItem('bairro') || '';

        setNomeCliente(localStorage.getItem('nomeCliente') || '');
        setTelefoneCliente(localStorage.getItem('telefoneCliente') || '');
        setRua(storedRua);
        setNumero(storedNumero);
        setBairro(storedBairro);
        setComplemento(localStorage.getItem('complemento') || '');

        // Se houver dados de endereço no localStorage, assume-se entrega
        if (storedRua && storedNumero && storedBairro) {
          setIsRetirada(false);
        } else {
          setIsRetirada(true); // Caso contrário, sugere retirada
        }
      }
    }
  }, [currentUser, currentClientData, authLoading]);

  // Efeito para carregar taxas de entrega
  useEffect(() => {
    const taxasRef = collection(db, 'taxasDeEntrega');
    const q = query(taxasRef, orderBy('nomeBairro'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setTaxasBairro(data);
    }, (error) => {
      console.error("Erro ao carregar taxas de entrega:", error);
    });

    return () => unsubscribe();
  }, []);

  // Efeito para calcular a taxa de entrega baseada no bairro OU se é retirada
  useEffect(() => {
    if (isRetirada) { // Se for retirada, a taxa é zero
      setTaxaEntregaCalculada(0);
      setBairroNaoEncontrado(false); // Reseta esta flag
      return;
    }

    if (bairro.trim() === "") {
      setTaxaEntregaCalculada(0);
      setBairroNaoEncontrado(false);
      return;
    }

    const bairroEncontrado = taxasBairro.find(
      (taxa) => taxa.nomeBairro.toLowerCase() === bairro.trim().toLowerCase()
    );

    if (bairroEncontrado) {
      setTaxaEntregaCalculada(bairroEncontrado.valorTaxa);
      setBairroNaoEncontrado(false);
    } else {
      setTaxaEntregaCalculada(0);
      setBairroNaoEncontrado(true);
    }
  }, [bairro, taxasBairro, isRetirada]); // Adicionado isRetirada como dependência

  // Efeito para carregar informações do estabelecimento e cardápio
  useEffect(() => {
    if (!estabelecimentoId) {
      setNomeEstabelecimento("Nenhum estabelecimento selecionado.");
      return;
    }

    let unsubscribeCardapio;

    const fetchEstabelecimentoAndCardapio = async () => {
      try {
        const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
        const estabelecimentoSnap = await getDoc(estabelecimentoRef);

        if (estabelecimentoSnap.exists()) {
          const data = estabelecimentoSnap.data();
          setEstabelecimentoInfo(data);
          setNomeEstabelecimento(data.nome || "Cardápio");

          const cardapioRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
          const q = query(cardapioRef, orderBy('nome'));

          unsubscribeCardapio = onSnapshot(q, (snapshot) => {
            const produtosData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setProdutos(produtosData);
          });

        } else {
          setNomeEstabelecimento("Estabelecimento não encontrado.");
          setProdutos([]);
        }
      } catch (error) {
        console.error("Erro ao carregar cardápio:", error);
        setNomeEstabelecimento("Erro ao carregar cardápio.");
        setProdutos([]);
      }
    };

    fetchEstabelecimentoAndCardapio();

    return () => {
      if (unsubscribeCardapio) {
        unsubscribeCardapio();
      }
    };
  }, [estabelecimentoId]);

  const adicionarAoCarrinho = (item) => {
    const existe = carrinho.find((p) => p.id === item.id);
    if (existe) {
      setCarrinho(carrinho.map((p) => (p.id === item.id ? { ...p, qtd: p.qtd + 1 } : p)));
    } else {
      setCarrinho([...carrinho, { ...item, qtd: 1 }]);
    }
  };

  const removerDoCarrinho = (id) => {
    const produtoNoCarrinho = carrinho.find((p) => p.id === id);
    if (!produtoNoCarrinho) return;

    if (produtoNoCarrinho.qtd === 1) {
      setCarrinho(carrinho.filter((p) => p.id !== id));
    } else {
      setCarrinho(carrinho.map((p) => (p.id === id ? { ...p, qtd: p.qtd - 1 } : p)));
    }
  };

  const enviarPedido = async () => {
    const subtotalCalculado = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    const taxaAplicada = isRetirada ? 0 : taxaEntregaCalculada;
    const totalComTaxaCalculado = subtotalCalculado + taxaAplicada;

    // Validações
    if (
      !nomeCliente.trim() ||
      !telefoneCliente.trim() ||
      carrinho.length === 0 ||
      !formaPagamento
    ) {
      alert('Por favor, preencha todos os seus dados (Nome, Telefone), adicione itens ao carrinho e selecione uma forma de pagamento.');
      return;
    }

    if (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim())) {
      alert('Para entrega, por favor, preencha o endereço completo (Rua, Número, Bairro).');
      return;
    }

    if (!isRetirada && bairroNaoEncontrado && taxaEntregaCalculada === 0) {
      const confirmacao = window.confirm(
        `O bairro "${bairro.trim()}" não foi encontrado na nossa lista de áreas de entrega e a taxa é R$ 0,00. Deseja continuar? (Podem ser aplicadas taxas adicionais na entrega)`
      );
      if (!confirmacao) {
        return;
      }
    }

    let valorTrocoPara = null;
    if (formaPagamento === 'dinheiro' && trocoPara.trim() !== '') {
      const trocoNum = Number(trocoPara);
      if (trocoNum > totalComTaxaCalculado) {
        valorTrocoPara = trocoNum;
      } else {
        alert(`O valor para troco (R$ ${trocoNum.toFixed(2)}) deve ser maior que o total do pedido (R$ ${totalComTaxaCalculado.toFixed(2)}).`);
        return;
      }
    }

    // Salvar no localStorage APENAS se não for usuário logado E se for entrega
    if (!currentUser && !isRetirada) {
      localStorage.setItem('nomeCliente', nomeCliente.trim());
      localStorage.setItem('telefoneCliente', telefoneCliente.trim());
      localStorage.setItem('rua', rua.trim());
      localStorage.setItem('numero', numero.trim());
      localStorage.setItem('bairro', bairro.trim());
      localStorage.setItem('complemento', complemento.trim());
    }

    const pedido = {
      cliente: {
        nome: nomeCliente.trim(),
        telefone: telefoneCliente.trim(),
        endereco: isRetirada ? null : { // Endereço só é salvo se não for retirada
          rua: rua.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          complemento: complemento.trim()
        },
        userId: currentUser ? currentUser.uid : null
      },
      estabelecimentoId: estabelecimentoId,
      itens: carrinho.map(item => ({
        nome: item.nome,
        quantidade: item.qtd,
        preco: Number(item.preco),
        imageUrl: item.imageUrl
      })),
      status: 'recebido',
      criadoEm: Timestamp.now(),
      formaPagamento: formaPagamento,
      trocoPara: valorTrocoPara,
      taxaEntrega: taxaAplicada,
      totalFinal: totalComTaxaCalculado,
      tipoEntrega: isRetirada ? 'retirada' : 'delivery', // Adiciona a informação se é retirada ou entrega
      ...(formaPagamento === 'pix' && {
        statusPagamentoPix: 'aguardando_pagamento',
      })
    };

    try {
      const docRef = await addDoc(collection(db, 'pedidos'), pedido);

      // PREENCHE OS DETALHES PARA O MODAL E ABRE O MODAL
      setConfirmedOrderDetails({
        id: docRef.id,
        cliente: pedido.cliente,
        itens: pedido.itens,
        subtotal: subtotalCalculado,
        taxaEntrega: taxaAplicada,
        totalFinal: totalComTaxaCalculado,
        formaPagamento: formaPagamento,
        trocoPara: valorTrocoPara,
        tipoEntrega: pedido.tipoEntrega,
        // estabelecimentoWhatsapp: estabelecimentoInfo?.whatsapp // Não é mais necessário para o modal sem WhatsApp
      });
      setShowOrderConfirmationModal(true); // Abre o modal

      // Limpar estados após o envio para um novo pedido
      setCarrinho([]);
      setFormaPagamento('');
      setTrocoPara('');
      // Mantém os dados do cliente para preenchimento rápido se não estiver logado
      // ou se o usuário decidir fazer outro pedido.
      // Se quiser limpar tudo, descomente as linhas abaixo:
      // if (!currentUser) {
      //    setNomeCliente('');
      //    setTelefoneCliente('');
      //    setRua('');
      //    setNumero('');
      //    setBairro('');
      //    setComplemento('');
      // }
      // isRetirada mantém o último estado para facilitar, mas pode ser resetado se preferir.
      setTaxaEntregaCalculada(0); // Reseta a taxa
      setBairroNaoEncontrado(false); // Reseta a flag

    } catch (error) {
      console.error("Erro ao enviar pedido: ", error);
      alert("❌ Ocorreu um erro ao enviar seu pedido. Por favor, tente novamente.");
    }
  };

  // FUNÇÕES RELACIONADAS AO WHATSAPP REMOVIDAS, POIS NÃO SÃO MAIS NECESSÁRIAS
  // const formatWhatsAppMessage = (orderDetails) => { ... };
  // const handleOpenWhatsApp = () => { ... };


  const subtotalPedido = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  const totalPedidoComTaxa = subtotalPedido + taxaEntregaCalculada; // Usa a taxa calculada

  return (
    // DIV PRINCIPAL DO COMPONENTE MENU - Adicionado pb-40 para garantir espaço para o botão fixo
    <div className="p-4 max-w-3xl mx-auto pb-40 md:pb-0">
      <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-4">
        Cardápio de {nomeEstabelecimento}
      </h1>
      {estabelecimentoInfo && estabelecimentoInfo.descricao && (
        <p className="text-center text-[var(--cinza-texto)] mb-8">{estabelecimentoInfo.descricao}</p>
      )}

      {/* Renderização do Cardápio / Mensagem de Vazio */}
      {produtos.length === 0 && nomeEstabelecimento !== "Carregando Cardápio..." ? (
        <p className="text-center text-gray-500 italic mt-8">Nenhum item disponível neste cardápio ou estabelecimento não encontrado.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {produtos.map((item) => (
            <CardapioItem
              key={item.id}
              item={item}
              cartItem={carrinho.find(p => p.id === item.id)}
              addToCart={adicionarAoCarrinho}
              removeFromCart={removerDoCarrinho}
            />
          ))}
        </div>
      )}

      {/* BLOCO: SEU PEDIDO (Carrinho, Subtotal, Taxa, Total) */}
      <div className="bg-white p-6 mt-10 rounded-lg shadow-xl border border-gray-200">
        <h2 className="font-bold text-2xl mb-4 text-[var(--marrom-escuro)]">Seu Pedido</h2>

        {carrinho.length === 0 ? (
          <p className="text-gray-500 italic text-center py-4">
            🛒 Nenhum item adicionado ainda. Comece a escolher!
          </p>
        ) : (
          <>
            <ul className="mb-4 space-y-3">
              {carrinho.map((item) => (
                <li key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md border border-gray-100">
                  <span className="font-medium text-[var(--cinza-texto)]">
                    {item.nome} <span className="text-sm text-gray-500">({item.qtd}x)</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => removerDoCarrinho(item.id)}
                      className="bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                      aria-label={`Remover um ${item.nome}`}
                    >
                      -
                    </button>
                    <span className="font-semibold text-[var(--marrom-escuro)]">R$ {(item.preco * item.qtd).toFixed(2).replace('.', ',')}</span>
                    <button
                      onClick={() => adicionarAoCarrinho(item)}
                      className="bg-[var(--verde-destaque)] hover:bg-green-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                      aria-label={`Adicionar mais um ${item.nome}`}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-200 pt-4 mt-4 text-[var(--marrom-escuro)]">
              <div className="flex justify-between items-center text-lg mb-1">
                <span>Subtotal:</span>
                <span>R$ {subtotalPedido.toFixed(2).replace('.', ',')}</span>
              </div>
              {/* Exibe a taxa de entrega calculada se não for retirada */}
              {!isRetirada && taxaEntregaCalculada > 0 && (
                <div className="flex justify-between items-center text-lg mb-2">
                  <span>Taxa de Entrega ({bairro.trim() || 'Não Informado'}):</span>
                  <span>R$ {taxaEntregaCalculada.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              {/* Mensagem se o bairro não foi encontrado ou taxa é zero e precisa de atenção */}
              {!isRetirada && bairroNaoEncontrado && taxaEntregaCalculada === 0 && (
                <p className="text-sm text-orange-600 mb-2">
                  Atenção: O bairro digitado não foi encontrado na lista de taxas. Taxa de entrega pode ser reavaliada.
                </p>
              )}
              <div className="flex justify-between items-center text-2xl font-bold">
                <span>Total:</span>
                <span>R$ {totalPedidoComTaxa.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </>
        )}
      </div> {/* FIM DO BLOCO: SEU PEDIDO */}

      {/* BLOCO ÚNICO: SEUS DADOS E FORMA DE PAGAMENTO */}
      <div className="bg-white p-6 mt-6 rounded-lg shadow-xl border border-gray-200">
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
            disabled={!!currentUser}
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
            disabled={!!currentUser}
          />
        </div>

        {/* OPÇÕES DE TIPO DE ENTREGA (Retirada ou Entrega) */}
        <div className="mb-6 pt-4 border-t border-gray-200">
            <h3 className="font-bold text-xl mb-3 text-[var(--marrom-escuro)]">Tipo de Entrega *</h3>
            <div className="space-y-3">
              <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
                  <input
                      type="radio"
                      name="deliveryType"
                      value="retirada"
                      checked={isRetirada === true}
                      onChange={() => setIsRetirada(true)}
                      className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]"
                  />
                  Retirada no Estabelecimento
              </label>
              <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
                  <input
                      type="radio"
                      name="deliveryType"
                      value="entrega"
                      checked={isRetirada === false}
                      onChange={() => setIsRetirada(false)}
                      className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]"
                  />
                  Entrega no meu Endereço
              </label>
            </div>
        </div>

        {/* CAMPOS DE ENDEREÇO (CONDICIONAIS - APENAS SE FOR ENTREGA) */}
        {!isRetirada && (
          <>
            <div className="mb-4">
              <label htmlFor="rua" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Rua *</label>
              <input
                id="rua"
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                placeholder="Ex: Rua das Flores"
                required={!isRetirada}
                disabled={!!currentUser && currentClientData?.endereco?.rua}
              />
            </div>
            <div className="mb-4 flex gap-4">
              <div className="flex-1">
                <label htmlFor="numero" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Número *</label>
                <input
                  id="numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                  placeholder="Ex: 123"
                  required={!isRetirada}
                  disabled={!!currentUser && currentClientData?.endereco?.numero}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="bairro" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Bairro *</label>
                <input
                  id="bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                  placeholder="Ex: Centro"
                  required={!isRetirada}
                  disabled={!!currentUser && currentClientData?.endereco?.bairro}
                />
              </div>
            </div>
            <div className="mb-6">
              <label htmlFor="complemento" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Complemento / Ponto de Referência</label>
              <input
                id="complemento"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                placeholder="Ex: Apt 101, Próximo à praça"
                disabled={!!currentUser && currentClientData?.endereco?.complemento}
              />
            </div>
          </>
        )}

        {/* INÍCIO DO BLOCO: FORMA DE PAGAMENTO (agora dentro de 'Seus Dados') */}
        <div className="pt-6 mt-6 border-t border-gray-200">
            <h3 className="font-bold text-xl mb-3 text-[var(--marrom-escuro)]">Forma de Pagamento *</h3>
            <div className="space-y-3">
            <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
                <input
                type="radio"
                name="paymentMethod"
                value="pix"
                checked={formaPagamento === 'pix'}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]"
                />
                PIX
            </label>
            <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
                <input
                type="radio"
                name="paymentMethod"
                value="cartao"
                checked={formaPagamento === 'cartao'}
                onChange={(e) => setFormaPagamento(e.target.value)} // CORREÇÃO: trocado 'Pagento' por 'Pagamento'
                className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]"
                />
                Cartão (Crédito/Débito na entrega)
            </label>
            <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
                <input
                type="radio"
                name="paymentMethod"
                value="dinheiro"
                checked={formaPagamento === 'dinheiro'}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]"
                />
                Dinheiro
            </label>
            </div>

            {formaPagamento === 'dinheiro' && (
            <div className="mt-4">
                <label htmlFor="troco" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">
                Precisa de troco para? (Opcional)
                </label>
                <input
                id="troco"
                type="number"
                value={trocoPara}
                onChange={(e) => setTrocoPara(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                placeholder={`Ex: R$ ${(totalPedidoComTaxa + 10).toFixed(2).replace('.', ',')}`}
                />
            </div>
            )}
        </div> {/* FIM DO BLOCO: FORMA DE PAGAMENTO (agora dentro de 'Seus Dados') */}

      </div> {/* FIM DO BLOCO ÚNICO: SEUS DADOS E FORMA DE PAGAMENTO */}

      {/* BLOCO DO BOTÃO "ENVIAR PEDIDO AGORA!" - Condicional */}
      {carrinho.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 p-4 shadow-lg z-50 md:relative md:p-0 md:mt-8 md:border-none md:shadow-none">
          <button
            onClick={enviarPedido}
            className="bg-[var(--vermelho-principal)] text-white px-6 py-3 rounded-lg hover:bg-red-700 transition duration-300 ease-in-out w-full text-lg font-semibold shadow-lg"
            disabled={
              !nomeCliente.trim() ||
              !telefoneCliente.trim() ||
              (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim())) || // Valida endereço apenas se não for retirada
              carrinho.length === 0 ||
              !formaPagamento
            }
          >
            Enviar Pedido Agora!
          </button>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE PEDIDO (SEM BOTÃO DO WHATSAPP) */}
      {showOrderConfirmationModal && confirmedOrderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full relative">
            <h2 className="text-2xl font-bold text-[var(--vermelho-principal)] mb-4 text-center">Pedido Enviado! 🎉</h2>
            <p className="text-gray-700 text-center mb-6">
              Seu pedido foi registrado com sucesso! O estabelecimento está processando sua solicitação.
              Você receberá atualizações em breve.
            </p>

            <div className="mb-6 border-t border-b border-gray-200 py-4">
              <p className="font-semibold text-lg text-[var(--marrom-escuro)] mb-2">Resumo do Pedido:</p>
              <p><strong>ID do Pedido:</strong> {confirmedOrderDetails.id.substring(0, 8)}...</p>
              <p><strong>Total:</strong> R$ {confirmedOrderDetails.totalFinal.toFixed(2).replace('.', ',')}</p>
              <p><strong>Pagamento:</strong> {confirmedOrderDetails.formaPagamento.charAt(0).toUpperCase() + confirmedOrderDetails.formaPagamento.slice(1)}</p>
              <p><strong>Entrega:</strong> {confirmedOrderDetails.tipoEntrega === 'retirada' ? 'Retirada' : 'Delivery'}</p>
            </div>

            <button
              onClick={() => { setShowOrderConfirmationModal(false); navigate('/'); }}
              className="bg-[var(--vermelho-principal)] text-white px-6 py-3 rounded-lg hover:bg-red-700 transition duration-300 ease-in-out w-full text-lg font-semibold"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      )}
    </div> 
  );
}

export default Menu;