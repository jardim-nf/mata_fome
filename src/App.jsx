// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout"; // Seu componente de Layout
import Home from "./pages/Home";
import Menu from "./pages/Menu"; // Este componente agora mostra o cardápio por slug
import Painel from "./pages/Painel"; // Página de destino do Login Admin
import Login from "./pages/Login"; // Componente para Login de Administrador
// import ClienteLogin from "./pages/ClienteLogin"; // <<<<< REMOVA OU COMENTE ESTA LINHA SE VOCÊ TEM ESTE ARQUIVO SEPARADO >>>>>
import ListaEstabelecimentos from "./pages/ListaEstabelecimentos"; // Para a rota /cardapios genérica
import ComandaView from "./pages/ComandaView";
import Planos from "./pages/Planos";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMenuManagement from "./pages/AdminMenuManagement";
import TaxasDeEntrega from "./pages/TaxasDeEntrega";
import AdminEstablishmentManagement from "./pages/AdminEstablishmentManagement";
import NossosClientes from './pages/NossosClientes';
import ClientDetails from "./pages/ClientDetails";
import { AuthProvider } from './context/AuthContext';

// Importe os componentes e o CSS da react-toastify
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import AdminCouponManagement from './pages/AdminCouponManagement'; 
import ClientOrderHistory from './pages/ClientOrderHistory';
// <<-- IMPORTE AdminReports AQUI -->>
import AdminReports from './pages/AdminReports';


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas que NÃO usam o Layout (ex: Home, Comanda em tela cheia) */}
          <Route path="/" element={<Home />} />
          <Route path="/login-admin" element={<Login />} />
          <Route path="/comanda/:pedidoId" element={<ComandaView />} />

          {/* GRUPO DE ROTAS QUE USAM O LAYOUT */}
          <Route element={<Layout />}>
            <Route path="/cardapios" element={<ListaEstabelecimentos />} />
            <Route path="/cardapios/:estabelecimentoSlug" element={<Menu />} />
            <Route path="/admin/cupons" element={<AdminCouponManagement />} />
            <Route path="/historico-pedidos" element={<ClientOrderHistory />} />
            {/* <<-- ROTA PARA AdminReports -->> */}
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/painel" element={<Painel />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/gerenciar-cardapio" element={<AdminMenuManagement />} />
            <Route path="/admin/taxas-de-entrega" element={<TaxasDeEntrega />} />
            <Route path="/admin/gerenciar-estabelecimentos" element={<AdminEstablishmentManagement />} />
            <Route path="/nossos-clientes" element={<NossosClientes />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/admin/clientes/:clientId" element={<ClientDetails />} /> 
          </Route>
        </Routes>
      </Router>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </AuthProvider>
  );
}

export default App;