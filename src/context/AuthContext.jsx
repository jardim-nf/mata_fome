// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth'; // Importe signOut aqui!
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentClientData, setCurrentClientData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setCurrentClientData(data);
            setIsAdmin(data.isAdmin || false);
            setIsMasterAdmin(data.isMasterAdmin || false); 
            console.log("AuthContext Debug: Dados do usuário carregados. isAdmin:", data.isAdmin, "isMasterAdmin:", data.isMasterAdmin);
          } else {
            console.log("AuthContext Debug: Documento do perfil do usuário NÃO encontrado na coleção 'usuarios'.");
            setCurrentClientData(null);
            setIsAdmin(false);
            setIsMasterAdmin(false);
          }
        } catch (error) {
          console.error("AuthContext Error ao buscar dados do usuário:", error);
          setCurrentClientData(null);
          setIsAdmin(false);
          setIsMasterAdmin(false);
        }
      } else {
        setCurrentUser(null); 
        setCurrentClientData(null);
        setIsAdmin(false);
        setIsMasterAdmin(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // NOVO: Função para fazer logout
  const signOutUser = async () => {
    try {
      await signOut(auth);
      // O onAuthStateChanged (no useEffect acima) cuidará de redefinir os estados após o logout
      console.log("Logout realizado com sucesso.");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      throw error; // Propaga o erro para quem chamou
    }
  };

  const value = {
    currentUser,
    currentClientData,
    isAdmin,
    isMasterAdmin,
    loading,
    signOutUser // NOVO: Expor a função de logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}