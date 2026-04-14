import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import { PrivateRoute } from '../context/AuthContext';
import { ROLE_GROUPS } from '../constants/roles';

// Lazy imports para Master
const MasterDashboard = lazy(() => import('../pages/MasterDashboard'));
const AdminEstabelecimentoCadastro = lazy(() => import('../pages/admin/AdminEstabelecimentoCadastro'));
const ListarEstabelecimentosMaster = lazy(() => import('../pages/admin/ListarEstabelecimentosMaster'));
const FinanceiroMaster = lazy(() => import('../pages/admin/FinanceiroMaster'));
const ListarPedidosMaster = lazy(() => import('../pages/admin/ListarPedidosMaster'));
const ListarUsuariosMaster = lazy(() => import('../pages/admin/ListarUsuariosMaster'));
const EditarEstabelecimentoMaster = lazy(() => import('../pages/admin/EditarEstabelecimentoMaster'));
const ImportarCardapioMaster = lazy(() => import('../pages/admin/ImportarCardapioMaster'));
const MigradorUniversalMaster = lazy(() => import('../pages/admin/MigradorUniversalMaster'));
const EditarUsuarioMaster = lazy(() => import("../pages/admin/EditarUsuarioMaster"));
const AdminPlansManagement = lazy(() => import('../pages/admin/AdminPlansManagement'));
const PedidoDetalhesMaster = lazy(() => import('../pages/admin/PedidoDetalhesMaster'));
const CriarUsuarioMaster = lazy(() => import('../pages/admin/CriarUsuarioMaster'));
const AdminImageAssociation = lazy(() => import('../pages/admin/AdminImageAssociation'));
const DepartamentosFiscaisMaster = lazy(() => import('../pages/admin/DepartamentosFiscaisMaster'));
const MasterMensagens = lazy(() => import('../pages/admin/MasterMensagens'));
const MasterCupons = lazy(() => import('../pages/admin/MasterCupons'));
const MasterNfce = lazy(() => import('../pages/admin/MasterNfce'));
const MasterAnalytics = lazy(() => import('../pages/admin/MasterAnalytics'));
const MasterClientes = lazy(() => import('../pages/admin/MasterClientes'));
const AuditLogs = lazy(() => import('../pages/admin/AuditLogs'));

export const masterRoutes = [
    <Route key="master-dashboard" path="/master-dashboard" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><MasterDashboard /></PrivateRoute>} />,
    <Route key="admin-cadastrar-estabelecimento" path="/admin/cadastrar-estabelecimento" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><AdminEstabelecimentoCadastro /></PrivateRoute>} />,
    <Route key="master-estabelecimentos" path="/master/estabelecimentos" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><ListarEstabelecimentosMaster /></PrivateRoute>} />,
    <Route key="master-financeiro" path="/master/financeiro" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><FinanceiroMaster /></PrivateRoute>} />,
    <Route key="master-pedidos" path="/master/pedidos" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><ListarPedidosMaster /></PrivateRoute>} />,
    <Route key="master-usuarios" path="/master/usuarios" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><ListarUsuariosMaster /></PrivateRoute>} />,
    <Route key="master-estabelecimentos-id-editar" path="/master/estabelecimentos/:id/editar" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><EditarEstabelecimentoMaster /></PrivateRoute>} />,
    <Route key="master-importar-cardapio" path="/master/importar-cardapio" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><ImportarCardapioMaster /></PrivateRoute>} />,
    <Route key="master-migrador-universal" path="/master/migrador-universal" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><MigradorUniversalMaster /></PrivateRoute>} />,
    <Route key="master-usuarios-id-editar" path="/master/usuarios/:id/editar" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><EditarUsuarioMaster /></PrivateRoute>} />,
    <Route key="master-plans" path="/master/plans" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><AdminPlansManagement /></PrivateRoute>} />,
    <Route key="master-pedidos-id" path="/master/pedidos/:id" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><PedidoDetalhesMaster /></PrivateRoute>} />,
    <Route key="master-usuarios-criar" path="/master/usuarios/criar" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><CriarUsuarioMaster /></PrivateRoute>} />,
    <Route key="master-associar-imagens" path="/master/associar-imagens" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><AdminImageAssociation /></PrivateRoute>} />,
    <Route key="master-departamentos-fiscais" path="/master/departamentos-fiscais" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><DepartamentosFiscaisMaster /></PrivateRoute>} />,
    <Route key="master-mensagens" path="/master/mensagens" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><MasterMensagens /></PrivateRoute>} />,
    <Route key="master-cupons-rede" path="/master/cupons-rede" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><MasterCupons /></PrivateRoute>} />,
    <Route key="master-nfce" path="/master/nfce" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><MasterNfce /></PrivateRoute>} />,
    <Route key="master-analytics" path="/master/analytics" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><MasterAnalytics /></PrivateRoute>} />,
    <Route key="master-clientes" path="/master/clientes" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><MasterClientes /></PrivateRoute>} />,
    <Route key="admin-audit-logs" path="/admin/audit-logs" element={<PrivateRoute allowedRoles={ROLE_GROUPS.MASTER_ONLY}><AuditLogs /></PrivateRoute>} />
];
