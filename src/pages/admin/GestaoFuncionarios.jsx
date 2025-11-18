// src/pages/admin/GestaoFuncionarios.jsx - VERSÃO COM ÍCONES E EXCLUSÃO
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import withAuth from "../../hocs/withAuth";
import { 
  getFuncionarios, 
  addFuncionario, 
  updateFuncionario, 
  deleteFuncionario,
  excluirFuncionarioPermanentemente // ← IMPORT ADICIONADO
} from "../../services/firebaseFuncionarios";

// Import dos ícones
import { FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaUserPlus } from 'react-icons/fa';

const GestaoFuncionarios = ({ estabelecimentoPrincipal }) => {
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [funcionarioEditando, setFuncionarioEditando] = useState(null);
  const [funcionarioParaExcluir, setFuncionarioParaExcluir] = useState(null);

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

    try {
      if (funcionarioEditando) {
        await updateFuncionario(estabelecimentoId, funcionarioEditando.id, funcionarioData);
        alert('✅ Funcionário atualizado com sucesso!');
      } else {
        await addFuncionario(estabelecimentoId, funcionarioData);
        alert('✅ Funcionário adicionado com sucesso!');
      }
      carregarFuncionarios();
      setShowModal(false);
    } catch (error) {
      alert('❌ Erro ao salvar funcionário: ' + error.message);
    }
  };

  // Alternar status
  const toggleStatus = async (funcionario) => {
    if (!estabelecimentoId) {
      alert('Erro: Estabelecimento não identificado');
      return;
    }

    try {
      const novoStatus = funcionario.status === "ativo" ? "inativo" : "ativo";
      await updateFuncionario(estabelecimentoId, funcionario.id, { 
        status: novoStatus 
      });
      alert(`✅ Funcionário ${novoStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`);
      carregarFuncionarios();
    } catch (error) {
      alert('❌ Erro ao alterar status: ' + error.message);
    }
  };

  // ✅ NOVA FUNÇÃO: Excluir funcionário
  const excluirFuncionarioHandler = async (funcionario) => {
    try {
      await excluirFuncionarioPermanentemente(estabelecimentoId, funcionario.id);
      alert('✅ Funcionário excluído com sucesso!');
      carregarFuncionarios();
      setFuncionarioParaExcluir(null);
    } catch (error) {
      alert('❌ Erro ao excluir funcionário: ' + error.message);
    }
  };

  // ... (resto do código de loading e verificação de estabelecimento)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        
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
                onClick={() => setShowModal(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
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
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
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
                            className={`p-2 rounded transition-colors ${
                              funcionario.status === "ativo"
                                ? "text-red-600 hover:bg-red-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                            title={funcionario.status === "ativo" ? "Desativar" : "Ativar"}
                          >
                            {funcionario.status === "ativo" ? <FaToggleOff size={16} /> : <FaToggleOn size={16} />}
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
            onClose={() => setShowModal(false)}
            onSave={salvarFuncionario}
            cargos={cargos}
            permissoesDisponiveis={permissoesDisponiveis}
          />
        )}

        {/* Modal de Confirmação de Exclusão */}
        {funcionarioParaExcluir && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <FaTrash className="text-red-600 text-xl" />
                </div>
                <h2 className="text-xl font-bold text-red-600">Confirmar Exclusão</h2>
              </div>
              
              <p className="text-gray-700 mb-4">
                Tem certeza que deseja excluir permanentemente o funcionário{" "}
                <strong>{funcionarioParaExcluir.nome}</strong>?
              </p>
              <p className="text-sm text-red-600 mb-6 flex items-center gap-2">
                <FaTrash size={14} />
                ⚠️ Esta ação não pode ser desfeita!
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setFuncionarioParaExcluir(null)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => excluirFuncionarioHandler(funcionarioParaExcluir)}
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FaTrash size={14} />
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

// Modal component (mantenha igual)
const ModalFuncionario = ({ funcionario, onClose, onSave, cargos, permissoesDisponiveis }) => {
  // ... (código do modal igual ao anterior)
};

export default withAuth(GestaoFuncionarios, { requireAdmin: true });