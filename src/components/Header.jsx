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
    ChevronRight,
    LogOut // Ícone adicionado para o botão de sair
} from 'lucide-react';

function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, isAdmin, isMasterAdmin, logout } = useAuth();
    const { headerActions, headerTitle, headerSubtitle } = useHeader();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // --- 1. LÓGICA DE PERMISSÃO ---
    const temPermissao = (permissao) => {
        if (!currentUser) return false;
        if (isMasterAdmin || isAdmin) return true;
        return currentUser.permissoes && currentUser.permissoes.includes(permissao);
    };

    // --- 2. DEFINIR O LINK "HOME" INTELIGENTE ---
    let homeLink = "/";
    if (currentUser) {
        if (isMasterAdmin) homeLink = "/master-dashboard";
        else if (isAdmin) homeLink = "/dashboard";
        else if (temPermissao('Controle de Salão')) homeLink = "/controle-salao";
        else if (temPermissao('Painel de Pedidos')) homeLink = "/painel";
    }

    // Define o que é tela principal (onde não tem voltar, mas tem o botão Sair)
    const telasPrincipais = ['/', '/login', '/register', '/master-dashboard', '/dashboard', '/controle-salao', '/painel'];
    const isInternalPage = !telasPrincipais.includes(location.pathname);

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
        if(window.confirm("Deseja realmente sair do sistema?")) {
            try {
                await logout();
                toast.info('Você foi desconectado.');
            } catch (error) {
                toast.error('Erro ao sair.');
            }
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
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 w-full transition-all">
            <div className="max-w-7xl mx-auto px-4 lg:px-8">
                
                {/* LINHA PRINCIPAL: ESQUERDA - CENTRO - DIREITA */}
                <div className="flex items-center justify-between h-16 md:h-20">
                    
                    {/* ⬅️ Lado Esquerdo: Navegação / Voltar */}
                    <div className="flex-1 flex items-center justify-start gap-3">
                        {isInternalPage && (
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center justify-center p-2 -ml-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all group"
                                title="Voltar"
                            >
                                <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                            </button>
                        )}
                        
                        {/* Breadcrumbs (Apenas Desktop) */}
                        {isInternalPage && getBreadcrumbs().length > 0 && (
                            <div className="hidden lg:flex items-center space-x-2 text-sm text-gray-400 font-medium">
                                <Link to={homeLink} className="hover:text-emerald-600 transition-colors p-1">
                                    <Home className="w-4 h-4" />
                                </Link>
                                
                                {getBreadcrumbs().map((crumb, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <ChevronRight className="w-3 h-3 text-gray-300" />
                                        {crumb.isLast ? (
                                            <span className="text-gray-800 font-bold">{crumb.label}</span>
                                        ) : (
                                            <Link to={crumb.path} className="hover:text-emerald-600 transition-colors">
                                                {crumb.label}
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 🎯 Centro: Títulos sempre perfeitamente alinhados */}
                    <div className="flex-[2] flex flex-col items-center justify-center text-center">
                        <h1 className="text-lg md:text-xl font-black text-gray-800 leading-tight truncate px-2">
                            {getDynamicTitle()}
                        </h1>
                        {getDynamicSubtitle() && (
                            <p className="text-[10px] md:text-xs text-gray-500 font-medium hidden sm:block mt-0.5">
                                {getDynamicSubtitle()}
                            </p>
                        )}
                    </div>

                    {/* ➡️ Lado Direito: Ações da Tela e Botão de Sair */}
                    <div className="flex-1 flex items-center justify-end gap-2 md:gap-4">
                        
                        {/* Ações Dinâmicas injetadas por outras telas */}
                        {headerActions && (
                            <div className="flex items-center gap-2">
                                {headerActions}
                            </div>
                        )}
                        
                        {/* Botão de Sair (Exibido apenas nas telas principais em Desktop) */}
                        {!isInternalPage && currentUser && (
                            <button
                                onClick={handleLogout}
                                className="hidden md:flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl font-bold transition-colors shadow-sm"
                                title="Sair do Sistema"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="text-sm">Sair</span>
                            </button>
                        )}

                        {/* Botão Menu Mobile */}
                        <button 
                            className="md:hidden p-2 -mr-2 text-gray-600 hover:text-emerald-600 transition-colors"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>

                </div>
            </div>

            {/* --- MENU MOBILE RESPONSIVO --- */}
            {isMenuOpen && (
                <div className="md:hidden bg-white border-t border-gray-100 absolute w-full shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-50 animate-slideUp origin-top">
                    <nav className="px-4 py-3 space-y-1">
                        
                        <Link 
                            to={homeLink}
                            className="flex items-center gap-3 py-3 px-3 text-gray-700 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            <Home className="w-5 h-5 text-gray-400" />
                            Início
                        </Link>

                        {temPermissao('Painel de Pedidos') && (
                            <Link 
                                to="/painel" 
                                className="flex items-center gap-3 py-3 px-3 text-gray-700 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <span className="w-5 h-5 flex items-center justify-center text-lg">🍳</span>
                                Painel de Pedidos
                            </Link>
                        )}

                        {temPermissao('Controle de Salão') && (
                            <Link 
                                to="/controle-salao" 
                                className="flex items-center gap-3 py-3 px-3 text-gray-700 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <span className="w-5 h-5 flex items-center justify-center text-lg">🪑</span>
                                Controle de Salão
                            </Link>
                        )}
                        
                        {(isAdmin || isMasterAdmin) && (
                            <Link 
                                to="/admin/gestao-funcionarios" 
                                className="flex items-center gap-3 py-3 px-3 text-gray-700 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <span className="w-5 h-5 flex items-center justify-center text-lg">👥</span>
                                Equipe
                            </Link>
                        )}

                        {/* Botão de Sair no Mobile */}
                        {currentUser && (
                            <button
                                onClick={() => { setIsMenuOpen(false); handleLogout(); }}
                                className="flex w-full items-center gap-3 py-3 px-3 text-red-600 font-bold hover:bg-red-50 rounded-xl border border-red-50 mt-4 transition-colors"
                            >
                                <LogOut className="w-5 h-5" />
                                Sair do Sistema
                            </button>
                        )}
                    </nav>
                </div>
            )}
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slideUp { animation: slideUp 0.2s ease-out forwards; }
            `}</style>
        </header>
    );
}

// Funções auxiliares mantidas
const getPageTitle = (pathname) => {
    const titles = {
        '/admin/gerenciar-cardapio': 'Cardápio',
        '/controle-salao': 'Mapa de Mesas',
        '/painel': 'Pedidos',
        '/dashboard': 'Dashboard',
        '/master-dashboard': 'Admin Master',
        '/admin/taxas-de-entrega': 'Taxas de Entrega',
        '/admin/gerenciar-estabelecimentos': 'Estabelecimento',
        '/admin/cupons': 'Cupons',
        '/nossos-clientes': 'Clientes',
        '/admin/reports': 'Financeiro',
        '/admin/analytics': 'Estatísticas',
        '/admin/ordenar-categorias': 'Categorias',
        '/admin/gestao-funcionarios': 'Equipe'
    };
    return titles[pathname] || 'NaMão System';
};

const getPageSubtitle = (pathname) => {
    const subtitles = {
        '/admin/gerenciar-cardapio': 'Gerenciamento de produtos',
        '/controle-salao': 'Visão geral do salão',
        '/painel': 'Fila de produção em tempo real',
        '/admin/reports': 'Extrato financeiro e balanço',
        '/admin/analytics': 'Dados e métricas de vendas',
    };
    return subtitles[pathname] || '';
};

export default Header;