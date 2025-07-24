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
    const { currentUser, isAdmin, isMasterAdmin, isEstabelecimentoAtivo, loading, estabelecimentoId } = useAuth();

    console.log("PrivateRoute Debug: [RENDER] - Loading:", loading, "currentUser UID:", currentUser?.uid, "isAdmin:", isAdmin, "isMasterAdmin:", isMasterAdmin, "isEstabelecimentoAtivo:", isEstabelecimentoAtivo);

    // Exibe um carregamento enquanto o estado de autenticação está sendo verificado
    if (loading) {
        console.log("PrivateRoute Debug: Displaying loading permissions message.");
        return <div className="text-center p-8">Carregando permissões...</div>;
    }

    // Se não há usuário logado, redireciona para a página de login de admin
    if (!currentUser) {
        console.log("PrivateRoute Debug: No current user found, redirecting to /login-admin.");
        return <Navigate to="/login-admin" />;
    }

    // Se o usuário está logado mas o estabelecimento está inativo E ele é um admin de estabelecimento (não master)
    // Então, ele não pode acessar o painel de pedidos.
    if (!isMasterAdmin && isAdmin && estabelecimentoId && !isEstabelecimentoAtivo) {
        console.log("PrivateRoute Debug: User is an establishment admin but establishment is inactive. Redirecting to /.");
        return <Navigate to="/" />; 
    }

    console.log(`PrivateRoute Debug: Checking roles. User UID: ${currentUser.uid}, Is Admin: ${isAdmin}, Is Master Admin: ${isMasterAdmin}, Estabelecimento Ativo: ${isEstabelecimentoAtivo}. Allowed roles: [${allowedRoles.join(', ')}].`);

    if (allowedRoles.includes('admin') && isAdmin && !isMasterAdmin) {
        console.log("PrivateRoute Debug: User is admin (not master), allowed to access children.");
        return children;
    }
    if (allowedRoles.includes('masterAdmin') && isMasterAdmin) {
        console.log("PrivateRoute Debug: User is master admin, allowed to access children.");
        return children;
    }

    console.log("PrivateRoute Debug: User logged in but no allowed role matched. Redirecting to /.");
    return <Navigate to="/" />; 
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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("AuthContext Debug: [onAuthStateChanged] - Raw user object received:", user);
            setCurrentUser(user);

            if (user) {
                try {
                    const idTokenResult = await user.getIdTokenResult(true); 
                    console.log("AuthContext Debug: [onAuthStateChanged] - Fetched ID Token Result. Claims:", idTokenResult.claims);

                    const claimsIsAdmin = idTokenResult.claims.isAdmin === true;
                    const claimsIsMasterAdmin = idTokenResult.claims.isMasterAdmin === true;
                    const claimsEstabelecimentoId = idTokenResult.claims.estabelecimentoId || null;
                    const claimsIsEstabelecimentoAtivo = typeof idTokenResult.claims.isEstabelecimentoAtivo === 'boolean' 
                        ? idTokenResult.claims.isEstabelecimentoAtivo 
                        : null;

                    setIsAdmin(claimsIsAdmin);
                    setIsMasterAdmin(claimsIsMasterAdmin);
                    setEstabelecimentoId(claimsEstabelecimentoId);

                    let finalIsEstabelecimentoAtivo = false; 

                    if (claimsIsMasterAdmin) {
                        finalIsEstabelecimentoAtivo = true; 
                        console.log("AuthContext Debug: [onAuthStateChanged] - User is Master Admin. Final active status: TRUE.");
                    } else if (claimsIsAdmin && claimsEstabelecimentoId) {
                        if (claimsIsEstabelecimentoAtivo !== null) {
                            finalIsEstabelecimentoAtivo = claimsIsEstabelecimentoAtivo;
                            console.log(`AuthContext Debug: [onAuthStateChanged] - Admin of establishment. Active status from CLAIM: ${finalIsEstabelecimentoAtivo}`);
                        } else {
                            console.warn(`AuthContext Debug: [onAuthStateChanged] - 'isEstabelecimentoAtivo' claim not found or not boolean. Falling back to Firestore check for establishment status. Est ID: ${claimsEstabelecimentoId}`);
                            const estabDocRef = doc(db, 'estabelecimentos', claimsEstabelecimentoId);
                            const estabDocSnap = await getDoc(estabDocRef);
                            if (estabDocSnap.exists() && estabDocSnap.data().ativo === true) {
                                finalIsEstabelecimentoAtivo = true;
                                console.log("AuthContext Debug: [onAuthStateChanged] - Linked establishment found and is ACTIVE in Firestore (fallback).");
                            } else {
                                finalIsEstabelecimentoAtivo = false;
                                console.warn("AuthContext Debug: [onAuthStateChanged] - Linked establishment NOT FOUND or is INACTIVE in Firestore (fallback).");
                            }
                        }
                    } else {
                        finalIsEstabelecimentoAtivo = true;
                        console.log("AuthContext Debug: [onAuthStateChanged] - User is not an admin role. Final active status for general access: TRUE.");
                    }

                    setIsEstabelecimentoAtivo(finalIsEstabelecimentoAtivo); 

                    // --- 2. Busca Dados do Perfil do Firestore (OUTROS DADOS, NÃO PERMISSÕES) ---
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
                    } else {
                        console.log("AuthContext Debug: [onAuthStateChanged] - No additional profile data found in 'usuarios' or 'clientes'.");
                    }
                    setProfileData(userDataFromFirestore);
                    console.log("AuthContext Debug: [onAuthStateChanged] - Profile data from Firestore set.");

                    console.log(`AuthContext Debug: [onAuthStateChanged] - Final Context States after all checks: Admin: ${claimsIsAdmin}, MasterAdmin: ${claimsIsMasterAdmin}, Estabelecimento ID: ${claimsEstabelecimentoId}, Estabelecimento Ativo: ${finalIsEstabelecimentoAtivo}`); 

                } catch (error) {
                    console.error("AuthContext Error: [onAuthStateChanged] - Failed to fetch user data or claims:", error);
                    setProfileData(null);
                    setIsAdmin(false);
                    setIsMasterAdmin(false);
                    setEstabelecimentoId(null);
                    setIsEstabelecimentoAtivo(false);
                }

            } else {
                console.log("AuthContext Debug: [onAuthStateChanged] - User is null (logged out). Resetting all states.");
                setProfileData(null);
                setIsAdmin(false);
                setIsMasterAdmin(false);
                setEstabelecimentoId(null);
                setIsEstabelecimentoAtivo(false);
            }

            setLoading(false);
            console.log("AuthContext Debug: [onAuthStateChanged] - setLoading(false) called. AuthContext is ready.");
        });

        return unsubscribe;
    }, []);

    // Log para ver o que o AuthProvider está fornecendo a cada renderização
    console.log("AuthContext Debug: [RENDER] - AuthProvider's value being provided:", {
        currentUserUID: currentUser?.uid,
        loading: loading,
        isAdmin: isAdmin,
        isMasterAdmin: isMasterAdmin,
        isEstabelecimentoAtivo: isEstabelecimentoAtivo,
        estabelecimentoId: estabelecimentoId
    });

    const value = {
        currentUser,
        profileData,
        isAdmin,
        isMasterAdmin,
        estabelecimentoId,
        isEstabelecimentoAtivo,
        loading,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
            {loading && <div className="text-center p-8">Inicializando autenticação...</div>}
        </AuthContext.Provider>
    );
}