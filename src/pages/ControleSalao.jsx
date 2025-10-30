// src/pages/ControleSalao.jsx

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { toast } from 'react-toastify';
import MesaCard from "../components/MesaCard";
import AdicionarMesaModal from "../components/AdicionarMesaModal";

export default function ControleSalao() {
    const { estabelecimentoId } = useAuth();
    const [mesas, setMesas] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!estabelecimentoId) return;

        const mesasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'mesas');
        const q = query(mesasRef);

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            // Ordenação numérica
            data.sort((a, b) => 
                String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true })
            );
            
            setMesas(data);
            setLoading(false);
        });

        return () => unsub();
    }, [estabelecimentoId]);
    
    const handleAdicionarMesa = async (numeroMesa) => {
        const mesaJaExiste = mesas.some(
            (mesa) => String(mesa.numero).toLowerCase() === numeroMesa.toLowerCase()
        );

        if (mesaJaExiste) {
            toast.error(`❌ A mesa "${numeroMesa}" já existe!`);
            return;
        }

        try {
            const mesasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'mesas');
            await addDoc(mesasCollectionRef, { 
                numero: !isNaN(parseFloat(numeroMesa)) ? parseFloat(numeroMesa) : numeroMesa,
                status: 'livre', 
                total: 0,
                createdAt: new Date()
            });
            toast.success(`✅ Mesa "${numeroMesa}" adicionada com sucesso!`);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Erro ao adicionar mesa: ", error);
            toast.error("❌ Falha ao adicionar a mesa.");
        }
    };

    const handleExcluirMesa = async (mesaId, numeroMesa) => {
        if (!window.confirm(`Tem certeza que deseja excluir a Mesa ${numeroMesa}?`)) {
            return;
        }
        
        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            await deleteDoc(mesaRef);
            toast.success(`✅ Mesa ${numeroMesa} excluída com sucesso!`);
        } catch (error) {
            console.error("Erro ao excluir mesa:", error);
            toast.error("❌ Falha ao excluir a mesa.");
        }
    };

    // Estatísticas das mesas
    const estatisticas = {
        total: mesas.length,
        ocupadas: mesas.filter(mesa => mesa.status === 'ocupada').length,
        livres: mesas.filter(mesa => mesa.status === 'livre').length,
        comPedido: mesas.filter(mesa => mesa.status === 'com_pedido').length,
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando mesas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <AdicionarMesaModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleAdicionarMesa}
            />

            {/* Header */}
            <div className="flex-1 p-4 md:p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                        <div className="mb-4 lg:mb-0">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                Controle de Salão
                            </h1>
                            <p className="text-gray-600">
                                Gerencie mesas e pedidos do seu estabelecimento
                            </p>
                        </div>
                        
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Adicionar Mesa</span>
                        </button>
                    </div>

                    {/* Estatísticas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total de Mesas</p>
                                    <p className="text-2xl font-bold text-gray-900">{estatisticas.total}</p>
                                </div>
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <span className="text-blue-600 text-lg">🏪</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Mesas Livres</p>
                                    <p className="text-2xl font-bold text-green-600">{estatisticas.livres}</p>
                                </div>
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <span className="text-green-600 text-lg">✅</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Mesas Ocupadas</p>
                                    <p className="text-2xl font-bold text-orange-600">{estatisticas.ocupadas}</p>
                                </div>
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <span className="text-orange-600 text-lg">🔄</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Com Pedido</p>
                                    <p className="text-2xl font-bold text-red-600">{estatisticas.comPedido}</p>
                                </div>
                                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                    <span className="text-red-600 text-lg">📝</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Grid de Mesas */}
                    {mesas.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                            {mesas.map((mesa) => (
                                <MesaCard
                                    key={mesa.id}
                                    mesa={mesa}
                                    onClick={() => navigate(`/mesa/${mesa.id}`)}
                                    onExcluir={handleExcluirMesa}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">🏪</span>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Nenhuma mesa cadastrada
                            </h3>
                            <p className="text-gray-600 mb-6 max-w-md mx-auto">
                                Comece adicionando mesas para organizar seu salão e gerenciar pedidos.
                            </p>
                            <button 
                                onClick={() => setIsModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center space-x-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Adicionar Primeira Mesa</span>
                            </button>
                        </div>
                    )}

                    {/* Dica rápida */}
                    {mesas.length > 0 && (
                        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-white text-sm">💡</span>
                                </div>
                                <div>
                                    <p className="text-blue-800 font-medium">Dica rápida</p>
                                    <p className="text-blue-700 text-sm">
                                        Clique em uma mesa para ver detalhes e gerenciar pedidos. 
                                        Mesas com pedidos ativos aparecem em destaque.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Botão Voltar para Dashboard - NA PARTE INFERIOR */}
            <footer className="bg-white border-t border-gray-200 py-4">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex justify-center">
                        <Link 
                            to="/dashboard" 
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span>Voltar para Dashboard</span>
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}