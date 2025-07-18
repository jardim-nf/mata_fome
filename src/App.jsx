// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout"; // Seu componente de Layout
import Home from "./pages/Home";
import Menu from "./pages/Menu"; // Este componente agora mostra o cardápio por slug
import Painel from "./pages/Painel"; // Página de destino do Login Admin
import Login from "./pages/Login"; // Componente para Login de Administrador
// import ClienteLogin from "./pages/ClienteLogin"; // <<< Você já comentou ou removeu este, então mantive assim.

// Importações dos seus componentes de página, ajustando os caminhos se necessário
import ListaEstabelecimentos from "./pages/ListaEstabelecimentos"; // Para a rota /cardapios genérica
import ComandaView from "./pages/ComandaView";
import Planos from "./pages/Planos";
import AdminDashboard from "./pages/AdminDashboard"; // Seu dashboard padrão de admin de estabelecimento
import AdminMenuManagement from "./pages/AdminMenuManagement";
import TaxasDeEntrega from "./pages/TaxasDeEntrega";
import AdminEstablishmentManagement from "./pages/AdminEstablishmentManagement"; // Se este for o gerenciar estabelecimentos do admin comum
import NossosClientes from './pages/NossosClientes';
import ClientDetails from "./pages/ClientDetails";

// Componentes de Autenticação e Contexto
import { AuthProvider } from './context/AuthContext';

// Componentes do Administrador Master (Você)
import MasterDashboard from './pages/MasterDashboard'; // NOVO: Dashboard Master para você
import AdminEstabelecimentoCadastro from './pages/admin/AdminEstabelecimentoCadastro'; // Para cadastrar NOVOS estabelecimentos por você

// Componentes de Relatórios e Cupons
import AdminCouponManagement from './pages/AdminCouponManagement'; 
import AdminReports from './pages/AdminReports'; // Seu componente de relatórios

// Componentes de Histórico de Pedidos
import HistoricoCliente from './pages/HistoricoCliente'; // Histórico de pedidos de UM cliente (por telefone/ID)
import ClientOrderHistory from './pages/ClientOrderHistory'; // Histórico GERAL de pedidos do cliente logado (ou todos os pedidos do admin)

// Importe os componentes e o CSS da react-toastify
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas que NÃO usam o Layout (ex: Home, Login, Comanda em tela cheia) */}
          <Route path="/" element={<Home />} />
          <Route path="/login-admin" element={<Login />} />
          <Route path="/comanda/:pedidoId" element={<ComandaView />} />
          
          {/* GRUPO DE ROTAS QUE USAM O LAYOUT */}
          <Route element={<Layout />}>
            {/* Rotas Públicas/Clientes */}
            <Route path="/cardapios" element={<ListaEstabelecimentos />} />
            <Route path="/cardapios/:estabelecimentoSlug" element={<Menu />} /> {/* Cardápio por slug */}
            <Route path="/historico-pedidos" element={<ClientOrderHistory />} /> {/* Histórico de pedidos do cliente logado */}
            <Route path="/historico-cliente/:telefone" element={<HistoricoCliente />} /> {/* Histórico de um cliente específico (geralmente para admins) */}
            <Route path="/planos" element={<Planos />} />
            
            {/* Rotas para Administradores de Estabelecimento (Gerenciam SEU estabelecimento) */}
            <Route path="/painel" element={<Painel />} /> {/* Dashboard de pedidos em tempo real */}
            <Route path="/dashboard" element={<AdminDashboard />} /> {/* Antigo AdminDashboard, se ainda for usado */}
            <Route path="/admin/gerenciar-cardapio" element={<AdminMenuManagement />} /> {/* Gerenciar cardápio do estabelecimento */}
            <Route path="/admin/taxas-de-entrega" element={<TaxasDeEntrega />} />
            <Route path="/admin/gerenciar-estabelecimentos" element={<AdminEstablishmentManagement />} /> {/* Se este for para o admin de estab. gerenciar configs do próprio estab. */}
            <Route path="/admin/cupons" element={<AdminCouponManagement />} /> {/* Gerenciar cupons (pode ser tanto para admin master quanto de estab) */}
            <Route path="/nossos-clientes" element={<NossosClientes />} /> {/* Clientes do estabelecimento */}
            <Route path="/admin/clientes/:clientId" element={<ClientDetails />} /> {/* Detalhes de cliente específico */}
            
            {/* Rotas EXCLUSIVAS para o Administrador Master (Você) */}
            <Route path="/master-dashboard" element={<MasterDashboard />} /> {/* NOVO: Dashboard Master centralizado */}
            <Route path="/admin/cadastrar-estabelecimento" element={<AdminEstabelecimentoCadastro />} /> {/* Cadastro de NOVOS estabelecimentos (só Master) */}
            <Route path="/admin/reports" element={<AdminReports />} /> {/* Relatórios gerais (só Master) */}
            
            {/* Rota de redirecionamento padrão para /home ou /login se a rota não for encontrada */}
            <Route path="*" element={<Navigate to="/" replace />} /> {/* Cuidado com rotas como /login-admin fora do Layout */}

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