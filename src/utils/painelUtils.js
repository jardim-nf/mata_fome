import { matchTermos, TERMOS_BEBIDA, TERMOS_BOMBONIERE } from './categoriaUtils';

/**
 * Filtra itens do pedido, verificando se devem ir para a tela de KDS / Cozinha.
 * Itens que são combos sempre vão para a cozinha. 
 * Bebidas e bomboniere normalmente são bloqueados.
 * 
 * @param {Object} item - Objeto do item do pedido
 * @returns {boolean} - true se deve ser mostrado na cozinha, false caso contrário
 */
export const isItemCozinha = (item) => {
    try {
        if (!item || typeof item !== 'object') return false;
        
        const nome = String(item.nome || item.produto?.nome || '').toLowerCase();
        // 🔥 Verifica tanto 'categoria' quanto 'categoriaId' (campo salvo pelo delivery)
        const categoria = String(
            item.categoria || item.categoriaId || item.produto?.categoria || ''
        ).toLowerCase();
        const textoCompleto = `${nome} ${categoria}`;
        
        // 🔥 LÓGICA ATUALIZADA: Regra de exceção para COMBOS 🔥
        // Se a categoria for combo ou o nome tiver combo, VAI PRA COZINHA SEMPRE!
        if (categoria.includes('combo') || nome.includes('combo')) {
            return true;
        }
        
        // Usa a central de categorias para ser 100% igual ao resto do sistema
        const isBebida = matchTermos(textoCompleto, TERMOS_BEBIDA);
        const isBomboniere = matchTermos(textoCompleto, TERMOS_BOMBONIERE);

        if (isBebida || isBomboniere) {
            return false;
        }
        
        return true; 
    } catch (error) {
        return true; 
    }
};
