import { useState, useCallback, useEffect, useMemo } from 'react';
import { caixaService } from '../services/caixaService';
import { vendaService } from '../services/vendaService';
import { toast } from 'react-toastify';
import { formatarData } from '../components/pdv-modals';

export function usePdvCaixa(currentUser, estabelecimentoAtivo, setVendaAtual, setVendasBase, inputBuscaRef, setMostrarAberturaCaixa, setVendasHistoricoExibicao, setTituloHistorico, setMostrarListaTurnos, setMostrarHistorico) {
    const [caixaAberto, setCaixaAberto] = useState(null);
    const [verificandoCaixa, setVerificandoCaixa] = useState(true);
    const [mostrarFechamentoCaixa, setMostrarFechamentoCaixa] = useState(false);
    const [mostrarMovimentacao, setMostrarMovimentacao] = useState(false);
    const [movimentacoesDoTurno, setMovimentacoesDoTurno] = useState({ totalSuprimento: 0, totalSangria: 0 });
    const [listaTurnos, setListaTurnos] = useState([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [mostrarResumoTurno, setMostrarResumoTurno] = useState(false);
    const [turnoSelecionadoResumo, setTurnoSelecionadoResumo] = useState(null);
    const [vendasBaseLocal, setVendasBaseLocal] = useState([]);

    useEffect(() => {
        if (!estabelecimentoAtivo || !currentUser) return;
        const initCaixa = async () => {
            setVerificandoCaixa(true);
            const c = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
            if (c) {
                setCaixaAberto(c);
                const vendas = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 50);
                setVendasBase(vendas);
                setVendasBaseLocal(vendas);
                setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
                setTimeout(() => inputBuscaRef.current?.focus(), 500);
            } else {
                setMostrarAberturaCaixa(true);
            }
            setVerificandoCaixa(false);
        };
        initCaixa();
    }, [currentUser, estabelecimentoAtivo]); // Removido setVendaAtual das dependências para não disparar recarregamento do caixa a cada render

    const vendasTurnoAtual = useMemo(() => {
        if (!caixaAberto) return [];
        let timeAbertura; 
        try { 
            timeAbertura = caixaAberto.dataAbertura?.toDate ? caixaAberto.dataAbertura.toDate().getTime() : new Date(caixaAberto.dataAbertura).getTime(); 
        } catch { 
            timeAbertura = Date.now(); 
        }
        return vendasBaseLocal.filter(v => { 
            let timeVenda; 
            try { 
                timeVenda = v.createdAt?.toDate ? v.createdAt.toDate().getTime() : new Date(v.createdAt).getTime(); 
            } catch { 
                return false; 
            } 
            return v.usuarioId === currentUser.uid && timeVenda >= (timeAbertura - 60000); 
        });
    }, [vendasBaseLocal, caixaAberto, currentUser]);

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
            setVendasBase([]); 
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
        setMovimentacoesDoTurno(await caixaService.buscarMovimentacoes(caixaAberto.id)); 
        setMostrarFechamentoCaixa(true); 
    }, [caixaAberto]);

    const handleConfirmarFechamento = async (dados, setVendasSuspensas) => { 
        const res = await caixaService.fecharCaixa(caixaAberto.id, dados); 
        if (res.success) { 
            toast.success('🔒 Turno encerrado!'); 
            setCaixaAberto(null); 
            setVendasBase([]); 
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
    }, [caixaAberto]);

    const handleSalvarMovimentacao = async (dados) => { 
        const res = await caixaService.adicionarMovimentacao(caixaAberto.id, { ...dados, usuarioId: currentUser.uid }); 
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
        setListaTurnos(await caixaService.listarTurnos(currentUser.uid, estabelecimentoAtivo)); 
        setCarregandoHistorico(false); 
    }, [currentUser, estabelecimentoAtivo, setMostrarListaTurnos]);

    const visualizarVendasTurno = useCallback(async (turno) => { 
        setCarregandoHistorico(true); 
        setTituloHistorico(`Vendas ${turno.dataAbertura ? formatarData(turno.dataAbertura) : ''}`); 
        setVendasHistoricoExibicao(await vendaService.buscarVendasPorIntervalo(currentUser.uid, estabelecimentoAtivo, turno.dataAbertura, turno.dataFechamento)); 
        setCarregandoHistorico(false); 
        setMostrarListaTurnos(false); 
        setMostrarHistorico(true); 
    }, [currentUser, estabelecimentoAtivo, setTituloHistorico, setVendasHistoricoExibicao, setMostrarListaTurnos, setMostrarHistorico]);

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
        setVendasBaseLocal
    };
}
