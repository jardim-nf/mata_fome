import React, { useState, useEffect } from 'react';
import { IoClose, IoCash, IoCard, IoQrCode, IoCopy, IoCheckmarkCircle, IoTime, IoChevronDown, IoChevronUp } from 'react-icons/io5';
import { toast } from 'react-toastify';

// --- FUNÇÕES ÚTEIS PARA PIX ---
const sanitizeTxId = (text) => {
    if (!text) return '***';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
};

const sanitizeText = (text) => {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
};

const sanitizeKey = (key) => {
    if (!key) return '';
    return key.trim().replace(/[^a-zA-Z0-9@.]/g, "");
};

// --- GERADOR DE PAYLOAD PIX (EMVCo) ---
const generatePixPayload = ({ key, name, city, transactionId, amount }) => {
    const cleanKey = sanitizeKey(key);
    const cleanName = sanitizeText(name || 'LOJA').substring(0, 25);
    const cleanCity = sanitizeText(city || 'BRASIL').substring(0, 15);
    const cleanTxId = sanitizeTxId(transactionId).substring(0, 25) || '***';
    
    const cleanAmount = Number(amount).toFixed(2);

    const format = (id, value) => {
        const str = String(value);
        const len = str.length.toString().padStart(2, '0');
        return `${id}${len}${str}`;
    };

    const payloadFormat = format('00', '01');
    const merchantAccount = format('26', format('00', 'br.gov.bcb.pix') + format('01', cleanKey));
    const merchantCat = format('52', '0000');
    const currency = format('53', '986');
    const amountField = format('54', cleanAmount);
    const country = format('58', 'BR');
    const merchantName = format('59', cleanName);
    const merchantCity = format('60', cleanCity);
    const additionalData = format('62', format('05', cleanTxId));
    const payloadBase = `${payloadFormat}${merchantAccount}${merchantCat}${currency}${amountField}${country}${merchantName}${merchantCity}${additionalData}6304`;

    const polynomial = 0x1021;
    let crc = 0xFFFF;

    for (let i = 0; i < payloadBase.length; i++) {
        crc ^= payloadBase.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ polynomial;
            else crc = crc << 1;
        }
    }
    
    crc &= 0xFFFF;
    const crcStr = crc.toString(16).toUpperCase().padStart(4, '0');

    return `${payloadBase}${crcStr}`;
};

