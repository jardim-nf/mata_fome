import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase'; 
import { 
    IoClose,
    IoChevronBack,
    IoChevronForward,
    IoCash,
    IoCard,
    IoPhonePortrait,
    IoAdd,
    IoRemove,
    IoCheckmark,
    IoPerson,
    IoPeople,
    IoWallet,
    IoPrint,
    IoCheckbox,
    IoSquareOutline,
    IoTime
} from 'react-icons/io5';
import { toast } from 'react-toastify';

const ModalPagamento = ({ mesa, estabelecimentoId, onClose, onSucesso }) => {
    const [etapa, setEtapa] = useState(1);
    const [tipoPagamento, setTipoPagamento] = useState(null);
    const [pagamentos, setPagamentos] = useState({});
    const [selecionados, setSelecionados] = useState({});
    const [carregando, setCarregando] = useState(false);

    // --- CÁLCULOS FINANCEIROS ---

    // 1. Total Consumido (Soma de todos os produtos na mesa)
    const calcularTotalConsumo = () => {
        const listaItens = mesa?.itens || mesa?.pedidos || [];
        return listaItens.reduce((acc, item) => {
            const qtd = item.quantidade || item.qtd || 1;
            return acc + (item.preco * qtd);
        }, 0);
    };

    // 2. Total Já Pago (Soma do histórico de pagamentos parciais)
    const calcularJaPago = () => {
        const historico = mesa?.pagamentosParciais || [];
        return historico.reduce((acc, pgto) => acc + (Number(pgto.valor) || 0), 0);
    };

    // 3. Restante a Pagar (Consumo - Pago)
    const calcularRestanteMesa = () => {
        const consumo = calcularTotalConsumo();
        const jaPago = calcularJaPago();
        return Math.max(0, consumo - jaPago);
    };

    // --- AGRUPAMENTO DE ITENS (Para visualização) ---
    const agruparItensPorPessoa = useMemo(() => {
        const listaItens = mesa?.itens || mesa?.pedidos || [];
        if (listaItens.length === 0) return {};
        
        const agrupados = {};
        listaItens.forEach(item => {
            let pessoa = item.cliente || item.destinatario || item.nomeOcupante || 'Mesa';
            if ((!pessoa || pessoa === 'Mesa') && mesa.nomesOcupantes?.length > 0) {
                if(!item.cliente && !item.destinatario) pessoa = mesa.nomesOcupantes[0]; 
            }
            if (!pessoa) pessoa = 'Cliente 1';

            if (!agrupados[pessoa]) {
                agrupados[pessoa] = { itens: [], total: 0 };
            }
            
            const qtd = item.quantidade || item.qtd || 1;
            agrupados[pessoa].itens.push(item);
            agrupados[pessoa].total += (item.preco * qtd);
        });
        return agrupados;
    }, [mesa]);

    // --- INICIALIZAÇÃO ---
    useEffect(() => {
        const restanteMesa = calcularRestanteMesa();
        const listaItens = mesa?.itens || mesa?.pedidos || [];

        if (tipoPagamento === 'unico') {
            const key = 'Pagamento Único';
            setPagamentos({
                [key]: {
                    valor: restanteMesa,
                    formaPagamento: 'dinheiro',
                    itens: listaItens
                }
            });
            setSelecionados({ [key]: true });
        } else if (tipoPagamento === 'individual') {
            const pagamentosIniciais = {};
            const selecionadosIniciais = {};
            const grupos = agruparItensPorPessoa;

            if (Object.keys(grupos).length === 0) {
                const key = 'Mesa / Restante';
                pagamentosIniciais[key] = {
                    valor: restanteMesa,
                    formaPagamento: 'dinheiro',
                    itens: listaItens
                };
                selecionadosIniciais[key] = false;
            } else {
                Object.entries(grupos).forEach(([pessoa, dados]) => {
                    // TRAVA DE SEGURANÇA: Ninguém paga mais do que a dívida total da mesa
                    const valorSugerido = Math.min(dados.total, restanteMesa);

                    pagamentosIniciais[pessoa] = {
                        valor: valorSugerido, 
                        formaPagamento: 'dinheiro',
                        itens: dados.itens 
                    };
                    selecionadosIniciais[pessoa] = false;
                });
            }
            setPagamentos(pagamentosIniciais);
            setSelecionados(selecionadosIniciais);
        }
    }, [tipoPagamento, agruparItensPorPessoa, mesa]);

    // --- AÇÕES UI ---
    const toggleSelecao = (pessoa) => {
        setSelecionados(prev => ({ ...prev, [pessoa]: !prev[pessoa] }));
    };

    const editarFormaPagamento = (pessoaId, novaForma) => {
        setPagamentos(prev => ({
            ...prev,
            [pessoaId]: { ...prev[pessoaId], formaPagamento: novaForma }
        }));
    };

    const editarValorPagamento = (pessoaId, novoValor) => {
        let valorFormatado = novoValor;
        if (typeof novoValor === 'string') valorFormatado = novoValor.replace(',', '.');
        const valorNovoFloat = parseFloat(valorFormatado) || 0;

        setPagamentos(prev => ({
            ...prev,
            [pessoaId]: { ...prev[pessoaId], valor: valorNovoFloat }
        }));
        setSelecionados(prev => ({ ...prev, [pessoaId]: true }));
    };

    const adicionarPessoa = () => {
        const novaPessoa = `Pagante Extra ${Object.keys(pagamentos).length + 1}`;
        setPagamentos(prev => ({
            ...prev,
            [novaPessoa]: { valor: 0, formaPagamento: 'dinheiro', itens: [] } 
        }));
        setSelecionados(prev => ({ ...prev, [novaPessoa]: true }));
    };

    const removerPessoa = (pessoaId) => {
        if (Object.keys(pagamentos).length <= 1) return;
        const novosP = { ...pagamentos }; delete novosP[pessoaId];
        const novosS = { ...selecionados }; delete novosS[pessoaId];
        setPagamentos(novosP);
        setSelecionados(novosS);
    };

    // --- IMPRESSÃO DE CONFERÊNCIA (O PONTO CHAVE) ---
    const handleImprimirConferencia = () => {
        const totalConsumo = calcularTotalConsumo();
        const jaPago = calcularJaPago();
        const restante = calcularRestanteMesa();
        
        // Se estiver na etapa de seleção, imprime só os selecionados. Senão, imprime tudo.
        const dadosBase = (etapa > 1 && Object.keys(pagamentos).length > 0) ? pagamentos : agruparItensPorPessoa;
        const dadosParaImpressao = etapa > 1 ? 
            Object.fromEntries(Object.entries(dadosBase).filter(([k]) => selecionados[k])) : 
            dadosBase;

        // Se nenhum selecionado na etapa de pagamento, imprime o geral para conferência
        const dadosFinais = Object.keys(dadosParaImpressao).length > 0 ? dadosParaImpressao : agruparItensPorPessoa;

        const conteudo = `
            <html>
            <head>
                <title>Conferência - Mesa ${mesa?.numero}</title>
                <style>
                    @media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; } }
                    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0; padding: 5px; color: #000; background: #fff; font-weight: bold; }
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
                    .header h2 { font-size: 14px; margin: 0; text-transform: uppercase; }
                    .pagante-block { margin-bottom: 8px; }
                    .pagante-header { display: flex; justify-content: space-between; font-weight: 900; border-bottom: 1px solid #000; margin-bottom: 2px; text-transform: uppercase; }
                    .item-row { display: flex; justify-content: space-between; padding-left: 5px; font-size: 11px; margin-bottom: 1px; }
                    
                    /* BOX DE TOTAIS */
                    .resumo-box { border-top: 1px dashed #000; margin-top: 10px; padding-top: 5px; }
                    .linha-resumo { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
                    .linha-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>PRÉ-CONFERÊNCIA</h2>
                    <p style="font-size: 14px; margin: 5px 0;">MESA ${mesa?.numero}</p>
                    <p style="font-size: 10px;">${new Date().toLocaleString('pt-BR')}</p>
                </div>

                ${Object.entries(dadosFinais).map(([pessoa, dados]) => `
                    <div class="pagante-block">
                        <div class="pagante-header">
                            <span>${pessoa.substring(0, 15)}</span>
                            <span>R$ ${(dados.valor !== undefined ? dados.valor : dados.total).toFixed(2)}</span>
                        </div>
                        ${dados.itens?.filter(i => i.preco > 0).map(item => `
                            <div class="item-row">
                                <span>${item.quantidade || 1}x ${item.nome.substring(0,20)}</span>
                                <span>${((item.preco || 0) * (item.quantidade || 1)).toFixed(2)}</span>
                            </div>
                        `).join('') || '<div class="item-row"><i>Valor Manual</i></div>'}
                    </div>
                `).join('')}

                <div class="resumo-box">
                    <div class="linha-resumo">
                        <span>TOTAL CONSUMO:</span>
                        <span>R$ ${totalConsumo.toFixed(2)}</span>
                    </div>
                    
                    ${jaPago > 0 ? `
                    <div class="linha-resumo">
                        <span>(-) JÁ PAGO:</span>
                        <span>R$ ${jaPago.toFixed(2)}</span>
                    </div>
                    ` : ''}

                    <div class="linha-total">
                        <span>A PAGAR:</span>
                        <span>R$ ${restante.toFixed(2)}</span>
                    </div>
                </div>
                
                <br/>
                <div style="text-align:center; font-size:10px;">*** NÃO É DOCUMENTO FISCAL ***</div>
            </body>
            </html>
        `;
        
        const win = window.open('', '', 'height=600,width=400');
        win.document.write(conteudo);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); win.close(); }, 500);
    };

    // --- FINALIZAR ---
    const handleFinalizar = async (modo) => {
        setCarregando(true);
        try {
            const totalPagoAgora = Object.entries(pagamentos).reduce((acc, [pessoa, dados]) => {
                return selecionados[pessoa] ? acc + dados.valor : acc;
            }, 0);

            const totalConsumo = calcularTotalConsumo();
            const jaPagoAntigo = calcularJaPago();
            const totalJaPagoNovo = jaPagoAntigo + totalPagoAgora;
            const restanteFinal = totalConsumo - totalJaPagoNovo;
            
            // Verifica se quitou (tolerância de centavos)
            const mesaQuitada = restanteFinal <= 0.10;

            const pagamentosValidos = Object.fromEntries(
                Object.entries(pagamentos).filter(([k]) => selecionados[k] && pagamentos[k].valor > 0)
            );

            // 1. Registrar Venda
            const dadosVenda = {
                mesaId: mesa.id,
                mesaNumero: mesa.numero,
                estabelecimentoId: estabelecimentoId,
                itens: Object.values(pagamentosValidos).flatMap(p => p.itens || []),
                pagamentos: pagamentosValidos,
                total: totalPagoAgora,
                valorOriginal: totalConsumo,
                tipoPagamento: tipoPagamento,
                status: mesaQuitada ? 'pago' : 'pago_parcial',
                criadoEm: serverTimestamp(),
                criadoPor: auth.currentUser?.uid,
                funcionario: auth.currentUser?.displayName || 'Garçom'
            };

            const docRef = await addDoc(collection(db, `estabelecimentos/${estabelecimentoId}/vendas`), dadosVenda);

            // 2. Atualizar Mesa
            if (mesa.id) {
                if (modo === 'total' || mesaQuitada) {
                    await updateDoc(doc(db, `estabelecimentos/${estabelecimentoId}/mesas/${mesa.id}`), {
                        status: 'livre',
                        clientes: [],
                        nomesOcupantes: ["Mesa"],
                        itens: [],
                        pedidos: [],
                        total: 0,
                        pagamentos: {},
                        pagamentosParciais: [],
                        updatedAt: serverTimestamp()
                    });
                    toast.success("Conta quitada! Mesa liberada.");
                } else {
                    const novoPagamentoInfo = {
                        id: docRef.id,
                        valor: totalPagoAgora,
                        data: new Date().toISOString(),
                        responsavel: auth.currentUser?.displayName || 'Garçom',
                        tipo: tipoPagamento
                    };

                    await updateDoc(doc(db, `estabelecimentos/${estabelecimentoId}/mesas/${mesa.id}`), {
                        status: 'ocupada',
                        total: restanteFinal, 
                        pagamentosParciais: arrayUnion(novoPagamentoInfo),
                        updatedAt: serverTimestamp()
                    });
                    toast.success(`Recebido R$ ${totalPagoAgora.toFixed(2)}. Restam R$ ${restanteFinal.toFixed(2)}`);
                }
            }

            if (onSucesso) onSucesso({ vendaId: docRef.id, parcial: !mesaQuitada });
            onClose();

        } catch (error) {
            console.error('Erro:', error);
            toast.error('Erro: ' + error.message);
        } finally {
            setCarregando(false);
        }
    };

    // --- UI RENDERIZADORES ---
    const renderHistoricoPagamentos = () => {
        const jaPago = calcularJaPago();
        if (jaPago <= 0) return null;

        return (
            <div className="bg-gray-100 p-4 rounded-2xl mb-4 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <IoTime /> <span className="text-xs font-bold uppercase">Histórico de Pagamentos</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Já abatido da conta:</span>
                    <span className="text-lg font-bold text-green-600">- R$ {jaPago.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400 text-right">
                    (Este valor já está descontado do total a pagar)
                </div>
            </div>
        );
    };

    const renderizarEtapa1 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-[#3b82f6] rounded-3xl p-6 shadow-xl shadow-blue-200 text-center relative overflow-hidden">
                 <div className="relative z-10">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <IoWallet className="text-3xl text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-blue-100 mb-1">Restante a Pagar</h2>
                    <span className="text-5xl font-black text-white">R$ {calcularRestanteMesa().toFixed(2)}</span>
                    <p className="text-blue-200 text-sm font-bold mt-2 uppercase tracking-widest">
                        Total Consumo: R$ {calcularTotalConsumo().toFixed(2)}
                    </p>
                    
                    {/* BOTÃO DE IMPRIMIR COMANDA */}
                    <button onClick={handleImprimirConferencia} className="mt-4 w-full py-2 bg-white/20 text-white hover:bg-white/30 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                        <IoPrint className="text-lg" /> Imprimir Conferência
                    </button>
                </div>
            </div>

            {renderHistoricoPagamentos()}

            <div className="space-y-3">
                <button onClick={() => { setTipoPagamento('unico'); setEtapa(2); }} className="w-full bg-white p-4 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50/30 flex items-center gap-4 text-left transition-all">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600"><IoPerson size={24} /></div>
                    <div className="flex-1"><h4 className="font-bold text-gray-900">Quitar Restante</h4><p className="text-xs text-gray-500">Pagar todo o valor pendente</p></div>
                    <IoChevronForward className="text-gray-300" />
                </button>
                <button onClick={() => { setTipoPagamento('individual'); setEtapa(2); }} className="w-full bg-white p-4 rounded-2xl border-2 border-gray-100 hover:border-green-500 hover:bg-green-50/30 flex items-center gap-4 text-left transition-all">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600"><IoPeople size={24} /></div>
                    <div className="flex-1"><h4 className="font-bold text-gray-900">Pagamento Parcial / Dividir</h4><p className="text-xs text-gray-500">Abater valor ou dividir entre pessoas</p></div>
                    <IoChevronForward className="text-gray-300" />
                </button>
            </div>
        </div>
    );

    const renderizarEtapa2 = () => {
        const formasPagamento = [
            { id: 'dinheiro', icon: <IoCash />, label: 'Dinheiro' },
            { id: 'credito', icon: <IoCard />, label: 'Crédito' },
            { id: 'debito', icon: <IoCard />, label: 'Débito' },
            { id: 'pix', icon: <IoPhonePortrait />, label: 'PIX' }
        ];

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setEtapa(1)} className="p-2 hover:bg-gray-100 rounded-lg"><IoChevronBack className="text-xl" /></button>
                    <h3 className="text-lg font-black text-gray-900">Quem vai pagar agora?</h3>
                </div>
                
                {tipoPagamento === 'individual' && (
                     <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-xs font-bold mb-4 flex gap-2 items-center border border-blue-100">
                         <IoCheckmark className="text-lg" />
                         Selecione quem vai pagar neste momento.
                     </div>
                )}

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {Object.entries(pagamentos).map(([pessoa, dados]) => (
                        <div key={pessoa} className={`bg-white rounded-2xl p-4 border transition-all ${selecionados[pessoa] ? 'border-blue-500 ring-1 ring-blue-200 shadow-md' : 'border-gray-200 opacity-70 grayscale-[0.5]'}`}>
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleSelecao(pessoa)}>
                                    <div className={`text-2xl transition-transform active:scale-90 ${selecionados[pessoa] ? 'text-blue-600' : 'text-gray-300'}`}>
                                        {selecionados[pessoa] ? <IoCheckbox /> : <IoSquareOutline />}
                                    </div>
                                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-600">{pessoa.charAt(0)}</div>
                                    <div><h4 className="font-bold text-gray-900 text-sm">{pessoa}</h4></div>
                                </div>
                                {tipoPagamento === 'individual' && Object.keys(pagamentos).length > 1 && (
                                    <button onClick={() => removerPessoa(pessoa)} className="text-red-400 hover:text-red-600 p-2"><IoRemove /></button>
                                )}
                            </div>
                            
                            {selecionados[pessoa] && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
                                            <input 
                                                type="number" 
                                                className="w-full bg-blue-50/50 border border-blue-200 rounded-lg pl-8 pr-3 py-3 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="0.00"
                                                value={dados.valor}
                                                onChange={(e) => editarValorPagamento(pessoa, e.target.value)}
                                                onClick={(e) => e.target.select()} 
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 mb-2">
                                        {formasPagamento.map(forma => (
                                            <button key={forma.id} onClick={() => editarFormaPagamento(pessoa, forma.id)} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${dados.formaPagamento === forma.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                                                <div className="text-xl mb-1">{forma.icon}</div><span className="text-[8px] font-bold uppercase">{forma.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {/* LISTA DE ITENS - FILTRADA PARA POSITIVOS */}
                                    {dados.itens && dados.itens.filter(i => i.preco > 0).length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                            <p className="text-[10px] text-gray-400 font-bold mb-1">CONSUMO:</p>
                                            <div className="text-xs text-gray-500 space-y-1 max-h-20 overflow-y-auto">
                                                {dados.itens.filter(i => i.preco > 0).map((item, idx) => (
                                                    <div key={idx} className="flex justify-between">
                                                        <span>{item.quantidade || 1}x {item.nome}</span>
                                                        <span>{((item.preco || 0) * (item.quantidade || 1)).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                
                {tipoPagamento === 'individual' && (
                    <button onClick={adicionarPessoa} className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-500 font-bold hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                        <IoAdd /> Adicionar Pagante Manual
                    </button>
                )}
                
                <button onClick={() => setEtapa(3)} className="mt-4 w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2">
                    Conferir e Finalizar <IoChevronForward />
                </button>
            </div>
        );
    };

    const renderizarEtapa3 = () => {
        const totalConsumo = calcularTotalConsumo();
        const jaPago = calcularJaPago();
        const totalPagoAgora = Object.entries(pagamentos).reduce((acc, [pessoa, dados]) => {
            return selecionados[pessoa] ? acc + dados.valor : acc;
        }, 0);
        
        const totalPagoGeral = jaPago + totalPagoAgora;
        const restanteFinal = totalConsumo - totalPagoGeral;
        
        const vaiQuitar = restanteFinal <= 0.10;
        const troco = restanteFinal < -0.10 ? Math.abs(restanteFinal) : 0;

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="text-center relative">
                    <button onClick={() => setEtapa(2)} className="absolute top-0 left-0 p-2 bg-gray-100 rounded-xl hover:bg-gray-200"><IoChevronBack /></button>
                    <h3 className="text-xl font-black text-gray-900">Confirmação</h3>
                </div>
                
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl">
                    <div className="flex justify-between items-center mb-1 text-gray-400 font-medium text-xs">
                        <span>Total Consumo</span>
                        <span>R$ {totalConsumo.toFixed(2)}</span>
                    </div>
                    {jaPago > 0 && (
                        <div className="flex justify-between items-center mb-3 text-green-600 font-bold text-xs border-b border-gray-100 pb-2">
                            <span>Já Pago (Anterior)</span>
                            <span>- R$ {jaPago.toFixed(2)}</span>
                        </div>
                    )}
                    
                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
                        <span className="text-lg font-bold text-gray-900">Pagando Agora</span>
                        <span className="text-3xl font-black text-blue-600">R$ {totalPagoAgora.toFixed(2)}</span>
                    </div>

                    <div className={`p-4 rounded-2xl text-center mb-6 ${!vaiQuitar ? 'bg-orange-50 text-orange-700' : (troco > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600')}`}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1">Situação da Mesa Após Pagamento</p>
                        <p className="text-xl font-black">
                            {!vaiQuitar && `Faltarão R$ ${restanteFinal.toFixed(2)}`}
                            {vaiQuitar && troco === 0 && `Conta Quitada (Mesa Fecha)`}
                            {vaiQuitar && troco > 0 && `Conta Quitada (Troco: R$ ${troco.toFixed(2)})`}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-400 uppercase">Resumo da Transação:</p>
                        {Object.entries(pagamentos).filter(([k]) => selecionados[k]).map(([pessoa, dados]) => (
                            <div key={pessoa} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-600 font-medium">{pessoa} <span className="text-xs text-gray-400">({dados.formaPagamento})</span></span>
                                <span className="font-bold text-gray-900">R$ {dados.valor.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {!vaiQuitar && (
                        <button 
                            onClick={() => handleFinalizar('parcial')}
                            disabled={carregando}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {carregando ? 'Processando...' : `Receber R$ ${totalPagoAgora.toFixed(2)} e Manter Aberta`}
                        </button>
                    )}

                    {vaiQuitar && (
                        <button 
                            onClick={() => handleFinalizar('total')} 
                            disabled={carregando} 
                            className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-2xl font-bold shadow-lg shadow-green-200 text-white active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {carregando ? 'Processando...' : (troco > 0 ? 'Encerrar com Troco' : 'Encerrar Mesa (Tudo Pago)')}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-300">
                <div className="p-4 flex justify-between items-center border-b border-gray-100">
                    <span className="text-xs font-black text-gray-300 uppercase tracking-widest">Pagamento</span>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"><IoClose size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-[#f8faff]">
                    {etapa === 1 && renderizarEtapa1()}
                    {etapa === 2 && renderizarEtapa2()}
                    {etapa === 3 && renderizarEtapa3()}
                </div>
            </div>
        </div>
    );
};

export default ModalPagamento;