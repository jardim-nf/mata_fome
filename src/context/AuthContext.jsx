// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Navigate } from 'react-router-dom'; // Certifique-se de importar Navigate se PrivateRoute for um componente interno

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Componente PrivateRoute para proteger rotas - AGORA EXPORTADO
export function PrivateRoute({ children, allowedRoles }) { // Mudado para export function
  const { currentUser, isAdmin, isMasterAdmin, loading } = useAuth();

  if (loading) {
    return <div className="text-center p-8">Carregando...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login-admin" />;
  }

  // Lógica de permissão mais flexível
  if (allowedRoles.includes('admin') && isAdmin && !isMasterAdmin) {
    return children;
  }
  if (allowedRoles.includes('masterAdmin') && isMasterAdmin) {
    return children;
  }
  // Se nenhuma permissão for concedida e o usuário estiver logado, redireciona para a home ou exibe erro
  return <Navigate to="/" />; // Ou uma página de "Acesso Negado"
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
      console.log("AuthContext Debug: onAuthStateChanged - user:", user);

      if (user) {
        try {
          let userProfileData = null;
          let isAdminUser = false;
          let isMasterAdminUser = false;

          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            isAdminUser = userData.isAdmin || false;
            isMasterAdminUser = userData.isMasterAdmin || false;
            userProfileData = userData;

            if (isAdminUser && !isMasterAdminUser) {
              const estabQuery = query(collection(db, 'estabelecimentos'), where('adminUID', '==', user.uid));
              const estabSnapshot = await getDocs(estabQuery);
              if (!estabSnapshot.empty) {
                setIsEstabelecimentoAtivo(estabSnapshot.docs[0].data().ativo || false);
              } else {
                setIsEstabelecimentoAtivo(false);
              }
            } else {
              setIsEstabelecimentoAtivo(true);
            }
          }

          const clientDocRef = doc(db, 'clientes', user.uid);
          const clientDocSnap = await getDoc(clientDocRef);

          if (clientDocSnap.exists()) {
            userProfileData = { ...userProfileData, ...clientDocSnap.data() };
          }
          
          setCurrentClientData(userProfileData);
          setIsAdmin(isAdminUser);
          setIsMasterAdmin(isMasterAdminUser);
          console.log("AuthContext Debug: currentClientData setado para:", userProfileData);

        } catch (error) {
          console.error("AuthContext Error: Falha ao buscar dados do usuário.", error);
          setCurrentClientData(null);
          setIsAdmin(false);
          setIsMasterAdmin(false);
          setIsEstabelecimentoAtivo(false);
        }

      } else {
        console.log("AuthContext Debug: user is null (deslogado).");
        setCurrentClientData(null);
        setIsAdmin(false);
        setIsMasterAdmin(false);
        setIsEstabelecimentoAtivo(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ▼▼▼ CÓDIGO DE DEBUG TEMPORÁRIO ADICIONADO AQUI ▼▼▼
  // Este código vai ler as 'claims' do token assim que o usuário logar.
  useEffect(() => {
    if (currentUser) {
      console.log("INICIANDO DEBUG DO TOKEN...");
      
      // Força a atualização do token e busca as claims
      currentUser.getIdTokenResult(true) 
        .then((idTokenResult) => {
          // Imprime as claims no console para vermos as permissões
          console.log("!!!!!!!!!! CLAIMS DO TOKEN ATUAL !!!!!!!!!!");
          console.log(idTokenResult.claims);
          console.log("!!!!!!!!!! FIM DO DEBUG !!!!!!!!!!");
        })
        .catch((error) => {
          console.error("Erro ao obter o token e as claims:", error);
        });
    }
  }, [currentUser]); // Isso vai rodar sempre que o currentUser for definido ou mudar
  // ▲▲▲ FIM DO CÓDIGO DE DEBUG ▲▲▲

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