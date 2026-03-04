import React from "react";
import "../App.css";

const categorias = [
  { nome: "Restaurantes", icone: "/icons/restaurantes.svg" },
  { nome: "Mercado", icone: "/icons/mercado.svg" },
  { nome: "Farmácia", icone: "/icons/farmacia.svg" },
  { nome: "Pet", icone: "/icons/pet.svg" },
  { nome: "Bebidas", icone: "/icons/bebidas.svg" },
  // adicione mais categorias como quiser
];

function Home() {
  return (
    <div className="bg-gray-100 min-h-screen pb-8 font-sans">
      {/* Cabeçalho com banner */}
      <section className="bg-cover bg-center h-56 relative rounded-b-3xl overflow-hidden shadow-sm" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop')" }}>
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="relative z-10 container mx-auto h-full flex flex-col justify-center items-center px-4">
          <h2 className="text-white text-3xl font-bold mb-4 drop-shadow-lg text-center">Tudo o que precisa, à sua porta</h2>
          <div className="w-full sm:w-2/3 md:w-1/2">
            <input
              type="text"
              placeholder="🔍 Digite seu endereço ou restaurante..."
              className="w-full px-6 py-4 rounded-full focus:outline-none focus:ring-4 focus:ring-yellow-400 shadow-lg text-gray-800 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Categorias */}
      <section className="container mx-auto mt-8 px-4">
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
          {categorias.map((cat) => (
            <div key={cat.nome} className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center py-5 hover:shadow-md hover:border-yellow-300 transition-all cursor-pointer transform hover:-translate-y-1">
              {/* Fallback de ícone caso o SVG não exista */}
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <img src={cat.icone} alt={cat.nome} className="w-6 h-6 opacity-70" onError={(e) => e.target.style.display = 'none'} />
              </div>
              <span className="text-sm font-semibold text-gray-700">{cat.nome}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Banner de promoções */}
      <section className="container mx-auto mt-10 px-4">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Destaques IdeaFood 🔥</h3>
        <div className="overflow-x-auto pb-4 hide-scrollbar">
          <div className="inline-flex space-x-4">
            <div className="min-w-[280px] bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-2xl p-6 text-black shadow-md flex-shrink-0 cursor-pointer transform hover:scale-105 transition-transform">
              <h3 className="text-xl font-black mb-1">Almoço bom e barato</h3>
              <p className="font-medium opacity-90">Pratos até R$25 • Entrega Grátis</p>
              <button className="mt-4 bg-black text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">Aproveitar</button>
            </div>
            
            <div className="min-w-[280px] bg-gradient-to-r from-gray-800 to-black rounded-2xl p-6 text-white shadow-md flex-shrink-0 cursor-pointer transform hover:scale-105 transition-transform">
              <h3 className="text-xl font-black mb-1 text-yellow-400">Até 50% OFF</h3>
              <p className="font-medium opacity-90">Lanches e Bebidas selecionadas</p>
              <button className="mt-4 bg-white text-black px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">Ver Ofertas</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;