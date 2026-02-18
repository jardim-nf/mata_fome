// src/pages/admin/PdvScreen.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { vendaService } from '../../services/vendaService';
import { caixaService } from '../../services/caixaService'; // 🆕 Import Novo
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';

// --- MODAIS ---

const ModalSelecaoVariacao = ({ produto, onClose, onConfirm }) => {
  if (!produto) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9000] p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
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

// 🆕 MODAL ABERTURA DE CAIXA
const ModalAberturaCaixa = ({ visivel, onAbrir, usuarioNome }) => {
  const [saldoInicial, setSaldoInicial] = useState('');
  
  if (!visivel) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999] p-4 backdrop-blur-md">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-bounce-in text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
          🔓
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Abrir Caixa</h2>
        <p className="text-gray-500 mb-6">Olá, <b>{usuarioNome}</b>! Para começar a vender, informe quanto dinheiro há na gaveta (Fundo de Troco).</p>
        
        <div className="mb-6 text-left">
          <label className="block text-sm font-bold text-gray-700 mb-2 uppercase">Fundo de Troco (R$)</label>
          <input 
            type="number" 
            step="0.01"
            className="w-full p-4 border-2 border-blue-500 rounded-xl text-3xl font-bold text-center text-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-200"
            placeholder="0.00"
            value={saldoInicial}
            onChange={(e) => setSaldoInicial(e.target.value)}
            autoFocus
          />
        </div>

        <button 
          onClick={() => onAbrir(saldoInicial)} 
          disabled={!saldoInicial}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          CONFIRMAR ABERTURA
        </button>
      </div>
    </div>
  );
};

