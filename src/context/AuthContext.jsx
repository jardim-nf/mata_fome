// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Função para buscar dados adicionais do usuário no Firestore
  const fetchUserData = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserData(userData);
        
        // Atualiza o currentUser com os dados do Firestore
        setCurrentUser(prev => ({
          ...prev,
          ...userData,
          uid: user.uid,
          email: user.email
        }));
        
        return userData;
      } else {
        // Se não existe documento, cria um básico
        const basicUserData = {
          email: user.email,
          nome: user.displayName || user.email.split('@')[0],
          isAdmin: false,
          isMasterAdmin: false,
          ativo: true,
          createdAt: new Date()
        };
        
        await setDoc(doc(db, 'usuarios', user.uid), basicUserData);
        setUserData(basicUserData);
        setCurrentUser(prev => ({
          ...prev,
          ...basicUserData,
          uid: user.uid,
          email: user.email
        }));
        
        return basicUserData;
      }
    } catch (error) {
      console.error("Erro ao buscar dados do usuário:", error);
      return null;
    }
  };

  // Signup function
  const signup = async (email, password, additionalData = {}) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Atualiza o perfil no Auth
    if (additionalData.nome) {
      await updateProfile(user, {
        displayName: additionalData.nome
      });
    }

    // Cria documento no Firestore
    const userData = {
      email: user.email,
      nome: additionalData.nome || user.email.split('@')[0],
      isAdmin: additionalData.isAdmin || false,
      isMasterAdmin: additionalData.isMasterAdmin || false,
      estabelecimentosGerenciados: additionalData.estabelecimentosGerenciados || [],
      ativo: true,
      createdAt: new Date(),
      ...additionalData
    };

    await setDoc(doc(db, 'usuarios', user.uid), userData);
    
    // Atualiza o estado local
    setUserData(userData);
    setCurrentUser({
      ...user,
      ...userData
    });

    return userCredential;
  };

  // Login function
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Logout function
  const logout = () => {
    setUserData(null);
    setCurrentUser(null);
    return signOut(auth);
  };

  // Update user profile
  const updateUserProfile = async (updates) => {
    if (!currentUser) return;

    try {
      // Atualiza no Auth se houver displayName
      if (updates.nome) {
        await updateProfile(auth.currentUser, {
          displayName: updates.nome
        });
      }

      // Atualiza no Firestore
      const userRef = doc(db, 'usuarios', currentUser.uid);
      await updateDoc(userRef, updates);

      // Atualiza estado local
      const updatedUserData = { ...userData, ...updates };
      setUserData(updatedUserData);
      setCurrentUser(prev => ({
        ...prev,
        ...updatedUserData
      }));

      return true;
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      throw error;
    }
  };

  // Check if user is admin
  const isAdmin = currentUser?.isAdmin || false;
  
  // Check if user is master admin
  const isMasterAdmin = currentUser?.isMasterAdmin || false;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Usuário está logado
        const userData = await fetchUserData(user);
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          ...userData
        });
      } else {
        // Usuário não está logado
        setCurrentUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    signup,
    login,
    logout,
    updateUserProfile,
    isAdmin,
    isMasterAdmin,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Componente PrivateRoute para proteger rotas
export function PrivateRoute({ children, allowedRoles = [] }) {
  const { currentUser, loading } = useAuth();
  
  useEffect(() => {
    // Logs de debug - REMOVA ESTES EM PRODUÇÃO
    if (process.env.NODE_ENV === 'development') {
      console.log("PrivateRoute Debug: Checking roles. User is Admin:", currentUser?.isAdmin, "MasterAdmin:", currentUser?.isMasterAdmin, "Allowed roles:", allowedRoles);
      
      if (currentUser?.isMasterAdmin) {
        console.log("PrivateRoute Debug: User is master admin, allowed to access.");
      }
    }
  }, [currentUser, allowedRoles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    // Redirecionar para login se não estiver autenticado
    window.location.href = '/login';
    return null;
  }

  // Verificar se o usuário tem pelo menos uma das roles permitidas
  const hasRequiredRole = allowedRoles.length === 0 || 
    allowedRoles.some(role => {
      switch (role) {
        case 'admin':
          return currentUser.isAdmin;
        case 'masterAdmin':
          return currentUser.isMasterAdmin;
        default:
          return false;
      }
    });

  if (!hasRequiredRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600 mb-6">
            Você não tem permissão para acessar esta página.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Voltar para o Início
          </button>
        </div>
      </div>
    );
  }

  return children;
}

// Hook personalizado para verificar permissões
export function usePermissions() {
  const { currentUser } = useAuth();
  
  const canAccess = (requiredRoles = []) => {
    if (!currentUser) return false;
    if (requiredRoles.length === 0) return true;
    
    return requiredRoles.some(role => {
      switch (role) {
        case 'admin':
          return currentUser.isAdmin;
        case 'masterAdmin':
          return currentUser.isMasterAdmin;
        default:
          return false;
      }
    });
  };

  const canManageEstabelecimento = (estabelecimentoId) => {
    if (!currentUser) return false;
    if (currentUser.isMasterAdmin) return true;
    
    return currentUser.isAdmin && 
           currentUser.estabelecimentosGerenciados?.includes(estabelecimentoId);
  };

  return {
    canAccess,
    canManageEstabelecimento,
    isAdmin: currentUser?.isAdmin || false,
    isMasterAdmin: currentUser?.isMasterAdmin || false
  };
}