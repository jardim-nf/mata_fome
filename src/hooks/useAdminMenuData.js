import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, getDocs, orderBy, setDoc } from 'firebase/firestore'; 
import { db } from '../firebase';
import { toast } from 'react-toastify';
import { uploadFile, deleteFileByUrl } from '../utils/firebaseStorageService';
import { departamentoFiscalService } from '../services/departamentoFiscalService';

const normalizeText = (text) => 
    text?.toString()
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") || "";

export function useAdminMenuData(primeiroEstabelecimento) {
    const [triggerReload, setTriggerReload] = useState(0);
    const reloadData = () => setTriggerReload(prev => prev + 1);

    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [departamentosFiscais, setDepartamentosFiscais] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // UI state that belongs in data layer for search/filter and form
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [stockFilter, setStockFilter] = useState('todos');
    
    // Form States
    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        nome: '', descricao: '', categoria: '', codigoBarras: '', 
        imageUrl: '', ativo: true, fiscal: { ncm: '', cfop: '5102', unidade: 'UN', departamentoId: '' }
    });
    const [itemImage, setItemImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    
    // NCM & Variations
    const [ncmResultados, setNcmResultados] = useState([]);
    const [pesquisandoNcm, setPesquisandoNcm] = useState(false);
    const [termoNcm, setTermoNcm] = useState('');
    const [variacoes, setVariacoes] = useState([]);
    const [uploading3DItemId, setUploading3DItemId] = useState(null);

    // FETCH DATA
    useEffect(() => {
        let isMounted = true;
        if (!primeiroEstabelecimento) { setLoading(false); return; }
        
        const carregarTudo = async () => {
            setLoading(true);
            try {
                const categoriasRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio');
                const catsSnapshot = await getDocs(query(categoriasRef, orderBy('ordem', 'asc')));
                
                const fetchedCategories = catsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (!isMounted) return;
                setCategories(fetchedCategories);

                if (fetchedCategories.length === 0) { 
                    setMenuItems([]); setLoading(false); return; 
                }

                const promises = fetchedCategories.map(async (catData) => {
                    const itemsRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catData.id, 'itens');
                    const itemsSnapshot = await getDocs(query(itemsRef));
                    return itemsSnapshot.docs.map(itemDoc => ({
                        ...itemDoc.data(), id: itemDoc.id, categoria: catData.nome, categoriaId: catData.id,
                        variacoes: Array.isArray(itemDoc.data().variacoes) ? itemDoc.data().variacoes : []
                    }));
                });

                const resultadosItens = await Promise.all(promises);
                
                // Buscar Departamentos Fiscais
                let dFs = [];
                try {
                    dFs = await departamentoFiscalService.getDepartamentos(primeiroEstabelecimento);
                } catch (e) {
                    console.error("Erro ao carregar departamentos fiscais:", e);
                }

                if (!isMounted) return;
                
                setDepartamentosFiscais(dFs);
                setMenuItems(resultadosItens.flat());
                setLoading(false);
            } catch (error) {
                console.error("Erro ao carregar menu gerencial:", error);
                if (isMounted) setLoading(false);
            }
        };

        carregarTudo();
        return () => { isMounted = false; };
    }, [primeiroEstabelecimento, triggerReload]);

    // FILTER LOGIC
    const filteredAndSortedItems = useMemo(() => {
        const searchNormalized = normalizeText(searchTerm);
        let filtered = menuItems.filter(item => {
            const matchCategory = selectedCategory === 'Todos' || item.categoria === selectedCategory;
            const matchSearch = normalizeText(item.nome).includes(searchNormalized) || normalizeText(item.descricao).includes(searchNormalized) || normalizeText(item.codigoBarras).includes(searchNormalized);
            const getS = (i) => {
                const e = Number(i.estoque) || 0;
                const m = Number(i.estoqueMinimo) || 0;
                if (e <= 0) return 'esgotado';
                if (e <= m) return 'critico';
                return 'normal';
            };
            const status = getS(item);
            const matchStock = stockFilter === 'todos' || stockFilter === status;
            return matchCategory && matchSearch && matchStock;
        });
        filtered.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        return filtered;
    }, [menuItems, searchTerm, selectedCategory, stockFilter]);

    // VARIATION LOGIC
    const adicionarVariacao = () => { setVariacoes([...variacoes, { id: `var-${Date.now()}`, nome: '', preco: '', descricao: '', ativo: true, estoque: 0, estoqueMinimo: 0, custo: 0 }]); };
    const atualizarVariacao = (id, field, value) => { setVariacoes(variacoes.map(v => v.id === id ? { ...v, [field]: value } : v)); };
    const removerVariacao = (id) => { if (variacoes.length <= 1) return toast.error('Mínimo 1 variação.'); setVariacoes(variacoes.filter(v => v.id !== id)); };

    // NCM LOGIC
    const buscarNcm = async (termo, handleFiscalChange) => {
        setTermoNcm(termo);
        handleFiscalChange({ target: { name: 'ncm', value: termo } });
        if (termo.length < 3) return setNcmResultados([]);
        setPesquisandoNcm(true);
        try {
            const res = await fetch(`/api/ncm/v1?search=${termo}`);
            if (res.ok) {
                const data = await res.json();
                setNcmResultados(Array.isArray(data) ? data.slice(0, 10) : []);
            }
        } catch(e) { console.error(e); }
        finally { setPesquisandoNcm(false); }
    };

    // FORM OPEN/CLOSE
    const openItemForm = useCallback((item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                nome: item.nome || '', descricao: item.descricao || '', categoria: item.categoria || '',
                codigoBarras: item.codigoBarras || '', imageUrl: item.imageUrl || '',
                ativo: item.ativo !== false, fiscal: item.fiscal || { ncm: '', cfop: '5102', unidade: 'UN', departamentoId: '' } 
            });
            setTermoNcm(item.fiscal?.ncm || '');
            setVariacoes(item.variacoes?.length ? item.variacoes.map(v => ({...v, preco: v.preco.toString()})) : [{ id: `v-${Date.now()}`, nome: 'Padrão', preco: item.preco.toString(), ativo: true, estoque: item.estoque || 0, custo: item.custo || 0 }]);
            setImagePreview(item.imageUrl || '');
        } else {
            setEditingItem(null);
            setFormData({ nome: '', descricao: '', categoria: '', codigoBarras: '', imageUrl: '', ativo: true, fiscal: { ncm: '', cfop: '5102', unidade: 'UN', departamentoId: '' } });
            setVariacoes([{ id: `v-${Date.now()}`, nome: 'Padrão', preco: '', ativo: true, estoque: 0, custo: 0 }]);
            setImagePreview(''); setTermoNcm('');
        }
        setShowItemForm(true);
    }, []);

    const closeItemForm = () => { setShowItemForm(false); setItemImage(null); };

    // ACTIONS
    const handleSaveItem = async (e, customFormData, customVariacoes, customItemImage) => {
        if(e) e.preventDefault();
        setFormLoading(true);

        const currentFormData = customFormData || formData;
        const currentVariacoes = customVariacoes || variacoes;
        const currentItemImage = customItemImage || itemImage;

        if (!currentFormData.nome.trim() || !currentFormData.categoria.trim()) {
            toast.error("Nome e Categoria são obrigatórios.");
            setFormLoading(false);
            return;
        }

        try {
            let imageUrl = currentFormData.imageUrl;
            if (currentItemImage) {
                imageUrl = await uploadFile(currentItemImage, `estabelecimentos/${primeiroEstabelecimento}/cardapio/${Date.now()}_${currentItemImage.name}`);
                if (editingItem?.imageUrl) await deleteFileByUrl(editingItem.imageUrl).catch(() => null);
            }

            const catNomeDigitadoBusca = currentFormData.categoria.trim().toUpperCase();
            const catDoc = categories.find(c => (c.nome || '').trim().toUpperCase() === catNomeDigitadoBusca);
            let catId = catDoc?.id;

            if (!catId) {
                const novoNome = currentFormData.categoria.trim(); // Or could uppercase it, let's keep user input case
                const newCat = await addDoc(collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio'), { nome: novoNome, ordem: 99, ativo: true });
                catId = newCat.id;
            }

            const itemData = {
                ...currentFormData,
                nome: currentFormData.nome.trim(),
                categoria: novoNome,
                imageUrl,
                variacoes: currentVariacoes.map(v => ({ ...v, preco: Number(v.preco), estoque: Number(v.estoque), custo: Number(v.custo) })),
                estoque: currentVariacoes.reduce((acc, v) => acc + Number(v.estoque), 0),
                preco: Math.min(...currentVariacoes.map(v => Number(v.preco))),
                atualizadoEm: new Date()
            };

            if (editingItem) {
                if (editingItem.categoriaId !== catId) {
                    await setDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catId, 'itens', editingItem.id), itemData);
                    await deleteDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', editingItem.categoriaId, 'itens', editingItem.id));
                } else {
                    await updateDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catId, 'itens', editingItem.id), itemData);
                }
                toast.success("Atualizado!");
            } else {
                await addDoc(collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catId, 'itens'), { ...itemData, criadoEm: new Date() });
                toast.success("Criado!");
            }
            closeItemForm(); reloadData();
        } catch (err) { toast.error("Erro ao salvar."); }
        finally { setFormLoading(false); }
    };

    const handleDeleteItem = async (item) => {
        if (!window.confirm(`Excluir ${item.nome}?`)) return;
        try {
            if (item.imageUrl) await deleteFileByUrl(item.imageUrl);
            await deleteDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id));
            toast.success("Excluído!"); reloadData();
        } catch(e) { toast.error("Erro ao excluir"); }
    };

    const toggleItemStatus = async (item) => {
        await updateDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id), { ativo: item.ativo === false });
        reloadData();
    };

    const handleUpload3D = async (item, file) => {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['glb', 'gltf'].includes(ext)) { toast.error('Formato inválido. Envie um arquivo .glb ou .gltf'); return; }
        if (file.size > 50 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 50MB.'); return; }
        try {
            setUploading3DItemId(item.id);
            toast.info('🧊 Enviando modelo 3D...', { autoClose: 3000 });
            const storagePath = `modelos3d/${primeiroEstabelecimento}/${item.id}.${ext}`;
            const url = await uploadFile(file, storagePath);
            await updateDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id), { modelo3dUrl: url });
            toast.success('✅ Modelo 3D enviado com sucesso!'); reloadData();
        } catch (error) { toast.error('Erro ao enviar modelo 3D. Tente novamente.'); } 
        finally { setUploading3DItemId(null); }
    };

    const stockStatistics = useMemo(() => {
        const getS = (i) => {
            const e = Number(i.estoque) || 0;
            const m = Number(i.estoqueMinimo) || 0;
            if (e <= 0) return 'esgotado';
            if (e <= m) return 'critico';
            return 'normal';
        };
        return {
            totalItems: menuItems.length,
            criticalStock: menuItems.filter(i => getS(i) === 'critico').length,
            outOfStock: menuItems.filter(i => getS(i) === 'esgotado').length,
            activeItems: menuItems.filter(i => i.ativo !== false).length,
            inactiveItems: menuItems.filter(i => i.ativo === false).length,
            totalInventoryValue: menuItems.reduce((acc, item) => acc + (item.variacoes?.reduce((s, v) => s + ((Number(v.estoque) || 0) * (Number(v.custo) || 0)), 0) || 0), 0)
        };
    }, [menuItems]);

    return {
        menuItems, categories, departamentosFiscais, loading, filteredAndSortedItems, stockStatistics,
        searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, stockFilter, setStockFilter,
        showItemForm, setShowItemForm, editingItem, setEditingItem, formData, setFormData,
        itemImage, setItemImage, imagePreview, setImagePreview, formLoading,
        ncmResultados, setNcmResultados, pesquisandoNcm, setPesquisandoNcm, termoNcm, setTermoNcm, 
        variacoes, setVariacoes, uploading3DItemId,
        adicionarVariacao, atualizarVariacao, removerVariacao, buscarNcm,
        openItemForm, closeItemForm, handleSaveItem, handleDeleteItem, toggleItemStatus, handleUpload3D
    };
}
