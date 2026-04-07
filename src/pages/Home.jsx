// src/pages/Home.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

import {
  HeroSection,
  HowItWorks,
  BenefitsSection,
  LoginModal,
  EstabelecimentosGrid,
  Footer,
  WhatsAppButton,
} from '../components/home';

/* ------------------------------------------------------------------ */
/* Hook – carrega estabelecimentos com cache no localStorage         */
/* ------------------------------------------------------------------ */
const useEstabelecimentos = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const CACHE_KEY = 'estabelecimentos_cache_v1';
    const CACHE_EXPIRY = 5 * 60 * 1000;

    const fetchEstabelecimentos = async () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY) {
            if (isMounted) {
              setData(cachedData);
              setLoading(false);
              return;
            }
          }
        }

        const querySnapshot = await getDocs(collection(db, 'estabelecimentos'));
        const lista = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((est) => est.ativo !== false);

        if (isMounted) {
          setData(lista);
          setLoading(false);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data: lista, timestamp: Date.now() })
          );
        }
      } catch (err) {
        if (isMounted) {
          console.error('Erro ao carregar estabelecimentos:', err);
          setError('Não foi possível carregar os estabelecimentos. Tente novamente mais tarde.');
          setLoading(false);

          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const { data: cachedData } = JSON.parse(cached);
            setData(cachedData);
          }
        }
      }
    };

    fetchEstabelecimentos();
    return () => { isMounted = false; };
  }, []);

  return { data, loading, error };
};

/* ------------------------------------------------------------------ */
/* Página Home                                                       */
/* ------------------------------------------------------------------ */
function Home() {
  const { data: estabelecimentos, loading, error } = useEstabelecimentos();
  
  // ADICIONADOS: userData e authChecked para verificarmos os cargos
  const { currentUser, userData, authChecked, isAdmin, isMasterAdmin } = useAuth();
  const navigate = useNavigate();

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

 // === REDIRECIONAMENTO AUTOMÁTICO BASEADO NO CARGO ===
  useEffect(() => {
    if (authChecked && userData) {
      
      const cargosRaw = Array.isArray(userData.cargo) ? userData.cargo : [userData.cargo || ''];
      const cargosNormalizados = cargosRaw.map(cargo => 
        String(cargo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      );

      // Filtra apenas os cargos de funcionário para sabermos exatamente quantos ele tem
      const cargosDeFuncionario = ['garcom', 'atendente', 'caixa', 'gerente', 'cozinheiro', 'entregador', 'auxiliar'];
      const meusCargos = cargosNormalizados.filter(c => cargosDeFuncionario.includes(c));

      if (userData.isMasterAdmin) {
        navigate('/master/estabelecimentos', { replace: true });
        
      } else if (userData.isAdmin) {
        navigate('/admin/dashboard', { replace: true });
        
      } else if (meusCargos.length > 1) {
        // MAIS DE UM CARGO: Vai para o Dashboard/Painel Geral
        navigate('/painel', { replace: true }); // Se preferir a tela de dashboard, troque para '/dashboard'
        
      } else if (meusCargos.length === 1) {
        // APENAS UM CARGO: Vai direto para a tela específica
        const cargoUnico = meusCargos[0];
        
        if (['garcom', 'atendente'].includes(cargoUnico)) {
          navigate('/controle-salao', { replace: true });
        } else if (cargoUnico === 'caixa') {
          navigate('/pdv', { replace: true });
        } else {
          navigate('/painel', { replace: true });
        }
      }
      // Se length === 0 (cliente comum), fica na Home.
    }
  }, [authChecked, userData, navigate]);

  // Função simplificada: o useEffect acima já vai cuidar de mandar a pessoa pro lugar certo
  const handleLoginSucesso = useCallback(() => {
    closeLoginModal();
    toast.success('Login realizado com sucesso!');
  }, [closeLoginModal]);

  return (
    <>
      {/* Hero */}
      <HeroSection
        onLoginClick={openLoginModal}
        currentUser={currentUser}
        isAdmin={isAdmin}
        isMasterAdmin={isMasterAdmin}
      />

      {/* Como Funciona */}
      <HowItWorks />

      {/* Benefícios */}
      <BenefitsSection />

      {/* Estabelecimentos */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : (
        <EstabelecimentosGrid estabelecimentos={estabelecimentos} />
      )}

      {/* CALL TO ACTION MOTOBOY */}
      <section className="bg-slate-900 py-16 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full mx-auto flex items-center justify-center mb-6">
             <span className="text-4xl">🛵</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Você é motoboy? Quer fazer um extra?</h2>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto font-medium">
            Cadastre-se no <span className="text-emerald-400 font-bold">IdeaEntregas</span>, faça seu próprio horário e ganhe por cada entrega realizada no seu raio de atuação. Seja parceiro da nossa rede!
          </p>
          <button 
            onClick={() => navigate('/login-motoboy')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 px-10 rounded-full text-lg uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
          >
            Quero ser Entregador
          </button>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* WhatsApp FAB */}
      <WhatsAppButton />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onSuccess={handleLoginSucesso}
      />
    </>
  );
}

export default Home;
