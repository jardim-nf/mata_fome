// src/services/printService.js
import qz from 'qz-tray';

// --- CONFIGURAÇÃO DE SEGURANÇA DO QZ TRAY ---
// Certificado auto-assinado IdeaFood (gerado em 2026-05-22, válido por 10 anos)
// O mesmo certificado precisa estar em: C:\ProgramData\qz\ssl\override.crt
// E o qz-tray.properties precisa ter: authcert.override=C:\ProgramData\qz\ssl\override.crt
const qzCertificate = `-----BEGIN CERTIFICATE-----
MIIDTTCCAjWgAwIBAgIBATANBgkqhkiG9w0BAQsFADBqMRkwFwYDVQQDExBJZGVh
Rm9vZCBRWiBDZXJ0MQswCQYDVQQGEwJCUjELMAkGA1UECBMCQ0UxEjAQBgNVBAcT
CUZvcnRhbGV6YTERMA8GA1UEChMISWRlYUZvb2QxDDAKBgNVBAsTA1BEVjAeFw0y
NjA1MjIxMzM4MDBaFw0zNjA1MjIxMzM4MDBaMGoxGTAXBgNVBAMTEElkZWFGb29k
IFFaIENlcnQxCzAJBgNVBAYTAkJSMQswCQYDVQQIEwJDRTESMBAGA1UEBxMJRm9y
dGFsZXphMREwDwYDVQQKEwhJZGVhRm9vZDEMMAoGA1UECxMDUERWMIIBIjANBgkq
hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt+mNwGIR3deXjH+aGyOKL2T4stndsNCL
tM9QyJ83nphv6kbCaM8bVCztjahHXjJD2o9FAkdDWQFXqPbCC/NrO3BQJLPb9Z7w
KnF57pj87Ixx1D0jqHQrK7mBUrdXNDhdFxHGsOId5sDjwu4abTKqQ/k6OKL77Fz7
FZzGyEQsUZ1yIB23Q7Yg/RKi7SP7rG3O+ptqfNkaJojR0xNjqGSbdpplZfNaUhF6
X8hbFUw/e9KBbTnTc4KqGc0MaYCptsJtxvCTS/ERE6t72npGSdnLIobQBn5tjP6H
j5/NHZVr9vmFyDpBagZBqy4sCsLAFiekp16p6bldv68hjgUloJMolwIDAQABMA0G
CSqGSIb3DQEBCwUAA4IBAQCUUfN2PJL7YW9hXIlnTff6bwLg/YuTEJnbwWv5fDQs
HYx1pUvR4RO37+WGjkFoMvb8zcBLPESjbyug8eymH+M1/A9phlds8+gVp4tTcfWT
j6uvYTBSlwjoA7Ahv1ZAT5c+fUCDiirFi1jteftZhvLkvbYl18pfkNl1MB1GFn8Z
nsal2XGsmZFlRCgSJYsaxonbIb9gHDcPnAZyIFDw/9KfVRWfpjK+JZ7sqTx/gjE4
McO5IHGtptPZPQqS9epwsiUrFjpmcGq0euNxpKrurm8vuOLzLl9xyOCn2lGG3Swg
sdJ8I4ESlHVGPPMbORxlRqNFT+tgpFOJxOf19DXsxEFd
-----END CERTIFICATE-----`;

