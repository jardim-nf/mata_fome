import { useState, useEffect } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

export function useMenuAuth(authLoading, currentUser, logout, limparCarrinho) {
    const auth = getAuth();

    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [forceLogin, setForceLogin] = useState(false);
    const [isRegisteringInModal, setIsRegisteringInModal] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);
    
    // Auth inputs
    const [emailAuthModal, setEmailAuthModal] = useState('');
    const [passwordAuthModal, setPasswordAuthModal] = useState('');
    const [nomeAuthModal, setNomeAuthModal] = useState('');
    const [telefoneAuthModal, setTelefoneAuthModal] = useState('');
    const [ruaAuthModal, setRuaAuthModal] = useState('');
    const [numeroAuthModal, setNumeroAuthModal] = useState('');
    const [bairroAuthModal, setBairroAuthModal] = useState('');
    const [cidadeAuthModal, setCidadeAuthModal] = useState('');
    const [referenciaAuthModal, setReferenciaAuthModal] = useState('');

    const [authMethod, setAuthMethod] = useState('phone'); // 'phone' or 'email'

    const [deveReabrirChat, setDeveReabrirChat] = useState(false);
    const [showAICenter, setShowAICenter] = useState(false);

    useEffect(() => {
        if (!authLoading && currentUser) {
            setForceLogin(false);
            setShowLoginPrompt(false);
        }
    }, [authLoading, currentUser]);

    const handleLogout = async () => {
        try { 
            await logout(); 
            if(limparCarrinho) limparCarrinho(); 
            window.location.reload(); 
        }
        catch (e) { console.error(e); }
    };

    const handleLoginModal = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        setLoginLoading(true);
        try {
            if (authMethod === 'phone') {
                const phoneClean = telefoneAuthModal.replace(/\D/g, '');
                if (phoneClean.length < 10) {
                    toast.error('Por favor, insira um telefone válido com DDD.');
                    setLoginLoading(false);
                    return;
                }
                const email = `${phoneClean}@matafome.com.br`;
                const password = '@MataFomePhoneAuthKey!';
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    toast.success('Login realizado com sucesso!');
                    setShowLoginPrompt(false);
                    if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); }
                } catch (error) {
                    // Se não encontrado ou credencial inválida, muda o modal para o modo de cadastro.
                    if (['auth/user-not-found', 'auth/invalid-credential', 'auth/wrong-password'].includes(error.code)) {
                        try {
                            const formats = [telefoneAuthModal];
                            if (!formats.includes(phoneClean)) formats.push(phoneClean);
                            if (!phoneClean.startsWith('55') && (phoneClean.length === 10 || phoneClean.length === 11)) {
                                formats.push(`55${phoneClean}`);
                            }
                            if (phoneClean.startsWith('55') && (phoneClean.length === 12 || phoneClean.length === 13)) {
                                formats.push(phoneClean.substring(2));
                            }

                            const q = query(collection(db, 'clientes'), where('telefone', 'in', formats));
                            const querySnapshot = await getDocs(q);

                            if (!querySnapshot.empty) {
                                const clientData = querySnapshot.docs[0].data();
                                setNomeAuthModal(clientData.nome || '');
                                setRuaAuthModal(clientData.endereco?.rua || '');
                                setNumeroAuthModal(clientData.endereco?.numero || '');
                                setBairroAuthModal(clientData.endereco?.bairro || '');
                                setCidadeAuthModal(clientData.endereco?.cidade || '');
                                setReferenciaAuthModal(clientData.endereco?.referencia || '');
                                toast.info('Cadastro existente localizado! Revise seus dados para continuar.');
                            } else {
                                // Limpa para evitar lixo de outros logins
                                setNomeAuthModal('');
                                setRuaAuthModal('');
                                setNumeroAuthModal('');
                                setBairroAuthModal('');
                                setCidadeAuthModal('');
                                setReferenciaAuthModal('');
                            }
                        } catch (errQuery) {
                            console.error('Erro ao consultar cadastro por telefone:', errQuery);
                        }
                        setIsRegisteringInModal(true);
                    } else if (error.code === 'auth/too-many-requests') {
                        toast.error('Muitas tentativas. Tente novamente mais tarde.');
                    } else {
                        toast.error('Erro ao acessar conta: ' + error.message);
                    }
                }
            } else {
                await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
                toast.success('Login realizado com sucesso!');
                setShowLoginPrompt(false);
                if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); }
            }
        } catch (error) {
            if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(error.code)) {
                toast.error('E-mail ou senha incorretos.');
            } else if (error.code === 'auth/too-many-requests') {
                toast.error('Muitas tentativas. Tente novamente mais tarde.');
            } else {
                toast.error('Erro ao entrar: ' + error.message);
            }
        } finally {
            setLoginLoading(false);
        }
    };

    const handleRegisterModal = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        setLoginLoading(true);
        try {
            let emailToUse = emailAuthModal;
            let passwordToUse = passwordAuthModal;
            let phoneToUse = telefoneAuthModal;

            if (authMethod === 'phone') {
                const phoneClean = telefoneAuthModal.replace(/\D/g, '');
                if (phoneClean.length < 10) {
                    toast.error('Por favor, insira um telefone válido com DDD.');
                    setLoginLoading(false);
                    return;
                }
                emailToUse = `${phoneClean}@matafome.com.br`;
                passwordToUse = '@MataFomePhoneAuthKey!';
                phoneToUse = telefoneAuthModal; // Contém máscara de formatação
            }

            const cred = await createUserWithEmailAndPassword(auth, emailToUse, passwordToUse);
            const enderecoData = { 
                rua: ruaAuthModal || '', 
                numero: numeroAuthModal || '', 
                bairro: bairroAuthModal || '', 
                cidade: cidadeAuthModal || '', 
                referencia: referenciaAuthModal || '' 
            };
            
            await setDoc(doc(db, 'usuarios', cred.user.uid), { 
                email: emailToUse, nome: nomeAuthModal, telefone: phoneToUse, 
                endereco: enderecoData, isAdmin: false, isMasterAdmin: false, 
                estabelecimentos: [], estabelecimentosGerenciados: [], criadoEm: Timestamp.now() 
            });
            await setDoc(doc(db, 'clientes', cred.user.uid), { 
                nome: nomeAuthModal, telefone: phoneToUse, email: emailToUse, 
                endereco: enderecoData, criadoEm: Timestamp.now() 
            });
            
            toast.success('Conta criada!');
            setShowLoginPrompt(false);
            if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); }
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                if (authMethod === 'phone') {
                    toast.error('Este telefone já possui cadastro no sistema.');
                } else {
                    toast.error('Este e-mail já está cadastrado.');
                }
            } else {
                toast.error('Erro ao criar conta: ' + error.message);
            }
        } finally {
            setLoginLoading(false);
        }
    };

    const handleAbrirLogin = () => { 
        setIsRegisteringInModal(false); 
        setAuthMethod('phone');
        setShowLoginPrompt(true); 
    };

    return {
        showLoginPrompt, setShowLoginPrompt,
        forceLogin, setForceLogin,
        isRegisteringInModal, setIsRegisteringInModal,
        loginLoading,
        authMethod, setAuthMethod,
        emailAuthModal, setEmailAuthModal,
        passwordAuthModal, setPasswordAuthModal,
        nomeAuthModal, setNomeAuthModal,
        telefoneAuthModal, setTelefoneAuthModal,
        ruaAuthModal, setRuaAuthModal,
        numeroAuthModal, setNumeroAuthModal,
        bairroAuthModal, setBairroAuthModal,
        cidadeAuthModal, setCidadeAuthModal,
        referenciaAuthModal, setReferenciaAuthModal,
        deveReabrirChat, setDeveReabrirChat,
        showAICenter, setShowAICenter,
        handleLogout,
        handleLoginModal,
        handleRegisterModal,
        handleAbrirLogin
    };
}
