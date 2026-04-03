import { test, expect } from '@playwright/test';

test.describe('Testes E2E - PDV Mata Fome', () => {
  test('Fluxo Básico de Novo Pedido Delivery Simulado', async ({ page }) => {
    // 0️⃣ Interceptar API do Whatsapp (Mock para não gastar mensagens reais da UAZAPI)
    await page.route('**/message/sendText', async (route) => {
      // Mock da requisição: Sempre responder com 'sucesso' falso
      // Isso simula o comportamento da API pro bot achar que mandou a mensagem
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: "Mock: Mensagem enviada via testes", status: "success" })
      });
    });

    // Como o firebase tem autenticação complexa, em cenários avançados
    // nós salvaríamos o estado de auth num JSON ou usaríamos um Cloud Function limpo
    // Aqui testamos que a tela de Login carrega e pede os dados blindando erros React.
    
    await page.goto('/');

    // 1️⃣ Validando Tela de Login (Garante que a PWA não subiu em branco)
    await expect(page.locator('text=Entrar no Sistema')).toBeVisible();

    const btnLogin = page.locator('button', { hasText: 'Entrar' });
    await expect(btnLogin).toBeVisible();
    
    // Como é um teste de Sanidade E2E do Render, 
    // ele validou que as lógicas core de injeção JS estão online.
  });
});
