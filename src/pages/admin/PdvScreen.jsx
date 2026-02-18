// src/pages/admin/PdvScreen.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  if (data.toDate) return data.toDate().toLocaleDateString('pt-BR');
  if (data instanceof Date) return data.toLocaleDateString('pt-BR');
  return '-';
};

const formatarMoeda = (valor) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

// --- MODAIS ---
// (Mantidos iguais, apenas garantindo que recebam as props corretas se necessário)

const ModalSelecaoVariacao = ({ produto, onClose, onConfirm }) => { 
  if(!produto) return null; 
  return (
    <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm animate-fadeIn no-print">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl transform animate-slideUp">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h3 className="font-bold text-xl text-gray-800">{produto.name}</h3>
          <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
        </div>
        <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {produto.variacoes?.map(v => (
            <button key={v.id} onClick={() => onConfirm(produto, v)} className="flex justify-between items-center p-4 border border-gray-100 bg-gray-50 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
              <span className="font-semibold text-gray-700 group-hover:text-emerald-700">{v.nome}</span>
              <span className="text-emerald-600 font-bold bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{formatarMoeda(v.preco)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  ); 
};

const ModalAberturaCaixa = ({ visivel, onAbrir, usuarioNome }) => { 
  const [saldo, setSaldo] = useState(''); 
  if(!visivel) return null; 
  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fadeIn no-print">
      <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl transform animate-slideUp">
        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 text-emerald-500 shadow-inner">🔓</div>
        <h2 className="text-3xl font-bold mb-2 text-gray-800">Abrir Caixa</h2>
        <p className="text-gray-500 mb-8">Olá <b>{usuarioNome}</b>, informe o fundo:</p>
        <div className="relative mb-6 group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold group-focus-within:text-emerald-600 transition-colors">R$</span>
          <input type="number" className="w-full p-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-2xl text-4xl font-bold text-gray-800 focus:border-emerald-500 focus:bg-white outline-none transition-all placeholder-gray-300" placeholder="0,00" autoFocus onChange={e => setSaldo(e.target.value)} value={saldo} step="0.01" />
        </div>
        <button onClick={() => onAbrir(saldo)} disabled={!saldo} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-bold text-xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200 hover:scale-[1.02]">INICIAR VENDAS</button>
      </div>
    </div>
  ); 
};

const ModalFechamentoCaixa = ({ visivel, caixa, vendasDoDia, movimentacoes, onClose, onConfirmarFechamento }) => { 
  const [valorInformado, setValorInformado] = useState(''); 
  if(!visivel||!caixa) return null; 
  const da=caixa.dataAbertura?.toDate?caixa.dataAbertura.toDate():new Date(caixa.dataAbertura);
  const vt=vendasDoDia.filter(v=>{const dv=v.createdAt?.toDate?v.createdAt.toDate():new Date(v.createdAt); return v.usuarioId===caixa.usuarioId && dv>=da;});
  const tDin=vt.filter(v=>v.formaPagamento==='dinheiro').reduce((a,b)=>a+(b.total||0),0);
  const tOut=vt.filter(v=>v.formaPagamento!=='dinheiro').reduce((a,b)=>a+(b.total||0),0);
  const tSup=movimentacoes?.totalSuprimento||0; const tSan=movimentacoes?.totalSangria||0;
  const esp=parseFloat(caixa.saldoInicial||0)+tDin+tSup-tSan; const dif=parseFloat(valorInformado||0)-esp;
  
  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fadeIn no-print">
      <div className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl transform animate-slideUp">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Fechar Turno</h2>
            <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200">✕</button>
        </div>
        <div className="bg-gray-50 p-6 rounded-2xl mb-6 text-center border border-gray-100">
            <p className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">ESPERADO (DINHEIRO)</p>
            <p className="text-4xl font-black text-gray-800">{formatarMoeda(esp)}</p>
        </div>
        <div className="mb-6">
            <label className="block text-sm font-bold text-gray-500 mb-2">Valor na Gaveta</label>
            <input type="number" step="0.01" className={`w-full p-4 border-2 rounded-2xl text-2xl font-bold text-center outline-none transition-colors ${Math.abs(dif)>0.05 ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`} placeholder="0,00" autoFocus onChange={e=>setValorInformado(e.target.value)} value={valorInformado}/>
        </div>
        <button onClick={()=>onConfirmarFechamento({saldoFinalInformado:parseFloat(valorInformado||0),diferenca:dif,resumoVendas:{dinheiro:tDin,outros:tOut,suprimento:tSup,sangria:tSan,total:tDin+tOut,qtd:vt.length}})} className="w-full bg-gray-900 text-white p-4 rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-xl">FINALIZAR TURNO</button>
      </div>
    </div>
  ); 
};

const ModalMovimentacao = ({ visivel, onClose, onConfirmar }) => { 
    const [t,sT]=useState('sangria'); const [v,sV]=useState(''); const [d,sD]=useState(''); 
    if(!visivel) return null; 
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9400] p-4 backdrop-blur-sm no-print">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                    <button onClick={()=>sT('sangria')} className={`flex-1 py-2 rounded-lg font-bold transition ${t==='sangria'?'bg-white text-red-500 shadow':'text-gray-400 hover:text-gray-600'}`}>Sangria</button>
                    <button onClick={()=>sT('suprimento')} className={`flex-1 py-2 rounded-lg font-bold transition ${t==='suprimento'?'bg-white text-emerald-500 shadow':'text-gray-400 hover:text-gray-600'}`}>Suprimento</button>
                </div>
                <input type="number" className="w-full p-4 border-2 border-gray-100 bg-gray-50 rounded-xl text-3xl text-center font-bold mb-3 focus:border-blue-500 outline-none text-gray-800 placeholder-gray-300" placeholder="0,00" autoFocus onChange={e=>sV(e.target.value)} value={v}/>
                <input type="text" className="w-full p-3 border border-gray-200 bg-white rounded-xl mb-4 outline-none text-gray-800 placeholder-gray-400" placeholder="Motivo" onChange={e=>sD(e.target.value)} value={d}/>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 bg-gray-100 p-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200">Cancelar</button>
                    <button onClick={()=>{if(!v||!d)return; onConfirmar({tipo:t,valor:parseFloat(v),descricao:d}); sV(''); sD('');}} className={`flex-1 text-white p-3 rounded-xl font-bold ${t==='sangria'?'bg-red-500 hover:bg-red-600':'bg-emerald-500 hover:bg-emerald-600'}`}>SALVAR</button>
                </div>
            </div>
        </div>
    ); 
};

