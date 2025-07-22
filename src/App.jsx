// src/App.jsx (Este é o seu código atual, APENAS CONFIRME as importações)
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
import ComandaView from "./pages/ComandaView";
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

// Importações dos componentes Master Admin (CONFIRA O CAMINHO DE CADA UM)
import MasterDashboard from './pages/MasterDashboard'; // <--- Se o MasterDashboard.jsx está em src/pages/MasterDashboard.jsx
// Se MasterDashboard.jsx estivesse em src/pages/admin/MasterDashboard.jsx, seria:
// import MasterDashboard from './pages/admin/MasterDashboard';

import AdminEstabelecimentoCadastro from './pages/admin/AdminEstabelecimentoCadastro';
import AdminCouponManagement from './pages/AdminCouponManagement'; // Verifique se este e os próximos estão em pages/admin ou pages
import AdminReports from './pages/AdminReports'; // Verifique
import ListarEstabelecimentosMaster from './pages/admin/ListarEstabelecimentosMaster';
import ListarPedidosMaster from './pages/admin/ListarPedidosMaster';
import ListarUsuariosMaster from './pages/admin/ListarUsuariosMaster';
import EditarEstabelecimentoMaster from './pages/admin/EditarEstabelecimentoMaster';
import ImportarCardapioMaster from './pages/admin/ImportarCardapioMaster';
import PedidoDetalhesMaster from './pages/admin/PedidoDetalhesMaster'; // Novo componente para detalhes de pedido master (você precisa criar)
import CriarUsuarioMaster from './pages/admin/CriarUsuarioMaster';
import EditarUsuarioMaster from "./pages/admin/EditarUsuarioMaster";
import AuditLogs from './pages/admin/AuditLogs';
import AdminPlansManagement from './pages/admin/AdminPlansManagement';



function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas que NÃO usam o Layout */}
          <Route path="/" element={<Home />} />
          <Route path="/login-admin" element={<Login />} />
          <Route path="/comanda/:pedidoId" element={<ComandaView />} />

          {/* GRUPO DE ROTAS QUE USAM O LAYOUT */}
          <Route element={<Layout />}>
            {/* Rotas Públicas/Clientes */}
            <Route path="/cardapios" element={<ListaEstabelecimentos />} />
            <Route path="/cardapios/:estabelecimentoSlug" element={<Menu />} />
            <Route path="/historico-pedidos" element={<ClientOrderHistory />} />
            <Route path="/planos" element={<Planos />} />

            {/* Rotas de Detalhamento para Master Admin (ou admins que acessam históricos) */}
            <Route path="/historico-cliente/:telefone" element={<HistoricoCliente />} />
            <Route path="/admin/clientes/:clientId" element={<ClientDetails />} />
            
            {/* Rotas para Administradores de Estabelecimento (Gerenciam SEU estabelecimento) */}
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

          
            {/* NOVA ROTA para Detalhes do Pedido Master */}
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