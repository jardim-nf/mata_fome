// src/utils/firestoreDebug.js
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function debugFirestoreStructure() {
  console.log('🔍 [DEBUG] Analisando estrutura do Firestore...');
  
  try {
    // Listar todas as coleções principais
    const collections = ['cardapio', 'menu', 'produtos', 'estabelecimentos', 'categorias'];
    
    for (const collectionName of collections) {
      try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        console.log(`📁 ${collectionName}: ${snapshot.size} documentos`);
        
        snapshot.forEach(doc => {
          console.log(`   📄 ${doc.id}:`, doc.data());
        });
      } catch (error) {
        console.log(`❌ ${collectionName}: Não acessível - ${error.message}`);
      }
    }
    
    // Verificar estrutura específica do cardapio
    console.log('🎯 Verificando estrutura do cardapio...');
    try {
      const cardapioRef = collection(db, 'cardapio');
      const cardapioSnapshot = await getDocs(cardapioRef);
      
      cardapioSnapshot.forEach(categoriaDoc => {
        console.log(`🍽️ Categoria: ${categoriaDoc.id}`);
        console.log('   Dados:', categoriaDoc.data());
      });
    } catch (error) {
      console.log('❌ Erro ao acessar cardapio:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro no debug:', error);
  }
}