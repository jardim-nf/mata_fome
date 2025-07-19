// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth'; // Importe 'signOut' aqui!
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentClientData, setCurrentClientData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [isEstabelecimentoAtivo, setIsEstabelecimentoAtivo] = useState(true);
  const [loading, setLoading] = useState(true);

  // --- NOVA FUNÇÃO DE LOGOUT ---
  const logout = () => {
    return signOut(auth); // Chama a função signOut do Firebase Authentication
  };
  // ---------------------------

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setCurrentClientData(userData);
            setIsAdmin(userData.isAdmin || false);
            setIsMasterAdmin(userData.isMasterAdmin || false);

            console.log("AuthContext Debug: Dados do usuário carregados. isAdmin:", userData.isAdmin, "isMasterAdmin:", userData.isMasterAdmin);

            // Se for Admin comum (e não Master Admin), verifica se tem estabelecimento vinculado
            if (userData.isAdmin && !userData.isMasterAdmin) {
              const estabQuery = query(collection(db, 'estabelecimentos'), where('adminUID', '==', user.uid));
              const estabSnapshot = await getDocs(estabQuery);

              if (!estabSnapshot.empty) {
                const estabData = estabSnapshot.docs[0].data();
                setIsEstabelecimentoAtivo(estabData.ativo || false);
                console.log("AuthContext Debug: Estabelecimento vinculado ativo:", estabData.ativo);
              } else {
                console.warn("AuthContext Warn: Admin comum sem estabelecimento vinculado.");
                setIsEstabelecimentoAtivo(false);
              }

              // return; // Remover ou comentar esta linha se você quiser que o código abaixo seja executado para admins comuns também
            } else { // Adicionei este else para garantir que isEstabelecimentoAtivo seja true para Master Admin e outros usuários que não são admin comum
                setIsEstabelecimentoAtivo(true);
            }

          } else {
            console.warn("AuthContext Debug: Documento do usuário não encontrado.");
            setCurrentClientData(null);
            setIsAdmin(false);
            setIsMasterAdmin(false);
            setIsEstabelecimentoAtivo(false);
          }
        } catch (error) {
          console.error("AuthContext Error ao buscar dados do usuário ou estabelecimento:", error);
          setCurrentClientData(null);
          setIsAdmin(false);
          setIsMasterAdmin(false);
          setIsEstabelecimentoAtivo(false);
        }
      } else { // Se não há usuário logado
        setCurrentUser(null);
        setCurrentClientData(null);
        setIsAdmin(false);
        setIsMasterAdmin(false);
        setIsEstabelecimentoAtivo(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []); // [] significa que executa apenas uma vez após a montagem

  // O objeto 'value' agora inclui a função 'logout'
  const value = {
    currentUser,
    currentClientData,
    isAdmin,
    isMasterAdmin,
    isEstabelecimentoAtivo,
    loading,
    logout, // <<<<<< EXPORTE A FUNÇÃO DE LOGOUT AQUI
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}