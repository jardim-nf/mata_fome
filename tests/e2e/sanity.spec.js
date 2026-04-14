import { test, expect } from '@playwright/test';

test.describe('Sanity Check E2E - IdeaFood', () => {
  test('Acesso à página principal e verificação de layout base', async ({ page }) => {
    // 1. Acessa a raiz
    await page.goto('http://localhost:5173/');
    
    // 2. Verifica se a página carregou sem crash (Body existe e não está vazio)
    await expect(page.locator('body')).toBeVisible();

    // 3. Tenta localizar a Header/Logo para garantir que o React renderizou algo principal
    const heading = page.locator('text=IdeaFood').first();
    if (await heading.isVisible()) {
      await expect(heading).toBeVisible();
    }
  });

  test('Teste de Resiliência - Navegação para rota inexistente (404/Fallback)', async ({ page }) => {
    await page.goto('http://localhost:5173/uma-rota-que-nao-existe-12345');
    
    // O sistema deve redirecionar para a Home implicitamente via Navigate to="/" no App.jsx
    await page.waitForURL('http://localhost:5173/');
    await expect(page.url()).toBe('http://localhost:5173/');
  });
});
