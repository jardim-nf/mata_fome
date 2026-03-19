// src/services/printService.js
import qz from 'qz-tray';

// Tenta conectar ao QZ Tray (que estará rodando no PC do lojista)
export const conectarQZ = async () => {
    if (!qz.websocket.isActive()) {
        try {
            await qz.websocket.connect();
            console.log("QZ Tray conectado com sucesso!");
        } catch (error) {
            console.error("Erro ao conectar ao QZ Tray. Ele está aberto no computador?", error);
            throw new Error("Não foi possível conectar ao QZ Tray. Verifique se o aplicativo está rodando.");
        }
    }
};

// Formata data e hora
const formatarData = (dataBase) => {
    if (!dataBase) return new Date().toLocaleString('pt-BR');
    const d = dataBase.toDate ? dataBase.toDate() : new Date(dataBase);
    return d.toLocaleString('pt-BR');
};

// Gera o layout da comanda em linguagem ESC/POS (Linguagem Universal de Impressora Térmica)
const gerarLayoutComanda = (pedido, itensDaComanda, tipoComanda) => {
    // Comandos ESC/POS
    const ESC = '\x1B';
    const GS = '\x1D';
    const INIT = ESC + '@'; // Inicializa impressora
    const BOLD_ON = ESC + 'E' + '\x01';
    const BOLD_OFF = ESC + 'E' + '\x00';
    const CENTER = ESC + 'a' + '\x01';
    const LEFT = ESC + 'a' + '\x00';
    const TEXT_DOUBLE = GS + '!' + '\x11'; // Altura e largura dupla
    const TEXT_NORMAL = GS + '!' + '\x00';
    const CUT = GS + 'V' + '\x41' + '\x03'; // Corta o papel
    const BEEP = ESC + 'B' + '\x03' + '\x02'; // Apita (se a impressora tiver buzzer)

    let data = [];
    data.push(INIT);

    // Cabeçalho
    data.push(CENTER);
    data.push(TEXT_DOUBLE + BOLD_ON);
    data.push(`*** ${tipoComanda.toUpperCase()} ***\n`);
    data.push(TEXT_NORMAL + BOLD_OFF);
    
    // 💡 SOLUÇÃO: Fallback seguro para ID do pedido
    const orderId = pedido.vendaId || pedido.id || '000000';
    const shortId = typeof orderId === 'string' ? orderId.slice(-6).toUpperCase() : '000000';
    data.push(`Pedido: #${shortId}\n`);
    data.push(`Data: ${formatarData(pedido.createdAt)}\n`);
    data.push("--------------------------------\n");

    // Cliente
    data.push(LEFT);
    // 💡 SOLUÇÃO: Verifica cliente, se não tiver assume que é MESA
    const nomeCliente = pedido.cliente?.nome || pedido.nome || 'Mesa ' + (pedido.mesaNumero || pedido.numero || '');
    data.push(BOLD_ON + `Cliente: ${nomeCliente}\n` + BOLD_OFF);
    
    if (tipoComanda === 'balcao') {
        const fone = pedido.cliente?.telefone || pedido.telefone;
        if (fone) data.push(`Telefone: ${fone}\n`);
        
        if (pedido.cliente?.endereco) {
            data.push(`End: ${pedido.cliente.endereco.rua || ''}, ${pedido.cliente.endereco.numero || ''}\n`);
            if (pedido.cliente.endereco.bairro) data.push(`Bairro: ${pedido.cliente.endereco.bairro}\n`);
        } else if (pedido.tipo) {
            data.push(`Tipo: ${String(pedido.tipo).toUpperCase()}\n`);
        } else {
            data.push(`Tipo: BALCAO / MESA\n`);
        }
    }
    data.push("--------------------------------\n");

    // ITENS
    data.push(CENTER + BOLD_ON + "ITENS DO PEDIDO\n" + BOLD_OFF + LEFT);
    
    itensDaComanda.forEach(item => {
        // 💡 SOLUÇÃO: Caça o nome e quantidade em todas as propriedades possíveis
        const nomeProduto = item.nome || item.produto?.nome || item.name || 'Produto sem nome';
        const qtd = Number(item.quantidade || item.qtd || 1) || 1;
        const preco = Number(item.preco || item.produto?.preco || 0) || 0;

        data.push(BOLD_ON + TEXT_DOUBLE + `${qtd}x ${nomeProduto}\n` + TEXT_NORMAL + BOLD_OFF);
        
        // Adicionais e Variações
        if (item.variacao?.nome) {
            data.push(`  => ${item.variacao.nome}\n`);
        }
        if (item.adicionais && Array.isArray(item.adicionais)) {
            item.adicionais.forEach(add => {
                data.push(`  + ${add.nome || 'Adicional'}\n`);
            });
        }
        if (item.observacao) {
            data.push(BOLD_ON + `  OBS: ${item.observacao}\n` + BOLD_OFF);
        }
        
        // No balcão mostra o preço
        if (tipoComanda === 'balcao') {
            data.push(`  Valor: R$ ${(preco * qtd).toFixed(2)}\n`);
        }
        data.push("\n"); // Pula linha entre itens
    });

    data.push("--------------------------------\n");

    // Resumo financeiro (Só no Balcão)
    if (tipoComanda === 'balcao') {
        // 💡 SOLUÇÃO: Previne o erro "NaN" (Not a Number)
        const total = Number(pedido.totalFinal || pedido.total || 0) || 0;
        const taxa = Number(pedido.taxaEntrega || 0) || 0;
        const subtotal = total - taxa;

        data.push(LEFT);
        data.push(`Subtotal: R$ ${subtotal.toFixed(2)}\n`);
        
        if (taxa > 0) {
            data.push(`Taxa Entrega: R$ ${taxa.toFixed(2)}\n`);
        }
        data.push(BOLD_ON + TEXT_DOUBLE + `TOTAL: R$ ${total.toFixed(2)}\n` + TEXT_NORMAL + BOLD_OFF);
        
        const formaPgt = pedido.formaPagamento || pedido.metodoPagamento;
        if (formaPgt) {
            data.push(`Pagamento: ${formaPgt}\n`);
        }
        
        const troco = Number(pedido.trocoPara || 0);
        if (troco > 0) {
            data.push(`Troco para: R$ ${troco.toFixed(2)}\n`);
        }
        data.push("--------------------------------\n");
    }

    data.push(CENTER);
    data.push("MataFome PDV - idea.food\n");
    data.push("\n\n\n\n"); // Espaço em branco pra a guilhotina não cortar o texto
    data.push(CUT);
    data.push(BEEP); // Apita no final

    return data;
};

