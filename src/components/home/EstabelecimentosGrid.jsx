// src/components/home/EstabelecimentosGrid.jsx
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { Search, MapPin, Clock, Star, Store } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

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
    (slug, nome) => {
      navigate(`/cardapio/${slug}`);
      toast.info(`Carregando cardápio de ${nome}...`);
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
    <section className="container mx-auto px-4 py-16 md:py-24 bg-white">
      {/* Header */}
      <AnimatedSection className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
          Nossos <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">Parceiros</span>
        </h2>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-6">
          Descubra os melhores restaurantes e lanchonetes da sua cidade
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full" />
      </AnimatedSection>

      {/* Search */}
      <div className="max-w-md mx-auto mb-12">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-yellow-500 transition-colors" />
          <input
            type="text"
            placeholder="Pesquisar estabelecimentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all shadow-sm focus:shadow-md"
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <AnimatedSection>
          <div className="text-center p-16 text-gray-500 bg-gray-50 rounded-3xl border border-gray-100">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="font-medium text-lg mb-2">
              {searchTerm ? 'Nenhum estabelecimento encontrado' : 'Nenhum estabelecimento disponível no momento'}
            </p>
            <p className="text-sm text-gray-400">
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
              whileHover={{ y: -6 }}
              className="group bg-white rounded-3xl shadow-lg overflow-hidden cursor-pointer flex flex-col border border-gray-100 hover:border-yellow-400 transition-colors duration-300"
              onClick={() => handleCardClick(est.slug, est.nome)}
            >
              {/* Image */}
              {est.imageUrl ? (
                <div className="relative overflow-hidden">
                  <img
                    src={est.imageUrl}
                    alt={est.nome || 'Estabelecimento'}
                    className="w-full h-52 object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 shadow-sm">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    {est.rating || '4.5'}
                  </div>
                </div>
              ) : (
                <div className="w-full h-52 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <Store className="w-12 h-12 text-gray-300" />
                </div>
              )}

              {/* Content */}
              <div className="p-5 flex-grow">
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-yellow-600 transition-colors">
                  {est.nome}
                </h3>

                {est.categoria && (
                  <span className="inline-block bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                    {est.categoria}
                  </span>
                )}

                {est.endereco && typeof est.endereco === 'object' ? (
                  <p className="text-gray-500 text-sm mb-2 flex items-start gap-1.5 line-clamp-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                    {[est.endereco.rua, est.endereco.numero, est.endereco.bairro, est.endereco.cidade]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm mb-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-300" />
                    Endereço não especificado
                  </p>
                )}

                {est.tempoEntrega && (
                  <p className="text-emerald-600 text-sm font-semibold flex items-center gap-1.5">
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
                    handleCardClick(est.slug, est.nome);
                  }}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  🍽️ Ver Cardápio
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
};

export default EstabelecimentosGrid;
