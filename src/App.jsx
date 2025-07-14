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
import AdminMenuManagement from "./pages/AdminMenuManagement"; 
// <<-- NOVO IMPORT PARA TAXAS DE ENTREGA -->>
import TaxasDeEntrega from "./pages/TaxasDeEntrega"; 

import { AuthProvider } from './context/AuthContext'; 

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas que não usam o Layout (ex: comanda em tela cheia) */}
          <Route path="/comanda/:pedidoId" element={<ComandaView />} /> 
          
          {/* Todas as rotas que usam o Layout */}
          <Route path="*" element={ // Este path="*" é um catch-all para rotas não definidas acima
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/cardapios" element={<ListaEstabelecimentos />} /> 
                
                {/* <<-- CORREÇÃO AQUI: MUDAR A ROTA DO MENU PARA USAR SLUG -->> */}
                {/* Mude "/cardapio/:estabelecimentoId" para algo como "/loja/:estabelecimentoSlug" */}
                <Route path="/loja/:estabelecimentoSlug" element={<Menu />} /> 
                {/* MANTENHA A ROTA ANTIGA CASO ALGUÉM AINDA TENHA O LINK ANTIGO E VOCÊ QUEIRA TRATAR ISSO
                    Você pode redirecionar essa rota antiga para a nova ou mostrar um aviso.
                    Por enquanto, vou mantê-la para não quebrar links existentes imediatamente.
                    No futuro, considere removê-la ou adicionar um <Navigate to="/loja/:estabelecimentoId" replace />
                */}
                <Route path="/cardapio/:estabelecimentoId" element={<Menu />} /> 
                {/* FIM DA CORREÇÃO */}

                <Route path="/dashboard" element={<AdminDashboard />} /> 
                <Route path="/painel" element={<Painel />} />
                <Route path="/login-admin" element={<Login />} /> 
                <Route path="/login-cliente" element={<ClienteLogin />} /> 
                <Route path="/planos" element={<Planos />} /> 
                
                <Route path="/admin/gerenciar-cardapio" element={<AdminMenuManagement />} /> 
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