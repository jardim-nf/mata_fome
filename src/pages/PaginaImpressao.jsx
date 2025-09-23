// src/pages/PaginaImpressao.jsx

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ComandaParaImpressao from '../components/ComandaParaImpressao';
import { toast } from 'react-toastify';

export default function PaginaImpressao() {
    const { pedidoId } = useParams();
    const [pedido, setPedido] = useState(null);
    const [estabelecimento, setEstabelecimento] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const componentRef = useRef();

    useEffect(() => {
        const buscarDados = async () => {
            if (!pedidoId) {
                setError("ID do pedido não fornecido.");
                setLoading(false);
                return;
            }
            try {
                const pedidoRef = doc(db, 'pedidos', pedidoId);
                const pedidoSnap = await getDoc(pedidoRef);

                if (!pedidoSnap.exists()) throw new Error("Pedido não encontrado.");
                
                const dadosPedido = { id: pedidoSnap.id, ...pedidoSnap.data() };
                setPedido(dadosPedido);

                const estabelecimentoRef = doc(db, 'estabelecimentos', dadosPedido.estabelecimentoId);
                const estabelecimentoSnap = await getDoc(estabelecimentoRef);

                if (!estabelecimentoSnap.exists()) throw new Error("Estabelecimento não encontrado.");
                
                setEstabelecimento({ id: estabelecimentoSnap.id, ...estabelecimentoSnap.data() });

            } catch (err) {
                console.error("Erro ao buscar dados para impressão:", err);
                setError(err.message);
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        };
        buscarDados();
    }, [pedidoId]);

    // Efeito para chamar a impressão e fechar a aba
    useEffect(() => {
        if (!loading && pedido && estabelecimento) {
            const timer = setTimeout(() => {
                window.print(); // Comando direto do navegador para imprimir
            }, 500); // Pequena espera para garantir que a comanda renderizou

            // Adiciona um listener para quando a impressão for concluída ou cancelada
            window.onafterprint = () => {
                window.close(); // Fecha a aba
            };

            return () => {
                clearTimeout(timer);
                window.onafterprint = null; // Limpa o listener
            };
        }
    }, [loading, pedido, estabelecimento]);

    if (loading) {
        return <div style={{ fontFamily: 'monospace', padding: '20px', textAlign: 'center' }}>Carregando comanda...</div>;
    }

    if (error) {
        return <div style={{ fontFamily: 'monospace', padding: '20px', textAlign: 'center' }}>Erro: {error}</div>;
    }

    return (
        <ComandaParaImpressao ref={componentRef} pedido={pedido} estabelecimento={estabelecimento} />
    );
}