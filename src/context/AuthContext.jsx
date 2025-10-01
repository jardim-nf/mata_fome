// src/context/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Navigate } from 'react-router-dom';

// Cria o contexto de autenticação
const AuthContext = createContext();

// Hook personalizado para usar o contexto de autenticação
export function useAuth() {
    return useContext(AuthContext);
}

// Componente PrivateRoute para proteger rotas baseadas em autenticação e papéis
export function PrivateRoute({ children, allowedRoles }) {
    // 1. Pega o estado de ativação do estabelecimento do contexto
    const { currentUser, isAdmin, isMasterAdmin, loading, isEstabelecimentoAtivo } = useAuth();

    // Exibe um carregamento enquanto o estado de autenticação está sendo verificado
    if (loading) {
        return <div className="text-center p-8">Carregando permissões...</div>;
    }

    // Se não há usuário logado, redireciona para a página de login de admin
    if (!currentUser) {
        console.log("PrivateRoute Debug: No current user, redirecting to /login-admin.");
        return <Navigate to="/login-admin" />;
    }

    // 2. Adiciona uma nova verificação para estabelecimentos inativos
    // Esta verificação acontece ANTES da verificação de papéis.
    // Se o usuário é um admin comum de um estabelecimento que foi desativado, ele será bloqueado.
    if (isAdmin && !isMasterAdmin && !isEstabelecimentoAtivo) {
        console.warn("PrivateRoute Debug: User is admin of an INACTIVE establishment. Access denied.");
        // O ideal é criar uma rota para informar sobre o status inativo.
        // Se não tiver, pode redirecionar para "/" e fazer logout.
        return <Navigate to="/estabelecimento-inativo" />; 
    }

    // Lógica de permissão baseada nos allowedRoles e nas claims do usuário
    console.log(`PrivateRoute Debug: Checking roles. User is Admin: ${isAdmin}, MasterAdmin: ${isMasterAdmin}. Allowed roles: ${allowedRoles.join(', ')}`);

    if (allowedRoles.includes('admin') && isAdmin && !isMasterAdmin) {
        console.log("PrivateRoute Debug: User is admin (not master), allowed to access.");
        return children;
    }
    if (allowedRoles.includes('masterAdmin') && isMasterAdmin) {
        console.log("PrivateRoute Debug: User is master admin, allowed to access.");
        return children;
    }

    // Se nenhuma permissão for concedida e o usuário estiver logado, redireciona para a home ou exibe erro
    console.log("PrivateRoute Debug: User logged in but no allowed role matched. Redirecting to /.");
    return <Navigate to="/" />; // Ou uma página de "Acesso Negado"
}

