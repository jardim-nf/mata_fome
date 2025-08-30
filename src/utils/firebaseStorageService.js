// src/utils/firebaseStorageService.js
import { storage } from '../firebase';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';

/**
 * Faz upload de um arquivo para o Firebase Storage.
 * @param {File} file O arquivo a ser enviado.
 * @param {string} path O caminho completo no Storage (ex: 'images/menuItems/nome_do_arquivo.jpg').
 * @returns {Promise<string>} O CAMINHO (path) do arquivo salvo no Storage.
 */
export const uploadFile = async (file, path) => {
  if (!file) {
    throw new Error("Nenhum arquivo fornecido para upload.");
  }
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  // CORREÇÃO: Retorna o caminho completo do arquivo em vez da URL de download.
  return snapshot.ref.fullPath;
};

/**
 * Deleta um arquivo do Firebase Storage.
 * @param {string} url A URL de download OU o caminho do arquivo a ser deletado.
 * @returns {Promise<void>}
 */
export const deleteFileByUrl = async (url) => {
  if (!url) {
    console.warn("URL ou caminho do arquivo não fornecido para exclusão.");
    return;
  }
  try {
    // A função ref do SDK v9+ consegue lidar tanto com URLs https:// quanto com caminhos diretos.
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
    console.log("Arquivo deletado com sucesso:", url);
  } catch (error) {
    console.error("Erro ao deletar arquivo:", error);
    // Ignora o erro se o arquivo já não existir.
    if (error.code !== 'storage/object-not-found') {
      throw error;
    }
  }
};