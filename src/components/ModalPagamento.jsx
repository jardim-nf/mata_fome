import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
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
    IoPrint
} from 'react-icons/io5';
import { toast } from 'react-toastify';

const ModalPagamento = ({ mesa, estabelecimentoId, onClose, onSucesso }) => {
    const [etapa, setEtapa] = useState(1);
    const [tipoPagamento, setTipoPagamento] = useState(null);
    const [pagamentos, setPagamentos] = useState({});
    const [carregando, setCarregando] = useState(false);
    const [valorPersonalizado, setValorPersonalizado] = useState('');

    // --- LÓGICA DE AGRUPAMENTO CORRIGIDA ---
    const agruparItensPorPessoa = useMemo(() => {
        // Tenta pegar de 'itens' (seu JSON atual) ou 'pedidos' (backups)
        const listaItens = mesa?.itens || mesa?.pedidos || [];
        
        if (listaItens.length === 0) return {};
        
        const agrupados = {};
        listaItens.forEach(item => {
            // CORREÇÃO AQUI: Verifica 'cliente' (do seu JSON), depois 'destinatario'
            let pessoa = item.cliente || item.destinatario || 'Mesa';
            
            // Tratamento para nomes vazios ou genéricos
            if ((!pessoa || pessoa === 'Mesa') && mesa.nomesOcupantes && mesa.nomesOcupantes.length > 0) {
                // Se o item for da 'Mesa', tenta atribuir ao primeiro ocupante ou mantém 'Mesa'
                // Aqui mantemos a lógica original de separar se tiver nome específico
                if(!item.cliente && !item.destinatario) pessoa = mesa.nomesOcupantes[0]; 
            }
            
            // Fallback final
            if (!pessoa) pessoa = 'Cliente 1';

            if (!agrupados[pessoa]) {
                agrupados[pessoa] = { itens: [], total: 0 };
            }
            
            // Garante leitura correta da quantidade (seu JSON usa 'quantidade', mas o código antigo usava 'qtd')
            const qtd = item.quantidade || item.qtd || 1;

            agrupados[pessoa].itens.push(item);
            agrupados[pessoa].total += (item.preco * qtd);
        });

        return agrupados;
    }, [mesa]);

    // Função auxiliar para calcular total geral
    const getTotalGeral = () => {
        const listaItens = mesa?.itens || mesa?.pedidos || [];
        return listaItens.reduce((acc, item) => {
            const qtd = item.quantidade || item.qtd || 1;
            return acc + (item.preco * qtd);
        }, 0);
    };

    // --- INICIALIZAÇÃO ---
    useEffect(() => {
        // Usa a função de cálculo para garantir precisão
        const totalMesa = getTotalGeral(); 
        const listaItens = mesa?.itens || mesa?.pedidos || [];

        if (tipoPagamento === 'unico') {
            setPagamentos({
                'Pagamento Único': {
                    valor: totalMesa,
                    formaPagamento: 'dinheiro',
                    itens: listaItens
                }
            });
        } else if (tipoPagamento === 'individual') {
            const pagamentosIniciais = {};
            const grupos = agruparItensPorPessoa;

            if (Object.keys(grupos).length === 0) {
                pagamentosIniciais['Cliente 1'] = {
                    valor: totalMesa,
                    formaPagamento: 'dinheiro',
                    itens: listaItens
                };
            } else {
                Object.entries(grupos).forEach(([pessoa, dados]) => {
                    pagamentosIniciais[pessoa] = {
                        valor: dados.total,
                        formaPagamento: 'dinheiro',
                        itens: dados.itens 
                    };
                });
            }
            setPagamentos(pagamentosIniciais);
        }
    }, [tipoPagamento, agruparItensPorPessoa, mesa]);

    const calcularTotalPagamentos = () => Object.values(pagamentos).reduce((acc, curr) => acc + curr.valor, 0);
    const calcularTotalMesa = () => getTotalGeral();

    // --- MANIPULAÇÃO DE DADOS ---
    const editarFormaPagamento = (pessoaId, novaForma) => {
        setPagamentos(prev => ({
            ...prev,
            [pessoaId]: { ...prev[pessoaId], formaPagamento: novaForma }
        }));
    };

    const editarValorPagamento = (pessoaId, novoValor) => {
        setPagamentos(prev => ({
            ...prev,
            [pessoaId]: { ...prev[pessoaId], valor: parseFloat(novoValor) || 0 }
        }));
    };

    const adicionarPessoa = () => {
        const novaPessoa = `Cliente ${Object.keys(pagamentos).length + 1}`;
        setPagamentos(prev => ({
            ...prev,
            [novaPessoa]: { valor: 0, formaPagamento: 'dinheiro', itens: [] }
        }));
    };

    const removerPessoa = (pessoaId) => {
        if (Object.keys(pagamentos).length <= 1) return;
        setPagamentos(prev => {
            const novos = { ...prev };
            delete novos[pessoaId];
            return novos;
        });
    };

    // --- IMPRESSÃO TÉRMICA DE ALTO CONTRASTE ---
    const handleImprimirConferencia = () => {
        const totalMesa = calcularTotalMesa();
        // Usa os pagamentos se estiver na etapa de divisão, senão usa o agrupamento automático
        const dadosParaImpressao = (etapa > 1 && Object.keys(pagamentos).length > 0) ? pagamentos : agruparItensPorPessoa;
        
        const conteudo = `
            <html>
            <head>
                <title>Comanda - Mesa ${mesa?.numero}</title>
                <style>
                    @media print {
                        @page { margin: 0; size: auto; }
                        body { margin: 0; padding: 0; }
                    }
                    body { 
                        font-family: 'Courier New', monospace; 
                        font-size: 12px; 
                        width: 300px; 
                        margin: 0; 
                        padding: 10px 5px; 
                        color: #000000 !important; 
                        background-color: #ffffff !important;
                        font-weight: bold !important; 
                    }
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 2px dashed #000; padding-bottom: 5px; }
                    .header h2 { font-size: 16px; margin: 0; text-transform: uppercase; font-weight: 900; }
                    .divider { border-top: 2px dashed #000; margin: 10px 0; display: block; }
                    
                    .pagante-block { margin-bottom: 10px; }
                    .pagante-header { 
                        display: flex; 
                        justify-content: space-between; 
                        font-weight: 900; 
                        font-size: 13px; 
                        margin-bottom: 3px; 
                        border-bottom: 1px solid #000;
                    }
                    
                    .item-row { 
                        display: flex; 
                        justify-content: space-between; 
                        padding-left: 5px; 
                        font-size: 12px; 
                        color: #000 !important;
                    }
                    
                    .total-geral { 
                        font-size: 18px; 
                        font-weight: 900 !important; 
                        text-align: right; 
                        margin-top: 15px; 
                        border-top: 2px solid #000;
                        padding-top: 5px;
                    }
                    
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>PRÉ-CONFERÊNCIA</h2>
                    <p style="margin:5px 0; font-size:14px">MESA ${mesa?.numero}</p>
                    <p style="font-size:10px">${new Date().toLocaleString('pt-BR')}</p>
                </div>
                
                ${Object.keys(dadosParaImpressao).length > 0 ? 
                    Object.entries(dadosParaImpressao).map(([pessoa, dados]) => {
                        // Se estiver vindo do state 'pagamentos', pode ter .valor, se for do agrupamento tem .total
                        const totalPessoa = dados.valor !== undefined ? dados.valor : dados.total;
                        
                        return `
                        <div class="pagante-block">
                            <div class="pagante-header">
                                <span>${pessoa.toUpperCase()}</span>
                                <span>R$ ${totalPessoa.toFixed(2)}</span>
                            </div>
                            
                            ${dados.itens && dados.itens.length > 0 ? dados.itens.map(item => {
                                const qtd = item.quantidade || item.qtd || 1;
                                return `
                                <div class="item-row">
                                    <span>${qtd}x ${item.nome.substring(0, 20)}</span>
                                    <span>${(item.preco * qtd).toFixed(2)}</span>
                                </div>
                                `;
                            }).join('') : '<div class="item-row"><span>Valor Personalizado/Manual</span></div>'}
                        </div>
                        `;
                    }).join('') 
                : 
                (mesa?.itens || mesa?.pedidos || []).map(item => {
                    const qtd = item.quantidade || item.qtd || 1;
                    return `
                    <div class="item-row">
                        <span>${qtd}x ${item.nome}</span>
                        <span>${(item.preco * qtd).toFixed(2)}</span>
                    </div>
                    `;
                }).join('')
                }

                <div class="divider"></div>

                <div class="total-geral">TOTAL: R$ ${totalMesa.toFixed(2)}</div>
                
                <br/>
                <div style="text-align:center; font-size:10px; font-weight:900;">
                    *** NÃO É DOCUMENTO FISCAL ***<br/>
                    AGUARDAMOS SEU PAGAMENTO
                </div>
                <br/>
            </body>
            </html>
        `;

        const win = window.open('', '', 'height=600,width=400');
        win.document.write(conteudo);
        win.document.close();
        win.focus();
        setTimeout(() => { 
            win.print(); 
            win.close(); 
        }, 500);
    };

    // --- FINALIZAR ---
    const finalizarPagamento = async () => {
        setCarregando(true);
        try {
            const totalPago = calcularTotalPagamentos();
            const totalMesa = calcularTotalMesa();
            
            if (Math.abs(totalPago - totalMesa) > 0.10) {
                if(!window.confirm(`Diferença de valores detectada. Fechar mesmo assim?`)) {
                    setCarregando(false);
                    return;
                }
            }

            const dadosVenda = {
                mesaId: mesa.id,
                mesaNumero: mesa.numero,
                estabelecimentoId: estabelecimentoId,
                itens: mesa.itens || mesa.pedidos || [],
                pagamentos: pagamentos,
                total: totalMesa,
                tipoPagamento: tipoPagamento,
                status: 'pago',
                criadoEm: serverTimestamp(),
                criadoPor: auth.currentUser?.uid,
                funcionario: auth.currentUser?.displayName || 'Garçom'
            };

            const docRef = await addDoc(collection(db, `estabelecimentos/${estabelecimentoId}/vendas`), dadosVenda);

            if (mesa.id) {
                await updateDoc(doc(db, `estabelecimentos/${estabelecimentoId}/mesas/${mesa.id}`), {
                    status: 'livre',
                    clientes: [],
                    nomesOcupantes: ["Mesa"],
                    itens: [],
                    pedidos: [], // Limpa pedidos também
                    total: 0,
                    pagamentos: {},
                    updatedAt: serverTimestamp()
                });
            }

            toast.success("Pagamento realizado!");
            if (onSucesso) onSucesso({ vendaId: docRef.id });
            onClose();

        } catch (error) {
            console.error('Erro:', error);
            toast.error('Erro: ' + error.message);
        } finally {
            setCarregando(false);
        }
    };

    // --- RENDER ETAPA 1 (AZUL / CARD) ---
    const renderizarEtapa1 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* CARD AZUL DE DESTAQUE */}
            <div className="bg-[#3b82f6] rounded-3xl p-6 shadow-xl shadow-blue-200 text-center relative overflow-hidden">
                {/* Efeitos de fundo */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black opacity-10 rounded-full -ml-10 -mb-10 blur-xl"></div>
                
                <div className="relative z-10">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/30">
                        <IoWallet className="text-3xl text-white" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-blue-100 mb-1">Total a Pagar</h2>
                    <span className="text-5xl font-black text-white tracking-tight">
                        R$ {calcularTotalMesa().toFixed(2)}
                    </span>
                    <p className="text-blue-200 text-sm font-bold mt-2 uppercase tracking-widest">Mesa {mesa?.numero}</p>

                    {/* BOTÃO BRANCO DE IMPRIMIR DENTRO DO CARD */}
                    <button 
                        onClick={handleImprimirConferencia}
                        className="mt-6 w-full py-3 bg-white text-blue-600 rounded-xl font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-blue-50 transition-all shadow-lg active:scale-95"
                    >
                        <IoPrint className="text-lg" />
                        Imprimir Comanda
                    </button>
                </div>
            </div>

            <p className="text-center text-sm text-gray-500 font-medium">Selecione como deseja dividir o pagamento:</p>

            <div className="space-y-3">
                <button 
                    onClick={() => { setTipoPagamento('unico'); setEtapa(2); }}
                    className="w-full bg-white p-4 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50/30 hover:shadow-md transition-all group flex items-center gap-4 text-left"
                >
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <IoPerson size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900">Pagamento Único</h4>
                        <p className="text-xs text-gray-500">Uma pessoa paga o total</p>
                    </div>
                    <IoChevronForward className="text-gray-300 group-hover:text-blue-600" />
                </button>

                <button 
                    onClick={() => { setTipoPagamento('individual'); setEtapa(2); }}
                    className="w-full bg-white p-4 rounded-2xl border-2 border-gray-100 hover:border-green-500 hover:bg-green-50/30 hover:shadow-md transition-all group flex items-center gap-4 text-left"
                >
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                        <IoPeople size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900">Pagamento Individual</h4>
                        <p className="text-xs text-gray-500">Dividir por consumo ou valor</p>
                    </div>
                    <IoChevronForward className="text-gray-300 group-hover:text-green-600" />
                </button>
            </div>
        </div>
    );

    // --- RENDER ETAPA 2 (MÉTODOS) ---
    const renderizarEtapa2 = () => {
        const formasPagamento = [
            { id: 'dinheiro', icon: <IoCash />, label: 'Dinheiro', color: 'bg-green-100 text-green-600' },
            { id: 'credito', icon: <IoCard />, label: 'Crédito', color: 'bg-blue-100 text-blue-600' },
            { id: 'debito', icon: <IoCard />, label: 'Débito', color: 'bg-purple-100 text-purple-600' },
            { id: 'pix', icon: <IoPhonePortrait />, label: 'PIX', color: 'bg-teal-100 text-teal-600' }
        ];

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setEtapa(1)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <IoChevronBack className="text-xl" />
                    </button>
                    <h3 className="text-lg font-black text-gray-900">
                        {tipoPagamento === 'unico' ? 'Configurar Pagamento' : 'Dividir Conta'}
                    </h3>
                </div>

                <div className="space-y-4">
                    {Object.entries(pagamentos).map(([pessoa, dados]) => (
                        <div key={pessoa} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${tipoPagamento === 'unico' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                                        {tipoPagamento === 'unico' ? <IoPerson /> : pessoa.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm">{pessoa}</h4>
                                        <div className="text-2xl font-black text-gray-800">R$ {dados.valor.toFixed(2)}</div>
                                    </div>
                                </div>
                                {tipoPagamento === 'individual' && Object.keys(pagamentos).length > 1 && (
                                    <button onClick={() => removerPessoa(pessoa)} className="text-red-400 hover:text-red-600 p-2"><IoRemove /></button>
                                )}
                            </div>

                            <div className="grid grid-cols-4 gap-2 mb-4">
                                {formasPagamento.map(forma => (
                                    <button
                                        key={forma.id}
                                        onClick={() => editarFormaPagamento(pessoa, forma.id)}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${dados.formaPagamento === forma.id ? `ring-2 ring-offset-1 ring-blue-500 ${forma.color}` : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                    >
                                        <div className="text-xl mb-1">{forma.icon}</div>
                                        <span className="text-[9px] font-bold uppercase">{forma.label}</span>
                                    </button>
                                ))}
                            </div>

                            {tipoPagamento === 'individual' && (
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Valor..." 
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onBlur={(e) => { if(e.target.value) { editarValorPagamento(pessoa, e.target.value); e.target.value = ''; } }}
                                    />
                                    <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold uppercase text-gray-600">Alterar</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {tipoPagamento === 'individual' && (
                    <button onClick={adicionarPessoa} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-500 font-bold hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                        <IoAdd /> Adicionar Pagante
                    </button>
                )}

                <button 
                    onClick={() => setEtapa(3)}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    Revisar e Finalizar <IoChevronForward />
                </button>
            </div>
        );
    };

    // --- RENDER ETAPA 3 (CONFIRMAÇÃO) ---
    const renderizarEtapa3 = () => {
        const totalMesa = calcularTotalMesa();
        const totalPagamentos = calcularTotalPagamentos();
        const diferenca = totalPagamentos - totalMesa;
        const batendo = Math.abs(diferenca) < 0.10;

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="text-center">
                    <button onClick={() => setEtapa(2)} className="absolute top-4 left-4 p-2 bg-gray-100 rounded-xl"><IoChevronBack /></button>
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IoCheckmark className="text-3xl text-green-600" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900">Confirmar</h3>
                    <p className="text-sm text-gray-500">Revise antes de encerrar a mesa</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xl">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500 font-medium">Total Mesa</span>
                        <span className="font-bold text-gray-900">R$ {totalMesa.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                        <span className="text-gray-500 font-medium">Total Recebido</span>
                        <span className={`font-bold ${batendo ? 'text-green-600' : 'text-red-500'}`}>R$ {totalPagamentos.toFixed(2)}</span>
                    </div>

                    {!batendo && (
                        <div className={`p-3 rounded-xl text-center text-sm font-bold mb-4 ${diferenca > 0 ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                            {diferenca > 0 ? `Troco: R$ ${diferenca.toFixed(2)}` : `Faltam: R$ ${Math.abs(diferenca).toFixed(2)}`}
                        </div>
                    )}

                    <div className="space-y-2">
                        {Object.entries(pagamentos).map(([pessoa, dados]) => (
                            <div key={pessoa} className="flex justify-between text-sm">
                                <span className="text-gray-600">{pessoa} <span className="text-xs text-gray-400">({dados.formaPagamento})</span></span>
                                <span className="font-bold text-gray-800">R$ {dados.valor.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={finalizarPagamento}
                    disabled={carregando}
                    className={`w-full py-4 rounded-2xl font-bold shadow-lg text-white transition-all flex items-center justify-center gap-2 ${batendo ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'}`}
                >
                    {carregando ? 'Processando...' : (batendo ? 'Encerrar Mesa' : 'Encerrar com Diferença')}
                </button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-300">
                <div className="p-4 flex justify-between items-center border-b border-gray-100">
                    <span className="text-xs font-black text-gray-300 uppercase tracking-widest">BrocouSystem</span>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <IoClose size={24} />
                    </button>
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