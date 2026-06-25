// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    setPersistence,
    browserSessionPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db, messaging } from '../firebase'; 
import { getToken } from 'firebase/messaging';
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
    const [modoManutencao, setModoManutencao] = useState(false);
    
    // Novo estado para controlar o estabelecimento selecionado na sessão
    const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState(() => {
        return localStorage.getItem('selectedEstabelecimentoId') || null;
    });

    const isProcessingAuth = useRef(false); 

    // Real-time listener for global maintenance mode
    useEffect(() => {
        const docRef = doc(db, 'configuracoesGlobais', 'sistema');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setModoManutencao(!!docSnap.data().modoManutencao);
            } else {
                setModoManutencao(false);
            }
        }, (error) => {
            console.error("Erro ao escutar configuracoesGlobais no AuthContext:", error);
            setModoManutencao(false);
        });

        return () => unsubscribe();
    }, []); 

    const setEstabelecimentoAtual = (id) => {
        if (id) {
            localStorage.setItem('selectedEstabelecimentoId', id);
            setSelectedEstabelecimentoId(id);
        } else {
            localStorage.removeItem('selectedEstabelecimentoId');
            setSelectedEstabelecimentoId(null);
        }
    };

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
            setEstabelecimentoAtual(null); // Limpa a seleção ao deslogar
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (isProcessingAuth.current) {
                return;
            }
            isProcessingAuth.current = true;
            setLoading(true);
            
            try {
                if (user) {
                    let tokenResult;
                    let claims = {};
                    try {
                        tokenResult = await user.getIdTokenResult(false); 
                        claims = tokenResult.claims || {};
                    } catch (e) { 
                        console.error("❌ Falha token:", e); 
                    }
                    
                    const firestoreData = await getFirestoreUserData(user);
                    if (import.meta.env.DEV) console.log('📦 Firestore data:', { cargo: firestoreData?.cargo, isAdmin: firestoreData?.isAdmin });
                    
                    const isMasterAdmin = Boolean(claims.isMasterAdmin) || Boolean(firestoreData?.isMasterAdmin);
                    const isAdmin = Boolean(claims.isAdmin) || Boolean(firestoreData?.isAdmin) || isMasterAdmin;
                    
                    const docEstabs = mapToArray(firestoreData?.estabelecimentos);
                    const docEstabsGerenciados = mapToArray(firestoreData?.estabelecimentosGerenciados);
                    const claimEstabs = mapToArray(claims.estabelecimentos);
                    const claimEstabsGerenciados = mapToArray(claims.estabelecimentosGerenciados);
                    
                    let allEstabs = [...new Set([...docEstabs, ...docEstabsGerenciados, ...claimEstabs, ...claimEstabsGerenciados])];

                    if ((isMasterAdmin || isAdmin) && allEstabs.length === 0) {
                        try {
                            const estres = await getDocs(collection(db, 'estabelecimentos'));
                            allEstabs = estres.docs.map(doc => doc.id);
                        } catch (error) { console.error(error); }
                    }

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

                    if (import.meta.env.DEV) console.log('✅ auth ok:', { cargo: combinedData.cargo, isAdmin, isMasterAdmin });
                    setCurrentUser({ ...user, ...combinedData });
                    setUserData(combinedData);
                    
                    try {
                        const clientDocRef = doc(db, 'clientes', user.uid);
                        const cd = await getDoc(clientDocRef);
                        if (cd.exists()) setCurrentClientData(cd.data());
                    } catch (ce) { console.error('[AuthContext] Erro ao buscar dados do cliente:', ce); }

                } else {
                    setCurrentUser(null);
                    setUserData(null);
                    setCurrentClientData(null);
                }
            } catch (err) {
                // Catch-all para não deixar o loading preso em caso de erro inesperado
                console.error('❌ Erro crítico no AuthContext:', err);
            } finally {
                // CORREÇÃO CRÍTICA: Sempre libera o lock e o loading, mesmo em caso de erro.
                // Antes disso, um erro silencioso deixaria loading=true para sempre (tela branca).
                isProcessingAuth.current = false;
                setLoading(false);
                setAuthChecked(true);
            }
        });

        return unsubscribe;
    }, []);
    
    // Se tiver um selecionado e for válido na lista de gerenciados, usamos ele. 
    // Para Master Admin, permitimos qualquer estabelecimento selecionado.
    // Caso contrário, fallback para o primeiro.
    const activeEstab = selectedEstabelecimentoId && (userData?.isMasterAdmin || userData?.estabelecimentosGerenciados?.includes(selectedEstabelecimentoId))
        ? selectedEstabelecimentoId
        : (userData?.estabelecimentosGerenciados && userData.estabelecimentosGerenciados.length > 0 
            ? userData.estabelecimentosGerenciados[0] 
            : null);

    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);

    useEffect(() => {
        if (!activeEstab) {
            setEstabelecimentoInfo(null);
            return;
        }

        const docRef = doc(db, 'estabelecimentos', activeEstab);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setEstabelecimentoInfo({ id: docSnap.id, ...docSnap.data() });
            } else {
                setEstabelecimentoInfo(null);
            }
        }, (error) => {
            console.error("Erro ao escutar estabelecimento no AuthContext:", error);
            setEstabelecimentoInfo(null);
        });

        return () => unsubscribe();
    }, [activeEstab]);

    const value = {
        currentUser, userData, currentClientData, loading, authChecked,
        isAdmin: Boolean(userData?.isAdmin),
        isMasterAdmin: Boolean(userData?.isMasterAdmin),
        estabelecimentosGerenciados: userData?.estabelecimentosGerenciados || [],
        primeiroEstabelecimento: activeEstab, 
        estabelecimentoIdPrincipal: activeEstab, 
        selectedEstabelecimentoId,
        setEstabelecimentoAtual,
        estabelecimentoInfo,
        modoManutencao,
        
        signup: async (email, password, additionalData = {}) => {
            const uc = await createUserWithEmailAndPassword(auth, email, password);
            if (additionalData.nome) await updateProfile(uc.user, { displayName: additionalData.nome });
           const { isAdmin, isMasterAdmin, _claims, ...dadosSeguros } = additionalData;
            const userDataToSave = {
                uid: uc.user.uid,
                email: email,
                nome: additionalData.nome,
                isAdmin: false,       
                isMasterAdmin: false,
                estabelecimentosGerenciados: Array.isArray(additionalData.estabelecimentosGerenciados) ? additionalData.estabelecimentosGerenciados : [],
                ativo: true,
                dataCriacao: new Date(),
                ...dadosSeguros 
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
                const tokenResult = await auth.currentUser.getIdTokenResult(true);
                const claims = tokenResult.claims || {};
                const freshData = await getFirestoreUserData(auth.currentUser);
                if (freshData) {
                    const isMasterAdmin = Boolean(claims.isMasterAdmin) || Boolean(freshData.isMasterAdmin);
                    const isAdmin = Boolean(claims.isAdmin) || Boolean(freshData.isAdmin) || isMasterAdmin;

                    const docEstabs = mapToArray(freshData.estabelecimentos);
                    const docEstabsGerenciados = mapToArray(freshData.estabelecimentosGerenciados);
                    const claimEstabs = mapToArray(claims.estabelecimentos);
                    const claimEstabsGerenciados = mapToArray(claims.estabelecimentosGerenciados);
                    let allEstabs = [...new Set([...docEstabs, ...docEstabsGerenciados, ...claimEstabs, ...claimEstabsGerenciados])];

                    const updatedData = {
                        uid: auth.currentUser.uid,
                        email: auth.currentUser.email,
                        nome: freshData.nome || auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
                        ...freshData,
                        isAdmin,
                        isMasterAdmin,
                        estabelecimentosGerenciados: allEstabs.length > 0 ? allEstabs : (userData?.estabelecimentosGerenciados || []),
                        _claims: claims
                    };
                    setUserData(updatedData);
                    setCurrentUser(prev => ({ ...prev, ...updatedData }));
                }
            }
        },
        requestPushPermission: async () => {
            try {
                if (!('Notification' in window)) return false;
                
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    const msg = await messaging();
                    if (!msg) return false;
                    
                    // IMPORTANTE: Chave VAPID injetada do Firebase Console
                    const vapidKey = 'BGIHYH0t-g1loGSJu2JdlWQe7WFJ-XhRHva0THgkEqibF-rreWpJYIoqCY6nS7n1WsvD8wxaTzQh2my6wHNDxc8'; 
                    
                    try {
                        const currentToken = await getToken(msg, { vapidKey });
                        if (currentToken && currentUser?.uid) {
                            // Salva no Firestore do cliente
                            const clientRef = doc(db, 'clientes', currentUser.uid);
                            await updateDoc(clientRef, {
                                fcmToken: currentToken,
                                updatedAt: new Date()
                            });
                            console.log('✅ Token FCM salvo com sucesso.');
                            return true;
                        }
                    } catch (e) {
                        console.warn("⚠️ FCM getToken falhou. Geralmente requer rodar em HTTPS e uma chave VAPID real.", e);
                    }
                }
                return false;
            } catch (error) {
                console.error("Erro ao solicitar permissão de Push", error);
                return false;
            }
        }
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 🔥 AQUI ESTÁ A CORREÇÃO PRINCIPAL QUE IMPEDE A TELA DE PISCAR/QUEBRAR
export function usePermissions() {
    const { currentUser, loading, isAdmin, isMasterAdmin, estabelecimentosGerenciados } = useAuth();
    
    const canAccess = (requiredRoles = []) => {
        if (!currentUser || loading) {
            return false;
        }
        if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) return true;
        
        // Admin e Master passam direto
        if (isMasterAdmin && requiredRoles.includes('masterAdmin')) return true;
        if (isAdmin && requiredRoles.includes('admin')) return true;

        // Pega o cargo do usuário e transforma em array se não for
        const userCargoRaw = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || ''];
        
        // Remove acentos e joga tudo para minúsculo
        const userCargosNorm = userCargoRaw.map(c => 
            String(c).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        );

        // Verifica se algum dos cargos dele bate com as rotas permitidas
        const result = requiredRoles.some(role => {
            const roleNorm = String(role).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            return userCargosNorm.includes(roleNorm);
        });

        if (import.meta.env.DEV) console.log('🔐 canAccess:', { userCargosNorm, requiredRoles, result });
        return result;
    };

    const canManageEstabelecimento = (estabelecimentoId) => {
        if (!currentUser || loading) return false;
        if (isMasterAdmin) return true;
        return estabelecimentosGerenciados?.includes(estabelecimentoId);
    };

    return { canAccess, canManageEstabelecimento };
}

