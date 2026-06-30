import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Bike, Clock, DollarSign, MapPin } from 'lucide-react';

import {
  HeroSection,
  HowItWorks,
  BenefitsSection,
  FeaturesCarousel,
  LoginModal,
  EstabelecimentosGrid,
  Footer,
  WhatsAppButton,
  ROICalculator,
  ThreeSpaceBackground,
  TiltCard,
  CursorParticles,
  MascotWidget,
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
  const { currentUser, userData, authChecked, isAdmin, isMasterAdmin, modoManutencao } = useAuth();
  const navigate = useNavigate();

  const gridRef = useRef(null);
  const handleExploreClick = useCallback(() => {
    gridRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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
      const cargosDeFuncionario = ['garcom', 'atendente', 'caixa', 'gerente', 'cozinheiro', 'entregador', 'auxiliar', 'tecnico'];
      const meusCargos = cargosNormalizados.filter(c => cargosDeFuncionario.includes(c));

      if (userData.isMasterAdmin) {
        navigate('/master-dashboard', { replace: true });
        
      } else if (userData.isAdmin) {
        navigate('/admin/dashboard', { replace: true });
        
      } else if (meusCargos.length > 0) {
        const temOutroCargo = meusCargos.some(c => c !== 'entregador');
        if (temOutroCargo) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/entregador', { replace: true });
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

  if (modoManutencao && !userData?.isMasterAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden text-slate-100 font-sans p-6 text-center">
        {/* Background glow effects */}
        <div className="absolute top-[20%] left-1/4 w-[300px] h-[300px] rounded-full bg-orange-500/10 blur-[80px]" />
        <div className="absolute bottom-[20%] right-1/4 w-[300px] h-[300px] rounded-full bg-orange-500/10 blur-[80px]" />
        
        <div className="relative z-10 flex flex-col items-center gap-6 max-w-md">
          <div className="relative w-24 h-24 rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-xl shadow-2xl p-5 flex items-center justify-center animate-pulse">
            <span className="text-5xl">🔧</span>
          </div>
          <div>
            <h2 className="text-3xl font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent mb-3 uppercase tracking-tight">
              Sistema em Manutenção
            </h2>
            <p className="text-base text-slate-400 font-medium">
              Estamos realizando melhorias em nossa rede para te atender melhor. O sistema estará de volta em instantes!
            </p>
          </div>
          <div className="w-16 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden font-sans">
      {/* Interactive Cursor Particle Sparks Trail */}
      <CursorParticles />

      {/* Dynamic 3D Space Background */}
      <ThreeSpaceBackground />

      <div className="relative z-10">
        {/* Hero */}
        <HeroSection
          onExploreClick={handleExploreClick}
          onLoginClick={openLoginModal}
          currentUser={currentUser}
          isAdmin={isAdmin}
          isMasterAdmin={isMasterAdmin}
        />

        {/* Como Funciona */}
        <HowItWorks />

        {/* 16+ Funcionalidades Diferenciais */}
        <FeaturesCarousel />

        {/* Benefícios */}
        <BenefitsSection />

        {/* ROICalculator */}
        <ROICalculator />

        {/* Estabelecimentos */}
        <div ref={gridRef}>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-500">{error}</div>
          ) : (
            <EstabelecimentosGrid estabelecimentos={estabelecimentos} />
          )}
        </div>

        {/* CALL TO ACTION MOTOBOY */}
        <section className="bg-slate-950 py-32 px-6 relative overflow-hidden border-t border-white/5">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium text-sm mb-6">
                  <Bike size={16} />
                  <span>Idea Entregas</span>
                </div>
                
                <h2 className="text-4xl md:text-5xl font-semibold text-white mb-6 tracking-tight leading-[1.1]">
                  Seja um Entregador Parceiro e fature mais.
                </h2>
                
                <p className="text-lg text-slate-400 mb-10 max-w-[32rem] leading-relaxed">
                  Faça suas entregas de forma otimizada. Tenha flexibilidade de horários, ganhos justos por corrida e apoio no trânsito. Sem pegadinhas.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
                  {[
                    { icon: Clock, title: 'Horário Livre', desc: 'Trabalhe quando preferir' },
                    { icon: DollarSign, title: 'Ganhos Justos', desc: 'Sem taxas abusivas' }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-slate-900 border border-white/5 p-6 rounded-2xl flex flex-col gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <item.icon size={20} />
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-base mb-1">{item.title}</h4>
                        <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-md bg-slate-900 border border-white/5 p-10 rounded-3xl text-center relative overflow-hidden">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center mb-6">
                    <span className="text-4xl">🛵</span>
                  </div>
                  
                  <h3 className="text-white text-2xl font-semibold mb-3">Faça seu cadastro</h3>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                    Conecte-se com as melhores lojas e mercados parceiros da nossa rede de forma direta.
                  </p>
                  
                  <button 
                    onClick={() => navigate('/login-motoboy')}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-medium py-3.5 px-6 rounded-xl text-base transition-colors mb-4"
                  >
                    Quero ser Entregador
                  </button>
                  
                  <p className="text-sm text-slate-500">
                    Requisitos: Veículo próprio e CNH em dia.
                  </p>
                </div>
              </div>
              
            </div>
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>

      {/* WhatsApp FAB */}
      <WhatsAppButton />

      {/* Mascot AI Support Widget */}
      <MascotWidget />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onSuccess={handleLoginSucesso}
      />
    </div>
  );
}

export default Home;
