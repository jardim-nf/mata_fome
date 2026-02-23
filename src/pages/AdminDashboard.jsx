// src/pages/AdminDashboard.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import DashBoardSummary from "../components/DashBoardSummary";
import { useAuth } from "../context/AuthContext";
import withAuth from "../hocs/withAuth";
// Adicionei IoTrashBin na importação abaixo
import { IoStatsChart, IoShareSocial, IoColorPalette, IoSettings, IoTrashBin } from "react-icons/io5"; 
import { FaUsers, FaMotorcycle, FaArrowLeft, FaList } from 'react-icons/fa'; 

// Componente visual do botão
const ActionButton = ({ title, subtitle, icon, colorClass, onClick }) => (
  <div
    onClick={onClick}
    className={`group relative p-6 h-full rounded-2xl border border-gray-200 bg-white flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg cursor-pointer ${colorClass}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>

    <div className="relative z-10 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        {/* Ajuste para aceitar ícones diretos ou strings */}
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
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    sessionStorage.clear();
    navigate("/home");
  };

  const temPermissao = (permissaoNecessaria) => {
      if (!currentUser) return false;
      const ehAdmin = currentUser.isAdmin === true || currentUser.isMasterAdmin === true;
      if (ehAdmin) return true;
      return currentUser.permissoes && currentUser.permissoes.includes(permissaoNecessaria);
  };

  const isRealAdmin = currentUser?.isAdmin === true || currentUser?.isMasterAdmin === true;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header com Botão VOLTAR e SAIR */}
        <div className="relative flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="text-center md:text-left space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Dashboard <span className="text-blue-600">{isRealAdmin ? 'Admin' : 'Equipe'}</span>
            </h1>
            <p className="text-gray-500">
              Bem-vindo(a), {currentUser?.nome || 'Colaborador'}
            </p>
          </div>

          <div className="flex w-full gap-3 mt-4 md:mt-0">
            <button
              onClick={() => navigate('/home')}
              className="flex items-center justify-center gap-2 px-6 py-2.5 text-gray-700 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 font-bold transition-all"
            >
              <FaArrowLeft /> Voltar
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 px-6 py-2.5 text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 font-bold transition-all"
            >
              <span>🚪</span> Sair
            </button>
          </div>
        </div>

        {/* Resumo Estatístico - Só Admin vê */}
        {isRealAdmin && <DashBoardSummary />}

        {/* Grid de Botões */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          
          {/* BOTÃO 1: Painel de Pedidos (KDS) */}
          {temPermissao('painel') && (
            <Link to="/painel" className="h-full">
              <ActionButton
                title="Painel de Pedidos"
                subtitle="Acompanhe pedidos de Delivery e Salão em tempo real"
                icon="🏪"
                colorClass="hover:border-blue-500 hover:bg-blue-50"
              />
            </Link>
          )}

          {/* BOTÃO 2: Controle de Salão */}
          {temPermissao('controle-salao') && (
            <Link to="/controle-salao" className="h-full">
              <ActionButton
                title="Controle de Salão"
                subtitle="Mapa de mesas, comandas e pedidos presenciais"
                icon="🍽️"
                colorClass="hover:border-green-500 hover:bg-green-50"
              />
            </Link>
          )}

          {/* BOTÃO 3: PDV (Admin) */}
          {isRealAdmin && (
            <Link to="/pdv" className="h-full">
              <ActionButton
                title="Frente de Loja (PDV)"
                subtitle="Caixa rápido, vendas de balcão e emissão de NFC-e"
                icon="🖥️"
                colorClass="hover:border-purple-500 hover:bg-purple-50"
              />
            </Link>
          )}
<Link to="/admin/cupons" className="h-full">
  <ActionButton
    title="Cupons de Desconto"
    subtitle="Crie e gerencie códigos promocionais para seus clientes"
    icon="🎫"
    colorClass="hover:border-yellow-500 hover:bg-yellow-50"
  />
</Link>
          {/* BOTÃO 4: Cardápio Digital */}
          {temPermissao('visualizar-cardapio') && (
            <Link to="/admin/gerenciar-cardapio" className="h-full">
              <ActionButton
                title="Cardápio Digital"
                subtitle="Cadastre produtos, fotos, preços e categorias"
                icon="🍔"
                colorClass="hover:border-orange-500 hover:bg-orange-50"
              />
            </Link>
          )}

          {/* BOTÃO 5: Ordenar Categorias */}
          {(temPermissao('visualizar-cardapio') || isRealAdmin) && (
            <Link to="/admin/ordenar-categorias" className="h-full">
              <ActionButton
                title="Ordenar Categorias"
                subtitle="Organize a ordem de exibição das categorias"
                icon={<FaList className="text-teal-600" />}
                colorClass="hover:border-teal-500 hover:bg-teal-50"
              />
            </Link>
          )}

          {/* --- BLOCO EXCLUSIVO DE ADMIN --- */}
          {isRealAdmin && (
            <>
              {/* CONFIGURAÇÕES GERAIS (SENHA MASTER) */}
              <Link to="/admin/configuracoes" className="h-full">
                <ActionButton
                  title="Configurações Gerais"
                  subtitle="Senha Master e definições de segurança"
                  icon={<IoSettings className="text-gray-700" />}
                  colorClass="hover:border-gray-500 hover:bg-gray-50"
                />
              </Link>

              {/* RELATÓRIO DE CANCELAMENTOS (NOVO) */}
              <Link to="/admin/relatorio-cancelamentos" className="h-full">
                <ActionButton
                    title="Cancelamentos"
                    subtitle="Relatório de itens excluídos via senha master"
                    icon={<IoTrashBin className="text-red-600" />}
                    colorClass="hover:border-red-500 hover:bg-red-50"
                />
              </Link>

              <Link to="/admin/cores" className="h-full">
                <ActionButton
                  title="Identidade Visual"
                  subtitle="Personalize as cores e o tema do seu app"
                  icon={<IoColorPalette className="text-pink-500" />}
                  colorClass="hover:border-pink-500 hover:bg-pink-50"
                />
              </Link>
              
              <Link to="/admin/taxas-de-entrega" className="h-full">
                <ActionButton
                  title="Taxas de Entrega"
                  subtitle="Configure valores de frete por bairro e ações em lote"
                  icon="🛵"
                  colorClass="hover:border-amber-500 hover:bg-amber-50"
                />
              </Link>

              <Link to="/admin/analytics" className="h-full">
                <ActionButton
                  title="Produtividade"
                  subtitle="Gráficos de vendas, faturamento e desempenho"
                  icon={<IoStatsChart className="text-indigo-600" />}
                  colorClass="hover:border-indigo-500 hover:bg-indigo-50"
                />
              </Link>

              <Link to="/admin/multi-platform" className="h-full">
                <ActionButton
                  title="Integrações"
                  subtitle="Conecte com iFood, WhatsApp e impressoras"
                  icon={<IoShareSocial className="text-blue-500" />}
                  colorClass="hover:border-blue-500 hover:bg-blue-50"
                />
              </Link>

              <Link to="/admin/gestao-funcionarios" className="h-full">
                <ActionButton
                  title="Equipe e Acessos"
                  subtitle="Gerencie garçons, caixas e administradores"
                  icon={<FaUsers className="text-blue-600" />}
                  colorClass="hover:border-blue-600 hover:bg-blue-50"
                />
              </Link>

              <Link to="/admin/entregadores" className="h-full">
                <ActionButton
                  title="Entregadores"
                  subtitle="Gerencie motoboys, rotas e comissões"
                  icon={<FaMotorcycle className="text-orange-600" />}
                  colorClass="hover:border-orange-600 hover:bg-orange-50"
                />
              </Link>
              
              <Link to="/admin/reports" className="h-full">
                <ActionButton
                  title="Relatórios Fiscais"
                  subtitle="Extratos detalhados para contabilidade"
                  icon="📊"
                  colorClass="hover:border-gray-500 hover:bg-gray-50"
                />
              </Link>
            </>
          )}
        </div>

        <div className="text-center pt-8 border-t border-gray-200">
          <p className="text-gray-400 text-sm">
            NaMão System • Versão 1.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default withAuth(AdminDashboard, {
  requireAdmin: false, 
  message: 'Acesso restrito'
});