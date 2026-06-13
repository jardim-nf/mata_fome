import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import qz from 'qz-tray';
import { conectarQZ } from '../services/printService';
import { matchTermos, TERMOS_BEBIDA } from '../utils/categoriaUtils';
import { getTerminology } from '../utils/terminologyUtils';

// 🔥 O PENTE FINO DE DADOS 🔥 (Garante que o nome do produto nunca venha em branco)
const extrairDadosDoItem = (rawItem) => {
    if (!rawItem) return null;

    let nome = rawItem.nome || rawItem.name || rawItem.descricao || rawItem.title || rawItem.titulo || rawItem.produtoNome;
    let preco = rawItem.precoFinal || rawItem.precoUnitario || rawItem.preco || rawItem.valor || rawItem.price;
    let categoria = rawItem.categoria;

    if (rawItem.produto && typeof rawItem.produto === 'object') {
        nome = rawItem.produto.nome || rawItem.produto.name || rawItem.produto.descricao || nome;
        preco = rawItem.produto.precoFinal || rawItem.produto.preco || rawItem.produto.valor || rawItem.produto.price || preco;
        categoria = rawItem.produto.categoria || categoria;
    } else if (rawItem.item && typeof rawItem.item === 'object') {
        nome = rawItem.item.nome || rawItem.item.name || rawItem.item.descricao || nome;
        preco = rawItem.item.precoFinal || rawItem.item.preco || rawItem.item.valor || rawItem.item.price || preco;
        categoria = rawItem.item.categoria || categoria;
    }

    if (!nome) nome = "PRODUTO SEM NOME IDENTIFICADO";

    const qtd = Number(rawItem.quantidade || rawItem.quantity || rawItem.qtd || rawItem.produto?.quantidade || 1);
    const obs = rawItem.observacao || rawItem.obs || '';

    return {
        ...rawItem,
        nomeCalculado: String(nome),
        precoCalculado: Number(preco) || 0,
        qtdCalculada: qtd || 1,
        obsCalculada: String(obs),
        categoriaCalculada: String(categoria || '').toLowerCase()
    };
};

const getSetorItemRefinado = (itemFormatado) => {
    const textoBusca = `${itemFormatado.nomeCalculado} ${itemFormatado.categoriaCalculada}`;
    const ehBar = matchTermos(textoBusca, TERMOS_BEBIDA);
    return ehBar ? 'bar' : 'cozinha';
};

// 🔥 GERA COMANDOS ESC/POS RAW PARA IMPRESSORA TÉRMICA (58mm/80mm) 🔥
const clean = (texto) => {
    if (!texto) return '';
    return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const gerarESCPOSFechamentoTurno = (turno, nomeEstabelecimento) => {
    const ESC = '\x1B';
    const GS = '\x1D';
    const INIT = ESC + '@';
    const BOLD_ON = ESC + 'E\x01';
    const BOLD_OFF = ESC + 'E\x00';
    const CENTER = ESC + 'a\x01';
    const LEFT = ESC + 'a\x00';
    const TEXT_DOUBLE = GS + '!\x11';
    const TEXT_NORMAL = GS + '!\x00';
    const CUT = GS + 'V\x41\x03';
    const SEP = '--------------------------------\n';

    const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d) => d ? new Date(d).toLocaleString('pt-BR') : '--/--/---- --:--';

    let d = [];
    d.push(INIT);

    // --- CABEÇALHO ---
    d.push(CENTER);
    if (nomeEstabelecimento) {
        d.push(TEXT_DOUBLE + BOLD_ON + clean(nomeEstabelecimento) + '\n' + TEXT_NORMAL + BOLD_OFF);
    }
    d.push(BOLD_ON + 'RELATORIO DE TURNO\n' + BOLD_OFF);
    d.push(`ID: ${clean(turno.id?.slice(0, 8).toUpperCase())}\n`);
    d.push(`Status: ${turno.status === 'fechado' ? 'FECHADO' : 'ABERTO'}\n`);
    d.push(SEP);

    // --- DADOS DO TURNO ---
    d.push(LEFT);
    d.push(`Operador: ${clean(turno.operadorNome)}\n`);
    d.push(`Abertura: ${fmtDate(turno.dataAbertura)}\n`);
    d.push(`Fechamento: ${fmtDate(turno.dataFechamento)}\n`);
    d.push(SEP);

    // --- VALORES ---
    const res = turno.resumoVendas || {};
    const saldoInicial = parseFloat(turno.saldoInicial || 0);
    const vendasDinheiro = parseFloat(res.dinheiro || 0);
    const vendasPix = parseFloat(res.pix || 0);
    const vendasDebito = parseFloat(res.debito || 0);
    const vendasCredito = parseFloat(res.credito || 0);
    const vendasOutros = parseFloat(res.outros || 0);
    const vendasTotal = parseFloat(res.total || 0);
    const suprimento = parseFloat(res.suprimento || 0);
    const sangria = parseFloat(res.sangria || 0);
    const esperado = saldoInicial + vendasDinheiro + suprimento - sangria;
    const informado = parseFloat(turno.saldoFinalInformado || 0);
    const diferenca = parseFloat(turno.diferenca || 0);

    d.push(`Saldo Inicial (Fundo): R$ ${fmt(saldoInicial)}\n`);
    d.push(SEP);
    d.push(BOLD_ON + 'RESUMO DE VENDAS\n' + BOLD_OFF);
    d.push(`Dinheiro:              R$ ${fmt(vendasDinheiro)}\n`);
    if (vendasPix > 0) d.push(`Pix:                   R$ ${fmt(vendasPix)}\n`);
    if (vendasDebito > 0) d.push(`Debito:                R$ ${fmt(vendasDebito)}\n`);
    if (vendasCredito > 0) d.push(`Credito:               R$ ${fmt(vendasCredito)}\n`);
    if (vendasPix === 0 && vendasDebito === 0 && vendasCredito === 0) {
        d.push(`Cartao/Pix/Outros:     R$ ${fmt(vendasOutros)}\n`);
    }
    d.push(BOLD_ON + `TOTAL FATURADO:        R$ ${fmt(vendasTotal)}\n` + BOLD_OFF);
    d.push(SEP);

    d.push(BOLD_ON + 'MOVIMENTACOES\n' + BOLD_OFF);
    d.push(`Suprimentos (+):       R$ ${fmt(suprimento)}\n`);
    d.push(`Sangrias (-):          R$ ${fmt(sangria)}\n`);
    
    const detalhesMov = res.detalhesMov || [];
    if (detalhesMov.length > 0) {
        detalhesMov.forEach(m => {
            d.push(` - ${clean(m.descricao)}: R$ ${fmt(m.valor)}\n`);
        });
    }
    d.push(SEP);

    if (turno.status === 'fechado') {
        d.push(BOLD_ON + 'AUDITORIA GAVETA\n' + BOLD_OFF);
        d.push(`Dinheiro Esperado:     R$ ${fmt(esperado)}\n`);
        d.push(`Dinheiro Informado:    R$ ${fmt(informado)}\n`);
        
        let diffLabel = 'CAIXA EXATO';
        if (diferenca < 0) diffLabel = 'QUEBRA (-)';
        else if (diferenca > 0) diffLabel = 'SOBRA (+)';
        
        d.push(BOLD_ON + `${diffLabel}: R$ ${fmt(diferenca)}\n` + BOLD_OFF);
        d.push(SEP);
    }

    d.push(CENTER + '\n');
    d.push('*** FIM DO RELATORIO ***\n');
    d.push('\n\n\n');
    d.push(CUT);

    return d;
};

