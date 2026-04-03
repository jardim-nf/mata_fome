import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

export function useTaxasDeEntregaData({ currentUser, isAdmin, isMaster, estabelecimentoId, navigate }) {
    const [bairros, setBairros] = useState([]);
    const [nomeBairro, setNomeBairro] = useState('');
    const [valorTaxa, setValorTaxa] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [accessGranted, setAccessGranted] = useState(false);

    // Modal de prompt
    const [promptConfig, setPromptConfig] = useState({
        open: false,
        type: null,
        bairro: null,
        title: '',
        message: '',
        defaultValue: '',
        placeholder: ''
    });

    // --- AUTENTICAÇÃO ---
    useEffect(() => {
        const hasAccess = currentUser && (isAdmin || isMaster) && estabelecimentoId;
        if (hasAccess) {
            setAccessGranted(true);
        } else {
            setAccessGranted(false);
            if (!currentUser) {
                toast.error('🔒 Faça login para acessar.');
                navigate('/login-admin');
                return;
            }
            if (!isAdmin && !isMaster) {
                toast.error('🔒 Acesso negado. Você precisa ser administrador.');
                navigate('/dashboard');
                return;
            }
            if (!estabelecimentoId) {
                toast.error('❌ Configuração de acesso incompleta. Configure seu estabelecimento.');
                navigate('/dashboard');
                return;
            }
        }
    }, [currentUser, isAdmin, isMaster, estabelecimentoId, navigate]);

    // --- FETCH DE TAXAS ---
    const getTaxas = useCallback(async () => {
        if (!estabelecimentoId) return;
        setLoading(true);
        try {
            const taxasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega');
            const q = query(taxasCollectionRef, orderBy('nomeBairro'));
            const data = await getDocs(q);
            const fetchedBairros = data.docs.map(i => ({ ...i.data(), id: i.id }));
            setBairros(fetchedBairros);
        } catch (err) {
            console.error(err);
            if (err.code === 'permission-denied') toast.error("❌ Permissão negada para acessar taxas.");
            else if (err.code !== 'not-found') toast.error("❌ Erro ao carregar as taxas de entrega.");
        } finally {
            setLoading(false);
        }
    }, [estabelecimentoId]);

    useEffect(() => {
        if (accessGranted && estabelecimentoId) {
            getTaxas();
        }
    }, [accessGranted, estabelecimentoId, getTaxas]);

    // --- AÇÕES DO FORMULÁRIO (CRUD BÁSICO) ---
    const clearForm = () => {
        setEditingId(null);
        setNomeBairro('');
        setValorTaxa('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!accessGranted) return toast.error('❌ Permissão negada.');
        if (!nomeBairro.trim() || valorTaxa === '') return toast.warn("⚠️ Preencha todos os campos.");

        const valorNumerico = parseFloat(valorTaxa.replace(',', '.'));
        if (isNaN(valorNumerico) || valorNumerico < 0) return toast.warn("⚠️ Insira um valor válido.");

        setFormLoading(true);
        try {
            const taxasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega');
            if (editingId) {
                const bairroDoc = doc(taxasCollectionRef, editingId);
                await updateDoc(bairroDoc, { 
                    nomeBairro: nomeBairro.trim(), 
                    valorTaxa: valorNumerico,
                    atualizadoEm: new Date()
                });
                toast.success("✅ Taxa atualizada com sucesso!");
            } else {
                await addDoc(taxasCollectionRef, { 
                    nomeBairro: nomeBairro.trim(), 
                    valorTaxa: valorNumerico,
                    criadoEm: new Date(),
                    ativo: true
                });
                toast.success("✅ Nova taxa adicionada com sucesso!");
            }
            clearForm();
            getTaxas();
        } catch (err) {
            console.error(err);
            toast.error("❌ Erro ao salvar taxa.");
        } finally {
            setFormLoading(false);
        }
    };

    const handleEdit = (bairro) => {
        if (!accessGranted) return;
        setEditingId(bairro.id);
        setNomeBairro(bairro.nomeBairro);
        setValorTaxa(bairro.valorTaxa.toFixed(2).replace('.', ','));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleQuickEdit = async (bairro, novoValor) => {
        if (!accessGranted) return;
        const valorNumerico = parseFloat(novoValor.replace(',', '.'));
        if (isNaN(valorNumerico) || valorNumerico < 0) return toast.warn("⚠️ Valor inválido.");

        setFormLoading(true);
        try {
            const bairroDoc = doc(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega', bairro.id);
            await updateDoc(bairroDoc, { valorTaxa: valorNumerico, atualizadoEm: new Date() });
            toast.success(`✅ Taxa de ${bairro.nomeBairro} alterada.`);
            getTaxas();
        } catch (err) {
            toast.error("❌ Erro ao alterar taxa.");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id, nome) => {
        try {
            const taxaDocRef = doc(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega', id);
            await deleteDoc(taxaDocRef);
            toast.success(`✅ Taxa "${nome}" excluída.`);
            getTaxas();
        } catch (err) {
            toast.error("❌ Erro ao excluir a taxa.");
        }
    };

    // --- COMPORTAMENTOS DO PROMPT DIALOG E DE LOTE ---
    const closePrompt = () => setPromptConfig(prev => ({ ...prev, open: false }));

    const handlePromptSubmit = async (inputValue) => {
        if (!inputValue || !accessGranted) {
            closePrompt();
            return;
        }

        const inputNumber = parseFloat(inputValue.replace(',', '.'));
        if (isNaN(inputNumber) || inputNumber <= 0) {
            toast.error("❌ Por favor insira um valor válido.");
            return;
        }

        const { type, bairro } = promptConfig;
        closePrompt();

        if (type === 'EDIT_BAIRRO') {
            await handleQuickEdit(bairro, inputValue);
            return;
        }

        if (type === 'AUMENTAR_VALOR' || type === 'AUMENTAR_PERCENT') {
            setFormLoading(true);
            try {
                const batch = writeBatch(db);
                bairros.forEach(b => {
                    const docRef = doc(db, 'estabelecimentos', estabelecimentoId, 'taxasDeEntrega', b.id);
                    let novoValorTaxa = b.valorTaxa;

                    if (type === 'AUMENTAR_VALOR') {
                        novoValorTaxa += inputNumber;
                    } else if (type === 'AUMENTAR_PERCENT') {
                        novoValorTaxa += (b.valorTaxa * (inputNumber / 100));
                    }
                    
                    batch.update(docRef, { valorTaxa: Number(novoValorTaxa.toFixed(2)), atualizadoEm: new Date() });
                });

                await batch.commit();
                toast.success(`✅ ${bairros.length} taxas atualizadas com sucesso em Lote!`);
                getTaxas();
            } catch (err) {
                console.error("Erro no lote: ", err);
                toast.error("❌ Erro na atualização em Lote.");
            } finally {
                setFormLoading(false);
            }
        }
    };

    // --- ESTATÍSTICAS ---
    const estatisticas = useMemo(() => {
        return {
            total: bairros.length,
            valorMedio: bairros.length > 0 ? bairros.reduce((acc, b) => acc + b.valorTaxa, 0) / bairros.length : 0,
            valorMinimo: bairros.length > 0 ? Math.min(...bairros.map(b => b.valorTaxa)) : 0,
            valorMaximo: bairros.length > 0 ? Math.max(...bairros.map(b => b.valorTaxa)) : 0
        };
    }, [bairros]);

    return {
        // Dados e Estados
        bairros, nomeBairro, setNomeBairro,
        valorTaxa, setValorTaxa,
        editingId, loading, formLoading, accessGranted,
        
        // Modal de prompt
        promptConfig, setPromptConfig, handlePromptSubmit, closePrompt,

        // Cálculos
        estatisticas,

        // Funções da tela
        handleSubmit, clearForm, handleEdit, handleDelete 
    };
}
