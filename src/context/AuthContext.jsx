// src/context/AuthContext.js
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
      setCurrentUser(user); 

      if (user) {
        const userAdminDocRef = doc(db, 'usuarios', user.uid);
        const userAdminDocSnap = await getDoc(userAdminDocRef);

        if (userAdminDocSnap.exists() && userAdminDocSnap.data()?.isAdmin) {
          setIsAdmin(true);
          setCurrentClientData(null); 
        } else {
          setIsAdmin(false); 
          const clientDocRef = doc(db, 'clientes', user.uid); 
          const clientDocSnap = await getDoc(clientDocRef); 

          if (clientDocSnap.exists()) {
            const data = clientDocSnap.data(); // Pegamos os dados aqui
            setCurrentClientData(data); // Definimos os dados no estado
            // <<-- ADICIONADO LOG AQUI -->>
            console.log("AuthContext: currentClientData definido:", data);
            console.log("AuthContext: Dados de endereço em currentClientData (AuthContext):", data.endereco);
          } else {
            setCurrentClientData(null); 
            console.log("AuthContext: Documento de cliente não encontrado para o UID:", user.uid);
          }
        }
      } else {
        setIsAdmin(false);
        setCurrentClientData(null);
        console.log("AuthContext: Nenhum usuário logado.");
      }
      setLoading(false);
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