const gerarESCPOSRecibo = (printData, pedidoObj, tituloImpressao, identificadorPedido, pedidoHash, setorAlvo, nomeEstabelecimento) => {
    const ESC = '\x1B';
    const GS = '\x1D';
    const INIT = ESC + '@';
    const BOLD_ON = ESC + 'E\x01';
    const BOLD_OFF = ESC + 'E\x00';
    const CENTER = ESC + 'a\x01';
    const LEFT = ESC + 'a\x00';
    const TEXT_DOUBLE = GS + '!\x11';
    const TEXT_NORMAL = GS + '!\x00';
    const CUT = GS + 'V\x41\x03';
    const SEP = '--------------------------------\n';

    const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let d = [];
    d.push(INIT);

    // --- CABEÇALHO ---
    d.push(CENTER);
    if (nomeEstabelecimento) {
        d.push(TEXT_DOUBLE + BOLD_ON + clean(nomeEstabelecimento) + '\n' + TEXT_NORMAL + BOLD_OFF);
    }
    d.push(BOLD_ON + clean(tituloImpressao) + '\n' + BOLD_OFF);
    d.push(TEXT_DOUBLE + BOLD_ON + clean(identificadorPedido) + '\n' + TEXT_NORMAL + BOLD_OFF);
    // Hash do pedido (se mesa)
    if (printData.isMesa || printData.nomeMesa) {
        d.push(BOLD_ON + 'PEDIDO ' + clean(pedidoHash) + '\n' + BOLD_OFF);
    }
    d.push(new Date().toLocaleString('pt-BR') + '\n');
    d.push(SEP);

    // --- DADOS DO CLIENTE ---
    if (printData.nomeCliente) {
        d.push(LEFT);
        d.push(BOLD_ON + 'CLIENTE: ' + clean(printData.nomeCliente) + '\n' + BOLD_OFF);
        if (printData.telefoneCliente) {
            d.push('TEL: ' + clean(printData.telefoneCliente) + '\n');
        }
        if (printData.cpfCliente) {
            d.push('CPF/CNPJ: ' + clean(printData.cpfCliente) + '\n');
        }
        if (printData.enderecoCliente) {
            d.push('END: ' + clean(printData.enderecoCliente) + '\n');
        }
        d.push(SEP);
    }

    // --- ITENS POR PESSOA/COMANDA ---
    d.push(LEFT);
    Object.entries(printData.agrupados).forEach(([pessoa, dados]) => {
        if (pessoa !== 'Mesa') {
            // Na via de produção (cozinha/bar), não mostra o valor
            const ehProducao = setorAlvo && setorAlvo !== 'tudo';
            d.push(BOLD_ON + clean(pessoa.toUpperCase()) + (ehProducao ? '' : '  R$ ' + fmt(dados.total)) + '\n' + BOLD_OFF);
            d.push(SEP);
        }

        dados.itens.forEach(item => {
            d.push(BOLD_ON + TEXT_DOUBLE + `${item.qtdCalculada}x ${clean(item.nomeCalculado)}\n` + TEXT_NORMAL + BOLD_OFF);

            // Variação
            if (item.variacaoSelecionada?.nome || item.variacao?.nome) {
                d.push(` - ${clean(item.variacaoSelecionada?.nome || item.variacao?.nome)}\n`);
            }

            // Adicionais (mesma lógica de filtro do HTML)
            let adicionais = [];
            if (Array.isArray(item.adicionaisSelecionados) && item.adicionaisSelecionados.length > 0) {
                adicionais = item.adicionaisSelecionados;
            } else if (Array.isArray(item.adicionais)) {
                const lixo = ['COMPLEMENTOS','MOLHOS','CARNES','PAES','SALADAS','QUEIJOS','BANHEIRO','FICHAS','ADICIONAIS','EXTRAS'];
                adicionais = item.adicionais.filter(a => {
                    const nu = String(a.nome || '').toUpperCase();
                    const isLixo = lixo.some(lx => nu === lx || nu.includes(lx));
                    const temPreco = Number(a.preco) > 0;
                    return !isLixo || temPreco;
                });
            } else if (Array.isArray(item.produto?.adicionais)) {
                adicionais = item.produto.adicionais;
            } else if (Array.isArray(item.item?.adicionais)) {
                adicionais = item.item.adicionais;
            }
            adicionais.forEach(adc => {
                const n = typeof adc === 'string' ? adc : (adc.nome || 'Adicional');
                d.push(BOLD_ON + ` + ${clean(n)}\n` + BOLD_OFF);
            });

            // Observação
            if (item.obsCalculada) {
                d.push(BOLD_ON + `* OBS: ${clean(item.obsCalculada)}\n` + BOLD_OFF);
            }

            // Atendente e hora
            const atendente = item.adicionadoPor || pedidoObj.atendente || pedidoObj.funcionario || '';
            let hora = '';
            const ts = item.adicionadoEm || pedidoObj.createdAt || pedidoObj.dataPedido;
            if (ts) {
                try {
                    const dt = ts.toDate ? ts.toDate() : new Date(ts);
                    hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                } catch(e) { /* ignora */ }
            }
            if (atendente || hora) {
                d.push(`${clean(atendente)}     ${hora}\n`);
            }

            // Valor do item — esconde na via de produção (cozinha/bar)
            if (!setorAlvo || setorAlvo === 'tudo') {
                const valorItem = fmt(item.precoCalculado * item.qtdCalculada);
                d.push(`  R$ ${valorItem}\n`);
            }
            d.push('\n');
        });
    });

    d.push(SEP);

    // --- TOTAIS (esconde na via de produção) ---
    if (!setorAlvo || setorAlvo === 'tudo') {
        d.push(BOLD_ON + TEXT_DOUBLE + `TOTAL: R$ ${fmt(printData.totalConsumo)}\n` + TEXT_NORMAL + BOLD_OFF);
    }

    if (printData.isMesa && (!setorAlvo || setorAlvo === 'tudo') && !printData.isVendaFinalizada && printData.restante > 0) {
        d.push(TEXT_DOUBLE + BOLD_ON + `A PAGAR: R$ ${fmt(printData.restante)}\n` + TEXT_NORMAL + BOLD_OFF);
    }

    // --- RODAPÉ ---
    d.push(CENTER + '\n');
    const rodape = printData.isVendaFinalizada
        ? 'NAO E DOCUMENTO FISCAL'
        : (!printData.isMesa || (setorAlvo && setorAlvo !== 'tudo'))
            ? 'VIA DE PRODUCAO'
            : 'PRE-CONFERENCIA';
    d.push(`*** ${clean(rodape)} ***\n`);
    d.push('\n\n\n');
    d.push(CUT);

    return d;
};

