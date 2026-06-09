import React, { useState } from 'react';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { toast } from 'react-toastify';

const formatarTelefone = (valor) => {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
};

export default function AuthModal({
  show, forceLogin, isRegistering, setIsRegistering, loginLoading,
  authMethod, setAuthMethod,
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

  const handleTelefoneChange = (e) => {
    setTelefoneAuthModal(formatarTelefone(e.target.value));
  };

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

  const telefoneValido = telefoneAuthModal.replace(/\D/g, '').length >= 10;

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-4 text-gray-900">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md relative text-left shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
        {!forceLogin && (
          <button onClick={onClose} className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-800">&times;</button>
        )}

        {/* === TELA DE RECUPERAÇÃO DE SENHA (Apenas e-mail) === */}
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
            <h2 className="text-2xl font-bold mb-2 text-center">
              {authMethod === 'phone'
                ? isRegistering
                  ? 'Finalizar Cadastro'
                  : 'Identifique-se'
                : isRegistering
                  ? 'Criar Conta'
                  : 'Login'}
            </h2>
            <p className="text-sm text-gray-500 mb-6 text-center">
              {authMethod === 'phone'
                ? isRegistering
                  ? 'Insira seus dados para concluir seu pedido'
                  : 'Insira seu WhatsApp para continuar'
                : 'Acesse usando e-mail e senha'}
            </p>

            <form onSubmit={isRegistering ? onRegister : onLogin} className="space-y-4">
              {authMethod === 'phone' ? (
                /* === MODO TELEFONE === */
                <>
                  {!isRegistering ? (
                    /* PASSO 1: Inserir Telefone */
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp (Telefone) *</label>
                        <input
                          placeholder="(11) 99999-9999"
                          value={telefoneAuthModal}
                          onChange={handleTelefoneChange}
                          type="tel"
                          inputMode="numeric"
                          maxLength={16}
                          className="w-full p-3 rounded border border-gray-300 text-base focus:ring-2 focus:ring-green-200 outline-none"
                          required
                          autoFocus
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loginLoading || !telefoneValido}
                        className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                      >
                        {loginLoading ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Avançar'
                        )}
                      </button>
                    </div>
                  ) : (
                    /* PASSO 2: Completar cadastro caso não exista */
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                        <input
                          value={telefoneAuthModal}
                          className="w-full p-3 rounded border border-gray-200 text-base bg-gray-50 text-gray-500"
                          disabled
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo *</label>
                        <input
                          placeholder="Ex: Maria Silva"
                          value={nomeAuthModal}
                          onChange={e => setNomeAuthModal(e.target.value)}
                          className="w-full p-3 rounded border border-gray-300 text-base focus:ring-2 focus:ring-green-200 outline-none"
                          required
                          autoFocus
                        />
                      </div>
                      <div className="grid grid-cols-[1fr_90px] gap-2">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rua *</label>
                          <input
                            placeholder="Rua"
                            value={ruaAuthModal}
                            onChange={e => setRuaAuthModal(e.target.value)}
                            className="w-full p-3 rounded border border-gray-300 text-base focus:ring-2 focus:ring-green-200 outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nº *</label>
                          <input
                            placeholder="Nº"
                            value={numeroAuthModal}
                            onChange={e => setNumeroAuthModal(e.target.value)}
                            className="w-full p-3 rounded border border-gray-300 text-base text-center focus:ring-2 focus:ring-green-200 outline-none"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bairro *</label>
                          <select
                            value={bairroAuthModal}
                            onChange={e => setBairroAuthModal(e.target.value)}
                            className="w-full p-3 rounded border border-gray-300 text-base bg-white focus:ring-2 focus:ring-green-200 outline-none"
                            required
                          >
                            <option value="">Selecione</option>
                            {bairrosDisponiveis.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade *</label>
                          <input
                            placeholder="Cidade"
                            value={cidadeAuthModal}
                            onChange={e => setCidadeAuthModal(e.target.value)}
                            className="w-full p-3 rounded border border-gray-300 text-base focus:ring-2 focus:ring-green-200 outline-none"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ponto de Referência (Opcional)</label>
                        <input
                          placeholder="Ex: Próximo à praça"
                          value={referenciaAuthModal}
                          onChange={e => setReferenciaAuthModal(e.target.value)}
                          className="w-full p-3 rounded border border-gray-300 text-base focus:ring-2 focus:ring-green-200 outline-none"
                        />
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsRegistering(false)}
                          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          disabled={loginLoading}
                          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors flex justify-center items-center gap-2"
                        >
                          {loginLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            'Cadastrar e Continuar'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* === MODO EMAIL tradicional === */
                <>
                  {isRegistering && (
                    <>
                      <input placeholder="Nome Completo" value={nomeAuthModal} onChange={e => setNomeAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                      <input placeholder="Telefone (WhatsApp)" value={telefoneAuthModal} onChange={handleTelefoneChange} className="w-full p-3 rounded border border-gray-300 text-base" required />
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
                </>
              )}
            </form>

            {/* Esqueceu a senha - só aparece no modo login/email */}
            {authMethod === 'email' && !isRegistering && (
              <button
                type="button"
                onClick={() => { setModoRecuperacao(true); setEmailRecuperacao(emailAuthModal); }}
                className="w-full mt-3 text-gray-400 text-sm hover:text-green-600 hover:underline text-center block transition-colors"
              >
                Esqueceu sua senha?
              </button>
            )}

            {/* Alternar modo de cadastro - só aparece no modo email */}
            {authMethod === 'email' && (
              <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-3 text-green-600 text-sm hover:underline text-center block font-medium">
                {isRegistering ? 'Já tenho conta? Entrar' : 'Não tem conta? Criar agora'}
              </button>
            )}

            {/* Toggles entre os métodos de autenticação */}
            <div className="border-t border-gray-100 mt-6 pt-4 text-center">
              {authMethod === 'phone' ? (
                <button
                  type="button"
                  onClick={() => { setAuthMethod('email'); setIsRegistering(false); }}
                  className="text-gray-400 text-xs hover:text-green-600 transition-colors hover:underline"
                >
                  🔒 Entrar com e-mail e senha tradicional
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAuthMethod('phone'); setIsRegistering(false); }}
                  className="text-green-600 text-xs font-bold transition-colors hover:underline"
                >
                  📱 Entrar/Cadastrar rápido com WhatsApp
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}