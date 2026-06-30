const { spawn, exec } = require('child_process');

console.log("⚡ Howard (QA) ativado! Monitorando os logs de desenvolvimento...");
console.log("Iniciando 'npm run dev'...\n");

// Inicia o processo de desenvolvimento normal do seu projeto
const devProcess = spawn('npm', ['run', 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

let lastAlertTime = 0;
// Evita que o Howard grite várias vezes seguidas se o mesmo erro aparecer muitas vezes
const ALERT_COOLDOWN_MS = 10000; 

function analyzeLog(data) {
  const output = data.toString();
  
  // Imprime o log original no terminal para você ver normalmente
  process.stdout.write(output); 

  // Procura por palavras-chave de erro (case-insensitive)
  if (/(?:error|failed to compile|exception)/i.test(output)) {
    const now = Date.now();
    if (now - lastAlertTime > ALERT_COOLDOWN_MS) {
      lastAlertTime = now;
      console.log("\n⚡ [HOWARD]: Erro detectado! Acionando voz...\n");
      
      // Comando de voz nativo do Mac OS
      exec('say "Chefe, detectei um erro no sistema. Verifique o terminal."');
    }
  }
}

// Monitora as saídas de sucesso e de erro do Vite/Node
devProcess.stdout.on('data', analyzeLog);
devProcess.stderr.on('data', analyzeLog);

devProcess.on('close', (code) => {
  console.log(`\n⚡ Howard: Processo encerrado com código ${code}`);
  process.exit(code);
});
