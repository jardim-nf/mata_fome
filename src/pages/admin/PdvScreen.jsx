// src/pages/admin/PdvScreen.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { vendaService } from '../../services/vendaService';
import { caixaService } from '../../services/caixaService';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';

// --- FUNÇÕES AUXILIARES ---
const formatarHora = (data) => {
  if (!data) return '--:--';
  if (data.toDate) return data.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (data instanceof Date) return data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return '--:--';
};

const formatarData = (data) => {
  if (!data) return '-';
  if (data.toDate) return data.toDate().toLocaleDateString();
  if (data instanceof Date) return data.toLocaleDateString();
  return '-';
};

// --- MODAIS (Mantidos idênticos para economizar espaço, mas inclua todos!) ---
const ModalSelecaoVariacao = ({ produto, onClose, onConfirm }) => { if(!produto) return null; return (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm"><div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"><h3 className="font-bold text-lg mb-4 text-gray-800">{produto.name}</h3><div className="grid gap-2">{produto.variacoes?.map(v=><button key={v.id} onClick={()=>onConfirm(produto,v)} className="p-4 border rounded-xl flex justify-between hover:bg-blue-50 transition"><span>{v.nome}</span><b className="text-green-600">R$ {Number(v.preco).toFixed(2)}</b></button>)}</div><button onClick={onClose} className="mt-4 w-full bg-gray-100 text-gray-600 p-3 rounded-xl font-bold">Cancelar</button></div></div>); };
const ModalAberturaCaixa = ({ visivel, onAbrir, usuarioNome }) => { const [s,SS]=useState(''); if(!visivel) return null; return (<div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999] p-4"><div className="bg-white p-8 rounded-2xl w-full max-w-sm text-center animate-bounce-in"><div className="text-4xl mb-2">🔓</div><h2 className="text-2xl font-bold mb-2">Abrir Turno</h2><p className="text-gray-500 mb-6">Olá <b>{usuarioNome}</b>, informe o fundo:</p><input type="number" className="w-full p-4 border-2 text-3xl text-center mb-6 rounded-xl" placeholder="0.00" autoFocus onChange={e=>SS(e.target.value)} value={s}/><button onClick={()=>onAbrir(s)} disabled={!s} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">ABRIR</button></div></div>); };
const ModalFechamentoCaixa = ({ visivel, caixa, vendasDoDia, movimentacoes, onClose, onConfirmarFechamento }) => { const [d,SD]=useState(''); if(!visivel||!caixa) return null; const da=caixa.dataAbertura?.toDate?caixa.dataAbertura.toDate():new Date(caixa.dataAbertura); const vt=vendasDoDia.filter(v=>{const dv=v.createdAt?.toDate?v.createdAt.toDate():new Date(v.createdAt); return v.usuarioId===caixa.usuarioId && dv>=da;}); const tDin=vt.filter(v=>v.formaPagamento==='dinheiro').reduce((a,b)=>a+(b.total||0),0); const tOut=vt.filter(v=>v.formaPagamento!=='dinheiro').reduce((a,b)=>a+(b.total||0),0); const tSup=movimentacoes?.totalSuprimento||0; const tSan=movimentacoes?.totalSangria||0; const esp=parseFloat(caixa.saldoInicial||0)+tDin+tSup-tSan; const dif=parseFloat(d||0)-esp; return (<div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl"><div className="flex justify-between mb-4"><h2 className="text-xl font-bold">🔒 Fechar Turno</h2><button onClick={onClose}>✕</button></div><div className="bg-indigo-50 p-4 mb-6 rounded-xl text-center"><p className="text-xs font-bold uppercase text-indigo-800">Esperado na Gaveta</p><p className="text-4xl font-bold text-indigo-900">R$ {esp.toFixed(2)}</p></div><div className="mb-6"><label className="block text-sm font-bold mb-2">Valor na Gaveta</label><input type="number" step="0.01" className="w-full p-4 border-2 rounded-xl text-3xl text-center" placeholder="0.00" autoFocus onChange={e=>SD(e.target.value)} value={d}/>{d&&(<div className={`text-center mt-2 font-bold ${Math.abs(dif)<0.05?'text-green-600':'text-red-500'}`}>{Math.abs(dif)<0.05?'✅ Batendo!':`Diferença: R$ ${dif.toFixed(2)}`}</div>)}</div><button onClick={()=>onConfirmarFechamento({saldoFinalInformado:parseFloat(d||0),diferenca:dif,resumoVendas:{dinheiro:tDin,outros:tOut,suprimento:tSup,sangria:tSan,total:tDin+tOut,qtd:vt.length}})} className="w-full bg-red-600 text-white p-4 rounded-xl font-bold">FINALIZAR (F9)</button></div></div>); };
const ModalMovimentacao = ({ visivel, onClose, onConfirmar }) => { const [t,ST]=useState('sangria'); const [v,SV]=useState(''); const [d,SD]=useState(''); if(!visivel) return null; return (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9400] p-4"><div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full"><div className={`p-4 text-white text-center font-bold ${t==='sangria'?'bg-red-500':'bg-green-500'}`}>{t==='sangria'?'📤 SANGRIA':'📥 SUPRIMENTO'}</div><div className="p-6 space-y-4"><div className="flex bg-gray-100 p-1 rounded-lg"><button onClick={()=>ST('sangria')} className={`flex-1 py-2 rounded font-bold ${t==='sangria'?'bg-white shadow text-red-600':'text-gray-500'}`}>Sangria</button><button onClick={()=>ST('suprimento')} className={`flex-1 py-2 rounded font-bold ${t==='suprimento'?'bg-white shadow text-green-600':'text-gray-500'}`}>Suprimento</button></div><input type="number" className="w-full p-3 border-2 rounded-xl text-2xl text-center" placeholder="0.00" autoFocus onChange={e=>SV(e.target.value)} value={v}/><input type="text" className="w-full p-3 border rounded-xl" placeholder="Motivo" onChange={e=>SD(e.target.value)} value={d}/><div className="flex gap-2"><button onClick={onClose} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">Cancelar</button><button onClick={()=>{if(!v||!d)return alert('Preencha!'); onConfirmar({tipo:t,valor:parseFloat(v),descricao:d}); SV(''); SD('');}} className={`flex-1 text-white py-3 rounded-xl font-bold ${t==='sangria'?'bg-red-600':'bg-green-600'}`}>SALVAR</button></div></div></div></div>); };
const ModalHistorico = ({ visivel, onClose, vendas, onSelecionarVenda, carregando, titulo }) => { if(!visivel) return null; return (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9300] p-4"><div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col"><div className="bg-purple-600 p-4 rounded-t-2xl text-white flex justify-between"><b>{titulo||"Histórico"}</b><button onClick={onClose}>✕</button></div><div className="flex-1 overflow-auto p-4 bg-gray-50">{vendas.map(v=><div key={v.id} className="flex justify-between border-b p-3 bg-white mb-2 rounded shadow-sm"><span>{formatarHora(v.createdAt)} #{v.id.slice(-4)}</span><b>R$ {v.total.toFixed(2)}</b><button onClick={()=>onSelecionarVenda(v)} className="text-blue-600 font-bold">Ver</button></div>)}</div></div></div>); };
const ModalListaTurnos = ({ visivel, onClose, turnos, carregando, onVerVendas }) => { if(!visivel) return null; return (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9200] p-4"><div className="bg-white rounded-2xl max-w-5xl w-full h-[80vh] flex flex-col"><div className="bg-indigo-600 p-4 rounded-t-2xl text-white flex justify-between"><b>Turnos</b><button onClick={onClose}>✕</button></div><div className="flex-1 overflow-auto p-6"><table className="w-full text-left"><thead><tr><th>Status</th><th>Data</th><th>Total</th><th>Ação</th></tr></thead><tbody>{turnos.map(t=><tr key={t.id} className="border-b"><td>{t.status==='aberto'?'🟢 Aberto':'🔴 Fechado'}</td><td>{formatarData(t.dataAbertura)}</td><td>R$ {t.resumoVendas?.total?.toFixed(2)||'0.00'}</td><td><button onClick={()=>onVerVendas(t)} className="text-indigo-600 font-bold">Ver</button></td></tr>)}</tbody></table></div></div></div>); };
const ModalRecibo = ({ visivel, dados, onClose, onNovaVenda, onEmitirNfce, nfceStatus, nfceUrl }) => { if(!visivel) return null; return (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]"><div className="bg-white w-full max-w-sm p-8 relative"><button onClick={onClose} className="absolute top-2 right-2 text-gray-400 text-xl no-print">✕</button><div className="text-center border-b pb-4"><h2 className="font-bold">RECIBO</h2><p>#{dados.id.slice(-6)}</p></div><div className="py-4 space-y-2">{dados.itens.map(i=><div key={i.uid} className="flex justify-between"><span>{i.quantity}x {i.name}</span><span>{i.price.toFixed(2)}</span></div>)}</div><div className="border-t pt-4 font-bold flex justify-between"><span>TOTAL</span><span>R$ {dados.total.toFixed(2)}</span></div><div className="mt-4 grid gap-2 no-print"><button onClick={onEmitirNfce} disabled={nfceStatus==='loading'} className="bg-orange-500 text-white p-2 rounded font-bold">{nfceUrl?'Ver Fiscal':'Emitir NFC-e'}</button><div className="grid grid-cols-2 gap-2"><button onClick={()=>window.print()} className="border p-2 rounded">Imprimir</button><button onClick={onNovaVenda} className="bg-green-600 text-white p-2 rounded">Nova Venda</button></div><button onClick={onClose} className="bg-gray-200 p-2 rounded w-full">Voltar</button></div></div></div>); };
const ModalFinalizacao = ({ visivel, venda, onClose, onFinalizar, salvando, formaPagamento, setFormaPagamento, valorRecebido, setValorRecebido, troco, cpfNota, setCpfNota }) => { if(!visivel) return null; return (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9000]"><div className="bg-white p-6 rounded-2xl w-full max-w-md"><h2 className="text-2xl font-bold mb-4">Total: R$ {venda.total.toFixed(2)}</h2><div className="grid grid-cols-2 gap-2 mb-4">{['dinheiro','cartao','pix'].map(f=><button key={f} onClick={()=>{setFormaPagamento(f);if(f!=='dinheiro')setValorRecebido('')}} className={`p-3 border rounded uppercase ${formaPagamento===f?'bg-green-100 border-green-500':''}`}>{f}</button>)}</div>{formaPagamento==='dinheiro' && <input type="number" className="w-full p-3 border mb-4 text-xl" autoFocus value={valorRecebido} onChange={e=>setValorRecebido(e.target.value)} />}{troco>0 && <p className="text-center font-bold text-green-600 mb-4">Troco: {troco.toFixed(2)}</p>}<div className="flex gap-2"><button onClick={onClose} className="flex-1 bg-gray-200 p-3 rounded">Cancelar</button><button onClick={onFinalizar} disabled={salvando} className="flex-1 bg-green-600 text-white p-3 rounded">Finalizar</button></div></div></div>); };

// --- COMPONENTE PRINCIPAL ---

const PdvScreen = () => {
  const { userData, currentUser } = useAuth();
  
  // Estados de Estabelecimento
  const [estabelecimentos, setEstabelecimentos] = useState([]); // Lista de lojas
  const [estabelecimentoAtivo, setEstabelecimentoAtivo] = useState(null); // Loja selecionada
  const [nomeLoja, setNomeLoja] = useState('Carregando...');

  // Estados de Dados
  const [vendaAtual, setVendaAtual] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [vendasBase, setVendasBase] = useState([]); 
  const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
  const [tituloHistorico, setTituloHistorico] = useState("Histórico");
  const [listaTurnos, setListaTurnos] = useState([]);
  
  // Estados de UI
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [busca, setBusca] = useState('');
  
  // Modais
  const [caixaAberto, setCaixaAberto] = useState(null);
  const [verificandoCaixa, setVerificandoCaixa] = useState(true);
  const [mostrarAberturaCaixa, setMostrarAberturaCaixa] = useState(false);
  const [mostrarFechamentoCaixa, setMostrarFechamentoCaixa] = useState(false);
  const [mostrarMovimentacao, setMostrarMovimentacao] = useState(false);
  const [movimentacoesDoTurno, setMovimentacoesDoTurno] = useState({ totalSuprimento: 0, totalSangria: 0 });
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mostrarListaTurnos, setMostrarListaTurnos] = useState(false);
  const [mostrarFinalizacao, setMostrarFinalizacao] = useState(false);
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [mostrarAtalhos, setMostrarAtalhos] = useState(false);

  // Pagamento
  const [dadosRecibo, setDadosRecibo] = useState(null);
  const [cpfNota, setCpfNota] = useState('');
  const [nfceStatus, setNfceStatus] = useState('idle');
  const [nfceUrl, setNfceUrl] = useState(null);
  const [produtoParaSelecao, setProdutoParaSelecao] = useState(null);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [valorRecebido, setValorRecebido] = useState('');
  const [troco, setTroco] = useState(0);
  const [salvando, setSalvando] = useState(false);

  const inputBuscaRef = useRef(null);

  // --- 1. GESTÃO DE ESTABELECIMENTOS (O PUL O DO GATO 🐈) ---
  useEffect(() => {
    if (!userData || !currentUser) return;

    const carregarLojas = async () => {
        let listaIds = [];
        
        // Pega IDs do usuário
        if (userData.estabelecimentosGerenciados && Array.isArray(userData.estabelecimentosGerenciados)) {
            listaIds = userData.estabelecimentosGerenciados;
        } else if (currentUser.uid) {
            listaIds = [currentUser.uid];
        }

        if (listaIds.length === 0) return;

        // Busca nomes das lojas
        const promessas = listaIds.map(async (id) => {
            try {
                const docRef = doc(db, 'estabelecimentos', id);
                const docSnap = await getDoc(docRef);
                return { id, nome: docSnap.exists() ? (docSnap.data().nome || 'Loja Sem Nome') : 'Loja Desconhecida' };
            } catch (e) {
                return { id, nome: 'Erro ao carregar' };
            }
        });

        const lojasCarregadas = await Promise.all(promessas);
        setEstabelecimentos(lojasCarregadas);

        // Seleciona a primeira loja automaticamente se não tiver nenhuma selecionada
        if (!estabelecimentoAtivo && lojasCarregadas.length > 0) {
            setEstabelecimentoAtivo(lojasCarregadas[0].id);
            setNomeLoja(lojasCarregadas[0].nome);
        }
    };

    carregarLojas();
  }, [userData, currentUser]);

  // Função para trocar de loja
  const trocarLoja = (id) => {
    const loja = estabelecimentos.find(e => e.id === id);
    if (loja) {
        setEstabelecimentoAtivo(id);
        setNomeLoja(loja.nome);
        setCaixaAberto(null); // Reseta o caixa visualmente ao trocar
        setVendasBase([]);
        setProdutos([]);
        alert(`Trocando para: ${loja.nome}`);
    }
  };

  // --- FILTROS ---
  const vendasTurnoAtual = useMemo(() => {
    if (!caixaAberto) return [];
    let timeAbertura;
    try { timeAbertura = caixaAberto.dataAbertura?.toDate ? caixaAberto.dataAbertura.toDate().getTime() : new Date(caixaAberto.dataAbertura).getTime(); } catch { timeAbertura = Date.now(); }
    return vendasBase.filter(v => {
      let timeVenda;
      try { timeVenda = v.createdAt?.toDate ? v.createdAt.toDate().getTime() : new Date(v.createdAt).getTime(); } catch { return false; }
      return v.usuarioId === currentUser.uid && timeVenda >= (timeAbertura - 60000);
    });
  }, [vendasBase, caixaAberto, currentUser]);

  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const nome = p.name?.toLowerCase() || "";
      const termo = busca?.toLowerCase() || "";
      return nome.includes(termo) && (categoriaAtiva === 'todos' || p.categoria === categoriaAtiva || p.categoriaId === categoriaAtiva);
    });
  }, [produtos, categoriaAtiva, busca]);

  // --- AÇÕES ---
  const iniciarVendaBalcao = useCallback(() => { if (!caixaAberto) { alert("⚠️ Abra o caixa primeiro!"); return; } setMostrarRecibo(false); setMostrarHistorico(false); setMostrarFinalizacao(false); setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 }); setCpfNota(''); setNfceStatus('idle'); setBusca(''); setTimeout(() => inputBuscaRef.current?.focus(), 100); }, [caixaAberto]);
  const abrirHistoricoAtual = useCallback(() => { setTituloHistorico("Vendas do Turno Atual"); setVendasHistoricoExibicao(vendasTurnoAtual); setMostrarHistorico(prev => !prev); }, [vendasTurnoAtual]);
  const carregarListaTurnos = useCallback(async () => { if(!estabelecimentoAtivo) return; setCarregandoHistorico(true); setMostrarListaTurnos(true); const turnos = await caixaService.listarTurnos(currentUser.uid, estabelecimentoAtivo); setListaTurnos(turnos); setCarregandoHistorico(false); }, [currentUser, estabelecimentoAtivo]);
  const visualizarVendasTurno = useCallback(async (turno) => { setCarregandoHistorico(true); setTituloHistorico(`Vendas ${formatarData(turno.dataAbertura)}`); const vendas = await vendaService.buscarVendasPorIntervalo(currentUser.uid, estabelecimentoAtivo, turno.dataAbertura, turno.dataFechamento); setVendasHistoricoExibicao(vendas); setCarregandoHistorico(false); setMostrarListaTurnos(false); setMostrarHistorico(true); }, [currentUser, estabelecimentoAtivo]);
  const prepararFechamento = useCallback(async () => { if (!caixaAberto) return; const movs = await caixaService.buscarMovimentacoes(caixaAberto.id); setMovimentacoesDoTurno(movs); setMostrarFechamentoCaixa(true); }, [caixaAberto]);
  const abrirMovimentacao = useCallback(() => { if (!caixaAberto) return alert("Caixa Fechado!"); setMostrarMovimentacao(true); }, [caixaAberto]);
  const handleSalvarMovimentacao = async (dados) => { const res = await caixaService.adicionarMovimentacao(caixaAberto.id, { ...dados, usuarioId: currentUser.uid }); if (res.success) { alert(`Sucesso!`); setMostrarMovimentacao(false); } else { alert('Erro: ' + res.error); } };
  const handleConfirmarFechamento = async (dados) => { const res = await caixaService.fecharCaixa(caixaAberto.id, dados); if (res.success) { alert('🔒 Turno encerrado!'); setCaixaAberto(null); setVendasBase([]); setMostrarFechamentoCaixa(false); setMostrarAberturaCaixa(true); setVendaAtual(null); } };
  const handleAbrirCaixa = async (saldoInicial) => { const res = await caixaService.abrirCaixa({ usuarioId: currentUser.uid, estabelecimentoId: estabelecimentoAtivo, saldoInicial }); if (res.success) { setCaixaAberto(res); setVendasBase([]); setMostrarAberturaCaixa(false); alert('✅ Turno iniciado!'); } else alert('Erro: ' + res.error); };
  const selecionarVendaHistorico = (v) => { setDadosRecibo(v); setNfceStatus(v.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle'); setNfceUrl(v.fiscal?.pdf || null); setMostrarHistorico(false); setMostrarRecibo(true); };
  const handleProdutoClick = (p) => { if (!vendaAtual) { alert('Pressione F2 para iniciar!'); return; } if (p.temVariacoes) setProdutoParaSelecao(p); else adicionarItem(p, null); };
  const adicionarItem = (p, v) => { setVendaAtual(prev => { const vid = v ? v.id : 'p'; const uid = `${p.id}-${vid}`; const ex = prev.itens.find(i => i.uid === uid); const nv = ex ? prev.itens.map(i => i.uid === uid ? {...i, quantity: i.quantity + 1} : i) : [...prev.itens, { uid, id: p.id, name: v ? `${p.name} ${v.nome}` : p.name, price: v ? Number(v.preco) : p.price, quantity: 1 }]; return { ...prev, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) }; }); setProdutoParaSelecao(null); inputBuscaRef.current?.focus(); };
  const removerItem = (uid) => setVendaAtual(prev => ({...prev, itens: prev.itens.filter(i => i.uid !== uid), total: prev.itens.filter(i => i.uid !== uid).reduce((s,i)=>s+(i.price*i.quantity),0)}));
  const finalizarVenda = async () => { setSalvando(true); const d = { estabelecimentoId: estabelecimentoAtivo, status: 'finalizada', formaPagamento, total: vendaAtual.total, itens: vendaAtual.itens, usuarioId: currentUser.uid, cliente: 'Balcão', clienteCpf: cpfNota || null, createdAt: new Date() }; const res = await vendaService.salvarVenda(d); if(res.success) { setVendasBase(p => [{...d, id: res.vendaId}, ...p]); setDadosRecibo({...d, id: res.vendaId}); setVendaAtual(null); setMostrarFinalizacao(false); setMostrarRecibo(true); } setSalvando(false); };
  const handleEmitirNfce = async () => { if(!dadosRecibo?.id) return; setNfceStatus('loading'); try { const res = await vendaService.emitirNfce(dadosRecibo.id, dadosRecibo.clienteCpf); if(res.pdfUrl){ setNfceUrl(res.pdfUrl); setNfceStatus('success'); } else alert(res.error); } catch(e){ setNfceStatus('error'); } };

  // --- EFEITOS (ATUALIZADOS PARA USAR estabelecimentoAtivo) ---
  
  // 1. Monitorar Caixa do Estabelecimento Selecionado
  useEffect(() => {
    if (!estabelecimentoAtivo || !currentUser) return;
    const init = async () => {
      setVerificandoCaixa(true);
      const caixa = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
      if (caixa) { 
          setCaixaAberto(caixa); 
          const v = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 50); 
          setVendasBase(v); 
      } else { 
          setCaixaAberto(null);
          setMostrarAberturaCaixa(true); 
      }
      setVerificandoCaixa(false);
    };
    init();
  }, [currentUser, estabelecimentoAtivo]);

  // 2. Monitorar Produtos do Estabelecimento Selecionado
  useEffect(() => {
    if (!estabelecimentoAtivo) return;
    setCarregandoProdutos(true);
    
    // Zera produtos ao trocar de loja para não misturar
    setProdutos([]); 
    setCategorias([]);

    const unsub = onSnapshot(query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio'), orderBy('ordem', 'asc')), (snap) => {
      const cats = snap.docs.map(d => ({id:d.id, ...d.data()}));
      setCategorias([{ id: 'todos', name: 'Todos', icon: '🍽️' }, ...cats.map(c => ({ id: c.nome||c.id, name: c.nome||c.id, icon: '🍕' }))]);
      
      let allMap = new Map(); 
      let count = 0;
      
      if(cats.length===0) { setProdutos([]); setCarregandoProdutos(false); return; }

      cats.forEach(c => {
        onSnapshot(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio', c.id, 'itens'), (isnap) => {
            const itens = isnap.docs.map(i => { 
                const d=i.data(); 
                const vs=d.variacoes?.filter(v=>v.ativo)||[]; 
                return { ...d, id: i.id, name: d.nome||"S/ Nome", categoria: c.nome||"Geral", categoriaId: c.id, price: vs.length>0?Math.min(...vs.map(x=>Number(x.preco))):Number(d.preco||0), temVariacoes: vs.length>0, variacoes: vs }; 
            });
            allMap.set(c.id, itens);
            setProdutos(Array.from(allMap.values()).flat());
            count++; if(count>=cats.length) setCarregandoProdutos(false);
        });
      });
      setTimeout(() => setCarregandoProdutos(false), 2000);
    });
    return () => unsub();
  }, [estabelecimentoAtivo]);

  useEffect(() => { if (formaPagamento === 'dinheiro' && valorRecebido && vendaAtual) setTroco(Math.max(0, parseFloat(valorRecebido) - vendaAtual.total)); else setTroco(0); }, [valorRecebido, formaPagamento, vendaAtual]);
  
  // Atalhos
  useEffect(() => { const h = (e) => { if (!caixaAberto && !mostrarAberturaCaixa) return; if (e.key === 'F1') { e.preventDefault(); inputBuscaRef.current?.focus(); } if (e.key === 'F2') { e.preventDefault(); iniciarVendaBalcao(); } if (e.key === 'F3') { e.preventDefault(); abrirHistoricoAtual(); } if (e.key === 'F8') { e.preventDefault(); abrirMovimentacao(); } if (e.key === 'F9') { e.preventDefault(); prepararFechamento(); } if (e.key === 'F10' && vendaAtual?.itens.length > 0) { e.preventDefault(); setMostrarFinalizacao(true); } if (e.key === 'F11') { e.preventDefault(); carregarListaTurnos(); } if (e.key === 'Escape') { setProdutoParaSelecao(null); setMostrarFinalizacao(false); setMostrarRecibo(false); setMostrarHistorico(false); setMostrarFechamentoCaixa(false); setMostrarListaTurnos(false); setMostrarMovimentacao(false); setMostrarAtalhos(false); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [caixaAberto, iniciarVendaBalcao, prepararFechamento, abrirHistoricoAtual, carregarListaTurnos, abrirMovimentacao, vendaAtual]);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {verificandoCaixa && !caixaAberto && !mostrarAberturaCaixa ? <div className="flex w-full h-full items-center justify-center font-bold text-gray-500 animate-pulse">🔒 Carregando Loja...</div> : (
        <>
          <div className="flex-1 flex flex-col h-full relative">
            <div className="bg-white px-4 py-3 border-b flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${caixaAberto ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <div>
                        {/* SELETOR DE LOJA */}
                        {estabelecimentos.length > 1 ? (
                            <select 
                                value={estabelecimentoAtivo || ''} 
                                onChange={(e) => trocarLoja(e.target.value)}
                                className="font-bold text-gray-800 text-lg leading-none bg-transparent border-none outline-none cursor-pointer hover:text-blue-600 transition"
                            >
                                {estabelecimentos.map(est => <option key={est.id} value={est.id}>{est.nome}</option>)}
                            </select>
                        ) : (
                            <h1 className="font-bold text-gray-800 text-lg leading-none">{nomeLoja}</h1>
                        )}
                        <p className="text-xs text-gray-500 font-medium">PDV v2.0 • {caixaAberto ? 'Aberto' : 'Fechado'}</p>
                    </div>
                </div>
                <div className="flex-1 max-w-lg mx-4"><div className="relative"><span className="absolute left-3 top-2.5 text-gray-400">🔍</span><input ref={inputBuscaRef} type="text" placeholder="Buscar produto (F1)..." className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 border rounded-lg outline-none transition-all text-sm" value={busca} onChange={e => setBusca(e.target.value)} /></div></div>
                <div className="flex gap-2">
                    <button onClick={carregarListaTurnos} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Histórico (F11)">📅</button>
                    <button onClick={abrirMovimentacao} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Movimentação (F8)">💸</button>
                    <button onClick={prepararFechamento} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 border border-red-100">🔒 F9</button>
                </div>
            </div>

            <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">{categorias.map(c => (<button key={c.id} onClick={() => setCategoriaAtiva(c.name === 'Todos' ? 'todos' : c.name)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${((categoriaAtiva === 'todos' && c.name === 'Todos') || categoriaAtiva === c.name) ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c.name}</button>))}</div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-100 custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {produtosFiltrados.map(p => (
                        <button key={p.id} onClick={() => handleProdutoClick(p)} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group h-60">
                            <div className="h-32 w-full bg-gray-50 flex items-center justify-center overflow-hidden relative">{p.imagem || p.foto || p.urlImagem ? (<img src={p.imagem || p.foto || p.urlImagem} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />) : (<span className="text-3xl opacity-20 grayscale">🍔</span>)}<div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md shadow-sm"><span className="text-green-700 font-bold text-xs">R$ {p.price.toFixed(2)}</span></div></div>
                            <div className="p-3 flex flex-col justify-between flex-1 w-full text-left"><div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">{p.categoria}</p><h3 className="font-bold text-gray-800 text-sm line-clamp-2 leading-tight">{p.name}</h3></div><div className="mt-2 flex justify-between items-end"><span className="text-lg font-extrabold text-green-600">R$ {p.price.toFixed(2)}</span><div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold">+</div></div></div>
                        </button>
                    ))}
                    {produtosFiltrados.length === 0 && (<div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400"><span className="text-4xl mb-2">🔍</span><p>Nada aqui.</p></div>)}
                </div>
            </div>
          </div>

          <div className="w-96 bg-slate-900 text-white flex flex-col h-full shadow-2xl relative z-20">
             <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800"><div><h2 className="font-bold text-lg flex items-center gap-2">🛒 Pedido</h2><p className="text-xs text-slate-400 font-mono">#{vendaAtual?.id?.slice(-6).toUpperCase() || '---'}</p></div><button onClick={iniciarVendaBalcao} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"><span>+</span> Nova (F2)</button></div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {vendaAtual?.itens?.length > 0 ? (vendaAtual.itens.map(i => (<div key={i.uid} className="flex justify-between items-start bg-slate-800 p-3 rounded-lg border border-slate-700 group hover:border-slate-500 transition"><div className="flex-1"><div className="flex items-baseline gap-2"><span className="font-bold text-emerald-400 text-lg">{i.quantity}x</span><span className="font-medium text-slate-200 text-sm leading-tight">{i.name}</span></div><p className="text-xs text-slate-500 mt-1">R$ {i.price.toFixed(2)}</p></div><div className="flex flex-col items-end gap-2"><span className="font-bold text-white">R$ {(i.price * i.quantity).toFixed(2)}</span><button onClick={() => removerItem(i.uid)} className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition p-1">Remover</button></div></div>))) : (<div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4"><div className="w-20 h-20 border-2 border-slate-700 rounded-full flex items-center justify-center text-3xl">🛒</div><p className="text-sm">Caixa Livre.</p></div>)}
             </div>
             {vendaAtual?.itens?.length > 0 && (<div className="p-4 bg-slate-800 border-t border-slate-700"><div className="space-y-2 mb-4"><div className="flex justify-between text-slate-400 text-sm"><span>Subtotal</span><span>R$ {vendaAtual.total.toFixed(2)}</span></div><div className="flex justify-between text-white text-3xl font-bold"><span>Total</span><span>R$ {vendaAtual.total.toFixed(2)}</span></div></div><button onClick={() => setMostrarFinalizacao(true)} className="w-full bg-emerald-500 text-white py-4 rounded-xl font-bold text-xl hover:bg-emerald-600 transition shadow-lg flex items-center justify-center gap-2"><span>PAGAR</span><span className="bg-emerald-600 text-xs px-2 py-0.5 rounded text-emerald-100">F10</span></button></div>)}
          </div>

          <ModalSelecaoVariacao produto={produtoParaSelecao} onClose={() => setProdutoParaSelecao(null)} onConfirm={adicionarItem} />
          <ModalAberturaCaixa visivel={mostrarAberturaCaixa} onAbrir={handleAbrirCaixa} usuarioNome={userData?.name} />
          <ModalFechamentoCaixa visivel={mostrarFechamentoCaixa} caixa={caixaAberto} vendasDoDia={vendasTurnoAtual} movimentacoes={movimentacoesDoTurno} onClose={() => setMostrarFechamentoCaixa(false)} onConfirmarFechamento={handleConfirmarFechamento} />
          <ModalMovimentacao visivel={mostrarMovimentacao} onClose={() => setMostrarMovimentacao(false)} onConfirmar={handleSalvarMovimentacao} />
          <ModalFinalizacao visivel={mostrarFinalizacao} venda={vendaAtual} onClose={() => setMostrarFinalizacao(false)} onFinalizar={finalizarVenda} salvando={salvando} formaPagamento={formaPagamento} setFormaPagamento={setFormaPagamento} valorRecebido={valorRecebido} setValorRecebido={setValorRecebido} troco={troco} cpfNota={cpfNota} setCpfNota={setCpfNota} />
          <ModalRecibo visivel={mostrarRecibo} dados={dadosRecibo} onClose={() => setMostrarRecibo(false)} onNovaVenda={iniciarVendaBalcao} onEmitirNfce={handleEmitirNfce} nfceStatus={nfceStatus} nfceUrl={nfceUrl} />
          <ModalHistorico visivel={mostrarHistorico} onClose={() => setMostrarHistorico(false)} vendas={vendasHistoricoExibicao} titulo={tituloHistorico} onSelecionarVenda={selecionarVendaHistorico} carregando={carregandoHistorico} />
          <ModalListaTurnos visivel={mostrarListaTurnos} onClose={() => setMostrarListaTurnos(false)} turnos={listaTurnos} carregando={carregandoHistorico} onVerVendas={visualizarVendasTurno} />
          
          <button onClick={() => setMostrarAtalhos(!mostrarAtalhos)} className="fixed bottom-4 left-4 bg-slate-800 text-white p-3 rounded-full shadow-lg hover:bg-slate-700 z-40 transition hover:scale-110 border border-slate-600">⌨️</button>
          {mostrarAtalhos && <div className="fixed bottom-16 left-4 bg-slate-800 text-white p-4 rounded-xl shadow-xl border border-slate-600 z-40 w-64 text-sm animate-fade-in-up"><h3 className="font-bold mb-2 text-emerald-400">Atalhos</h3><ul className="space-y-1 text-slate-300"><li><b>F1</b> - Buscar</li><li><b>F2</b> - Nova Venda</li><li><b>F3</b> - Histórico</li><li><b>F8</b> - Sangria/Sup</li><li><b>F9</b> - Fechar Caixa</li><li><b>F10</b> - Finalizar</li><li><b>F11</b> - Turnos</li><li><b>ESC</b> - Voltar</li></ul></div>}
        </>
      )}
    </div>
  );
};

export default PdvScreen;