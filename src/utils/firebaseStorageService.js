// src/utils/firebaseStorageService.js
import { storage } from '../firebase'; // Importe a instância do storage
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Faz upload de um arquivo para o Firebase Storage.
 * @param {File} file O arquivo a ser enviado.
 * @param {string} path O caminho completo no Storage (ex: 'images/menuItems/nome_do_arquivo.jpg').
 * @returns {Promise<string>} A URL de download do arquivo.
 */
export const uploadFile = async (file, path) => {
  if (!file) {
    throw new Error("Nenhum arquivo fornecido para upload.");
  }
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

/**
 * Deleta um arquivo do Firebase Storage.
 * @param {string} url A URL de download do arquivo a ser deletado.
 * @returns {Promise<void>}
 */
export const deleteFileByUrl = async (url) => {
  if (!url) {
    console.warn("URL de arquivo não fornecida para exclusão.");
    return;
  }
  try {
    const fileRef = ref(storage, url); // Ref from URL path
    await deleteObject(fileRef);
    console.log("Arquivo deletado com sucesso:", url);
  } catch (error) {
    console.error("Erro ao deletar arquivo:", error);
    // Ignore if file doesn't exist (e.g., 'object-not-found')
    if (error.code !== 'storage/object-not-found') {
      throw error;
    }
  }
};