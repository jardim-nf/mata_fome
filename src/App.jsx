import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, PrivateRoute } from './context/AuthContext';
import { HeaderProvider } from './context/HeaderContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from "./components/Layout";

// Lazy imports dos context providers pesados (só carregam em rotas autenticadas)
const AIProvider = lazy(() => import('./context/AIContext').then(m => ({ default: m.AIProvider })));
const PaymentProvider = lazy(() => import('./context/PaymentContext').then(m => ({ default: m.PaymentProvider })));
const NotificationProvider = lazy(() => import('./context/NotificationContext').then(m => ({ default: m.NotificationProvider })));

// Todas as páginas agora usam lazy loading
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const ComandaParaImpressao = lazy(() => import("./components/ComandaParaImpressao"));

// Lazy: só carrega quando o usuário navegar até a rota
const Menu = lazy(() => import("./pages/Menu"));
const ListaEstabelecimentos = lazy(() => import("./pages/ListaEstabelecimentos"));
const Planos = lazy(() => import("./pages/Planos"));
const ClientOrderHistory = lazy(() => import('./pages/ClientOrderHistory'));
const HomeRedirector = lazy(() => import('./pages/HomeRedirector'));
const PaginaImpressao = lazy(() => import('./pages/PaginaImpressao'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const RelatorioCancelamentos = lazy(() => import('./pages/admin/RelatorioCancelamentos'));
const PdvScreen = lazy(() => import('./pages/admin/PdvScreen'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ControleSalao = lazy(() => import("./pages/ControleSalao"));
const Painel = lazy(() => import("./pages/Painel"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminMenuManagement = lazy(() => import("./pages/AdminMenuManagement"));
const TaxasDeEntrega = lazy(() => import("./pages/TaxasDeEntrega"));
const AdminEstablishmentManagement = lazy(() => import("./pages/AdminEstablishmentManagement"));
const NossosClientes = lazy(() => import('./pages/NossosClientes'));
const ClientDetails = lazy(() => import("./pages/ClientDetails"));
const TelaPedidos = lazy(() => import('./pages/TelaPedidos'));
const AdminCouponManagement = lazy(() => import('./pages/AdminCouponManagement'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminImageAssociation = lazy(() => import('./pages/admin/AdminImageAssociation'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const AdminMultiPlatform = lazy(() => import('./pages/AdminMultiPlatform'));
const ClientManagement = lazy(() => import('./pages/ClientManagement'));
const AdminOrderCategories = lazy(() => import('./pages/AdminOrderCategories'));
const GestaoFuncionarios = lazy(() => import("./pages/admin/GestaoFuncionarios"));
const AdminEntregadores = lazy(() => import('./pages/admin/AdminEntregadores'));
const RelatorioEntregas = lazy(() => import('./pages/admin/RelatorioEntregas'));
const AdminPaymentSettings = lazy(() => import('./pages/admin/AdminPaymentSettings'));
const AdminColorSettings = lazy(() => import('./pages/AdminColorSettings'));
const MasterDashboard = lazy(() => import('./pages/MasterDashboard'));
const AdminEstabelecimentoCadastro = lazy(() => import('./pages/admin/AdminEstabelecimentoCadastro'));
const ListarEstabelecimentosMaster = lazy(() => import('./pages/admin/ListarEstabelecimentosMaster'));
const ListarPedidosMaster = lazy(() => import('./pages/admin/ListarPedidosMaster'));
const ListarUsuariosMaster = lazy(() => import('./pages/admin/ListarUsuariosMaster'));
const EditarEstabelecimentoMaster = lazy(() => import('./pages/admin/EditarEstabelecimentoMaster'));
const ImportarCardapioMaster = lazy(() => import('./pages/admin/ImportarCardapioMaster'));
const PedidoDetalhesMaster = lazy(() => import('./pages/admin/PedidoDetalhesMaster'));
const CriarUsuarioMaster = lazy(() => import('./pages/admin/CriarUsuarioMaster'));
const EditarUsuarioMaster = lazy(() => import("./pages/admin/EditarUsuarioMaster"));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const AdminPlansManagement = lazy(() => import('./pages/admin/AdminPlansManagement'));
const FinanceiroMaster = lazy(() => import('./pages/admin/FinanceiroMaster'));
const ConfigFiscalScreen = lazy(() => import('./pages/admin/ConfigFiscalScreen'));
const ImpressaoIsolada = lazy(() => import("./pages/ImpressaoIsolada"));
const EntradaEstoqueXML = lazy(() => import("./pages/admin/EntradaEstoqueXML"));
const RankingFuncionarios = lazy(() => import("./pages/admin/RankingFuncionarios"));
const WhatsAppConfig = lazy(() => import("./pages/admin/WhatsAppConfig"));
const PrevisaoDemanda = lazy(() => import("./pages/admin/PrevisaoDemanda"));
const MarketingConfig = lazy(() => import("./pages/admin/MarketingConfig"));
const ResponderAvaliacoes = lazy(() => import("./pages/admin/ResponderAvaliacoes"));
const RelatorioLucro = lazy(() => import("./pages/admin/RelatorioLucro"));
const Divulgacao = lazy(() => import('./pages/Divulgacao'));

// Wrapper que carrega providers pesados apenas para rotas autenticadas
function AuthenticatedProviders({ children }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" /></div>}>
      <AIProvider>
        <PaymentProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </PaymentProvider>
      </AIProvider>
    </Suspense>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <HeaderProvider>
          <div className="min-h-screen bg-gray-50">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" /></div>}>
              <Routes>
                {/* Rotas públicas — SEM providers pesados */}
                <Route path="/" element={<Home />} />
                <Route path="/home" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/login-admin" element={<Login />} />
                <Route path="/imprimir-comanda/:pedidoId" element={<ComandaParaImpressao />} />
                <Route path="/comanda/:pedidoId" element={<ComandaParaImpressao />} />
                <Route path="/imprimir/pedido/:pedidoId" element={<PaginaImpressao />} />
                <Route path="/impressao-isolada" element={<ImpressaoIsolada />} />
                <Route path="/cardapio" element={<ListaEstabelecimentos />} />
                <Route path="/cardapio/:estabelecimentoSlug" element={<Menu />} />
                <Route path="/divulgacao" element={<Divulgacao />} />
                <Route path="/checkout" element={<PrivateRoute><CheckoutPage /></PrivateRoute>} />

                {/* Rotas autenticadas — COM providers pesados (AI, Payment, Notification) */}
                <Route element={<AuthenticatedProviders><Layout /></AuthenticatedProviders>}>
                  <Route path="/planos" element={<Planos />} />
                  <Route path="/painel-inicial" element={<HomeRedirector />} />
                  <Route path="/pdv" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><PdvScreen /></PrivateRoute>} />
                  <Route path="/admin/clientes-estabelecimento" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><ClientManagement /></PrivateRoute>} />
                  <Route path="/controle-salao" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin', 'garcom', 'garçom']}><ControleSalao /></PrivateRoute>} />
                  <Route path="/estabelecimento/:estabelecimentoId/mesa/:id" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin', 'garcom', 'garçom']}><TelaPedidos /></PrivateRoute>} />
                  <Route path="/painel" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin', 'garcom', 'garçom', 'cozinha']}><Painel /></PrivateRoute>} />
                  <Route path="/admin-dashboard" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminDashboard /></PrivateRoute>} />
                  <Route path="/admin/configuracoes" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminSettings /></PrivateRoute>} />
                  <Route path="/dashboard" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin', 'garcom', 'garçom', 'cozinha']}><AdminDashboard /></PrivateRoute>} />
                  <Route path="/admin/gerenciar-cardapio" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminMenuManagement /></PrivateRoute>} />
                  <Route path="/admin/cores" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminColorSettings /></PrivateRoute>} />
                  <Route path="/admin/ordenar-categorias" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminOrderCategories /></PrivateRoute>} />
                  <Route path="/admin/taxas-de-entrega" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><TaxasDeEntrega /></PrivateRoute>} />
                  <Route path="/admin/gerenciar-estabelecimentos" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminEstablishmentManagement /></PrivateRoute>} />
                  <Route path="/admin/cupons" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminCouponManagement /></PrivateRoute>} />
                  <Route path="/admin/payment-settings" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminPaymentSettings /></PrivateRoute>} />
                  <Route path="/nossos-clientes" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><NossosClientes /></PrivateRoute>} />
                  <Route path="/admin/clientes/:clientId" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><ClientDetails /></PrivateRoute>} />
                  <Route path="/admin/reports" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminReports /></PrivateRoute>} />
                  <Route path="/admin/multi-platform" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminMultiPlatform /></PrivateRoute>} />
                  <Route path="/admin/associar-imagens" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminImageAssociation /></PrivateRoute>} />
                  <Route path="/admin/analytics" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminAnalytics /></PrivateRoute>} />
                  <Route path="/admin/gestao-funcionarios" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><GestaoFuncionarios /></PrivateRoute>} />
                  <Route path="/admin/entregadores" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><AdminEntregadores /></PrivateRoute>} />
                  <Route path="/admin/relatorio-entregas" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><RelatorioEntregas /></PrivateRoute>} />
                  <Route path="/admin/ranking" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><RankingFuncionarios /></PrivateRoute>} />
                  <Route path="/admin/whatsapp" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><WhatsAppConfig /></PrivateRoute>} />
                  <Route path="/admin/previsao" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><PrevisaoDemanda /></PrivateRoute>} />
                  <Route path="/admin/marketing" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><MarketingConfig /></PrivateRoute>} />
                  <Route path="/admin/avaliacoes" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><ResponderAvaliacoes /></PrivateRoute>} />
                  <Route path="/admin/lucro" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><RelatorioLucro /></PrivateRoute>} />
                  <Route path="/admin/relatorio-cancelamentos" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><RelatorioCancelamentos /></PrivateRoute>} />
                  <Route path="/admin/entrada-estoque" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><EntradaEstoqueXML /></PrivateRoute>} />

                  {/* Rotas Master */}
                  <Route path="/master-dashboard" element={<PrivateRoute allowedRoles={['masterAdmin']}><MasterDashboard /></PrivateRoute>} />
                  <Route path="/admin/cadastrar-estabelecimento" element={<PrivateRoute allowedRoles={['masterAdmin']}><AdminEstabelecimentoCadastro /></PrivateRoute>} />
                  <Route path="/master/estabelecimentos" element={<PrivateRoute allowedRoles={['masterAdmin']}><ListarEstabelecimentosMaster /></PrivateRoute>} />
                  <Route path="/master/financeiro" element={<PrivateRoute allowedRoles={['masterAdmin']}><FinanceiroMaster /></PrivateRoute>} />
                  <Route path="/master/pedidos" element={<PrivateRoute allowedRoles={['masterAdmin']}><ListarPedidosMaster /></PrivateRoute>} />
                  <Route path="/master/usuarios" element={<PrivateRoute allowedRoles={['masterAdmin']}><ListarUsuariosMaster /></PrivateRoute>} />
                  <Route path="/master/estabelecimentos/:id/editar" element={<PrivateRoute allowedRoles={['masterAdmin']}><EditarEstabelecimentoMaster /></PrivateRoute>} />
                  <Route path="/master/importar-cardapio" element={<PrivateRoute allowedRoles={['masterAdmin']}><ImportarCardapioMaster /></PrivateRoute>} />
                  <Route path="/master/usuarios/:id/editar" element={<PrivateRoute allowedRoles={['masterAdmin']}><EditarUsuarioMaster /></PrivateRoute>} />
                  <Route path="/master/plans" element={<PrivateRoute allowedRoles={['masterAdmin']}><AdminPlansManagement /></PrivateRoute>} />
                  <Route path="/master/pedidos/:id" element={<PrivateRoute allowedRoles={['masterAdmin']}><PedidoDetalhesMaster /></PrivateRoute>} />
                  <Route path="/master/usuarios/criar" element={<PrivateRoute allowedRoles={['masterAdmin']}><CriarUsuarioMaster /></PrivateRoute>} />
                  <Route path="/master/associar-imagens" element={<PrivateRoute allowedRoles={['masterAdmin']}><AdminImageAssociation /></PrivateRoute>} />
                  <Route path="/admin/audit-logs" element={<PrivateRoute allowedRoles={['masterAdmin']}><AuditLogs /></PrivateRoute>} />
                  <Route path="/admin/config-fiscal" element={<PrivateRoute allowedRoles={['admin', 'masterAdmin']}><ConfigFiscalScreen /></PrivateRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>

                <Route path="/historico-pedidos" element={<PrivateRoute><ClientOrderHistory /></PrivateRoute>} />
              </Routes>
            </Suspense>

            <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
          </div>
        </HeaderProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;