export const TERMOS_BEBIDA = [
    'bebida', 'bebidas', 'refrigerante', 'refri', 'suco', 'cerveja', 'agua', 'água',
    'drink', 'vinho', 'dose', 'long neck', 'lata', 'latao', 'latão', 'garrafa', 'h2oh', 'coca', 'guarana',
    'pepsi', 'fanta', 'sprite', 'schweppes', 'chopp', 'chope', 'energetico', 'ice',
    'skol', 'brahma', 'heineken', 'amstel', 'corona', 'budweiser', 'antarctica', 'kuat', 'smirnoff'
];

export const TERMOS_BOMBONIERE = [
    'bomboniere', 'doce', 'sobremesa', 'chiclete', 'bala', 'chocolate', 'halls', 'mentos', 'sorvete', 'picole', 'picolé'
];

export const removeAcentos = (str) => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const matchTermos = (texto, termos) => {
    const textoNormalizado = removeAcentos(String(texto || '')).toLowerCase();
    // Substitui tudo que não for letra minúscula ou número por espaço
    const textoLimpo = ' ' + textoNormalizado.replace(/[^a-z0-9]+/g, ' ') + ' ';
    
    return termos.some(termo => {
        const termoNormalizado = removeAcentos(termo).toLowerCase();
        return textoLimpo.includes(` ${termoNormalizado} `) || 
               textoLimpo.includes(` ${termoNormalizado}s `);
    });
};

export const getSetorItemInfo = (categoria, nome) => {
    const textoCompleto = `${nome || ''} ${categoria || ''}`;
    const isBebida = matchTermos(textoCompleto, TERMOS_BEBIDA);
    
    return isBebida 
        ? { id: 'bar', nome: 'Bar', icon: '🍺', corTexto: 'text-blue-600', corBg: 'bg-blue-50', border: 'border-blue-200' }
        : { id: 'cozinha', nome: 'Cozinha', icon: '🍳', corTexto: 'text-orange-600', corBg: 'bg-orange-50', border: 'border-orange-200' };
};
