import React, { useState } from 'react';

function VariacoesModal({ item, onConfirm, onClose }) {
  const [variacaoSelecionada, setVariacaoSelecionada] = useState(null);
  const [observacao, setObservacao] = useState('');

  const variacoes = item.variacoes && item.variacoes.length > 0 
    ? item.variacoes 
    : [
        {
          nome: 'Padrão',
          preco: item.preco,
          descricao: item.descricao || 'Versão padrão do produto'
        }
      ];

  const handleConfirmar = () => {
    if (!variacaoSelecionada && variacoes.length > 0) {
      setVariacaoSelecionada(variacoes[0]);
      return;
    }

    const itemConfigurado = {
      ...item,
      variacaoSelecionada: variacaoSelecionada || variacoes[0],
      precoSelecionado: variacaoSelecionada ? variacaoSelecionada.preco : variacoes[0].preco,
      precoFinal: variacaoSelecionada ? variacaoSelecionada.preco : variacoes[0].preco,
      observacao: observacao.trim() || null,
      nome: `${item.nome}${variacaoSelecionada ? ` - ${variacaoSelecionada.nome}` : ''}`
    };

    onConfirm(itemConfigurado);
  };

  const precoTotal = variacaoSelecionada ? variacaoSelecionada.preco : (variacoes[0]?.preco || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full max-h-[85vh] overflow-hidden">
        {/* Header Compacto */}
        <div className="bg-amber-500 p-4 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold">Escolha a opção</h2>
              <h3 className="text-md font-semibold">{item.nome}</h3>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:text-amber-100 text-xl font-bold"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Descrição Compacta */}
        <div className="p-3 border-b border-amber-100">
          <p className="text-amber-700 text-sm leading-tight">
            {item.descricao || 'Delicioso produto preparado com ingredientes selecionados.'}
          </p>
        </div>

        {/* Opções Compactas */}
        <div className="p-3 border-b border-amber-100 max-h-[40vh] overflow-y-auto">
          <h3 className="text-sm font-bold text-amber-800 mb-2">
            Selecione uma opção:
          </h3>
          
          <div className="space-y-2">
            {variacoes.map((variacao, index) => (
              <div
                key={index}
                onClick={() => setVariacaoSelecionada(variacao)}
                className={`p-3 border rounded-lg cursor-pointer transition-all duration-150 ${
                  variacaoSelecionada?.nome === variacao.nome
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-amber-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">{variacao.nome}</h4>
                    {variacao.descricao && (
                      <p className="text-xs text-gray-600 mt-1">{variacao.descricao}</p>
                    )}
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-md font-bold text-amber-600">
                      R$ {variacao.preco.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Observações Compactas */}
        <div className="p-3 border-b border-amber-100">
          <h3 className="text-sm font-bold text-amber-800 mb-2">
            Observações
          </h3>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex: Sem cebola, ponto da carne, etc."
            className="w-full border border-amber-300 rounded-lg p-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-transparent bg-amber-50 resize-none"
            rows="2"
          />
        </div>

        {/* Footer Compacto */}
        <div className="p-3 bg-gray-50">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-gray-700">Total:</span>
            <span className="text-lg font-bold text-amber-600">
              R$ {precoTotal.toFixed(2).replace('.', ',')}
            </span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-400 text-white py-2 rounded-lg font-semibold text-sm hover:bg-gray-500 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={!variacoes.length}
              className="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-600 disabled:bg-gray-300 transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VariacoesModal;