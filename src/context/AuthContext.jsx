// src/context/AuthContext.jsx
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
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase'; 
import { Navigate, useLocation, useNavigate } from 'react-router-dom'; 
import { toast } from 'react-toastify'; 

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

// FUNÇÃO AUXILIAR: Converte Map/Objeto para Array
// Isso protege o sistema caso existam dados antigos salvos como objeto
const mapToArray = (data) => {
    if (!data) return [];
    
    // Se for um objeto (mapa do Firestore) e não um array, pega as chaves (os IDs)
    if (typeof data === 'object' && !Array.isArray(data)) {
        return Object.keys(data);
    }
    
    return Array.isArray(data) ? data : [];
};

// ==========================================================
// FUNÇÕES DE BUSCA
// ==========================================================

const getFirestoreUserData = async (user) => { 
    try {
        console.log("🔍 Buscando dados do usuário no Firestore:", user.uid);
        
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            console.log("✅ Dados do usuário encontrados no Firestore:", data);
            return data;
        } 
        
        console.log("ℹ️ Documento /usuarios não encontrado para:", user.uid);
        return null;

    } catch (error) {
        console.error("❌ Erro ao buscar dados do usuário:", error);
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
    const [authChecked, setAuthChecked] = useState(false);

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
            
            setLoading(true);
            
            if (user) {
                console.log("👤 Usuário logado no AuthContext:", user.email);
                setCurrentUser(user); 
                
                let tokenResult;
                let claims = {};
                try {
                    // 🔥 FORÇA O REFRESH DO TOKEN
                    tokenResult = await user.getIdTokenResult(true); 
                    claims = tokenResult.claims || {};
                    console.log("🔐 Token Claims recebidas:", claims);
                } catch (e) { 
                    console.error("❌ Falha ao obter token result:", e); 
                }
                
                const firestoreData = await getFirestoreUserData(user);
                
                // Define Master/Admin pela claims
                const isMasterAdminFromClaims = Boolean(claims.isMasterAdmin);
                const isAdminFromClaims = Boolean(claims.isAdmin);
                
                // CRIA OU ATUALIZA DOCUMENTO NO FIRESTORE SE FOR ADMIN E NÃO EXISTIR
                if ((isMasterAdminFromClaims || isAdminFromClaims) && !firestoreData) {
                    console.log("🔄 Master/Admin detectado pelas claims, mas sem dados no Firestore. Criando documento...");
                    
                    const userDataToSave = {
                        uid: user.uid,
                        email: user.email,
                        nome: user.displayName || user.email.split('@')[0],
                        isAdmin: isAdminFromClaims,
                        isMasterAdmin: isMasterAdminFromClaims,
                        estabelecimentosGerenciados: [], // Inicializa como Array vazio
                        estabelecimentos: [],
                        ativo: true,
                        dataCriacao: new Date(),
                        dataAtualizacao: new Date(),
                        criadoPor: 'sistema-auth'
                    };
                    
                    try {
                        await setDoc(doc(db, 'usuarios', user.uid), userDataToSave);
                        console.log("✅ Documento do usuário criado no Firestore");
                    } catch (error) {
                        console.error("❌ Erro ao criar documento do usuário:", error);
                    }
                }

                // Converte Maps lidos (Firestore ou Claims) para Arrays usando a função auxiliar
                const docEstabs = mapToArray(firestoreData?.estabelecimentos);
                const docEstabsGerenciados = mapToArray(firestoreData?.estabelecimentosGerenciados);
                const claimEstabs = mapToArray(claims.estabelecimentos);
                const claimEstabsGerenciados = mapToArray(claims.estabelecimentosGerenciados);
                
                // Unifica IDs de estabelecimentos
                let allEstabs = [...new Set([
                    ...docEstabs, 
                    ...docEstabsGerenciados, 
                    ...claimEstabs,
                    ...claimEstabsGerenciados
                ])];

                // Se é Master Admin e não tem estabelecimentos, busca todos do sistema
                if (isMasterAdminFromClaims && allEstabs.length === 0) {
                    console.log("🔍 Master Admin sem estabelecimentos, buscando todos...");
                    try {
                        const estabelecimentosSnapshot = await getDocs(collection(db, 'estabelecimentos'));
                        allEstabs = estabelecimentosSnapshot.docs.map(doc => doc.id);
                        console.log("🏪 Todos os estabelecimentos do sistema:", allEstabs);
                    } catch (error) {
                        console.error("❌ Erro ao buscar estabelecimentos:", error);
                    }
                }

                console.log("🏪 IDs de estabelecimentos unificados:", allEstabs);

                // Define isMasterAdmin e isAdmin (Claims têm prioridade)
                const isMasterAdmin = isMasterAdminFromClaims || Boolean(firestoreData?.isMasterAdmin);
                // Define isAdmin: Claim, Firestore, OU (se não for Master) se gerencia > 0
                const isAdmin = isAdminFromClaims || Boolean(firestoreData?.isAdmin) || (allEstabs.length > 0 && !isMasterAdmin);


                // Combina dados do Firestore e Claims
                const combinedData = {
                    uid: user.uid,
                    email: user.email,
                    nome: firestoreData?.nome || user.displayName || user.email.split('@')[0],
                    ...firestoreData, // Mantém todos os dados do Firestore
                    
                    // Sobrescreve com valores processados
                    isAdmin,
                    isMasterAdmin,
                    
                    // Usa o array processado (seguro para .includes)
                    estabelecimentosGerenciados: allEstabs,
                    
                    estabelecimentoIdClaim: claims.estabelecimentoId || null,
                    dataAtualizacao: new Date(),
                    
                    _claims: claims
                };

                console.log("📋 Dados combinados do usuário:", combinedData);
                setUserData(combinedData);
                
                // Busca dados do cliente (se aplicável)
                try {
                    const clientDocRef = doc(db, 'clientes', user.uid);
                    const clientDocSnap = await getDoc(clientDocRef);
                    
                    if (clientDocSnap.exists()) {
                        const clientData = clientDocSnap.data();
                        console.log("✅ Dados do cliente encontrados:", clientData);
                        setCurrentClientData(clientData);
                    } else {
                        console.log("ℹ️ Nenhum dado de cliente encontrado para:", user.uid);
                        setCurrentClientData(null);
                    }
                } catch (clientError) {
                    console.error("❌ Erro ao buscar dados do cliente:", clientError);
                    setCurrentClientData(null);
                }

            } else {
                console.log("👤 Usuário deslogado no AuthContext");
                setCurrentUser(null);
                setUserData(null);
                setCurrentClientData(null);
            }
            
            setLoading(false);
            setAuthChecked(true);
        });

        return unsubscribe;
    }, []);
    
    // CÁLCULO DO ESTABELECIMENTO PRINCIPAL
    const primeiroEstabelecimento = userData?.estabelecimentosGerenciados?.[0] || null;

    // Valores expostos de forma consistente
    const isAdmin = Boolean(userData?.isAdmin);
    const isMasterAdmin = Boolean(userData?.isMasterAdmin);
    const estabelecimentosGerenciados = userData?.estabelecimentosGerenciados || [];

    // --- VALORES DO CONTEXTO ---
    const value = {
        currentUser, 
        userData, 
        currentClientData,
        
        // --- FUNÇÃO DE SIGNUP CORRIGIDA ---
        signup: async (email, password, additionalData = {}) => {
            try {
                console.log("📝 Iniciando cadastro para:", email);
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                if (additionalData.nome) {
                    await updateProfile(user, { displayName: additionalData.nome });
                }
                
                // CORREÇÃO AQUI: Salvando como ARRAY direto, não como Objeto/Map.
                // Isso evita o erro "includes is not a function" em outras partes do sistema.
                const userDataToSave = {
                    uid: user.uid,
                    email: user.email,
                    nome: additionalData.nome || user.email.split('@')[0],
                    isAdmin: additionalData.isAdmin || false,
                    isMasterAdmin: additionalData.isMasterAdmin || false,
                    // Garante que é salvo como array
                    estabelecimentosGerenciados: Array.isArray(additionalData.estabelecimentosGerenciados) ? additionalData.estabelecimentosGerenciados : [],
                    estabelecimentos: Array.isArray(additionalData.estabelecimentos) ? additionalData.estabelecimentos : [],
                    ativo: true,
                    dataCriacao: new Date(),
                    criadoPor: additionalData.criadoPor || 'sistema',
                    ...additionalData // Outros dados extras
                };
                
                console.log("💾 Salvando dados do usuário no Firestore:", userDataToSave);
                await setDoc(doc(db, 'usuarios', user.uid), userDataToSave);
                
                console.log("✅ Cadastro concluído com sucesso");
                return userCredential;
            } catch (error) {
                console.error("❌ Erro no signup:", error);
                throw error;
            }
        },

        // --- FUNÇÃO DE LOGIN ---
        login: async (email, password) => {
            console.log("🔐 Iniciando login para:", email);
            try {
                await setPersistence(auth, browserSessionPersistence);
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // APÓS LOGIN, FORÇA O REFRESH
                if (userCredential.user) {
                    await userCredential.user.getIdToken(true); 
                    window.location.reload(); 
                }

                console.log("✅ Login realizado com sucesso");
                return userCredential;
            } catch (error) {
                console.error("❌ Erro no login:", error);
                throw error;
            }
        },

        logout,

        updateUserProfile: async (updates) => {
            try {
                if (auth.currentUser) {
                    console.log("✏️ Atualizando perfil do usuário:", updates);
                    
                    if (updates.nome) {
                        await updateProfile(auth.currentUser, { displayName: updates.nome });
                    }
                    
                    const updateData = {};
                    if (updates.nome) updateData.nome = updates.nome;
                    if (updates.email) updateData.email = updates.email;
                    
                    if (Object.keys(updateData).length > 0) {
                        updateData.dataAtualizacao = new Date();
                        await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), updateData);
                    }
                    
                    setUserData(prev => prev ? { ...prev, ...updateData } : null);
                    
                    return true;
                }
                return false;
            } catch (error) {
                console.error("❌ Erro ao atualizar perfil:", error);
                throw error;
            }
        },

        reloadUserData: async () => {
            if (auth.currentUser) {
                console.log("🔄 Recarregando dados do usuário...");
                await auth.currentUser.getIdToken(true);
                window.location.reload(); 
            }
        },

        loading,
        authChecked,
        primeiroEstabelecimento,
        estabelecimentosGerenciados,
        isAdmin,
        isMaster: isMasterAdmin,
        isMasterAdmin,
        estabelecimentoIdPrincipal: primeiroEstabelecimento 
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// ==========================================================
// Hooks e Rotas Privadas
// ==========================================================

