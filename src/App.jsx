// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from './context/AuthContext'; // Contexto de Autenticação
import { ToastContainer } from 'react-toastify'; // Notificações Toast
import 'react-toastify/dist/ReactToastify.css'; // CSS das notificações Toast

// Componentes de Layout e Páginas Comuns/Clientes
import Layout from "./components/Layout"; // Layout da aplicação
import Home from "./pages/Home"; // Página inicial
import Login from "./pages/Login"; // Página de Login (para admins)
import Menu from "./pages/Menu"; // Página de cardápio do cliente (por slug)
import ListaEstabelecimentos from "./pages/ListaEstabelecimentos"; // Lista genérica de estabelecimentos
import ComandaView from "./pages/ComandaView"; // Visualização de comanda (tela cheia)
import Planos from "./pages/Planos"; // Página de planos
import HistoricoCliente from './pages/HistoricoCliente'; // Histórico de pedidos de um cliente específico
import ClientOrderHistory from './pages/ClientOrderHistory'; // Histórico GERAL de pedidos do cliente logado

// Componentes para Administradores de Estabelecimento
import Painel from "./pages/Painel"; // Painel de pedidos em tempo real de um estabelecimento
import AdminDashboard from "./pages/AdminDashboard"; // Dashboard padrão de admin de estabelecimento
import AdminMenuManagement from "./pages/AdminMenuManagement"; // Gerenciar cardápio do estabelecimento
import TaxasDeEntrega from "./pages/TaxasDeEntrega"; // Gerenciar taxas de entrega
import AdminEstablishmentManagement from "./pages/AdminEstablishmentManagement"; // Gerenciar configurações do próprio estabelecimento
import NossosClientes from './pages/NossosClientes'; // Listar clientes do estabelecimento
import ClientDetails from "./pages/ClientDetails"; // Detalhes de um cliente específico

// Componentes para Administrador Master (Você)
import MasterDashboard from './pages/MasterDashboard'; // Dashboard Master centralizado
import AdminEstabelecimentoCadastro from './pages/admin/AdminEstabelecimentoCadastro'; // Cadastro de NOVOS estabelecimentos
import AdminCouponManagement from './pages/AdminCouponManagement'; // Gerenciar cupons
import AdminReports from './pages/AdminReports'; // Relatórios gerais
import ListarEstabelecimentosMaster from './pages/admin/ListarEstabelecimentosMaster'; // Lista de estabelecimentos para Master
import ListarPedidosMaster from './pages/admin/ListarPedidosMaster'; // Lista de pedidos para Master
import ListarUsuariosMaster from './pages/admin/ListarUsuariosMaster'; // Lista de usuários para Master
import EditarEstabelecimentoMaster from './pages/admin/EditarEstabelecimentoMaster'; // Editar estabelecimento para Master
import ImportarCardapioMaster from './pages/admin/ImportarCardapioMaster'; // NOVO IMPORT


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas que NÃO usam o Layout (tela cheia, sem cabeçalho/rodapé do layout) */}
          <Route path="/" element={<Home />} />
          <Route path="/login-admin" element={<Login />} />
          <Route path="/comanda/:pedidoId" element={<ComandaView />} />

          {/* GRUPO DE ROTAS QUE USAM O LAYOUT */}
          {/* Todas as rotas dentro deste Route 'element={<Layout />}' terão o cabeçalho e rodapé */}
          <Route element={<Layout />}>
            {/* Rotas Públicas/Clientes */}
            <Route path="/cardapios" element={<ListaEstabelecimentos />} />
            <Route path="/cardapios/:estabelecimentoSlug" element={<Menu />} />
            <Route path="/historico-pedidos" element={<ClientOrderHistory />} />
            <Route path="/planos" element={<Planos />} />

            {/* Rotas de Detalhamento para Master Admin (ou admins que acessam históricos) */}
            <Route path="/historico-cliente/:telefone" element={<HistoricoCliente />} /> {/* Usado pelo PedidoCard */}
            <Route path="/admin/clientes/:clientId" element={<ClientDetails />} /> {/* Detalhes de cliente específico do estabelecimento */}
            
            {/* Rotas para Administradores de Estabelecimento (Gerenciam SEU estabelecimento) */}
            <Route path="/painel" element={<Painel />} /> {/* Dashboard de pedidos em tempo real */}
            <Route path="/dashboard" element={<AdminDashboard />} /> {/* Dashboard padrão de admin de estabelecimento (se ainda em uso) */}
            <Route path="/admin/gerenciar-cardapio" element={<AdminMenuManagement />} />
            <Route path="/admin/taxas-de-entrega" element={<TaxasDeEntrega />} />
            <Route path="/admin/gerenciar-estabelecimentos" element={<AdminEstablishmentManagement />} />
            <Route path="/admin/cupons" element={<AdminCouponManagement />} />
            <Route path="/nossos-clientes" element={<NossosClientes />} />
            
            {/* Rotas EXCLUSIVAS para o Administrador Master (Você) */}
            <Route path="/master-dashboard" element={<MasterDashboard />} /> {/* Dashboard Master centralizado */}
            <Route path="/admin/cadastrar-estabelecimento" element={<AdminEstabelecimentoCadastro />} /> {/* Cadastro de NOVOS estabelecimentos */}
            <Route path="/admin/reports" element={<AdminReports />} /> {/* Relatórios gerais */}
            <Route path="/master/estabelecimentos" element={<ListarEstabelecimentosMaster />} /> {/* Lista de estabelecimentos para Master */}
            <Route path="/master/estabelecimentos/:id/editar" element={<EditarEstabelecimentoMaster />} /> {/* Edição de estabelecimento para Master */}
            <Route path="/master/pedidos" element={<ListarPedidosMaster />} /> {/* Lista de pedidos para Master */}
            <Route path="/master/usuarios" element={<ListarUsuariosMaster />} /> {/* Lista de usuários para Master */}
            <Route path="/master/importar-cardapio" element={<ImportarCardapioMaster />} />
      
            {/* Rota de redirecionamento padrão para a home se a rota não for encontrada */}
            {/* Cuidado ao usar Navigate para / se você tiver rotas específicas que não usam layout */}
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