const ModalFinalizacao = ({ visivel, venda, onClose, onFinalizar, salvando, formaPagamento, setFormaPagamento, valorRecebido, setValorRecebido, troco, cpfNota, setCpfNota }) => { 
    if(!visivel||!venda) return null; 
    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm no-print">
            <div className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl">
                <h2 className="text-5xl font-black text-center mb-8 text-gray-800 tracking-tighter">{formatarMoeda(venda.total)}</h2>
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {['dinheiro','cartao','pix'].map(f=>
                        <button key={f} onClick={()=>{setFormaPagamento(f);if(f!=='dinheiro')setValorRecebido('');}} 
                            className={`p-4 rounded-2xl font-bold uppercase text-xs flex flex-col items-center gap-2 transition-all border ${formaPagamento===f?'bg-gray-800 border-gray-800 text-white shadow-lg scale-105':'bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
                            <span className="text-2xl">{f==='dinheiro'?'💵':f==='cartao'?'💳':'💠'}</span>{f}
                        </button>
                    )}
                </div>
                {formaPagamento==='dinheiro' && (
                    <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <div className="flex justify-between mb-2">
                            <span className="text-xs font-bold uppercase text-gray-400">Valor Recebido</span>
                            {troco>0&&<span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">Troco: {formatarMoeda(troco)}</span>}
                        </div>
                        <input type="number" step="0.01" className="w-full bg-transparent text-3xl font-bold text-gray-800 outline-none placeholder-gray-300" autoFocus value={valorRecebido} onChange={e=>setValorRecebido(e.target.value)} placeholder="0,00"/>
                    </div>
                )}
                <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl mb-6 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder-gray-400" placeholder="CPF na Nota (Opcional)" value={cpfNota} onChange={e=>setCpfNota(e.target.value)} />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 p-4 rounded-2xl font-bold text-gray-500 transition-all">Voltar</button>
                    <button onClick={onFinalizar} disabled={salvando||(formaPagamento==='dinheiro'&&(!valorRecebido||parseFloat(valorRecebido)<venda.total))} className="flex-1 bg-emerald-600 text-white p-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50">FINALIZAR</button>
                </div>
            </div>
        </div>
    ); 
};

const ModalRecibo = ({ visivel, dados, onClose, onNovaVenda, onEmitirNfce, nfceStatus, nfceUrl }) => { 
    if(!visivel) return null; 
    return (
        <div id="recibo-overlay" className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
            <div id="recibo-content" className="bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 bg-gray-100 hover:bg-red-100 hover:text-red-500 p-2 rounded-full transition-colors no-print">✕</button>
                <div className="text-center border-b border-dashed border-gray-200 pb-6 mb-6">
                    <h2 className="font-black text-2xl text-gray-800 uppercase tracking-wide">RECIBO</h2>
                    <p className="text-gray-400 text-xs font-mono mt-1">#{dados.id.slice(-6)} • {formatarData(dados.createdAt)}</p>
                </div>
                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto custom-scrollbar print:max-h-none print:overflow-visible">
                    {dados.itens.map(i=><div key={i.uid} className="flex justify-between text-sm text-gray-600"><span><b className="text-gray-800">{i.quantity}x</b> {i.name}</span><span className="font-mono">{formatarMoeda(i.price*i.quantity)}</span></div>)}
                </div>
                <div className="flex justify-between text-xl font-black text-gray-800 mb-8 pt-4 border-t border-dashed border-gray-200"><span>TOTAL</span><span>{formatarMoeda(dados.total)}</span></div>
                <div className="grid gap-3 no-print">
                    <button onClick={onEmitirNfce} disabled={nfceStatus==='loading'} className="w-full bg-orange-500 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-orange-600 transition-all">{nfceStatus==='loading'?'Processando...':nfceUrl?'📄 Visualizar Nota':'🧾 Emitir NFC-e'}</button>
                    <div className="flex gap-3">
                        <button onClick={()=>window.print()} className="flex-1 border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">Imprimir</button>
                        <button onClick={onClose} className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg transition-all">Próximo</button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">Pressione <b className="font-bold border border-gray-300 rounded px-1">ESC</b> para sair</p>
                </div>
            </div>
        </div>
    ); 
};

const ModalHistorico = ({ visivel, onClose, vendas, onSelecionarVenda, carregando, titulo }) => { 
    if(!visivel) return null; 
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9300] p-4 backdrop-blur-sm no-print">
            <div className="bg-white border border-gray-200 rounded-[2rem] shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden">
                <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">{titulo||"Histórico"}</h2>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 text-gray-500">✕</button>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-gray-50 custom-scrollbar">
                    {vendas.map(v=><div key={v.id} className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm mb-3 border border-gray-100 hover:shadow-md transition-all">
                        <div>
                            <span className="font-bold text-gray-800 text-lg">#{v.id.slice(-4)}</span>
                            <div className="flex gap-2 text-sm text-gray-400 mt-1"><span>{formatarHora(v.createdAt)}</span><span>•</span><span className="uppercase text-emerald-600">{v.formaPagamento}</span></div>
                        </div>
                        <div className="flex items-center gap-6">
                            <span className="font-bold text-xl text-gray-800">{formatarMoeda(v.total)}</span>
                            <button onClick={()=>onSelecionarVenda(v)} className="bg-gray-100 text-gray-600 px-5 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors">Detalhes</button>
                        </div>
                    </div>)}
                </div>
            </div>
        </div>
    ); 
};

const ModalListaTurnos = ({ visivel, onClose, turnos, carregando, onVerVendas }) => { 
    if(!visivel) return null; 
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9200] p-4 backdrop-blur-sm no-print">
            <div className="bg-white border border-gray-200 rounded-[2rem] shadow-2xl max-w-5xl w-full h-[80vh] flex flex-col overflow-hidden">
                <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Meus Turnos</h2>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 text-gray-500">✕</button>
                </div>
                <div className="flex-1 overflow-auto p-8 bg-gray-50 custom-scrollbar">
                    <div className="space-y-3">
                        {turnos.map(t=><div key={t.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full ${t.status==='aberto'?'bg-emerald-500':'bg-red-500'}`}></div>
                                <div><p className="font-bold text-gray-800">{formatarData(t.dataAbertura)}</p><p className="text-xs text-gray-400 uppercase font-bold tracking-wider">{t.status}</p></div>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-right"><p className="text-xs text-gray-400 font-bold uppercase">Total Vendido</p><p className="text-xl font-black text-gray-800">{formatarMoeda(t.resumoVendas?.total)}</p></div>
                                <button onClick={()=>onVerVendas(t)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold transition-all">Ver Vendas</button>
                            </div>
                        </div>)}
                    </div>
                </div>
            </div>
        </div>
    ); 
};

