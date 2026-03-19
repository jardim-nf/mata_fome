import React from 'react';

// Máscara de telefone: (11) 99999-9999
const formatarTelefone = (valor) => {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
};

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
  const handleTelefoneChange = (e) => {
    setTelefoneCliente(formatarTelefone(e.target.value));
  };

  const telefoneValido = telefoneCliente.replace(/\D/g, '').length >= 10;

  return (
    <div className="bg-white p-6 rounded-xl border shadow-lg text-left w-full">
      <h3 className="text-xl font-bold mb-4 text-gray-900">👤 Seus Dados</h3>
      <div className="space-y-4">
        <div>
          <input
            id="input-nome"
            className={`w-full p-3 rounded-xl border text-gray-900 text-base transition-all outline-none focus:ring-2 ${nomeCliente.trim().length > 0 ? 'border-green-300 focus:ring-green-200' : 'border-gray-200 focus:ring-blue-200'}`}
            placeholder="Nome completo *"
            value={nomeCliente}
            onChange={e => setNomeCliente(e.target.value)}
            minLength={2}
            required
          />
          {nomeCliente.length > 0 && nomeCliente.trim().length < 2 && (
            <p className="text-[10px] text-red-500 mt-1 font-bold">⚠️ Nome muito curto</p>
          )}
        </div>
        <div>
          <input
            id="input-telefone"
            className={`w-full p-3 rounded-xl border text-gray-900 text-base transition-all outline-none focus:ring-2 ${telefoneValido ? 'border-green-300 focus:ring-green-200' : 'border-gray-200 focus:ring-blue-200'}`}
            placeholder="Telefone * (11) 99999-9999"
            value={telefoneCliente}
            onChange={handleTelefoneChange}
            type="tel"
            inputMode="numeric"
            maxLength={16}
            required
          />
          {telefoneCliente.length > 0 && !telefoneValido && (
            <p className="text-[10px] text-red-500 mt-1 font-bold">⚠️ Telefone incompleto</p>
          )}
        </div>
        {!isRetirada && (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <input
                id="input-rua"
                className={`w-full p-3 rounded-xl border text-gray-900 text-base transition-all outline-none focus:ring-2 ${rua.trim() ? 'border-green-300 focus:ring-green-200' : 'border-gray-200 focus:ring-blue-200'}`}
                placeholder="Rua *"
                value={rua}
                onChange={e => setRua(e.target.value)}
                required
              />
              <input
                className={`w-full p-3 rounded-xl border text-center text-gray-900 text-base transition-all outline-none focus:ring-2 ${numero.trim() ? 'border-green-300 focus:ring-green-200' : 'border-gray-200 focus:ring-blue-200'}`}
                placeholder="Nº *"
                value={numero}
                onChange={e => setNumero(e.target.value)}
                inputMode="numeric"
                required
              />
            </div>
            <select
              className={`w-full p-3 rounded-xl border text-gray-900 text-base bg-white transition-all outline-none focus:ring-2 ${bairro ? 'border-green-300 focus:ring-green-200' : 'border-gray-200 focus:ring-blue-200'}`}
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
              className="w-full p-3 rounded-xl border border-gray-200 text-gray-900 text-base outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="Ponto de Referência (Opcional)"
              value={pontoReferencia}
              onChange={e => setPontoReferencia(e.target.value)}
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setIsRetirada(false)}
            className={`flex-1 p-3 rounded-xl font-bold transition-all ${!isRetirada ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            🚚 Entrega
          </button>
          <button
            onClick={() => setIsRetirada(true)}
            className={`flex-1 p-3 rounded-xl font-bold transition-all ${isRetirada ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            🏪 Retirada
          </button>
        </div>
      </div>
    </div>
  );
}