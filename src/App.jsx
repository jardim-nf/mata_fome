// src/App.jsx - VERSÃO COMPLETA COM AI CHAT ASSISTANT DINÂMICO
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, PrivateRoute } from './context/AuthContext';
import { HeaderProvider } from './context/HeaderContext';
import { AIProvider, useAI } from './context/AIContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout e Páginas Públicas/Clientes
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import ListaEstabelecimentos from "./pages/ListaEstabelecimentos";
import Planos from "./pages/Planos";
import ClientOrderHistory from './pages/ClientOrderHistory';
import HomeRedirector from './pages/HomeRedirector';
import ComandaParaImpressao from "./components/ComandaParaImpressao";
import PaginaImpressao from './pages/PaginaImpressao';

// Páginas de Admin
import ControleSalao from "./pages/ControleSalao";
import Painel from "./pages/Painel";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMenuManagement from "./pages/AdminMenuManagement";
import TaxasDeEntrega from "./pages/TaxasDeEntrega";
import AdminEstablishmentManagement from "./pages/AdminEstablishmentManagement";
import NossosClientes from './pages/NossosClientes';
import ClientDetails from "./pages/ClientDetails";
import TelaPedidos from './pages/TelaPedidos';
import AdminCouponManagement from './pages/AdminCouponManagement';
import AdminReports from './pages/AdminReports';
import AdminImageAssociation from './pages/admin/AdminImageAssociation';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminMultiPlatform from './pages/AdminMultiPlatform';
import ClientManagement from './pages/ClientManagement'; 
import AdminOrderCategories from './pages/AdminOrderCategories';
import GestaoFuncionarios from "./pages/admin/GestaoFuncionarios";

// Páginas Master Admin
import MasterDashboard from './pages/MasterDashboard';
import AdminEstabelecimentoCadastro from './pages/admin/AdminEstabelecimentoCadastro';
import ListarEstabelecimentosMaster from './pages/admin/ListarEstabelecimentosMaster';
import ListarPedidosMaster from './pages/admin/ListarPedidosMaster';
import ListarUsuariosMaster from './pages/admin/ListarUsuariosMaster';
import EditarEstabelecimentoMaster from './pages/admin/EditarEstabelecimentoMaster';
import ImportarCardapioMaster from './pages/admin/ImportarCardapioMaster';
import PedidoDetalhesMaster from './pages/admin/PedidoDetalhesMaster';
import CriarUsuarioMaster from './pages/admin/CriarUsuarioMaster';
import EditarUsuarioMaster from "./pages/admin/EditarUsuarioMaster";
import AuditLogs from './pages/admin/AuditLogs';
import AdminPlansManagement from './pages/admin/AdminPlansManagement';

// Componentes AI
import AIChatAssistant from './components/AIChatAssistant';
import AIWidgetButton from './components/AIWidgetButton';

// 🔥 COMPONENTE QUE GERENCIA O WIDGET GLOBAL
const AIWidgetGlobal = () => {
  const { isWidgetOpen } = useAI();
  const location = useLocation();
  
  // Não mostrar widget em certas páginas
  const hideWidgetPaths = ['/cardapio/', '/assistente-virtual'];
  const shouldShowWidget = !hideWidgetPaths.some(path => location.pathname.includes(path));

  if (!shouldShowWidget || !isWidgetOpen) return null;

  // Informações mock do estabelecimento - substitua pelos dados reais
  const estabelecimentoInfo = {
    nome: "Restaurante Delícia",
    horarioFuncionamento: {
      segunda: { abertura: "10:00", fechamento: "22:00" },
      terca: { abertura: "10:00", fechamento: "22:00" },
      quarta: { abertura: "10:00", fechamento: "22:00" },
      quinta: { abertura: "10:00", fechamento: "22:00" },
      sexta: { abertura: "10:00", fechamento: "23:00" },
      sabado: { abertura: "11:00", fechamento: "23:00" },
      domingo: { abertura: "11:00", fechamento: "22:00" }
    },
    telefone: "(11) 9999-9999",
    whatsapp: "(11) 98888-8888",
    endereco: {
      rua: "Rua Principal",
      numero: "123",
      bairro: "Centro"
    },
    chavePix: "CNPJ: 12.345.678/0001-90"
  };

  return (
    <AIChatAssistant 
      estabelecimentoInfo={estabelecimentoInfo}
      mode="widget"
    />
  );
};

// 🔥 COMPONENTE QUE GERENCIA O BOTÃO DO WIDGET
const AIWidgetButtonGlobal = () => {
  const location = useLocation();
  
  // Não mostrar botão em certas páginas
  const hideButtonPaths = ['/cardapio/', '/assistente-virtual'];
  const shouldShowButton = !hideButtonPaths.some(path => location.pathname.includes(path));

  if (!shouldShowButton) return null;

  return <AIWidgetButton />;
};

