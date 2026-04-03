import React, { useState, useEffect } from 'react';
import { IoShareOutline } from 'react-icons/io5';

const IosInstallPrompt = () => {
    const [isIos, setIsIos] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Detecta se é um dispositivo Apple e se é Safari (não PWA instalado)
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isInStandaloneMode = ('standalone' in window.navigator) && window.navigator.standalone;
        
        setIsIos(isIosDevice);
        setIsStandalone(isInStandaloneMode);
        
        // Verifica se já foi dispensado nesta sessão/aparelho usando localStorage
        const hasDismissed = localStorage.getItem('ios_pwa_prompt_dismissed');
        if (hasDismissed) {
            setDismissed(true);
        }
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('ios_pwa_prompt_dismissed', 'true');
    };

    if (!isIos || isStandalone || dismissed) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 flex flex-col gap-3 animate-slide-up">
            <div className="flex justify-between items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 shrink-0 bg-emerald-100 rounded-lg">
                    <img src="/pwa-64x64.png" alt="IdeaFood" className="w-8 h-8 rounded-md" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-800">Instale o App</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-snug">
                        Para melhor experiência, instale na Tela de Início. Toque em <IoShareOutline className="inline text-blue-500 text-lg mx-0.5" /> e depois em <strong>Adicionar à Tela de Início</strong>.
                    </p>
                </div>
                <button 
                    onClick={handleDismiss}
                    className="p-1 rounded-full text-slate-400 hover:bg-slate-100 transition-colors"
                >
                    <span className="text-lg font-bold leading-none">&times;</span>
                </button>
            </div>
            
            {/* Seta decorativa apontando para baixo (dock do safari) */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-slate-200 transform rotate-45"></div>
        </div>
    );
};

export default IosInstallPrompt;
