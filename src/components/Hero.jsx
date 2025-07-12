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
    <div className="bg-gray-100 min-h-screen pb-8">
      {/* Cabeçalho com banner */}
      <section className="bg-cover bg-center h-56 relative" style={{ backgroundImage: "url('/images/banner-ifood.jpg')" }}>
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <div className="relative z-10 container mx-auto h-full flex flex-col justify-center items-center px-4">
          <h2 className="text-white text-3xl font-bold mb-4 drop-shadow-lg">Nunca foi tão fácil pedir mercado</h2>
          <div className="w-full sm:w-2/3 md:w-1/2">
            <input
              type="text"
              placeholder="Digite seu endereço ou restaurante"
              className="w-full px-4 py-3 rounded-lg focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Categorias */}
      <section className="container mx-auto mt-6 px-4">
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
          {categorias.map((cat) => (
            <div key={cat.nome} className="bg-white rounded-xl shadow-md flex flex-col items-center py-4 hover:shadow-lg transition">
              <img src={cat.icone} alt={cat.nome} className="w-10 h-10 mb-2" />
              <span className="text-sm font-medium">{cat.nome}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Banner de promoções */}
      <section className="container mx-auto mt-6 px-4">
        <div className="overflow-x-auto">
          <div className="inline-flex space-x-4">
            <div className="min-w-[250px] bg-red-500 rounded-xl p-4 text-white shadow-lg flex-shrink-0">
              <h3 className="text-lg font-semibold">Almoço bom e barato</h3>
              <p className="mt-2 font-bold">até R$25 • entrega grátis</p>
            </div>
            <div className="min-w-[250px] bg-red-500 rounded-xl p-4 text-white shadow-lg flex-shrink-0">
              <h3 className="text-lg font-semibold">Pratos com até 70% off</h3>
              <p className="mt-2 font-bold">valores imperdíveis</p>
            </div>
            {/* adicione mais banners se quiser */}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
