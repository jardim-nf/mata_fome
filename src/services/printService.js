// src/services/printService.js
import qz from 'qz-tray';
import { KEYUTIL, KJUR } from 'jsrsasign';

// --- CONFIGURAÇÃO DE SEGURANÇA DO QZ TRAY ---
// Certificado e Chave gerados para bypass local (auto-assinado)
const qzCertificate = `-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgIBATANBgkqhkiG9w0BAQUFADBkMRIwEAYDVQQDEwlsb2Nh
bGhvc3QxCzAJBgNVBAYTAkJSMQswCQYDVQQIEwJDRTESMBAGA1UEBxMJRm9ydGFs
ZXphMREwDwYDVQQKEwhJZGVhRm9vZDENMAsGA1UECxMEVGVzdDAeFw0yNjA1MTQx
MTU4NDlaFw0zNjA1MTQxMTU4NDlaMGQxEjAQBgNVBAMTCWxvY2FsaG9zdDELMAkG
A1UEBhMCQlIxCzAJBgNVBAgTAkNFMRIwEAYDVQQHEwlGb3J0YWxlemExETAPBgNV
BAoTCElkZWFGb29kMQ0wCwYDVQQLEwRUZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEAnpDkuV/Yze5GEAJ62UOPVosIAf5naUa4HA1/Fntt01cqtaqQ
5PT2Xp5L1bFBVqUnOcF37YtpQFndZPEUZ4wOrf9u8QapS8nfbHvGtFqKyPeZemuT
MZ5N0K8+c4ZdP1H2KHAr9RtNqFVf3j9EQ+1DRL/lu3wggYsPesu0cethV5xbJ9gq
fcl7+SHHBR6Bi1qii3RQf2p909nZGKl6/FnUBmmtWU7wIyKkflxdMCm6ePqqdH8c
J04rXUVEhWE1NpeNWiiytRouTaOQC6H+1rKnJX3AX2XS7od1ArTjtJy53bX3rLdn
+5p8Led4RPcfvTv24rh9g+5SRm2Ss5L7+8hj5wIDAQABMA0GCSqGSIb3DQEBBQUA
A4IBAQAr/6j2ZofdoBMWcs8Rmq9c/75sPHNdRRqo+bQ2c2bFdWMg0sgy1L+6W82p
Q6ZuJk55u7kOSYGn2OkHL6zf8xwN7fG0vfH4gB7DDy2h3/aC8L3Ka0l/KwwEhXSx
bJEP2qlJrA0jkZ28Nj1BRDPVqIqbyqglEdlg5ODMRi9U2vtMms89EVnWjbZQhJ32
34PWOJlEY77gmVkYWI8miEW1cVppAd0P8LW56EsrIcNPWw2XAjNBSbb5mhHWkxwD
qu43/wUXyKp1DG4uHDD4fcKsBuMDtFgT6oxHiu25GLlROLDwb1HoEf5J6N0wOgD2
kJWKKQIOTue0hg4txLMPAT3tC6IQ
-----END CERTIFICATE-----`;

const qzPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEAnpDkuV/Yze5GEAJ62UOPVosIAf5naUa4HA1/Fntt01cqtaqQ
5PT2Xp5L1bFBVqUnOcF37YtpQFndZPEUZ4wOrf9u8QapS8nfbHvGtFqKyPeZemuT
MZ5N0K8+c4ZdP1H2KHAr9RtNqFVf3j9EQ+1DRL/lu3wggYsPesu0cethV5xbJ9gq
fcl7+SHHBR6Bi1qii3RQf2p909nZGKl6/FnUBmmtWU7wIyKkflxdMCm6ePqqdH8c
J04rXUVEhWE1NpeNWiiytRouTaOQC6H+1rKnJX3AX2XS7od1ArTjtJy53bX3rLdn
+5p8Led4RPcfvTv24rh9g+5SRm2Ss5L7+8hj5wIDAQABAoIBAAOoz6AKQP7vqm4U
unmlhlyqX2nLmq4HBKV7wkFHz2FWSlIjXUx/NpPLS6C+msjZyoMBeje8jhw75Gle
J1avGIEoQWZXj5XNOsodqrD3z30ZXxRY2/rHK9UkDROuBzTjLn5KIlaGEJjW+8Cn
f5u5tfQyCSytRMY1iJ0Ql2X5RPbi/n2+0fLMrKAySIFNZ/frN8zlmyOOrDsJFpsM
edsXLwBr97jVUDpH+KbXH1oiLgw1TwPNCfbhqBmgGRiGkovvYaDdW/0BLG9xA17D
hN8/Fv1Btmm2nE/dQKI1za3A3ELxmsst8wwHyf0uiQ8UR4TgXw81sZmHl1cvQs+/
gdiCXvECgYEA3gJnOfUoYsxgLzbG9GaUpjU8+bnfG7a5jCzx353ZVhScE7spUuM7
0GwcKrxPHSV9apqfrwzBGvrp2aSaUnF8lEpjePalj8n3N8Y+G5YjCMo5i5Mf0suv
MaG9cjae/PUNuEF3CjjD1QlnTpSBJT1cch5wI9m8XYBvqnl1hrn/Co0CgYEAttfX
/10pT94ItUNCK7uJDTojmiY7MMF0bStq0eEfb0L644VXKiAgwB9g2wwnQAXiWx2N
E7+eTq4eiiArCNb+mF12WgTU7wJ8K49b46/Ts4s7t/dJDxyZePi98kS0352oa88y
rKOeKl8aul23c/XwCUdWvL17hm4ugl83rFobZUMCgYEAoEc34x3dBEbsgemYBUYx
tzTkSp4oNsfaeRrRnFFHYOAMNip/EPpAap5CT5AXxcEVJGtxMV2R5DqVra0qRK7t
89koq2HV8VMsCbYzjJL9xBDLLrsO1I58cuaD8PsCGTmJqCaLHHQS3bCmRpLsEciU
/0Z+S0OcvBxHgdmiQZvyRtkCgYEAsQpEEfZBxxylb+XFD5VReeY+jMbR7z6SHha5
IqmJh3DifyUgJiDftUdswAx/gMVxzGnLrUCP530/At1s7e1GrX9p1nXxO9A7LO5t
ugQIx0Ncup+NNT2q+PBY81lFjXQZnPIODg2LW1mlBqkxte1/02wo9y29iofrLr9F
p/PDrQMCgYEAhbd50hqELdZ1wKyxYKIQavNPsPe4XRwXGzUMIForV6fltLnzaBCT
3EXkdH/0OUKTW6TUSxHS7QxYofsCyKxjEqiQMN8XomS/TziDR2zArrtSQzUNN6vo
RNfusU2VzJ1Nw3vmkrebcqj2DdZsn1Xp9pFp+KTkgw5V9Aq1I/BIyKY=
-----END RSA PRIVATE KEY-----`;

qz.security.setCertificatePromise((resolve, reject) => {
    resolve(qzCertificate);
});

qz.security.setSignatureAlgorithm("SHA512");

qz.security.setSignaturePromise((toSign) => {
    return function(resolve, reject) {
        try {
            var pk = KEYUTIL.getKey(qzPrivateKey);
            var sig = new KJUR.crypto.Signature({"alg": "SHA512withRSA"});
            sig.init(pk); 
            sig.updateString(toSign);
            var hex = sig.sign();
            
            // Converte HEX para base64
            var s = "";
            for (var i = 0; i < hex.length; i += 2) {
                s += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
            }
            resolve(btoa(s));
        } catch (err) {
            console.error("Erro na assinatura QZ:", err);
            reject(err);
        }
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
    
    data.push(BOLD_ON + `Cliente: ${nomeCliente}\n` + BOLD_OFF);
    
    if (tipoComanda === 'balcao' || isDelivery) {
        const fone = pedido.cliente?.telefone || pedido.telefone;
        if (fone) data.push(`Telefone: ${fone}\n`);
        
        if (pedido.cliente?.endereco) {
            data.push(`End: ${pedido.cliente.endereco.rua || ''}, ${pedido.cliente.endereco.numero || ''}\n`);
            if (pedido.cliente.endereco.bairro) data.push(`Bairro: ${pedido.cliente.endereco.bairro}\n`);
            if (pedido.cliente.endereco.complemento) data.push(`Comp: ${pedido.cliente.endereco.complemento}\n`);
            if (pedido.cliente.endereco.referencia) data.push(`Ref: ${pedido.cliente.endereco.referencia}\n`);
        } else if (pedido.tipo && !isDelivery) {
            data.push(`Tipo: ${String(pedido.tipo).toUpperCase()}\n`);
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

        data.push(BOLD_ON + TEXT_DOUBLE + `${qtd}x ${nomeProduto}\n` + TEXT_NORMAL + BOLD_OFF);
        
        // Variações
        if (item.variacaoSelecionada?.nome || item.variacao?.nome) {
            const varNome = item.variacaoSelecionada?.nome || item.variacao?.nome;
            data.push(`  => ${varNome}\n`);
        }
        
        // 🔥 CORREÇÃO: Lê a variável correta dos complementos (adicionaisSelecionados) 🔥
        const complementos = item.adicionaisSelecionados || item.adicionais || [];
        if (Array.isArray(complementos) && complementos.length > 0) {
            complementos.forEach(add => {
                data.push(BOLD_ON + `  + ${add.nome || 'Adicional'}\n` + BOLD_OFF);
            });
        }

        if (item.observacao) {
            data.push(BOLD_ON + `  OBS: ${item.observacao}\n` + BOLD_OFF);
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
            data.push(`Pagamento: ${formaPgt.toUpperCase()}\n`);
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