const qzPrivateKeyPem = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC36Y3AYhHd15eM
f5obI4ovZPiy2d2w0Iu0z1DInzeemG/qRsJozxtULO2NqEdeMkPaj0UCR0NZAVeo
9sIL82s7cFAks9v1nvAqcXnumPzsjHHUPSOodCsruYFSt1c0OF0XEcaw4h3mwOPC
7hptMqpD+To4ovvsXPsVnMbIRCxRnXIgHbdDtiD9EqLtI/usbc76m2p82RomiNHT
E2OoZJt2mmVl81pSEXpfyFsVTD970oFtOdNzgqoZzQxpgKm2wm3G8JNL8RETq3va
ekZJ2csihtAGfm2M/oePn80dlWv2+YXIOkFqBkGrLiwKwsAWJ6SnXqnpuV2/ryGO
BSWgkyiXAgMBAAECggEAHpG7oMFW/EDcTTDd31Tw9cpwFt+6cawNt2geTWU+9tBF
CfPpAfLVirr3tsFvMMEPdkIKKRl0oFQQy2JOBB6EhxoMDY231K6DzQo/nOE2aTs5
pcWOf8Q6Hh0fhILlA9EP6B2+9k0fcJOZ8soQ/8WZd42dl9G/fhzrvz6SlrHTjAe5
4JyN5q8zo0c72rxItTU/dThMpaDQHSlzL1ep9lDMP/sSWlXyL65X1MteorGQ/aOW
xdegxOfRtwqu4ePkFuRnOR88xGASkzqVytw7eo8N8udk1kpWif6QR8vRCdeoBlOZ
hKfkEUlufQOIkGCWkHIg5wqqKUpSxSwPAuWUORrWgQKBgQDsr50S0dXb62lzIV8d
h16IHDXmFvXOpMs8OsKukVUPTPLb5JA99uUHw6v+dO6gAUbh/VreaIho/IVTq6rb
7RQuLCsQTQ2bfc0LPcuysskhwRvVwfUTTmzSOjMILvlXXqPB9KQ7k7leN2gtfmV2
LbMO++69TvXm7pUtZXeYcQcrPwKBgQDG636b+J5JxgPzZm5eBATTsGdadX1C5/p9
YurnRa8Ka8kSjyrKgSNfTAIV+2sCk3FC15/iArEHDDGV+n7eJDmKrTtwvKjjnbTd
5yWfZnAH5qaEwaRPzWVJJOLRFQJPrQ5DmeXoawIhZ7GPCDuJDaoCTxsLB/OfkCRS
L3bCzE1kqQKBgBtGIVOJ2pr9Bam+rrc4YixNE+jvvGOTmdfW7ZgwJx0cQOAV9okt
ajb61Vb9IoJNo11nVJFMemuerb52ibnOGAU6EbxPJMJGPNqOxGpTL9oz5oE7WIJh
Bykyi67lutXWkghHqKU04Kd6uwaDCi4UFg4j+d7Wun9h/s68YouueqUBAoGBAMYk
k+RHXVy9KvhMAwoRVMGMyRa5S4HW05QMcVLX/ckSnqKnC4fV5OcrLjS5UNmrBrn/
URpvdelAQzBS6gba7JpvfnMI6e55DE2xzq8d+eBU52/793EqdobKgEimdbvp9Phv
lyzRUrj1sk94ct1NSBiutZBiZlF94kAfWVwm57ypAoGBAIOzishcJJS/0pUv9hL+
ujngcmSbM7YDYkvDCm5BZADZOr5YBHV9Gd3tYv5x9cjex3CGfnVQNQ9ammEuXw6G
Bw5dyxIPUvkbUpWiELwWK4n8uspngiSmea5sDpST2F/4irGXropD617BNT/EIYg7
LWs1hgAt4EdLPu45QIS8lq3G
-----END PRIVATE KEY-----`;

// Helper: converte PEM PKCS#8 para ArrayBuffer
function pemToArrayBuffer(pem) {
    const b64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s/g, '');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// Importa a chave privada uma vez via Web Crypto API
let cryptoKeyPromise = null;
function getCryptoKey() {
    if (!cryptoKeyPromise) {
        cryptoKeyPromise = crypto.subtle.importKey(
            'pkcs8',
            pemToArrayBuffer(qzPrivateKeyPem),
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
            false,
            ['sign']
        );
    }
    return cryptoKeyPromise;
}

qz.security.setCertificatePromise((resolve) => {
    resolve(qzCertificate);
});

qz.security.setSignatureAlgorithm("SHA512");

qz.security.setSignaturePromise((toSign) => {
    return function(resolve, reject) {
        (async () => {
            try {
                const key = await getCryptoKey();
                const data = new TextEncoder().encode(toSign);
                const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);
                // Converte ArrayBuffer para base64
                const bytes = new Uint8Array(signature);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                resolve(btoa(binary));
            } catch (err) {
                console.error('[QZ Tray] Erro na assinatura:', err);
                reject(err);
            }
        })();
    };
});
// ------------------------------------------

// Tenta conectar ao QZ Tray (que estará rodando no PC do lojista)
export const conectarQZ = async () => {
    if (!qz.websocket.isActive()) {
        try {
            await qz.websocket.connect();
            console.log("QZ Tray conectado com sucesso e com assinatura digital!");
        } catch (error) {
            console.error("Erro ao conectar ao QZ Tray. Ele está aberto no computador?", error);
            throw new Error("Não foi possível conectar ao QZ Tray. Verifique se o aplicativo está rodando.");
        }
    }
};

const removerAcentos = (texto) => {
    if (!texto) return '';
    return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
    data.push(`*** ${removerAcentos(tipoComanda).toUpperCase()} ***\n`);
    data.push(TEXT_NORMAL + BOLD_OFF);
    
    // Fallback seguro para ID do pedido
    const orderId = pedido.vendaId || pedido.id || '000000';
    const shortId = typeof orderId === 'string' ? orderId.slice(-6).toUpperCase() : '000000';
    data.push(`Pedido: #${shortId}\n`);
    data.push(`Data: ${formatarData(pedido.createdAt || pedido.dataPedido || pedido.criadoEm || pedido.updatedAt)}\n`);
    data.push("--------------------------------\n");

    // Cliente
    data.push(LEFT);
    const isDelivery = pedido.source !== 'salao' && pedido.tipo !== 'mesa' && !pedido.mesaNumero;
    const nomeCliente = pedido.cliente?.nome || pedido.nome || 'Mesa ' + (pedido.mesaNumero || pedido.numero || '');
    
    if (isDelivery) {
        data.push(TEXT_DOUBLE + BOLD_ON + `DELIVERY\n` + TEXT_NORMAL + BOLD_OFF);
    }
    
    data.push(BOLD_ON + `Cliente: ${removerAcentos(nomeCliente)}\n` + BOLD_OFF);
    
    if (tipoComanda === 'balcao' || isDelivery) {
        const fone = pedido.cliente?.telefone || pedido.telefone;
        if (fone) data.push(`Telefone: ${fone}\n`);
        
        if (pedido.cliente?.endereco) {
            data.push(`End: ${removerAcentos(pedido.cliente.endereco.rua || '')}, ${pedido.cliente.endereco.numero || ''}\n`);
            if (pedido.cliente.endereco.bairro) data.push(`Bairro: ${removerAcentos(pedido.cliente.endereco.bairro)}\n`);
            if (pedido.cliente.endereco.complemento) data.push(`Comp: ${removerAcentos(pedido.cliente.endereco.complemento)}\n`);
            if (pedido.cliente.endereco.referencia) data.push(`Ref: ${removerAcentos(pedido.cliente.endereco.referencia)}\n`);
        } else if (pedido.tipo && !isDelivery) {
            data.push(`Tipo: ${removerAcentos(String(pedido.tipo)).toUpperCase()}\n`);
        }
    }
    data.push("--------------------------------\n");

    // ITENS
    data.push(CENTER + BOLD_ON + "ITENS DO PEDIDO\n" + BOLD_OFF + LEFT);
    
    itensDaComanda.forEach(item => {
        // Ignora itens cancelados
        if (item.status === 'cancelado') return;

        const nomeProduto = item.nome || item.produto?.nome || item.name || 'Produto sem nome';
        const qtd = Number(item.quantidade || item.qtd || 1) || 1;
        const preco = Number(item.preco || item.produto?.preco || 0) || 0;

        data.push(BOLD_ON + TEXT_DOUBLE + `${qtd}x ${removerAcentos(nomeProduto)}\n` + TEXT_NORMAL + BOLD_OFF);
        
        // Variações
        if (item.variacaoSelecionada?.nome || item.variacao?.nome) {
            const varNome = item.variacaoSelecionada?.nome || item.variacao?.nome;
            data.push(`  => ${removerAcentos(varNome)}\n`);
        }
        
        // 🔥 CORREÇÃO: Lê a variável correta dos complementos (adicionaisSelecionados) 🔥
        const complementos = item.adicionaisSelecionados || item.adicionais || [];
        if (Array.isArray(complementos) && complementos.length > 0) {
            complementos.forEach(add => {
                data.push(BOLD_ON + `  + ${removerAcentos(add.nome || 'Adicional')}\n` + BOLD_OFF);
            });
        }

        if (item.observacao) {
            data.push(BOLD_ON + `  OBS: ${removerAcentos(item.observacao)}\n` + BOLD_OFF);
        }
        
        // No balcão mostra o preço
        if (tipoComanda === 'balcao' || isDelivery) {
            data.push(`  Valor: R$ ${(preco * qtd).toFixed(2)}\n`);
        }
        data.push("\n"); // Pula linha entre itens
    });

    data.push("--------------------------------\n");

    // Resumo financeiro (Balcão e Delivery)
    if (tipoComanda === 'balcao' || isDelivery) {
        const total = Number(pedido.totalFinal || pedido.total || 0) || 0;
        const taxa = Number(pedido.taxaEntrega || 0) || 0;
        const desconto = Number(pedido.valorDesconto || 0) || 0;
        
        let subtotal = total - taxa + desconto;
        // Previne valores negativos se o cálculo base estiver estranho
        if (subtotal < 0) subtotal = total; 

        data.push(LEFT);
        data.push(`Subtotal: R$ ${subtotal.toFixed(2)}\n`);
        
        if (taxa > 0) {
            data.push(`Taxa Entrega: R$ ${taxa.toFixed(2)}\n`);
        }
        if (desconto > 0) {
            data.push(`Desconto: - R$ ${desconto.toFixed(2)}\n`);
        }

        data.push(BOLD_ON + TEXT_DOUBLE + `TOTAL: R$ ${total.toFixed(2)}\n` + TEXT_NORMAL + BOLD_OFF);
        
        const formaPgt = pedido.formaPagamento || pedido.metodoPagamento || pedido.tipoPagamento;
        if (formaPgt) {
            data.push(`Pagamento: ${removerAcentos(formaPgt).toUpperCase()}\n`);
        }
        
        const troco = Number(pedido.trocoPara || 0);
        if (troco > 0) {
            data.push(`Troco para: R$ ${troco.toFixed(2)}\n`);
            data.push(BOLD_ON + `Levar Troco: R$ ${(troco - total).toFixed(2)}\n` + BOLD_OFF);
        }
        data.push("--------------------------------\n");
    }

    data.push(CENTER);
    data.push("IdeaFood PDV\n");
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

        const listaItens = pedido.itens || pedido.carrinho || pedido.produtos || [];
        const configRoteamento = roteamentoConfig || {};

        // Identifica se é delivery para imprimir tudo na impressora principal
        const isDelivery = pedido.source !== 'salao' && pedido.tipo !== 'mesa' && !pedido.mesaNumero;

        listaItens.forEach(item => {
            // Ignora itens cancelados do roteamento
            if (item.status === 'cancelado') return;

            const categoriaId = item.categoriaId || item.produto?.categoriaId || 'default';
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

        // Se for delivery, joga TUDO pro balcão de qualquer jeito (pra sair a via completa do motoboy)
        if (isDelivery && listaItens.length > 0) {
            itensBalcao = listaItens.filter(i => i.status !== 'cancelado');
        } else if (listaItens.length > 0 && itensCozinha.length === 0 && itensBalcao.length === 0) {
            itensBalcao = listaItens.filter(i => i.status !== 'cancelado');
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
