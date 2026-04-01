# Design System: Mata Fome — Plataforma de Pedidos & PDV

> **Fonte da Verdade** para qualquer novo componente, tela ou prompt de geração de UI.  
> Toda decisão de design deve seguir este documento.

---

## 1. Identidade Visual & Atmosfera

O Mata Fome é uma plataforma **operacional de alta-performance** para restaurantes e deliveries. O design deve transmitir:

- **Velocidade** — operadores de cozinha e garçons não podem perder tempo. A UI é **densa, clara e funcional**.
- **Confiança** — paleta high-contrast em preto + amarelo gera legibilidade imediata mesmo em ambientes com luz ruim.
- **Energia** — o amarelo vibrante é a âncora emocional da marca: apetitoso, urgente, jovem.

Mood geral: **Operacional Ágil** — nem minimalismo suave, nem excesso de decoração. Cada elemento tem propósito.

---

## 2. Paleta de Cores & Papéis

| Token CSS | Nome Descritivo | Hex | Papel Funcional |
|---|---|---|---|
| `--cor-de-destaque-principal` | **Amarelo Mata Fome** | `#FFD400` | CTAs primários, badges, destaques ativos |
| `--cor-principal-hover` | **Amarelo Dourado Escuro** | `#E6BE00` | Estado hover de botões amarelos |
| `--cor-texto-escuro` | **Preto Sólido** | `#000000` | Textos principais, ícones, bordas fortes |
| `--cor-fundo-claro` | **Branco Puro** | `#FFFFFF` | Fundo de cards, modais, superfícies |
| `--fundo-pagina` | **Cinza Slate Frio** | `#f8fafc` | Background da página (Slate 50) |
| `--texto-titulo` | **Azul-Quase-Preto** | `#0f172a` | Títulos de seções (Slate 900) |
| `--texto-corpo` | **Cinza Médio** | `#475569` | Textos descritivos, legendas (Slate 600) |
| `--cor-cinza-texto` | **Cinza Escuro** | `#4A4A4A` | Textos gerais secundários |

### Cores de Estado (Semânticas)

| Papel | Valor | Contexto de Uso |
|---|---|---|
| **Sucesso / Pago** | `green-500` / `#22c55e` | Status de pedido pago, confirmações |
| **Erro / Cancelado** | `red-500` / `#ef4444` | Alertas críticos, exclusões |
| **Atenção / Pendente** | `yellow-400` / `#facc15` | Pedidos aguardando, warnings |
| **Info / Entrega** | `blue-500` / `#3b82f6` | Status de entrega, informações |
| **Neutro / Inativo** | `gray-300` / `#d1d5db` | Elementos desabilitados, bordas suaves |

---

## 3. Tipografia

**Família Única:** `Poppins` (Google Fonts) — usada em **todos** os contextos.

```
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
font-family: 'Poppins', sans-serif;
```

| Nível | Peso | Tamanho Sugerido | Uso |
|---|---|---|---|
| **Título Principal (H1)** | `font-bold` (700) | `text-3xl` — `3rem` | Títulos de páginas, hero sections |
| **Subtítulo (H2/H3)** | `font-semibold` (600) | `text-xl` — `text-2xl` | Cabeçalhos de seção, nome de pedido |
| **Label de Campo** | `font-semibold` (600) | `text-sm` | Labels de formulários, colunas de tabela |
| **Corpo** | `font-normal` (400) | `text-base` | Descrições, conteúdo textual |
| **Nota / Caption** | `font-normal` (400) | `text-xs` — `text-sm` | Metadados, horários, complementos |
| **Cupom Térmico** | `font-mono font-bold` | `12px` | Impressão em impressora 58mm/80mm |

> ⚠️ **Regra:** Nunca usar fontes diferentes de Poppins em tela. Para impressão térmica, usar `Courier New, monospace`.

---

## 4. Estilo de Componentes

### Botões

| Variante | Classes | Uso |
|---|---|---|
| **Primário (CTA)** | `bg-yellow-400 text-black font-semibold rounded-lg px-4 py-2 hover:bg-yellow-500` | Ação principal (Confirmar, Finalizar) |
| **Primário Sólido da Marca** | `bg-[#FFD400] text-black` | Botões de destaque máximo |
| **Secundário / Fantasma** | `border border-gray-300 text-gray-700 bg-white rounded-lg` | Ações secundárias (Cancelar, Voltar) |
| **Perigo / Destrutivo** | `bg-red-500 text-white rounded-lg` | Excluir, cancelar pedido |
| **Sucesso** | `bg-green-500 text-white rounded-lg` | Confirmar recebimento, marcar pago |
| **Ícone + Texto (PDV)** | `flex items-center gap-2` + variante acima | Botões do painel operacional |

**Geometria dos botões:** Cantos **suavemente arredondados** (`rounded-lg` = `8px`). Nunca pill-shape em ações críticas.

### Cards & Containers

- **Fundo:** `bg-white`
- **Bordas:** `border border-gray-200` ou `border border-gray-100`
- **Arredondamento:** `rounded-xl` (cards de produto/pedido) ou `rounded-2xl` (modais)
- **Sombra:** `shadow-sm` (repouso) → `shadow-md` (hover/ativo). Design **quase-flat**, sem sombras pesadas.
- **Separadores internos:** `divide-y divide-gray-100`

