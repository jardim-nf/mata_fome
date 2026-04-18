import { useState, useEffect, useCallback } from 'react';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  query, 
  collectionGroup, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import { auditLogger } from '../utils/auditLogger';
import { vendaService } from '../services/vendaService';

export const formatId = (id) => {
  if (!id) return '#---';
  const parts = id.split('_');
  if (parts.length > 1) return `#${parts[1].substring(0, 6).toUpperCase()}`;
  if (id.length > 8) return `#${id.substring(0, 6).toUpperCase()}`;
  return `#${id.toUpperCase()}`;
};

export const getDate = (data) => {
  if (!data) return null;
  const t = data.dataPedido || data.criadoEm || data.createdAt || data.adicionadoEm || data.updatedAt;
  if (!t) return null;
  if (t.toDate) return t.toDate();
  return new Date(t);
};

export function usePedidoDetalhesMasterData(id, isMasterAdmin, currentUser, docPath) {
    const [pedido, setPedido] = useState(null);
    const [loadingPedido, setLoadingPedido] = useState(true);
    const [updating, setUpdating] = useState(false); 
    const [nfceStatus, setNfceStatus] = useState('idle'); 
    const [error, setError] = useState('');
    const [estabNome, setEstabNome] = useState('Carregando...');
    const [docRefPath, setDocRefPath] = useState(null);
    const [promptCancelNfce, setPromptCancelNfce] = useState(false);

    const fetchPedido = useCallback(async () => {
        try {
            setLoadingPedido(true);
            let foundData = null;
            let foundEstabId = null;
            let path = null;

            if (docPath) {
                let snap = await getDoc(doc(db, docPath));
                if (snap.exists()) {
                    foundData = { id: snap.id, ...snap.data() };
                    path = snap.ref;
                }
            }

            if (!foundData) {
                let docSnap = await getDoc(doc(db, 'pedidos', id));
                if (docSnap.exists()) {
                    foundData = { id: docSnap.id, ...docSnap.data() };
                    path = docSnap.ref;
                }
            }

            if (!foundData) {
               const qPed = query(collectionGroup(db, 'pedidos'), where('id', '==', id));
               const snapPed = await getDocs(qPed);
               if (!snapPed.empty) {
                  const d = snapPed.docs[0];
                  foundData = { id: d.id, ...d.data() };
                  path = d.ref;
               }
            }

            if (!foundData) throw new Error('Pedido não encontrado.');

            setPedido(foundData);
            setDocRefPath(path);
            
            foundEstabId = foundData.estabelecimentoId;
            if (!foundEstabId && path.path.includes('estabelecimentos/')) {
                const parts = path.path.split('/');
                foundEstabId = parts[1];
            }

            if (foundEstabId) {
              try {
                const estabSnap = await getDoc(doc(db, 'estabelecimentos', foundEstabId));
                if (estabSnap.exists()) setEstabNome(estabSnap.data().nome);
                else setEstabNome('ID não encontrado');
              } catch { setEstabNome('Erro bus. estab.'); }
            } else {
              setEstabNome('Global / N/A');
            }

        } catch (err) {
            console.error(err);
            setError("Não foi posible cargar este pedido.");
        } finally {
            setLoadingPedido(false);
        }
    }, [id]);

    useEffect(() => {
        if (!isMasterAdmin || !id) return;
        fetchPedido();
    }, [id, isMasterAdmin, fetchPedido, docPath]);

    const handleStatusChange = async (newStatus) => {
        if (!window.confirm(`Tem certeza que deseja mudar o status para "${newStatus.toUpperCase()}"?`)) return;
        if (!docRefPath) return toast.error("Referência do pedido perdida.");

        setUpdating(true);
        try {
            const oldStatus = pedido.status;

            await updateDoc(docRefPath, { 
                status: newStatus,
                updatedAt: new Date()
            });

            await auditLogger(
                'PEDIDO_STATUS_ALTERADO',
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, 
                { type: 'pedido', id: pedido.id, name: `Pedido ${formatId(pedido.id)}` }, 
                { de: oldStatus, para: newStatus, estabelecimento: estabNome } 
            );

            setPedido(prev => ({ ...prev, status: newStatus }));
            toast.success(`Status alterado para ${newStatus}`);

        } catch (err) {
            console.error("Erro ao atualizar:", err);
            toast.error("Erro ao atualizar status.");
        } finally {
            setUpdating(false);
        }
    };

    const handleReprocessarNfce = async () => {
        setNfceStatus('loading');
        try {
            const res = await vendaService.emitirNfce(pedido.id, pedido.clienteCpf || pedido.cliente?.cpf);
            if (res.sucesso || res.success) {
                toast.success("Nota enviada para reprocessamento com sucesso!");
                setPedido(prev => ({
                    ...prev,
                    fiscal: {
                        ...prev.fiscal,
                        status: 'PROCESSANDO',
                        idPlugNotas: res.idPlugNotas
                    }
                }));
            } else {
                toast.error("Erro ao reprocessar: " + (res.error || res.message));
            }
        } catch (error) {
            toast.error("Erro de comunicação ao reprocessar a nota.");
        } finally {
            setNfceStatus('idle');
        }
    };

    const handleConsultarStatus = async () => {
        if (!pedido.fiscal?.idPlugNotas) return toast.error("A nota não possui ID de Integração.");
        setNfceStatus('loading');
        try {
            const res = await vendaService.consultarStatusNfce(pedido.id, pedido.fiscal.idPlugNotas);
            if (res.sucesso) {
                toast.success(`Status Sincronizado: ${res.statusAtual}`);
                setPedido(prev => ({
                    ...prev, 
                    fiscal: { 
                        ...prev.fiscal, 
                        status: res.statusAtual, 
                        pdf: res.pdf || prev.fiscal?.pdf, 
                        xml: res.xml || prev.fiscal?.xml,
                        motivoRejeicao: res.mensagem || prev.fiscal?.motivoRejeicao
                    } 
                }));
            } else {
                toast.error("Erro ao consultar status: " + res.error);
            }
        } catch (error) {
            toast.error("Erro de conexão ao consultar a Sefaz.");
        } finally {
            setNfceStatus('idle');
        }
    };

    const handleVerXml = async () => {
        const idPlugNotas = pedido.fiscal?.idPlugNotas;
        if (!idPlugNotas) return toast.error("A nota não possui ID na PlugNotas.");

        setNfceStatus('loading');
        try {
            const res = await vendaService.baixarXmlNfce(idPlugNotas, pedido.id.slice(-6));
            if (!res.success) {
                toast.error("Erro ao baixar XML: " + res.error);
            }
        } catch (error) {
            toast.error("Erro de conexão ao tentar baixar o XML.");
        } finally {
            setNfceStatus('idle');
        }
    };

    const handleVerPdf = async () => {
        const idPlugNotas = pedido.fiscal?.idPlugNotas;
        const linkSefaz = pedido.fiscal?.pdf;
        if (!idPlugNotas) return toast.error("A nota não possui ID na PlugNotas.");

        setNfceStatus('loading');
        try {
            const res = await vendaService.baixarPdfNfce(idPlugNotas, linkSefaz);
            if (!res.success) {
                toast.error("Erro ao generar PDF: " + res.error);
            }
        } catch (error) {
            toast.error("Falha de comunicación ao tentar abrir o PDF.");
        } finally {
            setNfceStatus('idle');
        }
    };

    const handleCancelarNfce = async () => {
        if (!pedido.fiscal?.idPlugNotas) return;
        setPromptCancelNfce(true);
    };

    const executarCancelamentoNfce = async (justificativa) => {
        setPromptCancelNfce(false);
        if (!justificativa) return;
        if (justificativa.trim().length < 15) {
            toast.warning('A justificativa deve ter pelo menos 15 caracteres.');
            return;
        }
        setNfceStatus('loading');
        try {
            const res = await vendaService.cancelarNfce(pedido.id, justificativa.trim());
            if (res.success) {
                toast.success('Solicitação de cancelamento enviada!');
                setPedido(prev => ({
                    ...prev,
                    status: 'cancelado',
                    fiscal: { ...prev.fiscal, status: 'PROCESSANDO' }
                }));
            } else {
                toast.error('Erro ao cancelar: ' + res.error);
            }
        } catch (e) {
            toast.error('Falha de comunicação ao tentar cancelar a nota.');
        } finally {
            setNfceStatus('idle');
        }
    };

    const handleVerXmlCancelamento = async () => {
        const idPlugNotas = pedido.fiscal?.idPlugNotas;
        if (!idPlugNotas) return toast.error("A nota não possui ID na PlugNotas.");

        setNfceStatus('loading');
        try {
            const res = await vendaService.baixarXmlCancelamentoNfce(idPlugNotas, pedido.id.slice(-6));
            if (!res.success) {
                toast.error("Erro ao baixar XML de Cancelamento: " + res.error);
            }
        } catch (error) {
            toast.error("Erro de conexão ao tentar baixar o XML.");
        } finally {
            setNfceStatus('idle');
        }
    };

    return {
        pedido, setPedido,
        loadingPedido,
        updating,
        nfceStatus,
        error,
        estabNome,
        promptCancelNfce, setPromptCancelNfce,
        
        handleStatusChange,
        handleReprocessarNfce,
        handleConsultarStatus,
        handleVerXml,
        handleVerPdf,
        handleCancelarNfce,
        executarCancelamentoNfce,
        handleVerXmlCancelamento
    };
}
