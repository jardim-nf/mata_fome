import React, { useState, useEffect } from 'react';
import { formatarMoeda } from './pdvHelpers';

export const ModalPesoBalanca = ({ visivel, produto, onClose, onConfirm }) => {
    const [peso, setPeso] = useState('');
    const [lendo, setLendo] = useState(false);
    const [erro, setErro] = useState('');

    const conectarElerPorta = async (port) => {
        try {
            setLendo(true);
            setErro('');
            await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
            const reader = port.readable.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const timeout = setTimeout(() => { reader.cancel(); }, 2000);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const matches = buffer.match(/\d+\.\d+|\d+\,\d+/g);
                if (matches) {
                    const pesoLido = matches[matches.length - 1].replace(',', '.');
                    if (parseFloat(pesoLido) > 0) {
                        setPeso(pesoLido);
                        clearTimeout(timeout);
                        reader.cancel();
                        break;
                    }
                }
            }
            await port.close();
        } catch (error) {
            console.error("Erro ao ler porta:", error);
            setErro("Falha na leitura. Tente novamente.");
            try { await port.close(); } catch (e) { console.error(e); }
        } finally {
            setLendo(false);
        }
    };

    useEffect(() => {
        if (visivel) {
            setPeso('');
            setErro('');
            const autoRead = async () => {
                if ('serial' in navigator) {
                    try {
                        const ports = await navigator.serial.getPorts();
                        if (ports.length > 0) {
                            await conectarElerPorta(ports[0]);
                        }
                    } catch (e) {
                        console.log("Auto-leitura falhou", e);
                    }
                }
            };
            autoRead();
        }
    }, [visivel]);

    const solicitarPermissaoEler = async () => {
        if (!('serial' in navigator)) {
            setErro("Navegador incompatível. Use o Google Chrome no PC.");
            return;
        }
        try {
            const port = await navigator.serial.requestPort();
            await conectarElerPorta(port);
        } catch (error) {
            console.log("Usuário cancelou a seleção da porta.");
        }
    };

    if (!visivel || !produto) return null;

    const precoKg = parseFloat(produto.price || 0);
    const pesoNum = parseFloat(peso.replace(',', '.') || 0);
    const totalCalculado = precoKg * pesoNum;

    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl transform animate-slideUp relative">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="font-black text-2xl text-gray-800">{produto.name}</h3>
                        <p className="text-gray-500 text-sm">{formatarMoeda(precoKg)} / Kg</p>
                    </div>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>

                {lendo ? (
                    <div className="w-full mb-6 bg-amber-50 text-amber-600 border-2 border-amber-200 p-4 rounded-2xl font-bold flex items-center justify-center gap-3 animate-pulse">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-600 border-t-transparent"></div>
                        Aguardando balança...
                    </div>
                ) : (
                    <button onClick={solicitarPermissaoEler} className="w-full mb-6 bg-blue-50 text-blue-600 border-2 border-blue-200 p-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-100 transition-all shadow-sm active:scale-95">
                        <span className="text-2xl">⚖️</span> Ler Balança Manualmente
                    </button>
                )}

                {erro && <p className="text-red-500 text-xs text-center font-bold mb-4 -mt-4">{erro}</p>}

                <div className="mb-6 relative group">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Peso Lido (Kg)</label>
                    <span className="absolute left-4 top-[38px] text-gray-400 text-xl font-bold group-focus-within:text-emerald-600 transition-colors">Kg</span>
                    <input type="number" step="0.005" className="w-full p-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-2xl text-3xl font-black text-gray-800 focus:border-emerald-500 focus:bg-white outline-none transition-all placeholder-gray-300" placeholder="0.000" autoFocus value={peso} onChange={(e) => setPeso(e.target.value)} />
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl mb-6 text-center border border-emerald-100">
                    <p className="text-xs font-bold uppercase text-emerald-600/70 tracking-wider mb-1">Total a Pagar</p>
                    <p className="text-4xl font-black text-emerald-600">{formatarMoeda(totalCalculado)}</p>
                </div>

                <button onClick={() => onConfirm(produto, pesoNum, totalCalculado)} disabled={pesoNum <= 0 || lendo} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-black text-xl hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:shadow-none">
                    ADICIONAR
                </button>
            </div>
        </div>
    );
};
