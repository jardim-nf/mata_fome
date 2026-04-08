import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
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

        const origemRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaOrigem.id);
        const destinoRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaDestino.id);

        try {
            await runTransaction(db, async (transaction) => {
                const docOrigem = await transaction.get(origemRef);
                const docDestino = await transaction.get(destinoRef);

                if (!docOrigem.exists() || !docDestino.exists()) {
                    throw "Mesa Origem ou Destino não existe mais no sistema.";
                }

                const dataOrigem = docOrigem.data();
                const dataDestino = docDestino.data();

                if (dataOrigem.status === 'livre' || dataOrigem.itens?.length === 0) {
                    throw "A mesa de origem está vazia ou livre, nada para transferir.";
                }

                if (dataDestino.status === 'livre') {
                    // ====== TRANSFERÊNCIA SIMPLES ======
                    // A mesa destino assume exatamente a carga da antiga
                    transaction.update(destinoRef, {
                        status: 'ocupada',
                        total: dataOrigem.total || 0,
                        pessoas: dataOrigem.pessoas || 1,
                        itens: dataOrigem.itens || [],
                        nome: dataOrigem.nome || '',
                        nomesOcupantes: dataOrigem.nomesOcupantes || ['Mesa'],
                        updatedAt: serverTimestamp(),
                        bloqueadoPor: null,
                        bloqueadoPorNome: null,
                        bloqueadoEm: null,
                    });
                } else {
                    // ====== JUNÇÃO DE MESAS ======
                    // A mesa destino já tem cliente. Vamos somar e agrupar nomes.
                    const novosItens = [...(dataDestino.itens || []), ...(dataOrigem.itens || [])];
                    const novoTotal = (dataDestino.total || 0) + (dataOrigem.total || 0);
                    const novasPessoas = (dataDestino.pessoas || 1) + (dataOrigem.pessoas || 1);
                    
                    // Mescla os nomes evitando duplicar a palavra "Mesa"
                    let nomesOcupantes = [...(dataDestino.nomesOcupantes || ['Mesa']), ...(dataOrigem.nomesOcupantes || [])]
                        .filter(n => n !== 'Mesa');
                    
                    if (nomesOcupantes.length === 0) nomesOcupantes = ['Mesa'];
                    
                    // Filtra duplicatas se quiser (opcional)
                    nomesOcupantes = [...new Set(nomesOcupantes)];

                    transaction.update(destinoRef, {
                        total: novoTotal,
                        pessoas: novasPessoas,
                        itens: novosItens,
                        nomesOcupantes: nomesOcupantes,
                        updatedAt: serverTimestamp(),
                    });
                }

                // Zera totalmente a mesa origem
                transaction.update(origemRef, {
                    status: 'livre',
                    total: 0,
                    pessoas: 0,
                    itens: [],
                    nome: '',
                    nomesOcupantes: ['Mesa'],
                    updatedAt: serverTimestamp(),
                    solicitarImpressaoConferencia: false,
                    bloqueadoPor: null,
                    bloqueadoPorNome: null,
                    bloqueadoEm: null,
                });
            });

            toast.success(`Mesa ${mesaOrigem.numero} transferida para a ${mesaDestino.numero} com sucesso!`);
            return true;

        } catch (error) {
            console.error("Erro na transferência:", error);
            const msg = typeof error === 'string' ? error : "Erro desconhecido ao realizar transferência/junção.";
            toast.error(msg);
            return false;
        }
    };

    return { executarTransferencia };
};
