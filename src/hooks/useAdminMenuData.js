import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, getDocs, orderBy, setDoc, onSnapshot } from 'firebase/firestore'; 
import { db } from '../firebase';
import { toast } from 'react-toastify';
import { uploadFile, deleteFileByUrl } from '../utils/firebaseStorageService';
import { departamentoFiscalService } from '../services/departamentoFiscalService';

const parseBrazilianNumber = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const str = String(val).trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

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
    const [insumosDisponiveis, setInsumosDisponiveis] = useState([]);
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
        imageUrl: '', ativo: true, 
        exibirDelivery: true, exibirPdv: true, exibirSalao: true,
        fiscal: { ncm: '', cfop: '5102', unidade: 'UN', departamentoId: '' },
        fichaTecnica: [], fracionadoAtivo: false, precoKgVarejo: '',
        tipoItem: 'produto'
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

    const prevEstabelecimentoRef = useRef(primeiroEstabelecimento);

    // FETCH DATA
    useEffect(() => {
        if (!primeiroEstabelecimento) { setLoading(false); return; }
        
        const isNewEstab = prevEstabelecimentoRef.current !== primeiroEstabelecimento;
        prevEstabelecimentoRef.current = primeiroEstabelecimento;

        if (isNewEstab || menuItems.length === 0) {
            setLoading(true);
            setMenuItems([]);
        }
        
        const categoriasRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio');
        const qCats = query(categoriasRef, orderBy('ordem', 'asc'));

        let itemListeners = [];
        let insumosListener = null;

        const unsubscribeCats = onSnapshot(qCats, (catsSnapshot) => {
            const fetchedCategories = catsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(fetchedCategories);

            // Clean up previous item listeners
            itemListeners.forEach(unsub => unsub());
            itemListeners = [];

            if (fetchedCategories.length === 0) {
                setMenuItems([]);
                setLoading(false);
                return;
            }

            const itemsMap = {};
            let loadedCategories = new Set();

            fetchedCategories.forEach((catData) => {
                const itemsRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catData.id, 'itens');
                
                const unsub = onSnapshot(itemsRef, (itemsSnapshot) => {
                    const catItems = itemsSnapshot.docs.map(itemDoc => ({
                        ...itemDoc.data(),
                        id: itemDoc.id,
                        categoria: catData.nome,
                        categoriaId: catData.id,
                        variacoes: Array.isArray(itemDoc.data().variacoes) ? itemDoc.data().variacoes : []
                    }));

                    itemsMap[catData.id] = catItems;
                    loadedCategories.add(catData.id);

                    // Reassemble all items from categories that have loaded at least once
                    const allItems = [];
                    fetchedCategories.forEach(c => {
                        if (itemsMap[c.id]) {
                            allItems.push(...itemsMap[c.id]);
                        }
                    });
                    
                    setMenuItems(allItems);
                    
                    // Only turn off loading once we've heard from all category snapshots at least once
                    if (loadedCategories.size >= fetchedCategories.length) {
                        setLoading(false);
                    }
                }, (error) => {
                    console.error(`Erro ao carregar itens da categoria ${catData.id}:`, error);
                });

                itemListeners.push(unsub);
            });
        }, (error) => {
            console.error("Erro ao carregar categorias:", error);
            setLoading(false);
        });

        // Buscar Departamentos Fiscais (async, pois não muda frequentemente)
        let isMounted = true;
        const carregarFiscais = async () => {
            try {
                const dFs = await departamentoFiscalService.getDepartamentos(primeiroEstabelecimento);
                if (isMounted) setDepartamentosFiscais(dFs);
            } catch (e) {
                console.error("Erro ao carregar departamentos fiscais:", e);
            }
        };
        carregarFiscais();

        // Buscar Insumos em tempo real
        const insumosRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'insumos');
        insumosListener = onSnapshot(query(insumosRef), (insumosSnap) => {
            const insumosData = insumosSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.ativo !== false);
            setInsumosDisponiveis(insumosData);
        }, (error) => {
            console.error("Erro ao escutar insumos:", error);
        });

        return () => {
            isMounted = false;
            unsubscribeCats();
            itemListeners.forEach(unsub => unsub());
            if (insumosListener) insumosListener();
        };
    }, [primeiroEstabelecimento, triggerReload]);

    // FILTER LOGIC
    const filteredAndSortedItems = useMemo(() => {
        const searchNormalized = normalizeText(searchTerm);
        let filtered = menuItems.filter(item => {
            const matchCategory = selectedCategory === 'Todos' || item.categoria === selectedCategory;
            const matchSearch = normalizeText(item.nome).includes(searchNormalized) || 
                                normalizeText(item.descricao).includes(searchNormalized) || 
                                normalizeText(item.codigoBarras).includes(searchNormalized) ||
                                (Array.isArray(item.variacoes) && item.variacoes.some(v => normalizeText(v.nome).includes(searchNormalized)));
            const getS = (i) => {
                const e = Number(i.estoque) || 0;
                const m = Number(i.estoqueMinimo) || 0;
                if (e <= 0) return 'esgotado';
                if (e <= m) return 'critico';
                return 'normal';
            };
            const status = getS(item);
            
            let matchStock = true;
            if (stockFilter === 'critico') matchStock = status === 'critico';
            else if (stockFilter === 'esgotado') matchStock = status === 'esgotado';
            else if (stockFilter === 'normal') matchStock = status === 'normal';
            else if (stockFilter === 'ativos') matchStock = item.ativo !== false && !(Array.isArray(item.variacoes) && item.variacoes.length > 0 && item.variacoes.every(v => v.ativo === false));
            else if (stockFilter === 'sem_ncm') matchStock = !item.fiscal?.ncm || item.fiscal.ncm.trim() === '';
            else if (stockFilter === 'zerado') matchStock = Number(item.preco) === 0 || (Array.isArray(item.variacoes) && item.variacoes.some(v => Number(v.preco) === 0));
            else if (stockFilter === 'inativos') matchStock = item.ativo === false || (Array.isArray(item.variacoes) && item.variacoes.some(v => v.ativo === false));
            else if (stockFilter === 'sem_foto') matchStock = !item.imageUrl;

            return matchCategory && matchSearch && matchStock;
        });
        filtered.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        return filtered;
    }, [menuItems, searchTerm, selectedCategory, stockFilter]);

    // VARIATION LOGIC
    const adicionarVariacao = () => { setVariacoes([...variacoes, { id: `var-${Date.now()}`, nome: '', preco: '', precoPromocional: '', precoCartao: '', precoCrediario: '', habilitarCartao: false, habilitarCrediario: false, descricao: '', ativo: true, estoque: 0, estoqueMinimo: 0, lote: '', dataValidade: '', custo: 0 }]); };
    const atualizarVariacao = (id, field, value) => { setVariacoes(variacoes.map(v => v.id === id ? { ...v, [field]: value } : v)); };
    const removerVariacao = (id) => { if (variacoes.length <= 1) return toast.error('Mínimo 1 variação.'); setVariacoes(variacoes.filter(v => v.id !== id)); };
    const reordenarVariacao = (index, direcao) => {
        if (index === 0 && direcao === -1) return;
        if (index === variacoes.length - 1 && direcao === 1) return;
        const novasVariacoes = [...variacoes];
        const item = novasVariacoes[index];
        novasVariacoes.splice(index, 1);
        novasVariacoes.splice(index + direcao, 0, item);
        setVariacoes(novasVariacoes);
    };

    // NCM LOGIC
    const buscarNcm = async (termo, handleFiscalChange) => {
        setTermoNcm(termo);
        handleFiscalChange({ target: { name: 'ncm', value: termo } });
        if (termo.length < 3) return setNcmResultados([]);
        setPesquisandoNcm(true);
        try {
            const res = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${termo}`);
            if (res.ok) {
                const data = await res.json();
                setNcmResultados(Array.isArray(data) ? data.slice(0, 10) : []);
            } else {
                toast.error(`Erro BrasilAPI: ${res.status}`);
            }
        } catch(e) { 
            console.error(e); 
            toast.error(`Erro de conexão NCM: ${e.message}`);
        }
        finally { setPesquisandoNcm(false); }
    };

    // FORM OPEN/CLOSE
    const openItemForm = useCallback((item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                nome: item.nome || '', descricao: item.descricao || '', categoria: item.categoria || '',
                codigoBarras: item.codigoBarras || '', imageUrl: item.imageUrl || '',
                ativo: item.ativo !== false, 
                exibirDelivery: item.exibirDelivery !== false,
                exibirPdv: item.exibirPdv !== false,
                exibirSalao: item.exibirSalao !== false,
                fiscal: item.fiscal || { ncm: '', cfop: '5102', unidade: 'UN', departamentoId: '' },
                fichaTecnica: Array.isArray(item.fichaTecnica) ? item.fichaTecnica : [],
                fracionadoAtivo: item.fracionadoAtivo || false,
                precoKgVarejo: item.precoKgVarejo !== undefined ? item.precoKgVarejo.toString() : '',
                tipoItem: item.tipoItem || 'produto'
            });
            setTermoNcm(item.fiscal?.ncm || '');
            setVariacoes(item.variacoes?.length 
                ? item.variacoes.map((v, idx) => ({
                    ...v, 
                    id: v.id || `var-${Date.now()}-${idx}`, 
                    preco: v.preco !== undefined ? v.preco.toString() : '',
                    precoPromocional: v.precoPromocional !== undefined ? v.precoPromocional.toString() : '',
                    precoCartao: v.precoCartao !== undefined ? v.precoCartao.toString() : '',
                    precoCrediario: v.precoCrediario !== undefined ? v.precoCrediario.toString() : '',
                    habilitarCartao: v.habilitarCartao !== undefined ? v.habilitarCartao : (Number(v.precoCartao) > 0),
                    habilitarCrediario: v.habilitarCrediario !== undefined ? v.habilitarCrediario : (Number(v.precoCrediario) > 0),
                    estoque: v.estoque !== undefined ? Number(v.estoque) : 0,
                    estoqueMinimo: v.estoqueMinimo !== undefined ? Number(v.estoqueMinimo) : 0,
                    lote: v.lote || '',
                    dataValidade: v.dataValidade || ''
                })) 
                : [{ 
                    id: `v-${Date.now()}`, 
                    nome: 'Padrão', 
                    preco: item.preco !== undefined ? item.preco.toString() : '', 
                    precoPromocional: item.precoPromocional !== undefined ? item.precoPromocional.toString() : '', 
                    precoCartao: item.precoCartao !== undefined ? item.precoCartao.toString() : '', 
                    precoCrediario: item.precoCrediario !== undefined ? item.precoCrediario.toString() : '', 
                    habilitarCartao: item.habilitarCartao !== undefined ? item.habilitarCartao : (Number(item.precoCartao) > 0),
                    habilitarCrediario: item.habilitarCrediario !== undefined ? item.habilitarCrediario : (Number(item.precoCrediario) > 0),
                    ativo: true, 
                    estoque: item.estoque || 0, 
                    estoqueMinimo: item.estoqueMinimo || 0,
                    lote: item.lote || '',
                    dataValidade: item.dataValidade || '',
                    custo: item.custo || 0 
                }]);
            setImagePreview(item.imageUrl || '');
        } else {
            setEditingItem(null);
            setFormData({ 
                nome: '', descricao: '', categoria: '', codigoBarras: '', imageUrl: '', ativo: true, 
                exibirDelivery: true, exibirPdv: true, exibirSalao: true,
                fiscal: { ncm: '', cfop: '5102', unidade: 'UN', departamentoId: '' }, 
                fichaTecnica: [], fracionadoAtivo: false, precoKgVarejo: '',
                tipoItem: 'produto'
            });
            setVariacoes([{ id: `v-${Date.now()}`, nome: 'Padrão', preco: '', precoPromocional: '', precoCartao: '', precoCrediario: '', habilitarCartao: false, habilitarCrediario: false, ativo: true, estoque: 0, estoqueMinimo: 0, lote: '', dataValidade: '', custo: 0 }]);
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
            let finalCategoryName = currentFormData.categoria.trim();

            if (!catId) {
                const newCat = await addDoc(collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio'), { nome: finalCategoryName, ordem: 99, ativo: true });
                catId = newCat.id;
            }

            const maiorCusto = Math.max(...currentVariacoes.map(v => parseBrazilianNumber(v.custo)));
            const custoPadrao = currentVariacoes.length === 1 ? parseBrazilianNumber(currentVariacoes[0].custo) : maiorCusto;

            const isServico = currentFormData.tipoItem === 'servico';

            const itemData = {
                ...currentFormData,
                nome: currentFormData.nome.trim(),
                categoria: finalCategoryName,
                imageUrl,
                variacoes: currentVariacoes.map(v => ({ 
                    ...v, 
                    preco: parseBrazilianNumber(v.preco), 
                    precoPromocional: parseBrazilianNumber(v.precoPromocional), 
                    precoCartao: parseBrazilianNumber(v.precoCartao), 
                    precoCrediario: parseBrazilianNumber(v.precoCrediario), 
                    habilitarCartao: v.habilitarCartao !== false,
                    habilitarCrediario: v.habilitarCrediario !== false,
                    estoque: isServico ? 0 : parseBrazilianNumber(v.estoque), 
                    estoqueMinimo: isServico ? 0 : parseBrazilianNumber(v.estoqueMinimo),
                    lote: v.lote || '',
                    dataValidade: v.dataValidade || '',
                    custo: parseBrazilianNumber(v.custo) 
                })),
                estoque: isServico ? 0 : currentVariacoes.reduce((acc, v) => acc + parseBrazilianNumber(v.estoque), 0),
                estoqueMinimo: isServico ? 0 : currentVariacoes.reduce((acc, v) => acc + parseBrazilianNumber(v.estoqueMinimo), 0),
                lote: currentVariacoes.length === 1 ? (currentVariacoes[0].lote || '') : '',
                dataValidade: currentVariacoes.length === 1 ? (currentVariacoes[0].dataValidade || '') : '',
                preco: Math.min(...currentVariacoes.map(v => {
                    const promVal = parseBrazilianNumber(v.precoPromocional);
                    const preVal = parseBrazilianNumber(v.preco);
                    return (promVal > 0 && promVal < preVal) ? promVal : preVal;
                })),
                precoPromocional: Math.min(...currentVariacoes.map(v => parseBrazilianNumber(v.precoPromocional))),
                precoCartao: Math.min(...currentVariacoes.map(v => parseBrazilianNumber(v.precoCartao))),
                precoCrediario: Math.min(...currentVariacoes.map(v => parseBrazilianNumber(v.precoCrediario))),
                habilitarCartao: currentVariacoes.some(v => v.habilitarCartao !== false),
                habilitarCrediario: currentVariacoes.some(v => v.habilitarCrediario !== false),
                custo: custoPadrao,
                custo_estimado: custoPadrao,
                fichaTecnica: currentFormData.fichaTecnica || [],
                fracionadoAtivo: currentFormData.fracionadoAtivo || false,
                precoKgVarejo: currentFormData.fracionadoAtivo ? parseBrazilianNumber(currentFormData.precoKgVarejo) : 0,
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
            closeItemForm();
        } catch (err) { 
            console.error("Erro ao salvar item:", err);
            toast.error("Erro ao salvar: " + err.message); 
        }
        finally { setFormLoading(false); }
    };

    const handleDeleteItem = async (item) => {
        if (!window.confirm(`Excluir ${item.nome}?`)) return;
        try {
            if (item.imageUrl) await deleteFileByUrl(item.imageUrl).catch(() => null);
            
            let catId = item.categoriaId;
            if (!catId && item.categoria) {
                const catDoc = categories.find(c => (c.nome || '').trim().toUpperCase() === item.categoria.trim().toUpperCase());
                catId = catDoc?.id;
            }
            
            if (!catId) {
                toast.error("Categoria não encontrada para este produto.");
                return;
            }
            
            await deleteDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catId, 'itens', item.id));
            toast.success("Excluído!"); 
            closeItemForm();
        } catch(e) { 
            console.error("Erro ao excluir produto:", e);
            toast.error("Erro ao excluir"); 
        }
    };

    const toggleItemStatus = async (item) => {
        await updateDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id), { ativo: item.ativo === false });
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
            toast.success('✅ Modelo 3D enviado com sucesso!');
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
            activeItems: menuItems.filter(i => i.ativo !== false && !(Array.isArray(i.variacoes) && i.variacoes.length > 0 && i.variacoes.every(v => v.ativo === false))).length,
            inactiveItems: menuItems.filter(i => i.ativo === false || (Array.isArray(i.variacoes) && i.variacoes.some(v => v.ativo === false))).length,
            totalInventoryValue: menuItems.reduce((acc, item) => acc + (item.variacoes?.reduce((s, v) => s + (Math.max(0, Number(v.estoque) || 0) * (Number(v.custo) || 0)), 0) || 0), 0)
        };
    }, [menuItems]);

    // FICHA TÉCNICA helpers
    const adicionarInsumoFicha = (insumoId) => {
        const insumo = insumosDisponiveis.find(i => i.id === insumoId);
        if (!insumo) return;
        // Verificar se já existe
        if (formData.fichaTecnica.some(f => f.insumoId === insumoId)) {
            toast.warning('Este insumo já está na ficha técnica.');
            return;
        }
        setFormData(prev => ({
            ...prev,
            fichaTecnica: [...prev.fichaTecnica, {
                insumoId: insumo.id,
                nomeInsumo: insumo.nome,
                unidade: insumo.unidade,
                custoUnitario: Number(insumo.custoUnitario) || 0,
                quantidade: 0
            }]
        }));
    };

    const removerInsumoFicha = (insumoId) => {
        setFormData(prev => ({
            ...prev,
            fichaTecnica: prev.fichaTecnica.filter(f => f.insumoId !== insumoId)
        }));
    };

    const atualizarQuantidadeFicha = (insumoId, quantidade) => {
        setFormData(prev => ({
            ...prev,
            fichaTecnica: prev.fichaTecnica.map(f =>
                f.insumoId === insumoId ? { ...f, quantidade: Number(quantidade) || 0 } : f
            )
        }));
    };

    const custoFichaTecnica = useMemo(() => {
        return formData.fichaTecnica.reduce((acc, f) => acc + (f.quantidade * f.custoUnitario), 0);
    }, [formData.fichaTecnica]);

    return {
        menuItems, categories, departamentosFiscais, insumosDisponiveis, loading, filteredAndSortedItems, stockStatistics,
        searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, stockFilter, setStockFilter,
        showItemForm, setShowItemForm, editingItem, setEditingItem, formData, setFormData,
        itemImage, setItemImage, imagePreview, setImagePreview, formLoading,
        ncmResultados, setNcmResultados, pesquisandoNcm, setPesquisandoNcm, termoNcm, setTermoNcm, 
        variacoes, setVariacoes, uploading3DItemId,
        adicionarVariacao, atualizarVariacao, removerVariacao, reordenarVariacao, buscarNcm,
        openItemForm, closeItemForm, handleSaveItem, handleDeleteItem, toggleItemStatus, handleUpload3D,
        adicionarInsumoFicha, removerInsumoFicha, atualizarQuantidadeFicha, custoFichaTecnica
    };
}
