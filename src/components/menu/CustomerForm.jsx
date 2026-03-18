import React from 'react';

export default function CustomerForm({
  nomeCliente, setNomeCliente,
  telefoneCliente, setTelefoneCliente,
  rua, setRua,
  numero, setNumero,
  bairro, setBairro,
  pontoReferencia, setPontoReferencia,
  isRetirada, setIsRetirada,
  bairrosDisponiveis,
}) {
  return (
    <div className="bg-white p-6 rounded-xl border shadow-lg text-left w-full">
      <h3 className="text-xl font-bold mb-4 text-gray-900">👤 Seus Dados</h3>
      <div className="space-y-4">
        <input
          id="input-nome"
          className="w-full p-3 rounded border text-gray-900 text-base"
          placeholder="Nome *"
          value={nomeCliente}
          onChange={e => setNomeCliente(e.target.value)}
        />
        <input
          id="input-telefone"
          className="w-full p-3 rounded border text-gray-900 text-base"
          placeholder="Telefone *"
          value={telefoneCliente}
          onChange={e => setTelefoneCliente(e.target.value)}
        />
        {!isRetirada && (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <input
                id="input-rua"
                className="w-full p-3 rounded border text-gray-900 text-base"
                placeholder="Rua *"
                value={rua}
                onChange={e => setRua(e.target.value)}
              />
              <input
                className="w-full p-3 rounded border text-center text-gray-900 text-base"
                placeholder="Nº *"
                value={numero}
                onChange={e => setNumero(e.target.value)}
              />
            </div>
            <select
              className="w-full p-3 rounded border text-gray-900 text-base bg-white"
              value={bairro}
              onChange={e => setBairro(e.target.value)}
            >
              <option value="">Selecione o Bairro *</option>
              {bairrosDisponiveis.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <input
              id="input-referencia"
              className="w-full p-3 rounded border text-gray-900 text-base"
              placeholder="Ponto de Referência (Opcional)"
              value={pontoReferencia}
              onChange={e => setPontoReferencia(e.target.value)}
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setIsRetirada(false)}
            className={`flex-1 p-3 rounded font-bold ${!isRetirada ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            🚚 Entrega
          </button>
          <button
            onClick={() => setIsRetirada(true)}
            className={`flex-1 p-3 rounded font-bold ${isRetirada ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            🏪 Retirada
          </button>
        </div>
      </div>
    </div>
  );
}