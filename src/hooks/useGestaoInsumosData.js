import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

const normalizeText = (text) =>
    text?.toString()
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") || "";

const UNIDADES = [
    { value: 'g', label: 'Gramas (g)', fator: 1 },
    { value: 'kg', label: 'Quilogramas (kg)', fator: 1000 },
    { value: 'ml', label: 'Mililitros (ml)', fator: 1 },
    { value: 'L', label: 'Litros (L)', fator: 1000 },
    { value: 'un', label: 'Unidades (un)', fator: 1 },
];

const CATEGORIAS_PADRAO = ['Frios', 'Carnes', 'Laticínios', 'Bebidas', 'Secos', 'Hortifrúti', 'Condimentos', 'Embalagens', 'Outros'];

const FORM_INICIAL = {
    nome: '',
    unidade: 'g',
    estoqueAtual: 0,
    estoqueMinimo: 0,
    custoUnitario: 0,
    fornecedor: '',
    categoria: '',
    ativo: true,
};

export { UNIDADES, CATEGORIAS_PADRAO };

export function useGestaoInsumosData(estabelecimentoId) {
    const [insumos, setInsumos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [triggerReload, setTriggerReload] = useState(0);
    const reloadData = () => setTriggerReload(prev => prev + 1);

    // UI state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [stockFilter, setStockFilter] = useState('todos');

    // Form
    const [showForm, setShowForm] = useState(false);
    const [editingInsumo, setEditingInsumo] = useState(null);
    const [formData, setFormData] = useState({ ...FORM_INICIAL });
    const [formLoading, setFormLoading] = useState(false);

    // FETCH
    useEffect(() => {
        let isMounted = true;
        if (!estabelecimentoId) { setLoading(false); return; }

        const carregar = async () => {
            setLoading(true);
            try {
                const ref = collection(db, 'estabelecimentos', estabelecimentoId, 'insumos');
                const snapshot = await getDocs(query(ref, orderBy('nome', 'asc')));
                if (!isMounted) return;
                setInsumos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error('Erro ao carregar insumos:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        carregar();
        return () => { isMounted = false; };
    }, [estabelecimentoId, triggerReload]);

    // FILTER
    const filteredInsumos = useMemo(() => {
        const searchNorm = normalizeText(searchTerm);
        return insumos.filter(insumo => {
            const matchCategory = selectedCategory === 'Todos' || insumo.categoria === selectedCategory;
            const matchSearch = normalizeText(insumo.nome).includes(searchNorm) || normalizeText(insumo.fornecedor).includes(searchNorm);

            const estoque = Number(insumo.estoqueAtual) || 0;
            const minimo = Number(insumo.estoqueMinimo) || 0;
            let status = 'normal';
            if (estoque <= 0) status = 'esgotado';
            else if (estoque <= minimo) status = 'critico';

            const matchStock = stockFilter === 'todos' || stockFilter === status;
            return matchCategory && matchSearch && matchStock;
        });
    }, [insumos, searchTerm, selectedCategory, stockFilter]);

    // CATEGORIAS EXISTENTES
    const categoriasExistentes = useMemo(() => {
        const cats = new Set(insumos.map(i => i.categoria).filter(Boolean));
        CATEGORIAS_PADRAO.forEach(c => cats.add(c));
        return [...cats].sort();
    }, [insumos]);

    // STATS
    const stats = useMemo(() => {
        const total = insumos.length;
        const ativos = insumos.filter(i => i.ativo !== false).length;
        let critico = 0, esgotado = 0, valorTotal = 0;

        insumos.forEach(i => {
            const est = Number(i.estoqueAtual) || 0;
            const min = Number(i.estoqueMinimo) || 0;
            const custo = Number(i.custoUnitario) || 0;

            if (est <= 0) esgotado++;
            else if (est <= min) critico++;

            valorTotal += est * custo;
        });

        return { total, ativos, critico, esgotado, valorTotal };
    }, [insumos]);

    // FORM OPEN/CLOSE
    const openForm = useCallback((insumo = null) => {
        if (insumo) {
            setEditingInsumo(insumo);
            setFormData({
                nome: insumo.nome || '',
                unidade: insumo.unidade || 'g',
                estoqueAtual: insumo.estoqueAtual ?? 0,
                estoqueMinimo: insumo.estoqueMinimo ?? 0,
                custoUnitario: insumo.custoUnitario ?? 0,
                fornecedor: insumo.fornecedor || '',
                categoria: insumo.categoria || '',
                ativo: insumo.ativo !== false,
            });
        } else {
            setEditingInsumo(null);
            setFormData({ ...FORM_INICIAL });
        }
        setShowForm(true);
    }, []);

    const closeForm = useCallback(() => {
        setShowForm(false);
        setEditingInsumo(null);
    }, []);

    // SAVE
    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!formData.nome.trim()) {
            toast.error('Nome do insumo é obrigatório.');
            return;
        }
        if (!formData.categoria.trim()) {
            toast.error('Categoria é obrigatória.');
            return;
        }

        setFormLoading(true);
        try {
            const dados = {
                nome: formData.nome.trim(),
                unidade: formData.unidade,
                estoqueAtual: Number(formData.estoqueAtual) || 0,
                estoqueMinimo: Number(formData.estoqueMinimo) || 0,
                custoUnitario: Number(formData.custoUnitario) || 0,
                fornecedor: formData.fornecedor.trim(),
                categoria: formData.categoria.trim(),
                ativo: formData.ativo,
                atualizadoEm: new Date(),
            };

            if (editingInsumo) {
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'insumos', editingInsumo.id), dados);
                toast.success('Insumo atualizado!');
            } else {
                dados.criadoEm = new Date();
                await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'insumos'), dados);
                toast.success('Insumo criado!');
            }
            closeForm();
            reloadData();
        } catch (err) {
            console.error('Erro ao salvar insumo:', err);
            toast.error('Erro ao salvar insumo.');
        } finally {
            setFormLoading(false);
        }
    };

    // DELETE
    const handleDelete = async (insumo) => {
        if (!window.confirm(`Excluir "${insumo.nome}"? Produtos vinculados a esse insumo perderão a referência.`)) return;
        try {
            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'insumos', insumo.id));
            toast.success('Insumo excluído!');
            reloadData();
        } catch (err) {
            console.error('Erro ao excluir insumo:', err);
            toast.error('Erro ao excluir.');
        }
    };

    // TOGGLE STATUS
    const toggleStatus = async (insumo) => {
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'insumos', insumo.id), { ativo: insumo.ativo === false });
            reloadData();
        } catch (err) {
            toast.error('Erro ao alterar status.');
        }
    };

    // AJUSTAR ESTOQUE MANUAL (para entrada rápida)
    const ajustarEstoque = async (insumoId, quantidade, operacao = 'adicionar') => {
        const insumo = insumos.find(i => i.id === insumoId);
        if (!insumo) return;

        const estoqueAtual = Number(insumo.estoqueAtual) || 0;
        const novoEstoque = operacao === 'adicionar'
            ? estoqueAtual + Number(quantidade)
            : estoqueAtual - Number(quantidade);

        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'insumos', insumoId), {
                estoqueAtual: Math.max(0, novoEstoque),
                atualizadoEm: new Date(),
            });
            toast.success(`Estoque atualizado: ${novoEstoque.toFixed(2)} ${insumo.unidade}`);
            reloadData();
        } catch (err) {
            toast.error('Erro ao ajustar estoque.');
        }
    };

    return {
        insumos, loading, filteredInsumos, categoriasExistentes, stats,
        searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, stockFilter, setStockFilter,
        showForm, formData, setFormData, formLoading, editingInsumo,
        openForm, closeForm, handleSave, handleDelete, toggleStatus, ajustarEstoque,
    };
}
