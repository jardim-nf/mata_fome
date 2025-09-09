// src/utils/firebaseStorageService.js
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

const storage = getStorage();

/**
 * (Função Genérica) Faz o upload de um arquivo para um caminho específico no Storage e retorna a URL de download.
 * Usado pelo AdminMenuManagement.jsx.
 * @param {File} file O arquivo a ser enviado.
 * @param {string} path O caminho para salvar o arquivo no Storage (ex: 'logos/meu-logo.png').
 * @returns {Promise<string>} A URL de download pública do arquivo.
 */
export const uploadFile = async (file, path) => {
  if (!file) throw new Error("Nenhum arquivo fornecido para upload.");
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

/**
 * (Função Restaurada) Deleta um arquivo do Firebase Storage usando sua URL de download.
 * Usado pelo AdminMenuManagement.jsx.
 * @param {string} url A URL de download do arquivo a ser deletado.
 */
export const deleteFileByUrl = async (url) => {
  if (!url) {
    console.warn("URL do arquivo não fornecida para exclusão.");
    return;
  }
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
    console.log("Arquivo deletado com sucesso:", url);
  } catch (error) {
    if (error.code !== 'storage/object-not-found') {
      console.error("Erro ao deletar arquivo:", error);
    } else {
      console.log("Arquivo não encontrado no Storage (provavelmente já foi deletado).");
    }
  }
};

/**
 * (Função Nova) Faz upload de uma imagem e já atualiza o documento do produto com a URL.
 * Usado pela nova página AdminImageAssociation.jsx.
 * @param {string} estabelecimentoId - ID do estabelecimento.
 * @param {string} categoriaId - ID da categoria do produto.
 * @param {string} itemId - ID do item do cardápio.
 * @param {File} file - O arquivo de imagem a ser enviado.
 * @returns {Promise<string>} - A URL de download da imagem.
 */
export const uploadImageAndUpdateProduct = async (estabelecimentoId, categoriaId, itemId, file) => {
  if (!file) throw new Error("Nenhum arquivo fornecido.");

  const imagePath = `estabelecimentos/${estabelecimentoId}/produtos/${itemId}_${Date.now()}`;
  const storageRef = ref(storage, imagePath);

  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    const itemDocRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, 'itens', itemId);
    await updateDoc(itemDocRef, {
      imageUrl: downloadURL
    });

    return downloadURL;
  } catch (error) {
    console.error("Erro no upload da imagem ou atualização do produto: ", error);
    throw error;
  }
};