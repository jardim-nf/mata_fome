import { useCallback, useEffect, useMemo, useState } from 'react';
import { caixaService } from '../services/caixaService';
import { vendaService } from '../services/vendaService';
import { toast } from 'react-toastify';
import { formatarData } from '../components/pdv-modals';
import { usePdvStore } from '../store/usePdvStore';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const parseSafelyDate = (dateVal) => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal.toDate === 'function') return dateVal.toDate();
    if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? new Date() : d;
};

const traduzirForma = (metodo) => {
    if (!metodo) return 'Outros';
    const m = metodo.toLowerCase().trim();
    const mapa = {
        'credit_card': 'Cartão de Crédito',
        'debit_card': 'Cartão de Débito',
        'money': 'Dinheiro',
        'cash': 'Dinheiro',
        'dinheiro': 'Dinheiro',
        'pix': 'PIX',
        'pix_manual': 'PIX Manual',
        'pix manual': 'PIX Manual',
        'wallet': 'Carteira Digital',
        'card': 'Cartão',
        'cartao': 'Cartão',
        'cartão': 'Cartão',
        'cartao_credito': 'Cartão de Crédito',
        'cartao_debito': 'Cartão de Débito',
        'cartao_de_credito': 'Cartão de Crédito',
        'cartao_de_debito': 'Cartão de Débito',
        'online': 'Online',
        'crediario': 'Crediário',
        'crediário': 'Crediário',
        'credito': 'Cartão de Crédito',
        'crédito': 'Cartão de Crédito',
        'debito': 'Cartão de Débito',
        'débito': 'Cartão de Débito'
    };
    return mapa[m] || metodo.charAt(0).toUpperCase() + metodo.slice(1);
};

const mapearMovimentacoesParaVendasVirtuais = (itens) => {
    if (!itens || !Array.isArray(itens)) return [];
    
    const virtuais = [];
    itens.forEach((m, idx) => {
        const desc = m.descricao || '';
        const isCrediario = desc.startsWith('Receb. Crediário');
        
        if (isCrediario) {
            let cliente = 'Cliente Crediário';
            const parts = desc.split('Crediário:');
            if (parts[1]) {
                cliente = parts[1].split('(via')[0].trim();
            }

            let forma = 'Outros';
            const viaParts = desc.split('(via ');
            if (viaParts[1]) {
                forma = viaParts[1].replace(')', '').trim();
            }
            
            const formaTraduzida = traduzirForma(forma);

            virtuais.push({
                id: m.id || `virtual-${idx}-${m.valor}`,
                cliente: cliente,
                createdAt: m.data ? (m.data.toDate ? m.data.toDate() : new Date(m.data)) : new Date(),
                total: Number(m.valor || 0),
                formaPagamento: formaTraduzida,
                status: 'pago',
                fiscal: { status: 'RECIBO' },
                itens: [{
                    nome: `Amortização Crediário`,
                    quantidade: 1,
                    preco: Number(m.valor || 0)
                }],
                pagamentos: [{
                    forma: forma.toLowerCase(),
                    valor: Number(m.valor || 0)
                }],
                origem: 'crediario'
            });
        }
    });
    return virtuais;
};

const mapearOSParaVendasVirtuais = (osList) => {
    if (!osList || !Array.isArray(osList)) return [];

    return osList.map(os => {
        const pag = (os.pagamentos && os.pagamentos[0]) || {};
        const formaOriginal = pag.forma || os.formaPagamento || 'Outros';
        const formaTraduzida = traduzirForma(formaOriginal);
        
        return {
            id: os.id,
            cliente: os.cliente?.nome || 'Cliente OS',
            createdAt: os.faturadoEm ? (os.faturadoEm.toDate ? os.faturadoEm.toDate() : new Date(os.faturadoEm)) : new Date(),
            total: Number(os.total || 0),
            formaPagamento: formaTraduzida,
            status: 'pago',
            fiscal: { status: 'RECIBO' },
            itens: [
                ...(os.servicos || []).map(s => ({ nome: `SERVIÇO: ${s.descricao}`, quantidade: 1, preco: Number(s.valor || 0) })),
                ...(os.pecas || []).map(p => ({ nome: `PEÇA: ${p.nome}`, quantidade: 1, preco: Number(p.valor || 0) }))
            ],
            pagamentos: os.pagamentos || [{
                forma: formaOriginal.toLowerCase(),
                valor: Number(os.total || 0)
            }],
            origem: 'os',
            numeroOS: os.numeroOS || os.numeroOSStr
        };
    });
};

