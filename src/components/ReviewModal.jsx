// src/components/ReviewModal.jsx — Avaliação pós-pedido
import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import { IoStarOutline, IoStar, IoClose, IoSendOutline } from 'react-icons/io5';

export default function ReviewModal({ isOpen, onClose, pedidoId, estabelecimentoId, clienteNome, clienteId }) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return toast.warn('Selecione uma nota!');
    setEnviando(true);
    try {
      const reviewId = `${pedidoId}_${clienteId || 'anon'}`;
      // Salva na subcoleção de pedidos (mesmo path que já tem permissão)
      await setDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', pedidoId), {
        avaliacao: { estrelas: rating, comentario: comentario.trim(), clienteNome: clienteNome || 'Anônimo', clienteId: clienteId || null, criadoEm: new Date() }
      }, { merge: true });
      setEnviado(true);
      toast.success('Obrigado pela avaliação! ⭐');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao enviar avaliação');
    }
    setEnviando(false);
  };

  const ratingLabels = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente!'];
  const ratingEmojis = ['', '😡', '😕', '😐', '😊', '🤩'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up">
        
        {enviado ? (
          /* THANK YOU */
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">Obrigado!</h2>
            <p className="text-gray-500 text-sm mb-6">Sua avaliação ajuda a melhorar nosso serviço</p>
            <div className="flex justify-center gap-1 mb-6">
              {[1,2,3,4,5].map(s => (
                <IoStar key={s} className={`text-3xl ${s <= rating ? 'text-amber-400' : 'text-gray-200'}`} />
              ))}
            </div>
            <button onClick={onClose} className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all">
              Fechar
            </button>
          </div>
        ) : (
          /* REVIEW FORM */
          <>
            <div className="p-6 pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-black text-gray-800">Como foi?</h2>
                  <p className="text-xs text-gray-400 font-medium">Avalie seu pedido</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                  <IoClose size={20} />
                </button>
              </div>
            </div>

            {/* STARS */}
            <div className="px-6 py-4 text-center">
              <div className="flex justify-center gap-2 mb-2">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-125 active:scale-90"
                  >
                    {star <= (hoveredStar || rating) ? (
                      <IoStar className="text-4xl text-amber-400 drop-shadow-sm" />
                    ) : (
                      <IoStarOutline className="text-4xl text-gray-300" />
                    )}
                  </button>
                ))}
              </div>
              {(hoveredStar || rating) > 0 && (
                <p className="text-sm font-bold text-gray-600">
                  {ratingEmojis[hoveredStar || rating]} {ratingLabels[hoveredStar || rating]}
                </p>
              )}
            </div>

            {/* COMMENT */}
            <div className="px-6 pb-2">
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="Conte mais sobre sua experiência (opcional)..."
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm resize-none h-24 outline-none focus:ring-2 focus:ring-amber-500/30 focus:bg-white transition-all"
                maxLength={300}
              />
              <p className="text-[10px] text-gray-400 text-right mt-1">{comentario.length}/300</p>
            </div>

            {/* SUBMIT */}
            <div className="p-6 pt-2">
              <button
                onClick={handleSubmit}
                disabled={enviando || rating === 0}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-200"
              >
                {enviando ? 'Enviando...' : <><IoSendOutline size={16}/> Enviar Avaliação</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
