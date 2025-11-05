// src/pages/HomeRedirector.jsx

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Importe o useAuth

function HomeRedirector() {
    // Pega o userData completo e o status de carregamento
    const { userData, loading } = useAuth(); 
    const navigate = useNavigate();

    // Extrai as permissões de forma segura
    const isMasterAdmin = userData?.isMasterAdmin || false;
    const isAdmin = userData?.isAdmin || false;
    
    // NOTA: 'estabelecimentosGerenciados' não é mais necessário, 
    // pois o Admin vai para a rota estática '/painel'.

    useEffect(() => {
        // Se ainda estiver carregando, não faz nada.
        if (loading) {
            return;
        }

        // Lógica de decisão
        if (isMasterAdmin) {
            // Se for Master Admin, vai para o dashboard principal
            console.log("REDIR: Master Admin -> /master-dashboard");
            navigate('/master-dashboard', { replace: true });
            
        } else if (isAdmin) {
            // 🚨 CORREÇÃO FINAL: Admin de Estabelecimento vai para /painel
            console.log("REDIR: Admin Est. -> /painel");
            navigate('/painel', { replace: true });
            
        } else {
            // Cliente comum ou usuário não logado volta para a home
            console.log("REDIR: Cliente comum -> /");
            navigate('/', { replace: true });
        }
        
    }, [loading, isMasterAdmin, isAdmin, navigate]); 

    // Mensagem de carregamento
    return <div className="text-center p-8">Redirecionando...</div>;
}

export default HomeRedirector;