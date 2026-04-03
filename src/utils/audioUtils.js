export const tocarBeepErro = () => { 
    try { 
        const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
        const osc = ctx.createOscillator(); 
        const gain = ctx.createGain(); 
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(200, ctx.currentTime); 
        gain.gain.setValueAtTime(0.15, ctx.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); 
        osc.connect(gain); 
        gain.connect(ctx.destination); 
        osc.start(); 
        osc.stop(ctx.currentTime + 0.5); 
    } catch (e) { 
        console.error(e); 
    } 
};

export const tocarCampainha = () => {
    try {
        const audio = new Audio('/campainha.mp3');
        audio.volume = 0.8;
        audio.play().catch(() => {
            // Fallback: som sintetizado se o mp3 falhar (ex: offline sem cache)
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const notas = [659.25, 783.99, 1046.50];
                notas.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
                    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
                    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + i * 0.15);
                    osc.stop(ctx.currentTime + i * 0.15 + 0.4);
                });
            } catch (e) { console.error(e); }
        });
    } catch (e) { console.warn('Erro ao tocar campainha:', e); }
};
