// src/components/AuthScreen.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doSignInWithEmailAndPassword, doCreateUserWithEmailAndPassword, doSignOut } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase'; 

const AuthScreen = ({ onClose, onAuthSuccess, initialMode = 'login', redirectTo = '/' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [address, setAddress] = useState(''); 
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [isAdminAuth, setIsAdminAuth] = useState(false); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let userCredential;
      if (isRegister) {
        if (!isAdminAuth) { 
          userCredential = await doCreateUserWithEmailAndPassword(email, password);
          // CORRIGIDO PARA A COLEÇÃO 'usuarios'
          await setDoc(doc(db, "usuarios", userCredential.user.uid), {
            email: email,
            nome: name,
            telefone: phone,
            endereco: address,
            cargo: 'cliente', 
          });
        } else { 
          setError('Administradores/Funcionários não podem se registrar por aqui.');
          setLoading(false);
          return;
        }
      } else { 
        // Lógica de Login
        userCredential = await doSignInWithEmailAndPassword(email, password);
        
        // CORRIGIDO: Buscando na coleção 'usuarios' em vez de 'users'
        const userDoc = await getDoc(doc(db, "usuarios", userCredential.user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Captura o cargo (ou se não tiver, define como cliente)
          const cargoUser = (userData.cargo || 'cliente').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          
          setCurrentUser({ ...userCredential.user, cargo: cargoUser }); 

          // Se estiver tentando logar pela aba de Administrador/Funcionário
          if (isAdminAuth) {
            const cargosPermitidos = ['admin', 'masteradmin', 'garcom', 'gerente', 'caixa', 'atendente', 'cozinheiro', 'entregador', 'auxiliar'];
            
            // Verifica se é um funcionário ou admin/masterAdmin
            if (!cargosPermitidos.includes(cargoUser) && !userData.isAdmin && !userData.isMasterAdmin) {
              setError('Acesso negado. Área restrita para funcionários.');
              await doSignOut(); 
              setLoading(false);
              return;
            }
            
            // Redirecionamento correto dependendo do cargo
            if (['garcom', 'atendente'].includes(cargoUser)) redirectTo = '/controle-salao';
            else if (['caixa'].includes(cargoUser)) redirectTo = '/pdv';
            else redirectTo = '/painel';
            
          } else {
            // Cliente tentando logar na aba de cliente
            if (cargoUser !== 'cliente' && !userData.isClient && !userData.cargo) {
              // Permite passar, mas você pode tratar regras extras de cliente aqui se quiser
            }
          }
        } else {
          setError('Dados do usuário não encontrados. Cadastre-se.');
          await doSignOut();
          setLoading(false);
          return;
        }
      }
      
      onAuthSuccess?.(); 
      navigate(redirectTo); 
      onClose?.(); 
      
    } catch (err) {
      console.error(err);
      setError('Erro na autenticação. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen-container p-6 bg-white rounded-lg shadow-lg max-w-md mx-auto my-10">
      <h3 className="text-2xl font-bold mb-4 text-center">{isRegister ? 'Cadastre-se' : 'Entrar'}</h3>

      <div className="flex justify-center mb-6">
        <button
          type="button"
          className={`px-6 py-2 rounded-l-lg font-semibold transition-colors duration-200 ${!isAdminAuth ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          onClick={() => { setIsAdminAuth(false); setError(''); }}
        >
          Cliente
        </button>
        <button
          type="button"
          className={`px-6 py-2 rounded-r-lg font-semibold transition-colors duration-200 ${isAdminAuth ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          onClick={() => { setIsAdminAuth(true); setError(''); }}
        >
          Funcionário
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-center mb-4 font-medium">{error}</p>}

        {!isAdminAuth && isRegister && (
          <>
            <input type="text" placeholder="Nome Completo" value={name} onChange={(e) => setName(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <input type="tel" placeholder="Telefone (DDNXXXXXXXXX)" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <input type="text" placeholder="Endereço Completo" value={address} onChange={(e) => setAddress(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </>
        )}

        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400" />

        <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white py-3 rounded-md font-bold hover:bg-orange-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Carregando...' : (isRegister ? 'Cadastrar' : 'Entrar')}
        </button>
      </form>

      <p className="text-center mt-4 text-gray-600">
        {isRegister ? (
          <>Já tem uma conta? <span className="text-orange-500 cursor-pointer hover:underline" onClick={() => setIsRegister(false)}>Faça login</span></>
        ) : (
          <>Não tem uma conta? <span className="text-orange-500 cursor-pointer hover:underline" onClick={() => setIsRegister(true)}>Cadastre-se</span></>
        )}
      </p>

      {onClose && (
        <button type="button" onClick={onClose} className="mt-4 w-full bg-gray-300 text-gray-800 py-2 rounded-md font-bold hover:bg-gray-400 transition-colors duration-200">
          Fechar
        </button>
      )}
    </div>
  );
};

export default AuthScreen;
