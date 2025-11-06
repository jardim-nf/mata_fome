// src/pages/ControleSalao.jsx

import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, updateDoc, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { toast } from 'react-toastify';
import MesaCard from "../components/MesaCard";
import AdicionarMesaModal from "../components/AdicionarMesaModal";
import ModalPagamento from "../components/ModalPagamento";

export default function ControleSalao() {
    // Usa o ID principal exposto no AuthContext
    const { estabelecimentoIdPrincipal } = useAuth(); 
    
    const [mesas, setMesas] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mesaParaPagamento, setMesaParaPagamento] = useState(null);
    const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // 1. Se não houver um ID principal, pare o carregamento.
        if (!estabelecimentoIdPrincipal) {
            setMesas([]);
            setLoading(false); 
            return; 
        }

        // 2. Lógica do Listener
        const mesasRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'mesas');
        const q = query(mesasRef, orderBy('numero'));

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
        }, (error) => {
             console.error("Erro ao carregar mesas (onSnapshot):", error);
             toast.error("Falha ao carregar mesas. Verifique suas regras de segurança.");
             setLoading(false);
        });

        return () => unsub();
    }, [estabelecimentoIdPrincipal]); 
    
    // --- FUNÇÃO 1: Adicionar Mesa ---
    const handleAdicionarMesa = async (numeroMesa) => {
        if (!estabelecimentoIdPrincipal) {
            toast.error("Estabelecimento não identificado.");
            return;
        }
        const mesaJaExiste = mesas.some(
            (mesa) => String(mesa.numero).toLowerCase() === numeroMesa.toLowerCase()
        );

        if (mesaJaExiste) {
            toast.error(`❌ A mesa "${numeroMesa}" já existe!`);
            return;
        }

        try {
            const mesasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'mesas');
            await addDoc(mesasCollectionRef, { 
                numero: !isNaN(parseFloat(numeroMesa)) ? parseFloat(numeroMesa) : numeroMesa,
                status: 'livre', 
                total: 0,
                itens: [],
                createdAt: new Date()
            });
            toast.success(`✅ Mesa "${numeroMesa}" adicionada com sucesso!`);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Erro ao adicionar mesa: ", error);
            toast.error("❌ Falha ao adicionar a mesa.");
        }
    };

    // --- FUNÇÃO 2: Excluir Mesa ---
    const handleExcluirMesa = async (mesaId, numeroMesa) => {
        if (!window.confirm(`Tem certeza que deseja excluir a Mesa ${numeroMesa}?`)) {
            return;
        }
        
        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'mesas', mesaId);
            await deleteDoc(mesaRef);
            toast.success(`✅ Mesa ${numeroMesa} excluída com sucesso!`);
        } catch (error) {
            console.error("Erro ao excluir mesa:", error);
            toast.error("❌ Falha ao excluir a mesa.");
        }
    };

    // --- FUNÇÃO 3: ABRIR MODAL DE PAGAMENTO ---
    const handleAbrirPagamento = (mesa) => {
        setMesaParaPagamento(mesa);
        setIsModalPagamentoOpen(true);
    };

// NO ControleSalao.jsx - Substitua a função handleConfirmarPagamento:

const handleConfirmarPagamento = async (mesaId, formaPagamento) => {
  try {
    console.log("💰 DEBUG - Iniciando pagamento...");

    const mesaRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'mesas', mesaId);
    
    // Liberar a mesa
    await updateDoc(mesaRef, {
      status: 'livre',
      total: 0,
      itens: [],
      encerradaEm: new Date()
    });

    // Criar a venda
    const vendasRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'vendas');
    const vendaDoc = await addDoc(vendasRef, {
      mesaNumero: mesaParaPagamento.numero,
      mesaId: mesaId,
      total: mesaParaPagamento.total,
      itens: mesaParaPagamento.itens || [],
      formaPagamento: formaPagamento,
      dataFechamento: new Date(),
      createdAt: new Date(),
      tipo: 'salao', // 🆕 IMPORTANTE: Identificar que é venda do salão
      status: 'finalizada'
    });

    console.log("✅ DEBUG - Venda criada com ID:", vendaDoc.id);
    console.log("📊 DEBUG - Dados da venda:", {
      mesaNumero: mesaParaPagamento.numero,
      total: mesaParaPagamento.total,
      formaPagamento: formaPagamento,
      tipo: 'salao'
    });

    toast.success(`✅ Pagamento da Mesa ${mesaParaPagamento.numero} confirmado!`);
    
    setIsModalPagamentoOpen(false);
    setMesaParaPagamento(null);
    
  } catch (error) {
    console.error("❌ Erro ao processar pagamento:", error);
    toast.error("❌ Falha ao processar pagamento.");
  }
};

    // Estatísticas das mesas
    const estatisticas = {
        total: mesas.length,
        ocupadas: mesas.filter(mesa => mesa.status === 'ocupada').length,
        livres: mesas.filter(mesa => mesa.status === 'livre').length,
        comPedido: mesas.filter(mesa => mesa.status === 'com_pedido').length,
        aguardandoPagamento: mesas.filter(mesa => mesa.status === 'pagamento').length,
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

            <ModalPagamento
                isOpen={isModalPagamentoOpen}
                onClose={() => {
                    setIsModalPagamentoOpen(false);
                    setMesaParaPagamento(null);
                }}
                mesa={mesaParaPagamento}
                onConfirmarPagamento={handleConfirmarPagamento}
            />

            {/* Header e Estatísticas */}
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Aguardando Pagamento</p>
                                    <p className="text-2xl font-bold text-purple-600">{estatisticas.aguardandoPagamento}</p>
                                </div>
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <span className="text-purple-600 text-lg">💰</span>
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
                                    onPagar={() => handleAbrirPagamento(mesa)}
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
                            <span>Voltar para o Dashboard</span>
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}