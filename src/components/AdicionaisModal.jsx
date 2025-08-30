// src/components/AdicionaisModal.jsx

import React, { useState, useMemo } from 'react';

function AdicionaisModal({ item, onConfirm, onClose }) {
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState([]);
  // NOVO ESTADO: para controlar os ingredientes que o cliente quer manter
  const [ingredientesAtuais, setIngredientesAtuais] = useState(item.ingredientes || []);
  // NOVO ESTADO: para guardar a observação do cliente
  const [observacao, setObservacao] = useState('');

  // Calcula o preço total em tempo real
  const precoTotal = useMemo(() => {
    const precoDosAdicionais = adicionaisSelecionados.reduce((total, ad) => total + ad.preco, 0);
    return item.preco + precoDosAdicionais;
  }, [item.preco, adicionaisSelecionados]);

  // Função para lidar com a seleção de um adicional
  const handleAdicionalChange = (adicional, isChecked) => {
    if (isChecked) {
      setAdicionaisSelecionados([...adicionaisSelecionados, adicional]);
    } else {
      setAdicionaisSelecionados(adicionaisSelecionados.filter(ad => ad.id !== adicional.id));
    }
  };

  // NOVA FUNÇÃO: Lida com a desmarcação de ingredientes
  const handleIngredienteChange = (ingrediente, isChecked) => {
    if (isChecked) {
        // Se marcou, adiciona o ingrediente de volta à lista
        setIngredientesAtuais([...ingredientesAtuais, ingrediente]);
    } else {
        // Se desmarcou, remove o ingrediente da lista
        setIngredientesAtuais(ingredientesAtuais.filter(ing => ing !== ingrediente));
    }
  };

  // Função chamada ao clicar no botão principal do modal
  const handleConfirmarPedido = () => {
    // Calcula quais ingredientes foram removidos pelo cliente
    const ingredientesOriginais = item.ingredientes || [];
    const ingredientesRemovidos = ingredientesOriginais.filter(ing => !ingredientesAtuais.includes(ing));

    // Cria um novo objeto de item, combinando o item original com as escolhas do usuário
    const itemConfigurado = {
      ...item,
      adicionais: adicionaisSelecionados,
      removidos: ingredientesRemovidos,   // Salva a lista de ingredientes removidos
      observacao: observacao.trim(),      // Salva a observação (removendo espaços em branco)
      precoFinal: precoTotal,
    };
    // Chama a função onConfirm (que estará no Menu.jsx) para adicionar ao carrinho
    onConfirm(itemConfigurado);
  };

  // Variáveis para verificar se as seções devem ser exibidas
  const temIngredientes = Array.isArray(item.ingredientes) && item.ingredientes.length > 0;
  const temAdicionais = Array.isArray(item.adicionais) && item.adicionais.length > 0;

  return (
    // Fundo escuro semi-transparente que cobre a tela inteira
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[2000]">
      {/* O container branco do modal */}
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full relative animate-fade-in-up max-h-[90vh] flex flex-col">
        {/* Botão de Fechar */}
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-500 hover:text-red-600 text-2xl"
          aria-label="Fechar modal"
        >
          &times;
        </button>

        {/* Detalhes do Produto Principal */}
        <h2 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-2">{item.nome}</h2>
        <p className="text-gray-600 mb-4">{item.descricao}</p>

        {/* Conteúdo rolável */}
        <div className="space-y-4 overflow-y-auto pr-2">
            
            {/* SEÇÃO PARA REMOVER INGREDIENTES */}
            {temIngredientes && (
                <div>
                    <h3 className="text-lg font-semibold text-[var(--marrom-escuro)] mb-3 border-t pt-4">Ingredientes (desmarque para remover):</h3>
                    <div className="space-y-2">
                        {item.ingredientes.map((ingrediente, index) => (
                            <label key={index} className="flex items-center bg-gray-50 p-3 rounded-md cursor-pointer hover:bg-gray-100">
                                <span className="font-medium text-gray-800 flex-grow">{ingrediente}</span>
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded border-gray-400 text-red-600 focus:ring-red-500"
                                    checked={ingredientesAtuais.includes(ingrediente)}
                                    onChange={(e) => handleIngredienteChange(ingrediente, e.target.checked)}
                                />
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* SEÇÃO PARA OBSERVAÇÕES */}
            <div>
                <h3 className="text-lg font-semibold text-[var(--marrom-escuro)] mb-3 border-t pt-4">Observações:</h3>
                <textarea
                    className="w-full border border-gray-300 rounded-md p-2 text-gray-700 focus:ring-2 focus:ring-[var(--vermelho-principal)]"
                    rows="3"
                    placeholder="Ex: Ponto da carne mal passado, sem picles, capricha no molho..."
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                />
            </div>

            {/* SEÇÃO PARA ADICIONAR EXTRAS */}
            {temAdicionais && (
                <div>
                    <h3 className="text-lg font-semibold text-[var(--marrom-escuro)] mb-3 border-t pt-4">Adicionar Extras:</h3>
                    <div className="space-y-3">
                        {item.adicionais.map((adicional) => (
                        <label key={adicional.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
                            <div>
                                <span className="font-medium text-gray-800">{adicional.nome}</span>
                                <span className="text-green-600 font-semibold ml-2">
                                    + R$ {adicional.preco.toFixed(2).replace('.', ',')}
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]"
                                onChange={(e) => handleAdicionalChange(adicional, e.target.checked)}
                            />
                        </label>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Rodapé com Total e Botão de Confirmação */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center text-xl font-bold mb-4">
            <span className="text-[var(--marrom-escuro)]">Total do Item:</span>
            <span className="text-[var(--vermelho-principal)]">R$ {precoTotal.toFixed(2).replace('.', ',')}</span>
          </div>
          <button
            onClick={handleConfirmarPedido}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors shadow-lg"
          >
            Adicionar ao Pedido
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdicionaisModal;