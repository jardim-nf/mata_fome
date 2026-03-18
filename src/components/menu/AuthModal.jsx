import React from 'react';

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
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-4 text-gray-900">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md relative text-left shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
        {!forceLogin && (
          <button onClick={onClose} className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-800">&times;</button>
        )}
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
        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-green-600 text-sm hover:underline text-center block font-medium">
          {isRegistering ? 'Já tenho conta? Entrar' : 'Não tem conta? Criar agora'}
        </button>
      </div>
    </div>
  );
}