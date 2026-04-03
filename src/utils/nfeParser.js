/**
 * Faz o parse do XML da NFe e extrai os dados estruturados da nota e dos produtos.
 * @param {string} xmlText Conteúdo textual do arquivo XML
 * @param {number} margemPadrao Percentual de margem para o preço sugerido de venda
 * @returns {Object} Dados da Nota Lida
 */
export const parseNfeXml = (xmlText, margemPadrao = 50) => {
    const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
    
    // Validação básica
    if (!xmlDoc || xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("XML inválido ou corrompido");
    }

    const ide = xmlDoc.getElementsByTagName('ide')[0];
    const emit = xmlDoc.getElementsByTagName('emit')[0];
    const detList = xmlDoc.getElementsByTagName('det');

    if (!ide || !emit || !detList || detList.length === 0) {
        throw new Error("Estrutura da NFe não reconhecida");
    }

    const numeroNota = ide.getElementsByTagName('nNF')[0]?.textContent || '';
    const serie = ide.getElementsByTagName('serie')[0]?.textContent || '';
    const dataEmissao = ide.getElementsByTagName('dhEmi')[0]?.textContent || ide.getElementsByTagName('dEmi')[0]?.textContent || '';
    
    const cnpj = emit.getElementsByTagName('CNPJ')[0]?.textContent || '';
    const nomeFornecedor = emit.getElementsByTagName('xNome')[0]?.textContent || '';

    const produtos = [];

    for (let i = 0; i < detList.length; i++) {
        const prod = detList[i].getElementsByTagName('prod')[0];
        if (!prod) continue;

        const custo = parseFloat(prod.getElementsByTagName('vUnCom')[0]?.textContent || '0');
        
        produtos.push({
            item: i + 1,
            codigo: prod.getElementsByTagName('cProd')[0]?.textContent || '',
            ean: prod.getElementsByTagName('cEAN')[0]?.textContent || '',
            nome: prod.getElementsByTagName('xProd')[0]?.textContent || '',
            ncm: prod.getElementsByTagName('NCM')[0]?.textContent || '',
            qtd: parseFloat(prod.getElementsByTagName('qCom')[0]?.textContent || '0'),
            unidade: prod.getElementsByTagName('uCom')[0]?.textContent || 'UN',
            valorUnit: custo,
            valorTotal: parseFloat(prod.getElementsByTagName('vProd')[0]?.textContent || '0'),
            precoVendaSugerido: (custo * (1 + margemPadrao / 100)).toFixed(2),
            vinculoId: null, 
            vinculoNome: null, 
            vinculoPath: null, 
            vinculoCategoria: null,
        });
    }

    const totalNota = produtos.reduce((acc, p) => acc + p.valorTotal, 0);

    return {
        xmlDoc, // Guardamos o doc original caso as camadas superiores precisem
        numero: numeroNota,
        serie,
        dataEmissao,
        fornecedor: { nome: nomeFornecedor, cnpj },
        produtos,
        totalNota,
        detList // Referência dos nós XML
    };
};
