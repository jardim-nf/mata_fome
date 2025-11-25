// src/pages/AdminDashboard.jsx - VERSÃO COM ALTURA FIXA E ALINHADA
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardSummary from "../components/DashBoardSummary";
import withAuth from "../hocs/withAuth";
import { IoStatsChart, IoShareSocial, IoColorPalette } from "react-icons/io5";
import { FaUsers } from 'react-icons/fa';

// 1. CORREÇÃO: Altura Fixa e Flexível
// Adicionei 'h-full' para ocupar toda a célula e removi alturas variáveis
const ActionButton = ({ to, title, subtitle, icon, colorClass, onClick }) => (
  <div
    onClick={onClick}
    className={`group relative p-6 h-full rounded-2xl border border-gray-200 bg-white flex flex-col justify-between transition-all duration-300 transform hover:scale-105 hover:shadow-lg cursor-pointer ${colorClass}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>

    <div className="relative z-10 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl sm:text-5xl transform group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-xl text-gray-400">
          →
        </div>
      </div>

      <div className="mt-auto">
        <h2 className="text-xl font-bold text-gray-900 leading-tight mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
          {subtitle}
        </p>
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    sessionStorage.clear();
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="relative flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="text-center md:text-left space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Dashboard <span className="text-blue-600">Admin</span>
            </h1>
            <p className="text-gray-500">
              Gerencie seu estabelecimento de forma completa
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 md:mt-0 flex items-center gap-2 px-6 py-2.5 text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 font-bold transition-all"
          >
            <span>🚪</span> Sair
          </button>
        </div>

        <DashboardSummary />

        {/* 2. CORREÇÃO: Grid com 'auto-rows-fr' para forçar altura igual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          
          <Link to="/painel">
            <ActionButton
              title="Painel de Pedidos"
              subtitle="Acompanhe pedidos de Delivery e Salão em tempo real"
              icon="🏪"
              colorClass="hover:border-blue-500 hover:bg-blue-50"
            />
          </Link>

          <Link to="/controle-salao">
            <ActionButton
              title="Controle de Salão"
              subtitle="Mapa de mesas, comandas e pedidos presenciais"
              icon="🍽️"
              colorClass="hover:border-green-500 hover:bg-green-50"
            />
          </Link>

          {/* O Card do PDV agora terá a mesma altura automaticamente */}
          <Link to="/pdv">
            <ActionButton
              title="Frente de Loja (PDV)"
              subtitle="Caixa rápido, vendas de balcão e emissão de NFC-e"
              icon="🖥️"
              colorClass="hover:border-purple-500 hover:bg-purple-50"
            />
          </Link>

          <Link to="/admin/gerenciar-cardapio">
            <ActionButton
              title="Cardápio Digital"
              subtitle="Cadastre produtos, fotos, preços e categorias"
              icon="🍔"
              colorClass="hover:border-orange-500 hover:bg-orange-50"
            />
          </Link>

          <Link to="/admin/cores">
            <ActionButton
              title="Identidade Visual"
              subtitle="Personalize as cores e o tema do seu app"
              icon={<IoColorPalette className="text-pink-500" />}
              colorClass="hover:border-pink-500 hover:bg-pink-50"
            />
          </Link>

          <Link to="/admin/ordenar-categorias">
            <ActionButton
              title="Ordenar Categorias"
              subtitle="Organize a sequência de exibição no cardápio"
              icon="📑"
              colorClass="hover:border-teal-500 hover:bg-teal-50"
            />
          </Link>

          <Link to="/admin/analytics">
            <ActionButton
              title="Produtividade"
              subtitle="Gráficos de vendas, faturamento e desempenho"
              icon={<IoStatsChart className="text-indigo-600" />}
              colorClass="hover:border-indigo-500 hover:bg-indigo-50"
            />
          </Link>

          <Link to="/admin/multi-platform">
            <ActionButton
              title="Integrações"
              subtitle="Conecte com iFood, WhatsApp e impressoras"
              icon={<IoShareSocial className="text-blue-500" />}
              colorClass="hover:border-blue-500 hover:bg-blue-50"
            />
          </Link>

          <Link to="/admin/taxas-de-entrega">
            <ActionButton
              title="Taxas de Entrega"
              subtitle="Configure valores por bairro ou raio de distância"
              icon="🛵"
              colorClass="hover:border-cyan-500 hover:bg-cyan-50"
            />
          </Link>

          <Link to="/admin/cupons">
            <ActionButton
              title="Cupons de Desconto"
              subtitle="Crie promoções e códigos para atrair clientes"
              icon="🎫"
              colorClass="hover:border-yellow-500 hover:bg-yellow-50"
            />
          </Link>

          <Link to="/admin/gestao-funcionarios">
            <ActionButton
              title="Equipe e Acessos"
              subtitle="Gerencie garçons, caixas e administradores"
              icon={<FaUsers className="text-blue-600" />}
              colorClass="hover:border-blue-600 hover:bg-blue-50"
            />
          </Link>

          <Link to="/admin/reports">
            <ActionButton
              title="Relatórios Fiscais"
              subtitle="Extratos detalhados para contabilidade"
              icon="📊"
              colorClass="hover:border-gray-500 hover:bg-gray-50"
            />
          </Link>

        </div>

        <div className="text-center pt-8 border-t border-gray-200">
          <p className="text-gray-400 text-sm">
            DeuFome System • Versão 2.5
          </p>
        </div>
      </div>
    </div>
  );
};

export default withAuth(AdminDashboard, {
  requireAdmin: true,
  message: 'Acesso restrito'
});