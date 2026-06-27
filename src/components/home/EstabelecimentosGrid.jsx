// src/components/home/EstabelecimentosGrid.jsx
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { Search, MapPin, Clock, Star, Store } from 'lucide-react';
import AnimatedSection from './AnimatedSection';
import TiltCard from './TiltCard';

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' },
  }),
};

const EstabelecimentosGrid = ({ estabelecimentos }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleCardClick = useCallback(
    (slug, nome, tipoNegocio) => {
      const routePrefix = tipoNegocio === 'varejo' ? 'catalogo' : 'cardapio';
      navigate(`/${routePrefix}/${slug}`);
      toast.info(`Carregando ${routePrefix} de ${nome}...`);
    },
    [navigate]
  );

  const filtered = useMemo(() => {
    return estabelecimentos.filter(
      (e) =>
        e.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [estabelecimentos, searchTerm]);

  return (
    <section className="w-full bg-slate-950 text-white py-20 md:py-28 px-4 border-t border-slate-900 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-[30%] right-[-10%] w-[450px] h-[450px] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-red-500/5 blur-[100px] pointer-events-none" />

      <div className="container mx-auto relative z-10">
        {/* Header */}
        <AnimatedSection className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-400 text-xs font-bold uppercase tracking-widest mb-4">
            🏢 Rede de Estabelecimentos
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Nossos <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">Parceiros</span>
          </h2>
          <p className="text-lg text-slate-455 max-w-2xl mx-auto font-medium">
            Descubra lojas, mercados, distribuidoras e parceiros na sua cidade
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-orange-500 to-red-600 mx-auto mt-6 rounded-full" />
        </AnimatedSection>

        {/* Search */}
        <div className="max-w-md mx-auto mb-16">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-orange-400 transition-colors" />
            <input
              type="text"
              placeholder="Pesquisar estabelecimentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-md focus:shadow-[0_0_20px_rgba(249,115,22,0.1)]"
            />
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <AnimatedSection>
            <div className="text-center p-16 text-slate-400 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-white/5 shadow-xl">
              <Search className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="font-bold text-lg mb-2">
                {searchTerm ? 'Nenhum estabelecimento encontrado' : 'Nenhum estabelecimento disponível no momento'}
              </p>
              <p className="text-sm text-slate-550">
                {searchTerm ? 'Tente buscar com outros termos' : 'Estamos trabalhando para trazer as melhores opções!'}
              </p>
            </div>
          </AnimatedSection>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filtered.map((est, index) => (
              <motion.div
                key={est.id}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="group flex flex-col"
              >
                <TiltCard maxRotate={10} scale={1.03} className="h-full">
                  <div 
                    onClick={() => handleCardClick(est.slug, est.nome, est.tipoNegocio)}
                    className="h-full flex flex-col bg-slate-900/40 backdrop-blur-md rounded-3xl overflow-hidden cursor-pointer border border-white/5 hover:border-orange-500/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.55)] transition-all duration-300"
                  >
                    {/* Image */}
                    {est.imageUrl ? (
                      <div className="relative overflow-hidden h-52">
                        <img
                          src={est.imageUrl}
                          alt={est.nome || 'Estabelecimento'}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute top-3 right-3 bg-slate-950/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-md border border-white/10">
                          <Star className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                          {est.rating || '4.5'}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-52 bg-slate-950 flex items-center justify-center border-b border-white/5">
                        <Store className="w-12 h-12 text-slate-700" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-5 flex-grow flex flex-col justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">
                          {est.nome}
                        </h3>

                        {est.categoria && (
                          <span className="inline-block bg-orange-500/10 text-orange-450 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                            {est.categoria}
                          </span>
                        )}

                        {est.endereco && typeof est.endereco === 'object' ? (
                          <p className="text-slate-400 text-sm mb-2 flex items-start gap-1.5 line-clamp-2 leading-relaxed">
                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                            {[est.endereco.rua, est.endereco.numero, est.endereco.bairro, est.endereco.cidade]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        ) : (
                          <p className="text-slate-500 text-sm mb-2 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-slate-600" />
                            Endereço não especificado
                          </p>
                        )}
                      </div>

                      {est.tempoEntrega && (
                        <p className="text-emerald-400 text-sm font-bold flex items-center gap-1.5 mt-auto">
                          <Clock className="w-4 h-4" />
                          {est.tempoEntrega} min
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="p-5 pt-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(est.slug, est.nome, est.tipoNegocio);
                        }}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-650 hover:from-orange-650 hover:to-red-700 text-slate-950 font-black py-3 rounded-xl transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider"
                      >
                        {est.tipoNegocio === 'varejo' ? '🛍️ Ver Catálogo' : est.tipoNegocio === 'atacado' ? '📦 Ver Atacado' : '🍽️ Ver Cardápio'}
                      </button>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default EstabelecimentosGrid;
