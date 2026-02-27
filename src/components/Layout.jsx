import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from './Header'; 
import Footer from './Footer'; 

// Lista de rotas/prefixos que NÃO DEVEM exibir o Header e Footer
// Exemplo: rotas do PDV da loja, login, etc.
const rotasSemLayout = [
    '/login', 
    '/register'
    // Adicione aqui outras rotas que devem ocupar o ecrã todo sem header
]; 

// Função auxiliar para normalizar e checar a rota
const shouldHideLayout = (pathname, hiddenRoutes) => {
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1
        ? pathname.slice(0, -1)
        : pathname;

    return hiddenRoutes.some(route => 
        normalizedPath === route || normalizedPath.startsWith(route + '/') 
    );
};

function Layout() {
    const location = useLocation();
    const exibirLayoutCompleto = !shouldHideLayout(location.pathname, rotasSemLayout);
    
    return (
        // 1. Fundo cinza clarinho (bg-gray-50) e cor de texto padrão suave
        <div className="flex flex-col min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-emerald-200 selection:text-emerald-900">
            
            {exibirLayoutCompleto && <Header />}
            
            {/* 2. Container Principal Responsivo */}
            <main className={`flex-grow flex flex-col w-full ${
                exibirLayoutCompleto 
                ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 transition-all duration-300' 
                : ''
            }`}> 
                {/* O Outlet é onde as suas páginas (Dashboard, Cardápio, etc) vão aparecer */}
                <div className="flex-1 w-full animate-fadeIn">
                    <Outlet />
                </div>
            </main>
            
            {exibirLayoutCompleto && <Footer />}

            {/* Animação suave ao trocar de página */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
}

export default Layout;