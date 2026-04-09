import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import { PrivateRoute } from '../context/AuthContext';
import { ROLE_GROUPS } from '../constants/roles';

const Planos = lazy(() => import("../pages/Planos"));
const HomeRedirector = lazy(() => import('../pages/HomeRedirector'));
const PdvScreen = lazy(() => import('../pages/admin/PdvScreen'));
const ClientManagement = lazy(() => import('../pages/ClientManagement'));
const ControleSalao = lazy(() => import("../pages/ControleSalao"));
const TelaPedidos = lazy(() => import('../pages/TelaPedidos'));
const Painel = lazy(() => import("../pages/Painel"));
const AdminDashboard = lazy(() => import("../pages/AdminDashboard"));
const AdminSettings = lazy(() => import('../pages/AdminSettings'));
const AdminMenuManagement = lazy(() => import("../pages/AdminMenuManagement"));
const AdminColorSettings = lazy(() => import('../pages/AdminColorSettings'));
const AdminOrderCategories = lazy(() => import('../pages/AdminOrderCategories'));
const TaxasDeEntrega = lazy(() => import("../pages/TaxasDeEntrega"));
const AdminEstablishmentManagement = lazy(() => import("../pages/AdminEstablishmentManagement"));
const AdminCouponManagement = lazy(() => import('../pages/AdminCouponManagement'));
const AdminPaymentSettings = lazy(() => import('../pages/admin/AdminPaymentSettings'));
const NossosClientes = lazy(() => import('../pages/NossosClientes'));
const ClientDetails = lazy(() => import("../pages/ClientDetails"));
const AdminReports = lazy(() => import('../pages/AdminReports'));
const AdminMultiPlatform = lazy(() => import('../pages/AdminMultiPlatform'));
const AdminImageAssociation = lazy(() => import('../pages/admin/AdminImageAssociation'));
const AdminAnalytics = lazy(() => import('../pages/AdminAnalytics'));
const GestaoFuncionarios = lazy(() => import("../pages/admin/GestaoFuncionarios"));
const AdminEntregadores = lazy(() => import('../pages/admin/AdminEntregadores'));
const RelatorioEntregas = lazy(() => import('../pages/admin/RelatorioEntregas'));
const RankingFuncionarios = lazy(() => import("../pages/admin/RankingFuncionarios"));
const WhatsAppConfig = lazy(() => import("../pages/admin/WhatsAppConfig"));
const PrevisaoDemanda = lazy(() => import("../pages/admin/PrevisaoDemanda"));
const ResponderAvaliacoes = lazy(() => import("../pages/admin/ResponderAvaliacoes"));
const RelatorioLucro = lazy(() => import("../pages/admin/RelatorioLucro"));
const RelatorioCancelamentos = lazy(() => import('../pages/admin/RelatorioCancelamentos'));
const EntradaEstoqueXML = lazy(() => import("../pages/admin/EntradaEstoqueXML"));
const AcertoMotoboys = lazy(() => import('../pages/AcertoMotoboys'));
const BotPedidosConfig = lazy(() => import('../pages/admin/BotPedidosConfig'));
const MarketingConfig = lazy(() => import('../pages/admin/MarketingConfig'));
const CashbackConfig = lazy(() => import('../pages/admin/CashbackConfig'));
const ConfigFiscalScreen = lazy(() => import('../pages/admin/ConfigFiscalScreen'));
const RelatorioNfce = lazy(() => import('../pages/admin/RelatorioNfce'));

