// src/components/Layout.jsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from './Header'; // Supondo que seu Header esteja em um arquivo separado
import Footer from './Footer'; // Supondo que seu Footer esteja em um arquivo separado

function Layout() {
    const location = useLocation();

    // Lista de rotas que terão o menu superior e rodapé removidos
    const rotasSemLayout = [
        '/admin/reports',
        '/dashboard',
        '/admin-menu',
        '/admin/taxas-de-entrega',
        '/admin/gerenciar-cardapio',
        '/admin/cupons',
        '/painel' // ADICIONAMOS A PÁGINA DO PAINEL À LISTA
    ]; 

    // Verifica se a rota atual está na lista
    const exibirLayoutCompleto = !rotasSemLayout.includes(location.pathname);

    return (
        <div className="flex flex-col min-h-screen">
            {exibirLayoutCompleto && <Header />}
            
            <main className="flex-grow bg-gray-900"> {/* Fundo escuro padrão para o main */}
                <Outlet />
            </main>
            
            {exibirLayoutCompleto && <Footer />}
        </div>
    );
}

export default Layout;