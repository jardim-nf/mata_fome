// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase'; // Certifique-se que o caminho está correto

export default function LoginPage() {
  const { currentUser, userData, authChecked } = useAuth();
  const navigate = useNavigate();
  const auth = getAuth();

  // Estados de Controle
  const [isRegistering, setIsRegistering] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);

  // Estados do Formulário
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Campos extras para Cadastro
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('Nova Friburgo'); // Padrão, mas editável

  // 1. Redirecionamento Automático se já estiver logado
  useEffect(() => {
    if (authChecked && currentUser && userData) {
      if (userData.isMasterAdmin) {
        toast.success(`Olá Mestre, ${userData.nome}!`);
        navigate('/master/estabelecimentos', { replace: true });
      } else if (userData.isAdmin) {
        if (userData.estabelecimentosGerenciados?.length > 0) {
            toast.success('Painel Administrativo carregado.');
            navigate('/admin/dashboard', { replace: true });
        } else {
            toast.warning('Conta Admin sem estabelecimentos vinculados.');
            navigate('/admin/dashboard', { replace: true });
        }
      } else {
        // Cliente comum vai para a Home
        navigate('/', { replace: true });
      }
    }
  }, [authChecked, currentUser, userData, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingLocal(true);

    try {
      if (isRegistering) {
        // --- LÓGICA DE CADASTRO ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 1. Criar perfil na coleção USUARIOS (Permissões)
        await setDoc(doc(db, 'usuarios', user.uid), {
            email: user.email,
            nome: nome,
            isAdmin: false,
            isMasterAdmin: false,
            estabelecimentos: [], 
            estabelecimentosGerenciados: [],
            criadoEm: Timestamp.now()
        });

        // 2. Criar perfil na coleção CLIENTES (Dados de Entrega)
        await setDoc(doc(db, 'clientes', user.uid), {
            userId: user.uid,
            nome: nome,
            email: user.email,
            telefone: telefone,
            endereco: {
                rua: rua,
                numero: numero,
                bairro: bairro,
                cidade: cidade
            },
            criadoEm: Timestamp.now()
        });

        toast.success('Conta criada com sucesso! Redirecionando...');
        // O useEffect vai tratar o redirecionamento automático

      } else {
        // --- LÓGICA DE LOGIN ---
        await signInWithEmailAndPassword(auth, email, password);
        // Não precisa de toast aqui, o useEffect trata
      }

    } catch (error) {
      console.error('Erro na autenticação:', error);
      let msg = 'Falha na operação.';
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = 'Email ou senha incorretos.';
      } else if (error.code === 'auth/email-already-in-use') {
        msg = 'Este email já está em uso.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'A senha deve ter pelo menos 6 caracteres.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Muitas tentativas. Aguarde um instante.';
      }
      
      toast.error(msg);
      setLoadingLocal(false);
    }
  };

  // Loading State inicial
  if (authChecked && currentUser && !userData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600 font-medium">Carregando perfil...</p>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-12">
      <div className="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-md border border-gray-200">
        
        {/* Cabeçalho */}
        <div className="text-center mb-8">
            <div className="w-16 h-16 bg-yellow-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg transform -rotate-3">
                <span className="text-2xl font-bold text-white">DF</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
                {isRegistering ? 'Criar Nova Conta' : 'Bem-vindo'}
            </h1>
            <p className="text-gray-500 mt-2">
                {isRegistering ? 'Preencha seus dados para começar' : 'Faça login para continuar'}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Campos EXTRAS de Cadastro */}
          {isRegistering && (
            <div className="space-y-4 animate-fade-in-up">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
                    <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all" placeholder="Seu nome" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone (WhatsApp)</label>
                    <input type="tel" required value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all" placeholder="(22) 99999-9999" />
                </div>
                
                {/* Endereço */}
                <div className="grid grid-cols-[1fr_80px] gap-2">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Rua</label>
                        <input type="text" required value={rua} onChange={e => setRua(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all" placeholder="Nome da rua" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Nº</label>
                        <input type="text" required value={numero} onChange={e => setNumero(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all text-center" placeholder="123" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro</label>
                        <input type="text" required value={bairro} onChange={e => setBairro(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all" placeholder="Bairro" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade</label>
                        <input type="text" required value={cidade} onChange={e => setCidade(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all" placeholder="Cidade" />
                    </div>
                </div>
            </div>
          )}

          {/* Campos Padrão (Login e Cadastro) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loadingLocal}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3.5 rounded-xl hover:from-yellow-600 hover:to-orange-600 focus:ring-4 focus:ring-yellow-200 transition-all transform active:scale-95 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingLocal ? (
                <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processando...
                </>
            ) : (
                isRegistering ? 'Finalizar Cadastro' : 'Entrar no Sistema'
            )}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <p className="text-gray-600 mb-4">
                {isRegistering ? 'Já possui uma conta?' : 'Ainda não tem conta?'}
            </p>
            <button 
                onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError(''); // Limpa erros ao trocar
                }}
                className="text-yellow-600 font-bold hover:text-yellow-700 hover:underline transition-colors text-lg"
            >
                {isRegistering ? 'Fazer Login' : 'Criar Conta Grátis'}
            </button>
        </div>
        
        {!isRegistering && (
            <div className="mt-4 text-center">
                <button className="text-sm text-gray-400 hover:text-gray-600">Esqueceu sua senha?</button>
            </div>
        )}

      </div>
    </div>
  );
}