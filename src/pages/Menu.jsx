// src/pages/Menu.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, addDoc, Timestamp, query, onSnapshot, orderBy } from 'firebase/firestore';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext'; // Importe useAuth

function Menu() {
  const { estabelecimentoId } = useParams();
  const { currentUser, currentClientData, loading: authLoading } = useAuth(); // Pega currentUser e currentClientData do contexto
  
  const [carrinho, setCarrinho] = useState([]);
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState(''); 

  const [produtos, setProdutos] = useState([]);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando Cardápio...");
  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
  
  // Efeito para preencher nome, telefone e agora endereço do cliente logado
  useEffect(() => {
    // <<-- ADICIONADO LOGS AQUI -->>
    console.log("Menu.jsx: useEffect de preenchimento iniciado.");
    console.log("Menu.jsx: authLoading:", authLoading);
    console.log("Menu.jsx: currentUser (Menu):", currentUser);
    console.log("Menu.jsx: currentClientData (Menu):", currentClientData);

    if (!authLoading) { // Garante que o AuthContext já carregou
      if (currentUser && currentClientData) {
        console.log("Menu.jsx: Usuário logado e dados do cliente disponíveis.");
        // <<-- LOGS CHAVE PARA VERIFICAR DADOS DE NOME, TELEFONE E ENDEREÇO -->>
        console.log("Menu.jsx: currentClientData.nome:", currentClientData.nome);
        console.log("Menu.jsx: currentClientData.telefone:", currentClientData.telefone);
        console.log("Menu.jsx: currentClientData.endereco:", currentClientData.endereco);
        
        setNomeCliente(currentClientData.nome || '');
        setTelefoneCliente(currentClientData.telefone || '');
        
        // Verifica se currentClientData.endereco existe antes de tentar acessar suas propriedades
        if (currentClientData.endereco) {
            setRua(currentClientData.endereco.rua || '');
            setNumero(currentClientData.endereco.numero || '');
            setBairro(currentClientData.endereco.bairro || '');
            setComplemento(currentClientData.endereco.complemento || '');
            console.log("Menu.jsx: Campos de endereço preenchidos de currentClientData.");
        } else {
            console.log("Menu.jsx: currentClientData.endereco é nulo ou indefinido. Tentando localStorage.");
            // Tenta puxar do localStorage se o AuthContext não tem endereço (mesmo estando logado)
            // Isso pode acontecer se o perfil do cliente não tiver o endereço salvo ainda
            setNomeCliente(localStorage.getItem('nomeCliente') || ''); // Pega nome do localStorage se não veio do AuthContext
            setTelefoneCliente(localStorage.getItem('telefoneCliente') || ''); // Pega telefone do localStorage se não veio do AuthContext
            setRua(localStorage.getItem('rua') || '');
            setNumero(localStorage.getItem('numero') || '');
            setBairro(localStorage.getItem('bairro') || '');
            setComplemento(localStorage.getItem('complemento') || '');
            console.log("Menu.jsx: Campos de endereço (e talvez nome/telefone) preenchidos do localStorage (mesmo logado).");
        }
      } else {
        console.log("Menu.jsx: Não logado ou dados do cliente não disponíveis. Preenchendo de localStorage.");
        setNomeCliente(localStorage.getItem('nomeCliente') || '');
        setTelefoneCliente(localStorage.getItem('telefoneCliente') || '');
        setRua(localStorage.getItem('rua') || '');
        setNumero(localStorage.getItem('numero') || '');
        setBairro(localStorage.getItem('bairro') || '');
        setComplemento(localStorage.getItem('complemento') || '');
      }
    }
  }, [currentUser, currentClientData, authLoading]); // Roda quando o status de autenticação ou dados do cliente mudam

  // Efeito para carregar os produtos do Firestore (mantido do último ajuste)
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
    // <<-- VALIDAÇÃO DOS NOVOS CAMPOS DE ENDEREÇO -->>
    if (!nomeCliente.trim() || !telefoneCliente.trim() || !rua.trim() || !numero.trim() || !bairro.trim() || carrinho.length === 0) {
      alert('Por favor, preencha seu nome, telefone e endereço completo, e adicione itens ao carrinho antes de enviar o pedido.');
      return;
    }

    // <<-- SALVA OS NOVOS CAMPOS NO localStorage (se não logado) -->>
    if (!currentUser) { 
      localStorage.setItem('nomeCliente', nomeCliente.trim());
      localStorage.setItem('telefoneCliente', telefoneCliente.trim());
      localStorage.setItem('rua', rua.trim());
      localStorage.setItem('numero', numero.trim());
      localStorage.setItem('bairro', bairro.trim());
      localStorage.setItem('complemento', complemento.trim());
    }

    // <<-- INCLUI OS NOVOS CAMPOS NO OBJETO PEDIDO -->>
    const pedido = {
      cliente: { 
        nome: nomeCliente.trim(), 
        telefone: telefoneCliente.trim(),
        endereco: { // Objeto aninhado para o endereço
          rua: rua.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          complemento: complemento.trim() 
        }
      },
      estabelecimentoId: estabelecimentoId,
      itens: carrinho.map(item => ({ 
        nome: item.nome, 
        quantidade: item.qtd, 
        preco: Number(item.preco), // Garante que preco seja número
        imageUrl: item.imageUrl 
      })),
      status: 'recebido',
      criadoEm: Timestamp.now()
    };

    try {
      await addDoc(collection(db, 'pedidos'), pedido);
      alert('🎉 Seu pedido foi enviado com sucesso! Aguarde a confirmação.');
      setCarrinho([]);
      // Não limpa campos do cliente para reuso ou preenchimento via AuthContext
    } catch (error) {
      console.error("Erro ao enviar pedido: ", error);
      alert("❌ Ocorreu um erro ao enviar seu pedido. Por favor, tente novamente.");
    }
  };

  const totalPedido = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-4">
        Cardápio de {nomeEstabelecimento}
      </h1>
      {estabelecimentoInfo && estabelecimentoInfo.descricao && (
        <p className="text-center text-[var(--cinza-texto)] mb-8">{estabelecimentoInfo.descricao}</p>
      )}

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
                    <span className="font-semibold text-[var(--marrom-escuro)]">R$ {(item.preco * item.qtd).toFixed(2)}</span>
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
            
            <div className="border-t border-gray-200 pt-4 mt-4 flex justify-between items-center text-xl font-bold text-[var(--marrom-escuro)]">
              <span>Total:</span>
              <span>R$ {totalPedido.toFixed(2)}</span>
            </div>
          </>
        )}

        <div className="mb-4 mt-6">
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

        {/* <<-- NOVOS CAMPOS DE ENDEREÇO -->> */}
        <div className="mb-4">
          <label htmlFor="rua" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Rua *</label>
          <input
            id="rua"
            value={rua}
            onChange={(e) => setRua(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
            placeholder="Ex: Rua das Flores"
            required
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
              required
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
              required
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


        <button
          onClick={enviarPedido}
          className="bg-[var(--vermelho-principal)] text-white px-6 py-3 rounded-lg hover:bg-red-700 transition duration-300 ease-in-out w-full text-lg font-semibold shadow-lg"
          disabled={carrinho.length === 0 || !nomeCliente.trim() || !telefoneCliente.trim() || !rua.trim() || !numero.trim() || !bairro.trim()}
        >
          {carrinho.length === 0 ? 'Adicione itens para enviar' : 'Enviar Pedido Agora!'}
        </button>
      </div>
    </div>
  );
}

export default Menu;