function App() {
  return (
    <AuthProvider>
      <HeaderProvider>
        <AIProvider>
          <Router>
            {/* 🔥 BOTÃO DO WIDGET GLOBAL - Aparece na maioria das páginas */}
            <AIWidgetButtonGlobal />
            
            {/* 🔥 WIDGET GLOBAL - Aparece quando aberto */}
            <AIWidgetGlobal />

            <Routes>
              {/* Rotas que NÃO usam o Layout principal */}
              <Route path="/" element={<Home />} />
              <Route path="/login-admin" element={<Login />} />
              <Route path="/comanda/:pedidoId" element={<ComandaParaImpressao />} />
              <Route path="/imprimir/pedido/:pedidoId" element={<PaginaImpressao />} />
              <Route path="/cardapio" element={<ListaEstabelecimentos />} />
              
              {/* 🎯 PÁGINA DO CARDÁPIO SEM LAYOUT/HEADER */}
              <Route path="/cardapio/:estabelecimentoSlug" element={<Menu />} />

              {/* 🔥 PÁGINA STANDALONE DO ASSISTENTE VIRTUAL */}
              <Route 
                path="/assistente-virtual" 
                element={
                  <PrivateRoute>
                    <div className="min-h-screen bg-gray-100">
                      <AIChatAssistant 
                        estabelecimentoInfo={{
                          nome: "Restaurante Delícia",
                          horarioFuncionamento: {
                            segunda: { abertura: "10:00", fechamento: "22:00" },
                            terca: { abertura: "10:00", fechamento: "22:00" },
                            quarta: { abertura: "10:00", fechamento: "22:00" },
                            quinta: { abertura: "10:00", fechamento: "22:00" },
                            sexta: { abertura: "10:00", fechamento: "23:00" },
                            sabado: { abertura: "11:00", fechamento: "23:00" },
                            domingo: { abertura: "11:00", fechamento: "22:00" }
                          },
                          telefone: "(11) 9999-9999",
                          whatsapp: "(11) 98888-8888",
                          endereco: {
                            rua: "Rua Principal",
                            numero: "123",
                            bairro: "Centro"
                          },
                          chavePix: "CNPJ: 12.345.678/0001-90"
                        }}
                        mode="page"
                        onClose={() => window.history.back()}
                      />
                    </div>
                  </PrivateRoute>
                } 
              />

              {/* ✅ GRUPO DE ROTAS QUE USAM O LAYOUT PRINCIPAL (COM HEADER) */}
              <Route element={<Layout />}>
                {/* --- Rotas Públicas/Clientes --- */}
                <Route path="/planos" element={<Planos />} />
                <Route path="/painel-inicial" element={<HomeRedirector />} />

                {/* --- Rotas de Administrador de Estabelecimento --- */}
                <Route
                  path="/admin/clientes-estabelecimento"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <ClientManagement />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/controle-salao"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <ControleSalao />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/estabelecimento/:estabelecimentoId/mesa/:id"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <TelaPedidos />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/painel"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <Painel />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <AdminDashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/gerenciar-cardapio"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <AdminMenuManagement />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/ordenar-categorias"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <AdminOrderCategories />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/taxas-de-entrega"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <TaxasDeEntrega />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/gerenciar-estabelecimentos"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <AdminEstablishmentManagement />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/cupons"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <AdminCouponManagement />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/nossos-clientes"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <NossosClientes />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/clientes/:clientId"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <ClientDetails />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <AdminReports />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/multi-platform"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <AdminMultiPlatform />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/associar-imagens"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <AdminImageAssociation />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <AdminAnalytics />
                    </PrivateRoute>
                  }
                />

                {/* ✅ GESTÃO DE FUNCIONÁRIOS AGORA DENTRO DO LAYOUT */}
                <Route
                  path="/admin/gestao-funcionarios"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                      <GestaoFuncionarios />
                    </PrivateRoute>
                  }
                />

                {/* --- Rotas EXCLUSIVAS para o Master Admin --- */}
                <Route
                  path="/master-dashboard"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <MasterDashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/cadastrar-estabelecimento"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <AdminEstabelecimentoCadastro />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin/audit-logs"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <AuditLogs />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/estabelecimentos"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <ListarEstabelecimentosMaster />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/pedidos"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <ListarPedidosMaster />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/usuarios"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <ListarUsuariosMaster />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/estabelecimentos/:id/editar"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <EditarEstabelecimentoMaster />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/importar-cardapio"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <ImportarCardapioMaster />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/usuarios/:id/editar"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <EditarUsuarioMaster />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/plans"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <AdminPlansManagement />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/pedidos/:id"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <PedidoDetalhesMaster />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/usuarios/criar"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <CriarUsuarioMaster />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/master/associar-imagens"
                  element={
                    <PrivateRoute allowedRoles={['masterAdmin']}>
                      <AdminImageAssociation />
                    </PrivateRoute>
                  }
                />

                {/* Rota "catch-all" para redirecionar páginas não encontradas */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>

              <Route path="/historico-pedidos" element={<PrivateRoute><ClientOrderHistory /></PrivateRoute>} />
            </Routes>

            {/* Toast Container para notificações */}
            <ToastContainer
              position="bottom-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
          </Router>
        </AIProvider>
      </HeaderProvider>
    </AuthProvider>
  );
}

export default App;