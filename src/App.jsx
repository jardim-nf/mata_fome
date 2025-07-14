// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Menu from "./pages/Menu"; 
import Painel from "./pages/Painel";
import Login from "./pages/Login"; 
import ClienteLogin from "./pages/ClienteLogin"; 
import ListaEstabelecimentos from "./pages/ListaEstabelecimentos";
import ComandaView from "./pages/ComandaView";
import Planos from "./pages/Planos";
import AdminDashboard from "./pages/AdminDashboard";
// <<-- NOVO IMPORT -->>
import AdminMenuManagement from "./pages/AdminMenuManagement"; // Importe o novo componente
// <<-- NOVO IMPORT PARA TAXAS DE ENTREGA -->>
import TaxasDeEntrega from "./pages/TaxasDeEntrega"; // Importe o novo componente de Taxas de Entrega

import { AuthProvider } from './context/AuthContext'; 

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/comanda/:pedidoId" element={<ComandaView />} /> 
          
          <Route path="*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/cardapios" element={<ListaEstabelecimentos />} /> 
                <Route path="/cardapio/:estabelecimentoId" element={<Menu />} /> 
                <Route path="/dashboard" element={<AdminDashboard />} /> 
                <Route path="/painel" element={<Painel />} />
                <Route path="/login-admin" element={<Login />} /> 
                <Route path="/login-cliente" element={<ClienteLogin />} /> 
                <Route path="/planos" element={<Planos />} /> 
                {/* <<-- NOVA ROTA PARA GERENCIAR CARDÁPIO -->> */}
                <Route path="/admin/gerenciar-cardapio" element={<AdminMenuManagement />} /> 
                {/* <<-- NOVA ROTA AQUI PARA TAXAS DE ENTREGA -->> */}
                <Route path="/admin/taxas-de-entrega" element={<TaxasDeEntrega />} /> 
              </Routes>
            </Layout>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;