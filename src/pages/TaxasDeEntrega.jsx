// src/pages/TaxasDeEntrega.jsx
import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase'; // Certifique-se de que o caminho para o seu firebase.js está correto
import { Link } from 'react-router-dom';

function TaxasDeEntrega() {
    const [bairros, setBairros] = useState([]);
    const [nomeBairro, setNomeBairro] = useState('');
    const [valorTaxa, setValorTaxa] = useState('');
    const [editingId, setEditingId] = useState(null); // Para controlar qual bairro está sendo editado
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const taxasCollectionRef = collection(db, 'taxasDeEntrega');

    // Função para buscar as taxas de entrega
    const getTaxas = async () => {
        setLoading(true);
        setError(null);
        try {
            const q = query(taxasCollectionRef, orderBy('nomeBairro'));
            const data = await getDocs(q);
            const fetchedBairros = data.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setBairros(fetchedBairros);
        } catch (err) {
            console.error("Erro ao buscar taxas de entrega:", err);
            setError("Erro ao carregar as taxas de entrega.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getTaxas();
    }, []);

    // Função para adicionar ou atualizar uma taxa
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!nomeBairro.trim() || valorTaxa === '') {
            setError("Por favor, preencha o nome do bairro e o valor da taxa.");
            return;
        }

        const valorNumerico = parseFloat(valorTaxa.replace(',', '.'));
        if (isNaN(valorNumerico) || valorNumerico < 0) {
            setError("Por favor, insira um valor numérico válido para a taxa.");
            return;
        }

        try {
            if (editingId) {
                // Atualizar
                const bairroDoc = doc(db, 'taxasDeEntrega', editingId);
                await updateDoc(bairroDoc, {
                    nomeBairro: nomeBairro.trim(),
                    valorTaxa: valorNumerico
                });
                alert("Taxa de entrega atualizada com sucesso!");
                setEditingId(null);
            } else {
                // Adicionar
                await addDoc(taxasCollectionRef, {
                    nomeBairro: nomeBairro.trim(),
                    valorTaxa: valorNumerico
                });
                alert("Taxa de entrega adicionada com sucesso!");
            }
            setNomeBairro('');
            setValorTaxa('');
            getTaxas(); // Recarrega a lista
        } catch (err) {
            console.error("Erro ao salvar taxa de entrega:", err);
            setError("Erro ao salvar a taxa de entrega. Tente novamente.");
        }
    };

    // Função para preencher o formulário para edição
    const handleEdit = (bairro) => {
        setEditingId(bairro.id);
        setNomeBairro(bairro.nomeBairro);
        setValorTaxa(bairro.valorTaxa.toFixed(2).replace('.', ',')); // Formata para exibição
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola para o topo do formulário
    };

    // Função para excluir uma taxa
    const handleDelete = async (id) => {
        if (window.confirm("Tem certeza que deseja excluir esta taxa de entrega?")) {
            setError(null);
            try {
                const bairroDoc = doc(db, 'taxasDeEntrega', id);
                await deleteDoc(bairroDoc);
                alert("Taxa de entrega excluída com sucesso!");
                getTaxas(); // Recarrega a lista
            } catch (err) {
                console.error("Erro ao excluir taxa de entrega:", err);
                setError("Erro ao excluir a taxa de entrega. Tente novamente.");
            }
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bege-claro)] p-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6 text-left">
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center px-4 py-2 bg-gray-200 text-[var(--marrom-escuro)] rounded-lg font-semibold hover:bg-gray-300 transition duration-300"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 0 010-1.414l4-4a1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Voltar para o Dashboard
                    </Link>
                </div>

                <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-8">
                    Gerenciar Taxas de Entrega
                </h1>

                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                    <h2 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-4">
                        {editingId ? 'Editar Taxa de Entrega' : 'Adicionar Nova Taxa de Entrega'}
                    </h2>
                    {error && <p className="text-red-600 mb-4">{error}</p>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="nomeBairro" className="block text-sm font-medium text-gray-700">Nome do Bairro</label>
                            <input
                                type="text"
                                id="nomeBairro"
                                value={nomeBairro}
                                onChange={(e) => setNomeBairro(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                                placeholder="Ex: Centro, Vila Nova"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="valorTaxa" className="block text-sm font-medium text-gray-700">Valor da Taxa (R$)</label>
                            <input
                                type="text" // Usar text para permitir formatação de moeda
                                id="valorTaxa"
                                value={valorTaxa}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/[^0-9,.]/g, ''); // Remove tudo exceto números, vírgula e ponto
                                    const parts = rawValue.split(',');
                                    if (parts.length > 2) { // Permite apenas uma vírgula
                                        setValorTaxa(parts[0] + ',' + parts.slice(1).join(''));
                                    } else {
                                        setValorTaxa(rawValue);
                                    }
                                }}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                                placeholder="Ex: 5,00 ou 7.50"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-red-700 transition duration-300 font-semibold"
                        >
                            {editingId ? 'Salvar Edição' : 'Adicionar Taxa'}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingId(null);
                                    setNomeBairro('');
                                    setValorTaxa('');
                                    setError(null);
                                }}
                                className="w-full mt-2 bg-red-500 text-white py-2 px-4 rounded-md hover:bg-gray-500 transition duration-300 font-semibold"
                            >
                                Cancelar Edição
                            </button>
                        )}
                    </form>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-4">
                        Taxas de Entrega Cadastradas
                    </h2>
                    {loading ? (
                        <p className="text-center text-gray-500">Carregando taxas...</p>
                    ) : bairros.length === 0 ? (
                        <p className="text-center text-gray-500 italic">Nenhuma taxa de entrega cadastrada ainda.</p>
                    ) : (
                        <ul className="divide-y divide-gray-200">
                            {bairros.map((bairro) => (
                                <li key={bairro.id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <p className="text-lg font-medium text-[var(--marrom-escuro)]">{bairro.nomeBairro}</p>
                                        <p className="text-sm text-gray-600">R$ {bairro.valorTaxa.toFixed(2).replace('.', ',')}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleEdit(bairro)}
                                            className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition duration-300"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(bairro.id)}
                                            className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition duration-300"
                                        >
                                            Excluir
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TaxasDeEntrega;