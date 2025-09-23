// src/components/Comprovante.jsx

import React from 'react';

const Comprovante = React.forwardRef(({ pedido, total, estabelecimentoInfo, formaPagamento }, ref) => {
    
    const styles = {
        wrapper: { width: '280px', fontFamily: 'monospace', fontSize: '12px', padding: '10px', color: '#000' },
        header: { textAlign: 'center', marginBottom: '10px' },
        title: { fontWeight: 'bold', fontSize: '16px' },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { borderBottom: '1px dashed #000', textAlign: 'left', padding: '4px 0' },
        td: { padding: '4px 0' },
        info: { borderTop: '1px dashed #000', paddingTop: '10px', marginTop: '10px' },
        total: { fontWeight: 'bold', fontSize: '14px' },
    };

    return (
        <div ref={ref} style={styles.wrapper}>
            <div style={styles.header}>
                <h1 style={styles.title}>{estabelecimentoInfo?.nome || 'Seu Restaurante'}</h1>
                <p>{new Date().toLocaleString('pt-BR')}</p>
            </div>
            
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={{...styles.th, width: '60%'}}>Item</th>
                        <th style={{...styles.th, textAlign: 'center'}}>Qtd</th>
                        <th style={{...styles.th, textAlign: 'right'}}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {pedido.map(item => (
                        <tr key={item.id}>
                            <td style={styles.td}>{item.nome}</td>
                            <td style={{...styles.td, textAlign: 'center'}}>{item.quantidade}</td>
                            <td style={{...styles.td, textAlign: 'right'}}>R$ {(item.preco * item.quantidade).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div style={styles.info}>
                {/* ▼▼▼ CAMPO DE PAGAMENTO ADICIONADO AQUI ▼▼▼ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', textTransform: 'capitalize' }}>
                    <span>Pagamento:</span>
                    <span>{formaPagamento}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...styles.total }}>
                    <span>TOTAL:</span>
                    <span>R$ {total.toFixed(2)}</span>
                </div>
            </div>
            <p style={{textAlign: 'center', marginTop: '20px'}}>Obrigado pela preferência!</p>
        </div>
    );
});

export default Comprovante;