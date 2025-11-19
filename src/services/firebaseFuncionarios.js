// src/services/firebaseFuncionarios.js - VERSÃO CORRIGIDA
import { 
    collection, 
    doc, 
    updateDoc, 
    deleteDoc, 
    getDocs, 
    query, 
    orderBy,
    setDoc,
    where 
} from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase'; 

const auth = getAuth();

// Buscar todos os funcionários do estabelecimento
export const getFuncionarios = async (estabelecimentoId) => {
    try {
        console.log('🔍 Buscando funcionários para:', estabelecimentoId);
        const funcionariosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'funcionarios');
        const q = query(funcionariosRef, orderBy('nome'));
        const querySnapshot = await getDocs(q);
        
        const funcionarios = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('✅ Funcionários encontrados:', funcionarios.length);
        return funcionarios;
    } catch (error) {
        console.error('❌ Erro ao buscar funcionários:', error);
        throw error;
    }
};

// Adicionar novo funcionário - VERSÃO CORRIGIDA
export const addFuncionario = async (estabelecimentoId, funcionarioData) => {
    const { email, senha, permissoes, ...dataRestante } = funcionarioData;

    console.log('🔧 Iniciando cadastro com dados:', {
        estabelecimentoId,
        email,
        temSenha: !!senha,
        nome: dataRestante.nome
    });

    if (!senha) {
        throw new Error("A senha é obrigatória para criar um novo funcionário.");
    }

    if (senha.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres.");
    }

    try {
        console.log('🚀 1. Criando usuário no Firebase Auth...');
        
        // 1. 🔑 CRIAR CONTA NO FIREBASE AUTHENTICATION
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const uid = userCredential.user.uid;
        
        console.log('✅ Usuário criado no Auth com UID:', uid);

        // 2. 📝 SALVAR DADOS NA COLEÇÃO PRINCIPAL DE USUÁRIOS
        console.log('💾 2. Salvando dados em /usuarios...');
        const usuarioData = {
            isAdmin: true, 
            isMasterAdmin: false,
            email: email,
            nome: dataRestante.nome,
            estabelecimentosGerenciados: { 
                [estabelecimentoId]: true 
            },
            criadoEm: new Date(),
        };
        
        await setDoc(doc(db, 'usuarios', uid), usuarioData);
        console.log('✅ Dados salvos em /usuarios');

        // 3. 📝 SALVAR DADOS NA SUBCOLEÇÃO DE FUNCIONÁRIOS
        console.log('💾 3. Salvando dados na subcoleção funcionários...');
        const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', uid);
        
        const dadosFuncionario = {
            nome: dataRestante.nome,
            email: email,
            cargo: dataRestante.cargo,
            telefone: dataRestante.telefone || '',
            permissoes: permissoes || [],
            status: 'ativo',
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            uid: uid // Adiciona o UID como referência
        };
        
        await setDoc(funcionarioRef, dadosFuncionario);
        console.log('✅ Dados salvos na subcoleção funcionários');
        console.log('🎉 Funcionário cadastrado com sucesso!');
        
        return { 
            id: uid,
            ...dadosFuncionario
        };
        
    } catch (error) {
        console.error('❌ ERRO DETALHADO NO CADASTRO:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        // Mensagens de erro mais amigáveis
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('Este email já está em uso por outro usuário.');
        } else if (error.code === 'auth/invalid-email') {
            throw new Error('O email fornecido é inválido.');
        } else if (error.code === 'auth/weak-password') {
            throw new Error('A senha é muito fraca. Use pelo menos 6 caracteres.');
        } else if (error.code === 'auth/network-request-failed') {
            throw new Error('Erro de conexão. Verifique sua internet.');
        } else {
            throw new Error(`Erro ao cadastrar funcionário: ${error.message}`);
        }
    }
};

// Atualizar funcionário
export const updateFuncionario = async (estabelecimentoId, funcionarioId, updateData) => {
    try {
        console.log('✏️ Atualizando funcionário:', funcionarioId);
        
        // 1. Atualizar subcoleção de funcionário
        const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', funcionarioId);
        await updateDoc(funcionarioRef, {
            ...updateData,
            atualizadoEm: new Date()
        });

        // 2. Atualizar documento /usuarios (se nome foi alterado)
        if (updateData.nome) {
            const usuarioRef = doc(db, 'usuarios', funcionarioId);
            await updateDoc(usuarioRef, {
                nome: updateData.nome,
                atualizadoEm: new Date()
            });
        }

        console.log('✅ Funcionário atualizado com sucesso');
        return true;
    } catch (error) {
        console.error('❌ Erro ao atualizar funcionário:', error);
        throw error;
    }
};

// Desativar funcionário
export const deleteFuncionario = async (estabelecimentoId, funcionarioId) => {
    try {
        const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', funcionarioId);
        await updateDoc(funcionarioRef, {
            status: 'inativo',
            atualizadoEm: new Date()
        });
        
        // Desativar no /usuarios
        const usuarioRef = doc(db, 'usuarios', funcionarioId);
        await updateDoc(usuarioRef, {
            isAdmin: false,
            atualizadoEm: new Date()
        });

        return true;
    } catch (error) {
        console.error('❌ Erro ao desativar funcionário:', error);
        throw error;
    }
};

// Excluir funcionário permanentemente
export const excluirFuncionarioPermanentemente = async (estabelecimentoId, funcionarioId) => {
    try {
        console.log('🗑️ Excluindo permanentemente funcionário:', funcionarioId);
        
        // 1. Excluir da subcoleção de funcionários
        const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', funcionarioId);
        await deleteDoc(funcionarioRef);

        // 2. Excluir da coleção /usuarios
        const usuarioRef = doc(db, 'usuarios', funcionarioId);
        await deleteDoc(usuarioRef);
        
        console.log('✅ Funcionário excluído do Firestore');
        
        // 3. ⚠️ Para excluir do Auth, precisa de Cloud Function
        console.log('ℹ️ Para excluir do Auth, implemente uma Cloud Function');
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao excluir funcionário:', error);
        throw error;
    }
};

// Verificar se email já existe
export const verificarEmailExistente = async (estabelecimentoId, email) => {
    try {
        const funcionariosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'funcionarios');
        const q = query(funcionariosRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        
        return !querySnapshot.empty;
    } catch (error) {
        console.error('❌ Erro ao verificar email:', error);
        throw error;
    }
};