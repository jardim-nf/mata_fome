// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Navigate } from 'react-router-dom';

// Cria o contexto de autenticação
const AuthContext = createContext();

// Hook personalizado para usar o contexto de autenticação
export function useAuth() {
    return useContext(AuthContext);
}

// Componente PrivateRoute para proteger rotas baseadas em autenticação e papéis
export function PrivateRoute({ children, allowedRoles }) {
    const { currentUser, isAdmin, isMasterAdmin, loading } = useAuth();

    // Exibe um carregamento enquanto o estado de autenticação está sendo verificado
    if (loading) {
        return <div className="text-center p-8">Carregando permissões...</div>;
    }

    // Se não há usuário logado, redireciona para a página de login de admin
    if (!currentUser) {
        console.log("PrivateRoute Debug: No current user, redirecting to /login-admin.");
        return <Navigate to="/login-admin" />;
    }

    // Lógica de permissão baseada nos allowedRoles e nas claims do usuário
    // isAdmin e isMasterAdmin vêm agora diretamente das claims processadas no AuthProvider
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
    const [currentUser, setCurrentUser] = useState(null); // Objeto user do Firebase Auth
    const [profileData, setProfileData] = useState(null); // Dados do perfil do usuário (não as permissões) do Firestore
    const [isAdmin, setIsAdmin] = useState(false); // Permissão: true/false (vem das claims)
    const [isMasterAdmin, setIsMasterAdmin] = useState(false); // Permissão: true/false (vem das claims)
    const [estabelecimentoId, setEstabelecimentoId] = useState(null); // ID do estabelecimento (vem das claims)
    // isEstabelecimentoAtivo pode vir das claims ou do documento do estabelecimento
    const [isEstabelecimentoAtivo, setIsEstabelecimentoAtivo] = useState(false);
    const [loading, setLoading] = useState(true); // Controla o carregamento inicial do AuthContext

    // Função de logout
    const logout = async () => {
        console.log("AuthContext Debug: Attempting logout.");
        try {
            await signOut(auth);
            console.log("AuthContext Debug: Logout successful.");
        } catch (error) {
            console.error("AuthContext Error: Error during logout:", error);
            throw error; // Re-lança o erro para quem chamou
        }
    };

    // useEffect principal: Observa mudanças no estado de autenticação do Firebase
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("AuthContext Debug: [onAuthStateChanged] - Raw user object:", user);
            setCurrentUser(user); // Define o objeto user bruto do Firebase Auth

            if (user) {
                try {
                    // --- 1. Obtém as Custom Claims do Token (FONTE PRINCIPAL DE PERMISSÕES) ---
                    // Força o refresh para garantir que as claims mais recentes sejam carregadas
                    const idTokenResult = await user.getIdTokenResult(true);
                    console.log("AuthContext Debug: [onAuthStateChanged] - Fetched ID Token Result. Claims:", idTokenResult.claims);

                    // Extrai as claims e define os estados de permissão no contexto
                    const claimsIsAdmin = idTokenResult.claims.isAdmin === true;
                    const claimsIsMasterAdmin = idTokenResult.claims.isMasterAdmin === true;
                    const claimsEstabelecimentoId = idTokenResult.claims.estabelecimentoId || null;
                    // Tenta obter 'isEstabelecimentoAtivo' das claims primeiro, se existir
                    const claimsIsEstabelecimentoAtivo = idTokenResult.claims.isEstabelecimentoAtivo === true;

                    setIsAdmin(claimsIsAdmin);
                    setIsMasterAdmin(claimsIsMasterAdmin);
                    setEstabelecimentoId(claimsEstabelecimentoId);
                    
                    // Inicializa isEstabelecimentoAtivo com base na claim, se presente.
                    // Será ajustado abaixo se o estabelecimento for de fato inativo no Firestore.
                    setIsEstabelecimentoAtivo(claimsIsEstabelecimentoAtivo);

                    // --- 2. Busca Dados do Perfil do Firestore (OUTROS DADOS, NÃO PERMISSÕES) ---
                    // Busca dados do documento 'usuarios' ou 'clientes' associado ao UID
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
                    setProfileData(userDataFromFirestore); // Define os dados adicionais do perfil

                    // --- 3. VERIFICA ATIVAÇÃO DO ESTABELECIMENTO (se for admin de estabelecimento) ---
                    // Esta verificação complementar garante que o estabelecimento existe e está ativo no Firestore
                    // mesmo que a claim isEstabelecimentoAtivo esteja presente no token (para maior robustez).
                    if (claimsIsAdmin && !claimsIsMasterAdmin && claimsEstabelecimentoId) {
                        console.log(`AuthContext Debug: [onAuthStateChanged] - User is admin of establishment. Checking establishment status in Firestore for ID: ${claimsEstabelecimentoId}`);
                        const estabDocRef = doc(db, 'estabelecimentos', claimsEstabelecimentoId);
                        const estabDocSnap = await getDoc(estabDocRef);
                        if (estabDocSnap.exists() && estabDocSnap.data().ativo === true) {
                            console.log("AuthContext Debug: [onAuthStateChanged] - Linked establishment found and is ACTIVE.");
                            setIsEstabelecimentoAtivo(true); // Garante que é true se o doc no Firestore for ativo
                        } else {
                            console.warn("AuthContext Debug: [onAuthStateChanged] - Linked establishment NOT FOUND or is INACTIVE in Firestore.");
                            setIsEstabelecimentoAtivo(false); // Se não existir ou estiver inativo no Firestore, anula a claim
                        }
                    } else if (claimsIsMasterAdmin) {
                        // Master Admin sempre é considerado "ativo" para a lógica do painel principal
                        setIsEstabelecimentoAtivo(true);
                        console.log("AuthContext Debug: [onAuthStateChanged] - User is Master Admin. Assuming active status.");
                    } else {
                        // Clientes normais ou usuários sem estabelecimento associado também são "ativos" para navegação geral
                        setIsEstabelecimentoAtivo(true);
                        console.log("AuthContext Debug: [onAuthStateChanged] - User is not an admin. Assuming active status for general access.");
                    }
                    
                    console.log(`AuthContext Debug: [onAuthStateChanged] - Final Context States: Admin: ${claimsIsAdmin}, MasterAdmin: ${claimsIsMasterAdmin}, Estabelecimento ID: ${claimsEstabelecimentoId}, Estabelecimento Ativo: ${isEstabelecimentoAtivo}`); // Log final dos estados

                } catch (error) {
                    console.error("AuthContext Error: [onAuthStateChanged] - Failed to fetch user data or claims:", error);
                    // Resetar estados em caso de erro para evitar loops ou estados inconsistentes
                    setProfileData(null);
                    setIsAdmin(false);
                    setIsMasterAdmin(false);
                    setEstabelecimentoId(null);
                    setIsEstabelecimentoAtivo(false); // Assume inativo em caso de erro
                }

            } else {
                // Usuário deslogado: reseta todos os estados
                console.log("AuthContext Debug: [onAuthStateChanged] - User is null (logged out). Resetting all states.");
                setProfileData(null);
                setIsAdmin(false);
                setIsMasterAdmin(false);
                setEstabelecimentoId(null);
                setIsEstabelecimentoAtivo(false); // Deslogado = não ativo como estabelecimento
            }

            setLoading(false); // A autenticação inicial foi verificada, não importa o resultado
            console.log("AuthContext Debug: [onAuthStateChanged] - setLoading(false) called. AuthContext is ready.");
        });

        // Retorna a função de cleanup do useEffect: desinscreve o listener quando o componente é desmontado
        return unsubscribe;
    }, []); // Array de dependências vazio para rodar apenas uma vez na montagem do AuthProvider

    // Objeto de valor do contexto que será fornecido aos componentes filhos
    const value = {
        currentUser,
        currentClientData: profileData, // CORREÇÃO: Renomeado para 'currentClientData' para corresponder ao uso em outros componentes
        isAdmin,
        isMasterAdmin,
        estabelecimentoId,
        isEstabelecimentoAtivo,
        loading,
        logout,
    };

    // Renderiza os filhos apenas quando o carregamento inicial do AuthContext estiver completo
    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
            {loading && <div className="text-center p-8">Inicializando autenticação...</div>}
        </AuthContext.Provider>
    );
}