// src/components/RaspadinhaModal.jsx
import React, { useRef, useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import confetti from 'canvas-confetti';

const RaspadinhaModal = ({ onGanhar, onClose, config }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [premioSorteado, setPremioSorteado] = useState(null);
  const [raspadinhaCompletada, setRaspadinhaCompletada] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    // 1. Lógica de Sorteio Baseada na Configuração do Admin
    const sortearPremio = () => {
        // Se não tiver config, usa padrão
        const chance = config?.chance ?? 20; 
        const valor = config?.valor ?? 10;

        const random = Math.random() * 100; // Gera número entre 0 e 100

        if (random <= chance) {
            // GANHOU!
            return { 
                type: 'desconto', 
                valor: valor, 
                label: `${valor}% DE DESCONTO`, 
                icon: '🎉',
                ganhou: true
            };
        } else {
            // PERDEU (Prêmio de consolação)
            return { 
                type: 'nada', 
                valor: 0, 
                label: 'NÃO FOI DESSA VEZ 😢', 
                icon: '🍀',
                ganhou: false
            };
        }
    };

    const premio = sortearPremio();
    setPremioSorteado(premio);
    
    // 2. Configurar Canvas (Tinta Prateada)
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;
    
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    ctx.fillStyle = '#C0C0C0'; // Prata
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Texto "RASPE AQUI"
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText('RASPE AQUI!', canvas.width / 2, canvas.height / 2);
    
    ctx.globalCompositeOperation = 'destination-out';
  }, [config]);

  const startDrawing = () => setIsDrawing(true);
  const stopDrawing = () => {
    setIsDrawing(false);
    checkProgress();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  };

  const checkProgress = () => {
    if (raspadinhaCompletada) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparentPixels = 0;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparentPixels++;
    }

    const percent = (transparentPixels / (pixels.length / 4)) * 100;

    if (percent > 40) { // Se raspou 40%
      setRaspadinhaCompletada(true);
      canvas.style.opacity = '0'; 
      canvas.style.pointerEvents = 'none';
      
      // Se ganhou, solta confete!
      if (premioSorteado?.ganhou) {
          if (typeof confetti === 'function') confetti();
          setTimeout(() => {
            onGanhar(premioSorteado); // Aplica o desconto
          }, 1500);
      } else {
          // Se perdeu, fecha depois de um tempo
          setTimeout(() => {
             onClose();
          }, 2000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-bounce-in relative">
        <button 
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-20"
        >
            <IoClose size={24} />
        </button>

        <div className="bg-[#FF6B35] p-4 text-center">
            <h2 className="text-white font-bold text-xl">RASPADINHA PREMIADA 🎟️</h2>
            <p className="text-white text-sm opacity-90">Tente a sorte e ganhe desconto!</p>
        </div>

        <div className="p-6 flex flex-col items-center">
            <div 
                ref={containerRef} 
                className="relative w-64 h-32 rounded-lg overflow-hidden shadow-inner bg-yellow-50 select-none cursor-pointer border-2 border-dashed border-yellow-300"
            >
                {/* O Prêmio (Fica embaixo) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 z-0">
                    <span className="text-4xl mb-1">{premioSorteado?.icon}</span>
                    <span className={`font-bold text-lg ${premioSorteado?.ganhou ? 'text-green-600' : 'text-gray-500'}`}>
                        {premioSorteado?.label}
                    </span>
                </div>

                {/* A Tinta (Fica por cima) */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 z-10 transition-opacity duration-700"
                    onMouseDown={startDrawing}
                    onMouseUp={stopDrawing}
                    onMouseMove={draw}
                    onTouchStart={startDrawing}
                    onTouchEnd={stopDrawing}
                    onTouchMove={draw}
                />
            </div>
            
            <p className="text-xs text-gray-400 mt-4 text-center">
                Raspe com o dedo ou mouse para revelar.
            </p>
        </div>
      </div>
    </div>
  );
};

export default RaspadinhaModal;