export function usePermissions() {
    const { currentUser, userData, loading, isAdmin, isMasterAdmin, estabelecimentosGerenciados } = useAuth();
    
    const canAccess = (requiredRoles = []) => {
        if (!currentUser || loading) return false;
        if (requiredRoles.length === 0) return true;
        
        return requiredRoles.some(role => {
            switch (role) {
                case 'admin':
                    return isAdmin;
                case 'masterAdmin':
                    return isMasterAdmin; 
                default:
                    return false;
            }
        });
    };

    const canManageEstabelecimento = (estabelecimentoId) => {
        if (!currentUser || loading) return false;
        if (isMasterAdmin) return true;
        
        // Agora estabelecimentosGerenciados é sempre um array (tratado no useEffect)
        return isAdmin && estabelecimentosGerenciados?.includes(estabelecimentoId);
    };

    return {
        canAccess,
        canManageEstabelecimento,
        isAdmin: isAdmin || false,
        isMasterAdmin: isMasterAdmin || false,
        estabelecimentosGerenciados: estabelecimentosGerenciados || [],
        loading,
    };
}

export function PrivateRoute({ children, allowedRoles = [], requiredEstabelecimento = null }) {
    const { currentUser, loading, authChecked } = useAuth();
    const { canAccess, canManageEstabelecimento } = usePermissions();
    const navigate = useNavigate();
    const location = useLocation();

    if (loading || !authChecked) { 
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
        toast.error('Acesso não autorizado');
        return <Navigate to="/" replace />;
    }
    
    if (requiredEstabelecimento) {
        if (!canManageEstabelecimento(requiredEstabelecimento)) { 
            toast.error('Sem permissão para gerenciar este estabelecimento');
            return <Navigate to="/" replace />; 
        }
    }

    return children;
}

export { AuthContext };