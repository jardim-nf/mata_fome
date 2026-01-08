import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify'; 

function ClienteLogin() {
  // Estados de Login e Cadastro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Estados de Perfil
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  
  // Estados de Endereço
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState(''); // <--- NOVO: Campo Cidade adicionado
  const [complemento, setComplemento] = useState('');

  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const auth = getAuth();

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');

    try {
      let userCredential;
      
      if (isRegistering) {
        // --- VALIDAÇÃO (Incluindo Cidade) ---
        if (!nome.trim() || !telefone.trim() || !rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim()) {
          setError('Por favor, preencha todos os campos obrigatórios (Nome, Telefone e Endereço completo).');
          return;
        }

        // 1. Criar usuário na autenticação
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Salvar dados no Firestore
        await setDoc(doc(db, 'usuarios', user.uid), {
          email: user.email,
          nome: nome.trim(),
          telefone: telefone.trim(),
          endereco: {
            rua: rua.trim(),
            numero: numero.trim(),
            bairro: bairro.trim(),
            cidade: cidade.trim(), // <--- SALVANDO CIDADE
            complemento: complemento.trim()
          },
          isAdmin: false,       
          isMasterAdmin: false, 
          criadoEm: Timestamp.now()
        });

        toast.success('✅ Cadastro realizado com sucesso! Faça login agora.');
        
        // Limpar formulário e mudar para login
        setIsRegistering(false);
        setEmail('');
        setPassword('');
        setNome('');
        setTelefone('');
        setRua('');
        setNumero('');
        setBairro('');
        setCidade('');
        setComplemento('');

      } else {
        // --- LOGIN ---
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        navigate('/'); // Redireciona para a home
      }
    } catch (error) {
      // Tratamento de Erros
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Email ou senha incorretos.');
          break;
        case 'auth/invalid-email':
          setError('Email inválido.');
          break;
        case 'auth/email-already-in-use':
          setError('Este email já está cadastrado.');
          break;
        case 'auth/weak-password':
          setError('Senha muito fraca. Use pelo menos 6 caracteres.');
          break;
        default:
          setError('Erro ao processar. Tente novamente.');
          console.error("Erro auth:", error);
      }
    }
  };

  // Função auxiliar para limpar campos ao trocar de aba
  const toggleMode = (mode) => {
    setIsRegistering(mode);
    setError('');
    // Limpa inputs
    setNome(''); setTelefone(''); 
    setRua(''); setNumero(''); setBairro(''); setCidade(''); setComplemento('');
    setEmail(''); setPassword('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bege-claro)] p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md animate-fadeIn">
        <h2 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-6">
          {isRegistering ? 'Criar Conta' : 'Acessar Conta'}
        </h2>
        
        <form onSubmit={handleAuthAction} className="space-y-4">
          
          {isRegistering && (
            <>
              {/* Dados Pessoais */}
              <div>
                <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--vermelho-principal)] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Celular (com DDD) *</label>
                <input
                  type="tel"
                  placeholder="(99) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--vermelho-principal)] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              {/* Endereço - Linha 1 */}
              <div>
                <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Rua *</label>
                <input
                  type="text"
                  value={rua}
                  onChange={(e) => setRua(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--vermelho-principal)] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              {/* Endereço - Linha 2 (Número e Bairro) */}
              <div className="flex gap-4">
                <div className="w-1/3">
                  <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Número *</label>
                  <input
                    type="text"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--vermelho-principal)] focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                <div className="w-2/3">
                  <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Bairro *</label>
                  <input
                    type="text"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--vermelho-principal)] focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Endereço - Linha 3 (Cidade) */}
              <div>
                 <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Cidade *</label>
                 <input
                   type="text"
                   value={cidade}
                   onChange={(e) => setCidade(e.target.value)}
                   className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--vermelho-principal)] focus:border-transparent outline-none transition-all"
                   required
                 />
              </div>

              {/* Endereço - Linha 4 (Complemento) */}
              <div>
                <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Complemento <span className="text-gray-400 text-xs">(Opcional)</span></label>
                <input
                  type="text"
                  placeholder="Ex: Apt 101, Ao lado da padaria"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--vermelho-principal)] focus:border-transparent outline-none transition-all"
                />
              </div>
              
              <div className="border-t border-gray-200 my-4"></div>
            </>
          )}

          {/* Campos de Acesso (Email/Senha) */}
          <div>
            <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--vermelho-principal)] focus:border-transparent outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Senha *</label>
            <input
              type="password"
              placeholder={isRegistering ? "Mínimo 6 caracteres" : ""}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--vermelho-principal)] focus:border-transparent outline-none transition-all"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-[var(--vermelho-principal)] hover:bg-red-700 text-white px-4 py-3 rounded-lg font-bold text-lg transition duration-300 shadow-lg hover:shadow-xl transform active:scale-95"
          >
            {isRegistering ? 'Finalizar Cadastro' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
          </p>
          <button
            onClick={() => toggleMode(!isRegistering)}
            className="text-[var(--vermelho-principal)] hover:text-red-800 font-bold hover:underline mt-1 transition-colors"
          >
            {isRegistering ? 'Fazer Login' : 'Cadastre-se grátis'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClienteLogin;