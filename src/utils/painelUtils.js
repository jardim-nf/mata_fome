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
        
        const textoLimpo = ' ' + textoCompleto.replace(/[^a-záàâãéèêíïóôõöúçñ0-9]+/gi, ' ') + ' ';
        const matchTermos = (termos) => termos.some(termo => textoLimpo.includes(` ${termo.toLowerCase()} `));

        const categoriasBloqueadas = ['bebida', 'bomboniere', 'bar', 'sobremesa', 'doces', 'doce'];
        // Para categorias, verificamos também na string `categoria` limpa para ser mais preciso
        const categoriaLimpa = ' ' + categoria.replace(/[^a-záàâãéèêíïóôõöúçñ0-9]+/gi, ' ') + ' ';
        const temCategoriaBloqueada = categoriasBloqueadas.some(cat => categoriaLimpa.includes(` ${cat.toLowerCase()} `));
        if (temCategoriaBloqueada) return false;

        const palavrasBloqueadas = [
            'refrigerante', 'suco', 'cerveja', 'long neck', 'drink', 'vinho', 
            'coca', 'guarana', 'pepsi', 'sprite', 'h2oh', 'agua mineral', 'água mineral', 'agua', 'água',
            'sorvete', 'bala', 'chiclete', 'chocolate', 'pirulito', 'halls', 'mentos'
        ];
        
        const temNomeBloqueado = matchTermos(palavrasBloqueadas);
        if (temNomeBloqueado) return false;
        
        return true; 
    } catch (error) {
        return true; 
    }
};
