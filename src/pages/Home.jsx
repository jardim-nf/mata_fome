// src/pages/Home.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

// --- Botão WhatsApp Flutuante ---
function WhatsAppFloatingButton() {
  const [isHovered, setIsHovered] = useState(false);

  const handleWhatsAppClick = () => {
    const phoneNumber = "55229998102575";
    const message = "Olá! Gostaria de mais informações sobre o Deu Fome.";
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* Alert "Clique Aqui" */}
        {isHovered && (
          <div className="mb-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-full shadow-2xl animate-bounce">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm">CLIQUE AQUI!</span>
              <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            </div>
            <div className="absolute -bottom-1 right-6 w-3 h-3 bg-green-500 transform rotate-45"></div>
          </div>
        )}
        
        {/* Botão Principal do WhatsApp */}
        <button
          onClick={handleWhatsAppClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 hover:rotate-12 group"
        >
          {/* Ícone do WhatsApp */}
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893-.001-3.189-1.262-6.187-3.55-8.444"/>
          </svg>
          
          {/* Efeito de Pulsação */}
          <div className="absolute inset-0 border-2 border-green-400 rounded-full animate-ping opacity-75"></div>
          
          {/* Badge de Notificação */}
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        </button>
      </div>
    </>
  );
}

// --- AuthButtonElegant (Header/Navegação) - CORRIGIDO ---
function AuthButtonElegant({ onLoginClick }) {
  const { currentUser, loading, isAdmin, isMasterAdmin, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="text-gray-700 text-sm font-light animate-pulse">Carregando...</div>
    );
  }

  if (currentUser) {
    const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';

    const handleProfileClick = () => {
      if (isMasterAdmin) {
        navigate('/master-dashboard');
      } else {
        // CORREÇÃO AQUI:
        // Tanto Admin quanto Equipe (Aline) vão para /dashboard.
        // O Dashboard cuidará de mostrar os botões corretos conforme a permissão.
        navigate('/dashboard'); 
      }
      toast.info(`Bem-vindo de volta, ${userEmailPrefix}.`);
    };

    const handleLogout = async () => {
      try {
        await logout();
        toast.success('Você foi desconectado com sucesso!');
        navigate('/');
      } catch (error) {
        console.error("Erro ao fazer logout:", error);
        toast.error('Ocorreu um erro ao tentar desconectar.');
      }
    };

    return (
      <div className="flex items-center space-x-3">
        <button
          onClick={handleProfileClick}
          className="cursor-pointer px-4 py-2 rounded-full text-black bg-yellow-400 font-semibold text-sm transition-all duration-300 ease-in-out
                      hover:bg-yellow-500 hover:shadow-md transform hover:scale-105"
        >
          👋 Olá, {userEmailPrefix}!
        </button>
        <button
          onClick={handleLogout}
          className="cursor-pointer px-4 py-2 rounded-full text-gray-700 border border-gray-400 font-semibold text-sm transition-all duration-300 ease-in-out
                      hover:bg-gray-100 hover:text-black hover:border-gray-500 transform hover:scale-105"
        >
          Sair
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onLoginClick}
      className="px-5 py-2 rounded-full text-black bg-yellow-400 font-semibold text-sm transition-all duration-300 ease-in-out
                hover:bg-yellow-500 hover:shadow-md transform hover:scale-105"
    >
      🔐 Login / Cadastre-se
    </button>
  );
}