export function PrivateRoute({ children, allowedRoles = [], requiredEstabelecimento = null }) {
    const { currentUser, loading, authChecked, userData, selectedEstabelecimentoId, estabelecimentoIdPrincipal, estabelecimentoInfo, logout, modoManutencao } = useAuth();
    const { canAccess, canManageEstabelecimento } = usePermissions();
    const location = useLocation();

    if (loading || !authChecked || (estabelecimentoIdPrincipal && !estabelecimentoInfo)) {
        return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
    }

    if (!currentUser) {
        if (allowedRoles.includes('admin') || allowedRoles.includes('masterAdmin')) {
            return <Navigate to="/login-admin" state={{ from: location }} replace />;
        }
        return <Navigate to="/" replace />;
    }

    // Bloqueio de manutenção global
    if (modoManutencao && !userData?.isMasterAdmin) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden text-slate-100 font-sans p-6 text-center">
                {/* Background glow effects */}
                <div className="absolute top-[20%] left-1/4 w-[300px] h-[300px] rounded-full bg-orange-500/10 blur-[80px]" />
                <div className="absolute bottom-[20%] right-1/4 w-[300px] h-[300px] rounded-full bg-yellow-500/10 blur-[80px]" />
                
                <div className="relative z-10 flex flex-col items-center gap-6 max-w-md">
                    <div className="relative w-24 h-24 rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-xl shadow-2xl p-5 flex items-center justify-center animate-pulse">
                        <span className="text-5xl">🔧</span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black bg-gradient-to-r from-orange-400 to-yellow-500 bg-clip-text text-transparent mb-3 uppercase tracking-tight">
                            Sistema em Manutenção
                        </h2>
                        <p className="text-base text-slate-400 font-medium">
                            Estamos realizando uma manutenção global preventiva no sistema. Voltaremos em breve!
                        </p>
                    </div>
                    <div className="w-16 h-1 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full mt-2" />
                    <button 
                        onClick={() => logout()}
                        className="mt-6 w-full py-3.5 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 text-slate-450"
                    >
                        Sair da Conta
                    </button>
                </div>
            </div>
        );
    }

    // Bloqueio em tempo real de estabelecimentos suspensos
    if (!userData?.isMasterAdmin && estabelecimentoInfo?.ativo === false) {
        const motivo = estabelecimentoInfo.suspensaoMotivo || "O acesso operacional ao sistema está suspenso temporariamente.";
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden text-slate-100 font-sans p-6 text-center">
                {/* Background glow effects */}
                <div className="absolute top-[20%] left-1/4 w-[300px] h-[300px] rounded-full bg-red-500/10 blur-[80px]" />
                <div className="absolute bottom-[20%] right-1/4 w-[300px] h-[300px] rounded-full bg-rose-500/10 blur-[80px]" />
                
                <div className="relative z-10 flex flex-col items-center gap-6 max-w-md">
                    <div className="relative w-24 h-24 rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-xl shadow-2xl p-5 flex items-center justify-center">
                        <span className="text-5xl">🔐</span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent mb-3 uppercase tracking-tight">
                            Acesso Suspenso
                        </h2>
                        <p className="text-base text-slate-400 font-medium">
                            {motivo}
                        </p>
                        <p className="text-xs text-slate-500 mt-2 font-semibold">
                            Se você é o proprietário, entre em contato com o suporte da rede para regularizar a situação.
                        </p>
                    </div>
                    <div className="w-16 h-1 bg-gradient-to-r from-red-500 to-rose-500 rounded-full mt-2" />
                    
                    <a href="https://wa.me/5500000000000?text=Olá, preciso regularizar o acesso do meu estabelecimento no IdeaFood."
                      target="_blank" rel="noopener noreferrer"
                      className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 px-8 rounded-2xl transition-all text-xs uppercase tracking-wider active:scale-95 shadow-lg shadow-emerald-500/20">
                      <span>💬</span> Falar com Suporte
                    </a>

                    <button 
                        onClick={() => logout()}
                        className="mt-2 w-full py-3.5 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 text-slate-450"
                    >
                        Sair da Conta
                    </button>
                </div>
            </div>
        );
    }

    // Trava global: Nunca deixar o usuário passar sem escolher a loja, exceto o Master Admin
    if (
        !userData?.isMasterAdmin &&
        userData?.estabelecimentosGerenciados?.length > 1 && 
        !selectedEstabelecimentoId && 
        location.pathname !== '/selecionar-estabelecimento'
    ) {
        return <Navigate to="/selecionar-estabelecimento" replace />;
    }

    // Trava de Módulos Desativados (Ignora para Master Admin)
    if (!userData?.isMasterAdmin && estabelecimentoInfo?.modulosDesativados) {
        const isPathBlocked = estabelecimentoInfo.modulosDesativados.some(dPath => {
            return location.pathname === dPath || location.pathname.startsWith(dPath + '/');
        });
        if (isPathBlocked) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    const accessGranted = canAccess(allowedRoles);
    if (!accessGranted) {
        return <Navigate to="/dashboard" replace />;
    }
    
    if (requiredEstabelecimento && !canManageEstabelecimento(requiredEstabelecimento)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

export { AuthContext };