// Provedor de autenticação que gerencia o estado do usuário
export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isMasterAdmin, setIsMasterAdmin] = useState(false);
    const [estabelecimentoId, setEstabelecimentoId] = useState(null);
    const [isEstabelecimentoAtivo, setIsEstabelecimentoAtivo] = useState(false);
    const [loading, setLoading] = useState(true);
    const [cashbackBalance, setCashbackBalance] = useState(0);

    // Função de logout
    const logout = async () => {
        console.log("AuthContext Debug: Attempting logout.");
        try {
            await signOut(auth);
            console.log("AuthContext Debug: Logout successful.");
        } catch (error) {
            console.error("AuthContext Error: Error during logout:", error);
            throw error;
        }
    };

    // useEffect principal: Observa mudanças no estado de autenticação do Firebase
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("AuthContext Debug: [onAuthStateChanged] - Raw user object:", user);
            setCurrentUser(user);

            if (user) {
                try {
                    const idTokenResult = await user.getIdTokenResult(true);
                    console.log("AuthContext Debug: [onAuthStateChanged] - Fetched ID Token Result. Claims:", idTokenResult.claims);

                    const claimsIsAdmin = idTokenResult.claims.isAdmin === true;
                    const claimsIsMasterAdmin = idTokenResult.claims.isMasterAdmin === true;
                    const claimsEstabelecimentoId = idTokenResult.claims.estabelecimentoId || null;
                    
                    setIsAdmin(claimsIsAdmin);
                    setIsMasterAdmin(claimsIsMasterAdmin);
                    setEstabelecimentoId(claimsEstabelecimentoId);
                    
                    let userDataFromFirestore = null;
                    const userDocRef = doc(db, 'usuarios', user.uid);
                    const clientDocRef = doc(db, 'clientes', user.uid);

                    const [userDocSnap, clientDocSnap] = await Promise.all([
                        getDoc(userDocRef),
                        getDoc(clientDocRef)
                    ]);

                    if (userDocSnap.exists()) {
                        userDataFromFirestore = userDocSnap.data();
                        console.log("AuthContext Debug: [onAuthStateChanged] - Found user data in 'usuarios' collection.");
                    } else if (clientDocSnap.exists()) {
                        userDataFromFirestore = clientDocSnap.data();
                        console.log("AuthContext Debug: [onAuthStateChanged] - Found user data in 'clientes' collection.");
                        setCashbackBalance(userDataFromFirestore.cashbackBalance || 0);
                        console.log(`AuthContext Debug: [onAuthStateChanged] - Fetched cashback balance: ${userDataFromFirestore.cashbackBalance || 0}`);
                    } else {
                        console.log("AuthContext Debug: [onAuthStateChanged] - No additional profile data found in 'usuarios' or 'clientes'.");
                    }
                    setProfileData(userDataFromFirestore);
                    
                    if (claimsIsAdmin && !claimsIsMasterAdmin && claimsEstabelecimentoId) {
                        console.log(`AuthContext Debug: [onAuthStateChanged] - User is admin of establishment. Checking establishment status in Firestore for ID: ${claimsEstabelecimentoId}`);
                        const estabDocRef = doc(db, 'estabelecimentos', claimsEstabelecimentoId);
                        const estabDocSnap = await getDoc(estabDocRef);
                        if (estabDocSnap.exists() && estabDocSnap.data().ativo === true) {
                            console.log("AuthContext Debug: [onAuthStateChanged] - Linked establishment found and is ACTIVE.");
                            setIsEstabelecimentoAtivo(true);
                        } else {
                            console.warn("AuthContext Debug: [onAuthStateChanged] - Linked establishment NOT FOUND or is INACTIVE in Firestore.");
                            setIsEstabelecimentoAtivo(false);
                        }
                    } else if (claimsIsMasterAdmin) {
                        setIsEstabelecimentoAtivo(true);
                        console.log("AuthContext Debug: [onAuthStateChanged] - User is Master Admin. Assuming active status.");
                    } else {
                        setIsEstabelecimentoAtivo(true);
                        console.log("AuthContext Debug: [onAuthStateChanged] - User is not an admin. Assuming active status for general access.");
                    }
                    
                } catch (error) {
                    console.error("AuthContext Error: [onAuthStateChanged] - Failed to fetch user data or claims:", error);
                    setProfileData(null);
                    setIsAdmin(false);
                    setIsMasterAdmin(false);
                    setEstabelecimentoId(null);
                    setIsEstabelecimentoAtivo(false);
                    setCashbackBalance(0);
                }

            } else {
                console.log("AuthContext Debug: [onAuthStateChanged] - User is null (logged out). Resetting all states.");
                setProfileData(null);
                setIsAdmin(false);
                setIsMasterAdmin(false);
                setEstabelecimentoId(null);
                setIsEstabelecimentoAtivo(false);
                setCashbackBalance(0);
            }

            setLoading(false);
            console.log("AuthContext Debug: [onAuthStateChanged] - setLoading(false) called. AuthContext is ready.");
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        currentClientData: profileData,
        isAdmin,
        isMasterAdmin,
        estabelecimentoId,
        isEstabelecimentoAtivo,
        loading,
        logout,
        cashbackBalance,
        setCashbackBalance,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
            {loading && <div className="text-center p-8">Inicializando autenticação...</div>}
        </AuthContext.Provider>
    );
}