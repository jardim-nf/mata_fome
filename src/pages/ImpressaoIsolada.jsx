import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Importa os componentes de impressão
import ComandaParaImpressao from '../components/ComandaParaImpressao';
import ComandaSalaoImpressao from '../components/ComandaSalaoImpressao';

export default function ImpressaoIsolada() {
    const [searchParams] = useSearchParams();
    const pedidoId = searchParams.get('pedidoId');
    
    const [pedido, setPedido] = useState(null);
    const [estabelecimento, setEstabelecimento] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const componentRef = useRef();

    // Buscar dados do pedido
    useEffect(() => {
        const buscarDados = async () => {
            if (!pedidoId) {
                setError("ID do pedido não fornecido.");
                setLoading(false);
                return;
            }
            try {
                // Busca Pedido
                const pedidoRef = doc(db, 'pedidos', pedidoId);
                let pedidoSnap = await getDoc(pedidoRef);
                
                if (!pedidoSnap.exists()) {
                    throw new Error("Pedido não encontrado.");
                }
                
                const dadosPedido = { id: pedidoSnap.id, ...pedidoSnap.data() };
                setPedido(dadosPedido);

                // Busca Estabelecimento
                if (dadosPedido.estabelecimentoId) {
                    const estabelecimentoRef = doc(db, 'estabelecimentos', dadosPedido.estabelecimentoId);
                    const estabelecimentoSnap = await getDoc(estabelecimentoRef);
                    
                    if (estabelecimentoSnap.exists()) {
                        setEstabelecimento({ id: estabelecimentoSnap.id, ...estabelecimentoSnap.data() });
                    }
                }

            } catch (err) {
                console.error("Erro ao buscar dados:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        buscarDados();
    }, [pedidoId]);

    // Imprimir automaticamente
    useEffect(() => {
        if (!loading && pedido) {
            const timer = setTimeout(() => {
                window.print();
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [loading, pedido]);

    // Fechar após impressão
    useEffect(() => {
        const handleAfterPrint = () => {
            setTimeout(() => {
                window.close();
            }, 500);
        };

        window.onafterprint = handleAfterPrint;

        return () => {
            window.onafterprint = null;
        };
    }, []);

    if (loading) {
        return (
            <div style={{ 
                padding: '20px', 
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif'
            }}>
                Carregando comanda...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ 
                padding: '20px', 
                textAlign: 'center',
                color: 'red',
                fontFamily: 'Arial, sans-serif'
            }}>
                Erro: {error}
                <br />
                <button onClick={() => window.close()} style={{ marginTop: '10px' }}>
                    Fechar
                </button>
            </div>
        );
    }

    return (
        <div>
            {pedido.tipo === 'salao' || pedido.source === 'salao' ? (
                <ComandaSalaoImpressao 
                    ref={componentRef} 
                    pedido={pedido} 
                    estabelecimento={estabelecimento} 
                />
            ) : (
                <ComandaParaImpressao 
                    ref={componentRef} 
                    pedido={pedido} 
                    estabelecimento={estabelecimento} 
                />
            )}
        </div>
    );
}