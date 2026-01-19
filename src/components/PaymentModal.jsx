import React, { useState, useEffect } from 'react';
import { IoClose, IoCash, IoCard, IoQrCode, IoCopy, IoCheckmarkCircle, IoTime } from 'react-icons/io5';
import { toast } from 'react-toastify';

// --- FUNÇÃO GERADORA DE PAYLOAD PIX (EMVCo) ---
const generatePixPayload = ({ key, name, city, transactionId, amount }) => {
    const formatField = (id, value) => {
        const len = value.length.toString().padStart(2, '0');
        return `${id}${len}${value}`;
    };

    const payloadKey = formatField('01', key);
    const merchantAccount = formatField('26', `0014BR.GOV.BCB.PIX${payloadKey}`);
    const merchantCat = formatField('52', '0000');
    const currency = formatField('53', '986'); // BRL
    const amountStr = amount.toFixed(2);
    const transactionAmount = formatField('54', amountStr);
    const country = formatField('58', 'BR');
    const merchantName = formatField('59', name.substring(0, 25).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const merchantCity = formatField('60', city.substring(0, 15).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const txId = formatField('62', formatField('05', transactionId || '***'));
    const additionalData = formatField('62', formatField('05', transactionId || '***')); // Field 62 repeated in some standards, usually 05 is inside 62

    const payload = `000201${merchantAccount}${merchantCat}${currency}${transactionAmount}${country}${merchantName}${merchantCity}${additionalData}6304`;

    // CRC16 Calculation
    const polynomial = 0x1021;
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ polynomial;
            else crc = crc << 1;
        }
    }
    crc &= 0xFFFF;
    const crcStr = crc.toString(16).toUpperCase().padStart(4, '0');

    return `${payload}${crcStr}`;
};

const PaymentModal = ({ 
    isOpen, 
    onClose, 
    amount, 
    orderId, 
    onSuccess, 
    coresEstabelecimento, 
    pixKey, 
    establishmentName 
}) => {
    const [method, setMethod] = useState(null); // 'pix', 'card', 'cash'
    const [pixCode, setPixCode] = useState('');
    const [trocoPara, setTrocoPara] = useState('');
    const [cartaoTipo, setCartaoTipo] = useState('credito'); // 'credito', 'debito'

    // Gera o Pix apenas se a chave existir
    useEffect(() => {
        if (method === 'pix' && pixKey) {
            const payload = generatePixPayload({
                key: pixKey,
                name: establishmentName || 'LOJA',
                city: 'BRASIL',
                transactionId: orderId.slice(-10), // ID curto
                amount: Number(amount)
            });
            setPixCode(payload);
        }
    }, [method, pixKey, amount, establishmentName, orderId]);

    const handleCopyPix = () => {
        navigator.clipboard.writeText(pixCode);
        toast.success("Código PIX copiado!");
    };

    const handleConfirm = () => {
        let paymentData = { method, amount };
        
        if (method === 'pix') {
            paymentData.details = { pixCode };
        } else if (method === 'cash') {
            paymentData.details = { troco: trocoPara ? Number(trocoPara) - amount : 0 };
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
            
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 text-center border-b border-gray-100">
                    <h2 className="text-2xl font-black text-gray-900">Finalizar Pedido</h2>
                    <p className="text-gray-500 text-sm mt-1">Escolha como deseja pagar</p>
                    <div className="mt-4">
                        <span className="text-4xl font-black" style={{ color: corDestaque }}>
                            R$ {amount.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
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
                                    <h3 className="font-bold text-gray-900">PIX (Recomendado)</h3>
                                    <p className="text-xs text-gray-500">Aprovação imediata via QR Code</p>
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
                                    <p className="text-xs text-gray-500">Crédito ou Débito na entrega</p>
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
                                    <p className="text-xs text-gray-500">Pagamento na entrega</p>
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
                                                {/* API de QR Code gratuita do Google ou similar para renderizar o código */}
                                                <img 
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`} 
                                                    alt="QR Code Pix" 
                                                    className="w-48 h-48"
                                                />
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-xl flex items-center justify-between gap-2 border border-gray-200">
                                                <p className="text-xs text-gray-500 truncate max-w-[200px] font-mono">{pixCode}</p>
                                                <button onClick={handleCopyPix} className="text-green-600 font-bold text-sm flex items-center gap-1 hover:bg-green-100 p-2 rounded-lg transition-colors">
                                                    <IoCopy /> Copiar
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                <IoTime className="inline mb-0.5" /> Aguardando pagamento...
                                            </p>
                                        </>
                                    ) : (
                                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
                                            ⚠️ Este estabelecimento não configurou uma chave PIX.
                                        </div>
                                    )}
                                </div>
                            )}

                            {method === 'card' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Qual tipo de cartão?</label>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setCartaoTipo('credito')}
                                            className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${cartaoTipo === 'credito' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'}`}
                                        >
                                            Crédito
                                        </button>
                                        <button 
                                            onClick={() => setCartaoTipo('debito')}
                                            className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${cartaoTipo === 'debito' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'}`}
                                        >
                                            Débito
                                        </button>
                                    </div>
                                    <div className="mt-6 bg-blue-50 p-4 rounded-xl text-blue-800 text-sm">
                                        A maquininha será levada até você.
                                    </div>
                                </div>
                            )}

                            {method === 'cash' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Precisa de troco para quanto?</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                                        <input 
                                            type="number" 
                                            placeholder="0,00" 
                                            className="w-full pl-10 p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-lg"
                                            value={trocoPara}
                                            onChange={e => setTrocoPara(e.target.value)}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2 ml-1">Deixe vazio se tiver o valor trocado.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {method && (
                    <div className="p-6 border-t border-gray-100 bg-gray-50">
                        <button 
                            onClick={handleConfirm}
                            className="w-full py-4 rounded-xl font-bold text-white shadow-lg text-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                            style={{ backgroundColor: corDestaque }}
                        >
                            <IoCheckmarkCircle className="text-2xl" />
                            {method === 'pix' ? 'Já fiz o pagamento' : 'Confirmar Pedido'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentModal;