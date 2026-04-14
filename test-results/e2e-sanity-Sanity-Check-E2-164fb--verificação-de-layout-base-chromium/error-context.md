# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\sanity.spec.js >> Sanity Check E2E - IdeaFood >> Acesso à página principal e verificação de layout base
- Location: tests\e2e\sanity.spec.js:4:7

# Error details

```
Error: locator.isVisible: Error: strict mode violation: locator('text=IdeaFood') resolved to 6 elements:
    1) <span class="text-xl font-extrabold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">🍔 IdeaFood</span> aka getByText('🍔 IdeaFood')
    2) <span class="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">Pede no IdeaFood!</span> aka getByText('Pede no IdeaFood!')
    3) <div class="font-bold text-sm mb-1 opacity-80">IdeaFood</div> aka getByText('IdeaFood', { exact: true })
    4) <div class="text-2xl font-extrabold text-white mb-4">…</div> aka getByText('IdeaFood.', { exact: true })
    5) <span>contato@ideafood.com.br</span> aka getByText('contato@ideafood.com.br')
    6) <p>© 2026 IdeaFood. Todos os direitos reservados.</p> aka getByText('© 2026 IdeaFood. Todos os')

Call log:
    - checking visibility of locator('text=IdeaFood')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - img [ref=e4]
    - generic [ref=e8]: Conexão restaurada! Dados sincronizados.
  - generic [ref=e9]:
    - generic [ref=e10]:
      - navigation [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]: 🍔 IdeaFood
          - button "Entrar" [ref=e15] [cursor=pointer]:
            - img [ref=e16]
            - text: Entrar
      - generic [ref=e21]:
        - generic [ref=e22]:
          - generic [ref=e23]: 🔥 A plataforma que mais cresce no Brasil
          - heading "Bateu a fome? Pede no IdeaFood!" [level=1] [ref=e25]:
            - text: Bateu a fome?
            - text: Pede no IdeaFood!
          - paragraph [ref=e26]: Sua plataforma própria de delivery, com os melhores estabelecimentos da cidade, entregue rapidinho na sua porta.
          - generic [ref=e27]:
            - button "🍕 Ver Estabelecimentos" [ref=e28] [cursor=pointer]
            - button "📞 Cadastrar Meu Negócio" [ref=e29] [cursor=pointer]
          - generic [ref=e30]:
            - generic [ref=e31]:
              - generic [ref=e32]: 0%
              - generic [ref=e33]: Sem Comissão
            - generic [ref=e34]:
              - generic [ref=e35]: ⚡
              - generic [ref=e36]: Setup Rápido
            - generic [ref=e37]:
              - generic [ref=e38]: 24/7
              - generic [ref=e39]: Disponível
        - img "Pizza Deliciosa IdeaFood" [ref=e42]
      - button [ref=e46] [cursor=pointer]:
        - img [ref=e47]
    - generic [ref=e50]:
      - generic [ref=e51]:
        - heading "Como Funciona" [level=2] [ref=e52]
        - paragraph [ref=e53]: Pedir ficou simples. Três passos e pronto!
      - generic [ref=e55]:
        - generic [ref=e58]:
          - generic [ref=e59]: PASSO 01
          - img [ref=e61]
          - heading "Escolha" [level=3] [ref=e64]
          - paragraph [ref=e65]: Navegue pelos melhores restaurantes e lanchonetes da sua cidade
        - generic [ref=e67]:
          - generic [ref=e68]: PASSO 02
          - img [ref=e70]
          - heading "Peça" [level=3] [ref=e73]
          - paragraph [ref=e74]: Monte seu pedido com facilidade e pague como preferir
        - generic [ref=e76]:
          - generic [ref=e77]: PASSO 03
          - img [ref=e79]
          - heading "Receba" [level=3] [ref=e84]
          - paragraph [ref=e85]: Acompanhe em tempo real e receba na sua porta rapidinho
    - generic [ref=e87]:
      - generic [ref=e88]:
        - heading "Transforme seu Negócio de Delivery" [level=2] [ref=e89]
        - paragraph [ref=e90]: Ferramentas poderosas para você vender mais, organizar melhor e economizar
      - generic [ref=e92]:
        - generic [ref=e93]:
          - button "Venda Mais e Aumente sua Receita" [ref=e94] [cursor=pointer]:
            - img [ref=e96]
            - heading "Venda Mais e Aumente sua Receita" [level=3] [ref=e100]
          - button "Organize sua Operação de Delivery" [ref=e101] [cursor=pointer]:
            - img [ref=e103]
            - heading "Organize sua Operação de Delivery" [level=3] [ref=e109]
          - button "Economize Dinheiro com Comissões" [ref=e110] [cursor=pointer]:
            - img [ref=e112]
            - heading "Economize Dinheiro com Comissões" [level=3] [ref=e115]
        - generic [ref=e119]:
          - generic [ref=e120]:
            - generic [ref=e121]:
              - img [ref=e123]
              - heading "Venda Mais e Aumente sua Receita" [level=3] [ref=e126]
            - generic [ref=e127]: ⭐ +47% em média
          - paragraph [ref=e128]: Crie cupons, programas de fidelidade, campanhas de email e push para fidelizar seus clientes.
          - generic [ref=e129]:
            - generic [ref=e130]:
              - img [ref=e131]
              - text: Cupons personalizados
            - generic [ref=e134]:
              - img [ref=e135]
              - text: Programa de pontos
            - generic [ref=e138]:
              - img [ref=e139]
              - text: Email marketing
            - generic [ref=e142]:
              - img [ref=e143]
              - text: Notificações push
            - generic [ref=e146]:
              - img [ref=e147]
              - text: Relatórios de performance
          - button "Começar a Vender Mais" [ref=e151] [cursor=pointer]
      - generic [ref=e156]:
        - heading "🚫 Chega de Comissões Abusivas!" [level=3] [ref=e157]
        - paragraph [ref=e158]: Compare e veja quanto você pode economizar
        - generic [ref=e159]:
          - generic [ref=e161]:
            - generic [ref=e162]: Ifood
            - generic [ref=e163]: 25-35%
            - generic [ref=e164]: comissão
          - generic [ref=e166]:
            - generic [ref=e167]: Rappi
            - generic [ref=e168]: 28-38%
            - generic [ref=e169]: comissão
          - generic [ref=e171]:
            - generic [ref=e172]: Uber Eats
            - generic [ref=e173]: 30-40%
            - generic [ref=e174]: comissão
          - generic [ref=e176]:
            - generic [ref=e177]: IdeaFood
            - generic [ref=e178]: 0%
            - generic [ref=e179]: comissão
        - paragraph [ref=e180]: "*Valores médios de comissão no mercado — Dados 2024"
      - generic [ref=e181]:
        - heading "Pronto para Transformar seu Delivery?" [level=3] [ref=e182]
        - paragraph [ref=e183]: Junte-se a centenas de estabelecimentos que já aumentaram suas vendas
        - generic [ref=e184]:
          - button "🚀 Começar Agora — 7 Dias Grátis" [ref=e185] [cursor=pointer]
          - button "📞 Falar com Especialista" [ref=e186] [cursor=pointer]
    - generic [ref=e187]:
      - generic [ref=e188]:
        - heading "Nossos Parceiros" [level=2] [ref=e189]
        - paragraph [ref=e190]: Descubra os melhores restaurantes e lanchonetes da sua cidade
      - generic [ref=e193]:
        - img [ref=e194]
        - textbox "Pesquisar estabelecimentos..." [ref=e197]
      - generic [ref=e198]:
        - generic [ref=e199] [cursor=pointer]:
          - generic [ref=e200]:
            - img "MeGusta" [ref=e201]
            - generic [ref=e203]:
              - img [ref=e204]
              - text: "4.5"
          - generic [ref=e206]:
            - heading "MeGusta" [level=3] [ref=e207]
            - paragraph [ref=e208]:
              - img [ref=e209]
          - button "🍽️ Ver Cardápio" [ref=e213]
        - generic [ref=e214] [cursor=pointer]:
          - img [ref=e216]
          - generic [ref=e221]:
            - heading "Cibo Gastronomia" [level=3] [ref=e222]
            - paragraph [ref=e223]:
              - img [ref=e224]
          - button "🍽️ Ver Cardápio" [ref=e228]
        - generic [ref=e229] [cursor=pointer]:
          - generic [ref=e230]:
            - img "CANTINHO D’ NORMA ®️🍔🍟 | HAMBURGUERIA" [ref=e231]
            - generic [ref=e233]:
              - img [ref=e234]
              - text: "4.9"
          - generic [ref=e236]:
            - heading "CANTINHO D’ NORMA ®️🍔🍟 | HAMBURGUERIA" [level=3] [ref=e237]
            - paragraph [ref=e238]:
              - img [ref=e239]
          - button "🍽️ Ver Cardápio" [ref=e243]
        - generic [ref=e244] [cursor=pointer]:
          - generic [ref=e245]:
            - img "Blackburger" [ref=e246]
            - generic [ref=e248]:
              - img [ref=e249]
              - text: "5"
          - generic [ref=e251]:
            - heading "Blackburger" [level=3] [ref=e252]
            - paragraph [ref=e253]:
              - img [ref=e254]
          - button "🍽️ Ver Cardápio" [ref=e258]
        - generic [ref=e259] [cursor=pointer]:
          - generic [ref=e260]:
            - img "American Burguer" [ref=e261]
            - generic [ref=e263]:
              - img [ref=e264]
              - text: "4.5"
          - generic [ref=e266]:
            - heading "American Burguer" [level=3] [ref=e267]
            - paragraph [ref=e268]:
              - img [ref=e269]
              - text: CENTRO, BOM JARDIM
          - button "🍽️ Ver Cardápio" [ref=e273]
        - generic [ref=e274] [cursor=pointer]:
          - generic [ref=e275]:
            - img "BãoBar Bistrô" [ref=e276]
            - generic [ref=e278]:
              - img [ref=e279]
              - text: "4.9"
          - generic [ref=e281]:
            - heading "BãoBar Bistrô" [level=3] [ref=e282]
            - paragraph [ref=e283]:
              - img [ref=e284]
              - text: Rua de Cordeiro, 112, Retiro, Cordeiro
          - button "🍽️ Ver Cardápio" [ref=e288]
        - generic [ref=e289] [cursor=pointer]:
          - generic [ref=e290]:
            - img "Resenha Bistro" [ref=e291]
            - generic [ref=e293]:
              - img [ref=e294]
              - text: "5"
          - generic [ref=e296]:
            - heading "Resenha Bistro" [level=3] [ref=e297]
            - paragraph [ref=e298]:
              - img [ref=e299]
              - text: Prado, Prado, Nova Friburgo - RJ
          - button "🍽️ Ver Cardápio" [ref=e303]
        - generic [ref=e304] [cursor=pointer]:
          - generic [ref=e305]:
            - img "Mata Fome Burguer" [ref=e306]
            - generic [ref=e308]:
              - img [ref=e309]
              - text: "4"
          - generic [ref=e311]:
            - heading "Mata Fome Burguer" [level=3] [ref=e312]
            - paragraph [ref=e313]:
              - img [ref=e314]
          - button "🍽️ Ver Cardápio" [ref=e318]
    - generic [ref=e322]:
      - generic [ref=e324]: 🛵
      - heading "Você é motoboy? Quer fazer um extra?" [level=2] [ref=e325]
      - paragraph [ref=e326]: Cadastre-se no IdeaEntregas, faça seu próprio horário e ganhe por cada entrega realizada no seu raio de atuação. Seja parceiro da nossa rede!
      - button "Quero ser Entregador" [ref=e327] [cursor=pointer]
    - contentinfo [ref=e328]:
      - generic [ref=e329]:
        - generic [ref=e330]:
          - generic [ref=e331]:
            - generic [ref=e332]: IdeaFood.
            - paragraph [ref=e333]: Sua plataforma própria de delivery. Sem comissões abusivas, sem intermediários.
            - generic [ref=e334]:
              - link [ref=e335] [cursor=pointer]:
                - /url: "#"
                - img [ref=e336]
              - link [ref=e339] [cursor=pointer]:
                - /url: "#"
                - img [ref=e340]
              - link [ref=e342] [cursor=pointer]:
                - /url: mailto:contato@ideafood.com.br
                - img [ref=e343]
          - generic [ref=e346]:
            - heading "Links Úteis" [level=4] [ref=e347]
            - list [ref=e348]:
              - listitem [ref=e349]:
                - link "Fale Conosco" [ref=e350] [cursor=pointer]:
                  - /url: https://wa.me/5522999812575
              - listitem [ref=e351]:
                - link "Seja Parceiro" [ref=e352] [cursor=pointer]:
                  - /url: mailto:contato@ideafood.com.br
          - generic [ref=e353]:
            - heading "Contato" [level=4] [ref=e354]
            - list [ref=e355]:
              - listitem [ref=e356]:
                - img [ref=e357]
                - generic [ref=e360]: Bom Jardim, RJ - Brasil
              - listitem [ref=e361]:
                - img [ref=e362]
                - generic [ref=e364]: (22) 99981-2575
              - listitem [ref=e365]:
                - img [ref=e366]
                - generic [ref=e369]: contato@ideafood.com.br
        - generic [ref=e370]:
          - paragraph [ref=e371]: © 2026 IdeaFood. Todos os direitos reservados.
          - paragraph [ref=e372]:
            - text: Feito com
            - img [ref=e373]
            - text: no Brasil
    - generic [ref=e375]:
      - generic [ref=e376]:
        - button [ref=e377] [cursor=pointer]:
          - img [ref=e378]
        - paragraph [ref=e381]: 🍕 Dúvidas? Fale conosco pelo WhatsApp!
      - link [ref=e382] [cursor=pointer]:
        - /url: https://wa.me/5522998102575?text=Ol%C3%A1!%20Vi%20o%20IdeaFood%20e%20gostaria%20de%20saber%20mais%20sobre%20a%20plataforma.
        - img [ref=e383]
    - region "Notifications Alt+T"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Sanity Check E2E - IdeaFood', () => {
  4  |   test('Acesso à página principal e verificação de layout base', async ({ page }) => {
  5  |     // 1. Acessa a raiz
  6  |     await page.goto('http://localhost:5173/');
  7  |     
  8  |     // 2. Verifica se a página carregou sem crash (Body existe e não está vazio)
  9  |     await expect(page.locator('body')).toBeVisible();
  10 | 
  11 |     // 3. Tenta localizar a Header/Logo para garantir que o React renderizou algo principal
  12 |     const heading = page.locator('text=IdeaFood');
> 13 |     if (await heading.isVisible()) {
     |                       ^ Error: locator.isVisible: Error: strict mode violation: locator('text=IdeaFood') resolved to 6 elements:
  14 |       await expect(heading.first()).toBeVisible();
  15 |     }
  16 |   });
  17 | 
  18 |   test('Teste de Resiliência - Navegação para rota inexistente (404/Fallback)', async ({ page }) => {
  19 |     await page.goto('http://localhost:5173/uma-rota-que-nao-existe-12345');
  20 |     
  21 |     // O sistema deve redirecionar para a Home implicitamente via Navigate to="/" no App.jsx
  22 |     await page.waitForURL('http://localhost:5173/');
  23 |     await expect(page.url()).toBe('http://localhost:5173/');
  24 |   });
  25 | });
  26 | 
```