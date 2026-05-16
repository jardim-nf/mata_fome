import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';

export const useTransferenciaMesa = (estabelecimentoId) => {
    
    /**
     * Transfere itens de uma mesa Origem para uma mesa Destino.
     * Se a mesa Destino estiver Livre, copia e zera Origem.
     * Se a mesa Destino estiver Ocupada, faz o merge (JUNTA) de totais e itens.
     */
    const executarTransferencia = async (mesaOrigem, mesaDestino) => {
        if (!estabelecimentoId || !mesaOrigem || !mesaDestino || mesaOrigem.id === mesaDestino.id) {
            toast.error("Parâmetros inválidos para transferência.");
            return false;
        }

        try {
            const functions = getFunctions();
            const transferir = httpsCallable(functions, 'transferirMesaBackend');
            
            await transferir({
                estabelecimentoId,
                mesaOrigemId: mesaOrigem.id,
                mesaDestinoId: mesaDestino.id
            });

            toast.success(`Mesa ${mesaOrigem.numero} transferida para a ${mesaDestino.numero} com sucesso!`);
            return true;

        } catch (error) {
            console.error("Erro na transferência:", error);
            const msg = typeof error === 'string' ? error : (error.message || "Erro desconhecido ao realizar transferência/junção.");
            toast.error(msg);
            return false;
        }
    };

    return { executarTransferencia };
};
