// src/pages/AdminDashboard.jsx

import React from "react";
import { Link } from "react-router-dom";
import DashboardSummary from "../components/DashboardSummary"; // 1. Importe o novo componente

// Componente de botão usado no dashboard
const ActionButton = ({ to, title, subtitle, icon, colorClass }) => (
  <Link
    to={to}
    className={`p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between transition-transform transform hover:scale-105 ${colorClass}`}
  >
    <div className="text-4xl mb-4">{icon}</div>
    <div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm opacity-90">{subtitle}</p>
    </div>
  </Link>
);

const AdminDashboard = () => {
  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen">
      {/* Título */}
      <h1 className="text-3xl font-bold text-white">
        Dashboard do Estabelecimento
      </h1>

      {/* 2. Adicione o componente de resumo aqui */}
      <DashboardSummary />

      {/* Grid com os botões de ação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Painel de pedidos */}
        <ActionButton
          to="/painel"
          title="Painel de Pedidos"
          subtitle="Gerenciar pedidos em tempo real."
          icon="🏪"
          colorClass="bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500"
        />
        {/* Novo botão Controle de Salão */}
        <ActionButton
          to="/controle-salao"
          title="Controle de Salão"
          subtitle="Gerenciar mesas e pedidos no salão."
          icon="🍽️"
          colorClass="bg-gradient-to-br from-green-600 to-green-800 hover:from-green-500"
        />

        {/* Gerenciar cardápio */}
        <ActionButton
          to="/admin/gerenciar-cardapio"
          title="Gerenciar Cardápio"
          subtitle="Adicionar e editar produtos."
          icon="🍔"
          colorClass="bg-gradient-to-br from-yellow-600 to-orange-700 hover:from-yellow-500"
        />

        {/* Taxas de entrega */}
        <ActionButton
          to="/admin/taxas-de-entrega"
          title="Taxas de Entrega"
          subtitle="Definir valores por bairro."
          icon="🛵"
          colorClass="bg-gradient-to-br from-cyan-500 to-teal-600 hover:from-cyan-400"
        />

        {/* Cupons */}
        <ActionButton
          to="/admin/cupons"
          title="Gerenciar Cupons"
          subtitle="Criar códigos de desconto."
          icon="💰"
          colorClass="bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-400"
        />

        {/* Relatórios */}
        <ActionButton
          to="/admin/reports"
          title="Relatórios"
          subtitle="Acessar dados e estatísticas."
          icon="📊"
          colorClass="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500"
        />
      </div>
    </div>
  );
};

export default AdminDashboard;