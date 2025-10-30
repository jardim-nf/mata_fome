// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  // Importado da correção anterior
  setPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
// Importado da correção anterior
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // CORREÇÃO: Separamos o usuário do Firebase e os dados do Firestore
  const [currentUser, setCurrentUser] = useState(null); // <-- Objeto RAW do Firebase
  const [userData, setUserData] = useState(null); // <-- Objeto do Firestore (com isAdmin)
  const [loading, setLoading] = useState(true);

  // Função para buscar dados adicionais do usuário no Firestore
  const fetchUserData = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data); // <-- CORREÇÃO: Apenas define os dados do Firestore
        return data;
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
        setUserData(basicUserData); // <-- CORREÇÃO: Apenas define os dados do Firestore
        return basicUserData;
      }
    } catch (error) {
      console.error("Erro ao buscar dados do usuário:", error);
      setUserData(null); // Limpa em caso de erro
      return null;
    }
  };

  // Signup function
  const signup = async (email, password, additionalData = {}) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (additionalData.nome) {
      await updateProfile(user, { displayName: additionalData.nome });
    }

    const newUserData = {
      email: user.email,
      nome: additionalData.nome || user.email.split('@')[0],
      isAdmin: additionalData.isAdmin || false,
      isMasterAdmin: additionalData.isMasterAdmin || false,
      estabelecimentosGerenciados: additionalData.estabelecimentosGerenciados || [],
      ativo: true,
      createdAt: new Date(),
      ...additionalData
    };

    await setDoc(doc(db, 'usuarios', user.uid), newUserData);
    
    // Atualiza o estado local
    setUserData(newUserData);
    // O currentUser será definido pelo onAuthStateChanged

    return userCredential;
  };

  // Login function (Correto da última vez)
  const login = (email, password) => {
    return setPersistence(auth, browserSessionPersistence)
        .then(() => {
            return signInWithEmailAndPassword(auth, email, password);
        });
  };

  // Logout function (Correto)
  const logout = () => {
    setUserData(null);
    setCurrentUser(null);
    return signOut(auth);
  };

  // Update user profile
  const updateUserProfile = async (updates) => {
    if (!currentUser) return;

    try {
      if (updates.nome) {
        await updateProfile(auth.currentUser, { displayName: updates.nome });
      }

      const userRef = doc(db, 'usuarios', currentUser.uid);
      await updateDoc(userRef, updates);

      // Atualiza estado local
      const updatedUserData = { ...userData, ...updates };
      setUserData(updatedUserData); // <-- CORREÇÃO: Apenas atualiza userData

      return true;
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      throw error;
    }
  };

  // CORREÇÃO: As permissões vêm do 'userData' (Firestore)
  const isAdmin = userData?.isAdmin || false;
  const isMasterAdmin = userData?.isMasterAdmin || false;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Usuário está logado
        // CORREÇÃO: Define currentUser como o objeto RAW do Firebase
        setCurrentUser(user); 
        // E busca os dados do Firestore (que define o 'userData')
        await fetchUserData(user);
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
    currentUser, // <-- Objeto RAW (com .getIdTokenResult)
    userData, // <-- Objeto do Firestore (com .isAdmin)
    signup,
    login,
    logout,
    updateUserProfile,
    isAdmin, // <-- Derivado do userData
    isMasterAdmin, // <-- Derivado do userData
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
  // CORREÇÃO: Pegamos os valores de permissão direto do hook
  const { currentUser, isAdmin, isMasterAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Este log agora usa as variáveis corretas
      console.log("PrivateRoute Debug: Checking roles. User is Admin:", isAdmin, "MasterAdmin:", isMasterAdmin, "Allowed roles:", allowedRoles);
    }
  }, [currentUser, isAdmin, isMasterAdmin, allowedRoles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  // Lógica de redirecionamento (Correta da última vez)
  if (!currentUser) {
    if (allowedRoles.length > 0 && (allowedRoles.includes('admin') || allowedRoles.includes('masterAdmin'))) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // CORREÇÃO: Verificar se o usuário tem as roles usando as variáveis do hook
  const hasRequiredRole = allowedRoles.length === 0 || 
      (allowedRoles.includes('admin') && isAdmin) ||
      (allowedRoles.includes('masterAdmin') && isMasterAdmin);


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
            onClick={() => navigate('/')}
            className="bg-yellow-500 text-black px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
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
  // CORREÇÃO: Ler do 'userData'
  const { currentUser, userData } = useAuth();
  
  const canAccess = (requiredRoles = []) => {
    if (!currentUser) return false;
    if (requiredRoles.length === 0) return true;
    
    return requiredRoles.some(role => {
      switch (role) {
        case 'admin':
          return userData?.isAdmin;
        case 'masterAdmin':
          return userData?.isMasterAdmin;
        default:
          return false;
      }
    });
  };

  const canManageEstabelecimento = (estabelecimentoId) => {
    if (!currentUser) return false;
    if (userData?.isMasterAdmin) return true;
    
    return userData?.isAdmin && 
           userData?.estabelecimentosGerenciados?.includes(estabelecimentoId);
  };

  return {
    canAccess,
    canManageEstabelecimento,
    isAdmin: userData?.isAdmin || false,
    isMasterAdmin: userData?.isMasterAdmin || false
  };
}