export const adminRoutes = [
    <Route key="planos" path="/planos" element={<Planos />} />,
    <Route key="painel-inicial" path="/painel-inicial" element={<HomeRedirector />} />,
    <Route key="pdv" path="/pdv" element={<PrivateRoute allowedRoles={ROLE_GROUPS.PDV}><PdvScreen /></PrivateRoute>} />,
    <Route key="clientes-estabelecimento" path="/admin/clientes-estabelecimento" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><ClientManagement /></PrivateRoute>} />,
    <Route key="controle-salao" path="/controle-salao" element={<PrivateRoute allowedRoles={ROLE_GROUPS.SALAO}><ControleSalao /></PrivateRoute>} />,
    <Route key="mesa-id" path="/estabelecimento/:estabelecimentoId/mesa/:id" element={<PrivateRoute allowedRoles={ROLE_GROUPS.SALAO}><TelaPedidos /></PrivateRoute>} />,
    <Route key="painel" path="/painel" element={<PrivateRoute allowedRoles={ROLE_GROUPS.TODOS}><Painel /></PrivateRoute>} />,
    <Route key="admin-dashboard-root" path="/admin-dashboard" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminDashboard /></PrivateRoute>} />,
    <Route key="admin-configuracoes" path="/admin/configuracoes" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminSettings /></PrivateRoute>} />,
    <Route key="dashboard" path="/dashboard" element={<PrivateRoute allowedRoles={ROLE_GROUPS.TODOS}><AdminDashboard /></PrivateRoute>} />,
    <Route key="admin-dashboard-path" path="/admin/dashboard" element={<PrivateRoute allowedRoles={ROLE_GROUPS.TODOS}><AdminDashboard /></PrivateRoute>} />,
    <Route key="admin-gerenciar-cardapio" path="/admin/gerenciar-cardapio" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminMenuManagement /></PrivateRoute>} />,
    <Route key="admin-cores" path="/admin/cores" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminColorSettings /></PrivateRoute>} />,
    <Route key="admin-ordenar-categorias" path="/admin/ordenar-categorias" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminOrderCategories /></PrivateRoute>} />,
    <Route key="admin-taxas-de-entrega" path="/admin/taxas-de-entrega" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><TaxasDeEntrega /></PrivateRoute>} />,
    <Route key="admin-gerenciar-estabelecimentos" path="/admin/gerenciar-estabelecimentos" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminEstablishmentManagement /></PrivateRoute>} />,
    <Route key="admin-cupons" path="/admin/cupons" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminCouponManagement /></PrivateRoute>} />,
    <Route key="admin-payment-settings" path="/admin/payment-settings" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminPaymentSettings /></PrivateRoute>} />,
    <Route key="nossos-clientes" path="/nossos-clientes" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><NossosClientes /></PrivateRoute>} />,
    <Route key="admin-clientes-id" path="/admin/clientes/:clientId" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><ClientDetails /></PrivateRoute>} />,
    <Route key="admin-reports" path="/admin/reports" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_GERENTE}><AdminReports /></PrivateRoute>} />,
    <Route key="admin-multi-platform" path="/admin/multi-platform" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminMultiPlatform /></PrivateRoute>} />,
    <Route key="admin-associar-imagens" path="/admin/associar-imagens" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminImageAssociation /></PrivateRoute>} />,
    <Route key="admin-analytics" path="/admin/analytics" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_GERENTE}><AdminAnalytics /></PrivateRoute>} />,
    <Route key="admin-gestao-funcionarios" path="/admin/gestao-funcionarios" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><GestaoFuncionarios /></PrivateRoute>} />,
    <Route key="admin-entregadores" path="/admin/entregadores" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><AdminEntregadores /></PrivateRoute>} />,
    <Route key="admin-relatorio-entregas" path="/admin/relatorio-entregas" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><RelatorioEntregas /></PrivateRoute>} />,
    <Route key="admin-ranking" path="/admin/ranking" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_GERENTE}><RankingFuncionarios /></PrivateRoute>} />,
    <Route key="admin-whatsapp" path="/admin/whatsapp" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><WhatsAppConfig /></PrivateRoute>} />,
    <Route key="admin-previsao" path="/admin/previsao" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><PrevisaoDemanda /></PrivateRoute>} />,
    <Route key="admin-avaliacoes" path="/admin/avaliacoes" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><ResponderAvaliacoes /></PrivateRoute>} />,
    <Route key="admin-lucro" path="/admin/lucro" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_GERENTE}><RelatorioLucro /></PrivateRoute>} />,
    <Route key="admin-relatorio-cancelamentos" path="/admin/relatorio-cancelamentos" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><RelatorioCancelamentos /></PrivateRoute>} />,
    <Route key="admin-entrada-estoque" path="/admin/entrada-estoque" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><EntradaEstoqueXML /></PrivateRoute>} />,
    <Route key="admin-acerto-motoboys" path="/admin/acerto-motoboys" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_GERENTE}><AcertoMotoboys /></PrivateRoute>} />,
    <Route key="admin-bot-pedidos" path="/admin/bot-pedidos" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><BotPedidosConfig /></PrivateRoute>} />,
    <Route key="admin-marketing" path="/admin/marketing" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><MarketingConfig /></PrivateRoute>} />,
    <Route key="admin-cashback" path="/admin/cashback" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><CashbackConfig /></PrivateRoute>} />,
    <Route key="admin-config-fiscal" path="/admin/config-fiscal" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><ConfigFiscalScreen /></PrivateRoute>} />,
    <Route key="admin-relatorio-nfce" path="/admin/relatorio-nfce" element={<PrivateRoute allowedRoles={ROLE_GROUPS.ADMIN_ONLY}><RelatorioNfce /></PrivateRoute>} />
];
