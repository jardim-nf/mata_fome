import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext'; // 1. Importar o useAuth

// Ícones para a interface
import { IoArrowBack, IoAddCircleOutline, IoPencil, IoTrash, IoCloseCircleOutline } from 'react-icons/io5';

function TaxasDeEntrega() {
    // 2. Obter o ID do estabelecimento do admin logado
    const { estabelecimentoId, currentUser, isAdmin, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [bairros, setBairros] = useState([]);
    const [nomeBairro, setNomeBairro] = useState('');
    const [valorTaxa, setValorTaxa] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Controle de acesso
    useEffect(() => {
        if (!authLoading && (!currentUser || !isAdmin)) {
            toast.error('Acesso negado.');
            navigate('/login-admin');
        }
    }, [currentUser, isAdmin, authLoading, navigate]);

    // Função para buscar as taxas de entrega do estabelecimento correto
    const getTaxas = async () => {
        // Só executa se o ID do estabelecimento estiver disponível
        if (!estabelecimentoId) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        try {
            // 3. Usar o caminho correto para a subcoleção
            const taxasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega');
            const q = query(taxasCollectionRef, orderBy('nomeBairro'));
            const data = await getDocs(q);
            const fetchedBairros = data.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setBairros(fetchedBairros);
        } catch (err) {
            console.error("Erro ao buscar taxas:", err);
            toast.error("Erro ao carregar as taxas de entrega.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Garante que só busca as taxas quando tiver o ID do estabelecimento
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
            toast.warn("Por favor, preencha todos os campos.");
            return;
        }
        const valorNumerico = parseFloat(valorTaxa.replace(',', '.'));
        if (isNaN(valorNumerico) || valorNumerico < 0) {
            toast.warn("Por favor, insira um valor de taxa válido.");
            return;
        }
        try {
            const taxasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega');

            if (editingId) {
                // Atualizar no caminho correto
                const bairroDoc = doc(taxasCollectionRef, editingId);
                await updateDoc(bairroDoc, { nomeBairro: nomeBairro.trim(), valorTaxa: valorNumerico });
                toast.success("Taxa atualizada com sucesso!");
            } else {
                // Adicionar no caminho correto
                await addDoc(taxasCollectionRef, { nomeBairro: nomeBairro.trim(), valorTaxa: valorNumerico });
                toast.success("Nova taxa adicionada com sucesso!");
            }
            clearForm();
            getTaxas(); // Recarrega a lista
        } catch (err) {
            console.error("Erro ao salvar taxa:", err);
            toast.error("Erro ao salvar a taxa.");
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
            // Usa o caminho correto para deletar
            const taxaDocRef = doc(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega', id);
            await deleteDoc(taxaDocRef);
            toast.success(`Taxa para "${nome}" foi excluída.`);
            getTaxas(); // Recarrega a lista após a exclusão
        } catch (err) {
            console.error("Erro ao excluir taxa:", err);
            toast.error("Erro ao excluir a taxa.");
        }
    };

    toast.warning(
        ({ closeToast }) => (
            <div>
                <p className="font-semibold">Confirmar exclusão?</p>
                <p className="text-sm">Deseja realmente excluir a taxa para "{nome}"?</p>
                <div className="flex justify-end mt-2 space-x-2">
                    <button onClick={closeToast} className="px-3 py-1 text-sm bg-gray-500 text-white rounded">Cancelar</button>
                    <button 
                        onClick={() => { 
                            confirmDelete(); 
                            closeToast(); 
                        }} 
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded"
                    >
                        Excluir
                    </button>
                </div>
            </div>
        ), {
            position: "top-center",
            autoClose: false,
            closeOnClick: false,
            draggable: false
        }
    );
};
    if (loading || authLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Carregando Taxas de Entrega...</div>;
    }

    return (
        <div className="bg-gray-900 min-h-screen p-4 sm:p-6 text-white">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-amber-400">Taxas de Entrega</h1>
                    <Link to="/dashboard" className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                        <IoArrowBack />
                        <span>Voltar ao Dashboard</span>
                    </Link>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8">
                    <h2 className="text-xl font-semibold text-amber-400 mb-4 flex items-center">
                        {editingId ? <IoPencil className="mr-2" /> : <IoAddCircleOutline className="mr-2" />}
                        {editingId ? 'Editar Taxa' : 'Adicionar Nova Taxa'}
                    </h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="nomeBairro" className="block text-sm font-medium text-gray-300">Nome do Bairro</label>
                                <input
                                    type="text"
                                    id="nomeBairro"
                                    value={nomeBairro}
                                    onChange={(e) => setNomeBairro(e.target.value)}
                                    className="mt-1 bg-gray-700 text-white block w-full rounded-md border-gray-600 shadow-sm p-2"
                                    placeholder="Ex: Centro"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="valorTaxa" className="block text-sm font-medium text-gray-300">Valor da Taxa (R$)</label>
                                <input
                                    type="text"
                                    id="valorTaxa"
                                    value={valorTaxa}
                                    onChange={(e) => setValorTaxa(e.target.value.replace(/[^0-9,]/g, ''))}
                                    className="mt-1 bg-gray-700 text-white block w-full rounded-md border-gray-600 shadow-sm p-2"
                                    placeholder="Ex: 5,00"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex flex-col space-y-2">
                            <button
                                type="submit"
                                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                {editingId ? 'Salvar Alterações' : 'Adicionar Taxa'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={clearForm}
                                    className="w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <IoCloseCircleOutline />
                                    Cancelar Edição
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold text-amber-400 mb-4">Taxas Cadastradas</h2>
                    <ul className="divide-y divide-gray-700">
                        {bairros.length > 0 ? bairros.map((bairro) => (
                            <li key={bairro.id} className="py-3 flex justify-between items-center">
                                <div>
                                    <p className="text-lg font-medium text-gray-200">{bairro.nomeBairro}</p>
                                    <p className="text-sm text-green-400">{bairro.valorTaxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleEdit(bairro)}
                                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                                        aria-label="Editar"
                                    >
                                        <IoPencil />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(bairro.id, bairro.nomeBairro)}
                                        className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                                        aria-label="Excluir"
                                    >
                                        <IoTrash />
                                    </button>
                                </div>
                            </li>
                        )) : (
                            <p className="text-center text-gray-500 py-10">Nenhuma taxa de entrega cadastrada ainda.</p>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default TaxasDeEntrega;