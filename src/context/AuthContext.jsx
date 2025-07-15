import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../firebase'; 

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); 
  const [isAdmin, setIsAdmin] = useState(false); 
  const [currentClientData, setCurrentClientData] = useState(null); 
  const [loading, setLoading] = useState(true);

  const logout = () => {
    const auth = getAuth();
    return signOut(auth); 
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("AuthContext Debug: onAuthStateChanged - Callback disparado. User recebido:", user ? user.uid : "null (deslogado)");
      
      setCurrentUser(user);

      if (user) {
        const userAdminDocRef = doc(db, 'usuarios', user.uid);
        const userAdminDocSnap = await getDoc(userAdminDocRef);

        if (userAdminDocSnap.exists() && userAdminDocSnap.data()?.isAdmin) {
          console.log("AuthContext Debug: Usuário é um administrador. UID:", user.uid);
          setIsAdmin(true);
          setCurrentClientData(null); 
        } else {
          console.log("AuthContext Debug: Usuário NÃO é administrador. Tentando buscar dados de cliente. UID:", user.uid);
          setIsAdmin(false); 
          const clientDocRef = doc(db, 'clientes', user.uid); 
          const clientDocSnap = await getDoc(clientDocRef); 

          if (clientDocSnap.exists()) {
            const data = clientDocSnap.data();
            setCurrentClientData(data); 
            console.log("AuthContext Debug: currentClientData definido para cliente:", data);
          } else {
            setCurrentClientData(null); 
            console.warn("AuthContext Debug: Documento de cliente NÃO encontrado no Firestore para o UID:", user.uid);
          }
        }
      } else {
        console.log("AuthContext Debug: Nenhum usuário logado. Limpando estados.");
        setIsAdmin(false);
        setCurrentClientData(null);
      }
      
      setLoading(false);
      console.log("AuthContext Debug: setLoading(false) chamado. Estado FINAL: loading:", false, "currentUser (vindo do callback):", user ? user.uid : "null");
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,       
    isAdmin,           
    currentClientData, 
    loading,           
    logout             
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} 
    </AuthContext.Provider>
  );
}