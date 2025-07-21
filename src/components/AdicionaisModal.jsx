// src/components/AdicionaisModal.jsx

import React, { useState, useMemo } from 'react';

function AdicionaisModal({ item, onConfirm, onClose }) {
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState([]);

  // Calcula o preço total em tempo real, somando o preço base do item
  // com os preços de todos os adicionais selecionados.
  const precoTotal = useMemo(() => {
    const precoDosAdicionais = adicionaisSelecionados.reduce((total, ad) => total + ad.preco, 0);
    return item.preco + precoDosAdicionais;
  }, [item.preco, adicionaisSelecionados]);

  // Função para lidar com a seleção de um adicional (quando o checkbox é marcado/desmarcado)
  const handleAdicionalChange = (adicional, isChecked) => {
    if (isChecked) {
      // Se marcou, adiciona o opcional à lista de selecionados
      setAdicionaisSelecionados([...adicionaisSelecionados, adicional]);
    } else {
      // Se desmarcou, remove o opcional da lista
      setAdicionaisSelecionados(adicionaisSelecionados.filter(ad => ad.id !== adicional.id));
    }
  };

  // Função chamada ao clicar no botão principal do modal
  const handleConfirmarPedido = () => {
    // Cria um novo objeto de item, combinando o item original com as escolhas do usuário
    const itemConfigurado = {
      ...item,
      adicionais: adicionaisSelecionados, // Salva os adicionais escolhidos
      precoFinal: precoTotal, // Salva o preço final já calculado
    };
    // Chama a função onConfirm (que estará no Menu.jsx) para adicionar ao carrinho
    onConfirm(itemConfigurado);
  };

  return (
    // Fundo escuro semi-transparente que cobre a tela inteira
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[2000]">
      {/* O container branco do modal */}
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full relative animate-fade-in-up">
        {/* Botão de Fechar no canto superior direito */}
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

        {/* Lista de Adicionais */}
        <h3 className="text-lg font-semibold text-[var(--marrom-escuro)] mb-3 border-t pt-4">Monte seu lanche:</h3>
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {/* Verifica se existem adicionais antes de tentar mapeá-los */}
          {item.adicionais && item.adicionais.map((adicional) => (
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