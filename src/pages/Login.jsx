// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase'; 

export default function LoginPage() {
  const { currentUser, userData, authChecked } = useAuth();
  const navigate = useNavigate();
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
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('Nova Friburgo'); 
  const [pontoReferencia, setPontoReferencia] = useState(''); 

  // === REDIRECIONAMENTO AUTOMÁTICO BASEADO NO CARGO (MÚLTIPLOS CARGOS) ===
  useEffect(() => {
    if (authChecked && userData) {
      
      // 1. Pega os cargos. Se for apenas um texto, transforma em lista. Se já for lista, mantém.
      const cargosDoUsuario = Array.isArray(userData.cargo) 
        ? userData.cargo 
        : [userData.cargo || ''];

      // 2. Normaliza todos os cargos da lista (tira acento, joga pra minúsculo)
      const cargosNormalizados = cargosDoUsuario.map(cargo => 
        String(cargo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      );

      // 3. Função "detetive": verifica se o usuário possui pelo menos um dos cargos exigidos
      const temCargo = (cargosExigidos) => {
        return cargosNormalizados.some(cargoUsuario => cargosExigidos.includes(cargoUsuario));
      };

      // 4. Roteamento (A ordem aqui define a prioridade se ele tiver 2 cargos)
      if (userData.isMasterAdmin) {
        navigate('/master/estabelecimentos', { replace: true });
        
      } else if (userData.isAdmin) {
        navigate('/admin/dashboard', { replace: true });
        
      } else if (temCargo(['garcom', 'atendente'])) {
        navigate('/controle-salao', { replace: true });
        
      } else if (temCargo(['caixa'])) {
        navigate('/pdv', { replace: true });
        
      } else if (temCargo(['gerente', 'cozinheiro', 'entregador', 'auxiliar'])) {
        navigate('/painel', { replace: true });
      }
      // Se não for nenhum (cliente comum), fica na Home.
    }
  }, [authChecked, userData, navigate]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingLocal(true);

    try {
      if (isRegistering) {
        // --- LÓGICA DE CADASTRO ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 1. Criar perfil na coleção USUARIOS (Permissões e Perfil Base)
        await setDoc(doc(db, 'usuarios', user.uid), {
            email: user.email,
            nome: nome,
            telefone: telefone,
            endereco: {
                rua: rua,
                numero: numero,
                bairro: bairro,
                cidade: cidade,
                referencia: pontoReferencia // <--- ADICIONADO AQUI
            },
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
                cidade: cidade,
                referencia: pontoReferencia // <--- ADICIONADO AQUI
            },
            criadoEm: Timestamp.now()
        });

        toast.success('Conta criada com sucesso! Redirecionando...');
        // O useEffect vai tratar o redirecionamento automático

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

  // 🔑 RECUPERAÇÃO DE SENHA
  const handleRecuperarSenha = async (e) => {
    e.preventDefault();
    if (!emailRecuperacao.trim()) return toast.error('Digite seu email.');
    setLoadingRecuperacao(true);
    try {
      await sendPasswordResetEmail(auth, emailRecuperacao.trim());
      toast.success('📧 Email de recuperação enviado! Verifique sua caixa de entrada e spam.');
      setModoRecuperacao(false);
      setEmail(emailRecuperacao.trim());
      setEmailRecuperacao('');
    } catch (error) {
      console.error('Erro ao enviar email de recuperação:', error);
      if (error.code === 'auth/user-not-found') {
        toast.error('Nenhuma conta encontrada com este email.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Muitas tentativas. Aguarde alguns minutos.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Email inválido.');
      } else {
        toast.error('Erro ao enviar email. Tente novamente.');
      }
    } finally {
      setLoadingRecuperacao(false);
    }
  };

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

  // TELA DE RECUPERAÇÃO DE SENHA
  if (modoRecuperacao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-12">
        <div className="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-md border border-gray-200">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-yellow-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg">
              <span className="text-2xl">🔑</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Recuperar Senha</h1>
            <p className="text-gray-500 mt-2 text-sm">Digite seu email e enviaremos um link para redefinir sua senha.</p>
          </div>

          <form onSubmit={handleRecuperarSenha} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email da conta</label>
              <input
                type="email"
                value={emailRecuperacao}
                onChange={(e) => setEmailRecuperacao(e.target.value)}
                placeholder="exemplo@email.com"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loadingRecuperacao}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3.5 rounded-xl hover:from-yellow-600 hover:to-orange-600 focus:ring-4 focus:ring-yellow-200 transition-all transform active:scale-95 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingRecuperacao ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Enviando...
                </>
              ) : (
                '📧 Enviar Link de Recuperação'
              )}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <button
              onClick={() => { setModoRecuperacao(false); setEmailRecuperacao(''); }}
              className="text-yellow-600 font-bold hover:text-yellow-700 hover:underline transition-colors"
            >
              ← Voltar ao Login
            </button>
          </div>
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
                <span className="text-2xl font-bold text-white">IF</span>
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
                
                {/* Ponto de Referência */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Ponto de Referência <span className="text-gray-400 text-xs font-normal">(Opcional)</span>
                    </label>
                    <input type="text" value={pontoReferencia} onChange={e => setPontoReferencia(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all" placeholder="Ex: Ao lado da padaria, em frente à praça..." />
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
                }}
                className="text-yellow-600 font-bold hover:text-yellow-700 hover:underline transition-colors text-lg"
            >
                {isRegistering ? 'Fazer Login' : 'Criar Conta Grátis'}
            </button>
        </div>
        
        {!isRegistering && (
            <div className="mt-4 text-center">
                <button 
                  onClick={() => { setModoRecuperacao(true); setEmailRecuperacao(email); }}
                  className="text-sm text-gray-400 hover:text-yellow-600 hover:underline transition-colors"
                >
                  Esqueceu sua senha?
                </button>
            </div>
        )}

      </div>
    </div>
  );
}