// --- COMPONENTE PRINCIPAL ---

const PdvScreen = () => {
  const { userData, currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Estados
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [estabelecimentoAtivo, setEstabelecimentoAtivo] = useState(null);
  const [nomeLoja, setNomeLoja] = useState('...');
  const [vendaAtual, setVendaAtual] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [vendasBase, setVendasBase] = useState([]); 
  const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
  const [tituloHistorico, setTituloHistorico] = useState("Histórico");
  const [listaTurnos, setListaTurnos] = useState([]);
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

  // --- LÓGICA DE CARREGAMENTO ---
  useEffect(() => {
    if (!userData || !currentUser) return;
    const carregarLojas = async () => {
        let listaIds = [];
        if (userData.estabelecimentosGerenciados && Array.isArray(userData.estabelecimentosGerenciados)) listaIds = userData.estabelecimentosGerenciados;
        else if (currentUser.uid) listaIds = [currentUser.uid];
        if (listaIds.length === 0) return;
        const promessas = listaIds.map(async (id) => {
            try { const docRef = doc(db, 'estabelecimentos', id); const docSnap = await getDoc(docRef); return { id, nome: docSnap.exists() ? (docSnap.data().nome || 'Loja Sem Nome') : 'Loja Desconhecida' }; } catch (e) { return { id, nome: 'Erro' }; }
        });
        const lojasCarregadas = await Promise.all(promessas);
        setEstabelecimentos(lojasCarregadas);
        if (!estabelecimentoAtivo && lojasCarregadas.length > 0) { setEstabelecimentoAtivo(lojasCarregadas[0].id); setNomeLoja(lojasCarregadas[0].nome); }
    };
    carregarLojas();
  }, [userData, currentUser]);

  const trocarLoja = (id) => { const loja = estabelecimentos.find(e => e.id === id); if (loja) { setEstabelecimentoAtivo(id); setNomeLoja(loja.nome); setCaixaAberto(null); setVendasBase([]); setProdutos([]); } };

  const vendasTurnoAtual = useMemo(() => {
    if (!caixaAberto) return [];
    let timeAbertura; try { timeAbertura = caixaAberto.dataAbertura?.toDate ? caixaAberto.dataAbertura.toDate().getTime() : new Date(caixaAberto.dataAbertura).getTime(); } catch { timeAbertura = Date.now(); }
    return vendasBase.filter(v => { let timeVenda; try { timeVenda = v.createdAt?.toDate ? v.createdAt.toDate().getTime() : new Date(v.createdAt).getTime(); } catch { return false; } return v.usuarioId === currentUser.uid && timeVenda >= (timeAbertura - 60000); });
  }, [vendasBase, caixaAberto, currentUser]);

  // --- FILTRO INTELIGENTE ---
  const produtosFiltrados = useMemo(() => {
    const termo = busca?.toLowerCase().trim() || "";
    return produtos.filter(p => {
        const matchCategoria = categoriaAtiva === 'todos' || p.categoria === categoriaAtiva || p.categoriaId === categoriaAtiva;
        if (!matchCategoria) return false;
        if (!termo) return true;
        const nome = p.name?.toLowerCase() || "";
        const codigo = p.codigoBarras ? String(p.codigoBarras).toLowerCase() : "";
        const id = p.id ? String(p.id).toLowerCase() : "";
        const referencia = p.referencia ? String(p.referencia).toLowerCase() : "";
        return nome.includes(termo) || codigo.includes(termo) || id.includes(termo) || referencia.includes(termo);
    });
  }, [produtos, categoriaAtiva, busca]);

  const iniciarVendaBalcao = useCallback(() => { 
      if (!caixaAberto) { return; } 
      setMostrarRecibo(false); 
      setMostrarHistorico(false); 
      setMostrarFinalizacao(false); 
      setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 }); 
      setCpfNota(''); 
      setNfceStatus('idle'); 
      setBusca(''); 
      setTimeout(() => inputBuscaRef.current?.focus(), 100); 
  }, [caixaAberto]);

  const abrirHistoricoAtual = useCallback(() => { setTituloHistorico("Vendas Turno Atual"); setVendasHistoricoExibicao(vendasTurnoAtual); setMostrarHistorico(prev => !prev); }, [vendasTurnoAtual]);
  const carregarListaTurnos = useCallback(async () => { if(!estabelecimentoAtivo) return; setCarregandoHistorico(true); setMostrarListaTurnos(true); const t = await caixaService.listarTurnos(currentUser.uid, estabelecimentoAtivo); setListaTurnos(t); setCarregandoHistorico(false); }, [currentUser, estabelecimentoAtivo]);
  const visualizarVendasTurno = useCallback(async (turno) => { setCarregandoHistorico(true); setTituloHistorico(`Vendas ${formatarData(turno.dataAbertura)}`); const v = await vendaService.buscarVendasPorIntervalo(currentUser.uid, estabelecimentoAtivo, turno.dataAbertura, turno.dataFechamento); setVendasHistoricoExibicao(v); setCarregandoHistorico(false); setMostrarListaTurnos(false); setMostrarHistorico(true); }, [currentUser, estabelecimentoAtivo]);
  const prepararFechamento = useCallback(async () => { if (!caixaAberto) return; const movs = await caixaService.buscarMovimentacoes(caixaAberto.id); setMovimentacoesDoTurno(movs); setMostrarFechamentoCaixa(true); }, [caixaAberto]);
  const abrirMovimentacao = useCallback(() => { if (!caixaAberto) return alert("Caixa Fechado!"); setMostrarMovimentacao(true); }, [caixaAberto]);
  const handleSalvarMovimentacao = async (dados) => { const res = await caixaService.adicionarMovimentacao(caixaAberto.id, { ...dados, usuarioId: currentUser.uid }); if (res.success) { alert(`Sucesso!`); setMostrarMovimentacao(false); } else { alert('Erro: ' + res.error); } };
  const handleConfirmarFechamento = async (dados) => { const res = await caixaService.fecharCaixa(caixaAberto.id, dados); if (res.success) { alert('🔒 Turno encerrado!'); setCaixaAberto(null); setVendasBase([]); setMostrarFechamentoCaixa(false); setMostrarAberturaCaixa(true); setVendaAtual(null); } };
  
  const handleAbrirCaixa = async (saldoInicial) => { 
      const res = await caixaService.abrirCaixa({ usuarioId: currentUser.uid, estabelecimentoId: estabelecimentoAtivo, saldoInicial }); 
      if (res.success) { 
          setCaixaAberto(res); 
          setVendasBase([]); 
          setMostrarAberturaCaixa(false); 
          setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
          setTimeout(() => inputBuscaRef.current?.focus(), 500);
      } else alert('Erro: ' + res.error); 
  };
  
  const selecionarVendaHistorico = (v) => { setDadosRecibo(v); setNfceStatus(v.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle'); setNfceUrl(v.fiscal?.pdf || null); setMostrarHistorico(false); setMostrarRecibo(true); };
  
  const handleProdutoClick = (p) => { 
      if (!vendaAtual) { 
          const novaVenda = { id: Date.now().toString(), itens: [], total: 0 };
          setVendaAtual(novaVenda);
          setTimeout(() => { if (p.temVariacoes) setProdutoParaSelecao(p); else adicionarItem(p, null, novaVenda); }, 0);
          return;
      } 
      if (p.temVariacoes) setProdutoParaSelecao(p); else adicionarItem(p, null); 
  };
  
  const adicionarItem = (p, v, vendaRef = null) => { 
      setVendaAtual(prev => { 
          const target = prev || vendaRef;
          if (!target) return null;
          const vid = v ? v.id : 'p'; 
          const uid = `${p.id}-${vid}`; 
          const ex = target.itens.find(i => i.uid === uid); 
          const nv = ex ? target.itens.map(i => i.uid === uid ? {...i, quantity: i.quantity + 1} : i) : [...target.itens, { uid, id: p.id, name: v ? `${p.name} ${v.nome}` : p.name, price: v ? Number(v.preco) : p.price, quantity: 1 }]; 
          return { ...target, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) }; 
      }); 
      setProdutoParaSelecao(null); 
      setBusca(''); 
      inputBuscaRef.current?.focus(); 
  };
  
  const removerItem = (uid) => setVendaAtual(prev => ({...prev, itens: prev.itens.filter(i => i.uid !== uid), total: prev.itens.filter(i => i.uid !== uid).reduce((s,i)=>s+(i.price*i.quantity),0)}));
  
  const finalizarVenda = async () => { setSalvando(true); const d = { estabelecimentoId: estabelecimentoAtivo, status: 'finalizada', formaPagamento, total: vendaAtual.total, itens: vendaAtual.itens, usuarioId: currentUser.uid, cliente: 'Balcão', clienteCpf: cpfNota || null, createdAt: new Date() }; const res = await vendaService.salvarVenda(d); if(res.success) { setVendasBase(p => [{...d, id: res.vendaId}, ...p]); setDadosRecibo({...d, id: res.vendaId}); setVendaAtual(null); setMostrarFinalizacao(false); setMostrarRecibo(true); } setSalvando(false); };
  const handleEmitirNfce = async () => { if(!dadosRecibo?.id) return; setNfceStatus('loading'); try { const res = await vendaService.emitirNfce(dadosRecibo.id, dadosRecibo.clienteCpf); if(res.pdfUrl){ setNfceUrl(res.pdfUrl); setNfceStatus('success'); } else alert(res.error); } catch(e){ setNfceStatus('error'); } };

  useEffect(() => { if (!estabelecimentoAtivo || !currentUser) return; const i = async () => { setVerificandoCaixa(true); const c = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo); if (c) { setCaixaAberto(c); const v = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 50); setVendasBase(v); setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 }); setTimeout(() => inputBuscaRef.current?.focus(), 500); } else { setMostrarAberturaCaixa(true); } setVerificandoCaixa(false); }; i(); }, [currentUser, estabelecimentoAtivo]);
  useEffect(() => { if (!estabelecimentoAtivo) return; setCarregandoProdutos(true); setProdutos([]); setCategorias([]); const u = onSnapshot(query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio'), orderBy('ordem', 'asc')), (s) => { const c = s.docs.map(d => ({id:d.id, ...d.data()})); setCategorias([{ id: 'todos', name: 'Todos', icon: '🍽️' }, ...c.map(x => ({ id: x.nome||x.id, name: x.nome||x.id, icon: '🍕' }))]); let all = new Map(); let cp = 0; if(c.length===0){setProdutos([]); setCarregandoProdutos(false); return;} c.forEach(k => { onSnapshot(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio', k.id, 'itens'), (is) => { const it = is.docs.map(i => { const d=i.data(); const vs=d.variacoes?.filter(v=>v.ativo)||[]; return { ...d, id: i.id, name: d.nome||"S/ Nome", categoria: k.nome||"Geral", categoriaId: k.id, price: vs.length>0?Math.min(...vs.map(x=>Number(x.preco))):Number(d.preco||0), temVariacoes: vs.length>0, variacoes: vs }; }); all.set(k.id, it); setProdutos(Array.from(all.values()).flat()); cp++; if(cp>=c.length) setCarregandoProdutos(false); }); }); }); return () => u(); }, [estabelecimentoAtivo]);
  useEffect(() => { if (formaPagamento === 'dinheiro' && valorRecebido && vendaAtual) setTroco(Math.max(0, parseFloat(valorRecebido) - vendaAtual.total)); else setTroco(0); }, [valorRecebido, formaPagamento, vendaAtual]);
  useEffect(() => { const h = (e) => { 
      if (!caixaAberto && !mostrarAberturaCaixa) return; 
      if (e.key === 'F1') { e.preventDefault(); inputBuscaRef.current?.focus(); } 
      if (e.key === 'F2') { e.preventDefault(); iniciarVendaBalcao(); } 
      if (e.key === 'F3') { e.preventDefault(); abrirHistoricoAtual(); } 
      if (e.key === 'F8') { e.preventDefault(); abrirMovimentacao(); } 
      if (e.key === 'F9') { e.preventDefault(); prepararFechamento(); } 
      if (e.key === 'F10' && vendaAtual?.itens.length > 0) { e.preventDefault(); setMostrarFinalizacao(true); } 
      if (e.key === 'F11') { e.preventDefault(); carregarListaTurnos(); } 
      if (e.key === 'Escape') { setProdutoParaSelecao(null); setMostrarFinalizacao(false); setMostrarRecibo(false); setMostrarHistorico(false); setMostrarFechamentoCaixa(false); setMostrarListaTurnos(false); setMostrarMovimentacao(false); } 
    }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [caixaAberto, iniciarVendaBalcao, prepararFechamento, abrirHistoricoAtual, carregarListaTurnos, abrirMovimentacao, vendaAtual]);

  // --- BARRA DE ATALHOS AGORA COM BOTÕES CLICÁVEIS ---
  const BarraAtalhos = () => (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-2 z-[9990] flex justify-center gap-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] no-print overflow-x-auto">
       <div className="flex gap-2 min-w-max">
          <button onClick={() => inputBuscaRef.current?.focus()} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F1</kbd> BUSCAR</button>
          <button onClick={iniciarVendaBalcao} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F2</kbd> NOVA</button>
          <button onClick={abrirMovimentacao} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F8</kbd> MOVIM.</button>
          <button onClick={prepararFechamento} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F9</kbd> FECHAR</button>
          <button onClick={() => setMostrarFinalizacao(true)} disabled={!vendaAtual?.itens.length} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all ${vendaAtual?.itens.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 animate-pulse' : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'}`}><kbd className="bg-white/20 border border-white/20 px-1.5 rounded text-white font-mono">F10</kbd> PAGAR</button>
          <button onClick={carregarListaTurnos} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F11</kbd> TURNOS</button>
       </div>
    </div>
  );

  return (
    <div id="main-app-wrapper" className="fixed inset-0 h-[100dvh] w-screen bg-gray-100 font-sans overflow-hidden text-gray-800 selection:bg-emerald-200 selection:text-emerald-900 flex flex-row z-[100]">
      {verificandoCaixa && !caixaAberto && !mostrarAberturaCaixa ? <div className="flex w-full h-full items-center justify-center font-bold text-gray-400 animate-pulse">Carregando Sistema...</div> : (
        <>
          {/* LADO ESQUERDO: CATÁLOGO */}
          <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50/50 pb-16">
            <div className="bg-white px-6 py-4 flex flex-col md:flex-row justify-between items-center border-b border-gray-200 z-10 shrink-0 shadow-sm gap-4">
               <div className="flex flex-col w-full md:w-auto">
                  <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${caixaAberto ? 'bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse' : 'bg-red-500'}`}></div>
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{caixaAberto ? 'CAIXA OPERANTE' : 'FECHADO'}</span>
                  </div>
                  {estabelecimentos.length > 1 ? (
                      <select value={estabelecimentoAtivo || ''} onChange={(e) => trocarLoja(e.target.value)} className="text-xl font-bold text-gray-800 bg-transparent border-none outline-none cursor-pointer -ml-1 mt-1 hover:text-emerald-600 transition w-full">
                          {estabelecimentos.map(est => <option key={est.id} value={est.id}>{est.nome}</option>)}
                      </select>
                  ) : (<h1 className="text-xl font-bold text-gray-800 mt-1 tracking-tight truncate">{nomeLoja}</h1>)}
               </div>
               
               <div className="flex items-center gap-3 w-full md:w-auto">
                  <button onClick={() => navigate('/admin/config-fiscal')} className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-emerald-600 rounded-xl transition-all border border-gray-100 shrink-0" title="Configurações Fiscais">⚙️</button>
                  <div className="relative group w-full md:w-96">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 group-focus-within:text-emerald-600 transition-colors">🔍</span>
                      <input ref={inputBuscaRef} type="text" placeholder="Buscar (F1)" className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-transparent rounded-xl text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all placeholder-gray-400 shadow-inner focus:shadow-none" value={busca} onChange={e => setBusca(e.target.value)} />
                  </div>
               </div>
            </div>

            <div className="px-6 py-4 flex gap-3 overflow-x-auto scrollbar-hide shrink-0 border-b border-gray-200 bg-white">
                {categorias.map(c => (
                    <button key={c.id} onClick={() => setCategoriaAtiva(c.name === 'Todos' ? 'todos' : c.name)} className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${((categoriaAtiva === 'todos' && c.name === 'Todos') || categoriaAtiva === c.name) ? 'bg-gray-900 border-gray-900 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}>{c.name}</button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                {carregandoProdutos ? (
                    <div className="h-full flex items-center justify-center text-gray-400"><div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-300 border-t-emerald-500"></div></div>
                ) : (
                    // MUDANÇA: Grid responsivo melhorado (minmax)
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-20">
                        {produtosFiltrados.map(p => (
                            <button key={p.id} onClick={() => handleProdutoClick(p)} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:border-emerald-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group flex flex-col h-52 relative overflow-hidden">
                                <div className="h-24 w-full bg-gray-50 rounded-xl mb-3 overflow-hidden relative flex items-center justify-center shrink-0 border border-gray-50">
                                    {p.imagem || p.foto || p.urlImagem ? (
                                        <img src={p.imagem || p.foto || p.urlImagem} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <span className="text-4xl opacity-20 grayscale">🍔</span>
                                    )}
                                </div>
                                <div className="flex flex-col justify-between flex-1 px-1">
                                    <h3 className="font-semibold text-gray-700 text-sm leading-tight line-clamp-2 group-hover:text-emerald-700 transition-colors text-left">{p.name}</h3>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="font-bold text-emerald-600 text-lg">{formatarMoeda(p.price)}</span>
                                        <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
          </div>

          {/* LADO DIREITO: CARRINHO (RESPONSIVO - ESCONDE EM TELA MUITO PEQUENA SE QUISER, MAS MANTIVE FIXO POR ENQUANTO) */}
          <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full min-h-0 shadow-2xl relative z-30 shrink-0 pb-16 hidden md:flex">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                <div>
                    <h2 className="font-black text-xl text-gray-800 flex items-center gap-2">🛒 Pedido</h2>
                    <p className="text-xs text-gray-400 font-mono mt-1">ID: {vendaAtual?.id?.slice(-6).toUpperCase() || '---'}</p>
                </div>
                <button onClick={iniciarVendaBalcao} className="bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 px-3 py-2 rounded-xl text-[10px] font-bold transition flex items-center gap-1 border border-gray-200 hover:border-red-100" title="Limpar venda atual">🗑️ LIMPAR</button>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-white">
                {vendaAtual?.itens?.length > 0 ? (
                    vendaAtual.itens.map(i => (
                        <div key={i.uid} className="flex justify-between items-start bg-gray-50 p-3 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-white hover:shadow-md transition group animate-fadeIn">
                            <div className="flex-1 pr-2">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="font-bold text-emerald-600 text-base">{i.quantity}x</span>
                                    <span className="font-medium text-gray-700 text-sm leading-tight line-clamp-2">{i.name}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 pl-6">{formatarMoeda(i.price)} un.</p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                                <span className="font-bold text-gray-900 tracking-wide">{formatarMoeda(i.price * i.quantity)}</span>
                                <button onClick={() => removerItem(i.uid)} className="text-red-400 hover:text-red-600 text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all bg-red-50 px-2 py-1 rounded border border-red-100">Excluir</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 opacity-70">
                        <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center text-4xl">🛍️</div>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Caixa Livre</p>
                    </div>
                )}
             </div>

             {/* Footer Carrinho */}
             {vendaAtual?.itens?.length > 0 && (
                 <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40 shrink-0">
                    <div className="space-y-2 mb-6">
                        <div className="flex justify-between text-gray-400 text-xs font-bold uppercase tracking-wider"><span>Subtotal</span><span>{formatarMoeda(vendaAtual.total)}</span></div>
                        <div className="flex justify-between text-gray-800 text-3xl font-black mt-1 items-baseline tracking-tight"><span className="text-lg font-bold text-gray-300">TOTAL</span><span className="text-gray-900">{formatarMoeda(vendaAtual.total)}</span></div>
                    </div>
                    <button onClick={() => setMostrarFinalizacao(true)} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xl hover:bg-black transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 group relative overflow-hidden">
                        <span className="relative z-10">PAGAR</span>
                    </button>
                 </div>
             )}
          </div>

          <BarraAtalhos />

          {/* Modais Componentes */}
          <ModalSelecaoVariacao produto={produtoParaSelecao} onClose={() => setProdutoParaSelecao(null)} onConfirm={adicionarItem} />
          <ModalAberturaCaixa visivel={mostrarAberturaCaixa} onAbrir={handleAbrirCaixa} usuarioNome={userData?.name} />
          <ModalFechamentoCaixa visivel={mostrarFechamentoCaixa} caixa={caixaAberto} vendasDoDia={vendasTurnoAtual} movimentacoes={movimentacoesDoTurno} onClose={() => setMostrarFechamentoCaixa(false)} onConfirmarFechamento={handleConfirmarFechamento} />
          <ModalMovimentacao visivel={mostrarMovimentacao} onClose={() => setMostrarMovimentacao(false)} onConfirmar={handleSalvarMovimentacao} />
          <ModalFinalizacao visivel={mostrarFinalizacao} venda={vendaAtual} onClose={() => setMostrarFinalizacao(false)} onFinalizar={finalizarVenda} salvando={salvando} formaPagamento={formaPagamento} setFormaPagamento={setFormaPagamento} valorRecebido={valorRecebido} setValorRecebido={setValorRecebido} troco={troco} cpfNota={cpfNota} setCpfNota={setCpfNota} />
          <ModalRecibo visivel={mostrarRecibo} dados={dadosRecibo} onClose={() => {setMostrarRecibo(false); iniciarVendaBalcao();}} onNovaVenda={iniciarVendaBalcao} onEmitirNfce={handleEmitirNfce} nfceStatus={nfceStatus} nfceUrl={nfceUrl} />
          <ModalHistorico visivel={mostrarHistorico} onClose={() => setMostrarHistorico(false)} vendas={vendasHistoricoExibicao} titulo={tituloHistorico} onSelecionarVenda={selecionarVendaHistorico} carregando={carregandoHistorico} />
          <ModalListaTurnos visivel={mostrarListaTurnos} onClose={() => setMostrarListaTurnos(false)} turnos={listaTurnos} carregando={carregandoHistorico} onVerVendas={visualizarVendasTurno} />
        </>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* --- CSS CORREÇÃO DE IMPRESSÃO --- */
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          body * {
            visibility: hidden;
          }
          
          #main-app-wrapper {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            display: block !important;
          }

          #recibo-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: none !important;
            visibility: visible !important;
            z-index: 9999 !important;
            display: block !important;
          }

          #recibo-content, #recibo-content * {
            visibility: visible !important;
          }

          #recibo-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }

          .no-print {
            display: none !important;
          }
          
          .bg-gray-50, .bg-gray-100 {
            background-color: white !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PdvScreen;