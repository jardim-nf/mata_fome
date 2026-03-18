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
    data.push(`Pedido: #${pedido.vendaId.substring(pedido.vendaId.length - 6)}\n`);
    data.push(`Data: ${formatarData(pedido.createdAt)}\n`);
    data.push("--------------------------------\n");

    // Cliente (Na cozinha normalmente só vai o nome)
    data.push(LEFT);
    data.push(BOLD_ON + `Cliente: ${pedido.cliente?.nome || 'N/A'}\n` + BOLD_OFF);
    if (tipoComanda === 'balcao') {
        data.push(`Telefone: ${pedido.cliente?.telefone || 'N/A'}\n`);
        if (pedido.cliente?.endereco) {
            data.push(`End: ${pedido.cliente.endereco.rua}, ${pedido.cliente.endereco.numero}\n`);
            data.push(`Bairro: ${pedido.cliente.endereco.bairro}\n`);
        } else {
            data.push(`Tipo: RETIRADA/MESA\n`);
        }
    }
    data.push("--------------------------------\n");

    // ITENS
    data.push(CENTER + BOLD_ON + "ITENS DO PEDIDO\n" + BOLD_OFF + LEFT);
    
    itensDaComanda.forEach(item => {
        data.push(BOLD_ON + TEXT_DOUBLE + `${item.quantidade}x ${item.nome}\n` + TEXT_NORMAL + BOLD_OFF);
        
        // Adicionais e Variações
        if (item.variacao?.nome) {
            data.push(`  => ${item.variacao.nome}\n`);
        }
        if (item.adicionais && item.adicionais.length > 0) {
            item.adicionais.forEach(add => {
                data.push(`  + ${add.nome}\n`);
            });
        }
        if (item.observacao) {
            data.push(BOLD_ON + `  OBS: ${item.observacao}\n` + BOLD_OFF);
        }
        
        // No balcão mostra o preço
        if (tipoComanda === 'balcao') {
            data.push(`  Valor: R$ ${(item.preco * item.quantidade).toFixed(2)}\n`);
        }
        data.push("\n"); // Pula linha entre itens
    });

    data.push("--------------------------------\n");

    // Resumo financeiro (Só no Balcão)
    if (tipoComanda === 'balcao') {
        data.push(LEFT);
        data.push(`Subtotal: R$ ${(pedido.totalFinal - (pedido.taxaEntrega || 0)).toFixed(2)}\n`);
        data.push(`Taxa Entrega: R$ ${(pedido.taxaEntrega || 0).toFixed(2)}\n`);
        data.push(BOLD_ON + TEXT_DOUBLE + `TOTAL: R$ ${pedido.totalFinal.toFixed(2)}\n` + TEXT_NORMAL + BOLD_OFF);
        data.push(`Pagamento: ${pedido.formaPagamento}\n`);
        if (pedido.trocoPara > 0) {
            data.push(`Troco para: R$ ${pedido.trocoPara.toFixed(2)}\n`);
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

        // 1. Separa os itens usando a configuração de roteamento que salvamos no banco
        let itensCozinha = [];
        let itensBalcao = [];

        pedido.itens.forEach(item => {
            // O fallback (se não configurou) é sempre balcão
            const destino = roteamentoConfig[item.categoriaId] || 'balcao'; 

            if (destino === 'cozinha') {
                itensCozinha.push(item);
            } else if (destino === 'balcao') {
                itensBalcao.push(item);
            } else if (destino === 'ambos') {
                itensCozinha.push(item);
                itensBalcao.push(item);
            }
            // se for 'nenhum', a gente só ignora o item
        });

        // 2. Manda para a impressora da Cozinha (Se tiver itens e tiver impressora configurada)
        if (itensCozinha.length > 0 && nomeImpressoraCozinha) {
            console.log("Enviando para cozinha...");
            const layoutCozinha = gerarLayoutComanda(pedido, itensCozinha, 'cozinha');
            const printerCozinha = { name: nomeImpressoraCozinha };
            await qz.print(qz.configs.create(printerCozinha), layoutCozinha);
        }

        // 3. Manda para a impressora do Balcão (Se tiver itens e tiver impressora configurada)
        if (itensBalcao.length > 0 && nomeImpressoraBalcao) {
            console.log("Enviando para balcão...");
            const layoutBalcao = gerarLayoutComanda(pedido, itensBalcao, 'balcao');
            const printerBalcao = { name: nomeImpressoraBalcao };
            await qz.print(qz.configs.create(printerBalcao), layoutBalcao);
        }

        return true;
    } catch (error) {
        console.error("Erro no processo de impressão:", error);
        throw error;
    }
};