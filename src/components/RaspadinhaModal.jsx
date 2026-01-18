// src/components/RaspadinhaModal.jsx
import React, { useRef, useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import confetti from 'canvas-confetti'; // Opcional: Instale com 'npm install canvas-confetti' para efeito de festa

const RaspadinhaModal = ({ onGanhar, onClose }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [premioSorteado, setPremioSorteado] = useState(null);
  const [raspadinhaCompletada, setRaspadinhaCompletada] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Lista de Prêmios Possíveis
  const premios = [
    { type: 'desconto', valor: 10, label: '10% DE DESCONTO', icon: '🏷️' },
    { type: 'frete', valor: 0, label: 'FRETE GRÁTIS', icon: '🛵' },
    { type: 'brinde', label: 'BEBIDA GRÁTIS', icon: '🥤', produto: { nome: 'Coca-Cola Lata', preco: 0 } }
  ];

  useEffect(() => {
    // 1. Sortear prêmio ao montar
    const random = Math.floor(Math.random() * premios.length);
    setPremioSorteado(premios[random]);
    
    // 2. Configurar Canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;
    
    // Ajustar tamanho do canvas ao container
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    // Pintar o canvas de cinza/prata (a "tinta" da raspadinha)
    ctx.fillStyle = '#C0C0C0'; // Cor prata
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Adicionar texto "RASPE AQUI"
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText('RASPE AQUI!', canvas.width / 2, canvas.height / 2);
    
    // Configurar pincel para "apagar"
    ctx.globalCompositeOperation = 'destination-out';
  }, []);

  const startDrawing = (e) => setIsDrawing(true);
  const stopDrawing = () => {
    setIsDrawing(false);
    checkProgress();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Suporte para Mouse e Touch
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2); // Tamanho do "pincel"
    ctx.fill();
  };

  const checkProgress = () => {
    if (raspadinhaCompletada) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // Verifica quantos pixels transparentes existem
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparentPixels = 0;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparentPixels++;
    }

    const percent = (transparentPixels / (pixels.length / 4)) * 100;

    // Se raspou mais de 50%, revela tudo
    if (percent > 40) {
      setRaspadinhaCompletada(true);
      canvas.style.opacity = '0'; // Esconde o canvas suavemente
      canvas.style.pointerEvents = 'none'; // Desativa cliques
      
      // Efeito de confete (opcional)
      if (typeof confetti === 'function') confetti();

      // Notifica o pai que ganhou após 1 segundinho
      setTimeout(() => {
        onGanhar(premioSorteado);
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-bounce-in relative">
        <button 
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-20"
        >
            <IoClose size={24} />
        </button>

        <div className="bg-[#FF6B35] p-4 text-center">
            <h2 className="text-white font-bold text-xl">PARABÉNS! 🎉</h2>
            <p className="text-white text-sm opacity-90">Você gastou mais de R$ 100!</p>
        </div>

        <div className="p-6 flex flex-col items-center">
            <p className="text-gray-600 mb-4 font-medium">Raspe e descubra seu prêmio:</p>
            
            <div 
                ref={containerRef} 
                className="relative w-64 h-32 rounded-lg overflow-hidden shadow-inner bg-yellow-100 select-none cursor-pointer"
            >
                {/* O Prêmio (Fica embaixo do Canvas) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 z-0">
                    <span className="text-4xl mb-1">{premioSorteado?.icon}</span>
                    <span className="font-bold text-lg text-gray-800">{premioSorteado?.label}</span>
                </div>

                {/* A "Tinta" (Canvas fica por cima) */}
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
                Raspe com o mouse ou dedo para revelar.
            </p>
        </div>
      </div>
    </div>
  );
};

export default RaspadinhaModal;