// --- Hero Section - MELHORADA ---
function HeroSectionModern({ onExploreClick }) {
  return (
    <section className="relative flex-col sm:flex-row overflow-hidden bg-gradient-to-br from-white to-yellow-50 pt-24 md:pt-32">
      <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between py-12 md:py-20 px-4">
        {/* Lado Esquerdo: Conteúdo de Texto */}
        <div className="flex-col sm:flex-row lg:w-1/2 text-center lg:text-left mb-10 lg:mb-0 z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-black mb-4 leading-tight">
            Deu Fome? <br className="hidden md:inline"/> 
            <span className="text-yellow-500"> Peça Agora!</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-700 mb-8 max-w-lg mx-auto lg:mx-0">
            Sua plataforma própria de delivery, com os melhores estabelecimentos da cidade, 
            entregue rapidinho na sua porta. 🚀
          </p>
          <div className="flex justify-center lg:justify-start">
            <button
              onClick={onExploreClick}
              className="bg-yellow-500 text-black font-bold py-3 px-8 rounded-full text-lg shadow-lg
                        transition-all duration-300 transform hover:scale-105 hover:bg-yellow-600 hover:shadow-xl"
            >
              🍕 Ver Estabelecimentos
            </button>
          </div>
          
          {/* Stats */}
          <div className="flex flex-wrap gap-6 mt-8 justify-center lg:justify-start">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">+500</div>
              <div className="text-sm text-gray-600">Estabelecimentos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">+10k</div>
              <div className="text-sm text-gray-600">Pedidos Entregues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">24/7</div>
              <div className="text-sm text-gray-600">Disponível</div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Área Visual com Imagem de Pizza e Fundo Amarelo Vibrante */}
        <div className="relative flex-col sm:flex-row lg:w-1/2 flex justify-center items-center lg:h-[500px]">
          {/* Fundo Vibrante com gradiente */}
          <div className="absolute inset-y-0 right-0 flex-col sm:flex-row lg:w-[120%] bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-bl-[100px] lg:rounded-bl-[150px] transform lg:translate-x-1/4"></div>
          
          {/* Sua Imagem da Pizza - Com animação flutuante */}
          <img
            src="https://firebasestorage.googleapis.com/v0/b/matafome-98455.firebasestorage.app/o/pizza.png?alt=media&token=aac1a9a6-5381-41df-b728-c394fba7b762" 
            alt="Pizza Deliciosa"
            className="relative z-10 flex-col sm:flex-row max-w-md md:max-w-lg lg:max-w-none lg:w-auto h-auto rounded-xl shadow-2xl transform translate-y-8 lg:translate-y-0 rotate-3 animate-float"
          />
          
          {/* Elementos decorativos */}
          <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-yellow-300 rounded-full opacity-50 animate-pulse"></div>
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-yellow-400 rounded-full opacity-30 animate-bounce"></div>
        </div>
      </div>
    </section>
  );
}

