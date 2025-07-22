// src/utils/auditLogger.js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase'; // Assumindo que seu db está em src/firebase.js

/**
 * Registra uma ação de auditoria no Firestore.
 * @param {string} actionType - Tipo da ação (ex: 'ESTABELECIMENTO_CRIADO', 'USUARIO_EDITADO', 'PEDIDO_STATUS_CHANGE').
 * @param {object} actor - Objeto com informações de quem realizou a ação { uid, email, role }.
 * @param {object} target - Objeto com informações do que foi afetado { type, id, name }.
 * @param {object} [details={}] - Detalhes adicionais da ação (ex: { oldValue, newValue, field }).
 */
export const auditLogger = async (actionType, actor, target, details = {}) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      timestamp: serverTimestamp(), // Usa o timestamp do servidor do Firestore
      actionType,
      actor,
      target,
      details,
    });
    // console.log(`[Audit Log] Ação "${actionType}" registrada por ${actor.email}`);
  } catch (error) {
    console.error("Erro ao registrar log de auditoria:", error);
    // IMPORTANTE: Tratar erros de log para não impedir a ação principal
  }
};