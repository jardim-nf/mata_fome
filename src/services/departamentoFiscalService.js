import { db } from '../firebase';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

const COLLECTION_NAME = 'departamentosFiscais';

export const departamentoFiscalService = {
  // Lista todos os departamentos para um estabelecimento e os GLOBAIS
  getDepartamentos: async (estabelecimentoId) => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estabelecimentoId', 'in', [estabelecimentoId, 'GLOBAL'])
      );
      const snapshot = await getDocs(q);
      const docs = [];
      snapshot.forEach(doc => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      return docs;
    } catch (error) {
      console.error('Erro ao buscar departamentos fiscais:', error);
      throw error;
    }
  },

  // Busca departamento específico
  getDepartamentoById: async (id) => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar departamento fiscal:', error);
      throw error;
    }
  },

  // Cria um novo departamento
  createDepartamento: async (estabelecimentoId, data) => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        estabelecimentoId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('Erro ao criar departamento fiscal:', error);
      throw error;
    }
  },

  // Atualiza um departamento existente
  updateDepartamento: async (id, data) => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
      return { id, ...data };
    } catch (error) {
      console.error('Erro ao atualizar departamento fiscal:', error);
      throw error;
    }
  },

  // Remove um departamento
  deleteDepartamento: async (id) => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erro ao excluir departamento fiscal:', error);
      throw error;
    }
  }
};
