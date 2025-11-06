// src/context/AuthContext.js - VERSÃO CORRIGIDA

import React, { createContext, useState, useEffect, useContext } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    setPersistence,
    browserSessionPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; 
import { Navigate, useLocation, useNavigate } from 'react-router-dom'; 
import { toast } from 'react-toastify'; 

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

// ==========================================================
// FUNÇÕES DE BUSCA
// ==========================================================

const getFirestoreUserData = async (user) => { 
    try {
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (userDoc.exists()) {
            return userDoc.data();
        } else {
            const basicUserData = { 
                email: user.email, 
                nome: user.displayName || user.email.split('@')[0], 
                isAdmin: false, 
                isMasterAdmin: false, 
                estabelecimentosGerenciados: [],
                ativo: true, 
                createdAt: new Date(),
            };
            await setDoc(doc(db, 'usuarios', user.uid), basicUserData);
            return basicUserData;
        }
    } catch (error) {
        console.error("Erro ao buscar dados do usuário:", error);
        return null;
    }
};

const getFirestoreClientData = async (user) => {
    try {
        const clientDocRef = doc(db, 'clientes', user.uid);
        const clientDocSnap = await getDoc(clientDocRef);
        return clientDocSnap.exists() ? clientDocSnap.data() : null;
    } catch (error) {
        console.error("Erro ao buscar dados do cliente:", error);
        return null;
    }
};

// ==========================================================
// AuthProvider (Componente Principal - CORRIGIDO)
// ==========================================================

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null); 
    const [userData, setUserData] = useState(null); 
    const [currentClientData, setCurrentClientData] = useState(null); 
    const [loading, setLoading] = useState(true);

    const logout = async () => {
        try {
            await signOut(auth); 
            toast.success('Você foi desconectado com sucesso!');
        } catch (error) {
            console.error("Erro ao fazer Firebase signOut:", error);
            toast.error('Ocorreu um erro ao tentar desconectar.');
        } finally {
            setUserData(null);
            setCurrentUser(null);
            setCurrentClientData(null); 
        }
    };

    // UseEffect principal (carrega dados)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("👤 Usuário logado no AuthContext:", user.email);
                setCurrentUser(user); 
                
                let tokenResult = { claims: {} };
                try {
                    tokenResult = await user.getIdTokenResult(false); 
                } catch (e) { 
                    console.error("Falha ao obter token result:", e); 
                }
                const claims = tokenResult.claims;
                
                const firestoreData = await getFirestoreUserData(user); 
                
                const combinedData = {
                    ...firestoreData, 
                    isAdmin: claims.isAdmin || firestoreData?.isAdmin || false,
                    isMasterAdmin: claims.isMasterAdmin || firestoreData?.isMasterAdmin || false,
                    estabelecimentosGerenciados: claims.estabelecimentos || firestoreData?.estabelecimentosGerenciados || [],
                    estabelecimentoIdClaim: claims.estabelecimentoId || null, 
                };

                console.log("📋 Dados combinados do usuário:", {
                    isAdmin: combinedData.isAdmin,
                    isMasterAdmin: combinedData.isMasterAdmin,
                    estabelecimentos: combinedData.estabelecimentosGerenciados,
                    firestoreData: firestoreData
                });

                setUserData(combinedData);
                setCurrentClientData(await getFirestoreClientData(user));

            } else {
                console.log("👤 Usuário deslogado no AuthContext");
                setCurrentUser(null);
                setUserData(null);
                setCurrentClientData(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);
    
    // CÁLCULO DO ID PRINCIPAL
    const primeiroEstabelecimentoId = 
        userData?.estabelecimentosGerenciados?.[0] || null;

    // 🚨 CORREÇÃO: Expondo isAdmin e isMaster diretamente
    const isAdmin = userData?.isAdmin || false;
    const isMasterAdmin = userData?.isMasterAdmin || false;

    console.log("🔐 AuthContext valores expostos:", {
        currentUser: !!currentUser,
        isAdmin,
        isMasterAdmin,
        estabelecimentoIdPrincipal: primeiroEstabelecimentoId,
        userData: userData
    });

    // --- VALORES DO CONTEXTO ---
    const value = {
        currentUser, 
        userData, 
        currentClientData,
        signup: async (email, password, additionalData = {}) => {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                if (additionalData.nome) {
                    await updateProfile(user, { displayName: additionalData.nome });
                }
                
                const userDataToSave = {
                    email: user.email,
                    nome: additionalData.nome || user.email.split('@')[0],
                    isAdmin: additionalData.isAdmin || false,
                    isMasterAdmin: additionalData.isMasterAdmin || false,
                    estabelecimentosGerenciados: additionalData.estabelecimentosGerenciados || [],
                    ativo: true,
                    createdAt: new Date(),
                    ...additionalData
                };
                
                await setDoc(doc(db, 'usuarios', user.uid), userDataToSave);
                return userCredential;
            } catch (error) {
                console.error("Erro no signup:", error);
                throw error;
            }
        },
        login: (email, password) => {
            return setPersistence(auth, browserSessionPersistence)
                .then(() => signInWithEmailAndPassword(auth, email, password));
        },
        logout,
        updateUserProfile: async (updates) => {
            try {
                if (auth.currentUser) {
                    await updateProfile(auth.currentUser, updates);
                    
                    if (updates.nome || updates.email) {
                        await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), {
                            ...(updates.nome && { nome: updates.nome }),
                            ...(updates.email && { email: updates.email }),
                            atualizadoEm: new Date()
                        });
                    }
                    
                    return true;
                }
                return false;
            } catch (error) {
                console.error("Erro ao atualizar perfil:", error);
                throw error;
            }
        },
        loading,
        estabelecimentoIdPrincipal: primeiroEstabelecimentoId,
        // 🚨 CORREÇÃO: Expondo diretamente
        isAdmin,
        isMaster: isMasterAdmin,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children} 
        </AuthContext.Provider>
    );
}

