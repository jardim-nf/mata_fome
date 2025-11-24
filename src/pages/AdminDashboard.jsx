// src/pages/AdminDashboard.jsx - VERSÃO CORRIGIDA E COMPLETA
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardSummary from "../components/DashBoardSummary";
import withAuth from "../hocs/withAuth";
// ✅ CORREÇÃO: Adicionado IoColorPalette aos imports
import { IoStatsChart, IoShareSocial, IoColorPalette } from "react-icons/io5";
import { FaEnvelopeOpenText, FaUsers } from 'react-icons/fa';

// Componente de botão aprimorado e responsivo
const ActionButton = ({ to, title, subtitle, icon, colorClass, onClick }) => (
  <div
    onClick={onClick}
    className={`group relative p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border border-gray-200 bg-white flex flex-col justify-between transition-all duration-300 transform hover:scale-105 hover:shadow-lg overflow-hidden min-h-[140px] sm:min-h-[160px] cursor-pointer ${colorClass}`}
  >
    {/* Efeito de brilho no hover */}
    <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

    <div className="relative z-10 flex flex-col h-full justify-between">
      <div className="flex items-start justify-between">
        <div className="text-3xl sm:text-4xl lg:text-5xl transform group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        {/* Seta indicativa */}
        <div className="opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-lg sm:text-xl">
          →
        </div>
      </div>

      <div className="space-y-1 sm:space-y-2 mt-2 sm:mt-4">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight leading-tight text-gray-900">
          {title}
        </h2>
        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed line-clamp-2">
          {subtitle}
        </p>
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Limpar dados de sessão
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    sessionStorage.clear();

    // Redirecionar para a tela principal
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 lg:space-y-10">

        {/* Header melhorado com botão Sair no canto superior direito */}
        <div className="relative">
          <div className="text-center space-y-3 sm:space-y-4 px-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900">
              Dashboard do Estabelecimento
            </h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto">
              Gerencie seu estabelecimento de forma completa e eficiente
            </p>
          </div>

          {/* Botão Sair no canto superior direito */}
          <button
            onClick={handleLogout}
            className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all duration-200 transform hover:scale-105"
          >
            <span className="text-base">🚪</span>
            Sair
          </button>
        </div>

        {/* Componente de resumo */}
        <DashboardSummary />

        {/* Grid de ações totalmente responsivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          
          {/* Painel de pedidos */}
          <Link to="/painel">
            <ActionButton
              title="Painel de Pedidos"
              subtitle="Gerenciar pedidos em tempo real com atualizações instantâneas"
              icon="🏪"
              colorClass="hover:border-blue-500 hover:bg-blue-50"
            />
          </Link>

          {/* Controle de Salão */}
          <Link to="/controle-salao">
            <ActionButton
              title="Controle de Salão"
              subtitle="Gerenciar mesas e pedidos no salão com visualização em tempo real"
              icon="🍽️"
              colorClass="hover:border-green-500 hover:bg-green-50"
            />
          </Link>

          {/* Gerenciar cardápio */}
          <Link to="/admin/gerenciar-cardapio">
            <ActionButton
              title="Gerenciar Cardápio"
              subtitle="Adicionar, editar e organizar produtos do seu cardápio"
              icon="🍔"
              colorClass="hover:border-orange-500 hover:bg-orange-50"
            />
          </Link>

          {/* Identidade Visual (NOVO) */}
          <Link to="/admin/cores">
            <ActionButton
              title="Identidade Visual"
              subtitle="Personalize as cores e aparência do seu cardápio digital"
              icon={<IoColorPalette className="text-purple-600" />}
              colorClass="hover:border-purple-500 hover:bg-purple-50"
            />
          </Link>

          {/* Ordenar Categorias */}
          <Link to="/admin/ordenar-categorias">
            <ActionButton
              title="Ordenar Categorias"
              subtitle="Defina a ordem de exibição das categorias no cardápio"
              icon="📑"
              colorClass="hover:border-teal-500 hover:bg-teal-50"
            />
          </Link>

          {/* Painel de Produtividade */}
          <Link to="/admin/analytics">
            <ActionButton
              title="Produtividade"
              subtitle="Métricas, insights e otimizações para seu negócio"
              icon={<IoStatsChart className="text-indigo-600" />}
              colorClass="hover:border-indigo-500 hover:bg-indigo-50"
            />
          </Link>

          {/* Multi-Plataforma */}
          <Link to="/admin/multi-platform">
            <ActionButton
              title="Multi-Plataforma"
              subtitle="Integre com iFood, WhatsApp e outras plataformas"
              icon={<IoShareSocial className="text-purple-600" />}
              colorClass="hover:border-purple-500 hover:bg-purple-50"
            />
          </Link>

          {/* Taxas de entrega */}
          <Link to="/admin/taxas-de-entrega">
            <ActionButton
              title="Taxas de Entrega"
              subtitle="Definir valores por bairro e zonas de entrega"
              icon="🛵"
              colorClass="hover:border-cyan-500 hover:bg-cyan-50"
            />
          </Link>

          {/* Cupons */}
          <Link to="/admin/cupons">
            <ActionButton
              title="Gerenciar Cupons"
              subtitle="Criar e gerenciar códigos promocionais e descontos"
              icon="💰"
              colorClass="hover:border-pink-500 hover:bg-pink-50"
            />
          </Link>

          {/* Gestão de Funcionários */}
          <Link to="/admin/gestao-funcionarios">
            <ActionButton
              title="Gestão de Funcionários"
              subtitle="Controle de acesso e permissões da equipe"
              icon={<FaUsers className="text-blue-600" />}
              colorClass="hover:border-blue-500 hover:bg-blue-50"
            />
          </Link>

          {/* Relatórios */}
          <Link to="/admin/reports">
            <ActionButton
              title="Relatórios"
              subtitle="Acessar dados detalhados e estatísticas do seu negócio"
              icon="📊"
              colorClass="hover:border-purple-500 hover:bg-purple-50"
            />
          </Link>
        </div>

        {/* Footer sutil */}
        <div className="text-center pt-6 sm:pt-8">
          <p className="text-gray-500 text-xs sm:text-sm">
            DeuFome • Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
};

// Aplica o HOC de autenticação
export default withAuth(AdminDashboard, {
  requireAdmin: true,
  message: 'Acesso ao Dashboard restrito'
});