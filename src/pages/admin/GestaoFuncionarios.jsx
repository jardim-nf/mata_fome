// src/pages/admin/GestaoFuncionarios.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { 
    getFuncionarios, 
    addFuncionario,
    updateFuncionario, 
    excluirFuncionarioPermanentemente,
    verificarEmailExistente
} from "../../services/firebaseFuncionarios";
import { serverTimestamp } from "firebase/firestore";

// Import dos ícones
import { FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaUserPlus, FaExclamationTriangle } from 'react-icons/fa';

const GestaoFuncionarios = () => {
    const { userData } = useAuth();
    const [funcionarios, setFuncionarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [funcionarioEditando, setFuncionarioEditando] = useState(null);
    const [funcionarioParaExcluir, setFuncionarioParaExcluir] = useState(null);
    const [loadingAction, setLoadingAction] = useState('');

    // 🔥 GARANTE O ID DO ESTABELECIMENTO
    const estabelecimentoPrincipal = userData?.estabelecimentos?.[0] || userData?.estabelecimentosGerenciados?.[0] || null;
    const estabelecimentoId = estabelecimentoPrincipal;

    const cargos = [
        "Gerente", "Garçom", "Caixa", "Cozinheiro", "Atendente", "Entregador", "Auxiliar"
    ];

    const permissoesDisponiveis = [
        { key: "painel", label: "Painel de Pedidos" },
        { key: "controle-salao", label: "Controle de Salão" },
        { key: "visualizar-cardapio", label: "Visualizar Cardápio" },
        { key: "relatorios", label: "Relatórios" },
        { key: "estoque", label: "Controle de Estoque" },
        { key: "financeiro", label: "Acesso Financeiro" }
    ];

    // Carregar funcionários
    const carregarFuncionarios = async () => {
        if (!estabelecimentoId) {
            console.error('❌ Estabelecimento ID não encontrado');
            setLoading(false);
            return;
        }
        
        try {
            setLoading(true);
            const dados = await getFuncionarios(estabelecimentoId);
            setFuncionarios(dados);
        } catch (error) {
            console.error('❌ Erro ao carregar funcionários:', error);
            alert('Erro ao carregar funcionários: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarFuncionarios();
    }, [estabelecimentoId]);

    // Adicionar/Editar funcionário
    const salvarFuncionario = async (funcionarioData) => {
        if (!estabelecimentoId) {
            alert('Erro: Estabelecimento não identificado');
            return;
        }

        setLoadingAction('salvando');

        try {
            // Verificar se email já existe (apenas para novos funcionários)
            if (!funcionarioEditando) {
                const emailExiste = await verificarEmailExistente(estabelecimentoId, funcionarioData.email);
                if (emailExiste) {
                    alert('❌ Já existe um funcionário com este email no estabelecimento.');
                    setLoadingAction('');
                    return;
                }
            }

            // 🔥 PREPARA OS DADOS PARA SALVAR
            const dadosParaSalvar = {
                ...funcionarioData,
                // Garante que o ID do estabelecimento esteja salvo no perfil do funcionário
                estabelecimentoId: estabelecimentoId, 
                // Também salva como array para compatibilidade futura
                estabelecimentosGerenciados: [estabelecimentoId],
                updatedAt: serverTimestamp()
            };

            if (funcionarioEditando) {
                // Modo Edição
                await updateFuncionario(estabelecimentoId, funcionarioEditando.id, dadosParaSalvar);
                alert('✅ Funcionário atualizado com sucesso!');
            } else {
                // Modo Adição (Adiciona Data de Criação)
                dadosParaSalvar.createdAt = serverTimestamp();
                await addFuncionario(estabelecimentoId, dadosParaSalvar);
                alert('✅ Funcionário adicionado com sucesso!');
            }
            
            carregarFuncionarios();
            setShowModal(false);
            setFuncionarioEditando(null);
        } catch (error) {
            console.error('❌ Erro ao salvar funcionário:', error);
            alert('❌ ' + error.message);
        } finally {
            setLoadingAction('');
        }
    };

    // Alternar status
    const toggleStatus = async (funcionario) => {
        if (!estabelecimentoId) {
            alert('Erro: Estabelecimento não identificado');
            return;
        }

        setLoadingAction('toggle-' + funcionario.id);

        try {
            const novoStatus = funcionario.status === "ativo" ? "inativo" : "ativo";
            await updateFuncionario(estabelecimentoId, funcionario.id, { 
                status: novoStatus 
            });
            alert(`✅ Funcionário ${novoStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`);
            carregarFuncionarios();
        } catch (error) {
            alert('❌ Erro ao alterar status: ' + error.message);
        } finally {
            setLoadingAction('');
        }
    };

    // Excluir funcionário
    const excluirFuncionarioHandler = async (funcionario) => {
        setLoadingAction('excluindo-' + funcionario.id);

        try {
            await excluirFuncionarioPermanentemente(estabelecimentoId, funcionario.id);
            alert('✅ Funcionário excluído com sucesso!');
            carregarFuncionarios();
            setFuncionarioParaExcluir(null);
        } catch (error) {
            alert('❌ Erro ao excluir funcionário: ' + error.message);
        } finally {
            setLoadingAction('');
        }
    };

    // Abrir modal de adição
    const handleOpenAddModal = () => {
        setFuncionarioEditando(null);
        setShowModal(true);
    };

    if (!estabelecimentoId) {
        return (
            <div className="text-center p-10 text-gray-600">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-2">Aguardando ID do estabelecimento...</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="text-center p-10">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando funcionários...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                
                {/* Cabeçalho e Botão de Adicionar */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Gestão de Funcionários</h1>
                    <button
                        onClick={handleOpenAddModal}
                        disabled={loadingAction === 'salvando'}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loadingAction === 'salvando' ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <FaUserPlus />
                        )}
                        Adicionar Funcionário
                    </button>
                </div>
                
                {/* Cards de Estatísticas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-lg font-semibold text-gray-900">Total</h3>
                        <p className="text-3xl font-bold text-blue-600">{funcionarios.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-lg font-semibold text-gray-900">Ativos</h3>
                        <p className="text-3xl font-bold text-green-600">
                            {funcionarios.filter(f => f.status === "ativo").length}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-lg font-semibold text-gray-900">Inativos</h3>
                        <p className="text-3xl font-bold text-red-600">
                            {funcionarios.filter(f => f.status === "inativo").length}
                        </p>
                    </div>
                </div>

                {/* Lista de Funcionários */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {funcionarios.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">👥</div>
                            <p className="text-gray-500 text-lg mb-2">Nenhum funcionário cadastrado</p>
                            <p className="text-gray-400 text-sm mb-4">Comece adicionando o primeiro funcionário da sua equipe</p>
                            <button
                                onClick={handleOpenAddModal}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto transition-colors"
                            >
                                <FaUserPlus />
                                Adicionar Primeiro Funcionário
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Funcionário
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Cargo
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Permissões
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {funcionarios.map((funcionario) => (
                                        <tr key={funcionario.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {funcionario.nome}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {funcionario.email}
                                                    </div>
                                                    {funcionario.telefone && (
                                                        <div className="text-sm text-gray-400">
                                                            {funcionario.telefone}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                                                    {funcionario.cargo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        funcionario.status === "ativo"
                                                            ? "bg-green-100 text-green-800"
                                                            : "bg-red-100 text-red-800"
                                                    }`}
                                                >
                                                    {funcionario.status === "ativo" ? "Ativo" : "Inativo"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {(funcionario.permissoes || []).map(permissao => (
                                                        <span
                                                            key={permissao}
                                                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                                                        >
                                                            {permissoesDisponiveis.find(p => p.key === permissao)?.label || permissao}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex gap-2">
                                                    {/* Botão Ativar/Desativar */}
                                                    <button
                                                        onClick={() => toggleStatus(funcionario)}
                                                        disabled={loadingAction === 'toggle-' + funcionario.id}
                                                        className={`p-2 rounded transition-colors ${
                                                            funcionario.status === "ativo"
                                                                ? "text-red-600 hover:bg-red-50"
                                                                : "text-green-600 hover:bg-green-50"
                                                        } disabled:opacity-50`}
                                                        title={funcionario.status === "ativo" ? "Desativar" : "Ativar"}
                                                    >
                                                        {loadingAction === 'toggle-' + funcionario.id ? (
                                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                        ) : funcionario.status === "ativo" ? (
                                                            <FaToggleOff size={16} />
                                                        ) : (
                                                            <FaToggleOn size={16} />
                                                        )}
                                                    </button>
                                                    
                                                    {/* Botão Editar */}
                                                    <button
                                                        onClick={() => {
                                                            setFuncionarioEditando(funcionario);
                                                            setShowModal(true);
                                                        }}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="Editar"
                                                    >
                                                        <FaEdit size={16} />
                                                    </button>
                                                    
                                                    {/* Botão Excluir */}
                                                    <button
                                                        onClick={() => setFuncionarioParaExcluir(funcionario)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Excluir permanentemente"
                                                    >
                                                        <FaTrash size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal de Adicionar/Editar */}
                {showModal && (
                    <ModalFuncionario
                        funcionario={funcionarioEditando}
                        onClose={() => {
                            setShowModal(false);
                            setFuncionarioEditando(null);
                        }}
                        onSave={salvarFuncionario}
                        cargos={cargos}
                        permissoesDisponiveis={permissoesDisponiveis}
                        loading={loadingAction === 'salvando'}
                    />
                )}

                {/* Modal de Confirmação de Exclusão */}
                {funcionarioParaExcluir && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl max-w-md w-full p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-100 rounded-lg">
                                    <FaExclamationTriangle className="text-red-600 text-xl" />
                                </div>
                                <h2 className="text-xl font-bold text-red-600">Confirmar Exclusão</h2>
                            </div>
                            
                            <p className="text-gray-700 mb-4">
                                Tem certeza que deseja excluir permanentemente o funcionário{" "}
                                <strong>{funcionarioParaExcluir.nome}</strong>?
                            </p>
                            <p className="text-sm text-red-600 mb-6 flex items-center gap-2">
                                <FaExclamationTriangle size={14} />
                                ⚠️ Esta ação não pode ser desfeita!
                            </p>
                            
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setFuncionarioParaExcluir(null)}
                                    disabled={loadingAction === 'excluindo-' + funcionarioParaExcluir.id}
                                    className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => excluirFuncionarioHandler(funcionarioParaExcluir)}
                                    disabled={loadingAction === 'excluindo-' + funcionarioParaExcluir.id}
                                    className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loadingAction === 'excluindo-' + funcionarioParaExcluir.id ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <FaTrash size={14} />
                                    )}
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// MODAL CORRIGIDO
const ModalFuncionario = ({ funcionario, onClose, onSave, cargos, permissoesDisponiveis, loading }) => {
    const [nome, setNome] = useState(funcionario?.nome || '');
    const [email, setEmail] = useState(funcionario?.email || '');
    const [senha, setSenha] = useState('');
    // Normaliza para lowercase para evitar bugs no select
    const [cargo, setCargo] = useState(funcionario?.cargo?.toLowerCase() || cargos[0].toLowerCase());
    const [telefone, setTelefone] = useState(funcionario?.telefone || '');
    const [permissoes, setPermissoes] = useState(funcionario?.permissoes || []);
    
    // Função de toggle de permissão
    const togglePermissao = (key) => {
        setPermissoes(prev => 
            prev.includes(key)
                ? prev.filter(p => p !== key)
                : [...prev, key]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!nome.trim() || !email.trim() || !cargo.trim()) {
            alert("Preencha Nome, Email e Cargo.");
            return;
        }

        // Validação da Senha: Apenas no modo Adicionar
        if (!funcionario) {
            if (!senha || senha.length < 6) {
                alert("A senha é obrigatória e deve ter no mínimo 6 caracteres para novos funcionários.");
                return;
            }
        }

        const payload = { 
            nome: nome.trim(), 
            email: email.trim(), 
            // 🚨 CONVERTE PARA MINÚSCULO PARA BATER COM O CHECK DE ROTAS (App.jsx)
            cargo: cargo.toLowerCase(), 
            telefone: telefone.trim() || null, 
            permissoes, 
            status: funcionario?.status || 'ativo',
            isAdmin: false, 
            isMasterAdmin: false 
        };

        // 🔥 CORREÇÃO: Só adiciona a senha se for CRIAÇÃO (evita undefined na edição)
        if (!funcionario) {
            payload.senha = senha;
        }

        onSave(payload);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {funcionario ? 'Editar Funcionário' : 'Adicionar Novo Funcionário'}
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                        {/* Nome */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome *
                            </label>
                            <input 
                                type="text" 
                                value={nome} 
                                onChange={(e) => setNome(e.target.value)} 
                                required 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Digite o nome completo"
                            />
                        </div>
                        
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email *
                            </label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required
                                disabled={!!funcionario}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder="exemplo@email.com"
                            />
                            {funcionario && (
                                <p className="text-xs text-gray-500 mt-1">
                                    O email não pode ser alterado
                                </p>
                            )}
                        </div>
                        
                        {/* Cargo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cargo *
                            </label>
                            <select 
                                value={cargo} 
                                onChange={(e) => setCargo(e.target.value)} 
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white capitalize"
                            >
                                {cargos.map(c => (
                                    <option key={c} value={c.toLowerCase()}>{c}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Telefone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Telefone
                            </label>
                            <input 
                                type="tel" 
                                value={telefone} 
                                onChange={(e) => setTelefone(e.target.value)} 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="(11) 99999-9999"
                            />
                        </div>
                        
                        {/* SENHA: SOMENTE PARA NOVOS FUNCIONÁRIOS */}
                        {!funcionario && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Senha * (Mínimo 6 caracteres)
                                </label>
                                <input 
                                    type="password" 
                                    value={senha} 
                                    onChange={(e) => setSenha(e.target.value)} 
                                    required
                                    minLength={6}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Digite a senha"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    A senha será usada para o funcionário fazer login
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Permissões */}
                    <div className="mb-6 border border-gray-200 p-4 rounded-lg bg-gray-50">
                        <h3 className="text-md font-semibold text-gray-700 mb-3">Permissões de Acesso:</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {permissoesDisponiveis.map(p => (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => togglePermissao(p.key)}
                                    className={`flex items-center justify-between p-3 rounded-md transition-colors border ${
                                        permissoes.includes(p.key)
                                            ? 'bg-green-500 text-white border-green-600'
                                            : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-300'
                                    }`}
                                >
                                    <span className="text-left">{p.label}</span>
                                    <span>{permissoes.includes(p.key) ? '✅' : '❌'}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button 
                            type="button" 
                            onClick={onClose}
                            disabled={loading}
                            className="py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading && (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            )}
                            {funcionario ? 'Salvar Alterações' : 'Adicionar Funcionário'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GestaoFuncionarios;