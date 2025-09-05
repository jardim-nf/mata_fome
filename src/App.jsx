// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import ListaEstabelecimentos from "./pages/ListaEstabelecimentos";
// ▼▼▼ CORREÇÃO: Importando o ComandaView para ser usado na rota ▼▼▼
import ComandaParaImpressao from "./components/ComandaParaImpressao"; 
import Planos from "./pages/Planos";
import HistoricoCliente from './pages/HistoricoCliente';
import ClientOrderHistory from './pages/ClientOrderHistory';

import Painel from "./pages/Painel";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMenuManagement from "./pages/AdminMenuManagement";
import TaxasDeEntrega from "./pages/TaxasDeEntrega";
import AdminEstablishmentManagement from "./pages/AdminEstablishmentManagement";
import NossosClientes from './pages/NossosClientes';
import ClientDetails from "./pages/ClientDetails";

// Importações dos componentes Master Admin
import MasterDashboard from './pages/MasterDashboard'; 
import AdminEstabelecimentoCadastro from './pages/admin/AdminEstabelecimentoCadastro';
import AdminCouponManagement from './pages/AdminCouponManagement';
import AdminReports from './pages/AdminReports';
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

import HomeRedirector from './pages/HomeRedirector';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas que NÃO usam o Layout */}
          <Route path="/" element={<Home />} />
          <Route path="/login-admin" element={<Login />} />
          {/* ▼▼▼ CORREÇÃO: Usando ComandaView para a rota da comanda ▼▼▼ */}
          <Route path="/comanda/:pedidoId" element={<ComandaParaImpressao/>} />

          {/* GRUPO DE ROTAS QUE USAM O LAYOUT */}
          <Route element={<Layout />}>
            {/* Rotas Públicas/Clientes */}
            <Route path="/cardapio" element={<ListaEstabelecimentos />} />
            <Route path="/cardapio/:estabelecimentoSlug" element={<Menu />} />
            <Route path="/historico-pedidos" element={<ClientOrderHistory />} />
            <Route path="/planos" element={<Planos />} />
            {/* Rotas de Detalhamento para Master Admin (ou admins que acessam históricos) */}
            <Route path="/historico-cliente/:telefone" element={<HistoricoCliente />} />
            <Route path="/admin/clientes/:clientId" element={<ClientDetails />} />
            
            <Route path="/painel-inicial" element={<HomeRedirector />} />

            {/* Rotas para Administradores de Estabelecimento */}
            <Route path="/painel" element={<Painel />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/gerenciar-cardapio" element={<AdminMenuManagement />} />
            <Route path="/admin/taxas-de-entrega" element={<TaxasDeEntrega />} />
            <Route path="/admin/gerenciar-estabelecimentos" element={<AdminEstablishmentManagement />} />
            <Route path="/admin/cupons" element={<AdminCouponManagement />} />
            <Route path="/nossos-clientes" element={<NossosClientes />} />
            
            {/* Rotas EXCLUSIVAS para o Administrador Master (Você) */}
            <Route path="/master-dashboard" element={<MasterDashboard />} />
            <Route path="/admin/cadastrar-estabelecimento" element={<AdminEstabelecimentoCadastro />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/audit-logs" element={<AuditLogs />} />
            <Route path="/master/estabelecimentos" element={<ListarEstabelecimentosMaster />} />
            <Route path="/master/pedidos" element={<ListarPedidosMaster />} />
            <Route path="/master/usuarios" element={<ListarUsuariosMaster />} />
            <Route path="/master/estabelecimentos/:id/editar" element={<EditarEstabelecimentoMaster />} />
            <Route path="/master/importar-cardapio" element={<ImportarCardapioMaster />} />
            <Route path="/master/usuarios/:id/editar" element={<EditarUsuarioMaster/>} />
            <Route path="/master/plans" element={<AdminPlansManagement />} />
          
            {/* ROTA para Detalhes do Pedido Master */}
            <Route path="/master/pedidos/:id" element={<PedidoDetalhesMaster />} /> 
            <Route path="/master/usuarios/criar" element={<CriarUsuarioMaster />} />
            
            <Route path="*" element={<Navigate to="/" replace />} /> 
          </Route>
        </Routes>
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