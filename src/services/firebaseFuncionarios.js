// src/services/firebaseFuncionarios.js - VERSÃO COMPLETA COM EXCLUSÃO
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, // ← IMPORT ADICIONADO
  getDocs, 
  query, 
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';

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
    
    console.log('✅ Funcionários encontrados:', funcionarios);
    return funcionarios;
  } catch (error) {
    console.error('❌ Erro ao buscar funcionários:', error);
    throw error;
  }
};

// Adicionar novo funcionário
export const addFuncionario = async (estabelecimentoId, funcionarioData) => {
  try {
    console.log('➕ Adicionando funcionário para estabelecimento:', estabelecimentoId);
    console.log('📝 Dados do funcionário:', funcionarioData);
    
    const funcionariosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'funcionarios');
    
    const dadosParaSalvar = {
      ...funcionarioData,
      status: 'ativo',
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };
    
    console.log('💾 Salvando dados:', dadosParaSalvar);
    
    const docRef = await addDoc(funcionariosRef, dadosParaSalvar);
    
    console.log('✅ Funcionário adicionado com ID:', docRef.id);
    
    return { 
      id: docRef.id, 
      ...dadosParaSalvar 
    };
  } catch (error) {
    console.error('❌ Erro detalhado ao adicionar funcionário:', error);
    console.error('❌ Código do erro:', error.code);
    console.error('❌ Mensagem do erro:', error.message);
    throw error;
  }
};

// Atualizar funcionário
export const updateFuncionario = async (estabelecimentoId, funcionarioId, updateData) => {
  try {
    console.log('✏️ Atualizando funcionário:', funcionarioId);
    console.log('📝 Dados de atualização:', updateData);
    
    const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', funcionarioId);
    
    await updateDoc(funcionarioRef, {
      ...updateData,
      atualizadoEm: new Date()
    });
    
    console.log('✅ Funcionário atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar funcionário:', error);
    throw error;
  }
};

// Desativar funcionário (exclusão "soft")
export const deleteFuncionario = async (estabelecimentoId, funcionarioId) => {
  try {
    const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', funcionarioId);
    await updateDoc(funcionarioRef, {
      status: 'inativo',
      atualizadoEm: new Date()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao desativar funcionário:', error);
    throw error;
  }
};

// ✅ NOVA FUNÇÃO: Excluir funcionário permanentemente
export const excluirFuncionarioPermanentemente = async (estabelecimentoId, funcionarioId) => {
  try {
    console.log('🗑️ Excluindo permanentemente funcionário:', funcionarioId);
    
    const funcionarioRef = doc(db, 'estabelecimentos', estabelecimentoId, 'funcionarios', funcionarioId);
    
    await deleteDoc(funcionarioRef);
    
    console.log('✅ Funcionário excluído permanentemente');
    return true;
  } catch (error) {
    console.error('❌ Erro ao excluir funcionário:', error);
    throw error;
  }
};