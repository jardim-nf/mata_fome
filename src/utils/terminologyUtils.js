// src/utils/terminologyUtils.js

const terminologies = {
    restaurante: {
        mesa: 'Mesa',
        mesas: 'Mesas',
        novaMesa: 'Nova Mesa',
        garcom: 'Garçom',
        atendente: 'Garçom/Atendente',
        cozinha: 'Cozinha',
        kds: 'Painel de Cozinha',
        salao: 'Salão',
        buscarMesa: 'Buscar mesa...',
        limparLivres: 'Limpar Livres',
        mesasAntigas: 'Mesas Antigas',
        mandarParaCozinha: 'Mandar p/ Cozinha',
        prontoMesa: 'Pronto (Mesa)',
        chamarGarcom: 'Chamando Garçom',
        pedindoConta: 'Pedindo Conta',
        comandaRecibo: 'Consumo Geral Mesa',
        transferirMesa: 'Transferir / Juntar Mesa',
        resumoMesa: 'Resumo da Mesa',
        conferenciaMesa: 'Imprimir Pré-Conferência (Mesa)',
        cardapio: 'Cardápio',
        pedirConta: 'Pedir a Conta',
        chamarGarcomBotao: 'Chamar Garçom',
        solicitarContaSucesso: 'Conta solicitada com sucesso!',
        chamarGarcomSucesso: 'Garçom chamado com sucesso!'
    },
    varejo: {
        mesa: 'Comanda',
        mesas: 'Comandas',
        novaMesa: 'Nova Comanda',
        garcom: 'Vendedor',
        atendente: 'Atendente/Vendedor',
        cozinha: 'Preparação/Estoque',
        kds: 'Painel de Preparação',
        salao: 'Balcão/Lojas',
        buscarMesa: 'Buscar comanda...',
        limparLivres: 'Limpar Livres',
        mesasAntigas: 'Comandas Antigas',
        mandarParaCozinha: 'Mandar p/ Preparação',
        prontoMesa: 'Pronto (Comanda)',
        chamarGarcom: 'Chamando Atendente',
        pedindoConta: 'Pedindo Fechamento',
        comandaRecibo: 'Consumo Geral Comanda',
        transferirMesa: 'Transferir / Juntar Comanda',
        resumoMesa: 'Resumo da Comanda',
        conferenciaMesa: 'Imprimir Pré-Conferência (Comanda)',
        cardapio: 'Catálogo',
        pedirConta: 'Pedir Fechamento',
        chamarGarcomBotao: 'Chamar Vendedor',
        solicitarContaSucesso: 'Fechamento solicitado com sucesso!',
        chamarGarcomSucesso: 'Vendedor chamado com sucesso!'
    },
    servicos: {
        mesa: 'Ficha/Ticket',
        mesas: 'Fichas/Tickets',
        novaMesa: 'Nova Ficha',
        garcom: 'Atendente',
        atendente: 'Atendente',
        cozinha: 'Setor de Serviço',
        kds: 'Painel de Execução',
        salao: 'Atendimento',
        buscarMesa: 'Buscar ficha/ticket...',
        limparLivres: 'Limpar Livres',
        mesasAntigas: 'Fichas Antigas',
        mandarParaCozinha: 'Mandar p/ Execução',
        prontoMesa: 'Pronto (Ficha)',
        chamarGarcom: 'Chamando Atendente',
        pedindoConta: 'Solicitando Conta',
        comandaRecibo: 'Consumo Geral Ficha',
        transferirMesa: 'Transferir / Juntar Ficha',
        resumoMesa: 'Resumo da Ficha',
        conferenciaMesa: 'Imprimir Pré-Conferência (Ficha)',
        cardapio: 'Catálogo',
        pedirConta: 'Pedir a Conta',
        chamarGarcomBotao: 'Chamar Atendente',
        solicitarContaSucesso: 'Conta solicitada com sucesso!',
        chamarGarcomSucesso: 'Atendente chamado com sucesso!'
    }
};

/**
 * Retorna o termo correto dependendo do tipo do negócio
 * @param {string} key - A chave do termo
 * @param {string} tipoNegocio - O tipo de negócio ('restaurante', 'varejo', 'servicos')
 * @returns {string} O termo correspondente
 */
export function getTerminology(key, tipoNegocio) {
    const businessType = tipoNegocio || 'restaurante';
    const terms = terminologies[businessType] || terminologies.restaurante;
    return terms[key] || terminologies.restaurante[key] || key;
}
