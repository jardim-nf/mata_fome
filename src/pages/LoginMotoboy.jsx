import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase'; 
import { IoBicycle, IoKey, IoMail, IoPerson, IoCall, IoWarningOutline } from 'react-icons/io5';

export default function LoginMotoboy() {
  const { currentUser, userData, authChecked } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  // Estados de Controle
  const [isRegistering, setIsRegistering] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState('');
  const [loadingRecuperacao, setLoadingRecuperacao] = useState(false);

  // Estados do Formulário
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Campos extras para Cadastro
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [placa, setPlaca] = useState(''); // Extra for motoboy
  const [chavePix, setChavePix] = useState(''); // Chave PIX

  // Redirecionamento 
  useEffect(() => {
    if (authChecked && userData) {
        // Se tinha uma rota específica, porém no app motoboy sempre mandamos para /entregador
        navigate('/entregador', { replace: true });
    }
  }, [authChecked, userData, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingLocal(true);

    try {
      if (isRegistering) {
        // --- LÓGICA DE CADASTRO MOTOBOY ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Criar perfil com cargo ENTREGADOR explícito
        await setDoc(doc(db, 'usuarios', user.uid), {
            email: user.email,
            nome: nome,
            telefone: telefone,
            placa: placa,
            chavePix: chavePix,
            cargo: 'entregador', // <-- CRUCIAL PARA TER ACESSO
            isAdmin: false,
            isMasterAdmin: false,
            criadoEm: Timestamp.now()
        });

        toast.success('Parceiro cadastrado! Acelerando...');

      } else {
        // --- LÓGICA DE LOGIN ---
        await signInWithEmailAndPassword(auth, email, password);
      }

    } catch (error) {
      console.error('Erro na autenticação:', error);
      let msg = 'Falha na operação.';
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = 'Email ou senha incorretos.';
      } else if (error.code === 'auth/email-already-in-use') {
        msg = 'Já existe um parceiro com este email.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'A senha deve ter pelo menos 6 caracteres.';
      }
      
      toast.error(msg);
    } finally {
        setLoadingLocal(false);
    }
  };

  const handleRecuperarSenha = async (e) => {
    e.preventDefault();
    if (!emailRecuperacao.trim()) return toast.error('Digite seu email.');
    setLoadingRecuperacao(true);
    try {
      await sendPasswordResetEmail(auth, emailRecuperacao.trim());
      toast.success('Email de recuperação enviado!');
      setModoRecuperacao(false);
      setEmail(emailRecuperacao.trim());
      setEmailRecuperacao('');
    } catch (error) {
      toast.error('Erro ao enviar email de recuperação.');
    } finally {
      setLoadingRecuperacao(false);
    }
  };

  if (authChecked && currentUser && !userData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
  }

  // TELA DE RECUPERAÇÃO DE SENHA
  if (modoRecuperacao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12">
        <div className="bg-slate-800 shadow-2xl rounded-3xl p-8 w-full max-w-md border border-emerald-500/30">
          <div className="text-center mb-8">
             <IoKey className="text-5xl text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-white">Recuperar Senha</h1>
            <p className="text-slate-400 mt-2 text-sm">Digite seu email e enviaremos um link de reset para seu acesso parceiro.</p>
          </div>

          <form onSubmit={handleRecuperarSenha} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">Email Cadastrado</label>
              <input type="email" value={emailRecuperacao} onChange={(e) => setEmailRecuperacao(e.target.value)} required autoFocus className="w-full px-4 py-3 rounded-2xl border border-slate-700 bg-slate-900 text-white focus:bg-slate-800 focus:border-emerald-500 outline-none transition-all" />
            </div>
            <button type="submit" disabled={loadingRecuperacao} className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg active:scale-95">
              {loadingRecuperacao ? 'Enviando...' : 'Enviar Link'}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-slate-700">
            <button onClick={() => setModoRecuperacao(false)} className="text-emerald-500 font-bold hover:text-emerald-400">
              ← Voltar ao Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8">
      <div className="bg-slate-800 shadow-2xl rounded-3xl p-6 sm:p-8 w-full max-w-md border border-emerald-500/20">
        
        {/* Cabeçalho */}
        <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl mx-auto flex items-center justify-center mb-4 shadow-lg border border-emerald-500/30 transform -rotate-3">
                <IoBicycle className="text-4xl text-emerald-500" />
            </div>
            <h1 className="text-3xl font-black text-white">
                {isRegistering ? 'Parceiro IdeaEntregas' : 'Acesso IdeaEntregas'}
            </h1>
            <p className="text-slate-400 mt-2 font-medium">
                {isRegistering ? 'Cadastre-se para receber rotas' : 'Bora pras entregas de hoje?'}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {isRegistering && (
            <div className="space-y-4 animate-slideUp">
                <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">Nome Completo</label>
                    <div className="relative">
                        <IoPerson className="absolute left-4 top-3.5 text-slate-400" />
                        <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-700 bg-slate-900 text-white focus:bg-slate-800 focus:border-emerald-500 outline-none transition-all" placeholder="Como te chamamos?" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">WhatsApp</label>
                    <div className="relative">
                        <IoCall className="absolute left-4 top-3.5 text-slate-400" />
                        <input type="tel" required value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-700 bg-slate-900 text-white focus:bg-slate-800 focus:border-emerald-500 outline-none transition-all" placeholder="(00) 90000-0000" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">Sua Chave PIX (Para receber)</label>
                    <div className="relative">
                        <span className="absolute left-4 top-3.5 text-slate-400 font-black">PIX</span>
                        <input type="text" required value={chavePix} onChange={e => setChavePix(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-700 bg-slate-900 text-emerald-400 font-bold focus:bg-slate-800 focus:border-emerald-500 outline-none transition-all placeholder-slate-500" placeholder="CPF, Email, Telefone..." />
                    </div>
                </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1">Email</label>
            <div className="relative">
                <IoMail className="absolute left-4 top-3.5 text-slate-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-700 bg-slate-900 text-white focus:bg-slate-800 focus:border-emerald-500 outline-none transition-all" placeholder="seu@email.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1">Senha</label>
            <div className="relative">
                <IoKey className="absolute left-4 top-3.5 text-slate-400" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-700 bg-slate-900 text-white focus:bg-slate-800 focus:border-emerald-500 outline-none transition-all" placeholder="Mínimo 6 dígitos" />
            </div>
          </div>

          <button type="submit" disabled={loadingLocal} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 mt-2 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-50">
            {loadingLocal ? 'Acelerando...' : (isRegistering ? 'QUERO SER PARCEIRO' : 'ENTRAR NO RADAR')}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-slate-700/50">
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors uppercase tracking-wider text-sm">
                {isRegistering ? 'Já tenho conta. Logar!' : 'Não tenho conta. Cadastrar!'}
            </button>
        </div>
        
        {!isRegistering && (
            <div className="mt-4 text-center">
                <button onClick={() => setModoRecuperacao(true)} className="text-sm text-slate-500 hover:text-emerald-500 transition-colors">
                  Esqueci minha senha
                </button>
            </div>
        )}

      </div>
    </div>
  );
}
