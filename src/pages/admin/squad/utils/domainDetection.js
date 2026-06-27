/**
 * Detects the project domain from the user's prompt.
 * Eliminates the 3x duplication of this logic in the original component.
 * 
 * @param {string} prompt - User input text
 * @returns {'food' | 'glass' | 'marble' | 'dashboard'} - Detected domain
 */
export function detectDomain(prompt) {
  const lower = (prompt || '').toLowerCase();

  if (
    lower.includes('vidro') || lower.includes('glass') || lower.includes('vidr') ||
    lower.includes('box') || lower.includes('janela') || lower.includes('porta') ||
    lower.includes('temperado') || lower.includes('laminado') || lower.includes('7199')
  ) {
    return 'glass';
  }

  if (
    lower.includes('marmore') || lower.includes('granito') || lower.includes('chapa') ||
    lower.includes('pedra') || lower.includes('corte') || lower.includes('borda') ||
    lower.includes('marmor') || lower.includes('pia') || lower.includes('balcao') ||
    lower.includes('soleira') || lower.includes('peitoril') || lower.includes('ilha')
  ) {
    return 'marble';
  }

  if (
    lower.includes('dashboard') || lower.includes('painel') || lower.includes('master') ||
    lower.includes('layout') || lower.includes('confuso') || lower.includes('bonito') ||
    lower.includes('visual') || lower.includes('aba')
  ) {
    return 'dashboard';
  }

  return 'food';
}

/**
 * Returns a human-readable label for a domain.
 * @param {string} domain - Domain key
 * @returns {string}
 */
export function getDomainLabel(domain) {
  const labels = {
    glass: 'IdeaGlass (Vidros)',
    marble: 'IdeaMarmore (Mármore/Granito)',
    dashboard: 'Painel Master (UI/UX)',
    food: 'IdeaFood (Alimentação)',
  };
  return labels[domain] || labels.food;
}
