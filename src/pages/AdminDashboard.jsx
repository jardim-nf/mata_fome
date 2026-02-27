// src/pages/AdminDashboard.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashBoardSummary from "../components/DashBoardSummary";
import { useAuth } from "../context/AuthContext";
import withAuth from "../hocs/withAuth";

import { 
  IoStatsChart, IoShareSocial, IoColorPalette, IoSettings, IoTrashBin,
  IoStorefront, IoRestaurant, IoDesktopOutline, IoTicketOutline,
  IoFastFoodOutline, IoList, IoDocumentTextOutline, IoLogOutOutline,
  IoArrowBackOutline, IoPersonOutline, IoChevronDownOutline
} from "react-icons/io5"; 
import { FaUsers, FaMotorcycle, FaMapMarkedAlt } from 'react-icons/fa'; 

// Componente visual do botão
const ActionButton = ({ title, subtitle, icon, themeColor }) => {
  const themes = {
    blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:shadow-blue-200",
    green: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:shadow-emerald-200",
    purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:shadow-purple-200",
    orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:shadow-orange-200",
    yellow: "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:shadow-amber-200",
    teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:shadow-teal-200",
    pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-600 group-hover:shadow-pink-200",
    red: "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:shadow-rose-200",
    indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:shadow-indigo-200",
    slate: "bg-slate-50 text-slate-600 group-hover:bg-slate-600 group-hover:shadow-slate-200",
  };

  return (
    <div className="group relative h-full bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 transform hover:-translate-y-1 overflow-hidden flex flex-col cursor-pointer">
      <div className="absolute -right-6 -top-6 text-9xl opacity-[0.03] text-slate-900 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 pointer-events-none">{icon}</div>
      <div className="relative z-10 flex flex-col h-full">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-5 transition-all duration-300 shadow-sm group-hover:text-white group-hover:shadow-lg ${themes[themeColor] || themes.slate}`}>{icon}</div>
        <div className="mt-auto">
          <h2 className="text-xl font-extrabold text-slate-800 mb-2 group-hover:text-slate-900 tracking-tight">{title}</h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-2">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();
  
  // Estado para controlar se o Resumo de Faturamento está aberto ou fechado
  const [showSummary, setShowSummary] = useState(false);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div></div>;

  const isRealAdmin = currentUser?.isAdmin === true || currentUser?.isMasterAdmin === true;
  
  const temPermissao = (perm) => {
      if (isRealAdmin) return true;
      return currentUser?.permissoes?.includes(perm);
  };

  // 🔥 BOTÕES AGRUPADOS POR CATEGORIA 🔥
  const menuGroups = [
    {
      title: "⚡ Operação Diária",
      description: "Telas de acompanhamento e vendas em tempo real",
      items: [
        { path: '/painel', title: 'Monitor de Pedidos', sub: 'Delivery e Salão em tempo real', icon: <IoStorefront />, cor: 'blue', perm: 'painel' },
        { path: '/controle-salao', title: 'Controle de Salão', sub: 'Mapa de mesas e comandas', icon: <IoRestaurant />, cor: 'green', perm: 'controle-salao' },
        { path: '/pdv', title: 'Frente de Caixa (PDV)', sub: 'Caixa rápido e emissão NFC-e', icon: <IoDesktopOutline />, cor: 'purple', adminOnly: true },
      ]
    },
    {
      title: "🍔 Catálogo & Logística",
      description: "Gestão do que você vende e como entrega",
      items: [
        { path: '/admin/gerenciar-cardapio', title: 'Cardápio Digital', sub: 'Produtos, fotos e variações', icon: <IoFastFoodOutline />, cor: 'orange', perm: 'visualizar-cardapio' },
        { path: '/admin/ordenar-categorias', title: 'Categorias', sub: 'Ordem de exibição do cardápio', icon: <IoList />, cor: 'teal', perm: 'visualizar-cardapio', permOuAdmin: true },
        { path: '/admin/entregadores', title: 'Entregadores', sub: 'Gerencie motoboys e rotas', icon: <FaMotorcycle />, cor: 'indigo' },
        { path: '/admin/taxas-de-entrega', title: 'Taxas de Entrega', sub: 'Valores de frete por bairro', icon: <FaMapMarkedAlt />, cor: 'amber' },
        { path: '/admin/cupons', title: 'Cupons de Desconto', sub: 'Crie códigos promocionais', icon: <IoTicketOutline />, cor: 'yellow' },
      ]
    },
    {
      title: "📊 Gestão & Relatórios",
      description: "Análise financeira e controle da equipe",
      items: [
        { path: '/admin/analytics', title: 'Análises e Gráficos', sub: 'Métricas e faturamento', icon: <IoStatsChart />, cor: 'blue', adminOnly: true },
        { path: '/admin/reports', title: 'Relatórios Fiscais', sub: 'Extratos para contabilidade', icon: <IoDocumentTextOutline />, cor: 'slate', adminOnly: true },
        { path: '/admin/relatorio-cancelamentos', title: 'Cancelamentos', sub: 'Auditoria de exclusões master', icon: <IoTrashBin />, cor: 'red', adminOnly: true },
        { path: '/admin/gestao-funcionarios', title: 'Equipe e Acessos', sub: 'Gerencie garçons e permissões', icon: <FaUsers />, cor: 'indigo', adminOnly: true },
      ]
    },
    {
      title: "⚙️ Configurações do Sistema",
      description: "Ajustes técnicos e integrações",
      items: [
        { path: '/admin/multi-platform', title: 'Integrações', sub: 'iFood, WhatsApp e impressoras', icon: <IoShareSocial />, cor: 'teal', adminOnly: true },
        { path: '/admin/cores', title: 'Identidade Visual', sub: 'Cores e tema da loja', icon: <IoColorPalette />, cor: 'pink', adminOnly: true },
        { path: '/admin/configuracoes', title: 'Configurações Gerais', sub: 'Senha Master e segurança', icon: <IoSettings />, cor: 'slate', adminOnly: true },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans pb-20">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* 🔥 PAINEL DE FATURAMENTO RETRÁTIL (COLLAPSIBLE) 🔥 */}
        {isRealAdmin && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
            {/* Cabeçalho Clicável */}
            <button 
              onClick={() => setShowSummary(!showSummary)}
              className="w-full flex items-center justify-between p-5 sm:p-6 hover:bg-slate-50 transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl shadow-inner">
                  💰
                </div>
                <div className="text-left">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">Faturamento e Resumo do Dia</h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">Clique para {showSummary ? 'ocultar' : 'visualizar'} o desempenho das vendas de hoje</p>
                </div>
              </div>
              <div className={`p-2 rounded-full bg-slate-100 text-slate-500 transform transition-transform duration-300 ${showSummary ? 'rotate-180' : ''}`}>
                <IoChevronDownOutline className="text-xl" />
              </div>
            </button>

            {/* Conteúdo do Faturamento (Aparece apenas se showSummary for true) */}
            {showSummary && (
              <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 animate-fadeIn">
                <DashBoardSummary />
              </div>
            )}
          </div>
        )}

        {/* MÓDULOS AGRUPADOS */}
        <div className="space-y-12">
          {menuGroups.map((grupo, idx) => {
            
            // Filtra os itens que o usuário atual tem permissão para ver
            const itensPermitidos = grupo.items.filter(item => {
              if (item.adminOnly && !isRealAdmin) return false;
              if (item.perm && !item.permOuAdmin && !temPermissao(item.perm)) return false;
              if (item.permOuAdmin && !isRealAdmin && !temPermissao(item.perm)) return false;
              return true;
            });

            // Se o usuário não tiver permissão para NENHUM item deste grupo, oculta o grupo inteiro
            if (itensPermitidos.length === 0) return null;

            return (
              <div key={idx} className="animate-slideUp" style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className="mb-6 ml-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">{grupo.title}</h3>
                  <p className="text-sm text-slate-500 font-medium">{grupo.description}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
                  {itensPermitidos.map((item, itemIdx) => (
                    <Link key={itemIdx} to={item.path} className="h-full">
                      <ActionButton title={item.title} subtitle={item.sub} icon={item.icon} themeColor={item.cor} />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="text-center pt-8 border-t border-slate-200 mt-12"><p className="text-slate-400 font-medium text-sm">NaMão System • Gestão Inteligente</p></div>
      </div>
    </div>
  );
};

export default withAuth(AdminDashboard, { requireAdmin: false, message: 'Acesso restrito' });