export function usePdvCaixa(currentUser, estabelecimentoAtivo, inputBuscaRef, autoOpenAbertura = true) {
    const {
        caixaAberto, setCaixaAberto,
        verificandoCaixa, setVerificandoCaixa,
        mostrarFechamentoCaixa, setMostrarFechamentoCaixa,
        mostrarMovimentacao, setMostrarMovimentacao,
        movimentacoesDoTurno, setMovimentacoesDoTurno,
        listaTurnos, setListaTurnos,
        carregandoHistorico, setCarregandoHistorico,
        mostrarResumoTurno, setMostrarResumoTurno,
        turnoSelecionadoResumo, setTurnoSelecionadoResumo,
        vendasBaseLocal, setVendasBaseLocal,
        
        setMostrarAberturaCaixa,
        setVendasHistoricoExibicao,
        setTituloHistorico,
        setMostrarListaTurnos,
        setMostrarHistorico,
        setVendaAtual,
    } = usePdvStore();

    const [ordensServicoPagas, setOrdensServicoPagas] = useState([]);

    useEffect(() => {
        if (!estabelecimentoAtivo || !currentUser) return;
        const initCaixa = async () => {
            // Se já temos um caixa aberto na store correspondente, não precisamos verificar no Firestore
            const currentCaixa = usePdvStore.getState().caixaAberto;
            if (currentCaixa && currentCaixa.estabelecimentoId === estabelecimentoAtivo && currentCaixa.status === 'aberto') {
                return;
            }
            setVerificandoCaixa(true);
            const c = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
            if (c) {
                setCaixaAberto(c);

                // Buscar OS pagas no turno
                let osPagas = [];
                try {
                    const qOS = query(
                        collection(db, 'estabelecimentos', estabelecimentoAtivo, 'ordensServico'),
                        where('situacaoFinanceira', '==', 'pago')
                    );
                    const osSnap = await getDocs(qOS);
                    const dataAbertura = parseSafelyDate(c.dataAbertura);
                    const timeAbertura = dataAbertura.getTime();
                    
                    osSnap.forEach(docSnap => {
                        const d = docSnap.data();
                        if (d.faturadoEm) {
                            const dateFaturado = parseSafelyDate(d.faturadoEm);
                            const timeFaturado = dateFaturado.getTime();
                            if (timeFaturado >= timeAbertura) {
                                osPagas.push({ id: docSnap.id, ...d, faturadoEm: dateFaturado });
                            }
                        }
                    });
                } catch (osErr) {
                    console.error("Erro ao carregar OS do turno:", osErr);
                }
                setOrdensServicoPagas(osPagas);

                const [vendas, movs] = await Promise.all([
                    vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 50),
                    caixaService.buscarMovimentacoes(c.id).catch(() => ({ totalSuprimento: 0, totalSuprimentoDinheiro: 0, totalSangria: 0, itens: [] }))
                ]);
                setVendasBaseLocal(vendas);
                setMovimentacoesDoTurno(movs);
                setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
                setTimeout(() => inputBuscaRef.current?.focus(), 500);
            } else if (autoOpenAbertura) {
                setMostrarAberturaCaixa(true);
            }
            setVerificandoCaixa(false);
        };
        initCaixa();
    }, [currentUser, estabelecimentoAtivo, setCaixaAberto, setVendasBaseLocal, setVendaAtual, setMostrarAberturaCaixa, setVerificandoCaixa, inputBuscaRef, autoOpenAbertura, setMovimentacoesDoTurno]);

    const vendasTurnoAtual = useMemo(() => {
        if (!caixaAberto) return [];
        const dateAbertura = parseSafelyDate(caixaAberto.dataAbertura);
        const timeAbertura = dateAbertura.getTime();
        
        const normais = vendasBaseLocal.filter(v => { 
            if (v.status === 'cancelado' || v.status === 'cancelada') return false;
            const statusNfce = v.fiscal?.status?.toUpperCase() || '';
            if (statusNfce.includes('CANCEL')) return false;

            const dateVenda = parseSafelyDate(v.createdAt);
            const timeVenda = dateVenda.getTime();
            return timeVenda >= (timeAbertura - 60000); 
        });

        const virtuaisOS = mapearOSParaVendasVirtuais(ordensServicoPagas);
        const virtuaisCrediario = mapearMovimentacoesParaVendasVirtuais(movimentacoesDoTurno?.itens);
        const combinado = [...normais, ...virtuaisOS, ...virtuaisCrediario];
        combinado.sort((a, b) => {
            const timeA = parseSafelyDate(a.createdAt).getTime();
            const timeB = parseSafelyDate(b.createdAt).getTime();
            return timeB - timeA;
        });

        return combinado;
    }, [vendasBaseLocal, caixaAberto, movimentacoesDoTurno, ordensServicoPagas]);

    const handleAbrirCaixa = async (saldoInicial) => {
        const checkAtivo = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
        if (checkAtivo) { 
            toast.warning('Você já possui um turno em andamento!'); 
            setCaixaAberto(checkAtivo); 
            setMostrarAberturaCaixa(false); 
            return; 
        }
        const res = await caixaService.abrirCaixa({ usuarioId: currentUser.uid, estabelecimentoId: estabelecimentoAtivo, saldoInicial });
        if (res.success) { 
            // Constrói o objeto do caixa aberto localmente para evitar a latência de replicação do Firestore
            const novoCaixa = {
                id: res.id,
                usuarioId: currentUser.uid,
                estabelecimentoId: estabelecimentoAtivo,
                saldoInicial: Number(saldoInicial) || 0,
                status: 'aberto',
                dataAbertura: new Date()
            };
            setCaixaAberto(novoCaixa); 
            setVendasBaseLocal([]);
            setMostrarAberturaCaixa(false); 
            setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 }); 
            setTimeout(() => inputBuscaRef.current?.focus(), 500); 
        } else {
            toast.error('Erro: ' + res.error);
        }
    };

    const prepararFechamento = useCallback(async () => { 
        if (!caixaAberto) return; 
        setCarregandoHistorico(true);
        try {
            const dataAbertura = parseSafelyDate(caixaAberto.dataAbertura);
            const dataInicio = new Date(dataAbertura.getTime() - 60000);
            
            // Busca vendas, movimentações e OS pagas em paralelo para performance e segurança
            const [vendasTurno, movimentacoes, osSnap] = await Promise.all([
                vendaService.buscarVendasPorIntervalo(null, estabelecimentoAtivo, dataInicio, new Date()).catch(err => {
                    console.error("Erro ao carregar vendas para o fechamento:", err);
                    return [];
                }),
                caixaAberto.id ? caixaService.buscarMovimentacoes(caixaAberto.id).catch(err => {
                    console.error("Erro ao carregar movimentações do caixa:", err);
                    return { totalSuprimento: 0, totalSuprimentoDinheiro: 0, totalSangria: 0, totalSangriaDinheiro: 0, itens: [] };
                }) : Promise.resolve({ totalSuprimento: 0, totalSuprimentoDinheiro: 0, totalSangria: 0, totalSangriaDinheiro: 0, itens: [] }),
                getDocs(query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'ordensServico'), where('situacaoFinanceira', '==', 'pago'))).catch(() => ({ docs: [] }))
            ]);
            
            const osPagas = [];
            const timeAbertura = dataAbertura.getTime();
            osSnap.forEach(docSnap => {
                const d = docSnap.data();
                if (d.faturadoEm) {
                    const dateFaturado = parseSafelyDate(d.faturadoEm);
                    const timeFaturado = dateFaturado.getTime();
                    if (timeFaturado >= timeAbertura) {
                        osPagas.push({ id: docSnap.id, ...d, faturadoEm: dateFaturado });
                    }
                }
            });
            setOrdensServicoPagas(osPagas);

            setVendasBaseLocal(vendasTurno);
            setMovimentacoesDoTurno(movimentacoes);
            setMostrarFechamentoCaixa(true);
        } catch (error) {
            console.error("Erro crítico ao preparar fechamento de caixa:", error);
            toast.error("Não foi possível carregar os dados para fechamento.");
        } finally {
            setCarregandoHistorico(false);
        }
    }, [caixaAberto, estabelecimentoAtivo, setMovimentacoesDoTurno, setVendasBaseLocal, setCarregandoHistorico, setMostrarFechamentoCaixa]);

    const handleConfirmarFechamento = async (dados, setVendasSuspensas) => { 
        const res = await caixaService.fecharCaixa(caixaAberto.id, { 
            ...dados, 
            estabelecimentoId: estabelecimentoAtivo 
        }); 
        if (res.success) { 
            toast.success('🔒 Turno encerrado!'); 
            
            // Tratamento preventivo de turnos duplicados: busca outros turnos que tenham ficado abertos
            // por conta de falhas de latência anteriores e encerra-os de forma automática.
            try {
                const q = query(
                    collection(db, 'caixas'), 
                    where('estabelecimentoId', '==', estabelecimentoAtivo), 
                    where('status', '==', 'aberto')
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    for (const docSnap of snapshot.docs) {
                        if (docSnap.id !== caixaAberto.id) {
                            await caixaService.fecharCaixa(docSnap.id, {
                                ...dados,
                                estabelecimentoId: estabelecimentoAtivo,
                                observacoes: (dados.observacoes || '') + ' [Fechamento automático de turno duplicado]'
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Erro ao limpar turnos duplicados no fechamento:", err);
            }

            setCaixaAberto(null); 
            setVendasBaseLocal([]);
            if (setVendasSuspensas) setVendasSuspensas([]); 
            setMostrarFechamentoCaixa(false); 
            setVendaAtual(null); 
            setTurnoSelecionadoResumo({ ...caixaAberto, resumoVendas: dados.resumoVendas, saldoFinalInformado: dados.saldoFinalInformado, diferenca: dados.diferenca, dataFechamento: new Date(), status: 'fechado' }); 
            setMostrarResumoTurno(true);
        } else {
            toast.error('Erro ao fechar caixa: ' + res.error);
        }
    };

    const abrirMovimentacao = useCallback(() => { 
        if (!caixaAberto) return toast.warning("Caixa Fechado!"); 
        setMostrarMovimentacao(true); 
    }, [caixaAberto, setMostrarMovimentacao]);

    const handleSalvarMovimentacao = async (dados) => { 
        const res = await caixaService.adicionarMovimentacao(caixaAberto.id, { 
            ...dados, 
            usuarioId: currentUser.uid, 
            estabelecimentoId: estabelecimentoAtivo 
        }); 
        if (res.success) { 
            toast.success('Movimentação registrada!'); 
            setMostrarMovimentacao(false); 
            caixaService.buscarMovimentacoes(caixaAberto.id).then(movs => {
                setMovimentacoesDoTurno(movs);
            }).catch(() => {});
        } else {
            toast.error('Erro: ' + res.error);
        }
    };

    const handleEditarMovimentacao = async (movId, dados) => {
        const res = await caixaService.atualizarMovimentacao(caixaAberto.id, movId, {
            ...dados,
            usuarioId: currentUser.uid,
            estabelecimentoId: estabelecimentoAtivo
        });
        if (res.success) {
            toast.success('Movimentação atualizada!');
            setMostrarMovimentacao(false);
            caixaService.buscarMovimentacoes(caixaAberto.id).then(movs => {
                setMovimentacoesDoTurno(movs);
            }).catch(() => {});
        } else {
            toast.error('Erro ao atualizar: ' + res.error);
        }
    };

    const handleExcluirMovimentacao = async (movId) => {
        if (!window.confirm("Tem certeza que deseja excluir esta movimentação?")) return;
        const res = await caixaService.excluirMovimentacao(caixaAberto.id, movId);
        if (res.success) {
            toast.success('Movimentação excluída!');
            caixaService.buscarMovimentacoes(caixaAberto.id).then(movs => {
                setMovimentacoesDoTurno(movs);
            }).catch(() => {});
        } else {
            toast.error('Erro ao excluir: ' + res.error);
        }
    };

    const carregarListaTurnos = useCallback(async () => { 
        if (!estabelecimentoAtivo) return; 
        setCarregandoHistorico(true); 
        setMostrarListaTurnos(true); 
        setListaTurnos(await caixaService.listarTodosTurnos(estabelecimentoAtivo)); 
        setCarregandoHistorico(false); 
    }, [estabelecimentoAtivo, setCarregandoHistorico, setMostrarListaTurnos, setListaTurnos]);

    const visualizarVendasTurno = useCallback(async (turno) => { 
        setCarregandoHistorico(true); 
        const dateAbertura = parseSafelyDate(turno.dataAbertura);
        const dateFechamento = parseSafelyDate(turno.dataFechamento || new Date());
        setTituloHistorico(`Vendas ${turno.dataAbertura ? formatarData(dateAbertura) : ''}`); 
        
        const [vendasPeriodo, movsPeriodo, osSnap] = await Promise.all([
            vendaService.buscarVendasPorIntervalo(null, estabelecimentoAtivo, dateAbertura, dateFechamento),
            caixaService.buscarMovimentacoes(turno.id).catch(() => ({ itens: [] })),
            getDocs(query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'ordensServico'), where('situacaoFinanceira', '==', 'pago'))).catch(() => ({ docs: [] }))
        ]);
        
        const osPagas = [];
        const timeAbertura = dateAbertura.getTime();
        const timeFechamento = dateFechamento.getTime();
        osSnap.forEach(docSnap => {
            const d = docSnap.data();
            if (d.faturadoEm) {
                const dateFaturado = parseSafelyDate(d.faturadoEm);
                const timeFaturado = dateFaturado.getTime();
                if (timeFaturado >= timeAbertura && timeFaturado <= timeFechamento) {
                    osPagas.push({ id: docSnap.id, ...d, faturadoEm: dateFaturado });
                }
            }
        });

        const virtuaisOS = mapearOSParaVendasVirtuais(osPagas);
        const virtuaisCrediario = mapearMovimentacoesParaVendasVirtuais(movsPeriodo.itens);
        const combinado = [...vendasPeriodo, ...virtuaisOS, ...virtuaisCrediario];
        combinado.sort((a, b) => {
            const timeA = parseSafelyDate(a.createdAt).getTime();
            const timeB = parseSafelyDate(b.createdAt).getTime();
            return timeB - timeA;
        });

        setVendasHistoricoExibicao(combinado); 
        setCarregandoHistorico(false); 
        setMostrarListaTurnos(false); 
        setMostrarHistorico(true); 
    }, [estabelecimentoAtivo, setCarregandoHistorico, setTituloHistorico, setVendasHistoricoExibicao, setMostrarListaTurnos, setMostrarHistorico]);

    const visualizarResumoTurno = useCallback((turno) => { 
        setTurnoSelecionadoResumo(turno); 
        setMostrarListaTurnos(false); 
        setMostrarResumoTurno(true); 
    }, [setTurnoSelecionadoResumo, setMostrarListaTurnos, setMostrarResumoTurno]);

    return {
        caixaAberto,
        verificandoCaixa,
        vendasTurnoAtual,
        mostrarFechamentoCaixa, setMostrarFechamentoCaixa,
        mostrarMovimentacao, setMostrarMovimentacao,
        movimentacoesDoTurno,
        listaTurnos,
        carregandoHistorico, setCarregandoHistorico,
        mostrarResumoTurno, setMostrarResumoTurno,
        turnoSelecionadoResumo, setTurnoSelecionadoResumo,
        handleAbrirCaixa,
        prepararFechamento,
        handleConfirmarFechamento,
        abrirMovimentacao,
        handleSalvarMovimentacao,
        handleEditarMovimentacao,
        handleExcluirMovimentacao,
        carregarListaTurnos,
        visualizarVendasTurno,
        visualizarResumoTurno,
        setVendasBaseLocal
    };
}
