import React, { useState } from 'react';
import { IoPrint, IoClose, IoTicket } from 'react-icons/io5';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase'; 

const GeradorTickets = ({ onClose, estabelecimentoNome = "Mata Fome", estabelecimentoId }) => {
    const [nomeItem, setNomeItem] = useState('');
    const [valorItem, setValorItem] = useState('');
    const [quantidade, setQuantidade] = useState(10); 
    const [salvando, setSalvando] = useState(false);

    const handleImprimir = async () => {
        if (!nomeItem || quantidade <= 0) return alert("Preencha o nome e a quantidade!");

        setSalvando(true);

        try {
            // --- PARTE IMPORTANTE: SALVAR NO BANCO ---
            if (estabelecimentoId) {
                const valorFloat = parseFloat(valorItem.replace(',', '.')) || 0;
                
                await addDoc(collection(db, "historico_tickets"), {
                    estabelecimentoId: estabelecimentoId,
                    estabelecimentoNome: estabelecimentoNome,
                    item: nomeItem,
                    quantidade: parseInt(quantidade),
                    valorUnitario: valorFloat,
                    valorTotal: valorFloat * parseInt(quantidade),
                    impressoPor: auth.currentUser?.email || "Garçom",
                    data: serverTimestamp()
                });
            } else {
                console.warn("Sem ID do estabelecimento, ticket não será salvo no histórico.");
            }

            // --- GERAÇÃO DO HTML (MANTIDA) ---
            let conteudoHTML = `
                <html>
                <head>
                    <title>Tickets - ${nomeItem}</title>
                    <style>
                        @media print {
                            @page { margin: 0; size: auto; }
                            body { margin: 0; padding: 0; }
                            .ticket { 
                                page-break-after: always; 
                                break-after: page; 
                                page-break-inside: avoid;
                            }
                        }
                        body { font-family: 'Courier New', monospace; width: 300px; }
                        .ticket { padding: 15px 5px; text-align: center; border-bottom: 1px dashed #ccc; margin-bottom: 10px; }
                        .nome-evento { font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                        .nome-item { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 10px 0; display: block; line-height: 1.1; }
                        .valor { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
                        .info { font-size: 10px; color: #000; margin-top: 5px; }
                        .rodape { margin-top: 10px; font-size: 10px; font-weight: bold; border-top: 2px solid #000; padding-top: 5px; }
                        .contador { font-size: 9px; float: right; }
                    </style>
                </head>
                <body>
            `;

            for (let i = 1; i <= quantidade; i++) {
                conteudoHTML += `
                    <div class="ticket">
                        <div class="nome-evento">${estabelecimentoNome}</div>
                        <span class="nome-item">${nomeItem}</span>
                        ${valorItem ? `<div class="valor">R$ ${parseFloat(valorItem).toFixed(2).replace('.', ',')}</div>` : ''}
                        <div class="rodape">*** VALE 01 UNIDADE ***</div>
                        <div class="info">
                            ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR').substring(0,5)}
                            <span class="contador">#${i}/${quantidade}</span>
                        </div>
                    </div>
                `;
            }
            conteudoHTML += `</body></html>`;

            const win = window.open('', '', 'height=600,width=400');
            win.document.write(conteudoHTML);
            win.document.close();
            setTimeout(() => { win.focus(); win.print(); }, 500);

        } catch (error) {
            console.error("Erro ao salvar ticket:", error);
            alert("Erro de permissão ou conexão ao salvar o registro.");
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-purple-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2"><IoTicket /> Gerador de Tickets</h3>
                    <button onClick={onClose}><IoClose size={24} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Produto</label>
                        <input autoFocus type="text" placeholder="Ex: Cerveja" className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-lg uppercase outline-none focus:border-purple-500" value={nomeItem} onChange={(e) => setNomeItem(e.target.value)} />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Valor (R$)</label>
                            <input type="number" placeholder="0,00" className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-lg outline-none" value={valorItem} onChange={(e) => setValorItem(e.target.value)} />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Qtd.</label>
                            <input type="number" className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-lg outline-none text-center" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
                        </div>
                    </div>
                    <button 
                        onClick={handleImprimir} 
                        disabled={salvando}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-purple-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <IoPrint size={24} /> {salvando ? 'Registrando...' : `IMPRIMIR ${quantidade} TICKETS`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeradorTickets;