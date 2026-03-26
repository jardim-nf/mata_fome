// src/components/menu/SplitPayment.jsx — Dividir conta entre amigos
import React, { useState } from 'react';
import { IoPeopleOutline, IoAddOutline, IoRemoveOutline, IoShareSocialOutline } from 'react-icons/io5';

function SplitPayment({ total, cor = '#EF4444' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pessoas, setPessoas] = useState(2);
  const [splitMode, setSplitMode] = useState('igual'); // igual ou personalizado
  const [valores, setValores] = useState({});

  const valorPorPessoa = total / pessoas;

  const handleShare = () => {
    const texto = `💰 Divisão da Conta\n\nTotal: R$ ${total.toFixed(2).replace('.', ',')}\n👥 ${pessoas} pessoas\n💵 Cada um: R$ ${valorPorPessoa.toFixed(2).replace('.', ',')}\n\n— MataFome 🍔`;
    
    if (navigator.share) {
      navigator.share({ title: 'Divisão da Conta', text: texto }).catch((err) => { console.error(err); });
    } else {
      navigator.clipboard?.writeText(texto);
      alert('Texto copiado!');
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-600 transition-all mt-2">
        <IoPeopleOutline /> Dividir conta
      </button>
    );
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-4 mt-3 border border-gray-200 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-black text-gray-800 flex items-center gap-2">
          <IoPeopleOutline style={{ color: cor }} /> Dividir Conta
        </h4>
        <button onClick={() => setIsOpen(false)} className="text-xs text-gray-400 font-bold hover:text-gray-600">✕ Fechar</button>
      </div>

      {/* Número de pessoas */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-600">Quantas pessoas?</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPessoas(p => Math.max(2, p - 1))}
            className="w-8 h-8 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-all">
            <IoRemoveOutline size={16} />
          </button>
          <span className="text-xl font-black text-gray-900 w-8 text-center">{pessoas}</span>
          <button onClick={() => setPessoas(p => Math.min(20, p + 1))}
            className="w-8 h-8 text-white rounded-full flex items-center justify-center hover:opacity-80 transition-all"
            style={{ backgroundColor: cor }}>
            <IoAddOutline size={16} />
          </button>
        </div>
      </div>

      {/* Resultado */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500">Total da conta</span>
          <span className="text-sm font-bold text-gray-800">R$ {total.toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500">Dividido por</span>
          <span className="text-sm font-bold text-gray-800">{pessoas} pessoas</span>
        </div>
        <div className="border-t border-gray-100 pt-2 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-black text-gray-900">Cada um paga</span>
            <span className="text-lg font-black" style={{ color: cor }}>
              R$ {valorPorPessoa.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>
      </div>

      {/* Compartilhar */}
      <button onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-white rounded-xl text-sm font-bold transition-all hover:opacity-90"
        style={{ backgroundColor: cor }}>
        <IoShareSocialOutline /> Compartilhar divisão
      </button>
    </div>
  );
}

export default SplitPayment;
