import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Mantemos APENAS o nosso componente principal que tem a inteligência do Setor
import ComandaParaImpressao from '../components/ComandaParaImpressao';

export default function ImpressaoIsolada() {
    const [searchParams] = useSearchParams();
    const pedidoId = searchParams.get('pedidoId');
    
    const [pedido, setPedido] = useState(null);
    const [estabelecimento, setEstabelecimento] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Buscar dados do pedido usando CollectionGroup para achar em qualquer loja
    useEffect(() => {
        const buscarDados = async () => {
            if (!pedidoId) {
                setError("ID do pedido não fornecido.");
                setLoading(false);
                return;
            }
            try {
                let dadosPedido = null;

                // Primeiro tenta buscar na raiz (legado)
                const pedidoRef = doc(db, 'pedidos', pedidoId);
                let pedidoSnap = await getDoc(pedidoRef);
                
                if (pedidoSnap.exists()) {
                    dadosPedido = { id: pedidoSnap.id, ...pedidoSnap.data() };
                } else {
                    // Se não achar na raiz, procura nas pastas dos estabelecimentos (novo formato)
                    const q = query(collectionGroup(db, 'pedidos'), where('id', '==', pedidoId));
                    const querySnap = await getDocs(q);
                    
                    if (!querySnap.empty) {
                        dadosPedido = { id: querySnap.docs[0].id, ...querySnap.docs[0].data() };
                    }
                }

                if (!dadosPedido) {
                    throw new Error("Pedido não encontrado no banco de dados.");
                }
                
                setPedido(dadosPedido);

                // Busca Estabelecimento para cabçalho (Opcional)
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

    // Fechar a aba de impressão automaticamente após imprimir ou cancelar
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
            <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>
                Carregando comanda para impressão...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontFamily: 'Arial, sans-serif' }}>
                <strong>Erro:</strong> {error}
                <br /><br />
                <button onClick={() => window.close()} style={{ padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Fechar Janela
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Agora a tela manda TUDO direto para a comanda inteligente que filtra bar/cozinha */}
            <ComandaParaImpressao 
                pedido={pedido} 
                estabelecimento={estabelecimento} 
            />
        </div>
    );
}