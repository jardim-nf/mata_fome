// src/context/AuthContext.js
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
  const [currentClientData, setCurrentClientData] = useState(null); // Dados do cliente (nome, end, tel)
  const [isAdmin, setIsAdmin] = useState(false); // Flag se é admin de estabelecimento
  const [isMasterAdmin, setIsMasterAdmin] = useState(false); // Flag se é master admin
  const [isEstabelecimentoAtivo, setIsEstabelecimentoAtivo] = useState(true); // Se o estabelecimento do admin está ativo
  const [loading, setLoading] = useState(true);

  const logout = () => {
    return signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(true); // Inicia o loading para cada mudança de estado de autenticação

      if (user) {
        let isAdminUser = false;
        let isMasterAdminUser = false;
        let clientProfileData = null; // Para armazenar os dados do perfil do cliente

        try {
          // 1. Tenta buscar o perfil na coleção 'usuarios' (onde estão as flags de admin)
          // Esta é a fonte de verdade para isAdmin/isMasterAdmin
          const adminDocRef = doc(db, 'usuarios', user.uid);
          const adminDocSnap = await getDoc(adminDocRef);

          if (adminDocSnap.exists()) {
            const adminUserData = adminDocSnap.data();
            isAdminUser = adminUserData.isAdmin || false;
            isMasterAdminUser = adminUserData.isMasterAdmin || false;
            console.log("AuthContext Debug: Perfil de USUÁRIO (admin/master) encontrado na coleção 'usuarios'.", "isAdmin:", isAdminUser, "isMasterAdmin:", isMasterAdminUser); //

            // Se for um Admin comum (não Master), verifica a ativação do estabelecimento
            if (isAdminUser && !isMasterAdminUser) {
              const estabQuery = query(collection(db, 'estabelecimentos'), where('adminUID', '==', user.uid));
              const estabSnapshot = await getDocs(estabQuery);
              if (!estabSnapshot.empty) {
                const estabData = estabSnapshot.docs[0].data();
                setIsEstabelecimentoAtivo(estabData.ativo || false);
                console.log("AuthContext Debug: Estabelecimento vinculado ativo para admin:", estabData.ativo); //
              } else {
                console.warn("AuthContext Warn: Admin comum sem estabelecimento vinculado."); //
                setIsEstabelecimentoAtivo(false);
              }
            } else {
              setIsEstabelecimentoAtivo(true); // Master admin ou usuário sem adminUID não dependem de um estabelecimento específico
            }

          } else {
            console.warn("AuthContext Debug: Documento do usuário (admin) NÃO encontrado na coleção 'usuarios'."); //
            // Se não encontrou em 'usuarios', presume-se que não é admin/master
            isAdminUser = false;
            isMasterAdminUser = false;
            setIsEstabelecimentoAtivo(false); // Não tem estabelecimento para verificar
          }

          // 2. Tenta buscar o perfil na coleção 'clientes' (onde estão os dados do cliente para o cardápio)
          // Esta é a fonte de verdade para currentClientData
          const clientDocRef = doc(db, 'clientes', user.uid);
          const clientDocSnap = await getDoc(clientDocRef);

          if (clientDocSnap.exists()) {
            clientProfileData = clientDocSnap.data();
            console.log("AuthContext Debug: Perfil de CLIENTE encontrado na coleção 'clientes'."); //
          } else {
            console.warn("AuthContext Debug: Documento do usuário (cliente) NÃO encontrado na coleção 'clientes'.");
          }

        } catch (error) {
          console.error("AuthContext Error ao buscar dados do usuário ou cliente:", error);
          // Em caso de erro na busca, defina todos os estados relacionados a falso/nulo
          isAdminUser = false;
          isMasterAdminUser = false;
          setIsEstabelecimentoAtivo(false);
          clientProfileData = null;
        } finally {
          // Garante que os estados são atualizados em qualquer caso
          setIsAdmin(isAdminUser);
          setIsMasterAdmin(isMasterAdminUser); // <-- CORRIGIDO AQUI! Era 'isMasterAdmin(isMasterAdminUser);'
          setCurrentClientData(clientProfileData);
        }
      } else { // Se não há usuário logado (logout ou sessão expirada)
        setCurrentUser(null);
        setCurrentClientData(null);
        setIsAdmin(false);
        setIsMasterAdmin(false);
        setIsEstabelecimentoAtivo(false);
      }

      setLoading(false); // Finaliza o estado de carregamento
    });

    return unsubscribe;
  }, []); // [] significa que executa apenas uma vez após a montagem

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