// FUNÇÃO PRINCIPAL QUE ROTEIA E IMPRIME
export const rotearEImprimir = async (pedido, roteamentoConfig, nomeImpressoraBalcao, nomeImpressoraCozinha) => {
    try {
        await conectarQZ();

        let itensCozinha = [];
        let itensBalcao = [];

        // 💡 SOLUÇÃO: Busca itens até no carrinho se precisar
        const listaItens = pedido.itens || pedido.carrinho || pedido.produtos || [];
        const configRoteamento = roteamentoConfig || {};

        listaItens.forEach(item => {
            const categoriaId = item.categoriaId || item.produto?.categoriaId || 'default';
            // O fallback (se não configurou) é sempre balcão
            const destino = configRoteamento[categoriaId] || 'balcao'; 

            if (destino === 'cozinha') {
                itensCozinha.push(item);
            } else if (destino === 'balcao') {
                itensBalcao.push(item);
            } else if (destino === 'ambos') {
                itensCozinha.push(item);
                itensBalcao.push(item);
            }
        });

        // 💡 SOLUÇÃO: Se existir item, mas as regras de roteamento falharem, joga tudo pro balcão pra não perder a impressão.
        if (listaItens.length > 0 && itensCozinha.length === 0 && itensBalcao.length === 0) {
            itensBalcao = [...listaItens];
        }

        // Manda para a impressora da Cozinha
        if (itensCozinha.length > 0 && nomeImpressoraCozinha) {
            console.log("Enviando para cozinha...");
            const layoutCozinha = gerarLayoutComanda(pedido, itensCozinha, 'cozinha');
            await qz.print(qz.configs.create({ name: nomeImpressoraCozinha }), layoutCozinha);
        }

        // Manda para a impressora do Balcão
        if (itensBalcao.length > 0 && nomeImpressoraBalcao) {
            console.log("Enviando para balcão...");
            const layoutBalcao = gerarLayoutComanda(pedido, itensBalcao, 'balcao');
            await qz.print(qz.configs.create({ name: nomeImpressoraBalcao }), layoutBalcao);
        }

        return true;
    } catch (error) {
        console.error("Erro no processo de impressão:", error);
        throw error;
    }
};