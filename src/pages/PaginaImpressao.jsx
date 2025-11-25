import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

// Importa os dois modelos de impressão
import ComandaParaImpressao from '../components/ComandaParaImpressao';
import ComandaSalaoImpressao from '../components/ComandaSalaoImpressao';

export default function PaginaImpressao() {
    const { pedidoId } = useParams();
    const [pedido, setPedido] = useState(null);
    const [estabelecimento, setEstabelecimento] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hasPrinted, setHasPrinted] = useState(false);
    const [printAttempted, setPrintAttempted] = useState(false);
    
    // Referência para o componente
    const componentRef = useRef();

    // 1. Busca os dados do Pedido e do Estabelecimento
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
                    throw new Error("Pedido não encontrado no banco de dados.");
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
                console.error("Erro ao buscar dados para impressão:", err);
                setError(err.message);
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        };
        buscarDados();
    }, [pedidoId]);

    // 2. Fechar janela de forma segura
    const closeWindowSafely = () => {
        console.log('Tentando fechar janela de impressão...');
        
        // Tentativa 1: Fechar normalmente
        if (window.opener && !window.opener.closed) {
            window.close();
        } 
        // Tentativa 2: Fechar com fallback
        else {
            try {
                window.close();
            } catch (e) {
                console.log('Não foi possível fechar a janela automaticamente');
                // Mostrar botão para fechar manualmente
                const closeBtn = document.getElementById('close-manual-btn');
                if (closeBtn) {
                    closeBtn.style.display = 'block';
                }
            }
        }
    };

    // 3. Imprimir e gerenciar o fechamento
    useEffect(() => {
        if (!loading && pedido && !printAttempted) {
            setPrintAttempted(true);
            
            console.log('Iniciando processo de impressão...');
            
            const printTimer = setTimeout(() => {
                try {
                    window.print();
                    setHasPrinted(true);
                    console.log('Impressão iniciada com sucesso');
                } catch (error) {
                    console.error('Erro ao iniciar impressão:', error);
                    // Mesmo com erro, marca como impresso para prosseguir
                    setHasPrinted(true);
                }
            }, 1500);

            return () => clearTimeout(printTimer);
        }
    }, [loading, pedido, printAttempted]);

    // 4. Configurar o evento de após impressão
    useEffect(() => {
        const handleAfterPrint = () => {
            console.log('Evento afterprint disparado - fechando janela');
            
            // Delay para garantir que a impressão foi processada
            setTimeout(() => {
                closeWindowSafely();
            }, 1000);
        };

        // Fallback: se afterprint não disparar em 10 segundos, fechar mesmo assim
        const safetyTimer = setTimeout(() => {
            if (!window.closed) {
                console.log('Fallback: fechando janela após timeout');
                closeWindowSafely();
            }
        }, 10000);

        window.onafterprint = handleAfterPrint;

        return () => {
            window.onafterprint = null;
            clearTimeout(safetyTimer);
        };
    }, []);

    // 5. Se houve erro ou não encontrou pedido, fechar após um tempo
    useEffect(() => {
        if (error) {
            const errorTimer = setTimeout(() => {
                closeWindowSafely();
            }, 5000);
            
            return () => clearTimeout(errorTimer);
        }
    }, [error]);

    if (loading) {
        return (
            <div style={{ 
                fontFamily: 'monospace', 
                padding: '20px', 
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: 'white'
            }}>
                <div style={{ fontSize: '24px', marginBottom: '20px' }}>🖨️</div>
                <div style={{ fontSize: '16px', marginBottom: '10px' }}>Preparando comanda...</div>
                <div style={{ fontSize: '12px', color: '#666' }}>A impressão iniciará automaticamente</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ 
                fontFamily: 'monospace', 
                padding: '20px', 
                textAlign: 'center', 
                color: 'red',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: 'white'
            }}>
                <div style={{ fontSize: '24px', marginBottom: '20px' }}>❌</div>
                <div style={{ fontSize: '16px', marginBottom: '20px' }}>Erro: {error}</div>
                <button 
                    id="close-manual-btn"
                    onClick={closeWindowSafely}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#f56565',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    Fechar Janela
                </button>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
            {/* Componente de impressão */}
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
            
            {/* Overlay de informação (não imprime) */}
            <div style={{
                position: 'fixed',
                top: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#f7fafc',
                padding: '10px 20px',
                borderRadius: '5px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                zIndex: 1000,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }} className="no-print">
                {hasPrinted ? '✅ Impressão concluída - Fechando...' : '🖨️ Imprimindo...'}
            </div>

            {/* Botão de fechamento manual (só aparece se necessário) */}
            <button 
                id="close-manual-btn"
                onClick={closeWindowSafely}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    padding: '8px 16px',
                    backgroundColor: '#f56565',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'none',
                    zIndex: 1000
                }}
                className="no-print"
            >
                Fechar
            </button>

            <style>{`
                @media print {
                    .no-print {
                        display: none !important;
                    }
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                }
                @media screen {
                    body {
                        background: white;
                    }
                }
            `}</style>
        </div>
    );
}