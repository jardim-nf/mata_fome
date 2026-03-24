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
/*  Hook – carrega estabelecimentos com cache no localStorage         */
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
/*  Página Home                                                        */
/* ------------------------------------------------------------------ */
function Home() {
  const { data: estabelecimentos, loading, error } = useEstabelecimentos();
  const { currentUser, isAdmin, isMasterAdmin } = useAuth();
  const navigate = useNavigate();

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const handleLoginSucesso = useCallback(() => {
    closeLoginModal();
    if (isMasterAdmin) {
      navigate('/master-dashboard');
    } else if (isAdmin) {
      navigate('/dashboard');
    } else {
      toast.success('Login realizado com sucesso!');
    }
  }, [closeLoginModal, isAdmin, isMasterAdmin, navigate]);

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