/**
 * Calculates inventory/stock requirements based on domain and parsed project data.
 * Eliminates the 2x duplication of this logic in the original component.
 * 
 * @param {string} domain - 'food' | 'glass' | 'marble' | 'dashboard'
 * @param {Object} parsedData - Parsed project data from AI
 * @returns {Object} Inventory data object
 */
export function calculateInventory(domain, parsedData) {
  let matName = 'Insumos Gerais';
  let reqQty = 1.0;
  let stQty = 2.0;
  let supplierName = 'Distribuidora Global';
  let purchaseCost = 150;
  let measureUnit = 'unidades';

  if (domain === 'glass') {
    matName = `Vidro Temperado 8mm ${parsedData?.corVidro || 'Incolor'}`;
    const glassArea = ((parsedData?.largura || 1400) * (parsedData?.altura || 1900)) / 1000000;
    reqQty = parseFloat((glassArea / 2.0).toFixed(2));
    stQty = 1.0;
    supplierName = 'Vidros Blindex Sul';
    purchaseCost = 450;
    measureUnit = 'Chapas';
  } else if (domain === 'marble') {
    matName = parsedData?.pedra || 'Granito Verde Ubatuba';
    const stoneArea = ((parsedData?.largura || 1800) * (parsedData?.profundidade || 600)) / 1000000;
    reqQty = parseFloat((stoneArea / 1.5).toFixed(2));
    stQty = 0.5;
    supplierName = 'Pedreira Central Mármores';
    purchaseCost = 890;
    measureUnit = 'Chapas';
  } else if (domain === 'dashboard') {
    matName = 'Componentes UI Premium';
    reqQty = 1.0;
    stQty = 1.0;
    supplierName = 'Antigravity UI library';
    purchaseCost = 0;
    measureUnit = 'pacotes';
  } else {
    // food
    matName = 'Ingredientes de Base';
    reqQty = 25;
    stQty = 30;
    supplierName = 'Mercado Atacadão Food';
    purchaseCost = 180;
    measureUnit = 'Kg';
  }

  return {
    materialName: matName,
    required: reqQty,
    stock: stQty,
    status: reqQty > stQty ? 'insufficient' : 'safe',
    supplier: supplierName,
    cost: purchaseCost,
    unit: measureUnit
  };
}
