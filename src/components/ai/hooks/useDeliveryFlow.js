import { useState, useCallback } from 'react';

export function useDeliveryFlow({ clienteNome, enderecoAtual, taxaEntrega, onSetDeliveryMode, onUpdateAddress, onCheckout, onRequestLogin, onClose }) {
  const [conversationStep, setConversationStep] = useState('IDLE');
  const [localMessages, setLocalMessages] = useState([]);

  const addLocalMessage = (text, type = 'ai', delay = 600) => {
    setTimeout(() => {
      setLocalMessages(prev => [...prev, { id: Date.now() + Math.random(), type, text }]);
    }, delay);
  };

  const iniciarFluxoEntrega = useCallback(() => {
    if (!clienteNome) {
      addLocalMessage("Para finalizar, preciso que faça login. Clique em 'Entre aqui' na mensagem inicial.");
      if (onRequestLogin) onRequestLogin();
      return;
    }
    setConversationStep('ASKING_TYPE');
    addLocalMessage("Certo! Antes de finalizar: É para **Entrega** 🛵 ou **Retirada** 🛍️?", 'ai', 800);
  }, [clienteNome, onRequestLogin]);

  const processarFluxoEntrega = useCallback((texto, setMessage) => {
    setLocalMessages(prev => [...prev, { id: Date.now(), type: 'user', text: texto }]);
    setMessage('');

    const lower = texto.toLowerCase();

    if (conversationStep === 'ASKING_TYPE') {
      if (lower.includes('entrega') || lower.includes('casa') || lower.includes('lev')) {
        onSetDeliveryMode('entrega');
        if (enderecoAtual?.bairro && enderecoAtual?.rua) {
          addLocalMessage(`Endereço: ${enderecoAtual.rua}, ${enderecoAtual.bairro}. Confere? (Sim/Não)`);
          setConversationStep('CONFIRM_ADDRESS');
        } else {
          addLocalMessage('Ok, entrega! Qual é o seu **Bairro** e **Rua**?');
          setConversationStep('ASKING_ADDRESS');
        }
      } else if (lower.includes('retira') || lower.includes('busca') || lower.includes('aqui')) {
        onSetDeliveryMode('retirada');
        addLocalMessage('Perfeito, retirada no balcão. Abrindo pagamento...');
        setTimeout(() => { onCheckout(); onClose(); }, 2000);
        setConversationStep('IDLE');
      } else {
        addLocalMessage("Não entendi. Digite 'Entrega' ou 'Retirada'.");
      }
      return;
    }

    if (conversationStep === 'ASKING_ADDRESS') {
      onUpdateAddress({ bairro: texto, rua: texto });
      addLocalMessage('Anotei. Calculando taxa... Pode confirmar o pedido agora?');
      setConversationStep('CONFIRM_FINAL');
      return;
    }

    if (conversationStep === 'CONFIRM_ADDRESS' || conversationStep === 'CONFIRM_FINAL') {
      if (lower.includes('sim') || lower.includes('pode') || lower.includes('ok') || lower.includes('fech')) {
        addLocalMessage(`Fechado! Taxa de entrega: R$ ${taxaEntrega?.toFixed(2) || '0.00'}. Abrindo pagamento...`);
        setTimeout(() => { onCheckout(); onClose(); }, 2500);
        setConversationStep('IDLE');
      } else {
        addLocalMessage("Ok, o que deseja alterar? (Digite 'cancelar' para voltar ao cardápio)");
        setConversationStep('IDLE');
      }
    }
  }, [conversationStep, enderecoAtual, taxaEntrega, onSetDeliveryMode, onUpdateAddress, onCheckout, onClose]);

  return { conversationStep, localMessages, iniciarFluxoEntrega, processarFluxoEntrega };
}