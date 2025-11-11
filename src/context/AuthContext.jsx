// src/context/AuthContext.jsx - VERSÃO FINAL COM CORREÇÃO DE FALLBACK
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
// FUNÇÕES DE BUSCA - CORRIGIDAS
// ==========================================================

const getFirestoreUserData = async (user) => { 
    try {
        console.log("🔍 Buscando dados do usuário no Firestore:", user.uid);
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        
        if (userDoc.exists()) {
            console.log("✅ Dados do usuário encontrados no Firestore:", userDoc.data());
            return userDoc.data();
        } else {
            // ✅ CORREÇÃO: Não cria documento se não existir. Retorna null, o que é esperado para clientes.
            console.log("ℹ️ Documento de usuário/admin não encontrado. Assumindo cliente ou novo usuário.");
            return null;
        }
    } catch (error) {
        console.error("❌ Erro ao buscar dados do usuário:", error);
        return null;
    }
};

const getFirestoreClientData = async (user) => {
    try {
        console.log("🔍 Buscando dados do cliente:", user.uid);
        const clientDocRef = doc(db, 'clientes', user.uid);
        const clientDocSnap = await getDoc(clientDocRef);
        
        if (clientDocSnap.exists()) {
            console.log("✅ Dados do cliente encontrados:", clientDocSnap.data());
            return clientDocSnap.data();
        } else {
            console.log("ℹ️ Nenhum dado de cliente encontrado");
            return null;
        }
    } catch (error) {
        console.error("❌ Erro ao buscar dados do cliente:", error);
        return null;
    }
};

// ==========================================================
// AuthProvider (Componente Principal)
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
            console.error("❌ Erro ao fazer Firebase signOut:", error);
            toast.error('Ocorreu um erro ao tentar desconectar.');
        } finally {
            setUserData(null);
            setCurrentUser(null);
            setCurrentClientData(null); 
        }
    };

    // ==========================================================
    // UseEffect principal (carrega dados)
    // ==========================================================
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("🔄 onAuthStateChanged disparado, usuário:", user ? user.email : "null");
            
            if (user) {
                console.log("👤 Usuário logado no AuthContext:", user.email);
                setCurrentUser(user); 
                
                let tokenResult = { claims: {} };
                try {
                    tokenResult = await user.getIdTokenResult(true);
                    console.log("🔐 Token Claims recebidas:", tokenResult.claims);
                } catch (e) { 
                    console.error("❌ Falha ao obter token result:", e); 
                }
                const claims = tokenResult.claims;
                
                const firestoreData = await getFirestoreUserData(user); 
                
                // =========================================================
                // ✅ CORREÇÃO: Unifica todos os IDs de estabelecimento
                // =========================================================
                
                const docEstabs = firestoreData?.estabelecimentos || [];
                const docEstabsGerenciados = firestoreData?.estabelecimentosGerenciados || [];
                
                const claimEstabs = claims.estabelecimentos || [];
                
                const allEstabs = [...new Set([
                    ...docEstabs, 
                    ...docEstabsGerenciados, 
                    ...claimEstabs
                ])];
                
                console.log("🏪 IDs de estabelecimentos unificados:", allEstabs);

                // =========================================================
                
                // Combina dados do Firestore e Claims
                const combinedData = {
                    ...firestoreData, 
                    isAdmin: claims.isAdmin || firestoreData?.isAdmin || false,
                    isMasterAdmin: claims.isMasterAdmin || firestoreData?.isMasterAdmin || false,
                    
                    estabelecimentosGerenciados: allEstabs, 
                    
                    estabelecimentoIdClaim: claims.estabelecimentoId || null, 
                };

                console.log("📋 Dados combinados do usuário:", combinedData);
                setUserData(combinedData);
                
                // Busca dados do cliente
                const clientData = await getFirestoreClientData(user);
                setCurrentClientData(clientData);

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
    
    // CÁLCULO DO ESTABELECIMENTO PRINCIPAL
    const primeiroEstabelecimento = userData?.estabelecimentosGerenciados?.[0] || null;

    // Valores expostos de forma consistente
    const isAdmin = userData?.isAdmin || false;
    const isMasterAdmin = userData?.isMasterAdmin || false;

    console.log("🔐 AuthContext valores expostos:", {
        currentUser: !!currentUser,
        isAdmin,
        isMasterAdmin,
        primeiroEstabelecimento,
        estabelecimentosGerenciados: userData?.estabelecimentosGerenciados,
        userData: userData
    });

    // --- VALORES DO CONTEXTO ---
    const value = {
        currentUser, 
        userData, 
        currentClientData,
        signup: async (email, password, additionalData = {}) => {
            try {
                console.log("📝 Iniciando cadastro para:", email);
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
                    // ✅ ADICIONADO CAMPO FALTANTE
                    estabelecimentos: additionalData.estabelecimentos || [],
                    ativo: true,
                    createdAt: new Date(),
                    ...additionalData
                };
                
                console.log("💾 Salvando dados do usuário no Firestore:", userDataToSave);
                // NOTA: Para clientes, Home.jsx cria o doc de cliente separadamente.
                await setDoc(doc(db, 'usuarios', user.uid), userDataToSave);
                
                console.log("✅ Cadastro concluído com sucesso");
                return userCredential;
            } catch (error) {
                console.error("❌ Erro no signup:", error);
                throw error;
            }
        },
        login: (email, password) => {
            console.log("🔐 Iniciando login para:", email);
            return setPersistence(auth, browserSessionPersistence)
                .then(() => signInWithEmailAndPassword(auth, email, password));
        },
        logout,
        updateUserProfile: async (updates) => {
            try {
                if (auth.currentUser) {
                    console.log("✏️ Atualizando perfil do usuário:", updates);
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
                console.error("❌ Erro ao atualizar perfil:", error);
                throw error;
            }
        },
        loading,
        primeiroEstabelecimento,
        // ✅ GARANTE QUE O VALOR CORRETO (UNIFICADO) SEJA EXPOSTO
        estabelecimentosGerenciados: userData?.estabelecimentosGerenciados || [],
        isAdmin,
        isMaster: isMasterAdmin,
        isMasterAdmin: isMasterAdmin
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
    const { currentUser, userData, loading, isAdmin, isMaster, estabelecimentosGerenciados } = useAuth();
    
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
        
        return isAdmin && estabelecimentosGerenciados?.includes(estabelecimentoId);
    };

    return {
        canAccess,
        canManageEstabelecimento,
        isAdmin: isAdmin || false,
        isMasterAdmin: isMaster || false,
        estabelecimentosGerenciados: estabelecimentosGerenciados || [],
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