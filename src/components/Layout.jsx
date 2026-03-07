import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from './Header'; 
import Footer from './Footer'; 

// Lista de rotas/prefixos que NÃO DEVEM exibir o Header e Footer
const rotasSemLayout = [
    '/login', 
    '/register'
    // Podes adicionar aqui outras rotas que devem ocupar o ecrã todo sem header
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
        <div className="flex flex-col min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-emerald-200 selection:text-emerald-900">
            
            {exibirLayoutCompleto && <Header />}
            
            {/* REMOVIDO o 'max-w-7xl mx-auto' -> AGORA USA A LARGURA TOTAL DO MONITOR */}
            <main className={`flex-grow flex flex-col w-full ${
                exibirLayoutCompleto 
                ? 'w-full px-4 sm:px-6 lg:px-8 py-6 md:py-8 transition-all duration-300' 
                : ''
            }`}> 
                <div className="flex-1 w-full animate-fadeIn">
                    <Outlet />
                </div>
            </main>
            
            {exibirLayoutCompleto && <Footer />}

<style>{`
                /* 🔥 REMOVIDO O 'transform' DAQUI PARA NÃO ESTRAGAR A POSIÇÃO DOS MODAIS! 🔥 */
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
}

export default Layout;