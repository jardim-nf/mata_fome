// src/components/Layout.jsx (CÓDIGO CORRIGIDO)

import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from './Header'; 
import Footer from './Footer'; 

// Lista de rotas/prefixos que NÃO DEVEM exibir o Header e Footer
// Remova a barra inicial para simplificar a checagem, ou inclua-a. Vou mantê-la.
const rotasSemLayout = [
    '/admin/reports',
    '/dashboard',
    '/admin-menu',
    '/admin/taxas-de-entrega',
    '/admin/gerenciar-cardapio',
    '/admin/cupons',
    '/painel' 
    // Se você tiver sub-rotas como '/admin/relatorios/detalhe', adicione '/admin/relatorios'
]; 

// Função auxiliar para normalizar e checar a rota
const shouldHideLayout = (pathname, hiddenRoutes) => {
    // 1. Remove barras finais (trailing slashes)
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1
        ? pathname.slice(0, -1)
        : pathname;

    // 2. Verifica se a rota exata ou o prefixo de uma sub-rota está na lista
    return hiddenRoutes.some(route => 
        // Checa a rota exata
        normalizedPath === route ||
        // Checa rotas dinâmicas ou sub-rotas (Ex: /admin/painel/pedidos)
        normalizedPath.startsWith(route + '/') 
    );
};


function Layout() {
    const location = useLocation();

    // 🚨 A nova verificação utiliza a função auxiliar
    const exibirLayoutCompleto = !shouldHideLayout(location.pathname, rotasSemLayout);
    
    // Você não precisa mais do console.log da variável 'exibirLayoutCompleto',
    // mas se precisar de debug, você pode usá-lo:
    // console.log("Caminho:", location.pathname, " | Exibir Layout:", exibirLayoutCompleto); 

    return (
        <div className="flex flex-col min-h-screen">
            {exibirLayoutCompleto && <Header />}
            
            <main className="flex-grow bg-white"> 
                <Outlet />
            </main>
            
            {exibirLayoutCompleto && <Footer />}
        </div>
    );
}

export default Layout;