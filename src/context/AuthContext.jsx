// src/context/AuthContext.jsx - CORRIGIDO (Exportando ID do Estabelecimento)
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
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase'; 
import { Navigate, useLocation } from 'react-router-dom'; 
import { toast } from 'react-toastify'; 

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

// FUNÇÃO AUXILIAR: Converte Map/Objeto para Array
const mapToArray = (data) => {
    if (!data) return [];
    if (typeof data === 'object' && !Array.isArray(data)) {
        return Object.keys(data);
    }
    return Array.isArray(data) ? data : [];
};

const getFirestoreUserData = async (user) => { 
    try {
        console.log("🔍 Buscando dados do usuário no Firestore:", user.uid);
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            return userDoc.data();
        } 
        return null;
    } catch (error) {
        console.error("❌ Erro ao buscar dados do usuário:", error);
        return null;
    }
};

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
            toast.error('Ocorreu um erro ao tentar desconectar.');
        } finally {
            setUserData(null);
            setCurrentUser(null);
            setCurrentClientData(null); 
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setLoading(true);
            
            if (user) {
                let tokenResult;
                let claims = {};
                try {
                    tokenResult = await user.getIdTokenResult(true); 
                    claims = tokenResult.claims || {};
                } catch (e) { 
                    console.error("❌ Falha token:", e); 
                }
                
                const firestoreData = await getFirestoreUserData(user);
                
                const isMasterAdminFromClaims = Boolean(claims.isMasterAdmin);
                const isAdminFromClaims = Boolean(claims.isAdmin);
                
                // Normaliza os IDs dos estabelecimentos
                const docEstabs = mapToArray(firestoreData?.estabelecimentos);
                const docEstabsGerenciados = mapToArray(firestoreData?.estabelecimentosGerenciados);
                const claimEstabs = mapToArray(claims.estabelecimentos);
                const claimEstabsGerenciados = mapToArray(claims.estabelecimentosGerenciados);
                
                let allEstabs = [...new Set([...docEstabs, ...docEstabsGerenciados, ...claimEstabs, ...claimEstabsGerenciados])];

                // Se for Master e não tiver nada, busca tudo (fallback)
                if (isMasterAdminFromClaims && allEstabs.length === 0) {
                    try {
                        const estres = await getDocs(collection(db, 'estabelecimentos'));
                        allEstabs = estres.docs.map(doc => doc.id);
                    } catch (error) { console.error(error); }
                }

                const isMasterAdmin = isMasterAdminFromClaims || Boolean(firestoreData?.isMasterAdmin);
                const isAdmin = isAdminFromClaims || (firestoreData?.isAdmin === true);

                const combinedData = {
                    uid: user.uid,
                    email: user.email,
                    nome: firestoreData?.nome || user.displayName || user.email.split('@')[0],
                    ...firestoreData,
                    isAdmin,
                    isMasterAdmin,
                    estabelecimentosGerenciados: allEstabs,
                    dataAtualizacao: new Date(),
                    _claims: claims
                };

                setCurrentUser(Object.assign(user, combinedData)); 
                setUserData(combinedData);
                
                try {
                    const clientDocRef = doc(db, 'clientes', user.uid);
                    const cd = await getDoc(clientDocRef);
                    if (cd.exists()) setCurrentClientData(cd.data());
                } catch (ce) {}

            } else {
                setCurrentUser(null);
                setUserData(null);
                setCurrentClientData(null);
            }
            
            setLoading(false);
            setAuthChecked(true);
        });

        return unsubscribe;
    }, []);
    
    // 🔥 CORREÇÃO PRINCIPAL AQUI:
    // Pega o primeiro estabelecimento da lista para usar como padrão nas queries
    const activeEstab = userData?.estabelecimentosGerenciados && userData.estabelecimentosGerenciados.length > 0 
        ? userData.estabelecimentosGerenciados[0] 
        : null;

    const value = {
        currentUser, userData, currentClientData, loading, authChecked,
        isAdmin: Boolean(userData?.isAdmin),
        isMasterAdmin: Boolean(userData?.isMasterAdmin),
        estabelecimentosGerenciados: userData?.estabelecimentosGerenciados || [],
        
        // 👇 ESTES DOIS CAMPOS ESTAVAM FALTANDO:
        primeiroEstabelecimento: activeEstab, // Usado pelo DashBoardSummary
        estabelecimentoIdPrincipal: activeEstab, // Usado pelo AdminReports
        
        signup: async (email, password, additionalData = {}) => {
            const uc = await createUserWithEmailAndPassword(auth, email, password);
            if (additionalData.nome) await updateProfile(uc.user, { displayName: additionalData.nome });
            
            const userDataToSave = {
                uid: uc.user.uid,
                email: email,
                nome: additionalData.nome,
                isAdmin: additionalData.isAdmin || false,
                isMasterAdmin: additionalData.isMasterAdmin || false,
                estabelecimentosGerenciados: Array.isArray(additionalData.estabelecimentosGerenciados) ? additionalData.estabelecimentosGerenciados : [],
                ativo: true,
                dataCriacao: new Date(),
                ...additionalData
            };
            await setDoc(doc(db, 'usuarios', uc.user.uid), userDataToSave);
            return uc;
        },
        login: async (email, password) => {
            await setPersistence(auth, browserSessionPersistence);
            const uc = await signInWithEmailAndPassword(auth, email, password);
            return uc;
        },
        logout,
        reloadUserData: async () => {
             if (auth.currentUser) {
                 await auth.currentUser.getIdToken(true);
                 window.location.reload(); 
             }
        }
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function usePermissions() {
    const { currentUser, loading, isAdmin, isMasterAdmin, estabelecimentosGerenciados } = useAuth();
    
    const canAccess = (requiredRoles = []) => {
        if (!currentUser || loading) return false;
        if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) return true;
        
        const userCargo = currentUser.cargo || '';
        const userCargoNorm = userCargo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        return requiredRoles.some(role => {
            if (role === 'admin') return isAdmin;
            if (role === 'masterAdmin') return isMasterAdmin;
            
            const roleNorm = role.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            return userCargoNorm === roleNorm;
        });
    };

    const canManageEstabelecimento = (estabelecimentoId) => {
        if (!currentUser || loading) return false;
        if (isMasterAdmin) return true;
        return estabelecimentosGerenciados?.includes(estabelecimentoId);
    };

    return { canAccess, canManageEstabelecimento };
}

export function PrivateRoute({ children, allowedRoles = [], requiredEstabelecimento = null }) {
    const { currentUser, loading, authChecked } = useAuth();
    const { canAccess, canManageEstabelecimento } = usePermissions();
    const location = useLocation();

    if (loading || !authChecked) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;

    if (!currentUser) {
        if (allowedRoles.includes('admin') || allowedRoles.includes('masterAdmin')) {
            return <Navigate to="/login-admin" state={{ from: location }} replace />;
        }
        return <Navigate to="/" replace />;
    }

    if (!canAccess(allowedRoles)) {
        return <Navigate to="/dashboard" replace />;
    }
    
    if (requiredEstabelecimento && !canManageEstabelecimento(requiredEstabelecimento)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

export { AuthContext };