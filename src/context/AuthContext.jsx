// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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

  const logout = () => {
    return signOut(auth);
  };

  // ▼▼▼ USEEFFECT COM A LÓGICA DE BUSCA UNIFICADA E LOGS DE DEBUG ▼▼▼
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      console.log("AuthContext Debug: onAuthStateChanged - user:", user); // Log para ver o objeto 'user'

      if (user) {
        try {
          let userProfileData = null;
          let isAdminUser = false;
          let isMasterAdminUser = false;

          // 1. Busca em 'usuarios' - Esta é a fonte principal para permissões e dados base
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            isAdminUser = userData.isAdmin || false;
            isMasterAdminUser = userData.isMasterAdmin || false;
            userProfileData = userData; // Define os dados base do perfil

            // Se for um Admin comum, verifica se seu estabelecimento está ativo
            if (isAdminUser && !isMasterAdminUser) {
              const estabQuery = query(collection(db, 'estabelecimentos'), where('adminUID', '==', user.uid));
              const estabSnapshot = await getDocs(estabQuery);
              if (!estabSnapshot.empty) {
                setIsEstabelecimentoAtivo(estabSnapshot.docs[0].data().ativo || false);
              } else {
                setIsEstabelecimentoAtivo(false); // Admin sem estabelecimento vinculado é inativo
              }
            } else {
              setIsEstabelecimentoAtivo(true); // Master Admins estão sempre ativos
            }
          }

          // 2. Busca em 'clientes' - Para mesclar dados específicos de cliente (como endereço)
          const clientDocRef = doc(db, 'clientes', user.uid);
          const clientDocSnap = await getDoc(clientDocRef);

          if (clientDocSnap.exists()) {
            // ▼▼▼ LÓGICA DE MERGE ▼▼▼
            // Mescla os dados, dando preferência aos dados de 'clientes' se houver conflito
            userProfileData = { ...userProfileData, ...clientDocSnap.data() };
          }
          
          // 3. Atualiza os estados com os dados consolidados
          setCurrentClientData(userProfileData);
          setIsAdmin(isAdminUser);
          setIsMasterAdmin(isMasterAdminUser);
          console.log("AuthContext Debug: currentClientData setado para:", userProfileData); // Log para ver o currentClientData setado

        } catch (error) {
          console.error("AuthContext Error: Falha ao buscar dados do usuário.", error);
          // Zera os estados em caso de erro
          setCurrentClientData(null);
          setIsAdmin(false);
          setIsMasterAdmin(false);
          setIsEstabelecimentoAtivo(false);
        }

      } else { // Se não há usuário logado
        console.log("AuthContext Debug: user is null (deslogado).");
        setCurrentClientData(null);
        setIsAdmin(false);
        setIsMasterAdmin(false);
        setIsEstabelecimentoAtivo(false);
      }

      setLoading(false); // Finaliza o carregamento
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    currentClientData,
    isAdmin,
    isMasterAdmin,
    isEstabelecimentoAtivo,
    loading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}