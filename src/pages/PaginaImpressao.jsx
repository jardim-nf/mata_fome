// src/pages/PaginaImpressao.jsx

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Comprovante from '../components/Comprovante'; // Nosso comprovante existente
import { useReactToPrint } from 'react-to-print';

export default function PaginaImpressao() {
    const { pedidoId } = useParams();
    const [pedido, setPedido] = useState(null);
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    const comprovanteRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => comprovanteRef.current,
        // Esta função é chamada depois que a janela de impressão fecha
        onAfterPrint: () => window.close(), 
    });

    useEffect(() => {
        if (!pedidoId) return;

        const fetchPedido = async () => {
            try {
                const pedidoRef = doc(db, 'pedidos', pedidoId);
                const pedidoSnap = await getDoc(pedidoRef);

                if (pedidoSnap.exists()) {
                    const pedidoData = pedidoSnap.data();
                    setPedido(pedidoData);

                    const estRef = doc(db, 'estabelecimentos', pedidoData.estabelecimentoId);
                    const estSnap = await getDoc(estRef);
                    if (estSnap.exists()) {
                        setEstabelecimentoInfo(estSnap.data());
                    }
                }
            } catch (error) {
                console.error("Erro ao buscar pedido para impressão:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPedido();
    }, [pedidoId]);

    // Dispara a impressão automaticamente quando os dados estiverem prontos
    useEffect(() => {
        if (!loading && pedido) {
            handlePrint();
        }
    }, [loading, pedido, handlePrint]);

    if (loading) {
        return <div style={{ fontFamily: 'monospace', padding: '20px' }}>Carregando comprovante...</div>;
    }

    if (!pedido) {
        return <div style={{ fontFamily: 'monospace', padding: '20px' }}>Pedido não encontrado.</div>;
    }

    return (
        <Comprovante 
            ref={comprovanteRef}
            pedido={pedido.itens}
            total={pedido.totalFinal || pedido.total}
            estabelecimentoInfo={estabelecimentoInfo}
            formaPagamento={pedido.formaPagamento}
        />
    );
}