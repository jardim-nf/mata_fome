/**
 * Utilitários de Áudio para o Painel e PDV
 * Reutilizamos o AudioContext para evitar o erro de limite máximo de contextos nos navegadores,
 * o que é vital para não parar de tocar num dia de pico intenso de delivery.
 */

let audioCtx = null;

// Inicializa o contexto de áudio de forma segura apenas quando necessário,
// garantindo que não crie vários contextos e estoure o limite de memória da aba.
const getAudioContext = () => {
    if (!window.AudioContext && !window.webkitAudioContext) return null;
    
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Em alguns navegadores, o estado pode estar 'suspended' por política de autoplay
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

/**
 * Toca um som de bipe de erro (agressivo/rápido) para chamar a atenção da equipe
 * quando ocorre um bloqueio ou erro.
 */
export const tocarBeepErro = () => { 
    try { 
        const ctx = getAudioContext(); 
        if (!ctx) return;

        const osc = ctx.createOscillator(); 
        const gain = ctx.createGain(); 
        
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(200, ctx.currentTime); 
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); 
        
        osc.connect(gain); 
        gain.connect(ctx.destination); 
        
        osc.start(ctx.currentTime); 
        osc.stop(ctx.currentTime + 0.5); 
    } catch (e) { 
        console.error('Erro ao tocar bipe de erro:', e); 
    } 
};

/**
 * Toca o som de notificação (Padrão: Ding-Dong). 
 * Tenta tocar o arquivo MP3 local primeiro. Se falhar, gera sinteticamente via WebAudio.
 */
export const tocarCampainha = () => {
    try {
        const audio = new Audio('/campainha.mp3');
        audio.volume = 0.8;
        
        audio.play().catch(() => {
            // Fallback (Plano B): Efeito sonoro harmônico, gerado no momento
            try {
                const ctx = getAudioContext();
                if (!ctx) return;
                
                // Som de campainha claro: Notas Mi6 (E6) -> Dó6 (C6)
                const notasDingDong = [ 
                    { frequencia: 1318.51, inicioAtraso: 0 }, 
                    { frequencia: 1046.50, inicioAtraso: 0.25 } 
                ];
                
                notasDingDong.forEach(({ frequencia, inicioAtraso }) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    
                    osc.type = 'sine'; // Onda senoidal = som macio e redondo
                    osc.frequency.setValueAtTime(frequencia, ctx.currentTime + inicioAtraso);
                    
                    gain.gain.setValueAtTime(0, ctx.currentTime + inicioAtraso);
                    // Rápido ataque (subida do som)
                    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + inicioAtraso + 0.02);
                    // Queda (Decay) controlada
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicioAtraso + 0.5);
                    
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    
                    osc.start(ctx.currentTime + inicioAtraso);
                    osc.stop(ctx.currentTime + inicioAtraso + 0.5);
                });
            } catch (erroFallback) { 
                console.error('Erro no fallback do sintetizador sonoro:', erroFallback); 
            }
        });
    } catch (e) { 
        console.warn('Erro fatal ao tocar campainha:', e); 
    }
};

/**
 * Usa o sistema do dispositivo para ler em voz alta a nova comanda!
 * @param {string} mensagem - Texto que a voz mecânica/sintética deve ler.
 */
export const falarNovaComanda = (mensagem) => {
    try {
        if (!('speechSynthesis' in window)) {
            console.warn('Este dispositivo/navegador não suporta Fala (TTS).');
            return;
        }
        
        // Cancela falas anteriores para não embolar uma na outra quando chega monte de pedido
        window.speechSynthesis.cancel();
        
        const locucao = new SpeechSynthesisUtterance(mensagem);
        locucao.lang = 'pt-BR';
        locucao.rate = 1.0;  // Velocidade normal
        locucao.pitch = 1.0; // Pitch 1.0 é OBRIGATÓRIO para soar humano. Anteriormente 1.1 deixava a voz fina/robótica.
        locucao.volume = 1.0;
        
        // Bug do Chrome: getVoices() volta vazio nos primeiros milissegundos
        let vozesAtuais = window.speechSynthesis.getVoices();
        
        const executarFala = () => {
            vozesAtuais = window.speechSynthesis.getVoices();
            const vozesPT = vozesAtuais.filter(v => v.lang.includes('pt') || v.lang.includes('BR'));
            
            // 1. Edge Neural Online / Natural FEMININA (Procurar Francisca)
            let vozIdeal = vozesPT.find(v => (v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('natural')) && !v.name.toLowerCase().includes('antonio'));
            // 2. Google Nativo 
            if (!vozIdeal) vozIdeal = vozesPT.find(v => v.name.toLowerCase().includes('google'));
            // 3. Qualquer Edge nativa Neural 
            if (!vozIdeal) vozIdeal = vozesPT.find(v => v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('natural'));
            // 4. Último caso Edge Nativa que nao seja a Desktop
            if (!vozIdeal) vozIdeal = vozesPT.find(v => !v.name.toLowerCase().includes('desktop'));
            // 5. O que vier
            if (!vozIdeal && vozesPT.length > 0) vozIdeal = vozesPT[0];
            
            console.log("Vozes mapeadas do navegador:", vozesPT.map(v => v.name));
            console.log("Voz Selecionada:", vozIdeal ? vozIdeal.name : "Nenhuma (usa padrão do OS)");
            
            if (vozIdeal) locucao.voice = vozIdeal;
            
            setTimeout(() => {
                window.speechSynthesis.speak(locucao);
            }, 800);
        };

        if (vozesAtuais.length === 0) {
            console.log("Aguardando carregamento de vozes do navegador...");
            window.speechSynthesis.onvoiceschanged = executarFala;
        } else {
            executarFala();
        }
        
    } catch (e) {
        console.warn('Erro na simulação de voz:', e);
    }
};
