// src/components/Layout.jsx
import React from "react";
import { Outlet, useLocation, Link, useNavigate } from "react-router-dom";
import Header from './Header'; // Supondo que o Header esteja em um arquivo separado
import Footer from './Footer'; // Supondo que o Footer esteja em um arquivo separado
import { useAuth } from "../context/AuthContext";
import { toast } from 'react-toastify';

function Layout() {
    const location = useLocation();
    const { currentUser } = useAuth(); // Apenas para o exemplo do Header

    // Lista de rotas que terão o menu superior e rodapé removidos
    const rotasSemLayout = [
        '/admin/reports', 
        '/dashboard',
        '/admin/gerenciar-cardapio',
        '/admin/taxas-de-entrega',
        '/admin/cupons',
        '/painel' // ADICIONAMOS A PÁGINA DO PAINEL À LISTA
    ]; 

    // Verifica se a rota atual está na lista
    const exibirLayoutCompleto = !rotasSemLayout.includes(location.pathname);

    // Se o código do seu Header/Footer estiver diretamente aqui, não tem problema.
    // A lógica abaixo vai funcionar da mesma forma.
    return (
        <div className="flex flex-col min-h-screen">
            {exibirLayoutCompleto && <Header />}
            
            <main className="flex-grow">
                <Outlet />
            </main>
            
            {exibirLayoutCompleto && <Footer />}
        </div>
    );
}

export default Layout;