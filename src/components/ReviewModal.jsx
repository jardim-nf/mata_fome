// src/components/ReviewModal.jsx — Avaliação pós-pedido
import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import { IoStarOutline, IoStar, IoClose, IoSendOutline } from 'react-icons/io5';

export default function ReviewModal({ isOpen, onClose, pedidoId, estabelecimentoId, clienteNome, clienteId, whatsappLoja = '' }) {
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
    } catch (e) {
      console.error(e);
      toast.error('Erro ao enviar avaliação');
    }
    setEnviando(false);
  };

  const handleClickWhatsApp = () => {
    const zap = whatsappLoja ? whatsappLoja.replace(/\D/g, '') : '';
    const link = `https://wa.me/55${zap}?text=${encodeURIComponent(`Olá, sou o(a) ${clienteNome || 'cliente'} e tive um problema com o meu pedido no app. Podemos resolver?`)}`;
    window.open(link, '_blank');
  };

  const ratingLabels = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente!'];
  const ratingEmojis = ['', '😡', '😕', '😐', '😊', '🤩'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up">
        
        {enviado ? (
          /* PÓS-AVALIAÇÃO ESTRATÉGICO */
          <div className="p-8 text-center animate-fade-in text-gray-800">
            {rating <= 3 ? (
              <>
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-black mb-2 text-rose-600">Poxa, pedimos desculpas!</h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  Não queremos que você tenha essa péssima experiência.<br/><strong>Nosso gerente quer resolver isso agora.</strong>
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={handleClickWhatsApp} className="w-full py-3 bg-[#25D366] text-white rounded-2xl font-bold hover:bg-[#1ebd5a] transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-200">
                    Chamar Gerente no WhatsApp
                  </button>
                  <button onClick={onClose} className="w-full py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all">
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4 text-emerald-500 drop-shadow-md">🎉</div>
                <h2 className="text-2xl font-black mb-2 text-emerald-600">Incrível!</h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  Ficamos muito felizes que tenha gostado!<br/>Seu feedback é muito importante para nós.
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => window.open('https://search.google.com/local/writereview', '_blank')} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                    Nos recomende no Google
                  </button>
                  <button onClick={onClose} className="w-full py-3 border-2 border-emerald-500 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-50 transition-all">
                    Concluir
                  </button>
                </div>
              </>
            )}
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
