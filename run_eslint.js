const { ESLint } = require("eslint");
(async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(["src/pages/NossosClientes.jsx", "src/hooks/useTelaPedidosData.js", "src/hooks/useModalPagamentoData.js", "src/hooks/useAdminAnalyticsData.js"]);
  const formatter = await eslint.loadFormatter("json");
  const resultText = formatter.format(results);
  const fs = require('fs');
  fs.writeFileSync('lint_results.json', resultText);
})().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
