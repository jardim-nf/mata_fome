// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import HeroSection from '../components/HeroSection';
import EstabelecimentoList from '../components/EstabelecimentoList';
import SkeletonLoader from '../components/SkeletonLoader';
import { fetchEstabelecimentos } from '../services/estabelecimentoService';

export default function Home() {
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchEstabelecimentos();
        setEstabelecimentos(data);
      } catch (e) {
        console.error(e);
        setError('Falha ao carregar estabelecimentos.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="bg-accent min-h-screen">
      <HeroSection />

      <main className="max-w-7xl mx-auto p-6">
        <h2 className="text-2xl font-heading text-secondary mb-4">Estabelecimentos</h2>

        {loading ? (
          <SkeletonLoader count={6} />
        ) : error ? (
          <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>
        ) : (
          <EstabelecimentoList estabelecimentos={estabelecimentos} />
        )}
      </main>
    </div>
  );
}


// src/components/HeroSection.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function HeroSection() {
  const navigate = useNavigate();
  return (
    <section className="bg-primary text-accent py-20">
      <div className="max-w-3xl mx-auto text-center px-4">
        <h1 className="text-4xl lg:text-5xl font-heading mb-4">Peça sua comida favorita agora mesmo!</h1>
        <p className="text-lg mb-6">Explore restaurantes incríveis, faça seu pedido e receba no conforto de casa.</p>
        <button
          className="bg-accent text-secondary px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
          onClick={() => navigate('/lista-estabelecimentos')}
        >
          Ver Estabelecimentos
        </button>
      </div>
    </section>
  );
}


// src/components/EstabelecimentoList.jsx
import React from 'react';
import EstabelecimentoCard from './EstabelecimentoCard';

export default function EstabelecimentoList({ estabelecimentos }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {estabelecimentos.map(est => (
        <EstabelecimentoCard key={est.id} estabelecimento={est} />
      ))}
    </div>
  );
}


// src/components/EstabelecimentoCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function EstabelecimentoCard({ estabelecimento }) {
  return (
    <Link to={`/estabelecimento/${estabelecimento.id}`} role="article" className="block bg-white rounded-lg shadow-sm hover:shadow-md transition p-4 focus:outline-none focus:ring-2 focus:ring-primary">
      {estabelecimento.logoUrl && (
        <img src={estabelecimento.logoUrl} alt={`${estabelecimento.nome} logo`} className="h-32 w-full object-cover rounded-md mb-4" />
      )}
      <h3 className="text-xl font-heading text-secondary mb-2">{estabelecimento.nome}</h3>
      <p className="text-gray-600">{estabelecimento.descricao}</p>
    </Link>
  );
}


// src/components/SkeletonLoader.jsx
import React from 'react';

export default function SkeletonLoader({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}


// src/services/estabelecimentoService.js
export async function fetchEstabelecimentos() {
  const response = await fetch('/api/estabelecimentos');
  if (!response.ok) throw new Error('Network response was not ok');
  return response.json();
}
