import React, { useState } from 'react';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { toast } from 'react-toastify';

export default function AuthModal({
  show, forceLogin, isRegistering, setIsRegistering, loginLoading,
  emailAuthModal, setEmailAuthModal,
  passwordAuthModal, setPasswordAuthModal,
  nomeAuthModal, setNomeAuthModal,
  telefoneAuthModal, setTelefoneAuthModal,
  ruaAuthModal, setRuaAuthModal,
  numeroAuthModal, setNumeroAuthModal,
  bairroAuthModal, setBairroAuthModal,
  cidadeAuthModal, setCidadeAuthModal,
  referenciaAuthModal, setReferenciaAuthModal,
  bairrosDisponiveis,
  onLogin, onRegister, onClose,
}) {
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState('');
  const [loadingRecuperacao, setLoadingRecuperacao] = useState(false);

  if (!show) return null;

  const handleRecuperarSenha = async (e) => {
    e.preventDefault();
    if (!emailRecuperacao.trim()) return toast.error('Digite seu email.');
    setLoadingRecuperacao(true);
    try {
      await sendPasswordResetEmail(getAuth(), emailRecuperacao.trim());
      toast.success('📧 Email de recuperação enviado! Verifique sua caixa de entrada e spam.');
      setModoRecuperacao(false);
      setEmailAuthModal(emailRecuperacao.trim());
      setEmailRecuperacao('');
    } catch (err) {
      let msg = 'Erro ao enviar email. Tente novamente.';
      if (err.code === 'auth/user-not-found') msg = 'Nenhuma conta encontrada com este email.';
      else if (err.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Aguarde alguns minutos.';
      else if (err.code === 'auth/invalid-email') msg = 'Email inválido.';
      toast.error(msg);
    } finally {
      setLoadingRecuperacao(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-4 text-gray-900">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md relative text-left shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
        {!forceLogin && (
          <button onClick={onClose} className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-800">&times;</button>
        )}

        {/* === TELA DE RECUPERAÇÃO DE SENHA === */}
        {modoRecuperacao ? (
          <>
            <h2 className="text-2xl font-bold mb-2 text-center">Recuperar Senha</h2>
            <p className="text-sm text-gray-500 mb-6 text-center">Enviaremos um link para redefinir sua senha</p>
            <form onSubmit={handleRecuperarSenha} className="space-y-4">
              <input
                type="email"
                placeholder="Digite seu email"
                value={emailRecuperacao}
                onChange={e => setEmailRecuperacao(e.target.value)}
                className="w-full p-3 rounded border border-gray-300 text-base"
                required
                autoFocus
              />
              <button
                type="submit"
                disabled={loadingRecuperacao}
                className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 transition-colors flex justify-center items-center gap-2"
              >
                {loadingRecuperacao
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : '📧 Enviar Link de Recuperação'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setModoRecuperacao(false); setEmailRecuperacao(''); }}
              className="w-full mt-4 text-green-600 text-sm hover:underline text-center block font-medium"
            >
              ← Voltar ao Login
            </button>
          </>
        ) : (
          <>
            {/* === TELA DE LOGIN / CADASTRO === */}
            <h2 className="text-2xl font-bold mb-6 text-center">
              {isRegistering ? 'Criar Conta' : 'Login'}
            </h2>
            <form onSubmit={isRegistering ? onRegister : onLogin} className="space-y-4">
              {isRegistering && (
                <>
                  <input placeholder="Nome Completo" value={nomeAuthModal} onChange={e => setNomeAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                  <input placeholder="Telefone (WhatsApp)" value={telefoneAuthModal} onChange={e => setTelefoneAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                  <div className="grid grid-cols-[1fr_90px] gap-2">
                    <input placeholder="Rua" value={ruaAuthModal} onChange={e => setRuaAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                    <input placeholder="Nº" value={numeroAuthModal} onChange={e => setNumeroAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base text-center" required />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={bairroAuthModal} onChange={e => setBairroAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base bg-white" required>
                      <option value="">Selecione o Bairro</option>
                      {bairrosDisponiveis.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <input placeholder="Cidade" value={cidadeAuthModal} onChange={e => setCidadeAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                  </div>
                  <input placeholder="Ponto de Referência (Opcional)" value={referenciaAuthModal} onChange={e => setReferenciaAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" />
                </>
              )}
              <input type="email" placeholder="Email" value={emailAuthModal} onChange={e => setEmailAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
              <input type="password" placeholder="Senha" value={passwordAuthModal} onChange={e => setPasswordAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
              <button type="submit" disabled={loginLoading} className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 transition-colors flex justify-center items-center gap-2">
                {loginLoading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : isRegistering ? 'Cadastrar' : 'Entrar'}
              </button>
            </form>

            {/* Esqueceu a senha - só aparece no modo login */}
            {!isRegistering && (
              <button
                type="button"
                onClick={() => { setModoRecuperacao(true); setEmailRecuperacao(emailAuthModal); }}
                className="w-full mt-3 text-gray-400 text-sm hover:text-green-600 hover:underline text-center block transition-colors"
              >
                Esqueceu sua senha?
              </button>
            )}

            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-3 text-green-600 text-sm hover:underline text-center block font-medium">
              {isRegistering ? 'Já tenho conta? Entrar' : 'Não tem conta? Criar agora'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}