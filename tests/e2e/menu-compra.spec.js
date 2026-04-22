import { test, expect } from '@playwright/test';

test.describe('Fluxo Anti-Tela-Branca do Cardápio', () => {

  test('Deve conseguir abrir o cardápio e ver a interface inicial', async ({ page }) => {
    // 1. Visitamos a URL de teste (Catalogo raiz)
    await page.goto('/catalogo');
    
    // 2. Deve existir um body que não seja vazio
    await expect(page.locator('body')).not.toBeEmpty();
    
    // Testa se o titulo principal ou os inputs / spinners ao menos estão na tela
    // Isso nos garante que o React não engasgou violentamente jogando uma tela branca morta
    const elementExists = await Promise.any([
      page.locator('input[placeholder*="Buscar"]').waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false),
      page.locator('.animate-spin').waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false),
      page.locator('text=Seu Novo Jeito de Pedir').waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
    ]);
    
    // Mesmo que esteja em loading, não deve estar em "tela branca" vazia
    expect(elementExists).toBeTruthy();
  });
  
});
