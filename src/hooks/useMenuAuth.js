import { useState, useEffect } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
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
        e.preventDefault();
        setLoginLoading(true);
        try {
            await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
            toast.success('Login realizado com sucesso!');
            setShowLoginPrompt(false);
            if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); }
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
        e.preventDefault();
        setLoginLoading(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
            const enderecoData = { 
                rua: ruaAuthModal || '', 
                numero: numeroAuthModal || '', 
                bairro: bairroAuthModal || '', 
                cidade: cidadeAuthModal || '', 
                referencia: referenciaAuthModal || '' 
            };
            
            await setDoc(doc(db, 'usuarios', cred.user.uid), { 
                email: emailAuthModal, nome: nomeAuthModal, telefone: telefoneAuthModal, 
                endereco: enderecoData, isAdmin: false, isMasterAdmin: false, 
                estabelecimentos: [], estabelecimentosGerenciados: [], criadoEm: Timestamp.now() 
            });
            await setDoc(doc(db, 'clientes', cred.user.uid), { 
                nome: nomeAuthModal, telefone: telefoneAuthModal, email: emailAuthModal, 
                endereco: enderecoData, criadoEm: Timestamp.now() 
            });
            
            toast.success('Conta criada!');
            setShowLoginPrompt(false);
            if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); }
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') toast.error('Este e-mail já está cadastrado.');
            else toast.error('Erro ao criar conta: ' + error.message);
        } finally {
            setLoginLoading(false);
        }
    };

    const handleAbrirLogin = () => { 
        setIsRegisteringInModal(false); 
        setShowLoginPrompt(true); 
    };

    return {
        showLoginPrompt, setShowLoginPrompt,
        forceLogin, setForceLogin,
        isRegisteringInModal, setIsRegisteringInModal,
        loginLoading,
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