### Modais

- **Overlay:** `bg-black/50` ou `bg-black/60` (backdrop semi-transparente)
- **Container:** `bg-white rounded-2xl p-6` com `max-w-md` a `max-w-2xl` dependendo do conteúdo
- **Posicionamento:** Centralizado na viewport (`fixed inset-0 flex items-center justify-center`)
- **Scroll interno:** `overflow-y-auto max-h-[90vh]` para modais longos

### Inputs & Formulários

- **Campo padrão:** `border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400`
- **Fundo do input:** `bg-white` (sempre, nunca acinzentado)
- **Labels:** `font-semibold text-sm text-gray-700 mb-1`
- **Select:** Mesmo estilo do input padrão
- **Erro de validação:** `border-red-500` + texto auxiliar `text-red-500 text-xs`

### Badges & Status Chips

```
Estrutura: rounded-full px-2 py-0.5 text-xs font-semibold
```

| Status | Estilo |
|---|---|
| Pago | `bg-green-100 text-green-700` |
| Pendente | `bg-yellow-100 text-yellow-700` |
| Cancelado | `bg-red-100 text-red-700` |
| Em Preparo | `bg-blue-100 text-blue-700` |
| Delivery | `bg-purple-100 text-purple-700` |

### Tabelas (Admin/Dashboard)

- **Cabeçalho:** `bg-gray-50 text-gray-600 text-sm font-semibold uppercase tracking-wide`
- **Linhas:** `bg-white border-b border-gray-100 hover:bg-gray-50`
- **Zebra opcional:** `even:bg-gray-50`

---

## 5. Princípios de Layout

### Grid & Espaçamento

- **Container base:** `max-w-7xl mx-auto px-4`
- **Espaçamento interno entre seções:** `gap-4` a `gap-6`
- **Padding de cards:** `p-4` (compacto) ou `p-6` (padrão)
- **Stack vertical de elementos:** `space-y-4`

### Densidade Visual

O painel operacional (PDV, Painel de Cozinha) usa **densidade alta**: mais informação por cm². O cardápio público usa **densidade média** com imagens generosas.

### Responsividade

- **Mobile-first:** Toda feature deve funcionar em telas `min-w-320px`
- **Breakpoints principais:** `sm:640px` / `md:768px` / `lg:1024px`
- **Menu/Header:** Colapsa para hamburguer abaixo de `md`
- **Painel PDV:** Otimizado para tablets (`768px+`) e desktop

---

## 6. Animações & Micro-interações

| Elemento | Animação |
|---|---|
| **Skeleton Loader** | Shimmer linear (90°), ciclo 1.5s ease-in-out |
| **Hover em cards** | `transition-shadow duration-200` |
| **Hover em botões** | `transition-colors duration-150` |
| **Abrir modais** | `opacity 0→1` + leve `translate-y` de baixo para cima (opcional) |
| **Notificações / Toast** | Desliza da borda superior ou inferior |

> Regra: Animações devem ser **funcionais** (comunicar estado), nunca decorativas por si só.

---

## 7. Iconografia

- **Biblioteca:** React Icons (`react-icons`) — família `Fi` (Feather), `Bi`, `Gi`, `Md`, `Fa6`
- **Tamanho padrão:** `size={18}` a `size={24}` em UIs operacionais
- **Cor dos ícones:** Herdada do contexto (`currentColor`) ou `text-gray-500` para ícones neutros
- **Ícones de ação** (deletar, editar): sempre acompanham tooltip ou label visível

---

## 8. Impressão Térmica (Regras Especiais)

Para cupons fiscais e comandas (impressora 58mm/80mm):

```css
font-family: 'Courier New', Courier, monospace;
font-size: 12px;
font-weight: bold;
color: black;
background: white;
```

- Usar apenas `border-dashed` preto para separadores
- Nenhuma cor de fundo além de branco
- IDs de componente de impressão: `#printable-receipt`, `#area-impressao`
- Classe para ocultar na impressão: `.no-print`

---

## 9. Padrões de Nomenclatura de Componentes

| Padrão | Exemplos |
|---|---|
| **Modal** | `ModalPagamento`, `AdicionaisModal`, `VariacoesModal` |
| **Card** | `PedidoCard`, `MesaCard`, `AdminProductCard` |
| **Header / Layout** | `Header`, `Layout`, `Footer` |
| **Dashboard** | `DashBoardSummary`, `DateRangeFilter` |
| **Impressão** | `ComandaParaImpressao`, `ComandaSalaoImpressao` |

---

## 10. Checklist para Novos Componentes

Antes de criar qualquer novo componente, confirme:

- [ ] Usa `Poppins` como fonte (sem exceções em tela)
- [ ] Paleta de cores restrita aos tokens definidos neste documento
- [ ] Botão primário usa `#FFD400` / `bg-yellow-400`
- [ ] Sombras são `shadow-sm` ou `shadow-md` (nunca pesadas)
- [ ] Labels de status usam o padrão de badges `rounded-full`
- [ ] Responsivo mobile-first
- [ ] Animações são `150ms`–`200ms`, `ease-in-out`
- [ ] Classes de impressão isoladas com `.no-print` e `@media print`
