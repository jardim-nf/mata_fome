# 🍔 Mata Fome — iFood Partner Integration

> Plataforma de gestão de pedidos multi-canal para restaurantes e estabelecimentos de food service.

---

## 📋 Visão Geral da Aplicação

**Mata Fome** é um sistema completo de gestão de pedidos voltado para pequenos e médios estabelecimentos do segmento de food service no Brasil. A plataforma oferece:

- **Cardápio digital** personalizado com link/QR Code por estabelecimento
- **Painel de pedidos (KDS)** em tempo real com gerenciamento Kanban (recebido → preparo → entrega → finalizado)
- **Integração de pagamentos** via PIX, cartão e dinheiro
- **Controle de estoque** automático com baixa por pedido
- **Impressão automática** de comanda via QZ Tray e impressoras térmicas
- **Gestão de múltiplos canais** (site próprio, salão, delivery)
- **Relatórios financeiros** e histórico de vendas
- **Notificações em tempo real** via Firebase e WhatsApp

A integração com o **iFood Partner API** é a evolução natural do produto: nossos clientes já utilizam o iFood como canal de venda e precisam centralizar esses pedidos no mesmo painel onde gerenciam os demais canais, eliminando a necessidade de dois sistemas simultâneos.

---

## 🎯 Objetivo da Integração com o iFood

### Problema que resolvemos

Atualmente, estabelecimentos que usam o Mata Fome **e** o iFood precisam:
1. Gerenciar pedidos do iFood na tela do próprio app do iFood
2. Gerenciar pedidos do site próprio/delivery no Mata Fome
3. Consolidar manualmente os relatórios de ambas as plataformas

Isso gera **retrabalho**, **erros operacionais** e **perda de dados** no controle de estoque e faturamento.

### Solução proposta

Com a integração via **iFood Partner API**, o Mata Fome irá:

- **Receber pedidos do iFood automaticamente** no painel Kanban, junto com os demais canais
- **Atualizar o status do pedido** (confirmado, em preparo, pronto, entregue) diretamente no iFood via API, sem precisar usar dois sistemas
- **Sincronizar o cardápio** do Mata Fome com o cardápio do iFood (preços, disponibilidade, itens)
- **Centralizar os relatórios** de faturamento (iFood + site próprio + salão) em um único dashboard

---

## 🔗 Escopos de API Solicitados

| Escopo | Justificativa |
|--------|---------------|
| `order.read` | Leitura de pedidos recebidos via polling/webhook para exibição no painel KDS |
| `order.write` | Atualização de status do pedido (confirmar, iniciar preparo, concluir) |
| `catalog.read` | Leitura do catálogo para sincronização de itens e preços |
| `catalog.write` | Atualização de disponibilidade de itens (produto esgotado) |
| `merchant.read` | Leitura dos dados do estabelecimento (horário de funcionamento, status online/offline) |
| `merchant.write` | Abertura e fechamento do estabelecimento via painel Mata Fome |

---

## 🏗️ Arquitetura Técnica

### Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + Vite |
| **Backend / BFF** | Firebase Cloud Functions (Node.js 18) |
| **Banco de dados** | Firebase Firestore (NoSQL, real-time) |
| **Autenticação** | Firebase Authentication |
| **Hospedagem** | Firebase Hosting + Vercel |
| **Comunicação API** | REST (HTTPS) com OAuth 2.0 |

### Fluxo de Integração

```
Cliente faz pedido no iFood
         │
         ▼
iFood Partner API (Webhook / Polling)
         │
         ▼
Firebase Cloud Function (backend seguro)
  ├── Valida autenticidade do evento
  ├── Mapeia estrutura do pedido para modelo interno
  ├── Salva em Firestore (estabelecimentos/{id}/pedidos)
  └── Confirma recebimento para o iFood (ACK)
         │
         ▼
Firebase Firestore (tempo real)
         │
         ▼
Painel KDS (React) — atualização instantânea via onSnapshot
  ├── Operador visualiza o pedido iFood ao lado dos outros canais
  ├── Aciona mudança de status
  └── Cloud Function atualiza status no iFood via API
```

### Segurança

- **Credenciais OAuth2** (Client ID / Client Secret) armazenadas exclusivamente em variáveis de ambiente do Firebase Functions — **nunca expostas no frontend**
- **Access tokens** com renovação automática via `refresh_token`
- **Validação de assinatura** em todos os webhooks recebidos
- **HTTPS obrigatório** em todos os endpoints (Firebase Hosting com SSL automático)
- Nenhum dado sensível do pedido é armazenado em `localStorage` ou cookies

---

## 📦 Caso de Uso Principal (User Story)

**Ator:** Operador do restaurante (atendente de balcão ou gerente)

**Cenário:**

