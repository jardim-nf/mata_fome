// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, PrivateRoute } from './context/AuthContext';
import { HeaderProvider } from './context/HeaderContext';
import { AIProvider } from './context/AIContext';
import { PaymentProvider } from './context/PaymentContext';
import { NotificationProvider } from './context/NotificationContext'; 
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout e Páginas
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import ListaEstabelecimentos from "./pages/ListaEstabelecimentos";
import Planos from "./pages/Planos";
import ClientOrderHistory from './pages/ClientOrderHistory';
import HomeRedirector from './pages/HomeRedirector';
import ComandaParaImpressao from "./components/ComandaParaImpressao";
import PaginaImpressao from './pages/PaginaImpressao';
import AdminSettings from './pages/AdminSettings'; 
import RelatorioCancelamentos from './pages/admin/RelatorioCancelamentos';
import PdvScreen from './pages/admin/PdvScreen';
import CheckoutPage from './pages/CheckoutPage';
import ControleSalao from "./pages/ControleSalao";
import Painel from "./pages/Painel";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMenuManagement from "./pages/AdminMenuManagement";
import TaxasDeEntrega from "./pages/TaxasDeEntrega";
import AdminEstablishmentManagement from "./pages/AdminEstablishmentManagement";
import NossosClientes from './pages/NossosClientes';
import ClientDetails from "./pages/ClientDetails";
import TelaPedidos from './pages/TelaPedidos';
import AdminCouponManagement from './pages/AdminCouponManagement';
import AdminReports from './pages/AdminReports';
import AdminImageAssociation from './pages/admin/AdminImageAssociation';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminMultiPlatform from './pages/AdminMultiPlatform';
import ClientManagement from './pages/ClientManagement'; 
import AdminOrderCategories from './pages/AdminOrderCategories';
import GestaoFuncionarios from "./pages/admin/GestaoFuncionarios";
import AdminEntregadores from './pages/admin/AdminEntregadores';
import RelatorioEntregas from './pages/admin/RelatorioEntregas'; 
import AdminPaymentSettings from './pages/admin/AdminPaymentSettings';
import AdminColorSettings from './pages/AdminColorSettings'; 
import MasterDashboard from './pages/MasterDashboard';
import AdminEstabelecimentoCadastro from './pages/admin/AdminEstabelecimentoCadastro';
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
import FinanceiroMaster from './pages/admin/FinanceiroMaster';

// ❌ REMOVIDO: import NotificationManager ... (não é necessário pois está no Context)

function App() {
  return (
    <Router>
      <AuthProvider>
        <HeaderProvider>
          <AIProvider>
            <PaymentProvider>
              <NotificationProvider>
                
                <div className="min-h-screen bg-gray-50">
                  <Routes>
                    {/* --- Rotas SEM o Layout Principal --- */}
                    <Route path="/" element={<Home />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/login-admin" element={<Login />} />
                    
                    {/* 👇 ROTA PARA O IFRAME AUTOMÁTICO 👇 */}
                    <Route path="/imprimir-comanda/:pedidoId" element={<ComandaParaImpressao />} />
                    
                    {/* Rotas legadas de impressão manual */}
                    <Route path="/comanda/:pedidoId" element={<ComandaParaImpressao />} />
                    <Route path="/imprimir/pedido/:pedidoId" element={<PaginaImpressao />} />
                    
                    <Route path="/cardapio" element={<ListaEstabelecimentos />} />
                    <Route path="/cardapio/:estabelecimentoSlug" element={<Menu />} />
                    
                    <Route 
                      path="/checkout" 
                      element={
                        <PrivateRoute>
                          <CheckoutPage />
                        </PrivateRoute>
                      } 
                    />

                    {/* --- Rotas COM o Layout Principal --- */}
                    <Route element={<Layout />}>
                      <Route path="/planos" element={<Planos />} />
                      <Route path="/painel-inicial" element={<HomeRedirector />} />
                      
                      <Route
                        path="/pdv"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <PdvScreen />
                          </PrivateRoute>
                        }
                      />

                      <Route
                        path="/admin/clientes-estabelecimento"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <ClientManagement />
                          </PrivateRoute>
                        }
                      />
                      
                      <Route
                        path="/controle-salao"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin', 'garcom', 'garçom']}>
                            <ControleSalao />
                          </PrivateRoute>
                        }
                      />
                      
                      <Route
                        path="/estabelecimento/:estabelecimentoId/mesa/:id"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin', 'garcom', 'garçom']}>
                            <TelaPedidos />
                          </PrivateRoute>
                        }
                      />
                      
                      <Route
                        path="/painel"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin', 'garcom', 'garçom', 'cozinha']}>
                            <Painel />
                          </PrivateRoute>
                        }
                      />

                      <Route
                        path="/admin-dashboard" 
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminDashboard />
                          </PrivateRoute>
                        }
                      />
                      
                      <Route
                        path="/admin/configuracoes"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminSettings />
                          </PrivateRoute>
                        }
                      />

                      <Route
                        path="/dashboard"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin', 'garcom', 'garçom', 'cozinha']}>
                            <AdminDashboard />
                          </PrivateRoute>
                        }
                      />

                      <Route
                        path="/admin/gerenciar-cardapio"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminMenuManagement />
                          </PrivateRoute>
                        }
                      />
                      
                      <Route
                        path="/admin/cores"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminColorSettings />
                          </PrivateRoute>
                        }
                      />

                      <Route
                        path="/admin/ordenar-categorias"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminOrderCategories />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin/taxas-de-entrega"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <TaxasDeEntrega />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin/gerenciar-estabelecimentos"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminEstablishmentManagement />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin/cupons"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminCouponManagement />
                          </PrivateRoute>
                        }
                      />
                      
                      <Route
                        path="/admin/payment-settings"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminPaymentSettings />
                          </PrivateRoute>
                        }
                      />
                      
                      <Route
                        path="/nossos-clientes"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <NossosClientes />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin/clientes/:clientId"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <ClientDetails />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin/reports"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminReports />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin/multi-platform"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminMultiPlatform />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin/associar-imagens"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminImageAssociation />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin/analytics"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminAnalytics />
                          </PrivateRoute>
                        }
                      />
                      
                      <Route
                        path="/admin/gestao-funcionarios"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <GestaoFuncionarios />
                          </PrivateRoute>
                        }
                      />

                       <Route
                        path="/admin/entregadores"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <AdminEntregadores />
                          </PrivateRoute>
                        }
                      />

                      <Route
                        path="/admin/relatorio-entregas"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <RelatorioEntregas />
                          </PrivateRoute>
                        }
                      />

                       <Route
                        path="/admin/relatorio-cancelamentos"
                        element={
                          <PrivateRoute allowedRoles={['admin', 'masterAdmin']}>
                            <RelatorioCancelamentos />
                          </PrivateRoute>
                        }
                      />

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
                      
                      {/* Fallback */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>

                    {/* Rota para o histórico de pedidos */}
                    <Route path="/historico-pedidos" element={<PrivateRoute><ClientOrderHistory /></PrivateRoute>} />
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
                </div>

              </NotificationProvider>
            </PaymentProvider>
          </AIProvider>
        </HeaderProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;