// src/pages/ClienteLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify'; // Certifique-se de que toast está importado

function ClienteLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  // <<-- NOVOS ESTADOS PARA O ENDEREÇO DO CLIENTE NO CADASTRO -->>
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState(''); // Ponto de referência ou complemento

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
        // <<-- VALIDAÇÃO DOS NOVOS CAMPOS DE ENDEREÇO NO CADASTRO -->>
        if (!nome.trim() || !telefone.trim() || !rua.trim() || !numero.trim() || !bairro.trim()) {
          setError('Por favor, preencha todos os campos obrigatórios (Nome, Telefone e Endereço).');
          return;
        }

        // Lógica de Cadastro do Cliente
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Salvar informações adicionais do cliente no Firestore na coleção 'usuarios'
        await setDoc(doc(db, 'usuarios', user.uid), { // <-- ALTERADO PARA 'usuarios'
          email: user.email,
          nome: nome.trim(),
          telefone: telefone.trim(),
          // <<-- INCLUI OS NOVOS CAMPOS DE ENDEREÇO NO FIREBASE -->>
          endereco: { // Objeto aninhado para o endereço
            rua: rua.trim(),
            numero: numero.trim(),
            bairro: bairro.trim(),
            complemento: complemento.trim()
          },
          isAdmin: false,       // Adicionado para definir o papel como cliente
          isMasterAdmin: false, // Adicionado para definir o papel como cliente
          criadoEm: Timestamp.now()
        });
        toast.success('✅ Cadastro de cliente realizado com sucesso! Faça login agora.'); // Use toast
        setIsRegistering(false); // Volta para a tela de login
        setEmail('');
        setPassword('');
        setNome('');
        setTelefone('');
        setRua(''); // Limpa o campo de rua
        setNumero(''); // Limpa o campo de número
        setBairro(''); // Limpa o campo de bairro
        setComplemento(''); // Limpa o campo de complemento
      } else {
        // Lógica de Login do Cliente (mantida)
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        navigate('/'); // Redireciona para a home
      }
    } catch (error) {
      // Tratamento de Erros de Autenticação (mantido)
      switch (error.code) {
        case 'auth/user-not-found':
          setError('Usuário não encontrado. Verifique seu email.');
          break;
        case 'auth/wrong-password':
          setError('Senha incorreta. Tente novamente.');
          break;
        case 'auth/invalid-email':
          setError('Email inválido.');
          break;
        case 'auth/email-already-in-use':
          setError('Este email já está cadastrado.');
          break;
        case 'auth/weak-password':
          setError('Senha muito fraca. Deve ter pelo menos 6 caracteres.');
          break;
        case 'auth/too-many-requests':
          setError('Muitas tentativas. Tente novamente mais tarde.');
          break;
        default:
          setError('Erro na operação. Verifique suas informações.');
          console.error("Erro de autenticação:", error.message);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bege-claro)] p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-6">
          {isRegistering ? 'Cadastre-se como Cliente' : 'Login de Cliente 👋'}
        </h2>
        <form onSubmit={handleAuthAction} className="space-y-5">
          {isRegistering && (
            <>
              <div>
                <label htmlFor="nome" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Seu Nome *</label>
                <input
                  type="text"
                  id="nome"
                  placeholder="Seu Nome Completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                  required
                />
              </div>
              <div>
                <label htmlFor="telefone" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Seu Telefone (com DDD) *</label>
                <input
                  type="tel"
                  id="telefone"
                  placeholder="Ex: 22999999999"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                  required
                />
              </div>
              {/* <<-- NOVOS CAMPOS DE ENDEREÇO NO FORMULÁRIO -->> */}
              <div>
                <label htmlFor="rua" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Rua *</label>
                <input
                  type="text"
                  id="rua"
                  placeholder="Ex: Rua das Flores"
                  value={rua}
                  onChange={(e) => setRua(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                  required
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="numero" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Número *</label>
                  <input
                    type="text"
                    id="numero"
                    placeholder="Ex: 123"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="bairro" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Bairro *</label>
                  <input
                    type="text"
                    id="bairro"
                    placeholder="Ex: Centro"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="complemento" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Complemento / Ponto de Referência</label>
                <input
                  type="text"
                  id="complemento"
                  placeholder="Ex: Apt 101, Próximo à praça"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                />
              </div>
            </>
          )} 
          {/* Fim dos novos campos de endereço */}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Email *</label>
            <input
              type="email"
              id="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Senha *</label>
            <input
              type="password"
              id="password"
              placeholder="Sua senha (mínimo 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full bg-[var(--vermelho-principal)] hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-lg transition duration-300 shadow-md"
          >
            {isRegistering ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-700">
          {isRegistering ? (
            <>Já tem uma conta?{' '}
              <button
                onClick={() => { 
                  setIsRegistering(false); setError(''); 
                  // Limpa todos os campos ao mudar para Login
                  setNome(''); setTelefone(''); setRua(''); setNumero(''); setBairro(''); setComplemento(''); 
                  setEmail(''); setPassword(''); 
                }}
                className="text-[var(--vermelho-principal)] hover:underline font-semibold"
              >
                Faça Login
              </button>
            </>
          ) : (
            <>Não tem uma conta?{' '}
              <button
                onClick={() => { 
                  setIsRegistering(true); setError(''); 
                  // Limpa todos os campos ao mudar para Cadastro
                  setNome(''); setTelefone(''); setRua(''); setNumero(''); setBairro(''); setComplemento(''); 
                  setEmail(''); setPassword(''); 
                }}
                className="text-[var(--vermelho-principal)] hover:underline font-semibold"
              >
                Cadastre-se
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default ClienteLogin;