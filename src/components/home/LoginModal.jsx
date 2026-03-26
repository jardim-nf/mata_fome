// src/components/home/LoginModal.jsx
import { useState, useEffect } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Loader2, KeyRound, ArrowLeft } from 'lucide-react';

const backdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modal = {
  hidden: { opacity: 0, scale: 0.92, y: 30 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
  exit: { opacity: 0, scale: 0.92, y: 30 },
};

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState('');
  const [loadingRecuperacao, setLoadingRecuperacao] = useState(false);

  const authFirebase = getAuth();
  const { currentUser, isAdmin, isMasterAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && currentUser && isOpen) {
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
        toast.success(`Bem-vindo de volta! ${isMasterAdmin ? 'Master Admin' : isAdmin ? 'Admin' : ''}`);
      }
    }
  }, [currentUser, isAdmin, isMasterAdmin, authLoading, isOpen, onClose, onSuccess]);

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    setIsAuthProcessing(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(authFirebase, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'usuarios', user.uid), {
          email: user.email,
          nome,
          isAdmin: false,
          isMasterAdmin: false,
          estabelecimentos: [],
          estabelecimentosGerenciados: [],
          criadoEm: Timestamp.now(),
        });

        await setDoc(doc(db, 'clientes', user.uid), {
          userId: user.uid,
          nome,
          email: user.email,
          telefone: null,
          endereco: null,
          criadoEm: Timestamp.now(),
        });

        toast.success('🎉 Cadastro realizado com sucesso! Faça login para continuar.');
        if (onSuccess) onSuccess();
      } else {
        await signInWithEmailAndPassword(authFirebase, email, password);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      let errorMessage = 'Erro na operação. Verifique suas informações.';
      switch (err.code) {
        case 'auth/user-not-found': errorMessage = 'Usuário não encontrado. Verifique seu email.'; break;
        case 'auth/wrong-password': errorMessage = 'Senha incorreta. Tente novamente.'; break;
        case 'auth/invalid-email': errorMessage = 'Email inválido.'; break;
        case 'auth/email-already-in-use': errorMessage = 'Este email já está cadastrado.'; break;
        case 'auth/weak-password': errorMessage = 'Senha muito fraca. Deve ter pelo menos 6 caracteres.'; break;
        case 'auth/too-many-requests': errorMessage = 'Muitas tentativas. Tente novamente mais tarde.'; break;
        default: console.error('Erro de autenticação:', err.message);
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setModoRecuperacao(false);
    setError('');
    setNome('');
    setEmail('');
    setPassword('');
  };

  // 🔑 RECUPERAÇÃO DE SENHA
  const handleRecuperarSenha = async (e) => {
    e.preventDefault();
    if (!emailRecuperacao.trim()) return toast.error('Digite seu email.');
    setLoadingRecuperacao(true);
    setError('');
    try {
      await sendPasswordResetEmail(authFirebase, emailRecuperacao.trim());
      toast.success('📧 Email de recuperação enviado! Verifique sua caixa de entrada e spam.');
      setModoRecuperacao(false);
      setEmail(emailRecuperacao.trim());
      setEmailRecuperacao('');
    } catch (err) {
      let msg = 'Erro ao enviar email. Tente novamente.';
      if (err.code === 'auth/user-not-found') msg = 'Nenhuma conta encontrada com este email.';
      else if (err.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Aguarde alguns minutos.';
      else if (err.code === 'auth/invalid-email') msg = 'Email inválido.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingRecuperacao(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000] p-4"
          onClick={onClose}
        >
          <motion.div
            variants={modal}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {modoRecuperacao ? 'Recuperar Senha' : isRegistering ? 'Crie Sua Conta' : 'Acesse Sua Conta'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {modoRecuperacao ? 'Enviaremos um link para redefinir sua senha' : isRegistering ? 'Preencha os dados abaixo' : 'Entre com suas credenciais'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* TELA DE RECUPERAÇÃO DE SENHA */}
            {modoRecuperacao ? (
              <>
                <form onSubmit={handleRecuperarSenha} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email da conta</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={emailRecuperacao}
                        onChange={(e) => setEmailRecuperacao(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        required
                        autoFocus
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                      ⚠️ {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loadingRecuperacao}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-xl text-lg transition-all shadow-lg shadow-yellow-500/20 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loadingRecuperacao ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </span>
                    ) : (
                      '📧 Enviar Link de Recuperação'
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => { setModoRecuperacao(false); setEmailRecuperacao(''); setError(''); }}
                    className="text-yellow-600 hover:text-yellow-700 font-semibold transition-colors inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft size={16} /> Voltar ao Login
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Form */}
                <form onSubmit={handleAuthAction} className="space-y-5">
                  {isRegistering && (
                    <div>
                      <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Nome Completo
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          id="nome"
                          placeholder="Seu Nome Completo"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                          required={isRegistering}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        id="email"
                        placeholder="seuemail@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        id="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                      ⚠️ {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-xl text-lg transition-all shadow-lg shadow-yellow-500/20 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isAuthProcessing}
                  >
                    {isAuthProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {isRegistering ? 'Cadastrando...' : 'Entrando...'}
                      </span>
                    ) : (
                      isRegistering ? '🎉 Cadastrar' : '🚀 Entrar'
                    )}
                  </button>
                </form>

                {/* Esqueceu a senha */}
                {!isRegistering && (
                  <div className="mt-3 text-center">
                    <button
                      onClick={() => { setModoRecuperacao(true); setEmailRecuperacao(email); setError(''); }}
                      className="text-sm text-gray-400 hover:text-yellow-600 hover:underline transition-colors"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                )}

                {/* Toggle Login/Cadastro */}
                <div className="mt-6 text-center">
                  <p className="text-gray-500 text-sm">
                    {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
                    <button
                      onClick={toggleMode}
                      className="text-yellow-600 hover:text-yellow-700 font-semibold transition-colors underline"
                    >
                      {isRegistering ? 'Faça Login' : 'Cadastre-se'}
                    </button>
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;