1. Cliente realiza pedido no aplicativo iFood
2. O iFood aciona o webhook configurado no Mata Fome
3. O Cloud Function processa o evento, mapeia os dados e salva o pedido no Firestore
4. O painel KDS do operador exibe o novo pedido na coluna **"Novos"**, com badge visual de "iFood" e som de notificação
5. O operador clica em **"Iniciar Preparo"** — a API do iFood é chamada para confirmar o pedido e atualizar o status
6. Ao concluir, o operador clica em **"Pronto para Entrega"** — o iFood é notificado para despachar o entregador
7. O pedido é movido para **"Finalizado"** e os dados são consolidados no relatório diário

---

## 🗂️ Estrutura do Repositório (relevante para integração)

```
src/
├── hooks/
│   └── usePlatformSync.js        # Hook central de sincronização com plataformas externas
├── pages/
│   ├── AdminMultiPlatform.jsx    # Interface de configuração das integrações (iFood, Rappi, etc.)
│   └── Painel.jsx                # Painel KDS com exibição de pedidos de todos os canais
├── services/
│   └── vendaService.js           # Serviço de registros de vendas e emissão fiscal
└── firebase.js                   # Configuração do Firebase SDK

functions/                        # Firebase Cloud Functions (backend)
├── ifood/
│   ├── webhook.js                # Receptor de eventos do iFood
│   ├── orderMapper.js            # Mapeamento do modelo iFood → modelo interno
│   └── statusSync.js             # Sincronização de status bidirecional
└── auth/
    └── ifoodOAuth.js             # Gerenciamento de tokens OAuth2 do iFood
```

---

## 🔄 Mapeamento de Dados

### Pedido iFood → Modelo Mata Fome

| Campo iFood | Campo Mata Fome | Observação |
|-------------|-----------------|------------|
| `id` | `vendaId` | ID externo preservado para rastreabilidade |
| `customer.name` | `cliente.nome` | — |
| `customer.phone` | `cliente.telefone` | — |
| `deliveryAddress` | `cliente.endereco` | Estruturado em rua, número, bairro, cidade |
| `items[].name` | `itens[].nome` | — |
| `items[].unitPrice` | `itens[].preco` | Em centavos → convertido para reais |
| `items[].quantity` | `itens[].quantidade` | — |
| `displayTotalPrice` | `totalFinal` | Valor final com taxa iFood deduzida |
| `orderType` | `tipoEntrega` | `DELIVERY` ou `TAKEOUT` |
| `payments[0].method` | `formaPagamento` | Mapeado para padrão interno |
| `"PLACED"` | `"recebido"` | Status inicial |
| `"CONFIRMED"` | `"preparo"` | Após ACK do restaurante |
| `"READY_TO_PICKUP"` | `"pronto_para_servir"` | Aguardando entregador |
| `"DISPATCHED"` | `"em_entrega"` | Entregador a caminho |
| `"CONCLUDED"` | `"finalizado"` | Pedido encerrado |

---

## ✅ Conformidade com Políticas do iFood

- A aplicação **não redistribui** dados dos clientes do iFood para terceiros
- Os dados dos pedidos são utilizados **exclusivamente** para operação interna do restaurante parceiro
- O operador do restaurante é o **único usuário** com acesso ao painel e aos dados de pedidos
- A autenticação OAuth2 é específica por estabelecimento — **cada restaurante autoriza individualmente**
- A plataforma não realiza scraping, acesso indevido ou automação fora do escopo aprovado

---

## 🌐 Informações do Desenvolvedor

| Campo | Informação |
|-------|-----------|
| **Nome da aplicação** | Mata Fome |
| **Categoria** | Order Management System (OMS) / PDV |
| **Público-alvo** | Restaurantes, lanchonetes e food trucks de pequeno e médio porte |
| **Ambientes** | Sandbox (desenvolvimento e testes) + Production |
| **Tipo de integração** | Server-to-server via Cloud Functions + Webhook endpoint |
| **Endpoint de Webhook** | `https://us-central1-{project-id}.cloudfunctions.net/ifoodWebhook` |
| **Redirect URI (OAuth)** | `https://app.matafome.com.br/admin/integracoes/ifood/callback` |

---

## 🧪 Plano de Testes (Sandbox)

1. **Autenticação OAuth2** — Troca de `code` por `access_token` e armazenamento seguro
2. **Polling de pedidos** — `GET /order/v1.0/events:polling` com intervalo de 30 segundos
3. **Confirmação de pedido** — `POST /order/v1.0/{orderId}/confirm`
4. **Atualização de status** — Fluxo completo: confirm → startPreparation → readyToPickup → dispatch → conclude
5. **Sincronização de cardápio** — Listagem e atualização de disponibilidade de itens
6. **Gestão de horário** — Abertura e fechamento do restaurante via API
7. **Tratamento de erros** — Pedidos cancelados, timeouts e reconexão automática

---

## 📞 Contato

Para dúvidas sobre a integração ou esclarecimentos adicionais sobre o caso de uso, disponibilizamos os seguintes canais:

- **Responsável técnico:** Matheus (Desenvolvedor Principal — Mata Fome)
- **E-mail:** contato@matafome.com.br
- **Site:** https://matafome.com.br

---

*Documento elaborado para submissão ao Portal de Parceiros iFood — iFood Partner API Developer Program.*
