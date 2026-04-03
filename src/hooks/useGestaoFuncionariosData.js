import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { serverTimestamp } from "firebase/firestore";
import { 
    getFuncionarios, 
    addFuncionario,
    updateFuncionario, 
    excluirFuncionarioPermanentemente,
    verificarEmailExistente
} from "../services/firebaseFuncionarios";

const CARGOS = [
    "Gerente", "Garçom", "Caixa", "Cozinheiro", "Atendente", "Entregador", "Auxiliar"
];

const PERMISSOES_DISPONIVEIS = [
    { key: "painel", label: "Painel de Pedidos" },
    { key: "controle-salao", label: "Controle de Salão" },
    { key: "visualizar-cardapio", label: "Visualizar Cardápio" },
    { key: "relatorios", label: "Relatórios" },
    { key: "estoque", label: "Controle de Estoque" },
    { key: "financeiro", label: "Acesso Financeiro" }
];

export function useGestaoFuncionariosData(estabelecimentoId) {
    const [funcionarios, setFuncionarios] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Controle do Modal Adicionar/Editar
    const [showModal, setShowModal] = useState(false);
    const [funcionarioEditando, setFuncionarioEditando] = useState(null);
    
    // Controle do Modal Excluir
    const [funcionarioParaExcluir, setFuncionarioParaExcluir] = useState(null);
    
    // Status de Loadings de Ações e Submits
    const [loadingAction, setLoadingAction] = useState('');

    const carregarFuncionarios = useCallback(async () => {
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
            toast.error('Erro ao carregar funcionários: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [estabelecimentoId]);

    useEffect(() => {
        carregarFuncionarios();
    }, [carregarFuncionarios]);

    const handleOpenAddModal = useCallback(() => {
        setFuncionarioEditando(null);
        setShowModal(true);
    }, []);

    const salvarFuncionario = async (funcionarioData) => {
        if (!estabelecimentoId) {
            toast.error('Erro: Estabelecimento não identificado');
            return;
        }

        setLoadingAction('salvando');

        try {
            // Verificar se email já existe (apenas para novos funcionários)
            if (!funcionarioEditando) {
                const emailExiste = await verificarEmailExistente(estabelecimentoId, funcionarioData.email);
                if (emailExiste) {
                    toast.warning('Já existe um funcionário com este email no estabelecimento.');
                    setLoadingAction('');
                    return;
                }
            }

            const dadosParaSalvar = {
                ...funcionarioData,
                estabelecimentoId: estabelecimentoId, 
                estabelecimentosGerenciados: [estabelecimentoId],
                updatedAt: serverTimestamp()
            };

            if (funcionarioEditando) {
                // Modo Edição
                await updateFuncionario(estabelecimentoId, funcionarioEditando.id, dadosParaSalvar);
                toast.success('Funcionário atualizado com sucesso!');
            } else {
                // Modo Adição
                dadosParaSalvar.createdAt = serverTimestamp();
                await addFuncionario(estabelecimentoId, dadosParaSalvar);
                toast.success('Funcionário adicionado com sucesso!');
            }
            
            await carregarFuncionarios();
            setShowModal(false);
            setFuncionarioEditando(null);
        } catch (error) {
            console.error('❌ Erro ao salvar funcionário:', error);
            toast.error(error.message);
        } finally {
            setLoadingAction('');
        }
    };

    const toggleStatus = async (funcionario) => {
        if (!estabelecimentoId) {
            toast.error('Erro: Estabelecimento não identificado');
            return;
        }

        setLoadingAction('toggle-' + funcionario.id);

        try {
            const novoStatus = funcionario.status === "ativo" ? "inativo" : "ativo";
            await updateFuncionario(estabelecimentoId, funcionario.id, { 
                status: novoStatus 
            });
            toast.success(`Funcionário ${novoStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`);
            await carregarFuncionarios();
        } catch (error) {
            toast.error('Erro ao alterar status: ' + error.message);
        } finally {
            setLoadingAction('');
        }
    };

    const excluirFuncionarioHandler = async (funcionario) => {
        setLoadingAction('excluindo-' + funcionario.id);

        try {
            await excluirFuncionarioPermanentemente(estabelecimentoId, funcionario.id);
            toast.success('Funcionário excluído com sucesso!');
            await carregarFuncionarios();
            setFuncionarioParaExcluir(null);
        } catch (error) {
            toast.error('Erro ao excluir funcionário: ' + error.message);
        } finally {
            setLoadingAction('');
        }
    };

    return {
        // Dados
        funcionarios, 
        loading, 
        CARGOS, 
        PERMISSOES_DISPONIVEIS,
        
        // Modais State
        showModal, setShowModal,
        funcionarioEditando, setFuncionarioEditando,
        funcionarioParaExcluir, setFuncionarioParaExcluir,
        loadingAction,
        
        // Handlers
        handleOpenAddModal,
        salvarFuncionario,
        toggleStatus,
        excluirFuncionarioHandler
    };
}