export default function ImpressaoIsolada() {
    const [searchParams] = useSearchParams();
    const pedidoId = searchParams.get('pedidoId');
    const estabId = searchParams.get('estabId');
    const origem = searchParams.get('origem'); 
    const setorAlvo = searchParams.get('setor')?.toLowerCase(); 
    
    const [pedido, setPedido] = useState(null);
    const [turno, setTurno] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [impressoraConfig, setImpressoraConfig] = useState({ balcao: null, cozinha: null, bar: null });
    const [tipoNegocio, setTipoNegocio] = useState('restaurante');
    const [nomeEstabelecimento, setNomeEstabelecimento] = useState('');

    useEffect(() => {
        const buscarDados = async () => {
            if (origem === 'turno') {
                const turnoId = searchParams.get('turnoId');
                if (!turnoId || !estabId) {
                    setError("ID do Turno ou Estabelecimento não fornecido.");
                    setLoading(false);
                    return;
                }
                try {
                    const estabRef = doc(db, 'estabelecimentos', estabId);
                    const estabSnap = await getDoc(estabRef);
                    if (estabSnap.exists()) {
                        const estabData = estabSnap.data();
                        setImpressoraConfig({
                            balcao: estabData.impressoraBalcao || null,
                            cozinha: estabData.impressoraCozinha || null,
                            bar: estabData.impressoraBar || null
                        });
                        setTipoNegocio(estabData.tipoNegocio || 'restaurante');
                        setNomeEstabelecimento(estabData.nome || 'IdeaFood Store');
                    }

                    const turnoRef = doc(db, 'caixas', turnoId);
                    const turnoSnap = await getDoc(turnoRef);
                    if (!turnoSnap.exists()) {
                        throw new Error("Turno de caixa não encontrado.");
                    }

                    const turnoDados = { id: turnoSnap.id, ...turnoSnap.data() };
                    
                    if (turnoDados.dataAbertura?.toDate) turnoDados.dataAbertura = turnoDados.dataAbertura.toDate();
                    else if (turnoDados.dataAbertura) turnoDados.dataAbertura = new Date(turnoDados.dataAbertura);

                    if (turnoDados.dataFechamento?.toDate) turnoDados.dataFechamento = turnoDados.dataFechamento.toDate();
                    else if (turnoDados.dataFechamento) turnoDados.dataFechamento = new Date(turnoDados.dataFechamento);

                    // Buscar nome do operador
                    let operadorNome = turnoDados.usuarioId || 'Desconhecido';
                    if (turnoDados.usuarioId) {
                        try {
                            const uDoc = await getDoc(doc(db, 'usuarios', turnoDados.usuarioId));
                            if (uDoc.exists()) {
                                operadorNome = uDoc.data().nome || uDoc.data().email || operadorNome;
                            }
                        } catch (e) {
                            console.error("Erro ao carregar operador:", e);
                        }
                    }
                    turnoDados.operadorNome = operadorNome;

                    setTurno(turnoDados);
                } catch (err) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
                return;
            }

            if (!pedidoId || !estabId) {
                setError("ID ou Estabelecimento não fornecido.");
                setLoading(false);
                return;
            }
            try {
                // Busca config das impressoras do estabelecimento
                const estabRef = doc(db, 'estabelecimentos', estabId);
                const estabSnap = await getDoc(estabRef);
                if (estabSnap.exists()) {
                    const estabData = estabSnap.data();
                    setImpressoraConfig({
                        balcao: estabData.impressoraBalcao || null,
                        cozinha: estabData.impressoraCozinha || null,
                        bar: estabData.impressoraBar || null
                    });
                    setTipoNegocio(estabData.tipoNegocio || 'restaurante');
                    setNomeEstabelecimento(estabData.nome || 'IdeaFood Store');
                }

                let dadosPedido = null;

                // 1. Tenta buscar na coleção global de Vendas (Recibos do PDV e Salão finalizados)
                const vendaRef = doc(db, 'vendas', pedidoId);
                const vendaSnap = await getDoc(vendaRef);
                if (vendaSnap.exists()) {
                    // 🔥 AVISO ADICIONADO: isVendaFinalizada: true
                    dadosPedido = { id: vendaSnap.id, ...vendaSnap.data(), isMesa: !!vendaSnap.data().mesaNumero, isVendaFinalizada: true };
                }

                // 2. Se não achar, tenta buscar nas Mesas (Para impressão de Conferência antes de pagar)
                if (!dadosPedido) {
                    const mesaRef = doc(db, 'estabelecimentos', estabId, 'mesas', pedidoId);
                    const mesaSnap = await getDoc(mesaRef);
                    if (mesaSnap.exists()) dadosPedido = { id: mesaSnap.id, ...mesaSnap.data(), isMesa: true };
                }

                // 3. Se não achar, tenta buscar nos Pedidos (Delivery / Balcão em andamento)
                if (!dadosPedido) {
                    const pedidoRef = doc(db, 'estabelecimentos', estabId, 'pedidos', pedidoId);
                    let pedidoSnap = await getDoc(pedidoRef);
                    if (pedidoSnap.exists()) dadosPedido = { id: pedidoSnap.id, ...pedidoSnap.data(), isMesa: false };
                }

                if (!dadosPedido) throw new Error("Registro não encontrado no banco de dados.");

                // Se o pedido possui um cliente cadastrado, busca os dados adicionais (como endereço)
                if (dadosPedido.clienteId) {
                    try {
                        const clientRef = doc(db, 'estabelecimentos', estabId, 'clientes', dadosPedido.clienteId);
                        const clientSnap = await getDoc(clientRef);
                        if (clientSnap.exists()) {
                            dadosPedido.clienteDetails = clientSnap.data();
                        }
                    } catch (e) {
                        console.error("Erro ao carregar dados adicionais do cliente para impressão:", e);
                    }
                }

                setPedido(dadosPedido);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        buscarDados();
    }, [pedidoId, estabId, origem]);

    const printData = useMemo(() => {
        if (!pedido) return null;
        
        let itensBrutos = [];
        
        if (Array.isArray(pedido.itens)) itensBrutos.push(...pedido.itens);
        if (Array.isArray(pedido.carrinho)) itensBrutos.push(...pedido.carrinho);
        if (Array.isArray(pedido.produtos)) itensBrutos.push(...pedido.produtos);
        
        if (Array.isArray(pedido.pedidos)) {
            pedido.pedidos.forEach(sub => {
                if (Array.isArray(sub.itens)) itensBrutos.push(...sub.itens);
                else if (Array.isArray(sub.carrinho)) itensBrutos.push(...sub.carrinho);
                else if (Array.isArray(sub.produtos)) itensBrutos.push(...sub.produtos);
                else if (sub.nome || sub.produto || sub.descricao) itensBrutos.push(sub);
            });
        }

        let listaFormatada = itensBrutos.map(extrairDadosDoItem).filter(Boolean);

        if (setorAlvo && setorAlvo !== 'tudo' && setorAlvo !== 'null' && setorAlvo !== '') {
            listaFormatada = listaFormatada.filter(item => getSetorItemRefinado(item) === setorAlvo);
        }

        if (listaFormatada.length === 0) return { vazio: true }; 

        const agrupados = {};
        let totalConsumoCalculado = 0;

        listaFormatada.forEach(item => {
            const clienteRaw = item.clienteNome || item.cliente || item.destinatario || item.nomeOcupante || 'Mesa';
            const pessoa = (typeof clienteRaw === 'object' && clienteRaw !== null) ? (clienteRaw.nome || clienteRaw.name || 'Cliente') : String(clienteRaw);
            if (!agrupados[pessoa]) agrupados[pessoa] = { itens: [], total: 0 };
            
            agrupados[pessoa].itens.push(item);
            
            const subtotalDoItem = item.precoCalculado * item.qtdCalculada;
            agrupados[pessoa].total += subtotalDoItem;
            totalConsumoCalculado += subtotalDoItem;
        });

        const jaPago = Array.isArray(pedido.pagamentosParciais) ? pedido.pagamentosParciais.reduce((acc, pgto) => acc + (Number(pgto.valor) || 0), 0) : 0;
        
        const valorFinalDoPedido = Number(pedido.totalFinal || pedido.total || totalConsumoCalculado);
        const restante = Math.max(0, valorFinalDoPedido - jaPago);

        const tipoEntrega = (pedido.tipoEntrega || '').toLowerCase();
        const origemDoPedido = (origem || pedido.origem || '').toLowerCase();
        const isPDV = origemDoPedido === 'pdv' || origemDoPedido === 'salao';
        
        const isRetirada = tipoEntrega === 'retirada' || tipoEntrega === 'balcao';
        const isDelivery = tipoEntrega === 'delivery' || (!pedido.isMesa && !isRetirada && !isPDV && !pedido.mesaNumero);

        // Nome da mesa ou cliente para exibir no cabeçalho
        // Extrai apenas o NÚMERO da mesa para evitar duplicar "MESA MESA 2"
        const mesaNum = pedido.mesaNumero || pedido.numero || '';
        const nomeMesa = pedido.mesaNome || pedido.nomeMesa || (mesaNum ? String(mesaNum) : '');

        const rawCliente = pedido.cliente;
        const rawDetails = pedido.clienteDetails;

        const nomeCliente = (typeof rawCliente === 'object' && rawCliente !== null)
            ? (rawCliente.nome || rawCliente.name || '')
            : (rawDetails && rawDetails.nome)
                ? rawDetails.nome
                : (typeof rawCliente === 'string' && rawCliente !== 'Balcão')
                    ? rawCliente
                    : (pedido.nomeCliente || pedido.nome || '');

        const telefoneCliente = pedido.clienteTelefone 
            || (rawDetails && rawDetails.telefone)
            || (pedido.cliente && typeof pedido.cliente === 'object' ? pedido.cliente.telefone : '') 
            || pedido.telefone 
            || '';

        const cpfCliente = pedido.clienteCpf 
            || (rawDetails && rawDetails.cpf)
            || pedido.cpfNota 
            || (pedido.cliente && typeof pedido.cliente === 'object' ? pedido.cliente.cpf : '') 
            || '';

        const formatarEndereco = (end) => {
            if (!end) return '';
            if (typeof end === 'string') return end;
            if (typeof end === 'object') {
                const parts = [
                    end.logradouro || end.rua || end.endereco,
                    end.numero,
                    end.complemento,
                    end.bairro,
                    end.cidade
                ].filter(Boolean);
                return parts.join(', ');
            }
            return '';
        };
        const enderecoCliente = formatarEndereco(
            pedido.endereco 
            || pedido.enderecoEntrega 
            || (rawDetails && rawDetails.endereco)
            || (pedido.cliente && typeof pedido.cliente === 'object' ? pedido.cliente.endereco : '')
        );

        return { 
            agrupados, 
            totalConsumo: valorFinalDoPedido > 0 ? valorFinalDoPedido : totalConsumoCalculado, 
            jaPago, 
            restante, 
            numero: pedido.numero || pedido.mesaNumero || (isDelivery ? 'Delivery' : isRetirada ? 'Retirada' : isPDV ? 'PDV' : 'Balcão'),
            nomeMesa,
            nomeCliente,
            telefoneCliente,
            enderecoCliente,
            cpfCliente,
            isMesa: pedido.isMesa,
            isDelivery,
            isRetirada,
            isPDV,
            isVendaFinalizada: pedido.isVendaFinalizada,
            vazio: false
        };
    }, [pedido, setorAlvo]);

    useEffect(() => {
        if (!loading && !error) {
            if (origem === 'turno') {
                if (!turno) return;
                const realizarImpressaoTurno = async () => {
                    const nomeImpressora = impressoraConfig.balcao || impressoraConfig.cozinha;
                    if (!nomeImpressora) {
                        console.log("Nenhuma impressora configurada, usando impressão do navegador.");
                        window.focus();
                        setTimeout(() => window.print(), 500);
                        window.onafterprint = () => window.close();
                        return;
                    }
                    try {
                        await conectarQZ();
                        const escposData = gerarESCPOSFechamentoTurno(turno, nomeEstabelecimento);
                        const config = qz.configs.create(nomeImpressora);
                        await qz.print(config, escposData);
                        setTimeout(() => window.close(), 1000);
                    } catch (err) {
                        console.log("QZ Tray não encontrado ou erro, usando window.print():", err);
                        window.focus();
                        setTimeout(() => window.print(), 500);
                        window.onafterprint = () => window.close();
                    }
                };
                setTimeout(realizarImpressaoTurno, 1000);
                return;
            }

            if (printData && !printData.vazio) {
                const realizarImpressao = async () => {
                    // 🔥 CORREÇÃO: Usa as impressoras configuradas no Firestore ao invés de nomes fixos
                    const nomeImpressora = setorAlvo === 'cozinha'
                        ? (impressoraConfig.cozinha || impressoraConfig.balcao)
                        : setorAlvo === 'bar'
                            ? (impressoraConfig.bar || impressoraConfig.balcao || impressoraConfig.cozinha)
                            : (impressoraConfig.balcao || impressoraConfig.cozinha);

                    // Se não tem impressora configurada, vai direto pro window.print()
                    if (!nomeImpressora) {
                        console.log("Nenhuma impressora configurada no estabelecimento, usando impressão do navegador.");
                        window.focus();
                        setTimeout(() => window.print(), 500);
                        window.onafterprint = () => window.close();
                        return;
                    }

                    try {
                        await conectarQZ();

                        // 🔥 Gera título e identificador para o ESC/POS
                        let titulo = 'PRE-CONFERENCIA';
                        if (printData.isVendaFinalizada) {
                            titulo = 'RECIBO DE VENDA';
                        } else if (!printData.isMesa) {
                            titulo = setorAlvo && setorAlvo !== 'tudo' ? setorAlvo.toUpperCase() : 'NOVO PEDIDO';
                        } else if (setorAlvo && setorAlvo !== 'tudo') {
                            titulo = setorAlvo.toUpperCase();
                        }

                        const hash = `#${String(pedido.vendaId || pedido.id || '').slice(-6).toUpperCase()}`;
                        const ident = (() => {
                            if (printData.isRetirada) return 'RETIRADA';
                            if (printData.isDelivery) return 'DELIVERY';
                            if (printData.isMesa) return `${getTerminology('mesa', tipoNegocio).toUpperCase()} ${printData.numero}`;
                            if (printData.nomeMesa) return `${getTerminology('mesa', tipoNegocio).toUpperCase()} ${printData.nomeMesa}`;
                            if (printData.nomeCliente) return printData.nomeCliente.toUpperCase();
                            return `PEDIDO ${hash}`;
                        })();

                        const escposData = gerarESCPOSRecibo(printData, pedido, titulo, ident, hash, setorAlvo, nomeEstabelecimento);
                        const config = qz.configs.create(nomeImpressora);
                        await qz.print(config, escposData);
                        setTimeout(() => window.close(), 1000);
                    } catch (err) {
                        console.log("QZ Tray não encontrado ou erro, usando window.print():", err);
                        window.focus();
                        setTimeout(() => window.print(), 500);
                        window.onafterprint = () => window.close();
                    }
                };
                setTimeout(realizarImpressao, 1000); 
            }
        }
    }, [loading, printData, error, setorAlvo, impressoraConfig, turno, origem, nomeEstabelecimento, tipoNegocio]);

    const formatarMoeda = (valor) => (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (loading) return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'monospace' }}>Carregando impressão...</div>;
    
    if (error || (origem !== 'turno' && (!printData || printData.vazio))) return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}>
            <p>{error || `Nenhum item listado ou encontrado para o setor: ${setorAlvo?.toUpperCase() || ''}`}</p>
            <button className="no-print" onClick={() => window.close()} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: '#fff', borderRadius: '5px' }}>Fechar Janela</button>
        </div>
    );

    if (origem === 'turno') {
        if (!turno) return null;
        const res = turno.resumoVendas || {};
        const saldoInicial = parseFloat(turno.saldoInicial || 0);
        const vendasDinheiro = parseFloat(res.dinheiro || 0);
        const vendasPix = parseFloat(res.pix || 0);
        const vendasDebito = parseFloat(res.debito || 0);
        const vendasCredito = parseFloat(res.credito || 0);
        const vendasOutros = parseFloat(res.outros || 0);
        const vendasTotal = parseFloat(res.total || 0);
        const suprimento = parseFloat(res.suprimento || 0);
        const sangria = parseFloat(res.sangria || 0);
        const esperado = saldoInicial + vendasDinheiro + suprimento - sangria;
        const informado = parseFloat(turno.saldoFinalInformado || 0);
        const diferenca = parseFloat(turno.diferenca || 0);
        const detalhesMov = res.detalhesMov || [];

        return (
            <div id="printable-receipt" style={{ width: '72mm', maxWidth: '72mm', margin: '0 auto', backgroundColor: '#ffffff', fontFamily: "'Courier New', Courier, monospace", color: '#000000', padding: '0', boxSizing: 'border-box' }}>
                <style>{`
                    html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-text-size-adjust: 100% !important; }
                    table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; }
                    td { padding: 2px 0 !important; vertical-align: top !important; word-wrap: break-word !important; overflow-wrap: break-word !important; }
                    #printable-receipt { font-size: 14px; line-height: 1.4; width: 72mm !important; max-width: 72mm !important; }
                    @media print {
                        html, body, #root { 
                            height: auto !important; 
                            min-height: auto !important;
                            width: 100% !important;
                            overflow: visible !important; 
                            position: static !important;
                            background: white !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            display: block !important;
                        }
                        #printable-receipt { 
                            position: relative !important; 
                            height: auto !important; 
                            overflow: visible !important; 
                            max-width: 100% !important; 
                            width: 100% !important; 
                        }
                        @page { margin: 0; size: auto; }
                        .no-print { display: none !important; }
                        * { 
                            color: black !important; 
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                `}</style>

                <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
                    {nomeEstabelecimento && (
                        <div style={{ fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', margin: '4px 0', wordBreak: 'break-word' }}>
                            {nomeEstabelecimento}
                        </div>
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>RELATÓRIO DE TURNO</div>
                    <div style={{ fontSize: '11px' }}>ID: {turno.id?.toUpperCase()}</div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px' }}>
                        {turno.status === 'fechado' ? '🔒 CAIXA ENCERRADO' : '🟢 CAIXA EM ANDAMENTO'}
                    </div>
                </div>

                <div style={{ fontSize: '13px', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
                    <div><b>Operador:</b> {turno.operadorNome}</div>
                    <div><b>Abertura:</b> {turno.dataAbertura ? new Date(turno.dataAbertura).toLocaleString('pt-BR') : '--/--/---- --:--'}</div>
                    <div><b>Fechamento:</b> {turno.dataFechamento ? new Date(turno.dataFechamento).toLocaleString('pt-BR') : '--/--/---- --:--'}</div>
                </div>

                <div style={{ fontSize: '13px', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>SALDO INICIAL (FUNDO):</span>
                        <span>R$ {formatarMoeda(saldoInicial)}</span>
                    </div>
                </div>

                <div style={{ fontSize: '13px', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>RESUMO DE VENDAS ({res.qtd || 0} peds)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Dinheiro:</span>
                        <span>R$ {formatarMoeda(vendasDinheiro)}</span>
                    </div>
                    {vendasPix > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Pix:</span>
                            <span>R$ {formatarMoeda(vendasPix)}</span>
                        </div>
                    )}
                    {vendasDebito > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Débito:</span>
                            <span>R$ {formatarMoeda(vendasDebito)}</span>
                        </div>
                    )}
                    {vendasCredito > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Crédito:</span>
                            <span>R$ {formatarMoeda(vendasCredito)}</span>
                        </div>
                    )}
                    {vendasPix === 0 && vendasDebito === 0 && vendasCredito === 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Cartão/Pix/Outros:</span>
                            <span>R$ {formatarMoeda(vendasOutros)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '4px' }}>
                        <span>TOTAL FATURADO:</span>
                        <span>R$ {formatarMoeda(vendasTotal)}</span>
                    </div>
                </div>

                <div style={{ fontSize: '13px', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>MOVIMENTAÇÕES</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                        <span>Suprimentos (+):</span>
                        <span>R$ {formatarMoeda(suprimento)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                        <span>Sangrias (-):</span>
                        <span>R$ {formatarMoeda(sangria)}</span>
                    </div>
                    {detalhesMov.length > 0 && (
                        <div style={{ fontSize: '11px', fontStyle: 'italic', paddingLeft: '8px', marginTop: '4px' }}>
                            {detalhesMov.map((m, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>- {m.descricao}</span>
                                    <span>R$ {formatarMoeda(m.valor)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {turno.status === 'fechado' && (
                    <div style={{ fontSize: '13px', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', padding: '6px', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4b5563' }}>
                            <span>Dinheiro Esperado:</span>
                            <span>R$ {formatarMoeda(esperado)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4b5563' }}>
                            <span>Dinheiro Informado:</span>
                            <span>R$ {formatarMoeda(informado)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '4px', borderTop: '1px solid #ccc', paddingTop: '4px', color: diferenca < 0 ? '#dc2626' : diferenca > 0 ? '#059669' : '#000' }}>
                            <span>{diferenca < 0 ? 'QUEBRA (-)' : diferenca > 0 ? 'SOBRA (+)' : 'CAIXA EXATO'}</span>
                            <span>R$ {formatarMoeda(diferenca)}</span>
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '10px', fontWeight: 'bold' }}>
                    *** FIM DO RELATÓRIO ***
                </div>
            </div>
        );
    }

    // 🔥 MUDA O TÍTULO SE FOR RECIBO PAGO 🔥
    let tituloImpressao = 'PRÉ-CONFERÊNCIA';
    if (printData.isVendaFinalizada) {
        tituloImpressao = 'RECIBO DE VENDA';
    } else if (!printData.isMesa) {
        // Sem "PEDIDO:" — só o nome do setor
        tituloImpressao = setorAlvo && setorAlvo !== 'tudo' ? setorAlvo.toUpperCase() : 'NOVO PEDIDO';
    } else if (setorAlvo && setorAlvo !== 'tudo') {
        tituloImpressao = setorAlvo.toUpperCase(); 
    }

    // Monta o identificador principal do cabeçalho
    const pedidoHash = `#${String(pedido.vendaId || pedido.id || '').slice(-6).toUpperCase()}`;
    const identificadorPedido = (() => {
        if (printData.isRetirada) return 'RETIRADA';
        if (printData.isDelivery) return 'DELIVERY';
        if (printData.isMesa) return `${getTerminology('mesa', tipoNegocio).toUpperCase()} ${printData.numero}`;
        // Pedido de cozinha/bar vindo de uma mesa — mostra a mesa
        if (printData.nomeMesa) return `${getTerminology('mesa', tipoNegocio).toUpperCase()} ${printData.nomeMesa}`;
        if (printData.nomeCliente) return printData.nomeCliente.toUpperCase();
        return `PEDIDO ${pedidoHash}`;
    })();
    // Mostra o # do pedido como linha secundária quando o identificador principal é a mesa
    const mostrarHashSecundario = (printData.isMesa || printData.nomeMesa) && !printData.isVendaFinalizada;

    return (
        <>
        <div id="printable-receipt" style={{ width: '72mm', maxWidth: '72mm', margin: '0 auto', backgroundColor: '#ffffff', fontFamily: "'Courier New', Courier, monospace", color: '#000000', padding: '0', boxSizing: 'border-box' }}>
            
            <style>{`
                html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-text-size-adjust: 100% !important; }
                table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; }
                td { padding: 2px 0 !important; vertical-align: top !important; word-wrap: break-word !important; overflow-wrap: break-word !important; }
                #printable-receipt { font-size: 16px; line-height: 1.4; width: 72mm !important; max-width: 72mm !important; }
                
                @media print {
                    html, body, #root { 
                        height: auto !important; 
                        min-height: auto !important;
                        width: 100% !important;
                        overflow: visible !important; 
                        position: static !important;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                    }
                    #printable-receipt { 
                        position: relative !important; 
                        height: auto !important; 
                        overflow: visible !important; 
                        max-width: 100% !important; 
                        width: 100% !important; 
                    }
                    @page { margin: 0; size: auto; }
                    .no-print { display: none !important; }
                    * { 
                        color: black !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
                {nomeEstabelecimento && (
                    <div style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase', margin: '4px 0', wordBreak: 'break-word' }}>
                        {nomeEstabelecimento}
                    </div>
                )}
                <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>{tituloImpressao}</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', margin: '4px 0', textTransform: 'uppercase', wordBreak: 'break-word' }}>
                    {identificadorPedido}
                </div>
                {mostrarHashSecundario && (
                    <div style={{ fontSize: '16px', fontWeight: 'bold', margin: '2px 0' }}>PEDIDO {pedidoHash}</div>
                )}
                <div style={{ fontSize: '14px' }}>{new Date().toLocaleString('pt-BR')}</div>
            </div>

            {/* DADOS DO CLIENTE */}
            {printData.nomeCliente && (
                <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '14px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>CLIENTE: {printData.nomeCliente}</div>
                    {printData.telefoneCliente && <div>TEL: {printData.telefoneCliente}</div>}
                    {printData.cpfCliente && <div>CPF/CNPJ: {printData.cpfCliente}</div>}
                    {printData.enderecoCliente && <div style={{ whiteSpace: 'pre-line', marginTop: '2px' }}>END: {printData.enderecoCliente}</div>}
                </div>
            )}

            {Object.entries(printData.agrupados).map(([pessoa, dados]) => (
                <div key={pessoa} style={{ marginBottom: '15px' }}>
                    {pessoa !== 'Mesa' && (
                        <div style={{ borderBottom: '1px solid #000', marginBottom: '6px', paddingBottom: '2px' }}>
                            <table style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ width: '60%', textAlign: 'left' }}>{pessoa}</td>
                                        {/* Esconde valor na via de produção (cozinha/bar) */}
                                        {(!setorAlvo || setorAlvo === 'tudo') && (
                                            <td style={{ width: '40%', textAlign: 'right' }}>R$ {formatarMoeda(dados.total)}</td>
                                        )}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    <table style={{ fontSize: '15px' }}>
                        <tbody>
                            {dados.itens.map((item, idx) => {
                                let adicionais = [];
                                if (Array.isArray(item.adicionaisSelecionados) && item.adicionaisSelecionados.length > 0) {
                                    adicionais = item.adicionaisSelecionados;
                                } else if (Array.isArray(item.adicionais)) {
                                    const lixo = ['COMPLEMENTOS', 'MOLHOS', 'CARNES', 'PAES', 'SALADAS', 'QUEIJOS', 'BANHEIRO', 'FICHAS', 'ADICIONAIS', 'EXTRAS'];
                                    adicionais = item.adicionais.filter(a => {
                                        const nomeUpper = String(a.nome || '').toUpperCase();
                                        const isLixo = lixo.some(lx => nomeUpper === lx || nomeUpper.includes(lx));
                                        const temPreco = a.preco !== undefined && a.preco !== null && Number(a.preco) > 0;
                                        return !isLixo || temPreco;
                                    });
                                } else if (Array.isArray(item.produto?.adicionais)) {
                                    adicionais = item.produto.adicionais;
                                } else if (Array.isArray(item.item?.adicionais)) {
                                    adicionais = item.item.adicionais;
                                }

                                return (
                                    <tr key={idx}>
                                        <td style={{ textAlign: 'left', paddingRight: '2px' }}>
                                            <span style={{fontWeight: 'bold', fontSize: '20px'}}>{item.qtdCalculada}x {item.nomeCalculado}</span>
                                            
                                            {(item.variacaoSelecionada || item.variacao) && (
                                                <div style={{ fontSize: '13px', marginTop: '1px', fontStyle: 'italic' }}>
                                                     - {item.variacaoSelecionada?.nome || item.variacao?.nome}
                                                </div>
                                            )}

                                            {adicionais.length > 0 && (
                                                <div style={{ fontSize: '13px', marginTop: '2px' }}>
                                                    {adicionais.map((adc, i) => {
                                                        const nomeAdic = typeof adc === 'string' ? adc : (adc.nome || 'Adicional');
                                                        return <div key={i}>+ {nomeAdic}</div>;
                                                    })}
                                                </div>
                                            )}

                                            {item.obsCalculada && <div style={{ fontSize: '14px', marginTop: '2px', fontWeight: 'bold' }}>* OBS: {item.obsCalculada}</div>}
                                            
                                            <div style={{ fontSize: '12px', marginTop: '2px', fontStyle: 'italic', overflow: 'hidden' }}>
                                                <span style={{ float: 'left' }}>{item.adicionadoPor || pedido.atendente || pedido.funcionario || 'Caixa'}</span>
                                                <span style={{ float: 'right' }}>
                                                    {(item.adicionadoEm || pedido.createdAt || pedido.dataPedido) && (
                                                        (item.adicionadoEm?.toDate || pedido.createdAt?.toDate || pedido.dataPedido?.toDate)
                                                            ? (item.adicionadoEm?.toDate ? item.adicionadoEm.toDate() : (pedido.createdAt?.toDate ? pedido.createdAt.toDate() : pedido.dataPedido.toDate())).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                                            : new Date(item.adicionadoEm || pedido.createdAt || pedido.dataPedido).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace('Invalid Date', '')
                                                    )}
                                                </span>
                                            </div>
                                            {/* Esconde preço na via de produção (cozinha/bar) */}
                                            {(!setorAlvo || setorAlvo === 'tudo') && (
                                                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '15px', marginTop: '2px' }}>
                                                    R$ {formatarMoeda(item.precoCalculado * item.qtdCalculada)}
                                                </div>
                                            )}
                                            <div style={{ borderBottom: '1px dashed #ccc', marginTop: '3px', marginBottom: '3px' }}></div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ))}

            {/* Esconde TOTAL na via de produção (cozinha/bar) */}
            {(!setorAlvo || setorAlvo === 'tudo') && (
            <div style={{ borderTop: '1px dashed #000', marginTop: '6px', paddingTop: '6px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>TOTAL:</span>
                    <span>R$ {formatarMoeda(printData.totalConsumo)}</span>
                </div>
                
                {/* Esconde o "A PAGAR" se a venda já foi finalizada */}
                {printData.isMesa && (!setorAlvo || setorAlvo === 'tudo') && !printData.isVendaFinalizada && (
                    <div style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '4px', borderTop: '1px solid #000', paddingTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>A PAGAR:</span>
                        <span>R$ {formatarMoeda(printData.restante)}</span>
                    </div>
                )}
            </div>
            )}
            
            <div style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', fontWeight: 'bold' }}>
                *** {printData.isVendaFinalizada ? 'NAO E DOCUMENTO FISCAL' : (!printData.isMesa || (setorAlvo && setorAlvo !== 'tudo')) ? 'VIA DE PRODUCAO' : 'NAO E DOCUMENTO FISCAL'} ***
            </div>
        </div>
        </>
    );
}