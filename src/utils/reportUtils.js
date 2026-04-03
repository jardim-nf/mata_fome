export const isPedidoCancelado = (p) => {
    if (!p) return false;
    const s1 = String(p.status || '').toLowerCase().trim();
    const s2 = String(p.fiscal?.status || '').toLowerCase().trim();
    const s3 = String(p.statusVenda || '').toLowerCase().trim();
    
    const termos = ['cancelad', 'recusad', 'excluid', 'estornad', 'devolvid', 'rejeitad', 'erro'];
    return termos.some(t => s1.includes(t) || s2.includes(t) || s3.includes(t));
};

export const fmtBRL = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

export const traduzirPagamento = (metodo) => {
    if (!metodo || metodo === 'N/A') return 'Não Informado';
    const mapa = {
        'credit_card': 'Cartão de Crédito',
        'debit_card': 'Cartão de Débito',
        'money': 'Dinheiro',
        'cash': 'Dinheiro',
        'pix': 'PIX',
        'wallet': 'Carteira Digital',
        'card': 'Cartão',
        'online': 'Online'
    };
    return mapa[metodo.toLowerCase()] || mapa[metodo] || metodo;
};

export const processarDado = (doc, origem) => {
    const data = doc.data();
    
    let dataRegistro = data.createdAt?.toDate?.() || 
                       data.criadoEm?.toDate?.() || 
                       data.dataFechamento?.toDate?.() || 
                       data.updatedAt?.toDate?.() || 
                       new Date();

    const parseVal = (v) => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
        return 0;
    };
    
    let total = parseVal(data.totalFinal) || parseVal(data.total) || parseVal(data.valorTotal) || 0;
    const itens = data.itens || data.produtos || [];
    const bairro = data.endereco?.bairro || data.bairro || data.address?.district || null;

    const isMesa = origem === 'mesa' || data.tipo === 'mesa' || data.source === 'salao' || !!data.mesaNumero;

    return {
        id: doc.id,
        ...data,
        data: dataRegistro,
        totalFinal: total || 0,
        tipo: isMesa ? 'mesa' : 'delivery',
        origem: isMesa ? 'mesa' : 'delivery',
        status: data.status || (isMesa ? 'finalizada' : 'recebido'),
        formaPagamento: data.formaPagamento || data.metodoPagamento || data.tipoPagamento || 'N/A',
        mesaNumero: data.mesaNumero || data.numeroMesa || null,
        loteHorario: data.loteHorario || '',
        itens: itens,
        clienteNome: data.clienteNome || data.cliente?.nome || (isMesa ? 'Mesa' : 'Cliente'),
        motoboyId: data.motoboyId || null,
        motoboyNome: data.motoboyNome || null,
        taxaEntrega: Number(data.taxaEntrega) || Number(data.deliveryFee) || 0,
        bairro: bairro
    };
};
