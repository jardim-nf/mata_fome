// src/context/PaymentContext.jsx
import React, { createContext, useContext, useState, useMemo } from 'react';

// Se não usar Firebase aqui para gravar, pode remover estas linhas
// import { db } from '../firebase'; 
// import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 1. CRIAÇÃO COM VALOR PADRÃO SEGURO (Evita crash se chamado fora do Provider)
const PaymentContext = createContext({});

export const usePayment = () => {
    const context = useContext(PaymentContext);
    if (!context) {
        console.warn("⚠️ usePayment foi chamado fora do PaymentProvider. Verifique o App.js.");
        return {}; // Retorna objeto vazio para não quebrar a tela
    }
    return context;
};

export const PaymentProvider = ({ children }) => {
  // --- ESTADOS ---
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [pixCode, setPixCode] = useState(null);
  
  // Configuração Padrão
  const [pixConfig, setPixConfig] = useState({
    chave: '', 
    nome: 'Pagamento',
    cidade: 'Brasil',
    loaded: true
  });

  // Usar useMemo na lista estática evita recriação a cada render
  const paymentMethods = useMemo(() => [
    { id: 1, name: 'PIX', type: 'pix', icon: '💠', enabled: true },
    { id: 2, name: 'Cartão de Crédito', type: 'credit_card', icon: '💳', enabled: true },
    { id: 3, name: 'Cartão de Débito', type: 'debit_card', icon: '💳', enabled: true },
    { id: 4, name: 'Dinheiro', type: 'cash', icon: '💵', enabled: true }
  ], []);

  // ==========================================
  // 🧠 LÓGICA MANUAL DE GERAÇÃO DO PIX (BR CODE)
  // ==========================================

  const crc16ccitt = (str) => {
    let crc = 0xFFFF;
    for (let c = 0; c < str.length; c++) {
      crc ^= str.charCodeAt(c) << 8;
      for (let i = 0; i < 8; i++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc = crc << 1;
        }
      }
    }
    let hex = (crc & 0xFFFF).toString(16).toUpperCase();
    if (hex.length < 4) hex = '0'.repeat(4 - hex.length) + hex;
    return hex;
  };

  const formatEMV = (id, value) => {
    const size = value.length.toString().padStart(2, '0');
    return `${id}${size}${value}`;
  };

  // 🛡️ FUNÇÃO BLINDADA
  const generatePixPayload = (chave, nome, cidade, valor, txId) => {
    try {
        const chaveS = String(chave || '').trim();
        const nomeS = String(nome || 'Pagamento');
        const cidadeS = String(cidade || 'Brasil');
        const valorS = String(parseFloat(valor || 0).toFixed(2));
        const txIdS = String(txId || '***');

        const nomeLimpo = nomeS.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25);
        const cidadeLimpa = cidadeS.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15);
        const txIdLimpo = txIdS.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';

        let payload = 
          formatEMV('00', '01') +
          formatEMV('01', '12') +
          formatEMV('26', 
            formatEMV('00', 'br.gov.bcb.pix') +
            formatEMV('01', chaveS)
          ) +
          formatEMV('52', '0000') +
          formatEMV('53', '986') +
          formatEMV('54', valorS) +
          formatEMV('58', 'BR') +
          formatEMV('59', nomeLimpo) +
          formatEMV('60', cidadeLimpa) +
          formatEMV('62', 
            formatEMV('05', txIdLimpo)
          ) +
          '6304';

        payload += crc16ccitt(payload);
        return payload;

    } catch (error) {
        console.error("Erro fatal ao criar string PIX:", error);
        return null;
    }
  };

  const generatePixCode = async (amount, orderId, customKey = null) => {
    setPaymentLoading(true);
    try {
      const chaveAtiva = customKey || pixConfig.chave;

      if (!chaveAtiva) {
        console.error("❌ ERRO: Nenhuma chave PIX detectada!");
      }

      const payloadPix = generatePixPayload(
        chaveAtiva || 'chave-indisponivel', 
        pixConfig.nome, 
        pixConfig.cidade, 
        amount, 
        orderId
      );

      if (!payloadPix) throw new Error("Falha ao gerar string do PIX");

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payloadPix)}`;

      setPixCode({
        payload_pix: payloadPix,
        qr_code_base64: qrCodeUrl,
        transaction_id: orderId
      });

    } catch (error) {
      console.error("Erro ao gerar PIX:", error);
    } finally {
      setPaymentLoading(false);
    }
  };

  const clearPixCode = () => {
    setPixCode(null);
  };

  const submitOrder = async (orderData) => {
    setPaymentLoading(true);
    try {
       await new Promise(resolve => setTimeout(resolve, 1000));
       return { success: true, id: orderData.orderId };
    } catch (error) {
       console.error("Erro ao enviar pedido:", error);
       return { success: false, error };
    } finally {
       setPaymentLoading(false);
    }
  };

  const formatCPF = (v) => v; 

  // 2. USEMEMO NO VALUE (Estabilidade)
  const value = useMemo(() => ({
    paymentMethods,
    selectedPayment,
    setSelectedPayment,
    paymentLoading,
    pixCode,
    generatePixCode,
    clearPixCode,
    pixConfig,
    setPixConfig,
    submitOrder,
    formatCPF
  }), [
    paymentMethods, 
    selectedPayment, 
    paymentLoading, 
    pixCode, 
    pixConfig
  ]);

  return (
    <PaymentContext.Provider value={value}>
      {children}
    </PaymentContext.Provider>
  );
};

export default PaymentContext;