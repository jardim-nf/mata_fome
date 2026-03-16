import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase'; // Ajuste o caminho do seu firebase.js
import { FaCopy, FaCheckCircle, FaSpinner, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';

export default function ModalPix({ vendaId, valor, onClose, onSuccess }) {
    const [qrCodeBase64, setQrCodeBase64] = useState(null);
    const [copiaECola, setCopiaECola] = useState('');
    const [loading, setLoading] = useState(true);
    const [pago, setPago] = useState(false);

    // 1. Gera o PIX assim que o Modal abre
    useEffect(() => {
        const gerarPix = async () => {
            try {
                const functions = getFunctions();
                const criarPixFn = httpsCallable(functions, 'gerarPixMercadoPago');
                
                const response = await criarPixFn({
                    vendaId: vendaId,
                    valor: valor,
                    descricao: `Pedido #${vendaId.slice(-4)}` 
                });

                const { qrCodeBase64, copiaECola } = response.data;
                setQrCodeBase64(qrCodeBase64);
                setCopiaECola(copiaECola);
                setLoading(false);

            } catch (error) {
                console.error("Erro ao gerar PIX:", error);
                toast.error("Erro ao conectar com o banco.");
                onClose(); // Fecha o modal se der erro
            }
        };

        if (vendaId && valor) {
            gerarPix();
        }
    }, [vendaId, valor, onClose]);

    // 2. Fica "escutando" o banco de dados para ver se o Webhook confirmou o pagamento
    useEffect(() => {
        if (!vendaId) return;

        const unsub = onSnapshot(doc(db, 'vendas', vendaId), (docSnap) => {
            if (docSnap.exists()) {
                const dados = docSnap.data();
                // Se a Cloud Function do Webhook mudou o status para pago...
                if (dados.status === 'pago' || dados.statusPagamento === 'aprovado') {
                    setPago(true);
                    toast.success("Pix recebido com sucesso!");
                    
                    // Espera 3 segundos e avisa a tela principal que deu certo
                    setTimeout(() => {
                        onSuccess();
                    }, 3000);
                }
            }
        });

        return () => unsub(); // Limpa o listener quando fechar o modal
    }, [vendaId, onSuccess]);

    const copiarCodigo = () => {
        navigator.clipboard.writeText(copiaECola);
        toast.info("Código Copiado!");
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center relative">
                
                {/* Botão Fechar */}
                {!pago && (
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
                        <FaTimes size={20} />
                    </button>
                )}

                {/* TELA 1: SUCESSO */}
                {pago ? (
                    <div className="py-8 flex flex-col items-center">
                        <FaCheckCircle className="text-emerald-500 text-6xl mb-4 animate-bounce" />
                        <h2 className="text-2xl font-black text-gray-900">Pagamento Aprovado!</h2>
                        <p className="text-gray-500 mt-2">O pedido já está sendo preparado.</p>
                    </div>
                ) : 
                /* TELA 2: CARREGANDO */
                loading ? (
                    <div className="py-12 flex flex-col items-center">
                        <FaSpinner className="animate-spin text-yellow-500 text-4xl mb-4" />
                        <p className="font-bold text-gray-500">Gerando QR Code seguro...</p>
                    </div>
                ) : 
                /* TELA 3: MOSTRANDO O QR CODE */
                (
                    <div>
                        <h2 className="text-xl font-black text-gray-900 mb-1">Pague com Pix</h2>
                        <p className="text-sm text-gray-500 mb-4">Valor: <span className="font-bold text-gray-900">R$ {Number(valor).toFixed(2).replace('.',',')}</span></p>

                        <div className="bg-gray-50 p-3 rounded-2xl inline-block mb-4 border border-gray-200">
                            <img 
                                src={`data:image/jpeg;base64,${qrCodeBase64}`} 
                                alt="QR Code" 
                                className="w-48 h-48 mix-blend-multiply"
                            />
                        </div>

                        <div className="text-left mb-6">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pix Copia e Cola</label>
                            <div className="flex mt-1 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                                <input 
                                    type="text" 
                                    value={copiaECola} 
                                    readOnly 
                                    className="flex-1 bg-transparent px-3 text-xs text-gray-600 outline-none font-mono"
                                />
                                <button onClick={copiarCodigo} className="bg-gray-900 text-white p-3 hover:bg-black transition-colors">
                                    <FaCopy />
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-gray-400 flex items-center justify-center gap-2 animate-pulse font-bold">
                            <FaSpinner className="animate-spin" /> Aguardando pagamento...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}