import React, { useState, useEffect, useRef, useCallback } from 'react';
import BackButton from '../../components/BackButton';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { vendaService } from '../../services/vendaService';
import { produtoService } from '../../services/produtoService';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, setDoc, collection } from 'firebase/firestore';

import { usePdvProducts } from '../../hooks/usePdvProducts';
import { usePdvCart } from '../../hooks/usePdvCart';
import { usePdvCaixa } from '../../hooks/usePdvCaixa';
import { usePdvNfce } from '../../hooks/usePdvNfce';
import { usePdvStore } from '../../store/usePdvStore';

import { 
    formatarMoeda,
    ModalEdicaoItemCarrinho, ModalSelecaoVariacao, ModalAberturaCaixa, 
    ModalFechamentoCaixa, ModalMovimentacao, ModalFinalizacao, 
    ModalRecibo, ModalHistorico, ModalListaTurnos, ModalResumoTurno, ModalVendasSuspensas,
    ModalPesoBalanca, ModalOpcoesProduto, ModalClientePdv, ModalBuscaProduto, ModalNovoProdutoPdv
} from '../../components/pdv-modals';
import { 
    IoArrowBack, IoSearch, IoCart, IoStorefrontOutline, IoCheckmarkCircleOutline, 
    IoTrashOutline, IoCreateOutline, IoEllipsisHorizontal, IoPauseOutline, 
    IoPeopleOutline, IoTimeOutline, IoCashOutline, IoSwapHorizontalOutline, 
    IoCloseCircleOutline, IoReceiptOutline
} from 'react-icons/io5';
import { toast, ToastContainer } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PromptDialog from '../../components/ui/PromptDialog';
import './PdvScreen.css';

