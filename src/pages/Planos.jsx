// src/pages/Planos.jsx
import React from 'react';

function Planos() {
  return (
    <div className="min-h-screen bg-[var(--bege-claro)] p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8 md:p-12">
        <h1 className="text-4xl font-extrabold text-center text-[var(--vermelho-principal)] mb-10">
          Planos e Funcionalidades do DeuFome.
        </h1>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-[var(--marrom-escuro)] mb-6 border-b-2 border-gray-200 pb-3">
            Como Funciona?
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            O DeuFome é a plataforma perfeita para restaurantes, lanchonetes e bares que desejam digitalizar seus pedidos e otimizar a gestão. Com nossa solução, você oferece uma experiência de pedido online intuitiva para seus clientes e centraliza todas as informações em um painel de controle fácil de usar.
          </p>
          <ul className="list-disc list-inside text-lg text-gray-700 space-y-3">
            <li><strong>Cardápio Online Personalizável:</strong> Crie seu cardápio digital com fotos, descrições e preços, atualizando a qualquer momento.</li>
            <li><strong>Pedidos Simplificados:</strong> Clientes fazem pedidos diretamente pelo celular, sem burocracia ou aplicativos complexos.</li>
            <li><strong>Painel de Controle Intuitivo:</strong> Acompanhe todos os pedidos em tempo real, mude status (recebido, em preparo, em entrega, finalizado) e gerencie sua cozinha.</li>
            <li><strong>Comandas para Cozinha:</strong> Gere comandas imprimíveis com todos os detalhes do pedido para agilizar a produção.</li>
            <li><strong>Notificações por WhatsApp:</strong> Mantenha seus clientes informados sobre o status do pedido com mensagens automáticas via WhatsApp.</li>
            <li><strong>Gestão de Estabelecimentos e Produtos:</strong> (Em breve) Controle completo de seus itens e lojas diretamente pelo painel.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-[var(--marrom-escuro)] mb-6 border-b-2 border-gray-200 pb-3">
            Nossos Planos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Plano Básico */}
            <div className="bg-[var(--bege-claro)] p-6 rounded-lg shadow-lg border-t-4 border-[var(--vermelho-principal)] flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-[var(--vermelho-principal)] mb-3">Plano Básico</h3>
                <p className="text-gray-600 mb-4">Ideal para pequenos negócios que estão começando no delivery.</p>
                <p className="text-4xl font-extrabold text-[var(--marrom-escuro)] mb-6">
                  R$49<span className="text-xl font-normal">/mês</span>
                </p>
                <ul className="list-none space-y-2 text-gray-700 mb-6">
                  <li>✅ Cardápio Online</li>
                  <li>✅ Painel de Pedidos</li>
                  <li>✅ Comandas para Cozinha</li>
                  <li>✅ Suporte Básico</li>
                </ul>
              </div>
              <button className="w-full bg-[var(--vermelho-principal)] text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition duration-300">
                Começar Agora
              </button>
            </div>

            {/* Plano Essencial */}
            <div className="bg-[var(--bege-claro)] p-6 rounded-lg shadow-lg border-t-4 border-[var(--marrom-escuro)] flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-3">Plano Essencial</h3>
                <p className="text-gray-600 mb-4">Para negócios que buscam mais recursos e automação.</p>
                <p className="text-4xl font-extrabold text-[var(--marrom-escuro)] mb-6">
                  R$99<span className="text-xl font-normal">/mês</span>
                </p>
                <ul className="list-none space-y-2 text-gray-700 mb-6">
                  <li>✅ Tudo do Plano Básico</li>
                  <li>✅ Notificações por WhatsApp</li>
                  <li>✅ Relatórios de Vendas</li>
                  <li>✅ Suporte Prioritário</li>
                </ul>
              </div>
              <button className="w-full bg-[var(--marrom-escuro)] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition duration-300">
                Escolher Plano
              </button>
            </div>

            {/* Plano Premium */}
            <div className="bg-[var(--bege-claro)] p-6 rounded-lg shadow-lg border-t-4 border-[var(--verde-destaque)] flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-[var(--verde-destaque)] mb-3">Plano Premium</h3>
                <p className="text-gray-600 mb-4">Solução completa para grandes estabelecimentos e redes.</p>
                <p className="text-4xl font-extrabold text-[var(--marrom-escuro)] mb-6">
                  R$199<span className="text-xl font-normal">/mês</span>
                </p>
                <ul className="list-none space-y-2 text-gray-700 mb-6">
                  <li>✅ Tudo do Plano Essencial</li>
                  <li>✅ Gestão de Múltiplos Estabelecimentos</li>
                  <li>✅ Integrações Personalizadas</li>
                  <li>✅ Suporte Dedicado 24/7</li>
                </ul>
              </div>
              <button className="w-full bg-[var(--verde-destaque)] text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-300">
                Fale Conosco
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Planos;