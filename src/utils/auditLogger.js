// src/utils/auditLogger.js
import { db } from '../firebase'; // Ajuste o caminho conforme seu projeto
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Registra uma ação no log de auditoria.
 * * @param {string} actionType - Tipo da ação (ex: 'USUARIO_CRIADO', 'LOGIN_REALIZADO')
 * @param {object} actor - Quem fez a ação { uid, email, role }
 * @param {object} target - Alvo da ação { type: 'pedido', id: '123', name: 'Pedido #123' }
 * @param {object} details - (Opcional) Objeto com detalhes técnicos (ex: campos alterados)
 * @param {string} level - Nível do log ('info', 'warning', 'danger'). Padrão: 'info'
 */
export const auditLogger = async (actionType, actor, target = null, details = null, level = 'info') => {
  try {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    // Se o ator não for passado, tenta pegar o usuário logado atual
    const finalActor = actor || {
      uid: currentUser?.uid || 'sistema',
      email: currentUser?.email || 'sistema@automacao',
      role: 'desconhecido'
    };

    // Coleta dados básicos do ambiente (Navegador/Sistema)
    const metadata = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      url: window.location.href,
      timestamp_local: new Date().toString()
    };

    const logData = {
      actionType: actionType.toUpperCase(),
      actor: {
        uid: finalActor.uid,
        email: finalActor.email,
        role: finalActor.role || 'user'
      },
      target: {
        type: target?.type || 'geral',
        id: target?.id || 'n/a',
        name: target?.name || ''
      },
      details: details || {},
      metadata: metadata,
      level: level,
      timestamp: serverTimestamp() // Data do servidor (Firestore)
    };

    // Salva na coleção 'auditLogs'
    await addDoc(collection(db, 'auditLogs'), logData);
    
    console.log(`[AUDIT] ${actionType} registrado com sucesso.`);

  } catch (error) {
    // Falha silenciosa para não travar o uso do usuário, mas loga no console
    console.error("[AUDIT ERROR] Falha ao registrar log:", error);
  }
};