// 🆕 MODAL FECHAMENTO DE CAIXA (Versão Blindada)
const ModalFechamentoCaixa = ({ visivel, caixa, vendasDoDia, onClose, onConfirmarFechamento }) => {
  const [dinheiroGaveta, setDinheiroGaveta] = useState('');
  
  if (!visivel || !caixa) return null;

  // 1. TRATAMENTO DE DATAS (CRUCIAL)
  // Converte o Timestamp do Firestore para objeto Date do JS
  const dataAbertura = caixa.dataAbertura?.toDate ? caixa.dataAbertura.toDate() : new Date(caixa.dataAbertura);
  const timeAbertura = dataAbertura.getTime(); // Usa milissegundos para comparar com precisão

  // 2. FILTRAR APENAS VENDAS DESTE CAIXA
  const vendasDoTurno = vendasDoDia.filter(v => {
    // Deve ser do mesmo usuário
    if (v.usuarioId !== caixa.usuarioId) return false;

    // Deve ser DEPOIS da abertura
    const dataVenda = v.createdAt?.toDate ? v.createdAt.toDate() : new Date(v.createdAt);
    const timeVenda = dataVenda.getTime();

    return timeVenda >= timeAbertura;
  });

  // 3. SOMATÓRIOS
  const fundoTroco = parseFloat(caixa.saldoInicial) || 0;

  const totalDinheiroVendas = vendasDoTurno
    .filter(v => v.formaPagamento === 'dinheiro')
    .reduce((acc, v) => acc + (v.total || 0), 0); // Proteção contra total null

  const totalCartao = vendasDoTurno
    .filter(v => ['cartao', 'debito'].includes(v.formaPagamento))
    .reduce((acc, v) => acc + (v.total || 0), 0);
    
  const totalPix = vendasDoTurno
    .filter(v => v.formaPagamento === 'pix')
    .reduce((acc, v) => acc + (v.total || 0), 0);

  const totalGeralVendas = totalDinheiroVendas + totalCartao + totalPix;
  
  // O que deve ter na gaveta = Fundo + Vendas em Dinheiro
  const dinheiroEsperado = fundoTroco + totalDinheiroVendas;
  
  const valorInformado = parseFloat(dinheiroGaveta || 0);
  const diferenca = valorInformado - dinheiroEsperado;

  const handleFechar = () => {
    if (dinheiroGaveta === '') return alert('Informe o valor contado na gaveta!');
    
    const dadosFechamento = {
      saldoFinalInformado: valorInformado,
      diferenca: diferenca,
      resumoVendas: {
        dinheiro: totalDinheiroVendas,
        cartao: totalCartao,
        pix: totalPix,
        total: totalGeralVendas,
        qtdVendas: vendasDoTurno.length
      }
    };
    onConfirmarFechamento(dadosFechamento);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in-up">
        <div className="bg-red-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold">🔒 Fechamento de Caixa</h2>
          <button onClick={onClose} className="text-white hover:bg-red-700 p-2 rounded-full">✕</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="text-xs text-gray-500 text-center mb-2 bg-gray-100 p-2 rounded">
            Caixa aberto em: <b>{dataAbertura.toLocaleTimeString()}</b><br/>
            Vendas computadas neste turno: <b>{vendasDoTurno.length}</b>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded-lg border">
              <p className="text-gray-500">Fundo Inicial</p>
              <p className="font-bold text-lg">R$ {fundoTroco.toFixed(2)}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-100">
              <p className="text-green-700">Vendas Dinheiro</p>
              <p className="font-bold text-lg text-green-700">+ R$ {totalDinheiroVendas.toFixed(2)}</p>
            </div>
          </div>

          <div className="border-t border-b py-3 space-y-1 text-sm text-gray-600">
            <div className="flex justify-between"><span>Cartão (Déb/Cré):</span> <span className="font-bold">R$ {totalCartao.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>PIX:</span> <span className="font-bold">R$ {totalPix.toFixed(2)}</span></div>
            <div className="flex justify-between text-black font-bold pt-1 border-t mt-1"><span>TOTAL VENDIDO:</span> <span>R$ {totalGeralVendas.toFixed(2)}</span></div>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center">
            <p className="text-blue-800 font-bold mb-1 text-sm uppercase">Dinheiro Esperado na Gaveta</p>
            <p className="text-3xl font-bold text-blue-900">R$ {dinheiroEsperado.toFixed(2)}</p>
            <p className="text-xs text-blue-600">(Fundo Inicial + Vendas em Dinheiro)</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Quanto tem na gaveta agora?</label>
            <input 
              type="number" 
              step="0.01"
              className={`w-full p-3 border-2 rounded-xl text-2xl font-bold text-center outline-none focus:ring-2 ${diferenca < -0.01 ? 'border-red-500 text-red-600' : (diferenca > 0.01 ? 'border-yellow-500 text-yellow-600' : 'border-green-500 text-green-600')}`}
              placeholder="R$ 0.00"
              value={dinheiroGaveta}
              onChange={(e) => setDinheiroGaveta(e.target.value)}
              autoFocus
            />
            {dinheiroGaveta !== '' && (
              <div className={`text-center mt-2 font-bold ${diferenca < -0.01 ? 'text-red-600' : (diferenca > 0.01 ? 'text-yellow-600' : 'text-green-600')}`}>
                {Math.abs(diferenca) < 0.01 
                  ? '✅ Caixa Batendo Perfeitamente' 
                  : diferenca < 0 
                    ? `❌ Falta: R$ ${Math.abs(diferenca).toFixed(2)}` 
                    : `⚠️ Sobra: R$ ${diferenca.toFixed(2)}`
                }
              </div>
            )}
          </div>

          <button onClick={handleFechar} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg">
            CONFIRMAR FECHAMENTO (F9)
          </button>
        </div>
      </div>
    </div>
  );
};

const ModalHistorico = ({ visivel, onClose, vendas, onSelecionarVenda, carregando }) => {
  if (!visivel) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col animate-fade-in-up">
        <div className="bg-purple-600 p-4 rounded-t-2xl text-white flex justify-between items-center"><h2 className="text-xl font-bold flex items-center gap-2">🕒 Histórico de Vendas</h2><button onClick={onClose} className="bg-purple-700 hover:bg-purple-800 p-2 rounded-full transition">✕ ESC</button></div>
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-gray-50">
          {carregando ? <div className="text-center py-10">Carregando...</div> : vendas.length === 0 ? <div className="text-center py-10 text-gray-400">Nenhuma venda.</div> : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-200 text-gray-600 uppercase text-xs font-bold sticky top-0"><tr><th className="p-3">Hora</th><th className="p-3">ID</th><th className="p-3">Valor</th><th className="p-3">Pgto</th><th className="p-3">Ações</th></tr></thead>
              <tbody className="bg-white divide-y">{vendas.map(v => (<tr key={v.id} className="hover:bg-purple-50"><td className="p-3">{v.createdAt instanceof Date ? v.createdAt.toLocaleTimeString() : '--'}</td><td className="p-3 text-xs">#{v.id.slice(-6)}</td><td className="p-3 font-bold text-green-700">R$ {v.total.toFixed(2)}</td><td className="p-3 uppercase text-xs">{v.formaPagamento}</td><td className="p-3"><button onClick={() => onSelecionarVenda(v)} className="text-blue-600 hover:underline text-xs font-bold">Ver / Imprimir</button></td></tr>))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const ModalRecibo = ({ visivel, dados, onClose, onNovaVenda, onEmitirNfce, nfceStatus, nfceUrl }) => {
  if (!visivel || !dados) return null;
  const itensVenda = Array.isArray(dados.itens) ? dados.itens : [];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:block">
      <div id="printable-receipt" className="bg-white w-full max-w-sm shadow-2xl overflow-hidden relative rounded-none border border-gray-200 print:shadow-none print:border-none print:w-full print:max-w-none">
        <div className="h-4 w-full bg-gray-800 absolute top-0 left-0 no-print"></div>
        <div className="p-8 pt-10 font-mono text-sm text-gray-700 print:p-0 print:pt-0 print:text-black">
          <div className="text-center mb-6 border-b-2 border-dashed border-gray-400 pb-4"><h2 className="text-xl font-bold text-black uppercase">MATA FOME</h2><p className="text-xs font-bold mt-1 text-black">*** RECIBO ***</p><div className="mt-2 text-xs text-black"><p>{new Date().toLocaleString()}</p><p className="font-bold">PEDIDO: #{dados.id?.slice(-6).toUpperCase()}</p></div></div>
          <div className="space-y-2 mb-6 border-b-2 border-dashed border-gray-400 pb-4 text-black">{itensVenda.map((i, idx) => (<div key={idx} className="flex justify-between"><span>{i.quantity}x {i.name}</span><span>{Number(i.price * i.quantity).toFixed(2)}</span></div>))}</div>
          <div className="space-y-2 mb-6 text-black"><div className="flex justify-between text-xl font-bold"><span>TOTAL</span><span>R$ {Number(dados.total).toFixed(2)}</span></div><div className="flex justify-between text-sm"><span>Pgto:</span><span>{dados.formaPagamento}</span></div></div>
          <div className="bg-yellow-50 p-3 rounded-lg text-center no-print mb-4">{!nfceUrl ? <button onClick={onEmitirNfce} disabled={nfceStatus === 'loading'} className="w-full bg-orange-500 text-white py-2 rounded font-bold">{nfceStatus === 'loading' ? '...' : 'Emitir NFC-e'}</button> : <a href={nfceUrl} target="_blank" className="block w-full bg-blue-600 text-white py-2 rounded font-bold">Imprimir Fiscal</a>}</div>
          <div className="grid grid-cols-2 gap-3 no-print"><button onClick={() => window.print()} className="py-3 border-2 rounded font-bold">Imprimir</button><button onClick={onNovaVenda} className="py-3 bg-green-600 text-white rounded font-bold">Nova Venda</button></div>
        </div>
      </div>
    </div>
  );
};

const ModalFinalizacao = ({ visivel, venda, onClose, onFinalizar, salvando, formaPagamento, setFormaPagamento, valorRecebido, setValorRecebido, troco, cpfNota, setCpfNota }) => {
  if (!visivel || !venda) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full"><div className="bg-green-600 p-6 rounded-t-2xl text-center text-white relative"><button onClick={onClose} className="absolute right-4 top-4 text-white">✕</button><h2 className="text-2xl font-bold">💰 Finalizar</h2></div><div className="p-6"><h3 className="font-semibold mb-3">Pagamento</h3><div className="grid grid-cols-2 gap-3 mb-4">{['dinheiro', 'cartao', 'pix', 'debito'].map(f => (<button key={f} onClick={() => { setFormaPagamento(f); if (f !== 'dinheiro') setValorRecebido(''); }} className={`p-3 rounded-xl border-2 capitalize font-bold ${formaPagamento === f ? 'border-green-500 bg-green-50' : ''}`}>{f}</button>))}</div><div className="mb-4"><input type="tel" placeholder="CPF (Opcional)" className="w-full p-3 border rounded-xl" value={cpfNota} onChange={e => setCpfNota(e.target.value)} /></div>{formaPagamento === 'dinheiro' && (<input type="number" className="w-full p-3 border rounded-xl text-xl text-center font-bold" value={valorRecebido} onChange={e => setValorRecebido(e.target.value)} autoFocus />)}<div className="mt-4 flex gap-3"><button onClick={onClose} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">Voltar</button><button onClick={onFinalizar} disabled={salvando} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold">Confirmar (F10)</button></div></div></div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

const PdvScreen = () => {
  const { userData, currentUser } = useAuth();

  // Estados PDV
  const [vendaAtual, setVendaAtual] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [busca, setBusca] = useState('');

  // Estados de Modais
  const [mostrarFinalizacao, setMostrarFinalizacao] = useState(false);
  const [mostrarAtalhos, setMostrarAtalhos] = useState(false);
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  
  // 🆕 Estados CAIXA
  const [caixaAberto, setCaixaAberto] = useState(null);
  const [verificandoCaixa, setVerificandoCaixa] = useState(true);
  const [mostrarAberturaCaixa, setMostrarAberturaCaixa] = useState(false);
  const [mostrarFechamentoCaixa, setMostrarFechamentoCaixa] = useState(false);

  // Histórico e Fiscal
  const [vendasHistorico, setVendasHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [dadosRecibo, setDadosRecibo] = useState(null);
  const [cpfNota, setCpfNota] = useState('');
  const [nfceStatus, setNfceStatus] = useState('idle');
  const [nfceUrl, setNfceUrl] = useState(null);

  // Venda e Carrinho
  const [produtoParaSelecao, setProdutoParaSelecao] = useState(null);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [valorRecebido, setValorRecebido] = useState('');
  const [troco, setTroco] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [dadosCliente, setDadosCliente] = useState({ nome: '', cpf: '', email: '' });

  const inputBuscaRef = useRef(null);
  const estabelecimentosGerenciados = useMemo(() => userData?.estabelecimentosGerenciados || [], [userData]);
  const primeiroEstabelecimento = estabelecimentosGerenciados[0] || currentUser?.uid;

  // --- 1. VERIFICAÇÃO DE CAIXA AO INICIAR ---
  useEffect(() => {
    if (!primeiroEstabelecimento || !currentUser) return;

    const verificarStatusCaixa = async () => {
      setVerificandoCaixa(true);
      const caixa = await caixaService.verificarCaixaAberto(currentUser.uid, primeiroEstabelecimento);
      
      if (caixa) {
        setCaixaAberto(caixa);
        setMostrarAberturaCaixa(false);
      } else {
        setCaixaAberto(null);
        setMostrarAberturaCaixa(true); // Bloqueia e pede abertura
      }
      setVerificandoCaixa(false);
    };

    verificarStatusCaixa();
  }, [currentUser, primeiroEstabelecimento]);

// --- AÇÕES DE CAIXA (COM MENSAGEM AMIGÁVEL) ---
  const handleAbrirCaixa = async (saldoInicial) => {
    const res = await caixaService.abrirCaixa({
      usuarioId: currentUser.uid,
      estabelecimentoId: primeiroEstabelecimento,
      saldoInicial
    });

    if (res.success) {
      setCaixaAberto(res);
      setMostrarAberturaCaixa(false);
      // Mensagem de sucesso mais limpa (opcional usar Toast aqui)
      alert('✅ Caixa Aberto com Sucesso!'); 
    } else {
      // 🎨 MELHORIA DA MENSAGEM DE ERRO
      console.error(res.error); // Mantém o erro técnico no console para você (dev) ver
      
      if (res.error.includes('permission') || res.error.includes('insufficient')) {
        alert('🚫 Permissão Negada: As regras de segurança bloquearam a abertura do caixa. Verifique se o Administrador liberou seu acesso.');
      } else {
        alert('⚠️ Não foi possível abrir o caixa. Tente novamente.');
      }
    }
  };

  const prepararFechamento = async () => {
    if (!caixaAberto) return;
    setCarregandoHistorico(true);
    // Carrega vendas para calcular totais
    const vendas = await vendaService.buscarVendasPorEstabelecimento(primeiroEstabelecimento, 100); 
    // Filtrar apenas vendas de HOJE/DESTE TURNO (simplificado)
    setVendasHistorico(vendas); 
    setCarregandoHistorico(false);
    setMostrarFechamentoCaixa(true);
  };

  const handleConfirmarFechamento = async (dadosFechamento) => {
    const res = await caixaService.fecharCaixa(caixaAberto.id, dadosFechamento);
    if (res.success) {
      alert(`Caixa Fechado!\nSaldo Final: R$ ${dadosFechamento.saldoFinalInformado}\nDiferença: R$ ${dadosFechamento.diferenca.toFixed(2)}`);
      setMostrarFechamentoCaixa(false);
      setCaixaAberto(null);
      setMostrarAberturaCaixa(true); // Volta a pedir abertura
      setVendaAtual(null);
    } else {
      alert('Erro ao fechar: ' + res.error);
    }
  };

  // --- CARREGAMENTO DE PRODUTOS (MANTIDO IGUAL) ---
  const formatarNomeCategoriaDinamica = (cat) => (!cat ? 'Geral' : cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' '));
  const getIconeCategoriaDinamico = (cat) => {
    if (!cat) return '🍽️';
    const lower = cat.toLowerCase();
    if (lower.includes('bebida') || lower.includes('suco')) return '🥤';
    if (lower.includes('lanche') || lower.includes('burger')) return '🍔';
    return '🍽️';
  };

  useEffect(() => {
    if (!primeiroEstabelecimento) { setCarregandoProdutos(false); return; }
    setCarregandoProdutos(true);
    const categoriasRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio');
    const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));

    const unsubscribe = onSnapshot(qCategorias, (catSnap) => {
      const categoriesData = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), icon: getIconeCategoriaDinamico(doc.data().nome || doc.id) }));
      setCategorias([{ id: 'todos', name: 'Todos', icon: '🍽️' }, ...categoriesData.map(c => ({ id: c.nome || c.id, originalId: c.id, name: c.nome || formatarNomeCategoriaDinamica(c.id), icon: c.icon }))]);

      if (catSnap.empty) { setProdutos([]); setCarregandoProdutos(false); return; }

      const unsubscribers = [];
      let allItemsMap = new Map();
      let catsProcessed = 0;

      catSnap.forEach(catDoc => {
        const itemsRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catDoc.id, 'itens');
        const qItems = query(itemsRef);
        unsubscribers.push(onSnapshot(qItems, (itemsSnap) => {
          const itemsDaCategoria = itemsSnap.docs.map(itemDoc => {
            const data = itemDoc.data();
            const variacoes = Array.isArray(data.variacoes) ? data.variacoes.filter(v => v.ativo) : [];
            let precoBase = Number(data.preco || 0);
            let temVariacoes = false;
            if (variacoes.length > 0) {
              const precosVars = variacoes.map(v => Number(v.preco)).filter(p => p > 0);
              if (precosVars.length > 0) { precoBase = Math.min(...precosVars); temVariacoes = true; }
            }
            return { ...data, id: itemDoc.id, categoria: catDoc.data().nome || formatarNomeCategoriaDinamica(catDoc.id), categoriaId: catDoc.id, price: precoBase, name: data.nome, variacoes, temVariacoes, emEstoque: data.estoque > 0 || !data.controlarEstoque };
          });
          allItemsMap.set(catDoc.id, itemsDaCategoria.filter(i => i.ativo !== false));
          setProdutos(Array.from(allItemsMap.values()).flat());
          catsProcessed++;
          if (catsProcessed >= catSnap.size) setCarregandoProdutos(false);
        }));
      });
      setTimeout(() => setCarregandoProdutos(false), 2000);
      return () => unsubscribers.forEach(u => u());
    });
    return () => unsubscribe();
  }, [primeiroEstabelecimento]);

  // --- LÓGICA DE HISTÓRICO F3 ---
  const carregarHistorico = async () => {
    setCarregandoHistorico(true);
    setMostrarHistorico(true);
    try {
      const vendas = await vendaService.buscarVendasPorEstabelecimento(primeiroEstabelecimento, 50);
      setVendasHistorico(vendas);
    } catch (e) { console.error(e); } finally { setCarregandoHistorico(false); }
  };

  const selecionarVendaHistorico = (venda) => {
    setDadosRecibo(venda);
    setNfceStatus(venda.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle');
    setNfceUrl(venda.fiscal?.pdf || null);
    setMostrarHistorico(false);
    setMostrarRecibo(true);
  };

  // --- ATALHOS ---
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Bloqueia atalhos se o caixa estiver fechado
      if (!caixaAberto && !mostrarAberturaCaixa) return;

      if (event.key === 'F1') { event.preventDefault(); inputBuscaRef.current?.focus(); }
      else if (event.key === 'F2') { event.preventDefault(); if (!vendaAtual) iniciarVendaBalcao(); }
      else if (event.key === 'F3') { event.preventDefault(); carregarHistorico(); }
      // 🆕 F9 Fecha o Caixa
      else if (event.key === 'F9') { event.preventDefault(); prepararFechamento(); }
      else if (event.key === 'F10') { event.preventDefault(); if (vendaAtual?.itens.length > 0) setMostrarFinalizacao(true); }
      else if (event.key === 'F12') { event.preventDefault(); if (mostrarRecibo && nfceStatus !== 'success') handleEmitirNfce(); }
      else if (event.key === 'Escape') {
        event.preventDefault();
        if (produtoParaSelecao) setProdutoParaSelecao(null);
        else if (mostrarFinalizacao) setMostrarFinalizacao(false);
        else if (mostrarRecibo) setMostrarRecibo(false);
        else if (mostrarHistorico) setMostrarHistorico(false);
        else if (mostrarFechamentoCaixa) setMostrarFechamentoCaixa(false);
        else if (mostrarAtalhos) setMostrarAtalhos(false);
        else if (vendaAtual) cancelarVenda();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vendaAtual, mostrarFinalizacao, mostrarRecibo, mostrarHistorico, mostrarAtalhos, produtoParaSelecao, nfceStatus, caixaAberto, mostrarFechamentoCaixa]);

  // Filtros
  const produtosFiltrados = useMemo(() => produtos.filter(p => ((categoriaAtiva === 'todos' || p.categoria === categoriaAtiva || p.categoriaId === categoriaAtiva) && p.name?.toLowerCase().includes(busca.toLowerCase()))), [produtos, categoriaAtiva, busca]);
  
  // Troco
  useEffect(() => { if (formaPagamento === 'dinheiro' && valorRecebido && vendaAtual) setTroco(Math.max(0, parseFloat(valorRecebido) - vendaAtual.total)); else setTroco(0); }, [valorRecebido, formaPagamento, vendaAtual]);

  // --- AÇÕES DO CARRINHO (IGUAIS) ---
  const iniciarVendaBalcao = () => {
    if (!caixaAberto) return alert("Abra o caixa primeiro!");
    setVendaAtual({ id: Date.now().toString(), tipo: 'balcao', itens: [], status: 'aberta', total: 0 });
    setMostrarFinalizacao(false); setBusca(''); setDadosCliente({ nome: '', cpf: '', email: '' }); setCpfNota(''); setNfceStatus('idle'); setNfceUrl(null);
  };
  const handleProdutoClick = (p) => {
    if (!vendaAtual) { alert('Inicie uma venda primeiro (F2)'); return; }
    if (p.temVariacoes && p.variacoes.length > 0) {
      if (p.variacoes.length === 1 && ['Padrão', 'Único'].includes(p.variacoes[0].nome)) adicionarItemAoCarrinho(p, p.variacoes[0]);
      else setProdutoParaSelecao(p);
    } else adicionarItemAoCarrinho(p, null);
  };
  const adicionarItemAoCarrinho = (p, v) => {
    setVendaAtual(prev => {
      const vid = v ? v.id : 'padrao'; const uid = `${p.id}-${vid}`; const existing = prev.itens.find(i => i.uniqueItemId === uid);
      const nome = v && v.nome !== 'Padrão' ? `${p.name} (${v.nome})` : p.name; const preco = v ? Number(v.preco) : Number(p.price);
      let novos = existing ? prev.itens.map(i => i.uniqueItemId === uid ? { ...i, quantity: i.quantity + 1 } : i) : [...prev.itens, { id: Date.now().toString(), uniqueItemId: uid, productId: p.id, variationId: vid, name: nome, price: preco, quantity: 1 }];
      return { ...prev, itens: novos, total: novos.reduce((s, i) => s + (i.price * i.quantity), 0) };
    });
    setProdutoParaSelecao(null); inputBuscaRef.current?.focus();
  };
  const removerItem = (id) => { if (!vendaAtual) return; setVendaAtual(prev => { const novos = prev.itens.filter(i => i.id !== id); return { ...prev, itens: novos, total: novos.reduce((s, i) => s + (i.price * i.quantity), 0) }; }); };
  const ajustarQuantidade = (id, qtd) => { if (qtd <= 0) { removerItem(id); return; } setVendaAtual(prev => { const novos = prev.itens.map(i => i.id === id ? { ...i, quantity: qtd } : i); return { ...prev, itens: novos, total: novos.reduce((s, i) => s + (i.price * i.quantity), 0) }; }); };

  const finalizarVenda = async () => {
    if (!formaPagamento) return alert('Selecione uma forma de pagamento');
    if (formaPagamento === 'dinheiro' && (!valorRecebido || parseFloat(valorRecebido) < vendaAtual.total)) return alert('Valor insuficiente');
    setSalvando(true);
    try {
      const vendaData = { estabelecimentoId: primeiroEstabelecimento, tipo: 'balcao', status: 'finalizada', formaPagamento, valorRecebido: formaPagamento === 'dinheiro' ? parseFloat(valorRecebido) : vendaAtual.total, troco: formaPagamento === 'dinheiro' ? troco : 0, total: vendaAtual.total, itens: vendaAtual.itens, usuarioId: currentUser?.uid, cliente: dadosCliente.nome || 'Balcão', clienteCpf: cpfNota || null, data: new Date() };
      const resultado = await vendaService.salvarVenda(vendaData);
      if (resultado.success) {
        const dadosReciboObj = { ...vendaData, id: resultado.vendaId || '000000', createdAt: new Date() };
        setDadosRecibo(dadosReciboObj); setMostrarFinalizacao(false); setVendaAtual(null); setFormaPagamento(''); setValorRecebido(''); setTroco(0); setMostrarRecibo(true);
      } else alert('Erro: ' + resultado.error);
    } catch (e) { alert('Erro ao finalizar venda.'); } finally { setSalvando(false); }
  };

  const handleEmitirNfce = async () => {
    if (!dadosRecibo?.id) return; setNfceStatus('loading');
    try {
        const resultado = await vendaService.emitirNfce(dadosRecibo.id, dadosRecibo.clienteCpf);
        if (resultado && (resultado.pdfUrl || resultado.sucesso === false)) { if(resultado.pdfUrl) setNfceUrl(resultado.pdfUrl); setNfceStatus(resultado.sucesso ? 'success' : 'error'); if(resultado.error) alert(resultado.error); } else throw new Error(resultado.error || 'Falha desconhecida');
    } catch (error) { setNfceStatus('error'); alert('Erro ao emitir nota: ' + error.message); }
  };
  const cancelarVenda = () => { if (vendaAtual?.itens.length > 0 && !window.confirm('Cancelar venda?')) return; setVendaAtual(null); setMostrarFinalizacao(false); };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {verificandoCaixa ? (
        <div className="fixed inset-0 flex items-center justify-center bg-white z-[9999]"><div className="text-xl font-bold animate-pulse">🔒 Verificando Caixa...</div></div>
      ) : (
        <>
          {/* TOPO: INDICADOR DE CAIXA */}
          {caixaAberto && (
            <div className="fixed top-0 left-0 right-0 bg-blue-600 h-1 z-50"></div>
          )}

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">PDV <span className="text-sm font-normal text-gray-500">Caixa</span></h1>
                  {caixaAberto && <p className="text-xs text-green-600 font-bold">🟢 Caixa Aberto (Fundo: R$ {caixaAberto.saldoInicial.toFixed(2)})</p>}
                </div>
                {!vendaAtual ? (
                  <div className="flex gap-2">
                    <button onClick={iniciarVendaBalcao} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow hover:bg-green-700 transition transform hover:scale-105">🛒 Abrir Venda (F2)</button>
                    <button onClick={prepararFechamento} className="bg-red-100 text-red-700 px-4 py-3 rounded-xl font-bold hover:bg-red-200" title="Fechar Caixa">🔒 F9</button>
                  </div>
                ) : <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold animate-pulse">Venda Aberta</span>}
              </div>
              
              {/* BUSCA E PRODUTOS (MANTIDO) */}
              <div className="bg-white p-4 rounded-2xl shadow-sm space-y-4">
                <input ref={inputBuscaRef} type="text" placeholder="Buscar produto (F1)..." className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" value={busca} onChange={e => setBusca(e.target.value)} />
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{categorias.map(cat => (<button key={cat.id} onClick={() => setCategoriaAtiva(cat.name === 'Todos' ? 'todos' : cat.name)} className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition flex gap-2 ${((categoriaAtiva === 'todos' && cat.name === 'Todos') || categoriaAtiva === cat.name) ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><span>{cat.icon}</span>{cat.name}</button>))}</div>
              </div>
              {carregandoProdutos ? <div className="text-center py-20 text-gray-500 flex flex-col items-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>Carregando...</div> : <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 h-[60vh] overflow-y-auto content-start pr-2 custom-scrollbar">{produtosFiltrados.map(produto => (<button key={produto.id} onClick={() => handleProdutoClick(produto)} className="bg-white border hover:border-blue-500 hover:shadow-lg transition rounded-xl p-4 flex flex-col items-start text-left group h-full relative"><div className="text-3xl mb-2 bg-gray-50 w-12 h-12 flex items-center justify-center rounded-lg shadow-inner">{getIconeCategoriaDinamico(produto.categoria)}</div><h3 className="font-bold text-gray-800 leading-tight mb-1 line-clamp-2">{produto.name}</h3>{produto.temVariacoes && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mb-1 font-bold">Opções</span>}<div className="mt-auto pt-2 w-full flex justify-between items-center"><div className="flex flex-col">{produto.temVariacoes && <span className="text-[10px] text-gray-500">A partir de</span>}<span className="font-bold text-green-600">R$ {produto.price.toFixed(2)}</span></div><span className="text-xs bg-gray-100 px-2 py-1 rounded-md text-gray-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">+</span></div></button>))}</div>}
            </div>

            {/* DIREITA: CUPOM */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg h-[calc(100vh-2rem)] sticky top-4 flex flex-col">
                <div className="p-4 border-b bg-gray-50 rounded-t-2xl"><h2 className="font-bold text-gray-700">Cupom</h2><div className="text-xs text-gray-500">{new Date().toLocaleDateString()}</div></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {vendaAtual ? (vendaAtual.itens.length > 0 ? vendaAtual.itens.map(item => (<div key={item.uniqueItemId || item.id} className="flex justify-between items-start group border-b border-dashed border-gray-100 pb-2"><div className="flex-1"><div className="font-medium text-gray-800">{item.name}</div><div className="text-sm text-gray-500">{item.quantity}x R$ {item.price.toFixed(2)}</div></div><div className="text-right"><div className="font-bold text-gray-800">R$ {(item.quantity * item.price).toFixed(2)}</div><div className="flex gap-1 justify-end mt-1 opacity-0 group-hover:opacity-100 transition"><button onClick={() => ajustarQuantidade(item.id, item.quantity - 1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 font-bold">-</button><button onClick={() => ajustarQuantidade(item.id, item.quantity + 1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 font-bold">+</button><button onClick={() => removerItem(item.id)} className="w-6 h-6 bg-red-100 text-red-600 rounded hover:bg-red-200 font-bold">x</button></div></div></div>)) : <div className="text-center text-gray-400 py-10">Carrinho vazio</div>) : <div className="text-center text-gray-400 py-10 flex flex-col items-center h-full justify-center opacity-50"><span className="text-6xl mb-4">🏪</span><p>Caixa Fechado</p></div>}
                </div>
                {vendaAtual && (<div className="p-4 bg-gray-50 border-t rounded-b-2xl space-y-3"><div className="flex justify-between items-center text-xl font-bold text-gray-800"><span>Total</span><span>R$ {vendaAtual.total.toFixed(2)}</span></div><div className="grid grid-cols-2 gap-2"><button onClick={cancelarVenda} className="bg-red-100 text-red-700 py-3 rounded-xl font-bold hover:bg-red-200 transition">Cancelar</button><button onClick={() => setMostrarFinalizacao(true)} className="col-span-1 bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg transition transform active:scale-95">Finalizar (F10)</button></div></div>)}
              </div>
            </div>
          </div>

          <ModalSelecaoVariacao produto={produtoParaSelecao} onClose={() => setProdutoParaSelecao(null)} onConfirm={adicionarItemAoCarrinho} />
          <ModalFinalizacao visivel={mostrarFinalizacao} venda={vendaAtual} onClose={() => setMostrarFinalizacao(false)} onFinalizar={finalizarVenda} salvando={salvando} formaPagamento={formaPagamento} setFormaPagamento={setFormaPagamento} valorRecebido={valorRecebido} setValorRecebido={setValorRecebido} troco={troco} cpfNota={cpfNota} setCpfNota={setCpfNota} />
          <ModalRecibo visivel={mostrarRecibo} dados={dadosRecibo} onClose={() => setMostrarRecibo(false)} onNovaVenda={() => { setMostrarRecibo(false); iniciarVendaBalcao(); }} onEmitirNfce={handleEmitirNfce} nfceStatus={nfceStatus} nfceUrl={nfceUrl} />
          <ModalHistorico visivel={mostrarHistorico} onClose={() => setMostrarHistorico(false)} vendas={vendasHistorico} onSelecionarVenda={selecionarVendaHistorico} carregando={carregandoHistorico} />
          
          {/* 🆕 MODAIS CAIXA */}
          <ModalAberturaCaixa visivel={mostrarAberturaCaixa} onAbrir={handleAbrirCaixa} usuarioNome={userData?.name || 'Operador'} />
          <ModalFechamentoCaixa visivel={mostrarFechamentoCaixa} caixa={caixaAberto} vendasDoDia={vendasHistorico} onClose={() => setMostrarFechamentoCaixa(false)} onConfirmarFechamento={handleConfirmarFechamento} />

          <button onClick={() => setMostrarAtalhos(!mostrarAtalhos)} className="fixed bottom-4 left-4 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 z-40 transition-transform hover:scale-110">⌨️</button>
          {mostrarAtalhos && <div className="fixed bottom-16 left-4 bg-white p-4 rounded-xl shadow-xl border z-40 w-64 text-sm"><h3 className="font-bold mb-2">Atalhos</h3><ul className="space-y-2 text-gray-600"><li>F1: Buscar</li><li>F2: Nova Venda</li><li>F3: Histórico</li><li>F9: Fechar Caixa</li><li>F10: Finalizar</li><li>F12: Emitir Nota</li><li>ESC: Voltar</li></ul></div>}
        </>
      )}
    </div>
  );
};

export default PdvScreen;