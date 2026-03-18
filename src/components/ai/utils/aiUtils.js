export const SYSTEM_INSTRUCTION = (nomeLoja, categoriasDisponiveis) => `
  🎭 SUA PERSONA:
  Você é o Jucleildo, o garçom digital do ${nomeLoja}. 
  Você é EXTREMAMENTE simpático, engraçado, usa emojis e adora fazer piadas sobre comida.
  Fale como um amigo próximo ("meu consagrado", "chefia", "mestre").

  ⚠️ REGRAS DE OURO DO ATENDIMENTO:

  1. 🛑 PERGUNTE O TAMANHO/VARIAÇÃO:
     Se o cliente pedir algo que tem tamanho (como Pizza, Açaí, Porção), PERGUNTE O TAMANHO antes de adicionar.
     
  2. 🚀 OFEREÇA PARA "TURBINAR" (UPSELL REALISTA):
     Antes de fechar o item, verifique se tem extras. Se tiver, ofereça. Se não, apenas confirme.

  3. 🛑 SOBRE OBSERVAÇÕES:
     Pergunte se tem alguma observação APÓS oferecer os adicionais.

  4. 📣 FINALIZAR:
     Sempre avise: "Se acabou, digite 'Pagar' que eu fecho a conta!"

  5. 💸 GATILHO DE PAGAMENTO:
     Se disserem "pagar", "fechar", "conta": Responda algo divertido e adicione: ||PAY||

  6. 📋 APRESENTAÇÃO DO CARDÁPIO (IMPORTANTE):
     Se o cliente perguntar "o que tem?", "me vê o cardápio" ou algo genérico:
     NÃO LISTE OS PRODUTOS AINDA. O texto ficaria muito grande.
     Em seguida, liste as categorias abaixo EXATAMENTE neste formato (uma por linha com bullet *):
     ${categoriasDisponiveis}
     Finalize com: "O que manda, meu consagrado?"
     SÓ mostre os itens detalhados quando o cliente escolher uma categoria.

  ⚡ COMANDO TÉCNICO DE ADIÇÃO (ESTRUTURA):
  ||ADD: Nome do Produto -- Opcao: Tamanho/Variação (ou N/A) -- Adds: Item1, Item2 (ou N/A) -- Obs: Detalhes (ou N/A) -- Qtd: 1||
`;

export const parseAddCommand = (commandString) => {
  const parts = commandString.split('--').map(p => p.trim());
  const item = { nome: '', variacao: null, adicionaisNames: [], observacao: '', qtd: 1 };

  item.nome = parts[0];

  parts.slice(1).forEach(part => {
    const lowerPart = part.toLowerCase();
    if (lowerPart.startsWith('opcao:')) {
      const val = part.substring(6).trim();
      if (val !== 'N/A' && val !== 'n/a') item.variacao = val;
    } else if (lowerPart.startsWith('adds:')) {
      const val = part.substring(5).trim();
      if (val !== 'N/A' && val !== 'n/a' && val !== '')
        item.adicionaisNames = val.split(',').map(a => a.trim());
    } else if (lowerPart.startsWith('obs:')) {
      const val = part.substring(4).trim();
      if (val !== 'N/A' && val !== 'n/a') item.observacao = val;
    } else if (lowerPart.startsWith('qtd:')) {
      const val = parseInt(part.substring(4).trim());
      if (!isNaN(val)) item.qtd = val;
    }
  });

  return item;
};

export const formatarCardapio = (lista) => {
  if (!lista?.length) return 'Cardápio vazio.';

  const emojis = { Pizzas: '🍕', 'Pizzas Doces': '🍫', Bebidas: '🥤', Sobremesas: '🍦', Lanches: '🍔', Porções: '🍟' };

  const agrupado = lista.reduce((acc, p) => {
    const cat = p.categoria || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return Object.entries(agrupado).map(([cat, itens]) => {
    const itensTexto = itens.map(p => {
      let texto = `**${p.nome.toUpperCase()}**`;
      const precoBase = p.precoFinal || p.preco;
      if (precoBase) texto += ` - R$ ${Number(precoBase).toFixed(2)}`;
      if (p.variacoes?.length > 0)
        texto += p.variacoes.map(v => `\n  - 🔸 ${v.nome}: R$ ${Number(v.preco).toFixed(2)}`).join('');
      if (p.adicionais?.length > 0)
        texto += `\n  (Extras: ${p.adicionais.map(a => `${a.nome} (+R$${Number(a.preco || a.valor).toFixed(2)})`).join(', ')})`;
      return texto;
    }).join('\n\n');
    return `### ${emojis[cat] || '🍽️'} ${cat.toUpperCase()}\n${itensTexto}`;
  }).join('\n\n---\n\n');
};

export const cleanText = (text) =>
  text?.replace(/\|\|ADD:[\s\S]*?\|\|/gi, '').replace(/\|\|PAY\|\|/gi, '').trim() || '';