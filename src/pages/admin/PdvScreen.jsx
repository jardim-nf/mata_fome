// src/pages/admin/PdvScreen.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { vendaService } from '../../services/vendaService';
import { caixaService } from '../../services/caixaService';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';

// IMPORTAÇÃO DOS MODAIS E FUNÇÕES AUXILIARES
import { 
    formatarMoeda, formatarData, formatarHora,
    ModalEdicaoItemCarrinho, ModalSelecaoVariacao, ModalAberturaCaixa, 
    ModalFechamentoCaixa, ModalMovimentacao, ModalFinalizacao, 
    ModalRecibo, ModalHistorico, ModalListaTurnos, ModalResumoTurno, ModalVendasSuspensas,
    ModalPesoBalanca
} from '../../components/PdvModals';

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
    const [mostrarCarrinhoMobile, setMostrarCarrinhoMobile] = useState(false);

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
    const [mostrarResumoTurno, setMostrarResumoTurno] = useState(false);
    const [turnoSelecionadoResumo, setTurnoSelecionadoResumo] = useState(null);
    const [itemParaEditar, setItemParaEditar] = useState(null);
    const [produtoParaPeso, setProdutoParaPeso] = useState(null); // Estado da Balança

    // Vendas em Espera
    const [vendasSuspensas, setVendasSuspensas] = useState([]);
    const [mostrarSuspensas, setMostrarSuspensas] = useState(false);

    // Pagamento
    const [dadosRecibo, setDadosRecibo] = useState(null);
    const [cpfNota, setCpfNota] = useState('');
    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);
    const [produtoParaSelecao, setProdutoParaSelecao] = useState(null);
    const [pagamentosAdicionados, setPagamentosAdicionados] = useState([]);
    const [salvando, setSalvando] = useState(false);
    const [descontoValor, setDescontoValor] = useState('');
    const [acrescimoValor, setAcrescimoValor] = useState('');
    
    // Leitor de Código de Barras
    const [barcodeAviso, setBarcodeAviso] = useState(null);
    const bufferCodigoBarras = useRef('');
    const timeoutCodigoBarras = useRef(null);

    const inputBuscaRef = useRef(null);

    // --- LÓGICA DE CARREGAMENTO ---
    useEffect(() => {
        if (!userData || !currentUser) return;
        
        const carregarLojas = async () => {
            let listaIds = [];
            
            if (userData.estabelecimentoId) {
                listaIds = [userData.estabelecimentoId];
            } else if (userData.estabelecimentosGerenciados && Array.isArray(userData.estabelecimentosGerenciados)) {
                listaIds = userData.estabelecimentosGerenciados;
            } else if (currentUser.uid) {
                listaIds = [currentUser.uid];
            }

            if (listaIds.length === 0) return;

            const promessas = listaIds.map(async (id) => {
                try { 
                    const docRef = doc(db, 'estabelecimentos', id); 
                    const docSnap = await getDoc(docRef); 
                    if (docSnap.exists()) {
                        return { id, nome: docSnap.data().nome || 'Loja Sem Nome' };
                    }
                    return null; 
                } catch (e) { 
                    return null; 
                }
            });

            let lojasCarregadas = (await Promise.all(promessas)).filter(loja => loja !== null);
            
            if (userData.estabelecimentoId && lojasCarregadas.length > 0) {
                lojasCarregadas = [lojasCarregadas[0]];
            }

            setEstabelecimentos(lojasCarregadas);
            
            if (!estabelecimentoAtivo && lojasCarregadas.length > 0) { 
                setEstabelecimentoAtivo(lojasCarregadas[0].id); 
                setNomeLoja(lojasCarregadas[0].nome); 
            }
        };
        
        carregarLojas();
    }, [userData, currentUser]);

    const trocarLoja = (id) => { const loja = estabelecimentos.find(e => e.id === id); if (loja) { setEstabelecimentoAtivo(id); setNomeLoja(loja.nome); setCaixaAberto(null); setVendasBase([]); setProdutos([]); setVendasSuspensas([]); } };

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
        if (!caixaAberto) return;
        setMostrarRecibo(false); setMostrarHistorico(false); setMostrarFinalizacao(false);
        setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
        setCpfNota(''); setNfceStatus('idle'); setBusca('');

        setDescontoValor(''); setAcrescimoValor('');
        setPagamentosAdicionados([]);

        setTimeout(() => inputBuscaRef.current?.focus(), 100);
    }, [caixaAberto]);

    const suspenderVenda = useCallback(() => {
        if (!vendaAtual || vendaAtual.itens.length === 0) {
            alert("O carrinho está vazio!");
            return;
        }
        
        const nomeCliente = prompt("Nome para identificar este pedido em espera (Opcional):") || `Cliente ${vendasSuspensas.length + 1}`;
        if (nomeCliente === null) return; 
        
        const vendaSuspensa = {
            ...vendaAtual,
            nomeReferencia: nomeCliente,
            dataSuspensao: new Date(),
            descontoGuardado: descontoValor,
            acrescimoGuardado: acrescimoValor,
            pagamentosGuardados: pagamentosAdicionados
        };
        
        setVendasSuspensas(prev => [...prev, vendaSuspensa]);
        iniciarVendaBalcao(); 
    }, [vendaAtual, vendasSuspensas, iniciarVendaBalcao, descontoValor, acrescimoValor, pagamentosAdicionados]);

    const restaurarVendaSuspensa = (vendaSuspensa) => {
        if (vendaAtual && vendaAtual.itens.length > 0) {
            const conf = window.confirm("Atenção: O seu carrinho atual tem produtos. Deseja substituí-los pela venda em espera?\n\n(Dica: Cancele para suspender a atual primeiro)");
            if (!conf) return;
        }
        
        setVendaAtual({
            id: vendaSuspensa.id,
            itens: vendaSuspensa.itens,
            total: vendaSuspensa.total
        });

        setDescontoValor(vendaSuspensa.descontoGuardado || '');
        setAcrescimoValor(vendaSuspensa.acrescimoGuardado || '');
        setPagamentosAdicionados(vendaSuspensa.pagamentosGuardados || []);
        
        setVendasSuspensas(prev => prev.filter(v => v.id !== vendaSuspensa.id));
        setMostrarSuspensas(false);
        setTimeout(() => inputBuscaRef.current?.focus(), 100);
    };

    const excluirVendaSuspensa = (id) => {
        if(window.confirm("Tem a certeza que deseja excluir este pedido em espera? Os itens serão perdidos.")) {
            setVendasSuspensas(prev => prev.filter(v => v.id !== id));
        }
    };

    const abrirHistoricoAtual = useCallback(() => { setTituloHistorico("Vendas Turno Atual"); setVendasHistoricoExibicao(vendasTurnoAtual); setMostrarHistorico(prev => !prev); }, [vendasTurnoAtual]);
    const carregarListaTurnos = useCallback(async () => { if (!estabelecimentoAtivo) return; setCarregandoHistorico(true); setMostrarListaTurnos(true); const t = await caixaService.listarTurnos(currentUser.uid, estabelecimentoAtivo); setListaTurnos(t); setCarregandoHistorico(false); }, [currentUser, estabelecimentoAtivo]);
    const visualizarVendasTurno = useCallback(async (turno) => { setCarregandoHistorico(true); setTituloHistorico(`Vendas ${turno.dataAbertura ? formatarData(turno.dataAbertura) : ''}`); const v = await vendaService.buscarVendasPorIntervalo(currentUser.uid, estabelecimentoAtivo, turno.dataAbertura, turno.dataFechamento); setVendasHistoricoExibicao(v); setCarregandoHistorico(false); setMostrarListaTurnos(false); setMostrarHistorico(true); }, [currentUser, estabelecimentoAtivo]);
    const prepararFechamento = useCallback(async () => { if (!caixaAberto) return; const movs = await caixaService.buscarMovimentacoes(caixaAberto.id); setMovimentacoesDoTurno(movs); setMostrarFechamentoCaixa(true); }, [caixaAberto]);
    const abrirMovimentacao = useCallback(() => { if (!caixaAberto) return alert("Caixa Fechado!"); setMostrarMovimentacao(true); }, [caixaAberto]);
    const handleSalvarMovimentacao = async (dados) => { const res = await caixaService.adicionarMovimentacao(caixaAberto.id, { ...dados, usuarioId: currentUser.uid }); if (res.success) { alert(`Sucesso!`); setMostrarMovimentacao(false); } else { alert('Erro: ' + res.error); } };

    const handleConfirmarFechamento = async (dados) => { 
        const res = await caixaService.fecharCaixa(caixaAberto.id, dados); 
        if (res.success) { 
            const turnoFechadoParaRelatorio = {
                ...caixaAberto,
                resumoVendas: dados.resumoVendas,
                saldoFinalInformado: dados.saldoFinalInformado,
                diferenca: dados.diferenca,
                dataFechamento: new Date(),
                status: 'fechado'
            };

            alert('🔒 Turno encerrado!'); 
            
            setCaixaAberto(null); 
            setVendasBase([]); 
            setVendasSuspensas([]);
            setMostrarFechamentoCaixa(false); 
            setVendaAtual(null); 

            setTurnoSelecionadoResumo(turnoFechadoParaRelatorio);
            setMostrarResumoTurno(true);
        } else {
            alert('Erro ao fechar caixa: ' + res.error);
        }
    };

    const handleAbrirCaixa = async (saldoInicial) => {
        const checkAtivo = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
        if (checkAtivo) {
            alert('Atenção: Você já possui um turno em andamento!');
            setCaixaAberto(checkAtivo);
            setMostrarAberturaCaixa(false);
            return;
        }
        const res = await caixaService.abrirCaixa({ usuarioId: currentUser.uid, estabelecimentoId: estabelecimentoAtivo, saldoInicial });
        if (res.success) {
            const novoCaixa = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
            setCaixaAberto(novoCaixa || res);
            setVendasBase([]);
            setVendasSuspensas([]);
            setMostrarAberturaCaixa(false);
            setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
            setTimeout(() => inputBuscaRef.current?.focus(), 500);
        } else alert('Erro: ' + res.error);
    };

    const selecionarVendaHistorico = (v) => { setDadosRecibo(v); setNfceStatus(v.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle'); setNfceUrl(v.fiscal?.pdf || null); setMostrarHistorico(false); setMostrarRecibo(true); };

    // --- NOVA LÓGICA PARA BALANÇA AQUI ---
    const handleProdutoClick = useCallback((p) => {
        // Verifica se é produto por peso (flag customizada ou por unidade KG no fiscal)
        const unidadeFiscal = p.fiscal?.unidade || '';
        const unidadeNormal = p.unidade || '';

        const ePeso = 
            p.vendidoPorPeso === true || 
            String(unidadeFiscal).trim().toUpperCase() === 'KG' || 
            String(unidadeNormal).trim().toUpperCase() === 'KG';

        if (!vendaAtual) {
            const novaVenda = { id: Date.now().toString(), itens: [], total: 0 };
            setVendaAtual(novaVenda);
            setTimeout(() => { 
                if (ePeso) setProdutoParaPeso(p); 
                else if (p.temVariacoes) setProdutoParaSelecao(p); 
                else adicionarItem(p, null, novaVenda); 
            }, 0);
            return;
        }
        
        if (ePeso) setProdutoParaPeso(p); 
        else if (p.temVariacoes) setProdutoParaSelecao(p); 
        else adicionarItem(p, null);
    }, [vendaAtual]);

    const adicionarItemPeso = (produto, pesoKg, totalCalculado) => {
        setVendaAtual(prev => {
            if (!prev) return null;
            const uid = `${produto.id}-peso-${Date.now()}`; 
            const novoItem = { 
                uid, 
                id: produto.id, 
                name: `${produto.name} (${pesoKg} Kg)`, 
                price: totalCalculado, 
                quantity: 1, 
                observacao: `Peso lido: ${pesoKg} Kg`, 
                pesoKg: pesoKg 
            };
            const nv = [...prev.itens, novoItem];
            return { ...prev, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) };
        });
        setProdutoParaPeso(null);
        setBusca('');
        inputBuscaRef.current?.focus();
    };

    const adicionarItem = (p, v, vendaRef = null) => {
        setVendaAtual(prev => {
            const target = prev || vendaRef;
            if (!target) return null;
            const vid = v ? v.id : 'p';
            const uid = `${p.id}-${vid}`;
            const ex = target.itens.find(i => i.uid === uid);
            const nv = ex ? target.itens.map(i => i.uid === uid ? { ...i, quantity: i.quantity + 1 } : i) : [...target.itens, { uid, id: p.id, name: v ? `${p.name} ${v.nome}` : p.name, price: v ? Number(v.preco) : p.price, quantity: 1, observacao: '' }];
            return { ...target, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) };
        });
        setProdutoParaSelecao(null);
        setBusca('');
        inputBuscaRef.current?.focus();
    };

    const salvarEdicaoItem = (uid, novaQuantidade, novaObservacao) => {
        setVendaAtual(prev => {
            if (!prev) return null;
            const novosItens = prev.itens.map(i => 
                i.uid === uid ? { ...i, quantity: novaQuantidade, observacao: novaObservacao } : i
            );
            return {
                ...prev,
                itens: novosItens,
                total: novosItens.reduce((s, i) => s + (i.price * i.quantity), 0)
            };
        });
        setItemParaEditar(null);
    };


    const handleConsultarStatus = async (venda) => {
        if (!venda.fiscal?.idPlugNotas) {
            alert("Esta venda não possui um ID de processamento no PlugNotas.");
            return;
        }

        setNfceStatus('loading'); // Mostra que está carregando

        try {
            const res = await vendaService.consultarStatusNfce(venda.id, venda.fiscal.idPlugNotas);
            
            if (res.sucesso) {
                // Atualiza as listas na tela na hora
                const atualizaVenda = (lista) => lista.map(v => 
                    v.id === venda.id ? { 
                        ...v, 
                        fiscal: { 
                            ...v.fiscal, 
                            status: res.statusAtual, 
                            pdf: res.pdf || v.fiscal?.pdf, 
                            xml: res.xml || v.fiscal?.xml,
                            motivoRejeicao: res.mensagem || v.fiscal?.motivoRejeicao
                        } 
                    } : v 
                );
                
                setVendasBase(atualizaVenda);
                setVendasHistoricoExibicao(atualizaVenda);

                if (dadosRecibo?.id === venda.id) {
                    setDadosRecibo(prev => ({...prev, fiscal: { ...prev.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem }}));
                    setNfceStatus(res.statusAtual === 'AUTORIZADA' || res.statusAtual === 'CONCLUIDO' ? 'success' : 'idle');
                    setNfceUrl(res.pdf);
                }

                alert(`Status Sincronizado: ${res.statusAtual}`);
            } else {
                setNfceStatus('error');
                alert("Erro ao consultar status: " + res.error);
            }
        } catch (error) {
            setNfceStatus('error');
            alert("Erro de conexão ao consultar a Sefaz.");
        }
    };

    const removerItem = (uid) => setVendaAtual(prev => ({ ...prev, itens: prev.itens.filter(i => i.uid !== uid), total: prev.itens.filter(i => i.uid !== uid).reduce((s, i) => s + (i.price * i.quantity), 0) }));

    const pdvSyncRef = useRef({});
    useEffect(() => {
        pdvSyncRef.current = {
            produtos,
            handleProdutoClick,
            bloqueado: mostrarFinalizacao || mostrarRecibo || mostrarHistorico || mostrarSuspensas || mostrarMovimentacao || mostrarListaTurnos || mostrarAberturaCaixa || !caixaAberto || produtoParaSelecao !== null || itemParaEditar !== null || produtoParaPeso !== null
        };
    });

    useEffect(() => {
        const onBarcodeRead = (e) => {
            if (e.key.length > 1 && e.key !== 'Enter') return;

            if (e.key === 'Enter' && bufferCodigoBarras.current.length >= 3) {
                const codigo = bufferCodigoBarras.current;
                bufferCodigoBarras.current = '';
                if (timeoutCodigoBarras.current) clearTimeout(timeoutCodigoBarras.current);

                const state = pdvSyncRef.current;
                if (state.bloqueado) return;

                const pEncontrado = state.produtos.find(p => 
                    String(p.codigoBarras) === codigo || 
                    String(p.codigo) === codigo || 
                    String(p.referencia) === codigo
                );

                if (pEncontrado) {
                    state.handleProdutoClick(pEncontrado);
                } else {
                    tocarBeepErro();
                    setBarcodeAviso(`O produto ${codigo} não está registado.`);
                    setTimeout(() => setBarcodeAviso(null), 3000);
                }
                return;
            }

            bufferCodigoBarras.current += e.key;

            if (timeoutCodigoBarras.current) clearTimeout(timeoutCodigoBarras.current);
            timeoutCodigoBarras.current = setTimeout(() => {
                bufferCodigoBarras.current = ''; 
            }, 50);
        };

        window.addEventListener('keydown', onBarcodeRead);
        return () => window.removeEventListener('keydown', onBarcodeRead);
    }, []);

    const finalizarVenda = async () => {
        setSalvando(true);

        const descNum = parseFloat(descontoValor || 0);
        const acrNum = parseFloat(acrescimoValor || 0);
        const totalFinal = Math.max(0, vendaAtual.total + acrNum - descNum);

        const totalPago = pagamentosAdicionados.reduce((acc, p) => acc + p.valor, 0);
        const trocoCalculado = Math.max(0, totalPago - totalFinal);

        let formaPrincipal = pagamentosAdicionados.length === 1 ? pagamentosAdicionados[0].forma : 'misto';

        const d = {
            estabelecimentoId: estabelecimentoAtivo,
            status: 'finalizada',
            formaPagamento: formaPrincipal,
            pagamentos: pagamentosAdicionados,
            subtotal: vendaAtual.total,
            desconto: descNum,
            acrescimo: acrNum,
            total: totalFinal,
            troco: trocoCalculado,
            valorRecebido: totalPago,
            itens: vendaAtual.itens,
            usuarioId: currentUser.uid,
            cliente: 'Balcão',
            clienteCpf: cpfNota || null,
            createdAt: new Date()
        };

        const res = await vendaService.salvarVenda(d);
        if (res.success) {
            setVendasBase(p => [{ ...d, id: res.vendaId }, ...p]);
            setDadosRecibo({ ...d, id: res.vendaId });
            setVendaAtual(null);
            setMostrarFinalizacao(false);
            setMostrarRecibo(true);

            setDescontoValor(''); setAcrescimoValor(''); setCpfNota('');
            setPagamentosAdicionados([]);
        }
        setSalvando(false);
    };

    const tocarBeepErro = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.log("Áudio bloqueado", e);
        }
    };
    
    const handleEmitirNfce = async () => {
        if (!dadosRecibo?.id) return;
        setNfceStatus('loading'); // Fica processando
        try {
            const res = await vendaService.emitirNfce(dadosRecibo.id, dadosRecibo.clienteCpf);
            
            // A API vai retornar sucesso indicando que mandou pro PlugNotas (o Webhook faz o resto)
            if (res.sucesso || res.success) {
                // Atualiza a lista visualmente para PROCESSANDO
                const atualizaVenda = (lista) => lista.map(v =>
                    v.id === dadosRecibo.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v
                );
                setVendasBase(atualizaVenda);
                setVendasHistoricoExibicao(atualizaVenda);
            } else {
                setNfceStatus('error');
                tocarBeepErro();
                alert(res.error || "Erro ao solicitar emissão da NFC-e.");
            }
        } catch (e) {
            setNfceStatus('error');
            tocarBeepErro();
            alert('Erro de conexão ao processar a nota.');
        }
    };

    // Fica escutando o Firebase em tempo real enquanto o recibo está aberto para pegar o retorno do Webhook
    useEffect(() => {
        let unsub = () => {};
        if (mostrarRecibo && dadosRecibo?.id) {
            unsub = onSnapshot(doc(db, 'vendas', dadosRecibo.id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    // Atualiza apenas os dados fiscais no Recibo aberto para não bugar a tela
                    setDadosRecibo(prev => ({ ...prev, fiscal: data.fiscal }));
                    
                    if (data.fiscal) {
                        const st = data.fiscal.status?.toUpperCase();
                        if (st === 'AUTORIZADA' || st === 'CONCLUIDO') {
                            setNfceStatus('success');
                            setNfceUrl(data.fiscal.pdf);
                            
                            // Atualiza nas listas de histórico
                            const atualiza = prev => prev.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: data.fiscal } : v);
                            setVendasBase(atualiza);
                            setVendasHistoricoExibicao(atualiza);
                        } else if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'DENEGADO') {
                            setNfceStatus('error');
                            setNfceUrl(null);
                            
                            const atualiza = prev => prev.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: data.fiscal } : v);
                            setVendasBase(atualiza);
                            setVendasHistoricoExibicao(atualiza);
                        } else if (st === 'PROCESSANDO') {
                            setNfceStatus('loading');
                        }
                    }
                }
            });
        }
        return () => unsub();
    }, [mostrarRecibo, dadosRecibo?.id]);

    // 👇 AUTO-POLLING ADICIONADO AQUI: PERGUNTA PARA A SEFAZ A CADA 3 SEGUNDOS ENQUANTO ESTIVER "LOADING" 👇
    useEffect(() => {
        let intervalo;

        // Se o botão estiver "Aguardando..." e tivermos o ID do Plugnotas, vamos perguntar ativamente a cada 3 segundos
        if (nfceStatus === 'loading' && dadosRecibo?.fiscal?.idPlugNotas) {
            intervalo = setInterval(async () => {
                try {
                    console.log("🔄 Consultando Sefaz automaticamente...");
                    // Usa aquela função de Resumo que criamos!
                    const res = await vendaService.consultarStatusNfce(dadosRecibo.id, dadosRecibo.fiscal.idPlugNotas);
                    
                    // Se o status mudou (já não é PROCESSANDO), paramos de perguntar e atualizamos a tela
                    if (res.sucesso && res.statusAtual !== 'PROCESSANDO') {
                        clearInterval(intervalo);
                        
                        const novoStatus = (res.statusAtual === 'AUTORIZADA' || res.statusAtual === 'CONCLUIDO') ? 'success' : 'error';
                        setNfceStatus(novoStatus);
                        if (novoStatus === 'success') setNfceUrl(res.pdf);

                        // Atualiza as listas na tela na hora
                        const atualizaVenda = (lista) => lista.map(v => 
                            v.id === dadosRecibo.id ? { 
                                ...v, 
                                fiscal: { ...v.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } 
                            } : v 
                        );
                        setVendasBase(atualizaVenda);
                        setVendasHistoricoExibicao(atualizaVenda);
                        setDadosRecibo(prev => ({...prev, fiscal: { ...prev.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem }}));
                        
                        if (novoStatus === 'error') tocarBeepErro();
                    }
                } catch (error) {
                    console.error("Erro na consulta automática", error);
                }
            }, 3000); // Pergunta de 3 em 3 segundos
        }

        // Limpa o intervalo se o modal fechar ou mudar de status
        return () => clearInterval(intervalo);
    }, [nfceStatus, dadosRecibo]);
    // 👆 FIM DO AUTO-POLLING 👆

    const handleProcessarLoteNfce = async (vendasParaProcessar) => {
        if (!vendasParaProcessar || vendasParaProcessar.length === 0) return;
        const confirmacao = window.confirm(`Deseja tentar reemitir ${vendasParaProcessar.length} nota(s) fiscal(is)? Isso pode levar alguns instantes.`);
        if (!confirmacao) return;

        let sucesso = 0; let erro = 0;
        let listaAtualizada = [...vendasHistoricoExibicao];

        for (const venda of vendasParaProcessar) {
            try {
                const res = await vendaService.emitirNfce(venda.id, venda.clienteCpf);
                let novoStatus = 'REJEITADA'; let novoPdf = null;
                if (res.pdfUrl || res.success) {
                    sucesso++; novoStatus = 'AUTORIZADA'; novoPdf = res.pdfUrl || res.pdf;
                } else { erro++; }
                listaAtualizada = listaAtualizada.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: novoStatus, pdf: novoPdf } } : v );
            } catch (e) { erro++; }
        }

        setVendasHistoricoExibicao(listaAtualizada);
        setVendasBase(prev => prev.map(v => listaAtualizada.find(lu => lu.id === v.id) || v));
        if (erro > 0) tocarBeepErro();
        alert(`Processamento do Lote concluído!\n✅ Emitidas com Sucesso: ${sucesso}\n❌ Falharam novamente: ${erro}`);
    };

    const handleCancelarNfce = async (venda) => {
        const isNfce = venda.fiscal?.status === 'AUTORIZADA';
        const msg = isNfce 
            ? "⚠️ CANCELAMENTO DE NFC-e\n\nDigite o motivo para a Sefaz (mínimo 15 caracteres):"
            : "⚠️ CANCELAMENTO DE VENDA\n\nDigite o motivo do cancelamento (mínimo 15 caracteres):";

        const justificativa = window.prompt(msg);
        if (justificativa === null) return;
        if (justificativa.trim().length < 15) { alert("❌ A justificativa tem de ter pelo menos 15 caracteres."); return; }

        const confirmacao = window.confirm(`Tem a certeza que deseja cancelar a venda #${venda.id.slice(-4)}?\nO valor será REMOVIDO do caixa atual.`);
        if (!confirmacao) return;

        try {
            if (isNfce) {
                const res = await vendaService.cancelarNfce(venda.id, justificativa);
                if (!res.success) { alert("❌ Erro ao cancelar na Sefaz: " + (res.error || "Retorno inválido.")); return; }
            }

            alert("✅ Venda cancelada com sucesso! O valor foi removido do caixa.");

            const atualizaVenda = (lista) => lista.map(v => v.id === venda.id ? { ...v, status: 'cancelada', fiscal: { ...v.fiscal, status: 'CANCELADA' } } : v );
            setVendasHistoricoExibicao(atualizaVenda);
            setVendasBase(prev => prev.map(v => v.id === venda.id ? { ...v, status: 'cancelada', fiscal: { ...v.fiscal, status: 'CANCELADA' } } : v));
        } catch (e) {
            alert("❌ Erro de comunicação ao tentar cancelar a venda.");
        }
    };

    const handleBaixarXml = async (venda) => {
        // 1. Se o webhook já salvou a URL direta do XML no banco, abre ela na hora!
        if (venda.fiscal?.xml) {
            window.open(venda.fiscal.xml, '_blank');
            return;
        }

        // 2. Se não tem a URL, busca o código bruto via API do PlugNotas
        if (!venda.fiscal?.idPlugNotas) {
            alert("A nota ainda não tem um ID do PlugNotas gerado.");
            return;
        }

        try {
            // Usa os últimos 6 digitos do ID da venda para nomear o arquivo
            const res = await vendaService.baixarXmlNfce(venda.fiscal.idPlugNotas, venda.id.slice(-6));
            if (!res.success) {
                alert("Erro ao baixar XML: " + res.error);
            }
        } catch (e) {
            alert("Falha de conexão ao tentar baixar o XML.");
        }
    };

    useEffect(() => { if (!estabelecimentoAtivo || !currentUser) return; const i = async () => { setVerificandoCaixa(true); const c = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo); if (c) { setCaixaAberto(c); const v = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 50); setVendasBase(v); setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 }); setTimeout(() => inputBuscaRef.current?.focus(), 500); } else { setMostrarAberturaCaixa(true); } setVerificandoCaixa(false); }; i(); }, [currentUser, estabelecimentoAtivo]);
    useEffect(() => { if (!estabelecimentoAtivo) return; setCarregandoProdutos(true); setProdutos([]); setCategorias([]); const u = onSnapshot(query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio'), orderBy('ordem', 'asc')), (s) => { const c = s.docs.map(d => ({ id: d.id, ...d.data() })); setCategorias([{ id: 'todos', name: 'Todos', icon: '🍽️' }, ...c.map(x => ({ id: x.nome || x.id, name: x.nome || x.id, icon: '🍕' }))]); let all = new Map(); let cp = 0; if (c.length === 0) { setProdutos([]); setCarregandoProdutos(false); return; } c.forEach(k => { onSnapshot(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio', k.id, 'itens'), (is) => { const it = is.docs.map(i => { const d = i.data(); const vs = d.variacoes?.filter(v => v.ativo) || []; return { ...d, id: i.id, name: d.nome || "S/ Nome", categoria: k.nome || "Geral", categoriaId: k.id, price: vs.length > 0 ? Math.min(...vs.map(x => Number(x.preco))) : Number(d.preco || 0), temVariacoes: vs.length > 0, variacoes: vs }; }); all.set(k.id, it); setProdutos(Array.from(all.values()).flat()); cp++; if (cp >= c.length) setCarregandoProdutos(false); }); }); }); return () => u(); }, [estabelecimentoAtivo]);

    useEffect(() => {
        const handler = (e) => {
            setTurnoSelecionadoResumo(e.detail);
            setMostrarListaTurnos(false);
            setMostrarResumoTurno(true);
        };
        document.addEventListener('abrirRelatorioTurno', handler);
        return () => document.removeEventListener('abrirRelatorioTurno', handler);
    }, []);

    useEffect(() => {
        const h = (e) => {
            if (!caixaAberto && !mostrarAberturaCaixa) return;
            if (e.key === 'F1') { e.preventDefault(); inputBuscaRef.current?.focus(); }
            if (e.key === 'F2') { e.preventDefault(); iniciarVendaBalcao(); }
            if (e.key === 'F3') { e.preventDefault(); abrirHistoricoAtual(); }
            if (e.key === 'F4') { e.preventDefault(); suspenderVenda(); }
            if (e.key === 'F5') { e.preventDefault(); setMostrarSuspensas(true); }
            if (e.key === 'F8') { e.preventDefault(); abrirMovimentacao(); }
            if (e.key === 'F9') { e.preventDefault(); prepararFechamento(); }
            if (e.key === 'F10' && vendaAtual?.itens.length > 0) { e.preventDefault(); setMostrarFinalizacao(true); setMostrarCarrinhoMobile(false); }
            if (e.key === 'F11') { e.preventDefault(); carregarListaTurnos(); }
            
            if (e.key === 'Escape') { 
                setItemParaEditar(null); setProdutoParaSelecao(null); setProdutoParaPeso(null); setMostrarFinalizacao(false); setMostrarRecibo(false); setMostrarHistorico(false); setMostrarFechamentoCaixa(false); setMostrarListaTurnos(false); setMostrarMovimentacao(false); setMostrarResumoTurno(false); setMostrarSuspensas(false); setMostrarCarrinhoMobile(false);
            }
        }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    }, [caixaAberto, iniciarVendaBalcao, prepararFechamento, abrirHistoricoAtual, carregarListaTurnos, abrirMovimentacao, vendaAtual, suspenderVenda]);

    return (
        <div id="main-app-wrapper" className="fixed inset-0 h-[100dvh] w-screen bg-gray-50 font-sans overflow-hidden text-gray-800 selection:bg-emerald-200 selection:text-emerald-900 flex flex-row z-[100]">
            
            {barcodeAviso && (
                <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl z-[9999] animate-slideUp border border-red-400 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <p className="font-bold">{barcodeAviso}</p>
                </div>
            )}

            {verificandoCaixa && !caixaAberto && !mostrarAberturaCaixa ? (
                <div className="flex w-full h-full flex-col items-center justify-center text-emerald-500 gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-emerald-500"></div>
                    <span className="font-bold text-gray-500 animate-pulse">Carregando Sistema...</span>
                </div>
            ) : (
                <>
                    {/* LADO ESQUERDO: CATÁLOGO */}
                    <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50/50 pb-16 md:pb-20">
                        {/* HEADER RESPONSIVO */}
                        <div className="bg-white px-4 py-4 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 z-10 shrink-0 shadow-sm gap-4">
                            
                            <div className="flex flex-col w-full md:w-auto">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-2.5 h-2.5 rounded-full ${caixaAberto ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-red-500'}`}></div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{caixaAberto ? 'CAIXA OPERANTE' : 'FECHADO'}</span>
                                </div>
                                {estabelecimentos.length > 1 ? (
                                    <select value={estabelecimentoAtivo || ''} onChange={(e) => trocarLoja(e.target.value)} className="text-xl md:text-2xl font-black text-gray-800 bg-transparent border-none outline-none cursor-pointer -ml-1 hover:text-emerald-600 transition w-full truncate appearance-none">
                                        {estabelecimentos.map(est => <option key={est.id} value={est.id}>{est.nome}</option>)}
                                    </select>
                                ) : (<h1 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight truncate">{nomeLoja}</h1>)}
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <button onClick={() => navigate('/dashboard')} className="p-3 bg-gray-50 hover:bg-gray-200 text-gray-600 rounded-xl transition-all border border-gray-200 shrink-0 flex items-center justify-center shadow-sm" title="Voltar ao Dashboard"><span className="text-lg">🔙</span></button>
                                <button onClick={() => navigate('/admin/config-fiscal')} className="p-3 bg-gray-50 hover:bg-gray-200 text-gray-500 hover:text-emerald-600 rounded-xl transition-all border border-gray-100 shrink-0 flex items-center justify-center shadow-sm" title="Configurações Fiscais"><span className="text-lg">⚙️</span></button>
                                
                                <div className="relative group flex-1 md:w-80 lg:w-96">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 group-focus-within:text-emerald-500 transition-colors">🔍</span>
                                    <input ref={inputBuscaRef} type="text" placeholder="Buscar Produto (F1)..." className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-transparent rounded-xl text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all placeholder-gray-400 shadow-inner focus:shadow-sm" value={busca} onChange={e => setBusca(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* BARRA DE CATEGORIAS */}
                        <div className="px-4 py-3 md:px-6 md:py-4 flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide shrink-0 border-b border-gray-100 bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] relative z-0">
                            {categorias.map(c => (
                                <button key={c.id} onClick={() => setCategoriaAtiva(c.name === 'Todos' ? 'todos' : c.name)} className={`px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${((categoriaAtiva === 'todos' && c.name === 'Todos') || categoriaAtiva === c.name) ? 'bg-gray-900 border-gray-900 text-white shadow-md transform scale-[1.02]' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                                    {c.name}
                                </button>
                            ))}
                        </div>

                        {/* GRID DE PRODUTOS */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50 custom-scrollbar relative">
                            {carregandoProdutos ? (
                                <div className="absolute inset-0 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-emerald-500"></div></div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4 pb-24 md:pb-6">
                                    {produtosFiltrados.map(p => (
                                        <button key={p.id} onClick={() => handleProdutoClick(p)} className="bg-white rounded-2xl p-2 md:p-3 shadow-sm border border-gray-100 hover:border-emerald-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group flex flex-col h-48 md:h-56 relative overflow-hidden">
                                            <div className="h-20 md:h-28 w-full bg-gray-100 rounded-xl mb-2 md:mb-3 overflow-hidden relative flex items-center justify-center shrink-0">
                                                
                                                {/* 👇 ALTERAÇÃO DA IMAGEM AQUI 👇 */}
                                                {p.imagem || p.foto || p.urlImagem || p.imageUrl ? (
<img src={p.imagem || p.foto || p.urlImagem || p.imageUrl} alt={p.name} className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500 mix-blend-multiply" />                                                ) : (
                                                    <span className="text-3xl md:text-5xl opacity-20 grayscale transition-transform duration-300 group-hover:scale-110">🍔</span>
                                                )}
                                                {/* 👆 FIM DA ALTERAÇÃO 👆 */}

                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300"></div>
                                            </div>
                                            <div className="flex flex-col justify-between flex-1 px-1 text-left">
                                                <h3 className="font-bold text-gray-800 text-xs md:text-sm leading-tight line-clamp-2 group-hover:text-emerald-700 transition-colors">{p.name}</h3>
                                                <div className="flex justify-between items-end md:items-center mt-1">
                                                    <span className="font-black text-emerald-600 text-sm md:text-lg">{formatarMoeda(p.price)}</span>
                                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                                                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LADO DIREITO: CARRINHO FANTASMA / GAVETA MOBILE */}
                    <div className={`fixed inset-y-0 right-0 z-[110] bg-white border-l border-gray-200 flex flex-col h-full shadow-2xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 w-[85vw] sm:w-96 ${mostrarCarrinhoMobile ? 'translate-x-0' : 'translate-x-full'} pb-16 md:pb-20`}>
                        
                        {/* HEADER DO CARRINHO */}
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                            <div>
                                <h2 className="font-black text-lg md:text-xl text-gray-800 flex items-center gap-2">🛒 Pedido</h2>
                                <p className="text-[10px] md:text-xs text-gray-400 font-mono mt-0.5">ID: {vendaAtual?.id?.slice(-6).toUpperCase() || '---'}</p>
                            </div>
                            <div className="flex gap-2 items-center">
                                <button onClick={() => setMostrarCarrinhoMobile(false)} className="md:hidden bg-gray-100 text-gray-600 p-2 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
                                <button onClick={suspenderVenda} disabled={!vendaAtual?.itens?.length} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 md:px-3 py-2 rounded-xl text-[10px] font-bold transition flex items-center gap-1 disabled:opacity-50" title="Suspender Pedido">⏸️ <span className="hidden sm:inline">PAUSAR</span></button>
                                <button onClick={iniciarVendaBalcao} className="bg-red-50 text-red-500 hover:bg-red-100 px-2 md:px-3 py-2 rounded-xl text-[10px] font-bold transition flex items-center gap-1" title="Limpar venda">🗑️ <span className="hidden sm:inline">LIMPAR</span></button>
                            </div>
                        </div>

                        {/* LISTA DE ITENS */}
                        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 custom-scrollbar bg-gray-50/30">
                            {vendaAtual?.itens?.length > 0 ? (
                                vendaAtual.itens.map(i => (
                                    <div key={i.uid} onClick={() => setItemParaEditar(i)} className="flex justify-between items-start bg-white p-3 md:p-4 rounded-xl border border-gray-100 hover:border-emerald-300 hover:shadow-md transition-all group animate-fadeIn cursor-pointer" title="Clique para editar">
                                        <div className="flex-1 pr-2">
                                            <div className="flex items-start gap-2 mb-1">
                                                <span className="bg-emerald-100 text-emerald-700 font-black text-xs px-2 py-0.5 rounded-md shrink-0">{i.quantity}x</span>
                                                <span className="font-bold text-gray-800 text-xs md:text-sm leading-tight line-clamp-2 mt-0.5">{i.name}</span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 pl-9 font-mono">{formatarMoeda(i.price)} un.</p>
                                            {i.observacao && (
                                                <p className="text-[10px] text-orange-600 bg-orange-50 p-1.5 rounded-lg font-medium italic mt-1.5 line-clamp-2 border border-orange-100 ml-9">
                                                    💬 {i.observacao}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2 shrink-0">
                                            <span className="font-black text-gray-900 md:text-lg">{formatarMoeda(i.price * i.quantity)}</span>
                                            <button onClick={(e) => { e.stopPropagation(); removerItem(i.uid); }} className="text-red-500 hover:text-white hover:bg-red-500 text-[10px] font-bold uppercase md:opacity-0 group-hover:opacity-100 transition-all bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">Excluir</button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-3 opacity-60">
                                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-3xl">🛍️</div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Caixa Livre</p>
                                </div>
                            )}
                        </div>

                        {/* RODAPÉ DO CARRINHO (TOTAL E PAGAR) */}
                        {vendaAtual?.itens?.length > 0 && (
                            <div className="p-4 md:p-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] z-40 shrink-0">
                                <div className="space-y-1 md:space-y-2 mb-4 md:mb-6 bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-100">
                                    <div className="flex justify-between text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider"><span>Subtotal</span><span>{formatarMoeda(vendaAtual.total)}</span></div>
                                    <div className="flex justify-between text-emerald-600 text-2xl md:text-3xl font-black mt-1 items-baseline tracking-tight"><span className="text-sm font-bold text-gray-400">TOTAL</span><span>{formatarMoeda(vendaAtual.total)}</span></div>
                                </div>
                                <button onClick={() => { setMostrarFinalizacao(true); setMostrarCarrinhoMobile(false); }} className="w-full bg-emerald-600 text-white py-4 md:py-5 rounded-2xl font-black text-lg md:text-xl hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-200 active:scale-[0.98] flex items-center justify-center gap-3">
                                    PAGAR
                                </button>
                            </div>
                        )}
                    </div>

                    {/* OVERLAY ESCURO PARA O CARRINHO MOBILE */}
                    {mostrarCarrinhoMobile && (
                        <div className="md:hidden fixed inset-0 bg-gray-900/60 z-[105] backdrop-blur-sm transition-opacity" onClick={() => setMostrarCarrinhoMobile(false)}></div>
                    )}

                    {/* BARRA DE ATALHOS OTIMIZADA */}
                    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-2 md:p-3 z-[100] flex justify-between md:justify-center gap-2 md:gap-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] no-print overflow-x-auto scrollbar-hide">
                        <div className="flex gap-2 min-w-max px-2">
                            <button onClick={() => inputBuscaRef.current?.focus()} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-3 md:px-4 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-sm transition-all h-full"><kbd className="hidden md:inline-block bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono">F1</kbd> <span className="text-lg md:hidden">🔍</span> <span className="md:inline">BUSCAR</span></button>
                            <button onClick={iniciarVendaBalcao} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-3 md:px-4 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-sm transition-all h-full"><kbd className="hidden md:inline-block bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono">F2</kbd> <span className="text-lg md:hidden">✨</span> <span className="md:inline">NOVA</span></button>
                            <button onClick={() => setMostrarSuspensas(true)} className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3 md:px-4 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-sm transition-all relative h-full">
                                <kbd className="hidden md:inline-block bg-white border border-blue-200 px-1.5 py-0.5 rounded text-blue-800 font-mono">F5</kbd> <span className="text-lg md:hidden">⏸️</span> <span className="md:inline">ESPERA</span>
                                {vendasSuspensas.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-bounce">{vendasSuspensas.length}</span>}
                            </button>
                            <button onClick={abrirMovimentacao} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-3 md:px-4 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-sm transition-all h-full"><kbd className="hidden md:inline-block bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono">F8</kbd> <span className="text-lg md:hidden">💸</span> <span className="md:inline">MOVIM.</span></button>
                            <button onClick={prepararFechamento} className="bg-gray-900 hover:bg-black border border-gray-800 text-white px-3 md:px-4 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-sm transition-all h-full"><kbd className="hidden md:inline-block bg-gray-700 border border-gray-600 px-1.5 py-0.5 rounded text-gray-300 font-mono">F9</kbd> <span className="text-lg md:hidden">🔒</span> <span className="md:inline">FECHAR</span></button>
                            <button onClick={carregarListaTurnos} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-3 md:px-4 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-sm transition-all h-full"><kbd className="hidden md:inline-block bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono">F11</kbd> <span className="text-lg md:hidden">📋</span> <span className="md:inline">TURNOS</span></button>
                        </div>
                    </div>

                    {/* BOTÃO FLUTUANTE DO CARRINHO APENAS PARA MOBILE */}
                    <button 
                        onClick={() => setMostrarCarrinhoMobile(true)}
                        className={`md:hidden fixed bottom-20 right-4 bg-emerald-600 text-white p-4 rounded-full shadow-2xl z-[90] flex items-center gap-2 transition-transform ${vendaAtual?.itens?.length > 0 ? 'scale-100 animate-bounce' : 'scale-0'}`}
                    >
                        <span className="text-xl">🛒</span>
                        <span className="bg-white text-emerald-600 font-black text-xs px-2 py-1 rounded-full">{vendaAtual?.itens?.length || 0}</span>
                    </button>

                    {/* Modais Componentes - IMPORTADOS DE FORA */}
                    <ModalSelecaoVariacao produto={produtoParaSelecao} onClose={() => setProdutoParaSelecao(null)} onConfirm={adicionarItem} />
                    <ModalEdicaoItemCarrinho visivel={itemParaEditar !== null} item={itemParaEditar} onClose={() => setItemParaEditar(null)} onConfirm={salvarEdicaoItem} />
                    <ModalAberturaCaixa visivel={mostrarAberturaCaixa} onAbrir={handleAbrirCaixa} usuarioNome={userData?.name} />
                    <ModalFechamentoCaixa visivel={mostrarFechamentoCaixa} caixa={caixaAberto} vendasDoDia={vendasTurnoAtual} movimentacoes={movimentacoesDoTurno} onClose={() => setMostrarFechamentoCaixa(false)} onConfirmarFechamento={handleConfirmarFechamento} />
                    <ModalMovimentacao visivel={mostrarMovimentacao} onClose={() => setMostrarMovimentacao(false)} onConfirmar={handleSalvarMovimentacao} />
                    <ModalFinalizacao visivel={mostrarFinalizacao} venda={vendaAtual} onClose={() => setMostrarFinalizacao(false)} onFinalizar={finalizarVenda} salvando={salvando} pagamentos={pagamentosAdicionados} setPagamentos={setPagamentosAdicionados} cpfNota={cpfNota} setCpfNota={setCpfNota} desconto={descontoValor} setDesconto={setDescontoValor} acrescimo={acrescimoValor} setAcrescimo={setAcrescimoValor} />
                    
                    <ModalRecibo 
                        visivel={mostrarRecibo} 
                        dados={dadosRecibo} 
                        onClose={() => { setMostrarRecibo(false); iniciarVendaBalcao(); }} 
                        onNovaVenda={iniciarVendaBalcao} 
                        onEmitirNfce={handleEmitirNfce} 
                        nfceStatus={nfceStatus} 
                        nfceUrl={nfceUrl} 
                        onBaixarXml={handleBaixarXml}
                        onConsultarStatus={handleConsultarStatus}
                    />
                    
                    <ModalHistorico 
                        visivel={mostrarHistorico} 
                        onClose={() => setMostrarHistorico(false)} 
                        vendas={vendasHistoricoExibicao} 
                        titulo={tituloHistorico} 
                        onSelecionarVenda={selecionarVendaHistorico} 
                        carregando={carregandoHistorico} 
                        onProcessarLote={handleProcessarLoteNfce} 
                        onCancelarNfce={handleCancelarNfce} 
                        onBaixarXml={handleBaixarXml} 
                        onConsultarStatus={handleConsultarStatus}
                    />

                    <ModalListaTurnos visivel={mostrarListaTurnos} onClose={() => setMostrarListaTurnos(false)} turnos={listaTurnos} carregando={carregandoHistorico} onVerVendas={visualizarVendasTurno} vendasDoDia={vendasTurnoAtual} />   
                    <ModalResumoTurno visivel={mostrarResumoTurno} turno={turnoSelecionadoResumo} onClose={() => { setMostrarResumoTurno(false); if (!caixaAberto) setMostrarAberturaCaixa(true); }} />
                    <ModalVendasSuspensas visivel={mostrarSuspensas} onClose={() => setMostrarSuspensas(false)} vendas={vendasSuspensas} onRestaurar={restaurarVendaSuspensa} onExcluir={excluirVendaSuspensa} />             
                    
                    {/* MODAL DA BALANÇA */}
                    <ModalPesoBalanca 
                        visivel={produtoParaPeso !== null} 
                        produto={produtoParaPeso} 
                        onClose={() => setProdutoParaPeso(null)} 
                        onConfirm={adicionarItemPeso} 
                    />

                </>
            )}
            
            {/* ESTILOS */}
            <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        @media print {
          html, body { height: auto !important; overflow: visible !important; background: white !important; }
          body * { visibility: hidden; }
          #main-app-wrapper { position: static !important; overflow: visible !important; height: auto !important; display: block !important; }
          #recibo-overlay, #resumo-turno-overlay { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: none !important; visibility: visible !important; z-index: 9999 !important; display: block !important; }
          #recibo-content, #recibo-content *, #resumo-turno-content, #resumo-turno-content * { visibility: visible !important; }
          #recibo-content, #resumo-turno-content { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; background: white !important; }
          .no-print { display: none !important; }
          .bg-gray-50, .bg-gray-100 { background-color: white !important; }
        }
      `}</style>
        </div>
    );
};

export default PdvScreen;