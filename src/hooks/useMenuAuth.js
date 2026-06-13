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
                // 1. Normalizar número de telefone (remover não-dígitos e remover prefixo '55' caso presente)
                let phoneClean = telefoneAuthModal.replace(/\D/g, '');
                if (phoneClean.startsWith('55') && phoneClean.length >= 12) {
                    phoneClean = phoneClean.substring(2);
                }
                if (phoneClean.length < 10) {
                    toast.error('Por favor, insira um telefone válido com DDD.');
                    setLoginLoading(false);
                    return;
                }

                // 2. Formatos alternativos para buscar no Firestore
                const formats = [telefoneAuthModal, phoneClean];
                if (!phoneClean.startsWith('55') && (phoneClean.length === 10 || phoneClean.length === 11)) {
                    formats.push(`55${phoneClean}`);
                }
                const inputClean = telefoneAuthModal.replace(/\D/g, '');
                if (!formats.includes(inputClean)) formats.push(inputClean);

                // 3. Consultar no banco se já existe um cliente com esse telefone
                let existingClient = null;
                try {
                    const q = query(collection(db, 'clientes'), where('telefone', 'in', formats));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        existingClient = querySnapshot.docs[0].data();
                    }
                } catch (errQuery) {
                    console.error('Erro ao consultar cadastro por telefone:', errQuery);
                }

                // 4. Se o cadastro existe, validar a forma de login original
                if (existingClient) {
                    const existingEmail = existingClient.email || '';
                    
                    // Se o cadastro original possui um e-mail real (não-dummy), obriga a logar com e-mail/senha
                    if (existingEmail && !existingEmail.endsWith('@matafome.com.br')) {
                        toast.error(`Este telefone já está associado à conta de e-mail: ${existingEmail}. Por favor, entre usando seu e-mail e senha.`);
                        setLoginLoading(false);
                        return;
                    }

                    // Se for e-mail dummy de telefone, tenta logar diretamente com ele
                    if (existingEmail && existingEmail.endsWith('@matafome.com.br')) {
                        try {
                            await signInWithEmailAndPassword(auth, existingEmail, '@MataFomePhoneAuthKey!');
                            toast.success('Login realizado com sucesso!');
                            setShowLoginPrompt(false);
                            if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); }
                            setLoginLoading(false);
                            return;
                        } catch (loginError) {
                            console.warn('Falha ao autenticar com e-mail dummy existente, prosseguindo para fluxo padrão:', loginError);
                        }
                    }
                }

                // 5. Tenta login com o e-mail padrão derivado do telefone limpo atual
                const email = `${phoneClean}@matafome.com.br`;
                const password = '@MataFomePhoneAuthKey!';
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    toast.success('Login realizado com sucesso!');
                    setShowLoginPrompt(false);
                    if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); }
                } catch (error) {
                    // Se não encontrado ou credencial inválida, vai para a tela de registro/conclusão
                    if (['auth/user-not-found', 'auth/invalid-credential', 'auth/wrong-password'].includes(error.code)) {
                        if (existingClient) {
                            setNomeAuthModal(existingClient.nome || '');
                            setRuaAuthModal(existingClient.endereco?.rua || '');
                            setNumeroAuthModal(existingClient.endereco?.numero || '');
                            setBairroAuthModal(existingClient.endereco?.bairro || '');
                            setCidadeAuthModal(existingClient.endereco?.cidade || '');
                            setReferenciaAuthModal(existingClient.endereco?.referencia || '');
                            toast.info('Cadastro existente localizado! Revise seus dados para continuar.');
                        } else {
                            setNomeAuthModal('');
                            setRuaAuthModal('');
                            setNumeroAuthModal('');
                            setBairroAuthModal('');
                            setCidadeAuthModal('');
                            setReferenciaAuthModal('');
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
                let phoneClean = telefoneAuthModal.replace(/\D/g, '');
                if (phoneClean.startsWith('55') && phoneClean.length >= 12) {
                    phoneClean = phoneClean.substring(2);
                }
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
