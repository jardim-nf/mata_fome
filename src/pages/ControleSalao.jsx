// src/pages/ControleSalao.jsx - COMPLETO E ATUALIZADO

import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, updateDoc, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { toast } from 'react-toastify';
import MesaCard from "../components/MesaCard";
import AdicionarMesaModal from "../components/AdicionarMesaModal";
import ModalPagamento from "../components/ModalPagamento";

export default function ControleSalao() {
    const { userData } = useAuth(); 
    
    const [mesas, setMesas] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mesaParaPagamento, setMesaParaPagamento] = useState(null);
    const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(false);
    
    const navigate = useNavigate();
    const unsubscribeRef = useRef(null);
    const estabelecimentoIdRef = useRef(null);

    // 🎯 Obter o ID do estabelecimento dos estabelecimentosGerenciados
    const estabelecimentoId = React.useMemo(() => {
        if (!userData?.estabelecimentosGerenciados || userData.estabelecimentosGerenciados.length === 0) {
            console.log("❌ Nenhum estabelecimento gerenciado encontrado");
            return null;
        }
        
        const primeiroEstabelecimento = userData.estabelecimentosGerenciados[0];
        console.log("🏪 Estabelecimento gerenciado encontrado:", primeiroEstabelecimento);
        return primeiroEstabelecimento;
    }, [userData]);

    useEffect(() => {
        if (estabelecimentoId === estabelecimentoIdRef.current) {
            console.log("🔄 EstabelecimentoId não mudou, mantendo listener atual");
            return;
        }

        if (unsubscribeRef.current) {
            console.log("🧹 Cleanup: removendo listener anterior...");
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }

        if (!estabelecimentoId) {
            console.log("❌ Sem estabelecimentoId");
            setMesas([]);
            setLoading(false); 
            estabelecimentoIdRef.current = null;
            return; 
        }

        console.log("🎯 Iniciando NOVO listener para estabelecimento:", estabelecimentoId);
        setLoading(true);
        setConnectionError(false);
        estabelecimentoIdRef.current = estabelecimentoId;

        const mesasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'mesas');
        const q = query(mesasRef, orderBy('numero'));

        try {
            const unsub = onSnapshot(q, 
                (snapshot) => {
                    if (estabelecimentoId !== estabelecimentoIdRef.current) {
                        console.log("🔄 Ignorando dados de estabelecimento antigo");
                        return;
                    }

                    console.log("📦 Dados recebidos:", snapshot.docs.length, "mesas");
                    const data = snapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));

                    data.sort((a, b) => 
                        String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true })
                    );
                    
                    setMesas(data);
                    setLoading(false);
                    setConnectionError(false);
                }, 
                (error) => {
                    if (estabelecimentoId !== estabelecimentoIdRef.current) {
                        console.log("🔄 Ignorando erro de estabelecimento antigo");
                        return;
                    }

                    console.error("❌ Erro crítico no listener:", error);
                    setConnectionError(true);
                    setLoading(false);
                    
                    if (error.code === 'failed-precondition') {
                        toast.error("❌ Erro de permissão. Verifique as regras do Firestore.");
                    } else if (error.code === 'unavailable') {
                        toast.error("🌐 Problema de conexão. Verifique sua internet.");
                    } else {
                        toast.error("❌ Falha ao carregar mesas.");
                    }
                }
            );

            unsubscribeRef.current = unsub;

        } catch (error) {
            console.error("❌ Erro ao configurar listener:", error);
            setConnectionError(true);
            setLoading(false);
            toast.error("❌ Erro ao conectar com o servidor.");
        }

        return () => {
            console.log("🔧 Setup completo - listener ativo");
        };
    }, [estabelecimentoId]); 

    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) {
                console.log("🧹🧹🧹 DESMONTAGEM: Removendo listener global");
                unsubscribeRef.current();
                unsubscribeRef.current = null;
                estabelecimentoIdRef.current = null;
            }
        };
    }, []);

    // --- FUNÇÕES ---
    const handleAdicionarMesa = async (numeroMesa) => {
        if (!estabelecimentoId) {
            toast.error("Estabelecimento não identificado.");
            return;
        }

        if (!numeroMesa || numeroMesa.trim() === '') {
            toast.error("❌ Digite um número/nome para a mesa.");
            return;
        }

        const mesaJaExiste = mesas.some(
            (mesa) => String(mesa.numero).toLowerCase() === numeroMesa.toLowerCase().trim()
        );

        if (mesaJaExiste) {
            toast.error(`❌ A mesa "${numeroMesa}" já existe!`);
            return;
        }

        try {
            console.log("➕ Adicionando mesa:", numeroMesa);
            
            const mesasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'mesas');
            await addDoc(mesasCollectionRef, { 
                numero: !isNaN(parseFloat(numeroMesa)) ? parseFloat(numeroMesa) : numeroMesa.trim(),
                status: 'livre', 
                total: 0,
                itens: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            toast.success(`✅ Mesa "${numeroMesa}" adicionada com sucesso!`);
            setIsModalOpen(false);
            
        } catch (error) {
            console.error("❌ Erro ao adicionar mesa:", error);
            
            if (error.code === 'permission-denied') {
                toast.error("❌ Sem permissão para adicionar mesas.");
            } else if (error.code === 'unavailable') {
                toast.error("🌐 Sem conexão. Tente novamente.");
            } else {
                toast.error("❌ Falha ao adicionar a mesa.");
            }
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
            console.error("❌ Erro ao excluir mesa:", error);
            toast.error("❌ Falha ao excluir a mesa.");
        }
    };

    const handleAbrirPagamento = (mesa) => {
        setMesaParaPagamento(mesa);
        setIsModalPagamentoOpen(true);
    };

    const handleAbrirMesa = (mesa) => {
        // 🔑 ROTA COMPLETA: /estabelecimento/:estabelecimentoId/mesa/:mesaId
        navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesa.id}`);
    };

    const handleConfirmarPagamento = async (mesaId, formaPagamento) => {
      try {
        console.log("💰 Processando pagamento para mesa:", mesaId);

        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
        
        await updateDoc(mesaRef, {
          status: 'livre',
          total: 0,
          itens: [],
          encerradaEm: new Date(),
          updatedAt: new Date()
        });

        if (mesaParaPagamento.itens && mesaParaPagamento.itens.length > 0) {
            const vendasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'vendas');
            await addDoc(vendasRef, {
              mesaNumero: mesaParaPagamento.numero,
              mesaId: mesaId,
              total: mesaParaPagamento.total,
              itens: mesaParaPagamento.itens || [],
              formaPagamento: formaPagamento,
              dataFechamento: new Date(),
              // 🔑 CAMPO CRÍTICO ADICIONADO: Usado para o filtro do Dashboard
              dataFechamentoString: new Date().toISOString().split('T')[0], // YYYY-MM-DD
              createdAt: new Date(),
              tipo: 'salao',
              status: 'finalizada'
            });
        }

        toast.success(`✅ Pagamento da Mesa ${mesaParaPagamento.numero} confirmado!`);
        
        setIsModalPagamentoOpen(false);
        setMesaParaPagamento(null);
        
      } catch (error) {
        console.error("❌ Erro ao processar pagamento:", error);
        toast.error("❌ Falha ao processar pagamento.");
      }
    };

    const handleRetryConnection = () => {
        setConnectionError(false);
        setLoading(true);
        estabelecimentoIdRef.current = null;
    };

    // 📊 ESTATÍSTICAS COMPLETAS
    const estatisticas = {
        total: mesas.length,
        ocupadas: mesas.filter(mesa => mesa.status === 'ocupada').length,
        livres: mesas.filter(mesa => mesa.status === 'livre').length,
        comPedido: mesas.filter(mesa => mesa.status === 'com_pedido').length,
        aguardandoPagamento: mesas.filter(mesa => mesa.status === 'pagamento').length,
        valorTotalVendas: mesas.reduce((total, mesa) => total + (mesa.total || 0), 0),
        mesasComItens: mesas.filter(mesa => mesa.itens && mesa.itens.length > 0).length,
        totalItens: mesas.reduce((total, mesa) => total + (mesa.itens?.length || 0), 0)
    };

    // 📈 Cálculo de percentuais
    const percentuais = {
        ocupacao: estatisticas.total > 0 ? ((estatisticas.ocupadas + estatisticas.comPedido + estatisticas.aguardandoPagamento) / estatisticas.total * 100).toFixed(1) : 0,
        disponibilidade: estatisticas.total > 0 ? (estatisticas.livres / estatisticas.total * 100).toFixed(1) : 0
    };

    // 🎨 Configurações visuais para estatísticas
    const getStatConfig = (key) => {
        const configs = {
            total: { 
                icon: '🏪', 
                color: 'blue', 
                bgColor: 'bg-blue-50', 
                textColor: 'text-blue-600',
                borderColor: 'border-blue-200'
            },
            livres: { 
                icon: '✅', 
                color: 'green', 
                bgColor: 'bg-green-50', 
                textColor: 'text-green-600',
                borderColor: 'border-green-200'
            },
            ocupadas: { 
                icon: '🔄', 
                color: 'orange', 
                bgColor: 'bg-orange-50', 
                textColor: 'text-orange-600',
                borderColor: 'border-orange-200'
            },
            comPedido: { 
                icon: '📝', 
                color: 'red', 
                bgColor: 'bg-red-50', 
                textColor: 'text-red-600',
                borderColor: 'border-red-200'
            },
            aguardandoPagamento: { 
                icon: '💰', 
                color: 'purple', 
                bgColor: 'bg-purple-50', 
                textColor: 'text-purple-600',
                borderColor: 'border-purple-200'
            },
            valorTotalVendas: { 
                icon: '💵', 
                color: 'emerald', 
                bgColor: 'bg-emerald-50', 
                textColor: 'text-emerald-600',
                borderColor: 'border-emerald-200'
            }
        };
        return configs[key] || configs.total;
    };

    // ... (Código para renderizar tela de erro e loading)

    if (connectionError) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">❌</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Erro de Conexão
                    </h3>
                    <p className="text-gray-600 mb-6">
                        Não foi possível conectar com o servidor. Verifique sua internet e tente novamente.
                    </p>
                    <button 
                        onClick={handleRetryConnection}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors w-full"
                    >
                        🔄 Tentar Novamente
                    </button>
                    <Link 
                        to="/dashboard" 
                        className="block mt-3 text-blue-600 hover:text-blue-700 font-medium"
                    >
                        ← Voltar ao Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (!estabelecimentoId && !loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🏪</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Nenhum Estabelecimento Configurado
                    </h3>
                    <p className="text-gray-600 mb-6">
                        Você precisa ter um estabelecimento configurado para gerenciar o salão.
                    </p>
                    <Link 
                        to="/dashboard" 
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors w-full block"
                    >
                        ← Voltar ao Dashboard
                    </Link>
                </div>
            </div>
        );
    }

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
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link 
                                to="/dashboard" 
                                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200 flex items-center justify-center space-x-2"
                            >
                                <span>← Voltar</span>
                            </Link>
                            
                            <button 
                                onClick={() => setIsModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200 flex items-center justify-center space-x-2"
                                disabled={connectionError}
                            >
                                <span>+</span>
                                <span>Adicionar Mesa</span>
                            </button>
                        </div>
                    </div>

                    {/* 📊 ESTATÍSTICAS COMPLETAS */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Estatísticas do Salão</h2>
                        
                        {/* Grid Principal de Estatísticas */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                            {[
                                { key: 'total', label: 'Total Mesas', value: estatisticas.total },
                                { key: 'livres', label: 'Mesas Livres', value: estatisticas.livres },
                                { key: 'ocupadas', label: 'Ocupadas', value: estatisticas.ocupadas },
                                { key: 'comPedido', label: 'Com Pedido', value: estatisticas.comPedido },
                                { key: 'aguardandoPagamento', label: 'Pagamento', value: estatisticas.aguardandoPagamento },
                                { key: 'valorTotalVendas', label: 'Valor Total', value: estatisticas.valorTotalVendas, format: 'currency' }
                            ].map((stat) => {
                                const config = getStatConfig(stat.key);
                                const displayValue = stat.format === 'currency' 
                                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stat.value)
                                    : stat.value;
                                
                                return (
                                    <div 
                                        key={stat.key}
                                        className={`bg-white rounded-lg shadow-sm border ${config.borderColor} p-4 transition-all hover:shadow-md`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                                                <p className={`text-2xl font-bold ${config.textColor}`}>
                                                    {displayValue}
                                                </p>
                                            </div>
                                            <div className={`w-12 h-12 ${config.bgColor} rounded-lg flex items-center justify-center`}>
                                                <span className="text-xl">{config.icon}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Estatísticas Secundárias */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Taxa de Ocupação</p>
                                        <p className="text-2xl font-bold text-blue-600">{percentuais.ocupacao}%</p>
                                    </div>
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <span className="text-blue-600">📊</span>
                                    </div>
                                </div>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                                        style={{ width: `${percentuais.ocupacao}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Disponibilidade</p>
                                        <p className="text-2xl font-bold text-green-600">{percentuais.disponibilidade}%</p>
                                    </div>
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                        <span className="text-green-600">🟢</span>
                                    </div>
                                </div>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className="bg-green-600 h-2 rounded-full transition-all duration-500" 
                                        style={{ width: `${percentuais.disponibilidade}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Mesas com Itens</p>
                                        <p className="text-2xl font-bold text-orange-600">{estatisticas.mesasComItens}</p>
                                    </div>
                                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                        <span className="text-orange-600">🍽️</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {estatisticas.totalItens} itens no total
                                </p>
                            </div>

                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Status Geral</p>
                                        <p className={`text-lg font-bold ${
                                            percentuais.ocupacao > 80 ? 'text-red-600' : 
                                            percentuais.ocupacao > 50 ? 'text-orange-600' : 'text-green-600'
                                        }`}>
                                            {percentuais.ocupacao > 80 ? 'LOTADO' : 
                                             percentuais.ocupacao > 50 ? 'MODERADO' : 'TRANQUILO'}
                                        </p>
                                    </div>
                                    <div className={`w-10 h-10 ${
                                        percentuais.ocupacao > 80 ? 'bg-red-100' : 
                                        percentuais.ocupacao > 50 ? 'bg-orange-100' : 'bg-green-100'
                                    } rounded-lg flex items-center justify-center`}>
                                        <span className={
                                            percentuais.ocupacao > 80 ? 'text-red-600' : 
                                            percentuais.ocupacao > 50 ? 'text-orange-600' : 'text-green-600'
                                        }>
                                            {percentuais.ocupacao > 80 ? '🔥' : 
                                             percentuais.ocupacao > 50 ? '⚠️' : '😊'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 🎯 GRID DE MESAS */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">🎯 Mesas do Salão</h2>
                            <span className="text-sm text-gray-500">
                                {mesas.length} mesa{mesas.length !== 1 ? 's' : ''} encontrada{mesas.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {mesas.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                                {mesas.map((mesa) => (
                                    <MesaCard
                                        key={mesa.id}
                                        mesa={mesa}
                                        onClick={() => handleAbrirMesa(mesa)}
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
                                    <span>+</span>
                                    <span>Adicionar Primeira Mesa</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 📱 RESUMO MOBILE */}
                    <div className="lg:hidden bg-white rounded-lg border border-gray-200 p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">📋 Resumo Rápido</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="text-center">
                                <p className="text-gray-600">Ocupação</p>
                                <p className="font-bold text-blue-600">{percentuais.ocupacao}%</p>
                            </div>
                            <div className="text-center">
                                <p className="text-gray-600">Disponível</p>
                                <p className="font-bold text-green-600">{percentuais.disponibilidade}%</p>
                            </div>
                            <div className="text-center">
                                <p className="text-gray-600">Valor Total</p>
                                <p className="font-bold text-emerald-600">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estatisticas.valorTotalVendas)}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-gray-600">Status</p>
                                <p className={`font-bold ${
                                    percentuais.ocupacao > 80 ? 'text-red-600' : 
                                    percentuais.ocupacao > 50 ? 'text-orange-600' : 'text-green-600'
                                }`}>
                                    {percentuais.ocupacao > 80 ? 'LOTADO' : 
                                     percentuais.ocupacao > 50 ? 'MODERADO' : 'TRANQUILO'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}