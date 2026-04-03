import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import { useTaxasDeEntregaData } from '../hooks/useTaxasDeEntregaData';

// Ícones para a interface
import { 
    IoArrowBack, IoAddCircleOutline, IoPencil, IoTrash, IoCloseCircleOutline,
    IoLocationOutline, IoCashOutline, IoListOutline, IoSaveOutline,
    IoStatsChart, IoSparkles
} from 'react-icons/io5';
import PromptDialog from '../components/ui/PromptDialog';

export default function TaxasDeEntrega() {
    const { estabelecimentoIdPrincipal, currentUser, isAdmin, isMaster, loading: authLoading } = useAuth();
    const { setTitle, setSubtitle, setActions } = useHeader();
    const navigate = useNavigate();

    // Hook Pessoal
    const {
        bairros, nomeBairro, setNomeBairro, valorTaxa, setValorTaxa,
        editingId, loading, formLoading, accessGranted,
        promptConfig, setPromptConfig, handlePromptSubmit, closePrompt,
        estatisticas,
        handleSubmit, clearForm, handleEdit, handleDelete
    } = useTaxasDeEntregaData({ 
        currentUser, isAdmin, isMaster, 
        estabelecimentoId: estabelecimentoIdPrincipal, navigate 
    });

    // CONFIGURAÇÃO DO HEADER DINÂMICO
    useEffect(() => {
        setTitle('🛵 Taxas de Entrega');
        setSubtitle('Gerencie os valores de entrega por bairro');
        const backButton = (
            <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-lg border border-gray-300 transition-all duration-200 hover:shadow-md hover:border-indigo-300"
            >
                <IoArrowBack />
                <span>Voltar ao Dashboard</span>
            </button>
        );
        setActions(backButton);

        return () => {
            setTitle(null); setSubtitle(null); setActions(null);
        };
    }, [setTitle, setSubtitle, setActions, navigate]);

    // RENDERIZANDO AUTH LOADING & NEGATIONS
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-700 font-medium">Verificando autenticação...</p>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IoCloseCircleOutline className="text-3xl text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Acesso Negado</h2>
                    <p className="text-gray-600 mb-6">Faça login para acessar esta página.</p>
                    <Link to="/login-admin" className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg">
                        <span>Fazer Login</span>
                    </Link>
                </div>
            </div>
        );
    }

    if (!accessGranted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IoCloseCircleOutline className="text-3xl text-yellow-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Configuração Incompleta</h2>
                    <p className="text-gray-600 mb-2 max-w-md">
                        {!estabelecimentoIdPrincipal ? "Configure seu estabelecimento primeiro para acessar as taxas de entrega." : "Você não tem permissão para acessar esta página."}
                    </p>
                    <div className="flex w-full gap-3 justify-center mt-6">
                        <button onClick={() => navigate('/dashboard')} className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg">
                            <IoArrowBack /><span>Voltar ao Dashboard</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-700 font-medium">Carregando taxas de entrega...</p>
                </div>
            </div>
        );
    }

    // --- MANEJO DE DELEÇÃO EXCLUSIVA DE UI ---
    const confirmarExclusao = (id, nome) => {
        toast.warning(
            ({ closeToast }) => (
                <div className="p-4">
                    <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <IoTrash className="text-red-600 text-sm" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-900">Confirmar exclusão?</p>
                            <p className="text-sm text-gray-600 mt-1">
                                Tem certeza que deseja excluir a taxa para <strong>"{nome}"</strong>?
                            </p>
                            <div className="flex justify-end mt-4 space-x-3">
                                <button onClick={closeToast} className="px-4 py-2 text-sm bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors">Cancelar</button>
                                <button onClick={() => { handleDelete(id, nome); closeToast(); }} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">Excluir</button>
                            </div>
                        </div>
                    </div>
                </div>
            ), { position: "top-center", autoClose: false, closeOnClick: false, draggable: false, closeButton: false }
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
            <div className="container mx-auto text-sm sm:text-base py-6">
                
                {/* Estatísticas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6 transform hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total de Bairros</p>
                                <p className="text-2xl font-bold text-gray-900">{estatisticas.total}</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg"><IoLocationOutline className="text-white text-lg" /></div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 transform hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Taxa Média</p>
                                <p className="text-2xl font-bold text-green-600">R$ {estatisticas.valorMedio.toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg"><IoStatsChart className="text-white text-lg" /></div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 transform hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Taxa Mínima</p>
                                <p className="text-2xl font-bold text-blue-600">R$ {estatisticas.valorMinimo.toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg"><span className="text-white text-lg font-bold">↓</span></div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg border border-orange-100 p-6 transform hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Taxa Máxima</p>
                                <p className="text-2xl font-bold text-orange-600">R$ {estatisticas.valorMaximo.toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg"><span className="text-white text-lg font-bold">↑</span></div>
                        </div>
                    </div>
                </div>

                {/* Formulário */}
                <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6 mb-8">
                    <div className="flex items-center space-x-3 mb-6">
                         <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            {editingId ? <IoPencil className="text-white text-lg" /> : <IoAddCircleOutline className="text-white text-lg" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">{editingId ? '✏️ Editar Taxa' : '➕ Adicionar Nova Taxa'}</h2>
                            <p className="text-sm text-gray-600">{editingId ? 'Atualize os dados da taxa de entrega' : 'Cadastre uma nova taxa para um bairro'}</p>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">Nome do Bairro *</label>
                                <div className="relative">
                                    <IoLocationOutline className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-400 text-lg" />
                                    <input type="text" value={nomeBairro} onChange={(e) => setNomeBairro(e.target.value)} className="pl-12 w-full p-4 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-indigo-50/50" placeholder="Ex: Centro, Jardim das Flores..." required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">Valor da Taxa (R$) *</label>
                                <div className="relative">
                                    <IoCashOutline className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-400 text-lg" />
                                    <input type="text" value={valorTaxa} onChange={(e) => setValorTaxa(e.target.value.replace(/[^0-9,]/g, ''))} className="pl-12 w-full p-4 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-indigo-50/50" placeholder="Ex: 5,00" required />
                                </div>
                            </div>
                        </div>
                        <div className="flex w-full gap-4 pt-4">
                            <button type="submit" disabled={formLoading} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center space-x-3 shadow-lg disabled:opacity-50">
                                {formLoading ? (<><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Salvando...</span></>) : (<><IoSaveOutline className="text-xl" /><span>{editingId ? 'Salvar Alterações' : 'Adicionar Taxa'}</span></>)}
                            </button>
                            {editingId && (
                                <button type="button" onClick={clearForm} className="px-8 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold flex items-center space-x-2">
                                    <IoCloseCircleOutline className="text-lg" /><span>Cancelar</span>
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Lista de Taxas */}
                <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
                    <div className="p-6 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg"><IoListOutline className="text-white text-lg" /></div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">📋 Taxas Cadastradas ({bairros.length})</h2>
                                <p className="text-sm text-indigo-600 mt-1 flex items-center space-x-1"><IoSparkles className="text-indigo-400" /><span>Clique no valor para editar rapidamente</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        {bairros.length > 0 ? (
                            <div className="space-y-4">
                                {bairros.map((bairro) => (
                                    <div key={bairro.id} className="flex items-center justify-between p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl hover:bg-indigo-100 transition-all duration-300 group border border-indigo-100">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 shadow-lg"><IoLocationOutline className="text-white text-lg" /></div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-lg">{bairro.nomeBairro}</p>
                                                <div className="flex items-center space-x-3 mt-2">
                                                    <span className="text-green-600 font-bold text-lg cursor-pointer hover:text-green-700 transition-colors duration-300 px-3 py-1 bg-green-50 rounded-lg hover:bg-green-100"
                                                        onClick={() => {
                                                            setPromptConfig({
                                                                open: true, type: 'EDIT_BAIRRO', bairro: bairro,
                                                                title: 'Alterar Taxa', message: `Nova taxa para ${bairro.nomeBairro}:`,
                                                                defaultValue: bairro.valorTaxa.toFixed(2).replace('.', ','), placeholder: 'Ex: 5,50'
                                                            });
                                                        }}
                                                    >
                                                        {bairro.valorTaxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <button onClick={() => handleEdit(bairro)} className="p-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200"><IoPencil className="text-lg" /></button>
                                            <button onClick={() => confirmarExclusao(bairro.id, bairro.nomeBairro)} className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200"><IoTrash className="text-lg" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12"><p className="text-gray-600 mb-6">Comece adicionando taxas de entrega para os bairros.</p></div>
                        )}
                    </div>
                </div>

                {/* Ações em Lote */}
                {bairros.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6 mt-8">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg"><IoSparkles className="text-white text-lg" /></div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">⚡ Ações em Lote</h3>
                                <p className="text-sm text-gray-600">Altere várias taxas de uma só vez</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <button
                                onClick={() => setPromptConfig({ open: true, type: 'AUMENTAR_VALOR', title: 'Aumentar Taxas (Valor Certo)', message: 'Aumentar todas as taxas em quanto? (em Reais)', placeholder: 'Ex: 2,00' })}
                                className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl hover:from-green-100 border border-green-200 text-left"
                            >
                                <div className="font-semibold text-lg mb-2">📈 Aumentar Todas</div>
                                <div className="text-sm text-green-600">Adicionar valor fixo a todas as taxas</div>
                            </button>
                            <button
                                onClick={() => setPromptConfig({ open: true, type: 'AUMENTAR_PERCENT', title: 'Aumentar Taxas (%)', message: 'Aumentar todas as taxas em qual percentual?', placeholder: 'Ex: 10 para 10%' })}
                                className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-xl hover:from-blue-100 border border-blue-200 text-left"
                            >
                                <div className="font-semibold text-lg mb-2">📊 Aumentar Percentual</div>
                                <div className="text-sm text-blue-600">Aumentar todas as taxas em %</div>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 🔥 CORE BUG FIXED: INJETANDO O PROMPT MODAL 🔥 */}
            <PromptDialog
                open={promptConfig.open}
                title={promptConfig.title}
                message={promptConfig.message}
                defaultValue={promptConfig.defaultValue}
                placeholder={promptConfig.placeholder}
                onSubmit={handlePromptSubmit}
                onClose={closePrompt}
            />
        </div>
    );
}