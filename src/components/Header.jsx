// src/components/Header.jsx - VERSÃO PADRONIZADA
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import { toast } from 'react-toastify';
import { 
    IoMenu, 
    IoClose, 
    IoArrowBack,
    IoHome,
    IoChevronForward
} from 'react-icons/io5';

function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, currentClientData, isAdmin, isMasterAdmin, logout } = useAuth();
    const { headerActions, headerTitle, headerSubtitle } = useHeader();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    let homeLink = "/";
    if (currentUser) {
        if (isMasterAdmin) homeLink = "/master-dashboard";
        else if (isAdmin) homeLink = "/dashboard";
    }

    const isInternalPage = !['/', '/login', '/register', '/master-dashboard', '/dashboard'].includes(location.pathname);

    const getBreadcrumbs = () => {
        const paths = location.pathname.split('/').filter(Boolean);
        const breadcrumbs = [];
        
        let currentPath = '';
        paths.forEach((path, index) => {
            currentPath += `/${path}`;
            const isLast = index === paths.length - 1;
            
            let label = path;
            switch(path) {
                case 'admin':
                    label = 'Administração';
                    break;
                case 'menu':
                    label = 'Cardápio';
                    break;
                case 'orders':
                    label = 'Pedidos';
                    break;
                case 'tables':
                    label = 'Mesas';
                    break;
                case 'gerenciar-cardapio':
                    label = 'Gerenciar Cardápio';
                    break;
                case 'controle-salao':
                    label = 'Controle de Salão';
                    break;
                case 'painel':
                    label = 'Painel de Pedidos';
                    break;
                case 'dashboard':
                    label = 'Dashboard';
                    break;
                case 'master':
                    label = 'Master';
                    break;
                default:
                    label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
            }
            
            breadcrumbs.push({
                label,
                path: currentPath,
                isLast
            });
        });
        
        return breadcrumbs;
    };

    const handleLogout = async () => {
        try {
            await logout();
            toast.info('Você foi desconectado.');
        } catch (error) {
            toast.error('Não foi possível fazer logout.');
        }
    };

    // 🆕 FUNÇÃO PARA OBTER TÍTULO DINÂMICO
    const getDynamicTitle = () => {
        // Prioridade 1: Título do contexto
        if (headerTitle) return headerTitle;
        
        // Prioridade 2: Título baseado na rota
        return getPageTitle(location.pathname);
    };

    // 🆕 FUNÇÃO PARA OBTER SUBTÍTULO DINÂMICO
    const getDynamicSubtitle = () => {
        // Prioridade 1: Subtítulo do contexto
        if (headerSubtitle) return headerSubtitle;
        
        // Prioridade 2: Subtítulo baseado na rota
        return getPageSubtitle(location.pathname);
    };

    return (
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* HEADER SUPERIOR COM BREADCRUMB */}
                <div className="flex justify-between items-center py-4">
                    {/* Lado Esquerdo - Navegação */}
                    <div className="flex items-center space-x-4">
                        {/* Botão Voltar para páginas internas */}
                        {isInternalPage && (
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
                            >
                                <IoArrowBack className="text-xl" />
                                <span className="hidden sm:block text-sm font-medium">Voltar</span>
                            </button>
                        )}
                        
                        {/* Breadcrumb */}
                        {isInternalPage && getBreadcrumbs().length > 0 && (
                            <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500">
                                <Link 
                                    to={homeLink}
                                    className="flex items-center space-x-1 text-amber-600 hover:text-amber-800 transition-colors"
                                >
                                    <IoHome className="text-lg" />
                                    <span>Início</span>
                                </Link>
                                
                                {getBreadcrumbs().map((crumb, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <IoChevronForward className="text-gray-400 text-xs" />
                                        {crumb.isLast ? (
                                            <span className="text-gray-900 font-medium">
                                                {crumb.label}
                                            </span>
                                        ) : (
                                            <Link 
                                                to={crumb.path}
                                                className="text-gray-600 hover:text-gray-900 transition-colors"
                                            >
                                                {crumb.label}
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Lado Direito - Logo e Menu */}
                    <div className="flex items-center space-x-4">
                        <Link to={homeLink} className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-lg flex items-center justify-center">
                                <span className="text-black font-bold text-sm">MG</span>
                            </div>
                            <span className="font-bold text-gray-900 text-lg">MeGusta</span>
                        </Link>

                        {/* Menu Mobile */}
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            {isMenuOpen ? <IoClose className="text-xl" /> : <IoMenu className="text-xl" />}
                        </button>
                    </div>
                </div>

                {/* 🆕 BARRA INFERIOR COM CONTEXTO DINÂMICO */}
                {isInternalPage && (
                    <div className="border-t border-gray-100 py-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    {getDynamicTitle()}
                                </h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    {getDynamicSubtitle()}
                                </p>
                            </div>
                            
                            {/* AÇÕES ESPECÍFICAS DA PÁGINA */}
                            <div className="mt-3 sm:mt-0 flex space-x-3">
                                {headerActions}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Menu Mobile Dropdown */}
            {isMenuOpen && (
                <div className="md:hidden bg-white border-t border-gray-200 py-2">
                    <nav className="px-4 space-y-2">
                        <Link 
                            to={homeLink}
                            className="block py-2 text-gray-600 hover:text-gray-900 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            Início
                        </Link>
                        {currentUser && (
                            <button
                                onClick={handleLogout}
                                className="block w-full text-left py-2 text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Sair
                            </button>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
}

// Funções auxiliares para títulos padrão
const getPageTitle = (pathname) => {
    const titles = {
        '/admin/gerenciar-cardapio': 'Gerenciar Cardápio',
        '/controle-salao': 'Controle de Salão',
        '/painel': 'Painel de Pedidos',
        '/dashboard': 'Dashboard',
        '/master-dashboard': 'Painel Master',
        '/admin/taxas-de-entrega': 'Taxas de Entrega',
        '/admin/gerenciar-estabelecimentos': 'Gerenciar Estabelecimentos',
        '/admin/cupons': 'Cupons de Desconto',
        '/nossos-clientes': 'Nossos Clientes',
        '/admin/reports': 'Relatórios',
        '/admin/analytics': 'Analytics',
        '/master/estabelecimentos': 'Estabelecimentos',
        '/master/pedidos': 'Pedidos',
        '/master/usuarios': 'Usuários'
    };
    
    return titles[pathname] || 'Dashboard';
};

const getPageSubtitle = (pathname) => {
    const subtitles = {
        '/admin/gerenciar-cardapio': 'Gerencie produtos, estoque e preços',
        '/controle-salao': 'Mesas, pedidos e ocupação do salão',
        '/painel': 'Acompanhe e gerencie pedidos',
        '/dashboard': 'Visão geral do seu estabelecimento',
        '/master-dashboard': 'Administração completa do sistema',
        '/admin/taxas-de-entrega': 'Configure valores de entrega por região',
        '/admin/gerenciar-estabelecimentos': 'Configure seu estabelecimento',
        '/admin/cupons': 'Crie e gerencie cupons de desconto',
        '/nossos-clientes': 'Clientes e histórico de pedidos',
        '/admin/reports': 'Relatórios detalhados de vendas',
        '/admin/analytics': 'Métricas e análises do negócio',
        '/master/estabelecimentos': 'Gerencie todos os estabelecimentos',
        '/master/pedidos': 'Visualize todos os pedidos do sistema',
        '/master/usuarios': 'Gerencie usuários e permissões'
    };
    
    return subtitles[pathname] || 'Gerencie seu estabelecimento';
};

export default Header;