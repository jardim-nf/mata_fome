import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export const estoqueService = {
  /**
   * Solicita a baixa de estoque ao backend.
   * A lógica de ficha técnica e concorrência agora roda em uma Cloud Function de forma segura.
   */
  async darBaixaEstoque(estabelecimentoId, itens) {
    console.log('🚨🚨🚨 [estoqueService] darBaixaEstoque CHAMADO!', { estabelecimentoId, qtdItens: itens?.length });
    
    if (!estabelecimentoId || !itens || itens.length === 0) {
      console.log('⚠️ [estoqueService] Ignorando baixa (sem estabelecimento ou sem itens)');
      return { success: true };
    }

    try {
      const processarBaixaEstoque = httpsCallable(functions, 'processarBaixaEstoque');
      const result = await processarBaixaEstoque({ estabelecimentoId, itens });
      
      console.log('📦 Baixa de estoque delegada ao servidor com sucesso!', result.data);
      return { success: true, alertas: result.data?.alertas || [] };
    } catch (error) {
      console.error('❌ Erro ao processar baixa de estoque no servidor:', error);
      return { success: false, error, alertas: [] };
    }
  }
};