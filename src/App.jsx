import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, PrivateRoute } from './context/AuthContext';
import { HeaderProvider } from './context/HeaderContext';
import { LocalSyncProvider } from './context/LocalSyncContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginMotoboy from './pages/LoginMotoboy';
import { ROLE_GROUPS, ROLES } from './constants/roles';
import IosInstallPrompt from "./components/IosInstallPrompt";
import ScrollToTop from "./components/ScrollToTop";

// Modulos importados
import { adminRoutes } from './routes/AdminRoutes';
import { masterRoutes } from './routes/MasterRoutes';

// Lazy imports dos context providers pesados (só carregam em rotas autenticadas)
const AIProvider = lazy(() => import('./context/AIContext').then(m => ({ default: m.AIProvider })));
const PaymentProvider = lazy(() => import('./context/PaymentContext').then(m => ({ default: m.PaymentProvider })));
const NotificationProvider = lazy(() => import('./context/NotificationContext').then(m => ({ default: m.NotificationProvider })));

// Todas as páginas agora usam lazy loading
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const ComandaParaImpressao = lazy(() => import("./components/ComandaParaImpressao"));
const Menu = lazy(() => import("./pages/Menu"));
const ListaEstabelecimentos = lazy(() => import("./pages/ListaEstabelecimentos"));
const ClientOrderHistory = lazy(() => import('./pages/ClientOrderHistory'));
const PaginaImpressao = lazy(() => import('./pages/PaginaImpressao'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ImpressaoIsolada = lazy(() => import("./pages/ImpressaoIsolada"));
const Divulgacao = lazy(() => import('./pages/Divulgacao'));
const EntregadorApp = lazy(() => import('./pages/EntregadorApp'));

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
    <ErrorBoundary>
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <HeaderProvider>
          <LocalSyncProvider>
            <div className="min-h-screen bg-gray-50">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" /></div>}>
              <Routes>
                {/* Rotas públicas — SEM providers pesados */}
                <Route path="/" element={<Home />} />
                <Route path="/home" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/login-admin" element={<Login />} />
                <Route path="/login-motoboy" element={<LoginMotoboy />} />
                <Route path="/imprimir-comanda/:pedidoId" element={<ComandaParaImpressao />} />
                <Route path="/comanda/:pedidoId" element={<ComandaParaImpressao />} />
                <Route path="/imprimir/pedido/:pedidoId" element={<PaginaImpressao />} />
                <Route path="/impressao-isolada" element={<ImpressaoIsolada />} />
                <Route path="/cardapio" element={<ListaEstabelecimentos />} />
                <Route path="/cardapio/:estabelecimentoSlug" element={<Menu />} />
                <Route path="/divulgacao" element={<Divulgacao />} />
                <Route path="/checkout" element={<PrivateRoute><CheckoutPage /></PrivateRoute>} />

                {/* App do Motoboy (Uberização) - Renderiza full screen fora do Layout master */}
                <Route path="/entregador" element={<PrivateRoute allowedRoles={[ROLES.ENTREGADOR, 'admin', 'masterAdmin']}><EntregadorApp /></PrivateRoute>} />

                {/* Rotas autenticadas — COM providers pesados (AI, Payment, Notification) */}
                <Route element={<AuthenticatedProviders><Layout /></AuthenticatedProviders>}>
                  {adminRoutes}
                  {masterRoutes}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>

                <Route path="/historico-pedidos" element={<PrivateRoute><ClientOrderHistory /></PrivateRoute>} />
              </Routes>
            </Suspense>
            <IosInstallPrompt />
            <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
          </div>
          </LocalSyncProvider>
        </HeaderProvider>
      </AuthProvider>
    </Router>
    </ErrorBoundary>
  );
}

export default App;