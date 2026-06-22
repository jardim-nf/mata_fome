import { useCallback, useEffect, useMemo } from 'react';
import { caixaService } from '../services/caixaService';
import { vendaService } from '../services/vendaService';
import { toast } from 'react-toastify';
import { formatarData } from '../components/pdv-modals';
import { usePdvStore } from '../store/usePdvStore';

const parseSafelyDate = (dateVal) => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal.toDate === 'function') return dateVal.toDate();
    if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? new Date() : d;
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

    useEffect(() => {
        if (!estabelecimentoAtivo || !currentUser) return;
        const initCaixa = async () => {
            setVerificandoCaixa(true);
            const c = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
            if (c) {
                setCaixaAberto(c);
                const vendas = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 50);
                setVendasBaseLocal(vendas);
                setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
                setTimeout(() => inputBuscaRef.current?.focus(), 500);
            } else if (autoOpenAbertura) {
                setMostrarAberturaCaixa(true);
            }
            setVerificandoCaixa(false);
        };
        initCaixa();
    }, [currentUser, estabelecimentoAtivo, setCaixaAberto, setVendasBaseLocal, setVendaAtual, setMostrarAberturaCaixa, setVerificandoCaixa, inputBuscaRef, autoOpenAbertura]);

    const vendasTurnoAtual = useMemo(() => {
        if (!caixaAberto) return [];
        const dateAbertura = parseSafelyDate(caixaAberto.dataAbertura);
        const timeAbertura = dateAbertura.getTime();
        return vendasBaseLocal.filter(v => { 
            const dateVenda = parseSafelyDate(v.createdAt);
            const timeVenda = dateVenda.getTime();
            return timeVenda >= (timeAbertura - 60000); 
        });
    }, [vendasBaseLocal, caixaAberto]);

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
            setCaixaAberto(await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo) || res); 
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
            
            // Busca vendas e movimentações em paralelo para performance e segurança
            const [vendasTurno, movimentacoes] = await Promise.all([
                vendaService.buscarVendasPorIntervalo(null, estabelecimentoAtivo, dataInicio, new Date()).catch(err => {
                    console.error("Erro ao carregar vendas para o fechamento:", err);
                    return [];
                }),
                caixaAberto.id ? caixaService.buscarMovimentacoes(caixaAberto.id).catch(err => {
                    console.error("Erro ao carregar movimentações do caixa:", err);
                    return { totalSuprimento: 0, totalSangria: 0, itens: [] };
                }) : Promise.resolve({ totalSuprimento: 0, totalSangria: 0, itens: [] })
            ]);
            
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
        } else {
            toast.error('Erro: ' + res.error);
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
        
        // Busca todas as vendas do intervalo sem filtrar por usuarioId no banco (evita ocultar vendas sem ID de mesas)
        const vendasPeriodo = await vendaService.buscarVendasPorIntervalo(null, estabelecimentoAtivo, dateAbertura, dateFechamento);
        
        setVendasHistoricoExibicao(vendasPeriodo); 
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
        carregarListaTurnos,
        visualizarVendasTurno,
        visualizarResumoTurno,
        setVendasBaseLocal
    };
}