// --- Componente Modal de Login/Cadastro - MELHORADO ---
function LoginModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  const authFirebase = getAuth();
  const { currentUser, isAdmin, isMasterAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && currentUser && isOpen) {
      onClose();
      toast.success(`Bem-vindo de volta! ${isMasterAdmin ? 'Master Admin' : isAdmin ? 'Admin' : ''}`);
    }
  }, [currentUser, isAdmin, isMasterAdmin, authLoading, isOpen, onClose]);

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    setIsAuthProcessing(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(authFirebase, email, password);
        const user = userCredential.user;
        
        // 1. SALVAR DADOS DE USUÁRIO (COLEÇÃO 'usuarios')
        await setDoc(doc(db, 'usuarios', user.uid), {
          email: user.email,
          nome: nome,
          isAdmin: false,
          isMasterAdmin: false,
          estabelecimentos: [], 
          estabelecimentosGerenciados: [],
          criadoEm: Timestamp.now()
        });
        
        // 2. ✅ SALVAR DADOS DE CLIENTE (COLEÇÃO 'clientes')
        await setDoc(doc(db, 'clientes', user.uid), {
            userId: user.uid,
            nome: nome,
            email: user.email,
            telefone: null,
            endereco: null,
            criadoEm: Timestamp.now()
        });
        
        toast.success('🎉 Cadastro realizado com sucesso! Faça login para continuar.');
        setIsRegistering(false);
        setEmail('');
        setPassword('');
        setNome('');

      } else {
        await signInWithEmailAndPassword(authFirebase, email, password);
      }
    } catch (error) {
      let errorMessage = 'Erro na operação. Verifique suas informações.';
      switch (error.code) {
        case 'auth/user-not-found': errorMessage = 'Usuário não encontrado. Verifique seu email.'; break;
        case 'auth/wrong-password': errorMessage = 'Senha incorreta. Tente novamente.'; break;
        case 'auth/invalid-email': errorMessage = 'Email inválido.'; break;
        case 'auth/email-already-in-use': errorMessage = 'Este email já está cadastrado.'; break;
        case 'auth/weak-password': errorMessage = 'Senha muito fraca. Deve ter pelo menos 6 caracteres.'; break;
        case 'auth/too-many-requests': errorMessage = 'Muitas tentativas. Tente novamente mais tarde.'; break;
        default: console.error("Erro de autenticação:", error.message);
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAuthProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-2xl flex-col sm:flex-row max-w-md border border-gray-200 animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-sans text-3xl font-bold text-black">
            {isRegistering ? 'Crie Sua Conta' : 'Acesse Sua Conta'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-black text-2xl transition-colors duration-300 p-2 hover:bg-gray-100 rounded-full"
          >
            &times;
          </button>
        </div>
        
        <form onSubmit={handleAuthAction} className="space-y-6">
          {isRegistering && (
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-2">
                👤 Nome Completo
              </label>
              <input
                type="text"
                id="nome"
                placeholder="Seu Nome Completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="flex-col sm:flex-row px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
                required={isRegistering}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              📧 Email
            </label>
            <input
              type="email"
              id="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-col sm:flex-row px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              🔒 Senha
            </label>
            <input
              type="password"
              id="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-col sm:flex-row px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
              required
            />
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}
          
          <button
            type="submit"
            className="flex-col sm:flex-row bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg text-lg transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isAuthProcessing}
          >
            {isAuthProcessing ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                {isRegistering ? 'Cadastrando...' : 'Entrando...'}
              </span>
            ) : (
              isRegistering ? '🎉 Cadastrar' : '🚀 Entrar'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-600 font-sans text-sm">
            {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
            <button
              onClick={() => { 
                setIsRegistering(!isRegistering); 
                setError(''); 
                setNome(''); 
                setEmail(''); 
                setPassword(''); 
              }}
              className="text-yellow-600 hover:text-yellow-700 font-semibold transition-colors duration-300 underline"
            >
              {isRegistering ? 'Faça Login' : 'Cadastre-se'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Seção Vantagens - COMPLETAMENTE REPROJETADA ---
function BenefitsSection() {
  return (
    <section className="bg-gradient-to-br from-gray-50 to-white py-20 md:py-28 px-4">
      <div className="container mx-auto">
        
        {/* Cabeçalho Impactante */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-black mb-6">
            Transforme seu Negócio de Delivery
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Ferramentas poderosas para você vender mais, organizar melhor e economizar
          </p>
          <div className="w-32 h-1 bg-gradient-to-r from-yellow-400 to-yellow-500 mx-auto mt-6 rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          
          {/* Card 1: Venda Mais - DESTAQUE */}
          <div className="group relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100 transition-all duration-500 hover:scale-105 hover:shadow-2xl">
            {/* Elemento de Destaque */}
            <div className="absolute -top-4 -right-4 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
              +47% em média
            </div>
            
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">
                Venda Mais e Aumente sua Receita
              </h3>
            </div>
            
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              Crie cupons, programas de fidelidade, campanhas de email e push para fidelizar seus clientes.
            </p>
            
            {/* Lista de Benefícios */}
            <ul className="space-y-3 mb-6">
              {['Cupons personalizados', 'Programa de pontos', 'Email marketing', 'Notificações push', 'Relatórios de performance'].map((item, index) => (
                <li key={index} className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            
            <button className="flex-col sm:flex-row bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
              Começar a Vender Mais
            </button>
          </div>

          {/* Card 2: Organize Operação */}
          <div className="group relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100 transition-all duration-500 hover:scale-105 hover:shadow-2xl">
            <div className="absolute -top-4 -right-4 bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
              +60% eficiência
            </div>
            
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">
                Organize sua Operação de Delivery
              </h3>
            </div>
            
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              Centralize seus pedidos em uma só plataforma e organize suas operações de forma eficiente.
            </p>
            
            <ul className="space-y-3 mb-6">
              {['Painel unificado', 'Gestão de pedidos', 'Controle de estoque', 'Relatórios em tempo real', 'App para entregadores'].map((item, index) => (
                <li key={index} className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            
            <button className="flex-col sm:flex-row bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
              Otimizar Operação
            </button>
          </div>

          {/* Card 3: Economize Dinheiro */}
          <div className="group relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100 transition-all duration-500 hover:scale-105 hover:shadow-2xl">
            <div className="absolute -top-4 -right-4 bg-purple-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
              Até 80% economia
            </div>
            
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">
                Economize Dinheiro com Comissões
              </h3>
            </div>
            
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              Com seu canal próprio você não paga mais comissões altas e não fica dependente de marketplaces.
            </p>
            
            <ul className="space-y-3 mb-6">
              {['Comissão zero', 'Canal próprio', 'Sem intermediários', 'Branding completo', 'Clientes diretos'].map((item, index) => (
                <li key={index} className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 text-purple-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            
            <button className="flex-col sm:flex-row bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
              Economizar Agora
            </button>
          </div>
        </div>

        {/* Comparativo de Comissões */}
        <div className="mt-20 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-2xl p-8 md:p-12 text-center text-white">
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            🚫 Chega de Comissões Abusivas!
          </h3>
          <p className="text-lg md:text-xl mb-6 opacity-90">
            Compare e veja quanto você pode economizar
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { platform: "Ifood", commission: "25-35%", color: "bg-red-500" },
              { platform: "Rappi", commission: "28-38%", color: "bg-blue-500" },
              { platform: "Uber Eats", commission: "30-40%", color: "bg-green-500" },
              { platform: "Deu Fome", commission: "0%", color: "bg-white text-yellow-500" }
            ].map((platform, index) => (
              <div key={index} className={`p-4 rounded-xl ${platform.color} shadow-lg transform hover:scale-105 transition-transform duration-300`}>
                <div className="font-bold text-lg mb-2">{platform.platform}</div>
                <div className="text-2xl font-extrabold">{platform.commission}</div>
                <div className="text-sm opacity-90">comissão</div>
              </div>
            ))}
          </div>
          
          <p className="mt-6 text-sm opacity-80">
            *Valores médios de comissão no mercado - Dados 2024
          </p>
        </div>

        {/* Call to Action Final */}
        <div className="text-center mt-16">
          <h3 className="text-3xl md:text-4xl font-bold text-black mb-6">
            Pronto para Transformar seu Delivery?
          </h3>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de estabelecimentos que já aumentaram suas vendas e reduziram custos
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-black hover:bg-gray-800 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-lg">
              🚀 Começar Agora - 7 Dias Grátis
            </button>
            <button className="border-2 border-black text-black hover:bg-black hover:text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105">
              📞 Falar com Especialista
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Componente Principal da Página Home - MELHORADO ---
function Home() {
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const navigate = useNavigate();
  const estabelecimentosRef = useRef(null);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const scrollToEstabelecimentos = () => {
    estabelecimentosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Filtro de estabelecimentos
  const filteredEstabelecimentos = estabelecimentos.filter(estabelecimento =>
    estabelecimento.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    estabelecimento.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    let isMounted = true;

    const fetchEstabelecimentos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'estabelecimentos'));
        const listaEstabelecimentos = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (isMounted) {
          setEstabelecimentos(listaEstabelecimentos);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Erro ao carregar estabelecimentos:", err);
          setError("Não foi possível carregar os estabelecimentos. Tente novamente mais tarde.");
          toast.error("Erro ao carregar estabelecimentos.");
        }
      }
    };

    fetchEstabelecimentos();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black">
        <div className="text-3xl font-bold mb-4 animate-pulse">
          Deu Fome <span className="text-yellow-500">.</span>
        </div>
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Carregando estabelecimentos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white text-red-500 p-4">
        <div className="text-6xl mb-4">😔</div>
        <p className="text-xl font-medium text-center mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-yellow-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header Fixo e Transparente - MELHORADO */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 md:p-6 flex justify-between items-center bg-white bg-opacity-95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div 
          className="font-extrabold text-2xl md:text-3xl text-black cursor-pointer hover:text-gray-800 transition-colors duration-300 flex items-center"
          onClick={() => navigate('/')}
        >
          <span className="text-yellow-500 mr-1">🍕</span>
          DEU FOME<span className="text-yellow-500">.</span>
        </div>
        <AuthButtonElegant onLoginClick={openLoginModal} />
      </header>

      {/* Hero Section */}
      <HeroSectionModern onExploreClick={scrollToEstabelecimentos} />

      {/* Seção de Benefícios */}
      <BenefitsSection />

      {/* Seção de Estabelecimentos Parceiros - MELHORADA */}
      <div ref={estabelecimentosRef} className="container mx-auto px-4 py-16 bg-white">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold text-black mb-4">
            Nossos Estabelecimentos Parceiros
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Descubra os melhores restaurantes e lanchonetes da sua cidade
          </p>
          <div className="w-24 h-1 bg-yellow-500 mx-auto rounded-full"></div>
        </div>

        {/* Barra de Pesquisa */}
        <div className="max-w-md mx-auto mb-12">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Pesquisar estabelecimentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-col sm:flex-row px-6 py-4 bg-gray-50 border border-gray-300 rounded-full text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
            />
          </div>
        </div>

        {filteredEstabelecimentos.length === 0 ? (
          <div className="text-center p-16 text-gray-600 bg-gray-50 rounded-2xl shadow-md border border-gray-200">
            <div className="text-6xl mb-4">🔍</div>
            <p className="font-medium text-lg mb-4">
              {searchTerm ? 'Nenhum estabelecimento encontrado' : 'Nenhum estabelecimento disponível no momento'}
            </p>
            <p className="font-normal text-md">
              {searchTerm ? 'Tente buscar com outros termos' : 'Estamos trabalhando para trazer as melhores opções!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredEstabelecimentos.map(estabelecimento => (
              <div
                key={estabelecimento.id}
                className="group bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl cursor-pointer flex flex-col border border-gray-200 hover:border-yellow-500"
                onClick={() => {
                  if (estabelecimento.slug) {
                    navigate(`/cardapio/${estabelecimento.slug}`);
                    toast.info(`Carregando cardápio de ${estabelecimento.nome}...`);
                  } else {
                    toast.error(`Estabelecimento "${estabelecimento.nome}" não disponível.`);
                  }
                }}
              >
                {estabelecimento.imageUrl ? (
                  <div className="relative overflow-hidden">
                    <img
                      src={estabelecimento.imageUrl}
                      alt={estabelecimento.nome || 'Estabelecimento'}
                      className="flex-col sm:flex-row h-56 object-cover object-center group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-semibold">
                      ⭐ {estabelecimento.rating || '4.5'}
                    </div>
                  </div>
                ) : (
                  <div className="flex-col sm:flex-row h-56 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400">
                    <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                  </div>
                )}
                
                <div className="p-6 flex-grow">
                  <h3 className="text-xl font-bold text-black mb-2 leading-tight group-hover:text-yellow-600 transition-colors duration-300">
                    {estabelecimento.nome}
                  </h3>
                  
                  {estabelecimento.categoria && (
                    <span className="inline-block bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm mb-3">
                      {estabelecimento.categoria}
                    </span>
                  )}
                  
                  {estabelecimento.endereco && typeof estabelecimento.endereco === 'object' ? (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      📍 {[
                        estabelecimento.endereco.rua,
                        estabelecimento.endereco.numero,
                        estabelecimento.endereco.bairro,
                        estabelecimento.endereco.cidade
                      ].filter(Boolean).join(', ')}
                    </p>
                  ) : (
                    <p className="text-gray-500 text-sm mb-3">📍 Endereço não especificado</p>
                  )}
                  
                  {estabelecimento.tempoEntrega && (
                    <p className="text-green-600 text-sm font-semibold">
                      ⏱️ {estabelecimento.tempoEntrega} min
                    </p>
                  )}
                </div>
                
                <div className="p-6 border-t border-gray-100 group-hover:border-yellow-200 transition-colors duration-300">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (estabelecimento.slug) {
                        navigate(`/cardapio/${estabelecimento.slug}`);
                        toast.info(`Carregando cardápio de ${estabelecimento.nome}...`);
                      }
                    }}
                    className="flex-col sm:flex-row bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-xl text-lg transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    🍽️ Ver Cardápio
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé Moderno - MELHORADO */}
      <footer className="bg-gradient-to-b from-black to-gray-900 text-gray-400 py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="font-extrabold text-2xl text-white mb-4">
                DEU FOME<span className="text-yellow-500">.</span>
              </div>
<p className="text-sm sm:text-base">
                Sua experiência de delivery, elevada. Conectamos você aos melhores estabelecimentos da cidade.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Links Rápidos</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-yellow-400 transition-colors">Sobre Nós</a></li>
                <li><a href="#" className="hover:text-yellow-400 transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-yellow-400 transition-colors">Trabalhe Conosco</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Para Estabelecimentos</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-yellow-400 transition-colors">Cadastre seu Negócio</a></li>
                <li><a href="#" className="hover:text-yellow-400 transition-colors">Planos e Preços</a></li>
                <li><a href="#" className="hover:text-yellow-400 transition-colors">Área do Parceiro</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-sm">
                <li>📧 contato@deufome.com</li>
                <li>📱 (11) 99999-9999</li>
                <li>📍 São Paulo, SP</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="font-medium text-sm">
              &copy; {new Date().getFullYear()} Deu Fome. Todos os direitos reservados.
            </p>
            <p className="font-normal text-xs mt-2">
              Feito com ❤️ para transformar o delivery
            </p>
          </div>
        </div>
      </footer>

      {/* Botão WhatsApp Flutuante */}
      <WhatsAppFloatingButton />

      {/* Renderiza o Modal de Login/Cadastro */}
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />


    </>
  );
}

export default Home;