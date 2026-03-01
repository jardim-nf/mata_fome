// src/services/firebaseFuncionarios.js - CORREÇÃO DE LOGIN AUTOMÁTICO
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
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeApp, getApp, deleteApp } from 'firebase/app'; // 🆕 Necessário para o truque
import { db } from '../firebase'; 

// Auth principal (Admin logado)
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

// Adicionar novo funcionário - COM "APP SECUNDÁRIO"
export const addFuncionario = async (estabelecimentoId, funcionarioData) => {
    const { email, senha, permissoes, cargo, isAdmin, ...dataRestante } = funcionarioData;

    console.log('🔧 Iniciando cadastro com App Secundário...');

    if (!senha || senha.length < 6) {
        throw new Error("A senha é obrigatória e deve ter no mínimo 6 caracteres.");
    }

    // 1. 🎩 O TRUQUE: Criar uma instância secundária do Firebase
    // Isso evita que o Admin seja deslogado ao criar o novo usuário
    const appPrincipal = getApp();
    const firebaseConfig = appPrincipal.options; // Pega a config do app atual
    const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    const secondaryAuth = getAuth(secondaryApp);

    try {
        console.log('🚀 1. Criando usuário no Auth Secundário...');
        
        // Cria o usuário na instância secundária (não desloga o Admin)
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
        const uid = userCredential.user.uid;
        
        console.log('✅ Usuário criado. UID:', uid);

        // Importante: Deslogar da instância secundária para limpar memória
        await signOut(secondaryAuth);
        
        // 2. 📝 SALVAR DADOS NO FIRESTORE (Usando o `db` principal, pois o Admin tem permissão de escrita)
        console.log('💾 2. Salvando dados em /usuarios...');
        
        const usuarioData = {
            isAdmin: false, // Força false para funcionários
            isMasterAdmin: false,
            email: email,
            nome: dataRestante.nome,
            cargo: cargo,
            permissoes: permissoes || [],
            estabelecimentosGerenciados: { 
                [estabelecimentoId]: true 
            },
            criadoEm: new Date(),
        };
        
        // Usa o `db` global (onde o Admin está autenticado) para escrever
        await setDoc(doc(db, 'usuarios', uid), usuarioData);
        console.log('✅ Dados salvos em /usuarios');

        // 3. 📝 SALVAR DADOS NA SUBCOLEÇÃO DE FUNCIONÁRIOS
        console.log('💾 3. Salvando dados na subcoleção funcionários...');
        const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', uid);
        
        const dadosFuncionario = {
            nome: dataRestante.nome,
            email: email,
            cargo: cargo,
            telefone: dataRestante.telefone || '',
            permissoes: permissoes || [],
            status: 'ativo',
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            uid: uid
        };
        
        await setDoc(funcionarioRef, dadosFuncionario);
        console.log('🎉 Funcionário cadastrado com sucesso!');
        
        return { id: uid, ...dadosFuncionario };
        
    } catch (error) {
        console.error('❌ ERRO NO CADASTRO:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('Este email já está em uso por outro usuário.');
        } else {
            throw new Error(`Erro ao cadastrar: ${error.message}`);
        }
    } finally {
        // Limpa a instância secundária para não pesar no navegador
        await deleteApp(secondaryApp);
    }
};

// Atualizar funcionário
export const updateFuncionario = async (estabelecimentoId, funcionarioId, updateData) => {
    try {
        console.log('✏️ Atualizando funcionário:', funcionarioId);
        
        const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', funcionarioId);
        await updateDoc(funcionarioRef, {
            ...updateData,
            atualizadoEm: new Date()
        });

        // Atualizar também na coleção global /usuarios
        const usuarioRef = doc(db, 'usuarios', funcionarioId);
        const updatesUsuario = { atualizadoEm: new Date() };
        
        if (updateData.nome) updatesUsuario.nome = updateData.nome;
        if (updateData.cargo) updatesUsuario.cargo = updateData.cargo;
        if (updateData.permissoes) updatesUsuario.permissoes = updateData.permissoes;
        if (updateData.status === 'inativo') updatesUsuario.isAdmin = false;

        await updateDoc(usuarioRef, updatesUsuario);

        return true;
    } catch (error) {
        console.error('❌ Erro ao atualizar funcionário:', error);
        throw error;
    }
};

// Excluir funcionário permanentemente
export const excluirFuncionarioPermanentemente = async (estabelecimentoId, funcionarioId) => {
    try {
        console.log('🗑️ Excluindo permanentemente funcionário:', funcionarioId);
        
        // 1. Excluir da subcoleção
        const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', funcionarioId);
        await deleteDoc(funcionarioRef);

        // 2. Excluir da coleção global /usuarios
        const usuarioRef = doc(db, 'usuarios', funcionarioId);
        await deleteDoc(usuarioRef);
        
        console.log('✅ Funcionário excluído do Firestore');
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