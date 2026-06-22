// src/components/IdeaCopilot.jsx
import React, { useState, useRef } from 'react';
import { IoCloseOutline, IoSparklesOutline, IoCheckmarkCircleOutline, IoAlertCircleOutline, IoMicOutline, IoStopCircleOutline } from 'react-icons/io5';
import { parseProjectText } from '../services/aiService';
import { toast } from 'react-toastify';

export default function IdeaCopilot({
  isOpen,
  onClose,
  isMarmoraria = false,
  onApplyParameters
}) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const toggleVoice = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let finalTranscript = inputText;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInputText(finalTranscript + (interim ? ' ' + interim : ''));
    };
    recognition.onerror = () => {
      setIsRecording(false);
      toast.error('Erro ao gravar áudio.');
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    recognition.start();
    setIsRecording(true);
    toast.info('🎙️ Fale agora... Descreva o pedido do cliente.');
  };

  if (!isOpen) return null;

  // Exemplos rápidos para preenchimento fácil
  const exemplos = isMarmoraria
    ? [
        "Bancada de cozinha granito preto são gabriel de 1800 de largura por 600 de profundidade, saia de 4cm, rodopia de 10cm, acabamento reto lapidado para a cliente Júlia da silva tel 11988887777",
        "Lavatório de banheiro mármore carrara com cuba esculpida, largura 900mm por 500mm, rodopia de 12cm em nome de Roberto, Rua das Flores 123"
      ]
    : [
        "Preciso de um box Elegance incolor de largura 1400 por 1900 de altura, com alumínio preto e puxador padrão para o cliente Matheus Jardim, tel 11977775555",
        "Janela de correr de 4 folhas fumê com perfil branco de 1600 de largura por 1200 de altura, observação urgente instalar até sexta"
      ];

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      return toast.warn('Digite ou cole a solicitação do cliente primeiro!');
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const parsed = await parseProjectText(inputText, isMarmoraria);
      setResult(parsed);
      toast.success('🪄 Pedido interpretado com sucesso pela IA!');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro inesperado ao consultar a inteligência artificial.');
      toast.error('Falha ao analisar texto.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApplyParameters(result);
    setInputText('');
    setResult(null);
    onClose();
    toast.success('✅ Parâmetros aplicados com sucesso à calculadora!');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end select-none">
      
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <IoSparklesOutline className="text-amber-400 animate-pulse" size={20} />
            <div>
              <h3 className="text-base font-black tracking-tight">IdeaCopilot 🤖</h3>
              <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-wide">Assistente de Vendas por IA</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
          >
            <IoCloseOutline size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-5 space-y-5">
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide block">
                Descreva o pedido em linguagem natural:
              </label>
              <button
                type="button"
                onClick={toggleVoice}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {isRecording ? (
                  <><IoStopCircleOutline size={14} /> Parar</>  
                ) : (
                  <><IoMicOutline size={14} /> Falar</>  
                )}
              </button>
            </div>
            <textarea
              className={`w-full h-32 text-xs font-semibold p-3 border rounded-xl focus:ring-slate-900 focus:border-slate-900 ${
                isRecording ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'
              }`}
              placeholder={isMarmoraria 
                ? "Ex: Bancada de cozinha no verde ubatuba, 1800 por 600..." 
                : "Ex: Box de correr fumê 1.30m de largura por 1.90m com kit fosco..."}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
            />
          </div>

          {/* Exemplos Rápidos */}
          <div className="space-y-1.5">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Templates sugeridos (Clique para usar)</span>
            <div className="space-y-1">
              {exemplos.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputText(ex)}
                  className="w-full text-left text-[10px] font-bold p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-950 transition-all leading-normal"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-black text-white font-black uppercase tracking-wider py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-slate-900/10 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <IoSparklesOutline className="text-amber-400" size={14} />
                <span>Analisar e Preencher com IA</span>
              </>
            )}
          </button>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-red-700">
              <IoAlertCircleOutline className="shrink-0 mt-0.5" size={16} />
              <div className="text-[10px] font-bold">
                <p className="uppercase font-black text-red-800">Falha na Conexão</p>
                <p className="mt-1 leading-normal">{error}</p>
                <p className="mt-2 text-red-500 font-semibold">⚠️ Certifique-se de que configurou corretamente a chave de API no arquivo .env</p>
              </div>
            </div>
          )}

          {/* Parsed Result Display */}
          {result && (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-1.5 text-emerald-800 border-b border-emerald-100 pb-2">
                <IoCheckmarkCircleOutline size={18} />
                <span className="text-xs font-black uppercase tracking-wider">Entendido pela IA</span>
              </div>

              {/* Explanation Summary */}
              {result.explicacao && (
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100 text-[10px] text-slate-700 leading-normal font-semibold">
                  📌 {result.explicacao}
                </div>
              )}

              {/* Param Table */}
              <div className="grid grid-cols-2 gap-3 text-[10px] font-semibold text-slate-600">
                {isMarmoraria ? (
                  <>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Modelo</span>
                      <span className="text-slate-800 font-bold uppercase">{result.modelo}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Rocha / Pedra</span>
                      <span className="text-slate-800 font-bold">{result.pedra}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Largura (mm)</span>
                      <span className="text-slate-900 font-extrabold">{result.largura} mm</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Profundidade (mm)</span>
                      <span className="text-slate-900 font-extrabold">{result.profundidade} mm</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Saia Frontal</span>
                      <span className="text-slate-800 font-bold">{result.saiaAtiva ? `${result.alturaSaia} mm` : 'Não'}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Rodopia (Atrás)</span>
                      <span className="text-slate-800 font-bold">{result.rodopiaAtivo ? `${result.alturaRodopia} mm` : 'Não'}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Borda Acabamento</span>
                      <span className="text-slate-800 font-bold">{result.acabamento}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Tipo</span>
                      <span className="text-slate-800 font-bold uppercase">{result.modelo}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Modelo Nome</span>
                      <span className="text-slate-800 font-bold">{result.modeloNome}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Largura (mm)</span>
                      <span className="text-slate-900 font-extrabold">{result.largura} mm</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Altura (mm)</span>
                      <span className="text-slate-900 font-extrabold">{result.altura} mm</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Vidro Cor</span>
                      <span className="text-slate-800 font-bold">{result.corVidro}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Alumínio Cor</span>
                      <span className="text-slate-800 font-bold">{result.corAluminio}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Puxador</span>
                      <span className="text-slate-800 font-bold">{result.puxador}</span>
                    </div>
                  </>
                )}

                {/* Info Cliente */}
                <div className="col-span-2 border-t border-emerald-100 pt-2 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Cliente Nome</span>
                    <span className="text-slate-800 font-bold">{result.clienteNome || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Telefone</span>
                    <span className="text-slate-800 font-bold">{result.clienteTelefone || 'Não informado'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Endereço de Entrega</span>
                    <span className="text-slate-800 font-bold leading-normal block">{result.clienteEndereco || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Final Confirm */}
              <button
                onClick={handleApply}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/10"
              >
                <span>Aplicar Parâmetros à Calculadora</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
