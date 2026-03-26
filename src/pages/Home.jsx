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
        const lista = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

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
