import React from "react";
import { useAuth } from "../../context/AuthContext";
import { FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaUserPlus, FaExclamationTriangle } from 'react-icons/fa';

import { useGestaoFuncionariosData } from "../../hooks/useGestaoFuncionariosData";
import { ModalFuncionario } from "../../components/ModalFuncionario";
import BackButton from "../../components/BackButton";

const GestaoFuncionarios = () => {
    const { userData , estabelecimentoIdPrincipal } = useAuth();
    const estabelecimentoId = estabelecimentoIdPrincipal || estabelecimentoIdPrincipal || null;

    const {
        funcionarios, loading, CARGOS, PERMISSOES_DISPONIVEIS,
        showModal, setShowModal,
        funcionarioEditando, setFuncionarioEditando,
        funcionarioParaExcluir, setFuncionarioParaExcluir,
        loadingAction,
        handleOpenAddModal,
        salvarFuncionario,
        toggleStatus,
        excluirFuncionarioHandler
    } = useGestaoFuncionariosData(estabelecimentoId);

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
                <BackButton className="mb-6" />
                
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
                                                            {PERMISSOES_DISPONIVEIS.find(p => p.key === permissao)?.label || permissao}
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
                        cargos={CARGOS}
                        permissoesDisponiveis={PERMISSOES_DISPONIVEIS}
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

export default GestaoFuncionarios;