// -----------------------------------------------------------
// usePermissions e PrivateRoute 
// -----------------------------------------------------------
export function usePermissions() {
    const { currentUser, userData, loading, isAdmin, isMaster } = useAuth();
    
    const canAccess = (requiredRoles = []) => {
        if (!currentUser || loading) return false;
        if (requiredRoles.length === 0) return true;
        
        return requiredRoles.some(role => {
            switch (role) {
                case 'admin':
                    return isAdmin;
                case 'masterAdmin':
                    return isMaster;
                default:
                    return false;
            }
        });
    };

    const canManageEstabelecimento = (estabelecimentoId) => {
        if (!currentUser || loading) return false;
        if (isMaster) return true;
        
        return isAdmin && 
               userData?.estabelecimentosGerenciados?.includes(estabelecimentoId);
    };

    return {
        canAccess,
        canManageEstabelecimento,
        isAdmin: isAdmin || false,
        isMasterAdmin: isMaster || false,
        loading,
    };
}

export function PrivateRoute({ children, allowedRoles = [], requiredEstabelecimento = null }) {
    const { currentUser, loading } = useAuth();
    const { canAccess, canManageEstabelecimento, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const location = useLocation();

    if (loading || permissionsLoading) { 
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            </div>
        ); 
    }

    if (!currentUser) {
        if (allowedRoles.includes('admin') || allowedRoles.includes('masterAdmin')) {
            return <Navigate to="/login-admin" state={{ from: location }} replace />;
        }
        return <Navigate to="/" replace />;
    }

    const hasRequiredRole = canAccess(allowedRoles);

    if (!hasRequiredRole) {
        return <Navigate to="/" replace />;
    }
    
    if (requiredEstabelecimento) {
        if (!canManageEstabelecimento(requiredEstabelecimento)) { 
            return <Navigate to="/" replace />; 
        }
    }

    return children;
}