// src/pages/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAuth } from 'firebase/auth'; // Importar getAuth

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userCredential = await login(email, password);
            const user = userCredential.user;

            const idTokenResult = await user.getIdTokenResult(true); 
            const claims = idTokenResult.claims;

            const isMaster = claims.isMasterAdmin === true;
            const isAdminEst = claims.isAdmin === true;
            const estabelecimentoId = claims.estabelecimentoId; 

            // --- NOVOS CONSOLE.LOGS CRÍTICOS AQUI ---
            console.log("--- DEBUG DE REDIRECIONAMENTO ---");
            console.log("Email logado:", user.email);
            console.log("Claims do token:", claims);
            console.log("isMaster (calculado):", isMaster);
            console.log("isAdminEst (calculado):", isAdminEst);
            console.log("estabelecimentoId (da claim):", estabelecimentoId);
            console.log("---------------------------------");


            toast.success('Login realizado com sucesso!');

            if (isMaster) {
                console.log("AVISO: Redirecionando para MASTER DASHBOARD.");
                navigate('/master-dashboard');
            } else if (isAdminEst && estabelecimentoId) {
                console.log(`AVISO: Redirecionando para PAINEL DO ESTABELECIMENTO ${estabelecimentoId}.`);
                navigate(`/dashboard`);
            } else {
                console.log("AVISO: Redirecionando para HOME (usuário comum/sem role).");
                navigate('/home');
            }

        } catch (error) {
            console.error("Erro no login:", error);
            let errorMessage = "Falha no login. Verifique suas credenciais.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = "Email ou senha inválidos.";
            } else if (error.code === 'auth/user-disabled') {
                errorMessage = "Sua conta está desativada. Contate o suporte.";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "Problema de conexão. Verifique sua internet.";
            } else if (error.code === 'auth/quota-exceeded') {
                errorMessage = "Cota de autenticação excedida. Tente novamente mais tarde.";
            }
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* ... seus inputs ... */}
            <div>
                <label htmlFor="email">Email:</label>
                <input 
                    type="email" 
                    id="email"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="seu.email@exemplo.com" 
                    required 
                />
            </div>
            <div>
                <label htmlFor="password">Senha:</label>
                <input 
                    type="password" 
                    id="password"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Sua senha" 
                    required 
                />
            </div>
            <button type="submit" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
            </button>
        </form>
    );
}
export default LoginPage;