// src/App.jsx - COMPLETO COM TODOS OS IMPORTS

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, PrivateRoute } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ===================================
// 🔑 IMPORTS CORRIGIDOS E COMPLETOS 🔑
// ===================================

// Layout e Páginas Públicas/Clientes
import Layout from "./components/Layout";
import Home from "./pages/Home"; // 👈 Faltava o import de Home
import Login from "./pages/Login"; // Faltava o import de Login
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

// ===================================

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas que NÃO usam o Layout principal (ex: tela de login) */}
          <Route path="/" element={<Home />} />
          <Route path="/login-admin" element={<Login />} />
          <Route path="/comanda/:pedidoId" element={<ComandaParaImpressao />} />
          <Route path="/imprimir/pedido/:pedidoId" element={<PaginaImpressao />} />

          {/* Grupo de rotas que USAM o Layout principal */}
          <Route element={<Layout />}>

            {/* --- Rotas Públicas/Clientes --- */}
            <Route path="/cardapio" element={<ListaEstabelecimentos />} />
            <Route path="/cardapio/:estabelecimentoSlug" element={<Menu />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/historico-pedidos" element={<PrivateRoute><ClientOrderHistory /></PrivateRoute>} />
            <Route path="/painel-inicial" element={<HomeRedirector />} />

            {/* --- Rotas de Administrador de Estabelecimento --- */}
            <Route
              path="/controle-salao"
              element={
                <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                  <ControleSalao />
                </PrivateRoute>
              }
            />
            {/* Rota corrigida que mapeia a navegação do ControleSalao */}
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
    </AuthProvider>

  );
}

export default App;