const construirMensagemRecibo = (venda, nomeLoja) => {
    const idCurto = venda.id?.slice(-6).toUpperCase() || 'PDV';
    const dataFmt = venda.createdAt?.toDate 
        ? venda.createdAt.toDate().toLocaleString('pt-BR') 
        : new Date(venda.createdAt).toLocaleString('pt-BR');
    
    let msg = `Olá! Agradecemos a preferência. 😃\n`;
    msg += `Aqui está o seu recibo de compra:\n\n`;
    msg += `📄 *RECIBO DE VENDA*\n`;
    msg += `*Loja:* ${nomeLoja}\n`;
    msg += `*Venda:* #${idCurto}\n`;
    msg += `*Data:* ${dataFmt}\n\n`;
    
    msg += `📦 *ITENS:*\n`;
    (venda.itens || []).forEach(it => {
        const qtd = it.quantidade || it.quantity || it.qtd || 1;
        const nome = it.nome || it.name || 'Item';
        const preco = Number(it.precoFinal || it.precoUnitario || it.preco || it.valor || it.price || 0);
        msg += `- ${qtd}x ${nome}: R$ ${(preco * qtd).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        if (it.observacao) {
            msg += `  _(Obs: ${it.observacao})_\n`;
        }
    });
    
    msg += `-----------------------------\n`;
    if (venda.subtotal !== undefined && (Number(venda.desconto) > 0 || Number(venda.acrescimo) > 0)) {
        msg += `*Subtotal:* R$ ${Number(venda.subtotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        if (Number(venda.desconto) > 0) {
            msg += `*Desconto (-):* R$ ${Number(venda.desconto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        }
        if (Number(venda.acrescimo) > 0) {
            msg += `*Acréscimo (+):* R$ ${Number(venda.acrescimo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        }
    }
    msg += `*TOTAL:* R$ ${Number(venda.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
    
    if (venda.pagamentos && venda.pagamentos.length > 0) {
        msg += `💳 *PAGAMENTO:*\n`;
        venda.pagamentos.forEach(p => {
            const formaMap = {
                dinheiro: '💵 Dinheiro',
                cartao: '💳 Cartão',
                cartao_debito: '💳 Cartão de Débito',
                cartao_credito: '💳 Cartão de Crédito',
                pix: '💠 PIX',
                crediario: '🤝 Crediário'
            };
            let forma = formaMap[p.forma] || p.forma.toUpperCase();
            if (p.forma === 'cartao_credito' && p.parcelas && p.parcelas > 1) {
                forma += ` (${p.parcelas}x)`;
            }
            msg += `- ${forma}: R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        });
        if (Number(venda.troco) > 0) {
            msg += `- *Troco:* R$ ${Number(venda.troco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        }
    } else if (venda.formaPagamento) {
        const formaMap = {
            dinheiro: '💵 Dinheiro',
            cartao: '💳 Cartão',
            cartao_debito: '💳 Cartão de Débito',
            cartao_credito: '💳 Cartão de Crédito',
            pix: '💠 PIX',
            crediario: '🤝 Crediário'
        };
        const forma = formaMap[venda.formaPagamento] || venda.formaPagamento.toUpperCase();
        msg += `💳 *Forma de Pagamento:* ${forma}\n`;
    }
    
    if (venda.fiscal?.pdf) {
        msg += `\n🧾 *Nota Fiscal (NFC-e):*\n${venda.fiscal.pdf}`;
    }
    
    return msg;
};

const PdvScreen = () => {
    const { userData, currentUser, estabelecimentoIdPrincipal, isMasterAdmin } = useAuth();
    const navigate = useNavigate();

    // Estabelecimento Ativo (Locked to logged-in store)
    const estabelecimentoAtivo = estabelecimentoIdPrincipal || null;
    const [nomeLoja, setNomeLoja] = useState('...');
    const [isVarejo, setIsVarejo] = useState(false);
    const [wppConfig, setWppConfig] = useState(null);

    useEffect(() => {
        if (!estabelecimentoAtivo) return;
        const carregarNomeLoja = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'estabelecimentos', estabelecimentoAtivo));
                if (docSnap.exists()) {
                    setNomeLoja(docSnap.data().nome || 'Loja Sem Nome');
                    setIsVarejo(docSnap.data().tipoNegocio === 'varejo');
                    setWppConfig(docSnap.data().whatsapp || null);
                }
            } catch (e) {
                console.error('Erro ao carregar nome do estabelecimento:', e);
            }
        };
        carregarNomeLoja();
    }, [estabelecimentoAtivo]);

    // Refs Globais e UI states básicos
    const inputBuscaRef = useRef(null);
    const [mostrarCarrinhoMobile, setMostrarCarrinhoMobile] = useState(false);


    
    // UI - Históricos e Modais Extra from Zustand Store
    const {
        mostrarAberturaCaixa, setMostrarAberturaCaixa,
        mostrarFinalizacao, setMostrarFinalizacao,
        mostrarRecibo, setMostrarRecibo,
        mostrarListaTurnos, setMostrarListaTurnos,
        mostrarHistorico, setMostrarHistorico,
        dadosRecibo, setDadosRecibo,
        vendasHistoricoExibicao, setVendasHistoricoExibicao,
        tituloHistorico, setTituloHistorico,
        setVendasBaseLocal,
    } = usePdvStore();
    const [salvando, setSalvando] = useState(false);
    const [cpfNota, setCpfNota] = useState('');
    const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
    const [mostrarModalBusca, setMostrarModalBusca] = useState(false);
    const [mostrarModalBuscaEdicao, setMostrarModalBuscaEdicao] = useState(false);
    const [produtoParaEditarPdv, setProdutoParaEditarPdv] = useState(null);
    const [mostrarNovoProdutoModal, setMostrarNovoProdutoModal] = useState(false);
    const [mostrarMenuMais, setMostrarMenuMais] = useState(false);

    // Dialogs
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [promptDialog, setPromptDialog] = useState(null);

    const showConfirm = useCallback((message, onConfirm, opts = {}) => {
        setConfirmDialog({ message, onConfirmCb: onConfirm, title: opts.title || '', variant: opts.variant || 'default', confirmText: opts.confirmText || 'Confirmar', cancelText: opts.cancelText || 'Cancelar' });
    }, []);
    const showPrompt = useCallback((message, onSubmit, opts = {}) => {
        setPromptDialog({ message, onSubmitCb: onSubmit, title: opts.title || '', placeholder: opts.placeholder || '', defaultValue: opts.defaultValue || '', confirmText: opts.submitText || opts.confirmText || 'OK', cancelText: opts.cancelText || 'Cancelar' });
    }, []);

    // ----- INJETANDO NOSSOS HOOKS DE NEGÓCIO -----
    const { 
        produtos, categorias, carregandoProdutos, categoriaAtiva, setCategoriaAtiva, busca, setBusca, produtosFiltrados, produtosExibidos, temMaisProdutos, carregarMaisProdutos, recarregar 
    } = usePdvProducts(estabelecimentoAtivo);

    // Categorias scroll horizontal (definidas após a inicialização das variáveis do hook)
    const categoriesContainerRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = useCallback(() => {
        const el = categoriesContainerRef.current;
        if (el) {
            setCanScrollLeft(el.scrollLeft > 5);
            setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
        }
    }, []);

    const scrollCategories = (direction) => {
        const el = categoriesContainerRef.current;
        if (el) {
            el.scrollBy({ left: direction, behavior: 'smooth' });
        }
    };

    const handlePdvProductsScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 150) {
            if (temMaisProdutos) {
                carregarMaisProdutos();
            }
        }
    };

    useEffect(() => {
        const el = categoriesContainerRef.current;
        if (el) {
            el.addEventListener('scroll', checkScroll);
            window.addEventListener('resize', checkScroll);
            checkScroll();
            const timer = setTimeout(checkScroll, 300);
            return () => {
                el.removeEventListener('scroll', checkScroll);
                window.removeEventListener('resize', checkScroll);
                clearTimeout(timer);
            };
        }
    }, [produtos, categorias, checkScroll]);

    const pdvCaixa = usePdvCaixa(
        currentUser, estabelecimentoAtivo, inputBuscaRef
    );

    const pdvCart = usePdvCart(pdvCaixa.caixaAberto, inputBuscaRef, showPrompt, showConfirm);
    
    // Estados e helpers para Data, Hora e Duração do Turno
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 10000); // Atualiza a cada 10 segundos
        return () => clearInterval(interval);
    }, []);

    const formatarDataHora = (data) => {
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        const hora = String(data.getHours()).padStart(2, '0');
        const min = String(data.getMinutes()).padStart(2, '0');
        return `${dia}/${mes}/${ano} ${hora}:${min}`;
    };

    const getDuracaoTurno = () => {
        if (!pdvCaixa.caixaAberto || !pdvCaixa.caixaAberto.dataAbertura) return null;
        try {
            const dataAbertura = pdvCaixa.caixaAberto.dataAbertura.toDate 
                ? pdvCaixa.caixaAberto.dataAbertura.toDate() 
                : new Date(pdvCaixa.caixaAberto.dataAbertura);
            const diffMs = Math.max(0, currentDateTime - dataAbertura);
            const diffHrs = Math.floor(diffMs / 3600000);
            const diffMins = Math.floor((diffMs % 3600000) / 60000);
            
            if (diffHrs === 0) {
                return `turno aberto há ${diffMins} min`;
            }
            return `turno aberto há ${diffHrs}h e ${diffMins}m`;
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    const isTurnoExcedido24h = () => {
        if (!pdvCaixa.caixaAberto || !pdvCaixa.caixaAberto.dataAbertura) return false;
        try {
            const dataAbertura = pdvCaixa.caixaAberto.dataAbertura.toDate 
                ? pdvCaixa.caixaAberto.dataAbertura.toDate() 
                : new Date(pdvCaixa.caixaAberto.dataAbertura);
            const diffMs = Math.max(0, currentDateTime - dataAbertura);
            return diffMs >= 86400000; // 24 horas em milissegundos
        } catch (e) {
            return false;
        }
    };

    // Sync for barcode
    useEffect(() => { 
        pdvCart.pdvSyncRef.current = { 
            produtos, 
            handleProdutoClick: pdvCart.handleProdutoClick, 
            adicionarItemPeso: pdvCart.adicionarItemPeso,
            bloqueado: mostrarFinalizacao || mostrarRecibo || mostrarHistorico || pdvCart.mostrarSuspensas || pdvCaixa.mostrarMovimentacao || mostrarListaTurnos || mostrarAberturaCaixa || !pdvCaixa.caixaAberto || pdvCart.produtoParaSelecao !== null || pdvCart.itemParaEditar !== null || pdvCart.produtoParaPeso !== null || mostrarModalBusca || mostrarModalBuscaEdicao || mostrarNovoProdutoModal || mostrarModalCliente
        }; 
    });

    const tocarBeepErro = () => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, ctx.currentTime); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (e) { console.error(e); } };

    const pdvNfce = usePdvNfce(showPrompt, showConfirm, tocarBeepErro);

    // Ações de Venda Conclusivas
    const finalizarVenda = async (garantia, observacaoGarantia) => {
        setSalvando(true);
        const descNum = parseFloat(pdvCart.descontoValor || 0); const acrNum = parseFloat(pdvCart.acrescimoValor || 0);
        const totalFinal = Math.max(0, pdvCart.vendaAtual.total + acrNum - descNum);
        const totalPago = pdvCart.pagamentosAdicionados.reduce((acc, p) => acc + p.valor, 0);
        const d = { 
            estabelecimentoId: estabelecimentoAtivo, status: 'finalizada', 
            formaPagamento: pdvCart.pagamentosAdicionados.length === 1 ? pdvCart.pagamentosAdicionados[0].forma : 'misto', 
            pagamentos: pdvCart.pagamentosAdicionados, subtotal: pdvCart.vendaAtual.total, desconto: descNum, acrescimo: acrNum, total: totalFinal, 
            troco: Math.max(0, totalPago - totalFinal), valorRecebido: totalPago, itens: pdvCart.vendaAtual.itens, usuarioId: currentUser.uid, 
            cliente: pdvCart.clienteSelecionado?.nome || 'Balcão',
            clienteId: pdvCart.clienteSelecionado?.id || null,
            clienteTelefone: pdvCart.clienteSelecionado?.telefone || null,
            clienteCpf: pdvCart.clienteSelecionado?.cpf || cpfNota || null,
            endereco: pdvCart.clienteSelecionado?.endereco || null,
            createdAt: new Date(),
            garantia: garantia || null,
            observacaoGarantia: observacaoGarantia || null
        };
        const res = await vendaService.salvarVenda(d);
        if (res.success) { 
            // Envia notificação admin em background
            try {
                const { notificarAdmin } = await import('../../services/whatsappService');
                notificarAdmin(estabelecimentoAtivo, 'venda', { ...d, id: res.vendaId });
            } catch (errWpp) {
                console.error("Erro ao enviar wpp notification:", errWpp);
            }

            // Registrar saldo devedor se houver pagamento em Crediário
            const valorCrediario = pdvCart.pagamentosAdicionados
                .filter(p => p.forma === 'crediario')
                .reduce((acc, p) => acc + p.valor, 0);

            if (valorCrediario > 0 && pdvCart.clienteSelecionado?.id) {
                try {
                    const cRef = doc(db, 'estabelecimentos', estabelecimentoAtivo, 'clientes', pdvCart.clienteSelecionado.id);
                    const cSnap = await getDoc(cRef);
                    const currentSaldo = cSnap.exists() ? (cSnap.data().saldoDevedor || 0) : 0;
                    const novoSaldo = currentSaldo + valorCrediario;
                    
                    await updateDoc(cRef, {
                        saldoDevedor: novoSaldo
                    });

                    // Sincroniza com a coleção global do cliente
                    const gRef = doc(db, 'clientes', pdvCart.clienteSelecionado.id);
                    const gSnap = await getDoc(gRef);
                    if (gSnap.exists()) {
                        await updateDoc(gRef, {
                            saldoDevedor: (gSnap.data().saldoDevedor || 0) + valorCrediario
                        });
                    }

                    const crediarioPagt = pdvCart.pagamentosAdicionados.find(p => p.forma === 'crediario');
                    const dataVencimentoObj = crediarioPagt?.dataVencimento 
                        ? new Date(crediarioPagt.dataVencimento + 'T12:00:00') 
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias por padrão

                    const histRef = doc(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'clientes', pdvCart.clienteSelecionado.id, 'historico_crediario'));
                    await setDoc(histRef, {
                        tipo: 'compra',
                        valor: valorCrediario,
                        saldoPendente: valorCrediario,
                        status: 'pendente',
                        dataVencimento: dataVencimentoObj,
                        descricao: `Venda #${res.vendaId.slice(-6).toUpperCase()}`,
                        vendaId: res.vendaId,
                        data: new Date(),
                        itens: pdvCart.vendaAtual.itens.map(item => ({
                            nome: item.nome || item.name || 'Item',
                            quantidade: item.quantidade || item.quantity || item.qtd || 1,
                            preco: Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || 0)
                        }))
                    });
                } catch (err) {
                    console.error("Erro ao registrar débito de crediário:", err);
                }
            }

            setVendasBaseLocal(p => [{ ...d, id: res.vendaId }, ...p]); 
            setDadosRecibo({ ...d, id: res.vendaId }); 
            pdvCart.setVendaAtual(null); setMostrarFinalizacao(false); setMostrarRecibo(true); 
            pdvCart.setDescontoValor(''); pdvCart.setAcrescimoValor(''); setCpfNota(''); pdvCart.setPagamentosAdicionados([]); 
        }
        setSalvando(false);
    };

    const handleExcluirProduto = (p) => {
        showConfirm(
            `Deseja realmente excluir o produto "${p.name}" permanentemente do catálogo? Esta ação não pode ser desfeita.`,
            async () => {
                try {
                    const sucesso = await produtoService.excluirProduto(estabelecimentoAtivo, p.categoriaId || p.category, p.id);
                    if (sucesso) {
                        toast.success('Produto excluído com sucesso!');
                        recarregar();
                    } else {
                        toast.error('Erro ao excluir produto.');
                    }
                } catch (error) {
                    console.error('Erro ao excluir produto:', error);
                    toast.error('Erro ao excluir produto.');
                }
            },
            {
                title: '⚠️ Excluir Produto',
                variant: 'danger',
                confirmText: 'Excluir',
                cancelText: 'Cancelar'
            }
        );
    };

    const abrirHistoricoAtual = useCallback(() => { 
        setTituloHistorico("Vendas Turno Atual"); 
        setVendasHistoricoExibicao(pdvCaixa.vendasTurnoAtual); 
        setMostrarHistorico(prev => !prev); 
    }, [pdvCaixa.vendasTurnoAtual]);

    const selecionarVendaHistorico = (v) => { 
        setDadosRecibo(v); 
        pdvNfce.setNfceStatus(v.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle'); 
        pdvNfce.setNfceUrl(v.fiscal?.pdf || null); 
        setMostrarHistorico(false); setMostrarRecibo(true); 
    };

    const handleEnviarWhatsApp = async (venda) => {
        showPrompt('Número WhatsApp:', async (tel) => {
            tel = tel.replace(/\D/g, '');
            if (!tel || tel.length < 10) {
                return toast.error('Por favor, informe um número de WhatsApp válido.');
            }
            
            const msgTexto = construirMensagemRecibo(venda, nomeLoja);
            
            const uazapiAtivo = wppConfig?.ativo && 
                                wppConfig?.serverUrl && 
                                (estabelecimentoAtivo === 'Ee89E1HlsA6QR9C8uuBC' || !wppConfig.serverUrl.includes('meunumero.uazapi.com')) && 
                                wppConfig?.apiKey;
                                
            if (uazapiAtivo) {
                const toastId = toast.info('Enviando recibo via WhatsApp...');
                try {
                    const { enviarMensagemUazapi } = await import('../../services/whatsappService');
                    const res = await enviarMensagemUazapi(wppConfig, tel, msgTexto);
                    toast.dismiss(toastId);
                    if (res.success) {
                        toast.success('Recibo enviado com sucesso pelo WhatsApp!');
                        return;
                    } else {
                        toast.error(`Falha no envio automático: ${res.error || 'Erro desconhecido'}. Abrindo WhatsApp Web...`);
                    }
                } catch (e) {
                    console.error(e);
                    toast.dismiss(toastId);
                    toast.error('Erro ao enviar mensagem automática. Abrindo WhatsApp Web...');
                }
            }
            
            // Fallback para wa.me
            const msgEncoded = encodeURIComponent(msgTexto);
            const wppUrl = tel.length >= 10 
                ? `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${msgEncoded}` 
                : `https://api.whatsapp.com/send?text=${msgEncoded}`;
            window.open(wppUrl, '_blank');
        }, { 
            title: '📱 Enviar WhatsApp', 
            defaultValue: venda.clienteTelefone || venda.cliente?.telefone || '', 
            placeholder: '(XX) XXXXX-XXXX', 
            submitText: 'Enviar' 
        });
    };

    useEffect(() => { const handler = (e) => { pdvCaixa.setTurnoSelecionadoResumo(e.detail); setMostrarListaTurnos(false); pdvCaixa.setMostrarResumoTurno(true); }; document.addEventListener('abrirRelatorioTurno', handler); return () => document.removeEventListener('abrirRelatorioTurno', handler); }, [pdvCaixa]);

    // Listener Global de Atalhos
    useEffect(() => {
        const preventHelp = (e) => e.preventDefault();
        window.addEventListener('help', preventHelp);

        const h = (e) => {
            if (!pdvCaixa.caixaAberto && !mostrarAberturaCaixa) return;

            const algumModalAberto = mostrarFinalizacao || mostrarRecibo || mostrarHistorico || 
                                     pdvCart.mostrarSuspensas || pdvCaixa.mostrarMovimentacao || 
                                     mostrarListaTurnos || mostrarAberturaCaixa || 
                                     mostrarModalCliente || mostrarModalBusca || mostrarModalBuscaEdicao ||
                                     mostrarNovoProdutoModal ||
                                     pdvCart.produtoParaSelecao !== null || 
                                     pdvCart.itemParaEditar !== null || 
                                     pdvCart.produtoParaPeso !== null;

            if (e.key === 'Escape') {
                pdvCart.setItemParaEditar(null);
                pdvCart.setProdutoParaSelecao(null);
                pdvCart.setProdutoParaPeso(null);
                setMostrarFinalizacao(false);
                setMostrarRecibo(false);
                setMostrarHistorico(false);
                pdvCaixa.setMostrarFechamentoCaixa(false);
                setMostrarListaTurnos(false);
                pdvCaixa.setMostrarMovimentacao(false);
                pdvCaixa.setMostrarResumoTurno(false);
                pdvCart.setMostrarSuspensas(false);
                setMostrarCarrinhoMobile(false);
                setMostrarModalCliente(false);
                setMostrarModalBusca(false);
                setMostrarModalBuscaEdicao(false);
                setMostrarNovoProdutoModal(false);
                setProdutoParaEditarPdv(null);
                return;
            }

            if (algumModalAberto) return;

            if (e.key === 'F1') { 
                e.preventDefault(); 
                setMostrarModalBusca(true); 
            }
            if (e.key === 'F3') { e.preventDefault(); abrirHistoricoAtual(); }
            if (e.key === 'F4') { e.preventDefault(); pdvCart.suspenderVenda(); }
            if (e.key === 'F5') { e.preventDefault(); pdvCart.setMostrarSuspensas(true); }
            if (e.key === 'F6') { e.preventDefault(); setMostrarModalCliente(true); }
            if (e.key === 'F7') { e.preventDefault(); pdvCaixa.abrirMovimentacao(); }
            if (e.key === 'F8') { e.preventDefault(); setMostrarModalBuscaEdicao(true); }
            if (e.key === 'F9') { e.preventDefault(); pdvCaixa.prepararFechamento(); }
            if (e.key === 'F10' && pdvCart.vendaAtual?.itens.length > 0) { e.preventDefault(); setMostrarFinalizacao(true); setMostrarCarrinhoMobile(false); }
            if (e.key === 'F11') { e.preventDefault(); pdvCaixa.carregarListaTurnos(); }
        };
        window.addEventListener('keydown', h);
        return () => {
            window.removeEventListener('help', preventHelp);
            window.removeEventListener('keydown', h);
        };
    }, [pdvCaixa, pdvCart, abrirHistoricoAtual, mostrarAberturaCaixa, mostrarFinalizacao, mostrarRecibo, mostrarHistorico, mostrarListaTurnos, mostrarModalCliente, mostrarModalBusca, mostrarModalBuscaEdicao]);

    return (
        <div id="pdv-root" className="flex flex-col bg-slate-100 font-sans text-slate-800">
            {pdvCart.barcodeAviso && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] font-bold text-xs flex items-center gap-2">
                    <IoStorefrontOutline size={16} /> {pdvCart.barcodeAviso}
                </div>
            )}

            {pdvCaixa.verificandoCaixa && !pdvCaixa.caixaAberto && !mostrarAberturaCaixa ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-emerald-600"></div>
                    <span className="font-bold text-slate-500 text-sm">Carregando PDV...</span>
                </div>
            ) : (
                <>
                    <div className="flex-1 flex min-h-0 overflow-hidden bg-white relative">
                        <div className="flex-1 flex flex-col min-w-0 min-h-0">
                            <div className="h-14 px-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0 gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <BackButton />
                                    <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                                        <div className={`w-2 h-2 rounded-full ${pdvCaixa.caixaAberto ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'} shrink-0`}></div>
                                        <h1 className="text-sm font-black text-slate-800 uppercase truncate max-w-[100px] sm:max-w-[150px]">{nomeLoja}</h1>
                                    </div>
                                    {pdvCaixa.caixaAberto && (
                                        <div className="hidden lg:flex items-center gap-2 shrink-0">
                                            <div className="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                <span className="text-[9px] text-emerald-600 font-medium">Vendas:</span>
                                                <span className="text-[10px] font-black text-emerald-700">{pdvCaixa.vendasTurnoAtual.length}</span>
                                            </div>
                                            <div className="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                <span className="text-[9px] text-blue-600 font-medium">Total:</span>
                                                <span className="text-[10px] font-black text-blue-700">{formatarMoeda(pdvCaixa.vendasTurnoAtual.reduce((a, v) => a + (v.total || 0), 0))}</span>
                                            </div>
                                            {getDuracaoTurno() && (
                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${
                                                    isTurnoExcedido24h() 
                                                        ? 'bg-red-50 border-red-200 text-red-700 animate-pulse' 
                                                        : 'bg-amber-50 border-amber-100 text-amber-700'
                                                }`}>
                                                    <span>⏱️ {getDuracaoTurno()}{isTurnoExcedido24h() ? ' - FECHAR TURNO!' : ''}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2.5 shrink-0 ml-auto min-w-0">
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button 
                                            onClick={abrirHistoricoAtual} 
                                            className="bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1.5 rounded text-[11px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                                        >
                                            <IoReceiptOutline size={13} /> Histórico
                                        </button>
                                        {pdvCaixa.caixaAberto && (
                                            <button 
                                                onClick={() => pdvCaixa.setMostrarMovimentacao(true)} 
                                                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1.5 rounded text-[11px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                                            >
                                                💰 Movimentar
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <select 
                                            value={categoriaAtiva} 
                                            onChange={e => setCategoriaAtiva(e.target.value)} 
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none cursor-pointer transition-all shadow-sm w-[130px] sm:w-[160px] appearance-none"
                                            style={{
                                                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'right 0.6rem center',
                                                backgroundSize: '1em',
                                                paddingRight: '1.8rem'
                                            }}
                                        >
                                            {categorias.map(c => (
                                                <option key={c.id} value={c.name === 'Todos' ? 'todos' : c.name}>
                                                    📁 Grupo: {c.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="flex items-center w-[110px] sm:w-[140px] shrink-0">
                                            <button 
                                                ref={inputBuscaRef}
                                                onClick={() => setMostrarModalBusca(true)}
                                                className="w-full pl-8 pr-2 py-1.5 bg-slate-100 border border-transparent rounded text-xs font-semibold text-slate-400 text-left relative hover:bg-slate-200 transition-all flex items-center cursor-pointer shrink-0"
                                            >
                                                <IoSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                Buscar (F1)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div onScroll={handlePdvProductsScroll} className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-100/50 pdv-scroll">
                                {(carregandoProdutos) ? (
                                    <div className="text-center p-10 text-gray-400"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-emerald-600 mx-auto"></div></div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                        {produtosExibidos.map(p => (
                                            <div 
                                                key={p.id} 
                                                onClick={() => pdvCart.handleProdutoClick(p)} 
                                                className="bg-white rounded-xl p-2 shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all flex flex-row items-center gap-3 w-full text-left cursor-pointer group relative"
                                            >
                                                <div className="w-16 h-16 shrink-0 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 relative overflow-hidden">
                                                    {p.imagem || p.foto || p.urlImagem || p.imageUrl ? (
                                                        <img src={p.imagem || p.foto || p.urlImagem || p.imageUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                    ) : (
                                                        isVarejo ? (
                                                            <span className="text-2xl text-slate-300">📦</span>
                                                        ) : (
                                                            <IoStorefrontOutline className="text-2xl text-slate-300" />
                                                        )
                                                    )}
                                                </div>
                                                <div className="flex flex-col justify-center flex-1 min-w-0 pr-6">
                                                    <div className="font-bold text-slate-800 text-[11px] sm:text-xs leading-normal break-words whitespace-normal">
                                                        {p.name}
                                                    </div>
                                                    <div className="font-black text-emerald-600 text-[13px] sm:text-sm whitespace-nowrap mt-1">
                                                        {formatarMoeda(p.price)}
                                                    </div>
                                                </div>
                                                {(isMasterAdmin || userData?.isMasterAdmin) && (
                                                     <div className="absolute top-1.5 right-1.5 flex gap-1 z-10">
                                                         <button
                                                             onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 setProdutoParaEditarPdv(p);
                                                                 setMostrarNovoProdutoModal(true);
                                                             }}
                                                             className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200/60 shadow-sm transition-all duration-200 hover:scale-105 active:scale-95"
                                                             title="Editar produto"
                                                         >
                                                             <IoCreateOutline size={14} />
                                                         </button>
                                                         <button
                                                             onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 handleExcluirProduto(p);
                                                             }}
                                                             className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200/60 shadow-sm transition-all duration-200 hover:scale-105 active:scale-95"
                                                             title="Excluir produto do catálogo"
                                                         >
                                                             <IoTrashOutline size={14} />
                                                         </button>
                                                     </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={`absolute md:relative top-0 right-0 bottom-0 flex flex-col shrink-0 min-h-0 w-[85vw] sm:w-[320px] md:w-[350px] bg-white border-l border-slate-200 z-[110] transition-transform duration-300 ${mostrarCarrinhoMobile ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0'}`}>
                            <div className="h-14 px-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                                <h2 className="font-black text-[13px] text-slate-800 flex items-center gap-2"><IoCart /> Pedido #{pdvCart.vendaAtual?.id?.slice(-6).toUpperCase() || 'NOVO'}</h2>
                                <div className="flex gap-1">
                                    <button onClick={() => setMostrarCarrinhoMobile(false)} className="md:hidden p-1 text-slate-500 font-bold bg-white border rounded">✕</button>
                                    <button onClick={pdvCart.suspenderVenda} disabled={!pdvCart.vendaAtual?.itens?.length} className="bg-white text-blue-600 border px-1.5 py-1 rounded text-[10px] font-bold">PAUSAR</button>
                                    <button onClick={() => pdvCart.iniciarVendaBalcao()} className="bg-white text-red-500 border px-1.5 py-1 rounded text-[10px] font-bold">LIMPAR</button>
                                </div>
                            </div>

                            {/* Cliente Selector Widget */}
                            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0 gap-2 select-none no-print">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Cliente:</span>
                                    {pdvCart.clienteSelecionado ? (
                                        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100 text-xs font-bold truncate">
                                            <span className="truncate max-w-[120px]">{pdvCart.clienteSelecionado.nome}</span>
                                            <button onClick={() => pdvCart.setClienteSelecionado(null)} className="hover:text-red-500 font-bold ml-1 text-[10px]">✕</button>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-slate-500">Balcão</span>
                                    )}
                                </div>
                                <button 
                                    onClick={() => setMostrarModalCliente(true)} 
                                    className="bg-white hover:bg-slate-100 border text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                                >
                                    {pdvCart.clienteSelecionado ? 'ALTERAR' : '+ CLIENTE'}
                                </button>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 bg-white pdv-scroll">
                                {pdvCart.vendaAtual?.itens?.length > 0 ? (
                                    pdvCart.vendaAtual.itens.map(i => (
                                        <div 
                                            key={i.uid} 
                                            onClick={() => pdvCart.setItemParaEditar(i)} 
                                            className="bg-white p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 cursor-pointer flex flex-row items-center gap-2 w-full transition-colors group"
                                        >
                                            <div className="shrink-0"><span className="inline-block text-center bg-slate-100 border border-slate-200 text-slate-800 font-black text-[11px] leading-normal min-w-[28px] px-1.5 py-1 rounded-md">{i.quantity}x</span></div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="font-bold text-slate-800 text-[11px] sm:text-xs leading-normal break-words whitespace-normal m-0">{i.name}</span>
                                                {i.observacao && <span className="text-[10px] text-slate-500 font-medium break-words whitespace-normal mt-0.5 m-0">* {i.observacao}</span>}
                                            </div>
                                            <div className="shrink-0 pl-1 text-right flex items-center gap-1.5">
                                                <span className="inline-block font-black text-slate-900 text-[13px] whitespace-nowrap">{formatarMoeda(i.price * i.quantity)}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        pdvCart.removerItem(i.uid);
                                                    }}
                                                    className="p-1 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 transition-all opacity-70 group-hover:opacity-100"
                                                    title="Excluir item"
                                                >
                                                    <IoTrashOutline size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60"><IoCart size={40} /><p className="text-[10px] font-bold uppercase mt-2">Caixa Livre</p></div>
                                )}
                            </div>

                            {pdvCart.vendaAtual?.itens?.length > 0 && (
                                <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                                    <div className="flex justify-between items-end mb-3 px-1 gap-2">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">Total:</span>
                                        <span className="font-black text-emerald-600 text-xl sm:text-2xl whitespace-nowrap shrink-0">{formatarMoeda(pdvCart.vendaAtual.total)}</span>
                                    </div>
                                    <button onClick={() => { setMostrarFinalizacao(true); setMostrarCarrinhoMobile(false); }} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-[14px] hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2">
                                        <IoCheckmarkCircleOutline size={20} /> COBRAR (F10)
                                    </button>
                                </div>
                            )}
                        </div>

                        {mostrarCarrinhoMobile && <div className="absolute inset-0 bg-black/50 z-[105] md:hidden" onClick={() => setMostrarCarrinhoMobile(false)}></div>}
                    </div>

                    <div className="w-full shrink-0 bg-slate-800 border-t border-slate-700 p-2 sm:p-3 flex justify-center shadow-[0_-10px_20px_rgba(0,0,0,0.15)] z-[120] relative no-print">
                        {/* Layout Desktop (exibido em md e superior) */}
                        <div className="hidden md:flex flex-wrap justify-center items-center gap-2 w-full max-w-7xl">
                            <button onClick={() => inputBuscaRef.current?.focus()} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F1</kbd> BUSCAR PROD.</button>
                            <button onClick={abrirHistoricoAtual} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F3</kbd> HISTÓRICO</button>
                            <button onClick={pdvCart.suspenderVenda} className={`text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm ${!pdvCart.vendaAtual?.itens?.length ? 'opacity-50 cursor-not-allowed' : ''}`}><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-orange-400 font-mono leading-normal">F4</kbd> PAUSAR</button>
                            <button onClick={() => pdvCart.setMostrarSuspensas(true)} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm relative">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-blue-400 font-mono leading-normal">F5</kbd> VER PAUSADAS
                                {pdvCart.vendasSuspensas.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] min-w-[18px] px-1 py-0.5 flex items-center justify-center rounded-full leading-none shadow-md">{pdvCart.vendasSuspensas.length}</span>}
                            </button>
                            <button onClick={() => setMostrarModalCliente(true)} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-purple-400 font-mono leading-normal">F6</kbd> CLIENTE
                            </button>
                            <div className="w-px h-6 bg-slate-600 mx-1 hidden sm:block"></div>
                            <button onClick={pdvCaixa.abrirMovimentacao} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-amber-400 font-mono leading-normal">F7</kbd> SANGRIA / SUPRIMENTO</button>
                            <button onClick={() => setMostrarModalBuscaEdicao(true)} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-yellow-400 font-mono leading-normal">F8</kbd> ALTERAR PROD.</button>
                            <button onClick={pdvCaixa.prepararFechamento} className="bg-rose-900/60 hover:bg-rose-800 text-white border border-rose-700/50 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-rose-700 px-1.5 py-0.5 rounded border border-rose-900 text-white font-mono leading-normal">F9</kbd> FECHAR TURNO</button>
                            <button onClick={pdvCaixa.carregarListaTurnos} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F11</kbd> OUTROS TURNOS</button>
                        </div>

                        {/* Layout Mobile (exibido abaixo de md, em uma única linha responsiva) */}
                        <div className="flex md:hidden justify-around items-center w-full px-1 gap-1.5 relative">
                            <button 
                                onClick={() => inputBuscaRef.current?.focus()} 
                                className="flex-1 text-white hover:bg-slate-700 border border-slate-700 bg-slate-800/80 px-2 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold transition-all shadow-sm min-w-0"
                            >
                                <IoSearch size={16} className="text-emerald-400" />
                                <span className="truncate">Buscar</span>
                            </button>
                            
                            <button 
                                onClick={() => setMostrarModalCliente(true)} 
                                className="flex-1 text-white hover:bg-slate-700 border border-slate-700 bg-slate-800/80 px-2 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold transition-all shadow-sm min-w-0"
                            >
                                <IoPeopleOutline size={16} className="text-purple-400" />
                                <span className="truncate">Cliente</span>
                            </button>

                            <button 
                                onClick={() => pdvCart.setMostrarSuspensas(true)} 
                                className="flex-1 text-white hover:bg-slate-700 border border-slate-700 bg-slate-800/80 px-2 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold transition-all shadow-sm relative min-w-0"
                            >
                                <IoCart size={16} className="text-blue-400" />
                                <span className="truncate">Pausadas</span>
                                {pdvCart.vendasSuspensas.length > 0 && (
                                    <span className="absolute -top-1 right-2 bg-red-500 text-white text-[8px] min-w-[15px] h-[15px] flex items-center justify-center rounded-full leading-none shadow-md font-bold">
                                        {pdvCart.vendasSuspensas.length}
                                    </span>
                                )}
                            </button>

                            <button 
                                onClick={() => setMostrarMenuMais(!mostrarMenuMais)} 
                                className={`flex-1 text-white border px-2 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold transition-all shadow-sm min-w-0 ${mostrarMenuMais ? 'bg-slate-700 border-slate-500' : 'bg-slate-800/80 border-slate-700'}`}
                            >
                                <IoEllipsisHorizontal size={16} className="text-amber-400" />
                                <span className="truncate">Mais</span>
                            </button>

                            {/* Dropup Drawer Menu (Mais Opções) */}
                            {mostrarMenuMais && (
                                <>
                                    {/* Overlay invisível para fechar ao clicar fora */}
                                    <div 
                                        className="fixed inset-0 z-[115] bg-black/35 backdrop-blur-[1px] md:hidden" 
                                        onClick={() => setMostrarMenuMais(false)}
                                    />
                                    
                                    {/* Menu flutuante tipo dropup */}
                                    <div className="absolute bottom-full right-2 mb-3 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl z-[116] flex flex-col gap-2 w-60 animate-slideUp">
                                        <div className="px-2 pb-1.5 border-b border-slate-800 flex justify-between items-center">
                                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Opções do Caixa</span>
                                            <span className="text-[10px] font-bold text-slate-400">Atalhos</span>
                                        </div>

                                        <button 
                                            onClick={() => { setMostrarMenuMais(false); abrirHistoricoAtual(); }} 
                                            className="w-full text-left text-white hover:bg-slate-850 border border-slate-800 hover:border-slate-700 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <IoTimeOutline size={16} className="text-emerald-400" />
                                                <span>Histórico de Vendas</span>
                                            </div>
                                            <span className="text-[9px] bg-slate-950 px-1 py-0.5 rounded text-slate-500 font-mono">F3</span>
                                        </button>

                                        <button 
                                            onClick={() => { setMostrarMenuMais(false); pdvCart.suspenderVenda(); }} 
                                            disabled={!pdvCart.vendaAtual?.itens?.length}
                                            className={`w-full text-left text-white hover:bg-slate-850 border border-slate-800 hover:border-slate-700 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all ${!pdvCart.vendaAtual?.itens?.length ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <IoPauseOutline size={16} className="text-orange-400" />
                                                <span>Pausar Venda Atual</span>
                                            </div>
                                            <span className="text-[9px] bg-slate-950 px-1 py-0.5 rounded text-slate-500 font-mono">F4</span>
                                        </button>

                                        <button 
                                            onClick={() => { setMostrarMenuMais(false); pdvCaixa.abrirMovimentacao(); }} 
                                            className="w-full text-left text-white hover:bg-slate-850 border border-slate-800 hover:border-slate-700 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <IoCashOutline size={16} className="text-amber-400" />
                                                <span>Sangria / Suprimento</span>
                                            </div>
                                            <span className="text-[9px] bg-slate-950 px-1 py-0.5 rounded text-slate-500 font-mono">F7</span>
                                        </button>

                                        <button 
                                            onClick={() => { setMostrarMenuMais(false); setMostrarModalBuscaEdicao(true); }} 
                                            className="w-full text-left text-white hover:bg-slate-850 border border-slate-800 hover:border-slate-700 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <IoCreateOutline size={16} className="text-yellow-400" />
                                                <span>Alterar Produto</span>
                                            </div>
                                            <span className="text-[9px] bg-slate-950 px-1 py-0.5 rounded text-slate-500 font-mono">F8</span>
                                        </button>

                                        <button 
                                            onClick={() => { setMostrarMenuMais(false); pdvCaixa.carregarListaTurnos(); }} 
                                            className="w-full text-left text-white hover:bg-slate-850 border border-slate-800 hover:border-slate-700 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <IoSwapHorizontalOutline size={16} className="text-teal-400" />
                                                <span>Visualizar Outros Turnos</span>
                                            </div>
                                            <span className="text-[9px] bg-slate-950 px-1 py-0.5 rounded text-slate-500 font-mono">F11</span>
                                        </button>

                                        <div className="h-px bg-slate-850 my-1"></div>

                                        <button 
                                            onClick={() => { setMostrarMenuMais(false); pdvCaixa.prepararFechamento(); }} 
                                            className="w-full text-left bg-rose-950/60 hover:bg-rose-900 text-white border border-rose-900/30 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <IoCloseCircleOutline size={16} className="text-rose-400" />
                                                <span>Fechar Turno</span>
                                            </div>
                                            <span className="text-[9px] bg-rose-900/60 px-1 py-0.5 rounded text-rose-300 font-mono">F9</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={() => setMostrarCarrinhoMobile(true)} 
                        style={{ bottom: 'calc(1rem + var(--altura-da-barra, 60px))' }} 
                        className={`md:hidden fixed right-4 bg-emerald-600 text-white p-4 rounded-full shadow-2xl z-[90] flex items-center gap-2 transition-transform ${pdvCart.vendaAtual?.itens?.length > 0 ? 'scale-100' : 'scale-0'}`}
                    >
                        <IoCart size={24} />
                        <span className="absolute -top-1 -right-1 bg-white text-emerald-600 font-black text-[10px] min-w-[20px] h-5 flex items-center justify-center rounded-full shadow-sm">{pdvCart.vendaAtual?.itens?.length || 0}</span>
                    </button>

                    {/* Modais Componentes */}
                    <ModalSelecaoVariacao produto={pdvCart.produtoParaSelecao} onClose={() => pdvCart.setProdutoParaSelecao(null)} onConfirm={pdvCart.adicionarItem} />
                    <ModalEdicaoItemCarrinho visivel={pdvCart.itemParaEditar !== null} item={pdvCart.itemParaEditar} onClose={() => pdvCart.setItemParaEditar(null)} onConfirm={(u, q, o, n, p) => { pdvCart.salvarEdicaoItem(u, q, o, n, p); if (q === 0) pdvCart.removerItem(u); }} />
                    <ModalAberturaCaixa visivel={mostrarAberturaCaixa} onAbrir={pdvCaixa.handleAbrirCaixa} usuarioNome={userData?.name} onVerTurnos={pdvCaixa.carregarListaTurnos} />
                    <ModalFechamentoCaixa visivel={pdvCaixa.mostrarFechamentoCaixa} caixa={pdvCaixa.caixaAberto} vendasDoDia={pdvCaixa.vendasTurnoAtual} movimentacoes={pdvCaixa.movimentacoesDoTurno} onClose={() => pdvCaixa.setMostrarFechamentoCaixa(false)} onConfirmarFechamento={(d) => pdvCaixa.handleConfirmarFechamento(d, pdvCart.setVendasSuspensas)} />
                    <ModalMovimentacao 
                        visivel={pdvCaixa.mostrarMovimentacao} 
                        onClose={() => pdvCaixa.setMostrarMovimentacao(false)} 
                        onConfirmar={pdvCaixa.handleSalvarMovimentacao} 
                        movimentacoes={pdvCaixa.movimentacoesDoTurno?.itens || []}
                        onExcluir={pdvCaixa.handleExcluirMovimentacao}
                        onEditar={pdvCaixa.handleEditarMovimentacao}
                    />
                    <ModalFinalizacao 
                        visivel={mostrarFinalizacao} 
                        venda={pdvCart.vendaAtual} 
                        onClose={() => setMostrarFinalizacao(false)} 
                        onFinalizar={finalizarVenda} 
                        salvando={salvando} 
                        pagamentos={pdvCart.pagamentosAdicionados} 
                        setPagamentos={pdvCart.setPagamentosAdicionados} 
                        cpfNota={cpfNota} 
                        setCpfNota={setCpfNota} 
                        desconto={pdvCart.descontoValor} 
                        setDesconto={pdvCart.setDescontoValor} 
                        acrescimo={pdvCart.acrescimoValor} 
                        setAcrescimo={pdvCart.setAcrescimoValor} 
                        clienteSelecionado={pdvCart.clienteSelecionado}
                        setClienteSelecionado={pdvCart.setClienteSelecionado}
                        onAbrirModalCliente={() => setMostrarModalCliente(true)}
                        estabelecimentoId={estabelecimentoAtivo}
                    />
                    
                    <ModalRecibo visivel={mostrarRecibo} dados={dadosRecibo} isVarejo={isVarejo} onClose={() => { setMostrarRecibo(false); pdvCart.iniciarVendaBalcao(); }} onNovaVenda={() => pdvCart.iniciarVendaBalcao()} onEmitirNfce={pdvNfce.handleEmitirNfce} nfceStatus={pdvNfce.nfceStatus} nfceUrl={pdvNfce.nfceUrl} onBaixarXml={pdvNfce.handleBaixarXml} onConsultarStatus={pdvNfce.handleConsultarStatus} onBaixarPdf={pdvNfce.handleBaixarPdf} onBaixarXmlCancelamento={async (venda) => { try { const res = await vendaService.baixarXmlCancelamentoNfce(venda.fiscal?.idPlugNotas, venda.id.slice(-6)); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } }} onEnviarWhatsApp={handleEnviarWhatsApp} />
                    <ModalHistorico visivel={mostrarHistorico} onClose={() => setMostrarHistorico(false)} vendas={vendasHistoricoExibicao} titulo={tituloHistorico} onSelecionarVenda={selecionarVendaHistorico} carregando={pdvCaixa.carregandoHistorico} onProcessarLote={pdvNfce.handleProcessarLoteNfce} onCancelarNfce={pdvNfce.handleCancelarNfce} onBaixarXml={pdvNfce.handleBaixarXml} onConsultarStatus={pdvNfce.handleConsultarStatus} onBaixarPdf={pdvNfce.handleBaixarPdf} onBaixarXmlCancelamento={async (venda) => { try { const res = await vendaService.baixarXmlCancelamentoNfce(venda.fiscal?.idPlugNotas, venda.id.slice(-6)); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } }} onEnviarWhatsApp={handleEnviarWhatsApp} />

                    <ModalListaTurnos visivel={mostrarListaTurnos} onClose={() => { setMostrarListaTurnos(false); if (!pdvCaixa.caixaAberto) setMostrarAberturaCaixa(true); }} turnos={pdvCaixa.listaTurnos} carregando={pdvCaixa.carregandoHistorico} onSelecionarTurno={pdvCaixa.visualizarResumoTurno} vendasDoDia={pdvCaixa.vendasTurnoAtual} />   
                    <ModalResumoTurno visivel={pdvCaixa.mostrarResumoTurno} turno={pdvCaixa.turnoSelecionadoResumo} onClose={() => { pdvCaixa.setMostrarResumoTurno(false); if (!pdvCaixa.caixaAberto) setMostrarAberturaCaixa(true); }} onVerVendas={() => pdvCaixa.visualizarVendasTurno(pdvCaixa.turnoSelecionadoResumo)} vendasDoDia={pdvCaixa.vendasTurnoAtual} onReabrir={() => pdvCaixa.handleReabrirTurno(pdvCaixa.turnoSelecionadoResumo, showConfirm)} />
                    <ModalVendasSuspensas visivel={pdvCart.mostrarSuspensas} onClose={() => pdvCart.setMostrarSuspensas(false)} vendas={pdvCart.vendasSuspensas} onRestaurar={pdvCart.restaurarVendaSuspensa} onExcluir={pdvCart.excluirVendaSuspensa} />              
                    <ModalPesoBalanca visivel={pdvCart.produtoParaPeso !== null} produto={pdvCart.produtoParaPeso} onClose={() => pdvCart.setProdutoParaPeso(null)} onConfirm={pdvCart.adicionarItemPeso} />
                    <ModalOpcoesProduto produto={pdvCart.produtoParaOpcoes} onClose={() => pdvCart.setProdutoParaOpcoes(null)} onSelectOption={pdvCart.handleSelectFracaoOption} />
                    <ModalClientePdv visivel={mostrarModalCliente} estabelecimentoId={estabelecimentoAtivo} onClose={() => setMostrarModalCliente(false)} onSelectCliente={pdvCart.setClienteSelecionado} />
                    
                    <ModalBuscaProduto 
                        visivel={mostrarModalBusca} 
                        busca={busca} 
                        setBusca={setBusca} 
                        produtosFiltrados={produtosExibidos} 
                        onClose={() => setMostrarModalBusca(false)} 
                        onSelectProduto={pdvCart.handleProdutoClick} 
                        onEditarProduto={(prod) => {
                            setProdutoParaEditarPdv(prod);
                            setMostrarNovoProdutoModal(true);
                        }}
                        isVarejo={isVarejo}
                        categorias={categorias}
                        estabelecimentoId={estabelecimentoAtivo}
                        onProdutoAdicionado={recarregar}
                        isMasterAdmin={isMasterAdmin || userData?.isMasterAdmin}
                        onAbrirCadastro={() => {
                            setMostrarModalBusca(false);
                            setMostrarNovoProdutoModal(true);
                        }}
                        showConfirm={showConfirm}
                        temMaisProdutos={temMaisProdutos}
                        onCarregarMais={carregarMaisProdutos}
                    />

                    <ModalBuscaProduto 
                        visivel={mostrarModalBuscaEdicao} 
                        busca={busca} 
                        setBusca={setBusca} 
                        produtosFiltrados={produtosExibidos} 
                        onClose={() => setMostrarModalBuscaEdicao(false)} 
                        modoEdicao={true}
                        onEditarProduto={(prod) => {
                            setProdutoParaEditarPdv(prod);
                            setMostrarNovoProdutoModal(true);
                        }}
                        isVarejo={isVarejo}
                        categorias={categorias}
                        estabelecimentoId={estabelecimentoAtivo}
                        onProdutoAdicionado={recarregar}
                        isMasterAdmin={isMasterAdmin || userData?.isMasterAdmin}
                        showConfirm={showConfirm}
                        temMaisProdutos={temMaisProdutos}
                        onCarregarMais={carregarMaisProdutos}
                    />

                    <ModalNovoProdutoPdv
                        visivel={mostrarNovoProdutoModal}
                        onClose={() => {
                            setMostrarNovoProdutoModal(false);
                            setProdutoParaEditarPdv(null);
                        }}
                        estabelecimentoId={estabelecimentoAtivo}
                        produtoParaEditar={produtoParaEditarPdv}
                        onSalvo={(novoProd) => {
                            recarregar();
                            if (!produtoParaEditarPdv) {
                                pdvCart.handleProdutoClick(novoProd);
                            }
                            setProdutoParaEditarPdv(null);
                        }}
                        isVarejo={isVarejo}
                        categorias={categorias}
                    />

                    <ToastContainer />
                    {confirmDialog && <ConfirmDialog open={true} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} cancelText={confirmDialog.cancelText} onConfirm={() => { setConfirmDialog(null); confirmDialog.onConfirmCb?.(); }} onCancel={() => setConfirmDialog(null)} />}
                    {promptDialog && <PromptDialog open={true} title={promptDialog.title} message={promptDialog.message} defaultValue={promptDialog.defaultValue} placeholder={promptDialog.placeholder} confirmText={promptDialog.confirmText} cancelText={promptDialog.cancelText} onConfirm={(val) => { setPromptDialog(null); promptDialog.onSubmitCb?.(val); }} onCancel={() => setPromptDialog(null)} />}
                </>
            )}
        </div>
    );
};

export default PdvScreen;