// src/components/AuthRedirector.jsx

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 

function AuthRedirector({ children }) {
    // Esses hooks AGORA estão dentro do contexto do Router
    const { currentUser, userData, loading } = useAuth();
    const navigate = useNavigate(); 
    const location = useLocation(); 

    // Lógica de Redirecionamento Pós-Login
    useEffect(() => {
        // Dispara quando o 'userData' é carregado E o usuário está na rota /login
        if (!loading && currentUser && userData && location.pathname === '/login') {
            
            console.log("REDIR HOOK: Iniciando checagem de permissão para redirecionamento...");

            if (userData.isMasterAdmin) {
                console.log("REDIR HOOK: Redirecionando para Master Dashboard.");
                navigate('/master-dashboard', { replace: true }); 
            } else if (userData.isAdmin) {
                const estabId = userData.estabelecimentosGerenciados?.[0]; // Pega o primeiro ID
                
                if (estabId) {
                    console.log(`REDIR HOOK: Redirecionando para Cardápio de Estabelecimento: ${estabId}`);
                    // O Blackburger deve estar vinculado com o ID 'blackburger-barra-alegre' ou similar
                    navigate(`/admin/${estabId}/cardapio`, { replace: true }); 
                } else {
                    console.log("REDIR HOOK: Admin sem estab. vinculado, indo para Dashboard Admin Geral.");
                    navigate('/dashboard', { replace: true }); 
                }
            } else {
                console.log("REDIR HOOK: Usuário comum logou, indo para a Home.");
                navigate('/home', { replace: true });
            }
        }
    }, [currentUser, userData, loading, navigate, location.pathname]);

    return children;
}

export default AuthRedirector;