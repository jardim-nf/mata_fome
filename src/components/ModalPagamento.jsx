import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
    IoReceiptOutline, 
    IoClose,
    IoChevronBack,
    IoChevronForward,
    IoCash,
    IoCard,
    IoPhonePortrait,
    IoAdd,
    IoRemove,
    IoPencil,
    IoCheckmark,
    IoPerson,
    IoPeople,
    IoArrowDown,
    IoWallet
} from 'react-icons/io5';

const ModalPagamento = ({ mesa, estabelecimentoId, onClose, onSucesso }) => {
    const [etapa, setEtapa] = useState(1);
    const [tipoPagamento, setTipoPagamento] = useState(null);
    const [pagamentos, setPagamentos] = useState({});
    const [carregando, setCarregando] = useState(false);
    const [valorPersonalizado, setValorPersonalizado] = useState('');

    // Agrupa itens por pessoa
    const agruparItensPorPessoa = useMemo(() => {
        if (!mesa || !mesa.itens) return {};
        
        const agrupados = {};
        
        mesa.itens.forEach(item => {
            let pessoa = 'Cliente 1';
            
            if (item.destinatario && item.destinatario !== 'Mesa') {
                pessoa = item.destinatario;
            } else if (mesa.nomesOcupantes && mesa.nomesOcupantes.length > 0) {
                const index = Math.floor(Math.random() * mesa.nomesOcupantes.length);
                pessoa = mesa.nomesOcupantes[index] || 'Cliente 1';
            }
            
            if (!agrupados[pessoa]) {
                agrupados[pessoa] = {
                    itens: [],
                    total: 0
                };
            }
            
            agrupados[pessoa].itens.push(item);
            agrupados[pessoa].total += (item.preco * item.quantidade);
        });

        return agrupados;
    }, [mesa]);

    // ✅ Inicializa os pagamentos
    useEffect(() => {
        if (tipoPagamento === 'unico') {
            setPagamentos({
                'Pagamento Único': {
                    valor: calcularTotalMesa(),
                    formaPagamento: 'dinheiro',
                    status: 'pendente',
                    itens: mesa?.itens || []
                }
            });
        } else if (tipoPagamento === 'individual') {
            const pagamentosIniciais = {};
            
            Object.entries(agruparItensPorPessoa).forEach(([pessoa, dados]) => {
                pagamentosIniciais[pessoa] = {
                    valor: dados.total,
                    formaPagamento: 'dinheiro',
                    status: 'pendente',
                    itens: dados.itens
                };
            });

            setPagamentos(pagamentosIniciais);
        }
    }, [tipoPagamento, agruparItensPorPessoa, mesa]);

    const calcularTotalPagamentos = () => {
        return Object.values(pagamentos).reduce((total, dados) => total + dados.valor, 0);
    };

    const calcularTotalMesa = () => {
        return mesa?.total || 0;
    };

    // Funções de Edição
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
            [novaPessoa]: { 
                valor: 0, 
                formaPagamento: 'dinheiro', 
                status: 'pendente', 
                itens: [] 
            }
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

    // Finalizar Pagamento
    const finalizarPagamento = async () => {
        setCarregando(true);
        try {
            const totalPago = calcularTotalPagamentos();
            const totalMesa = calcularTotalMesa();
            
            if (Math.abs(totalPago - totalMesa) > 0.10) {
                if(!window.confirm(`O valor total (R$ ${totalPago.toFixed(2)}) é diferente do total da mesa (R$ ${totalMesa.toFixed(2)}). Deseja fechar mesmo assim?`)) {
                    setCarregando(false);
                    return;
                }
            }

            const dadosVenda = {
                mesaId: mesa.id,
                mesaNumero: mesa.numero,
                estabelecimentoId: estabelecimentoId,
                itens: mesa.itens,
                pagamentos: pagamentos,
                total: totalMesa,
                tipoPagamento: tipoPagamento,
                status: 'pago',
                criadoEm: new Date(),
                criadoPor: auth.currentUser?.uid,
                funcionario: auth.currentUser?.displayName || 'Garçom'
            };

            const docRef = await addDoc(collection(db, `estabelecimentos/${estabelecimentoId}/vendas`), dadosVenda);

            // Limpa a mesa
            if (mesa.id) {
                await updateDoc(doc(db, `estabelecimentos/${estabelecimentoId}/mesas/${mesa.id}`), {
                    status: 'livre',
                    clientes: [],
                    nomesOcupantes: ["Mesa"],
                    itens: [],
                    total: 0,
                    pagamentos: {},
                    ultimaAtualizacao: new Date()
                });
            }

            if (onSucesso) onSucesso({ vendaId: docRef.id });
            onClose();

        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao processar: ' + error.message);
        } finally {
            setCarregando(false);
        }
    };

    // --- RENDERIZADORES MOBILE-FIRST ---

    const renderizarEtapa1 = () => (
        <div className="space-y-6">
            {/* Header com Total */}
            <div className="text-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-100">
                    <IoWallet className="text-2xl text-blue-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Pagamento</h2>
                <p className="text-gray-600 mb-3">Mesa {mesa?.numero}</p>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
                    <p className="text-sm text-gray-500 font-medium">Total a pagar</p>
                    <p className="text-3xl font-black text-blue-600">R$ {calcularTotalMesa().toFixed(2)}</p>
                </div>
            </div>

            {/* Opções de Pagamento */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 px-2">Escolha o tipo de pagamento</h3>
                
                {/* PAGAMENTO ÚNICO */}
                <button 
                    onClick={() => {
                        setTipoPagamento('unico');
                        setEtapa(2);
                    }}
                    className="w-full bg-white rounded-2xl p-5 border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200 active:scale-95 group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                            <IoPerson className="text-white text-xl" />
                        </div>
                        <div className="flex-1 text-left">
                            <h4 className="font-bold text-gray-900 text-lg">Pagamento Único</h4>
                            <p className="text-gray-600 text-sm">Uma pessoa paga o total</p>
                            <p className="text-blue-600 font-black text-xl mt-1">
                                R$ {calcularTotalMesa().toFixed(2)}
                            </p>
                        </div>
                        <IoChevronForward className="text-gray-400 group-hover:text-blue-600 text-xl transition-colors" />
                    </div>
                </button>

                {/* PAGAMENTO INDIVIDUAL */}
                <button 
                    onClick={() => {
                        setTipoPagamento('individual');
                        setEtapa(2);
                    }}
                    className="w-full bg-white rounded-2xl p-5 border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition-all duration-200 active:scale-95 group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                            <IoPeople className="text-white text-xl" />
                        </div>
                        <div className="flex-1 text-left">
                            <h4 className="font-bold text-gray-900 text-lg">Pagamento Individual</h4>
                            <p className="text-gray-600 text-sm">Cada um paga o que consumiu</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                                    {Object.keys(agruparItensPorPessoa).length} pessoa(s)
                                </span>
                            </div>
                        </div>
                        <IoChevronForward className="text-gray-400 group-hover:text-green-600 text-xl transition-colors" />
                    </div>
                </button>
            </div>

            {/* Resumo da Mesa */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <IoReceiptOutline className="text-blue-500" />
                    Resumo da Mesa
                </h4>
                <div className="space-y-3">
                    {Object.entries(agruparItensPorPessoa).map(([pessoa, dados]) => (
                        <div key={pessoa} className="flex justify-between items-center bg-white rounded-xl p-3 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <span className="text-blue-600 font-bold text-sm">
                                        {pessoa.charAt(0)}
                                    </span>
                                </div>
                                <span className="font-medium text-gray-900">{pessoa}</span>
                            </div>
                            <span className="font-bold text-blue-600">R$ {dados.total.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-300">
                    <span className="font-black text-gray-900 text-lg">Total Geral</span>
                    <span className="font-black text-blue-600 text-xl">
                        R$ {calcularTotalMesa().toFixed(2)}
                    </span>
                </div>
            </div>
        </div>
    );

    const renderizarEtapa2 = () => {
        const formasPagamento = [
            { id: 'dinheiro', icon: <IoCash className="text-xl" />, label: 'Dinheiro', color: 'from-green-500 to-green-600', bg: 'bg-green-50' },
            { id: 'credito', icon: <IoCard className="text-xl" />, label: 'Crédito', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
            { id: 'debito', icon: <IoCard className="text-xl" />, label: 'Débito', color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50' },
            { id: 'pix', icon: <IoPhonePortrait className="text-xl" />, label: 'PIX', color: 'from-teal-500 to-teal-600', bg: 'bg-teal-50' }
        ];

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="text-center">
                    <button 
                        onClick={() => setEtapa(1)}
                        className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4 mx-auto hover:bg-gray-200 transition-colors"
                    >
                        <IoChevronBack className="text-gray-600 text-lg" />
                    </button>
                    <h3 className="text-xl font-black text-gray-900 mb-2">
                        {tipoPagamento === 'unico' ? '💳 Pagamento Único' : '👥 Pagamentos Individuais'}
                    </h3>
                    <p className="text-gray-600">
                        {tipoPagamento === 'unico' 
                            ? 'Escolha a forma de pagamento' 
                            : 'Defina como cada pessoa vai pagar'
                        }
                    </p>
                </div>

                {/* Lista de Pagamentos */}
                <div className="space-y-4">
                    {Object.entries(pagamentos).map(([pessoa, dados]) => (
                        <div key={pessoa} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                            {/* Cabeçalho */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${
                                        tipoPagamento === 'unico' ? 'from-blue-500 to-blue-600' : 'from-purple-500 to-purple-600'
                                    }`}>
                                        <span className="text-white font-bold">
                                            {tipoPagamento === 'unico' ? '💳' : pessoa.charAt(0)}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-lg">{pessoa}</h4>
                                        <p className="text-2xl font-black text-blue-600">
                                            R$ {dados.valor.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                
                                {tipoPagamento === 'individual' && Object.keys(pagamentos).length > 1 && (
                                    <button 
                                        onClick={() => removerPessoa(pessoa)}
                                        className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors"
                                    >
                                        <IoRemove className="text-lg" />
                                    </button>
                                )}
                            </div>

                            {/* Formas de Pagamento */}
                            <div className="grid grid-cols-2 gap-3">
                                {formasPagamento.map(forma => (
                                    <button
                                        key={forma.id}
                                        onClick={() => editarFormaPagamento(pessoa, forma.id)}
                                        className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                                            dados.formaPagamento === forma.id 
                                                ? `border-blue-500 ${forma.bg} shadow-md scale-105` 
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${forma.color}`}>
                                            <span className="text-white text-lg">{forma.icon}</span>
                                        </div>
                                        <span className="font-medium text-gray-900 text-sm">{forma.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Campo para valor personalizado */}
                            <div className="mt-4">
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Valor personalizado:
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0,00"
                                        value={valorPersonalizado}
                                        onChange={(e) => setValorPersonalizado(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={() => {
                                            if (valorPersonalizado) {
                                                editarValorPagamento(pessoa, parseFloat(valorPersonalizado));
                                                setValorPersonalizado('');
                                            }
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Botão para adicionar pessoa */}
                {tipoPagamento === 'individual' && (
                    <button 
                        onClick={adicionarPessoa}
                        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center gap-3 text-gray-600 hover:text-blue-600 group"
                    >
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <IoAdd className="text-blue-600 text-lg" />
                        </div>
                        <span className="font-medium text-lg">Adicionar Pagante</span>
                    </button>
                )}

                {/* Botão Continuar */}
                <button 
                    onClick={() => setEtapa(3)}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    <span>Continuar</span>
                    <IoChevronForward className="text-lg" />
                </button>
            </div>
        );
    };

    const renderizarEtapa3 = () => {
        const totalMesa = calcularTotalMesa();
        const totalPagamentos = calcularTotalPagamentos();
        const diferenca = totalPagamentos - totalMesa;
        const batendo = Math.abs(diferenca) < 0.10;

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="text-center">
                    <button 
                        onClick={() => setEtapa(2)}
                        className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4 mx-auto hover:bg-gray-200 transition-colors"
                    >
                        <IoChevronBack className="text-gray-600 text-lg" />
                    </button>
                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <IoCheckmark className="text-2xl text-green-600" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">Confirmar Pagamento</h3>
                    <p className="text-gray-600">Revise os valores antes de finalizar</p>
                </div>

                {/* Resumo */}
                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2">
                            <span className="text-gray-600">Total da Mesa:</span>
                            <strong className="text-lg font-black text-gray-900">R$ {totalMesa.toFixed(2)}</strong>
                        </div>
                        <div className="flex justify-between items-center py-2 border-t border-gray-200">
                            <span className="text-gray-600">Total Recebido:</span>
                            <strong className={`text-lg font-black ${batendo ? 'text-green-600' : 'text-red-600'}`}>
                                R$ {totalPagamentos.toFixed(2)}
                            </strong>
                        </div>
                        
                        {!batendo && (
                            <div className={`py-3 px-4 rounded-xl text-center font-bold ${
                                diferenca > 0 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                            }`}>
                                {diferenca > 0 
                                    ? `💰 Sobrando R$ ${diferenca.toFixed(2)}` 
                                    : `⚠️ Faltando R$ ${Math.abs(diferenca).toFixed(2)}`
                                }
                            </div>
                        )}
                    </div>

                    {/* Detalhes dos Pagamentos */}
                    <div className="mt-6">
                        <h4 className="font-bold text-gray-900 mb-3">Detalhes:</h4>
                        <div className="space-y-3">
                            {Object.entries(pagamentos).map(([pessoa, dados]) => (
                                <div key={pessoa} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <span className="text-blue-600 font-bold">
                                                {pessoa.charAt(0)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900 block">{pessoa}</span>
                                            <span className="text-xs text-gray-500 capitalize">{dados.formaPagamento}</span>
                                        </div>
                                    </div>
                                    <strong className="text-gray-900 text-lg">R$ {dados.valor.toFixed(2)}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-3">
                    <button 
                        onClick={() => setEtapa(2)}
                        className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <IoChevronBack className="text-lg" />
                        Voltar
                    </button>
                    <button 
                        onClick={finalizarPagamento}
                        disabled={carregando}
                        className={`flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ${
                            batendo 
                                ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg shadow-green-200' 
                                : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg shadow-orange-200'
                        }`}
                    >
                        {carregando ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Processando...
                            </>
                        ) : batendo ? (
                            <>
                                <IoCheckmark className="text-lg" />
                                Finalizar
                            </>
                        ) : (
                            <>
                                ⚠️ Finalizar
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50">
            {/* Overlay - Fecha ao clicar fora APENAS na etapa 1 */}
            <div 
                className={`absolute inset-0 transition-all ${
                    etapa === 1 ? 'bg-black/70 backdrop-blur-sm' : 'bg-black/60'
                }`}
                onClick={etapa === 1 ? onClose : undefined}
            />
            
            {/* Modal */}
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden animate-slide-up">
                {/* Header Fixo */}
                <div className="sticky top-0 bg-white z-10 border-b border-gray-200">
                    <div className="flex items-center justify-between p-4">
                        <div>
                            <h2 className="text-lg font-black text-gray-900">Pagamento - Mesa {mesa?.numero}</h2>
                            <p className="text-sm text-gray-500">Total: R$ {calcularTotalMesa().toFixed(2)}</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors"
                        >
                            <IoClose className="text-gray-600 text-lg" />
                        </button>
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="p-4 pb-8 overflow-y-auto max-h-[calc(90vh-80px)]">
                    {etapa === 1 && renderizarEtapa1()}
                    {etapa === 2 && renderizarEtapa2()}
                    {etapa === 3 && renderizarEtapa3()}
                </div>
            </div>

            <style jsx>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
            `}</style>
        </div>
    );
};

export default ModalPagamento;