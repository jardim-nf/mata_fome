// src/components/AdicionarMesaModal.jsx

import { useState, useEffect } from 'react';
import { IoClose, IoRestaurantOutline, IoAlertCircle, IoCheckmarkCircle } from 'react-icons/io5';

export default function AdicionarMesaModal({ isOpen, onClose, onSave, mesasExistentes = [] }) {
  const [numeroMesa, setNumeroMesa] = useState('');
  const [erro, setErro] = useState('');
  const [validando, setValidando] = useState(false);

  // Limpar form quando abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setNumeroMesa('');
      setErro('');
      setValidando(false);
    }
  }, [isOpen]);

  const validarMesa = (numero) => {
    if (!numero.trim()) {
      return 'Digite o número ou nome da mesa';
    }

    const numeroFormatado = numero.trim();
    
    // Verificar se já existe mesa com esse número/nome
    const jaExiste = mesasExistentes.some(mesa => 
      String(mesa.numero).toLowerCase() === String(numeroFormatado).toLowerCase()
    );

    if (jaExiste) {
      return `Já existe uma mesa com o número/nome "${numeroFormatado}"`;
    }

    // Verificar se é número válido (se for numérico)
    if (!isNaN(numeroFormatado) && numeroFormatado !== '') {
      const num = parseInt(numeroFormatado);
      if (num <= 0) {
        return 'O número da mesa deve ser maior que zero';
      }
      if (num > 999) {
        return 'Número de mesa muito grande (máx: 999)';
      }
    }

    // Verificar comprimento máximo para texto
    if (numeroFormatado.length > 20) {
      return 'Nome da mesa muito longo (máx: 20 caracteres)';
    }

    // Verificar caracteres inválidos
    const caracteresInvalidos = /[<>""'&]/;
    if (caracteresInvalidos.test(numeroFormatado)) {
      return 'Caracteres inválidos no nome da mesa';
    }

    return null; // Sem erros
  };

  const handleInputChange = (value) => {
    setNumeroMesa(value);
    
    // Validação em tempo real (após usuário parar de digitar)
    if (validando) {
      clearTimeout(validando);
    }
    
    setValidando(setTimeout(() => {
      const erroValidacao = validarMesa(value);
      setErro(erroValidacao || '');
    }, 500));
  };

  const handleSave = () => {
    const erroValidacao = validarMesa(numeroMesa);
    
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    // Se passou em todas as validações, salvar
    onSave(numeroMesa.trim());
    setNumeroMesa('');
    setErro('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const numeroValido = numeroMesa.trim() && !erro;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all">
      <div className="bg-white rounded-2xl shadow-2xl flex-col sm:flex-row max-w-md transform transition-all duration-200 scale-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <IoRestaurantOutline className="text-blue-600 text-lg" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Nova Mesa</h3>
              <p className="text-sm text-gray-500">Adicione uma nova mesa ao salão</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <IoClose className="text-xl text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Número ou Nome da Mesa *
            </label>
            <div className="relative">
              <input
                type="text"
                value={numeroMesa}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ex: 1, 2, A, VIP..."
                className={`flex-col sm:flex-row px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all text-lg font-medium ${
                  erro 
                    ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                    : numeroValido 
                    ? 'border-green-300 focus:ring-green-500 bg-green-50'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                autoFocus
              />
              
              {numeroValido && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <IoCheckmarkCircle className="text-green-500 text-xl" />
                </div>
              )}
            </div>

            {/* Mensagem de erro */}
            {erro && (
              <div className="flex items-center gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <IoAlertCircle className="text-red-500 flex-shrink-0" />
                <span className="text-red-700 text-sm">{erro}</span>
              </div>
            )}

            {/* Dica de uso */}
            {!erro && numeroMesa && (
              <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <IoCheckmarkCircle className="text-blue-500 flex-shrink-0" />
                <span className="text-blue-700 text-sm">Nome disponível</span>
              </div>
            )}
          </div>

          {/* Informações */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">💡 Informações</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Use números (1, 2, 3...) ou nomes (VIP, Varanda...)</li>
              <li>• Cada mesa deve ter um número/nome único</li>
              <li>• Máximo de 20 caracteres</li>
              <li className="text-red-600 font-medium">• Não é permitido duplicar números/nomes</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={!!erro || !numeroMesa.trim()}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <IoCheckmarkCircle className="text-lg" />
            Criar Mesa
          </button>
        </div>
      </div>
    </div>
  );
}