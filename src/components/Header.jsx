// src/components/Header.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useHeader } from '../context/HeaderContext.jsx';
import { toast } from 'react-toastify';
import { 
    Menu, 
    X, 
    ArrowLeft, 
    Home, 
    ChevronRight 
} from 'lucide-react';

function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, isAdmin, isMasterAdmin, logout } = useAuth();
    const { headerActions, headerTitle, headerSubtitle } = useHeader();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // --- 1. LÓGICA DE PERMISSÃO (NOVA) ---
    const temPermissao = (permissao) => {
        if (!currentUser) return false;
        if (isMasterAdmin || isAdmin) return true; // Chefes veem tudo
        return currentUser.permissoes && currentUser.permissoes.includes(permissao);
    };

    // --- 2. DEFINIR O LINK "HOME" INTELIGENTE ---
    let homeLink = "/";
    if (currentUser) {
        if (isMasterAdmin) homeLink = "/master-dashboard";
        else if (isAdmin) homeLink = "/dashboard";
        // Se for garçom e tiver permissão de salão, o início dele é o salão
        else if (temPermissao('Controle de Salão')) homeLink = "/controle-salao";
        // Se tiver permissão de pedidos, o início é o painel
        else if (temPermissao('Painel de Pedidos')) homeLink = "/painel";
    }

    const isInternalPage = !['/', '/login', '/register', '/master-dashboard', '/dashboard', '/controle-salao', '/painel'].includes(location.pathname);

    const getBreadcrumbs = () => {
        const paths = location.pathname.split('/').filter(Boolean);
        const breadcrumbs = [];
        
        let currentPath = '';
        paths.forEach((path, index) => {
            currentPath += `/${path}`;
            const isLast = index === paths.length - 1;
            
            let label = path;
            switch(path) {
                case 'admin': label = 'Admin'; break;
                case 'menu': label = 'Cardápio'; break;
                case 'gerenciar-cardapio': label = 'Cardápio'; break;
                case 'controle-salao': label = 'Salão'; break;
                case 'painel': label = 'Painel'; break;
                case 'dashboard': label = 'Dashboard'; break;
                case 'master': label = 'Master'; break;
                case 'reports': label = 'Relatórios'; break;
                case 'analytics': label = 'Dados'; break;
                case 'ordenar-categorias': label = 'Categorias'; break;
                default: label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
            }
            
            breadcrumbs.push({ label, path: currentPath, isLast });
        });
        
        return breadcrumbs;
    };

    const handleLogout = async () => {
        try {
            await logout();
            toast.info('Você foi desconectado.');
        } catch (error) {
            toast.error('Erro ao sair.');
        }
    };

    const getDynamicTitle = () => {
        if (headerTitle) return headerTitle;
        return getPageTitle(location.pathname);
    };

    const getDynamicSubtitle = () => {
        if (headerSubtitle) return headerSubtitle;
        return getPageSubtitle(location.pathname);
    };

    return (
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <div className="flex justify-between items-center py-2 md:py-3">
                    
                    {/* Lado Esquerdo - Navegação */}
                    <div className="flex items-center space-x-3">
                        {isInternalPage && (
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center justify-center w-8 h-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Voltar"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        
                        {/* Breadcrumb - Só mostra se tiver permissão da rota */}
                        {isInternalPage && getBreadcrumbs().length > 0 && (
                            <div className="hidden md:flex items-center space-x-2 text-xs md:text-sm text-gray-500">
                                <Link to={homeLink} className="hover:text-blue-600 transition-colors">
                                    <Home className="w-4 h-4" />
                                </Link>
                                
                                {getBreadcrumbs().map((crumb, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <ChevronRight className="w-3 h-3 text-gray-300" />
                                        {crumb.isLast ? (
                                            <span className="text-gray-800 font-semibold">{crumb.label}</span>
                                        ) : (
                                            <Link to={crumb.path} className="hover:text-blue-600 transition-colors">
                                                {crumb.label}
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Botão Menu Mobile (Só aparece em telas pequenas) */}
                    <button 
                        className="md:hidden p-2 text-gray-600"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>

                {/* BARRA INFERIOR (TÍTULO) */}
                {isInternalPage && (
                    <div className="border-t border-gray-100 py-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                                    {getDynamicTitle()}
                                </h1>
                                {getDynamicSubtitle() && (
                                    <p className="text-xs text-gray-500 hidden sm:block">
                                        {getDynamicSubtitle()}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                {headerActions}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- 3. MENU MOBILE PROTEGIDO --- */}
            {isMenuOpen && (
                <div className="md:hidden bg-white border-t border-gray-200 py-2 absolute w-full shadow-lg">
                    <nav className="px-4 space-y-1">
                        
                        {/* Link de Início (Já inteligente, leva p/ Salão se for garçom) */}
                        <Link 
                            to={homeLink}
                            className="block py-3 px-2 text-gray-700 font-medium hover:bg-gray-50 rounded-lg"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            Início
                        </Link>

                        {/* --- LINKS EXTRAS VISÍVEIS NO MOBILE --- */}
                        
                        {/* Só aparece se tiver permissão de Painel */}
                        {temPermissao('Painel de Pedidos') && (
                            <Link 
                                to="/painel" 
                                className="block py-3 px-2 text-gray-700 font-medium hover:bg-gray-50 rounded-lg"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Painel de Pedidos
                            </Link>
                        )}

                        {/* Só aparece se tiver permissão de Salão (Aline vê este) */}
                        {temPermissao('Controle de Salão') && (
                            <Link 
                                to="/controle-salao" 
                                className="block py-3 px-2 text-gray-700 font-medium hover:bg-gray-50 rounded-lg"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Controle de Salão
                            </Link>
                        )}
                        
                        {/* Só Admin/Master vê Equipe */}
                        {(isAdmin || isMasterAdmin) && (
                            <Link 
                                to="/admin/gestao-funcionarios" 
                                className="block py-3 px-2 text-gray-700 font-medium hover:bg-gray-50 rounded-lg"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Equipe
                            </Link>
                        )}

                        {currentUser && (
                            <button
                                onClick={handleLogout}
                                className="block w-full text-left py-3 px-2 text-red-600 font-medium hover:bg-red-50 rounded-lg border-t border-gray-100 mt-2"
                            >
                                Sair do Sistema
                            </button>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
}

// Funções auxiliares mantidas
const getPageTitle = (pathname) => {
    const titles = {
        '/admin/gerenciar-cardapio': 'Cardápio',
        '/controle-salao': 'Salão',
        '/painel': 'Pedidos',
        '/dashboard': 'Dashboard',
        '/master-dashboard': 'Admin Master',
        '/admin/taxas-de-entrega': 'Taxas',
        '/admin/gerenciar-estabelecimentos': 'Estabelecimento',
        '/admin/cupons': 'Cupons',
        '/nossos-clientes': 'Clientes',
        '/admin/reports': 'Financeiro',
        '/admin/analytics': 'Estatísticas',
        '/admin/ordenar-categorias': 'Categorias',
        '/admin/gestao-funcionarios': 'Equipe'
    };
    return titles[pathname] || 'Dashboard';
};

const getPageSubtitle = (pathname) => {
    const subtitles = {
        '/admin/gerenciar-cardapio': 'Gerencie seus produtos',
        '/controle-salao': 'Mapa de mesas',
        '/painel': 'Fila de produção',
        '/admin/reports': 'Extrato financeiro',
    };
    return subtitles[pathname] || '';
};

export default Header;