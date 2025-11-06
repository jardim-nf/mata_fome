// src/hooks/usePlatformWebhooks.js
import { onSnapshot, collection, query, where } from 'firebase/firestore';

export const usePlatformWebhooks = () => {
  useEffect(() => {
    const user = auth.currentUser;
    const platformsRef = collection(db, 'platforms');
    const q = query(platformsRef, where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          // Atualizar UI em tempo real
          console.log('Plataforma atualizada:', change.doc.data());
        }
      });
    });

    return () => unsubscribe();
  }, []);
};