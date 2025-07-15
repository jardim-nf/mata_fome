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
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas que NÃO usam o Layout (ex: Home, Comanda em tela cheia) */}
          <Route path="/" element={<Home />} /> {/* Home é a landing page, com modais de login/cadastro */}
          <Route path="/login-admin" element={<Login />} /> {/* Página dedicada para login de Admin */}
          {/* A rota /logincliente não precisa mais de um componente próprio se o login/cadastro for via modal na Home. */}
          {/* <Route path="/logincliente" element={<ClienteLogin />} /> <<<<< COMENTE OU REMOVA ESTA ROTA >>>>> */}
          <Route path="/comanda/:pedidoId" element={<ComandaView />} />

          {/* GRUPO DE ROTAS QUE USAM O LAYOUT */}
          <Route element={<Layout />}>
            {/* Rota para listar todos os estabelecimentos (se houver uma lista além dos destaques da Home) */}
            <Route path="/cardapios" element={<ListaEstabelecimentos />} />

            {/* ROTA PRINCIPAL DO MENU/CARDÁPIO ESPECÍFICO: AGORA ESPERA UM SLUG */}
            <Route path="/cardapios/:estabelecimentoSlug" element={<Menu />} />

            {/* Rotas do Painel Administrativo (geralmente exigem autenticação de admin) */}
            <Route path="/painel" element={<Painel />} /> {/* Para onde o admin loga */}
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/gerenciar-cardapio" element={<AdminMenuManagement />} />
            <Route path="/admin/taxas-de-entrega" element={<TaxasDeEntrega />} />
            <Route path="/admin/gerenciar-estabelecimentos" element={<AdminEstablishmentManagement />} />
            <Route path="/nossos-clientes" element={<NossosClientes />} /> {/* Sua rota para listar clientes */}
            <Route path="/planos" element={<Planos />} />
          </Route>

          {/* Rota 404 (opcional - você pode criar um componente NotFoundPage) */}
          {/* <Route path="*" element={<NotFoundPage />} /> */}
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;