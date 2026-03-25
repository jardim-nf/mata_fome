// src/services/meshyService.js
// Serviço para comunicação com a Cloud Function que gera modelos 3D via Meshy API.
// A Cloud Function faz o trabalho pesado (chama Meshy API, salva .glb no Storage).
// Este service é só o client-side que chama a function e faz polling do status.

import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const functions = getFunctions();

/**
 * Status possíveis da geração 3D
 */
export const MODEL_STATUS = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  TEXTURING: 'texturing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Inicia a geração de um modelo 3D a partir da imagem do produto.
 * Chama a Cloud Function `generateModel3D`.
 * 
 * @param {string} estabelecimentoId 
 * @param {string} categoriaId 
 * @param {string} itemId 
 * @param {string} imageUrl — URL pública da imagem do produto
 * @returns {Promise<{ taskId: string }>}
 */
export const startModelGeneration = async (estabelecimentoId, categoriaId, itemId, imageUrl) => {
  try {
    const generateModel3D = httpsCallable(functions, 'generateModel3D');
    const result = await generateModel3D({
      estabelecimentoId,
      categoriaId,
      itemId,
      imageUrl,
    });
    return result.data; // { taskId, status }
  } catch (error) {
    console.error('❌ Erro ao iniciar geração 3D:', error);
    throw new Error(
      error.code === 'functions/not-found'
        ? 'Cloud Function não encontrada. Deploy necessário.'
        : `Erro na geração 3D: ${error.message}`
    );
  }
};

/**
 * Escuta em tempo real o status da geração 3D no Firestore.
 * O campo `modelo3d` no documento do item contém:
 *   { status, taskId, progress, modelo3dUrl, error }
 * 
 * @param {string} estabelecimentoId 
 * @param {string} categoriaId 
 * @param {string} itemId 
 * @param {function} onUpdate — callback com { status, progress, modelo3dUrl, error }
 * @returns {function} unsubscribe
 */
export const watchModelStatus = (estabelecimentoId, categoriaId, itemId, onUpdate) => {
  const itemRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, 'itens', itemId);

  return onSnapshot(itemRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const modelo3d = data.modelo3d || {};

    onUpdate({
      status: modelo3d.status || MODEL_STATUS.IDLE,
      progress: modelo3d.progress || 0,
      modelo3dUrl: data.modelo3dUrl || null,
      error: modelo3d.error || null,
    });
  });
};

/**
 * Verifica se um item tem modelo 3D disponível.
 */
export const hasModel3D = (item) => {
  return !!(item?.modelo3dUrl);
};

/**
 * Verifica se a geração 3D está em andamento.
 */
export const isGenerating3D = (item) => {
  const status = item?.modelo3d?.status;
  return status === MODEL_STATUS.UPLOADING || 
         status === MODEL_STATUS.PROCESSING || 
         status === MODEL_STATUS.TEXTURING;
};