const PaymentModal = ({ 
    isOpen, 
    onClose, 
    amount, 
    orderId, 
    cartItems = [], 
    onSuccess, 
    coresEstabelecimento, 
    pixKey, 
    establishmentName 
}) => {
    const [method, setMethod] = useState(null);
    const [pixCode, setPixCode] = useState('');
    const [trocoPara, setTrocoPara] = useState('');
    const [cartaoTipo, setCartaoTipo] = useState('credito');
    const [showDetails, setShowDetails] = useState(false);

    // Gera o código PIX
    useEffect(() => {
        if (method === 'pix' && pixKey) {
            try {
                const txIdSeguro = orderId ? orderId.replace(/-/g, '').slice(-20) : '***';
                const valorFinal = Number(amount);

                const code = generatePixPayload({
                    key: pixKey,
                    name: establishmentName || 'LOJA',
                    city: 'BRASIL',
                    transactionId: txIdSeguro,
                    amount: valorFinal
                });
                setPixCode(code);
            } catch (e) {
                console.error("Erro QR Code:", e);
                toast.error("Erro ao gerar QR Code");
            }
        }
    }, [method, pixKey, amount, establishmentName, orderId]);

    const handleCopyPix = () => {
        if (!pixCode) return;
        navigator.clipboard.writeText(pixCode);
        toast.success("Código PIX copiado!");
    };

    const handleConfirm = () => {
        let paymentData = { method, amount: Number(amount) };
        
        if (method === 'pix') {
            paymentData.details = { pixCode };
        } else if (method === 'cash') {
            paymentData.details = { 
                // 🔥 CORREÇÃO AQUI: Mandamos o valor original para o backend calcular/salvar
                trocoPara: trocoPara ? Number(trocoPara) : 0,
                troco: trocoPara ? Number(trocoPara) - Number(amount) : 0 
            };
        } else if (method === 'card') {
            paymentData.details = { type: cartaoTipo };
        }

        onSuccess(paymentData);
    };

    if (!isOpen) return null;

    const corDestaque = coresEstabelecimento?.destaque || '#059669';

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 text-center border-b border-gray-100 bg-gray-50 flex-shrink-0 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <IoClose size={24} />
                    </button>
                    <h2 className="text-2xl font-black text-gray-900">Pagamento</h2>
                    <p className="text-gray-500 text-sm mt-1">Finalize seu pedido</p>
                    <div className="mt-4">
                        <span className="text-4xl font-black" style={{ color: corDestaque }}>
                            R$ {Number(amount).toFixed(2)}
                        </span>
                    </div>

                    {cartItems.length > 0 && (
                        <button 
                            onClick={() => setShowDetails(!showDetails)}
                            className="mt-2 text-xs font-bold text-gray-500 flex items-center justify-center gap-1 mx-auto hover:text-gray-800 transition-colors"
                        >
                            {showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'} 
                            {showDetails ? <IoChevronUp /> : <IoChevronDown />}
                        </button>
                    )}
                </div>

                {/* Body (Rolável) */}
                <div className="p-6 overflow-y-auto flex-1">
                    {!method ? (
                        <div className="space-y-3">
                            <button 
                                onClick={() => setMethod('pix')}
                                className="w-full bg-green-50 hover:bg-green-100 border border-green-200 p-4 rounded-2xl flex items-center gap-4 transition-all group"
                            >
                                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-green-200 group-hover:scale-110 transition-transform">
                                    <IoQrCode />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-gray-900">PIX (Instantâneo)</h3>
                                    <p className="text-xs text-gray-500">QR Code na hora</p>
                                </div>
                            </button>

                            <button 
                                onClick={() => setMethod('card')}
                                className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 p-4 rounded-2xl flex items-center gap-4 transition-all group"
                            >
                                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                                    <IoCard />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-gray-900">Cartão</h3>
                                    <p className="text-xs text-gray-500">Maquininha na entrega</p>
                                </div>
                            </button>

                            <button 
                                onClick={() => setMethod('cash')}
                                className="w-full bg-orange-50 hover:bg-orange-100 border border-orange-200 p-4 rounded-2xl flex items-center gap-4 transition-all group"
                            >
                                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
                                    <IoCash />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-gray-900">Dinheiro</h3>
                                    <p className="text-xs text-gray-500">Pagar na entrega</p>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <div className="animate-in slide-in-from-right duration-200">
                            <button onClick={() => setMethod(null)} className="text-sm text-gray-400 font-bold mb-4 hover:text-gray-600 flex items-center gap-1">
                                ← Voltar
                            </button>

                            {method === 'pix' && (
                                <div className="text-center space-y-4">
                                    {pixKey ? (
                                        <>
                                            <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-gray-300 inline-block mx-auto">
                                                <img 
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`} 
                                                    alt="QR Code Pix" 
                                                    className="w-48 h-48 mix-blend-multiply"
                                                />
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-xl flex items-center justify-between gap-2 border border-gray-200">
                                                <p className="text-xs text-gray-500 truncate max-w-[200px] font-mono select-all">
                                                    {pixCode || "Gerando..."}
                                                </p>
                                                <button onClick={handleCopyPix} className="text-white bg-green-600 font-bold text-xs flex items-center gap-1 hover:bg-green-700 px-3 py-2 rounded-lg transition-colors shadow-sm">
                                                    <IoCopy /> Copiar
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex flex-col items-center">
                                            <IoClose className="text-3xl mb-2" />
                                            <strong>Chave PIX não configurada.</strong>
                                        </div>
                                    )}
                                </div>
                            )}

                            {method === 'card' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-3">Qual tipo de cartão?</label>
                                    <div className="flex gap-3">
                                        <button onClick={() => setCartaoTipo('credito')} className={`flex-1 py-4 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${cartaoTipo === 'credito' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                            <IoCard size={24} /> Crédito
                                        </button>
                                        <button onClick={() => setCartaoTipo('debito')} className={`flex-1 py-4 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${cartaoTipo === 'debito' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                            <IoCard size={24} /> Débito
                                        </button>
                                    </div>
                                    <div className="mt-6 bg-blue-50 p-4 rounded-xl text-blue-800 text-sm border border-blue-100">
                                        ℹ️ A maquininha será levada até você.
                                    </div>
                                </div>
                            )}

                            {method === 'cash' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Vai precisar de troco?</label>
                                    <div className="relative mb-2">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                                        <input 
                                            type="number" 
                                            placeholder="Para quanto?" 
                                            className="w-full pl-10 p-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-orange-500 font-bold text-lg text-gray-900"
                                            value={trocoPara}
                                            onChange={e => setTrocoPara(e.target.value)}
                                        />
                                    </div>
                                    {trocoPara && Number(trocoPara) < Number(amount) && <p className="text-xs text-red-500 font-bold mt-2 ml-1">O valor deve ser maior que o total.</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {method && (
                    <div className="p-6 border-t border-gray-100 bg-gray-50 safe-area-bottom flex-shrink-0">
                        <button 
                            onClick={handleConfirm}
                            disabled={(method === 'pix' && !pixKey) || (method === 'cash' && trocoPara && Number(trocoPara) < Number(amount))}
                            className="w-full py-4 rounded-xl font-bold text-white shadow-lg text-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                            style={{ backgroundColor: corDestaque }}
                        >
                            <IoCheckmarkCircle className="text-2xl" />
                            {method === 'pix' ? `Já paguei R$ ${Number(amount).toFixed(2)}` : 'Confirmar Pedido'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentModal;