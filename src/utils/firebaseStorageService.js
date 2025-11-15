// src/utils/firebaseStorageService.js
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

const storage = getStorage();

/**
 * (Função Genérica) Faz o upload de um arquivo para um caminho específico no Storage
 */
export const uploadFile = async (file, path) => {
  if (!file) throw new Error("Nenhum arquivo fornecido para upload.");
  
  // 🔥 CORREÇÃO: Garante que o path tenha um nome de arquivo
  let finalPath = path;
  if (!path.includes('.') && file.name) {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    finalPath = `${path}/${timestamp}_${file.name}`;
  }
  
  console.log(`📤 Upload para: ${finalPath}`);
  
  try {
    const storageRef = ref(storage, finalPath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`✅ Upload realizado: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error(`❌ Erro no upload:`, error);
    throw error;
  }
};

/**
 * Função específica para upload de imagens do cardápio
 */
export const uploadCardapioImage = async (file, estabelecimentoId, itemId = null) => {
  const timestamp = Date.now();
  const fileExtension = file.name.split('.').pop();
  const fileName = itemId ? `${itemId}_${timestamp}.${fileExtension}` : `${timestamp}.${fileExtension}`;
  
  const path = `estabelecimentos/${estabelecimentoId}/cardapio/${fileName}`;
  return uploadFile(file, path);
};

/**
 * Deleta um arquivo do Firebase Storage usando sua URL de download.
 */
export const deleteFileByUrl = async (url) => {
  if (!url) {
    console.warn("URL do arquivo não fornecida para exclusão.");
    return;
  }
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
    console.log("🗑️ Arquivo deletado com sucesso:", url);
  } catch (error) {
    if (error.code !== 'storage/object-not-found') {
      console.error("❌ Erro ao deletar arquivo:", error);
      throw error;
    }
  }
};

/**
 * Faz upload de uma imagem e já atualiza o documento do produto com a URL.
 */
export const uploadImageAndUpdateProduct = async (estabelecimentoId, categoriaId, itemId, file) => {
  if (!file) throw new Error("Nenhum arquivo fornecido.");

  try {
    const downloadURL = await uploadCardapioImage(file, estabelecimentoId, itemId);

    const itemDocRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, 'itens', itemId);
    await updateDoc(itemDocRef, {
      imageUrl: downloadURL,
      imageUpdatedAt: new Date()
    });

    return downloadURL;
  } catch (error) {
    console.error("❌ Erro no upload da imagem: ", error);
    throw error;
  }
};