import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

// Ícones para a interface
import { 
    IoArrowBack, 
    IoAddCircleOutline, 
    IoPencil, 
    IoTrash, 
    IoCloseCircleOutline,
    IoLocationOutline,
    IoCashOutline,
    IoListOutline,
    IoSaveOutline
} from 'react-icons/io5';

function TaxasDeEntrega() {
    const { estabelecimentoId, currentUser, isAdmin, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [bairros, setBairros] = useState([]);
    const [nomeBairro, setNomeBairro] = useState('');
    const [valorTaxa, setValorTaxa] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);

    // Controle de acesso
    useEffect(() => {
        if (!authLoading && (!currentUser || !isAdmin)) {
            toast.error('🔒 Acesso negado.');
            navigate('/login-admin');
        }
    }, [currentUser, isAdmin, authLoading, navigate]);

    // Função para buscar as taxas de entrega
    const getTaxas = async () => {
        if (!estabelecimentoId) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        try {
            const taxasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega');
            const q = query(taxasCollectionRef, orderBy('nomeBairro'));
            const data = await getDocs(q);
            const fetchedBairros = data.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setBairros(fetchedBairros);
        } catch (err) {
            console.error("Erro ao buscar taxas:", err);
            toast.error("❌ Erro ao carregar as taxas de entrega.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && estabelecimentoId) {
            getTaxas();
        }
    }, [estabelecimentoId, authLoading]);

    const clearForm = () => {
        setEditingId(null);
        setNomeBairro('');
        setValorTaxa('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nomeBairro.trim() || valorTaxa === '') {
            toast.warn("⚠️ Por favor, preencha todos os campos.");
            return;
        }
        const valorNumerico = parseFloat(valorTaxa.replace(',', '.'));
        if (isNaN(valorNumerico) || valorNumerico < 0) {
            toast.warn("⚠️ Por favor, insira um valor de taxa válido.");
            return;
        }

        setFormLoading(true);
        try {
            const taxasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega');

            if (editingId) {
                const bairroDoc = doc(taxasCollectionRef, editingId);
                await updateDoc(bairroDoc, { 
                    nomeBairro: nomeBairro.trim(), 
                    valorTaxa: valorNumerico,
                    atualizadoEm: new Date()
                });
                toast.success("✅ Taxa atualizada com sucesso!");
            } else {
                await addDoc(taxasCollectionRef, { 
                    nomeBairro: nomeBairro.trim(), 
                    valorTaxa: valorNumerico,
                    criadoEm: new Date()
                });
                toast.success("✅ Nova taxa adicionada com sucesso!");
            }
            clearForm();
            getTaxas();
        } catch (err) {
            console.error("Erro ao salvar taxa:", err);
            toast.error("❌ Erro ao salvar a taxa.");
        } finally {
            setFormLoading(false);
        }
    };

    const handleEdit = (bairro) => {
        setEditingId(bairro.id);
        setNomeBairro(bairro.nomeBairro);
        setValorTaxa(bairro.valorTaxa.toFixed(2).replace('.', ','));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (id, nome) => {
        const confirmDelete = async () => {
            try {
                const taxaDocRef = doc(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega', id);
                await deleteDoc(taxaDocRef);
                toast.success(`✅ Taxa para "${nome}" foi excluída.`);
                getTaxas();
            } catch (err) {
                console.error("Erro ao excluir taxa:", err);
                toast.error("❌ Erro ao excluir a taxa.");
            }
        };

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
                                <button 
                                    onClick={closeToast} 
                                    className="px-4 py-2 text-sm bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={() => { 
                                        confirmDelete(); 
                                        closeToast(); 
                                    }} 
                                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ), {
                position: "top-center",
                autoClose: false,
                closeOnClick: false,
                draggable: false,
                closeButton: false
            }
        );
    };

    // Estatísticas
    const estatisticas = {
        total: bairros.length,
        valorMedio: bairros.length > 0 
            ? bairros.reduce((acc, bairro) => acc + bairro.valorTaxa, 0) / bairros.length 
            : 0
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando taxas de entrega...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                    <div className="mb-4 lg:mb-0">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Taxas de Entrega
                        </h1>
                        <p className="text-gray-600">
                            Gerencie os valores de entrega por bairro
                        </p>
                    </div>
                    
                    <Link 
                        to="/dashboard" 
                        className="inline-flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg border border-gray-300 transition-colors"
                    >
                        <IoArrowBack />
                        <span>Voltar ao Dashboard</span>
                    </Link>
                </header>

                {/* Estatísticas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total de Bairros</p>
                                <p className="text-2xl font-bold text-gray-900">{estatisticas.total}</p>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <IoLocationOutline className="text-blue-600 text-lg" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Taxa Média</p>
                                <p className="text-2xl font-bold text-green-600">
                                    R$ {estatisticas.valorMedio.toFixed(2).replace('.', ',')}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <IoCashOutline className="text-green-600 text-lg" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Formulário */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            {editingId ? (
                                <IoPencil className="text-blue-600 text-lg" />
                            ) : (
                                <IoAddCircleOutline className="text-blue-600 text-lg" />
                            )}
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {editingId ? 'Editar Taxa' : 'Adicionar Nova Taxa'}
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="nomeBairro" className="block text-sm font-medium text-gray-700 mb-2">
                                    Nome do Bairro *
                                </label>
                                <div className="relative">
                                    <IoLocationOutline className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        id="nomeBairro"
                                        value={nomeBairro}
                                        onChange={(e) => setNomeBairro(e.target.value)}
                                        className="pl-10 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        placeholder="Ex: Centro, Jardim das Flores..."
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="valorTaxa" className="block text-sm font-medium text-gray-700 mb-2">
                                    Valor da Taxa (R$) *
                                </label>
                                <div className="relative">
                                    <IoCashOutline className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        id="valorTaxa"
                                        value={valorTaxa}
                                        onChange={(e) => setValorTaxa(e.target.value.replace(/[^0-9,]/g, ''))}
                                        className="pl-10 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        placeholder="Ex: 5,00"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={formLoading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                                {formLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <IoSaveOutline className="text-lg" />
                                        <span>{editingId ? 'Salvar Alterações' : 'Adicionar Taxa'}</span>
                                    </>
                                )}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={clearForm}
                                    className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                                >
                                    <IoCloseCircleOutline />
                                    <span>Cancelar</span>
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Lista de Taxas */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <IoListOutline className="text-green-600 text-lg" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Taxas Cadastradas ({bairros.length})
                            </h2>
                        </div>
                    </div>

                    <div className="p-6">
                        {bairros.length > 0 ? (
                            <div className="space-y-3">
                                {bairros.map((bairro) => (
                                    <div 
                                        key={bairro.id} 
                                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                <IoLocationOutline className="text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{bairro.nomeBairro}</p>
                                                <p className="text-green-600 font-bold">
                                                    {bairro.valorTaxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleEdit(bairro)}
                                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                aria-label="Editar"
                                                title="Editar taxa"
                                            >
                                                <IoPencil />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(bairro.id, bairro.nomeBairro)}
                                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                aria-label="Excluir"
                                                title="Excluir taxa"
                                            >
                                                <IoTrash />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <IoLocationOutline className="text-2xl text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Nenhuma taxa cadastrada
                                </h3>
                                <p className="text-gray-600 max-w-md mx-auto">
                                    Comece adicionando taxas de entrega para os bairros atendidos pelo seu estabelecimento.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dica rápida */}
                {bairros.length > 0 && (
                    <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-sm">💡</span>
                            </div>
                            <div>
                                <p className="text-blue-800 font-medium">Dica rápida</p>
                                <p className="text-blue-700 text-sm">
                                    Os clientes verão automaticamente a taxa de entrega ao informar seu endereço durante o pedido.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TaxasDeEntrega;