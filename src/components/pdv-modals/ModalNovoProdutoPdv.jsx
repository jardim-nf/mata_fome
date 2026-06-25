// src/components/pdv-modals/ModalNovoProdutoPdv.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, doc, setDoc, query, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from '../../components/ui/Toast';
import { uploadFile, deleteFileByUrl } from '../../utils/firebaseStorageService';
import { departamentoFiscalService } from '../../services/departamentoFiscalService';
import { getTerminology } from '../../utils/terminologyUtils';
import {
    IoAddCircleOutline, IoSearch, IoClose, IoImageOutline, IoCheckmarkCircle,
    IoAlertCircle, IoCube, IoCash, IoPricetag, IoList, IoEyeOff, IoBarcodeOutline,
    IoFlask, IoTrashOutline, IoChevronUp, IoChevronDown, IoCheckmarkCircleOutline
} from 'react-icons/io5';

const parseBrazilianNumber = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const str = String(val).trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

const themeClasses = {
    dark: {
        text: 'text-slate-100',
        textSecondary: 'text-slate-400',
        textMuted: 'text-slate-500',
        modalBg: 'bg-slate-950 border-slate-800/80',
        modalHeader: 'bg-slate-900/80 border-slate-800',
        modalBody: 'bg-slate-955/30',
        modalFooter: 'bg-slate-900/90 border-slate-800',
        buttonSecondary: 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700',
        buttonPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md',
        inputBorder: 'border-slate-800/80 focus:border-emerald-500 focus:ring-emerald-500/20',
        inputBg: 'bg-slate-950/60 text-white'
    },
    light: {
        text: 'text-slate-800',
        textSecondary: 'text-slate-600',
        textMuted: 'text-slate-400',
        modalBg: 'bg-[#f8fafc] border-slate-200/60',
        modalHeader: 'bg-white border-slate-100',
        modalBody: 'bg-slate-50/30',
        modalFooter: 'bg-white border-slate-200/80',
        buttonSecondary: 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200',
        buttonPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md',
        inputBorder: 'border-slate-200/50 focus:border-emerald-500 focus:ring-emerald-500/20',
        inputBg: 'bg-slate-50/50 text-slate-800'
    }
};

export const ModalNovoProdutoPdv = ({
    visivel,
    onClose,
    estabelecimentoId,
    onSalvo,
    isVarejo,
    categorias,
    produtoParaEditar
}) => {
    if (!visivel) return null;

    const isDark = localStorage.getItem('dashboard_theme') === 'dark';
    const t = themeClasses[isDark ? 'dark' : 'light'];
    const tipoNegocio = isVarejo ? 'varejo' : 'restaurante';

    // Refs
    const sectionGeraisRef = useRef(null);
    const sectionPrecosRef = useRef(null);
    const sectionFichaRef = useRef(null);
    const sectionFiscalRef = useRef(null);
    const sectionFotoRef = useRef(null);

    // Form States
    const [formData, setFormData] = useState({
        nome: '',
        descricao: '',
        categoria: '',
        codigoBarras: '',
        imageUrl: '',
        ativo: true,
        exibirDelivery: true,
        exibirPdv: true,
        exibirSalao: true,
        fiscal: { ncm: '', cfop: '5102', unidade: 'UN', departamentoId: '' },
        fichaTecnica: [],
        fracionadoAtivo: false,
        precoKgVarejo: '',
        tipoItem: 'produto'
    });

    const [variacoes, setVariacoes] = useState([
        {
            id: `v-${Date.now()}`,
            nome: 'Padrão',
            preco: '',
            precoPromocional: '',
            precoCartao: '',
            precoCrediario: '',
            habilitarCartao: false,
            habilitarCrediario: false,
            ativo: true,
            estoque: 0,
            estoqueMinimo: 0,
            lote: '',
            dataValidade: '',
            custo: 0
        }
    ]);

    const [itemImage, setItemImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // Dynamic Lists
    const [departamentosFiscais, setDepartamentosFiscais] = useState([]);
    const [insumosDisponiveis, setInsumosDisponiveis] = useState([]);

    // NCM search states
    const [ncmResultados, setNcmResultados] = useState([]);
    const [pesquisandoNcm, setPesquisandoNcm] = useState(false);
    const [termoNcm, setTermoNcm] = useState('');
    const [activeModalTab, setActiveModalTab] = useState('gerais');

    useEffect(() => {
        if (visivel && produtoParaEditar) {
            setFormData({
                nome: produtoParaEditar.nome || produtoParaEditar.name || '',
                descricao: produtoParaEditar.descricao || '',
                categoria: produtoParaEditar.categoria || '',
                codigoBarras: produtoParaEditar.codigoBarras || '',
                imageUrl: produtoParaEditar.imageUrl || produtoParaEditar.imagem || produtoParaEditar.foto || '',
                ativo: produtoParaEditar.ativo !== false,
                exibirDelivery: produtoParaEditar.exibirDelivery !== false,
                exibirPdv: produtoParaEditar.exibirPdv !== false,
                exibirSalao: produtoParaEditar.exibirSalao !== false,
                fiscal: {
                    ncm: produtoParaEditar.fiscal?.ncm || '',
                    cfop: produtoParaEditar.fiscal?.cfop || '5102',
                    unidade: produtoParaEditar.fiscal?.unidade || 'UN',
                    departamentoId: produtoParaEditar.fiscal?.departamentoId || ''
                },
                fichaTecnica: produtoParaEditar.fichaTecnica || [],
                fracionadoAtivo: produtoParaEditar.fracionadoAtivo || false,
                precoKgVarejo: produtoParaEditar.precoKgVarejo || '',
                tipoItem: produtoParaEditar.tipoItem || 'produto'
            });
            setTermoNcm(produtoParaEditar.fiscal?.ncm || '');
            setImagePreview(produtoParaEditar.imageUrl || produtoParaEditar.imagem || produtoParaEditar.foto || '');

            if (produtoParaEditar.variacoes && produtoParaEditar.variacoes.length > 0) {
                setVariacoes(produtoParaEditar.variacoes.map(v => ({
                    id: v.id || `v-${Date.now()}-${Math.random()}`,
                    nome: v.nome || 'Padrão',
                    preco: v.preco !== undefined ? String(v.preco) : '',
                    precoPromocional: v.precoPromocional !== undefined ? String(v.precoPromocional) : '',
                    precoCartao: v.precoCartao !== undefined ? String(v.precoCartao) : '',
                    precoCrediario: v.precoCrediario !== undefined ? String(v.precoCrediario) : '',
                    habilitarCartao: v.habilitarCartao !== false,
                    habilitarCrediario: v.habilitarCrediario !== false,
                    ativo: v.ativo !== false,
                    estoque: v.estoque || 0,
                    estoqueMinimo: v.estoqueMinimo || 0,
                    lote: v.lote || '',
                    dataValidade: v.dataValidade || '',
                    custo: v.custo || 0
                })));
            } else {
                setVariacoes([
                    {
                        id: `v-${Date.now()}`,
                        nome: 'Padrão',
                        preco: produtoParaEditar.preco || produtoParaEditar.price || '',
                        precoPromocional: produtoParaEditar.precoPromocional || '',
                        precoCartao: produtoParaEditar.precoCartao || '',
                        precoCrediario: produtoParaEditar.precoCrediario || '',
                        habilitarCartao: produtoParaEditar.habilitarCartao !== false,
                        habilitarCrediario: produtoParaEditar.habilitarCrediario !== false,
                        ativo: true,
                        estoque: produtoParaEditar.estoque || 0,
                        estoqueMinimo: produtoParaEditar.estoqueMinimo || 0,
                        lote: produtoParaEditar.lote || '',
                        dataValidade: produtoParaEditar.dataValidade || '',
                        custo: produtoParaEditar.custo || 0
                    }
                ]);
            }
        } else if (visivel && !produtoParaEditar) {
            setFormData({
                nome: '',
                descricao: '',
                categoria: '',
                codigoBarras: '',
                imageUrl: '',
                ativo: true,
                exibirDelivery: true,
                exibirPdv: true,
                exibirSalao: true,
                fiscal: { ncm: '', cfop: '5102', unidade: 'UN', departamentoId: '' },
                fichaTecnica: [],
                fracionadoAtivo: false,
                precoKgVarejo: '',
                tipoItem: 'produto'
            });
            setTermoNcm('');
            setImagePreview('');
            setVariacoes([
                {
                    id: `v-${Date.now()}`,
                    nome: 'Padrão',
                    preco: '',
                    precoPromocional: '',
                    precoCartao: '',
                    precoCrediario: '',
                    habilitarCartao: false,
                    habilitarCrediario: false,
                    ativo: true,
                    estoque: 0,
                    estoqueMinimo: 0,
                    lote: '',
                    dataValidade: '',
                    custo: 0
                }
            ]);
        }
    }, [visivel, produtoParaEditar]);

    // Fetch Departamentos Fiscais & Insumos
    useEffect(() => {
        if (!estabelecimentoId) return;
        
        const carregarFiscais = async () => {
            try {
                const dFs = await departamentoFiscalService.getDepartamentos(estabelecimentoId);
                setDepartamentosFiscais(dFs || []);
            } catch (e) {
                console.error("Erro ao carregar departamentos fiscais:", e);
            }
        };
        carregarFiscais();

        if (tipoNegocio === 'restaurante') {
            const insumosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'insumos');
            const q = query(insumosRef);
            const unsubscribe = onSnapshot(q, (snap) => {
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.ativo !== false);
                setInsumosDisponiveis(data);
            }, (err) => console.error("Erro insumos:", err));
            return () => unsubscribe();
        }
    }, [estabelecimentoId, tipoNegocio]);

    const isModoMultiplasVariacoes = variacoes.length > 1 || variacoes[0]?.nome !== 'Padrão';

    // Handlers
    const handleFormChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (type === 'file') {
            const file = files[0];
            if (file) {
                setItemImage(file);
                setImagePreview(URL.createObjectURL(file));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFiscalChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            fiscal: { ...prev.fiscal, [name]: value }
        }));
    };

    const handleDepartamentoChange = (e) => {
        const depId = e.target.value;
        const dep = departamentosFiscais.find(d => d.id === depId);
        if (dep) {
            setFormData(prev => ({
                ...prev,
                fiscal: {
                    ...prev.fiscal,
                    departamentoId: depId,
                    ncm: dep.ncm || prev.fiscal.ncm,
                    cfop: dep.cfop || prev.fiscal.cfop,
                    csosn: dep.csosn || prev.fiscal.csosn,
                    aliquotaIcms: dep.aliquotaIcms || prev.fiscal.aliquotaIcms,
                    cest: dep.cest || prev.fiscal.cest
                }
            }));
            setTermoNcm(dep.ncm || '');
        } else {
            setFormData(prev => ({
                ...prev,
                fiscal: { ...prev.fiscal, departamentoId: '' }
            }));
        }
    };

    const buscarNcm = async (termo) => {
        setTermoNcm(termo);
        setFormData(prev => ({
            ...prev,
            fiscal: { ...prev.fiscal, ncm: termo }
        }));
        if (termo.length < 3) return setNcmResultados([]);
        setPesquisandoNcm(true);
        try {
            const res = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${termo}`);
            if (res.ok) {
                const data = await res.json();
                setNcmResultados(Array.isArray(data) ? data.slice(0, 10) : []);
            }
        } catch (e) {
            console.error("Erro NCM:", e);
        } finally {
            setPesquisandoNcm(false);
        }
    };

    // Variations handlers
    const adicionarVariacao = () => {
        setVariacoes(prev => [
            ...prev,
            {
                id: `var-${Date.now()}`,
                nome: '',
                preco: '',
                precoPromocional: '',
                precoCartao: '',
                precoCrediario: '',
                habilitarCartao: false,
                habilitarCrediario: false,
                descricao: '',
                ativo: true,
                estoque: 0,
                estoqueMinimo: 0,
                lote: '',
                dataValidade: '',
                custo: 0
            }
        ]);
    };

    const atualizarVariacao = (id, field, value) => {
        setVariacoes(prev =>
            prev.map(v => (v.id === id ? { ...v, [field]: value } : v))
        );
    };

    const removerVariacao = (id) => {
        if (variacoes.length <= 1) {
            toast.error('Mínimo 1 variação.');
            return;
        }
        setVariacoes(prev => prev.filter(v => v.id !== id));
    };

    const reordenarVariacao = (index, direcao) => {
        if (index === 0 && direcao === -1) return;
        if (index === variacoes.length - 1 && direcao === 1) return;
        const novasVariacoes = [...variacoes];
        const item = novasVariacoes[index];
        novasVariacoes.splice(index, 1);
        novasVariacoes.splice(index + direcao, 0, item);
        setVariacoes(novasVariacoes);
    };

    // Ficha tecnica handlers
    const adicionarInsumoFicha = (insumoId) => {
        const insumo = insumosDisponiveis.find(i => i.id === insumoId);
        if (!insumo) return;
        if (formData.fichaTecnica.some(f => f.insumoId === insumoId)) {
            toast.warning('Este insumo já está na ficha técnica.');
            return;
        }
        setFormData(prev => ({
            ...prev,
            fichaTecnica: [
                ...prev.fichaTecnica,
                {
                    insumoId: insumo.id,
                    nomeInsumo: insumo.nome,
                    unidade: insumo.unidade,
                    custoUnitario: Number(insumo.custoUnitario) || 0,
                    quantidade: 0
                }
            ]
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

    const custoFichaTecnica = formData.fichaTecnica.reduce(
        (acc, f) => acc + f.quantidade * f.custoUnitario,
        0
    );

    // Scroll handlers
    const scrollToSection = (ref, tabId) => {
        setActiveModalTab(tabId);
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleFormScroll = (e) => {
        const container = e.target;
        const scrollPosition = container.scrollTop + 120;

        const targets = [
            { id: 'gerais', ref: sectionGeraisRef },
            { id: 'precos', ref: sectionPrecosRef },
            ...(tipoNegocio === 'restaurante' && insumosDisponiveis.length > 0 ? [{ id: 'ficha', ref: sectionFichaRef }] : []),
            { id: 'fiscal', ref: sectionFiscalRef },
            { id: 'exibicao', ref: sectionFotoRef }
        ];

        for (let i = targets.length - 1; i >= 0; i--) {
            const target = targets[i];
            if (target.ref.current) {
                const elementOffset = target.ref.current.offsetTop - container.offsetTop;
                if (scrollPosition >= elementOffset) {
                    setActiveModalTab(target.id);
                    break;
                }
            }
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!formData.nome.trim() || !formData.categoria.trim()) {
            toast.error("Nome e Categoria são obrigatórios.");
            return;
        }

        setFormLoading(true);
        try {
            // 1. Upload image if any
            let imageUrl = formData.imageUrl || '';
            if (itemImage) {
                imageUrl = await uploadFile(itemImage, `estabelecimentos/${estabelecimentoId}/cardapio/${Date.now()}_${itemImage.name}`);
            }

            // 2. Resolve Category
            const catNomeDigitadoBusca = formData.categoria.trim().toUpperCase();
            const catDoc = (categorias || []).find(c => (c.name || '').trim().toUpperCase() === catNomeDigitadoBusca);
            let catId = catDoc?.id;
            let finalCategoryName = formData.categoria.trim();

            if (!catId) {
                const newCat = await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio'), {
                    nome: finalCategoryName,
                    ordem: 99,
                    ativo: true
                });
                catId = newCat.id;
            }

            // 3. Process cost & prices
            const maiorCusto = Math.max(...variacoes.map(v => parseBrazilianNumber(v.custo)));
            const custoPadrao = variacoes.length === 1 ? parseBrazilianNumber(variacoes[0].custo) : maiorCusto;

            const isServico = formData.tipoItem === 'servico';

            const itemData = {
                nome: formData.nome.trim(),
                categoria: finalCategoryName,
                categoriaId: catId,
                descricao: formData.descricao || '',
                codigoBarras: formData.codigoBarras || '',
                imageUrl,
                ativo: formData.ativo !== false,
                disponivel: formData.ativo !== false,
                exibirDelivery: formData.exibirDelivery !== false,
                exibirPdv: formData.exibirPdv !== false,
                exibirSalao: formData.exibirSalao !== false,
                tipoItem: formData.tipoItem || 'produto',
                fiscal: {
                    ncm: formData.fiscal.ncm || '',
                    cfop: formData.fiscal.cfop || '5102',
                    unidade: formData.fiscal.unidade || 'UN',
                    departamentoId: formData.fiscal.departamentoId || ''
                },
                variacoes: variacoes.map(v => ({
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
                estoque: isServico ? 0 : variacoes.reduce((acc, v) => acc + parseBrazilianNumber(v.estoque), 0),
                estoqueMinimo: isServico ? 0 : variacoes.reduce((acc, v) => acc + parseBrazilianNumber(v.estoqueMinimo), 0),
                lote: variacoes.length === 1 ? (variacoes[0].lote || '') : '',
                dataValidade: variacoes.length === 1 ? (variacoes[0].dataValidade || '') : '',
                preco: Math.min(...variacoes.map(v => {
                    const promVal = parseBrazilianNumber(v.precoPromocional);
                    const preVal = parseBrazilianNumber(v.preco);
                    return (promVal > 0 && promVal < preVal) ? promVal : preVal;
                })),
                precoPromocional: Math.min(...variacoes.map(v => parseBrazilianNumber(v.precoPromocional))),
                precoCartao: Math.min(...variacoes.map(v => parseBrazilianNumber(v.precoCartao))),
                precoCrediario: Math.min(...variacoes.map(v => parseBrazilianNumber(v.precoCrediario))),
                habilitarCartao: variacoes.some(v => v.habilitarCartao !== false),
                habilitarCrediario: variacoes.some(v => v.habilitarCrediario !== false),
                custo: custoPadrao,
                custo_estimado: custoPadrao,
                fichaTecnica: formData.fichaTecnica || [],
                fracionadoAtivo: formData.fracionadoAtivo || false,
                precoKgVarejo: formData.fracionadoAtivo ? parseBrazilianNumber(formData.precoKgVarejo) : 0,
                atualizadoEm: new Date()
            };

            let itemId = produtoParaEditar?.id;
            if (produtoParaEditar) {
                const oldCatId = produtoParaEditar.categoriaId || produtoParaEditar.category;
                if (oldCatId && oldCatId !== catId) {
                    await setDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', catId, 'itens', itemId), {
                        ...itemData,
                        atualizadoEm: new Date()
                    });
                    await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', oldCatId, 'itens', itemId));
                } else {
                    await setDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', catId, 'itens', itemId), {
                        ...itemData,
                        atualizadoEm: new Date()
                    }, { merge: true });
                }
                toast.success(`✅ "${formData.nome}" atualizado com sucesso!`);
            } else {
                const novoDoc = await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', catId, 'itens'), {
                    ...itemData,
                    criadoEm: new Date()
                });
                itemId = novoDoc.id;
                toast.success(`✅ "${formData.nome}" cadastrado com sucesso!`);
            }

            const formattedProd = {
                id: itemId,
                name: itemData.nome,
                price: itemData.preco,
                categoria: itemData.categoria,
                categoriaId: catId,
                imagem: itemData.imageUrl || '',
                foto: itemData.imageUrl || '',
                urlImagem: itemData.imageUrl || '',
                imageUrl: itemData.imageUrl || '',
                codigoBarras: itemData.codigoBarras || '',
                variacoes: itemData.variacoes || [],
                adicionais: [],
                fiscal: itemData.fiscal,
                emEstoque: isServico ? true : (itemData.estoque > 0),
                ativo: itemData.ativo,
                tipoItem: itemData.tipoItem
            };

            if (typeof onSalvo === 'function') {
                onSalvo(formattedProd);
            }
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar produto.");
        } finally {
            setFormLoading(false);
        }
    };

    const precoPrincipal = formData.fracionadoAtivo
        ? (formData.precoKgVarejo ? `R$ ${parseBrazilianNumber(formData.precoKgVarejo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /Kg` : '--')
        : (variacoes[0]?.preco ? `R$ ${parseBrazilianNumber(variacoes[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '--');

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-fade-in animate-duration-300 z-[99999] no-print">
            <div className={`w-full h-full md:h-[90vh] md:max-w-7xl md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border relative ${t.modalBg}`}>
                
                {/* Header */}
                <div className={`flex-none h-20 px-6 md:px-10 flex items-center justify-between border-b shadow-sm z-25 ${t.modalHeader}`}>
                    <div>
                        <h2 className={`text-xl md:text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            {produtoParaEditar ? 'Editar Item' : 'Novo Produto'}
                        </h2>
                        <p className={`text-xs font-medium hidden sm:block ${t.textSecondary}`}>
                            {produtoParaEditar ? 'Edite as informações do item abaixo.' : 'Preencha as informações do item abaixo.'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 hover:rotate-90 ${isDark ? 'bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400' : 'bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500'}`}>
                        <IoClose size={22} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-hidden flex flex-col relative">
                    
                    {/* Split Layout Container */}
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
                        
                        {/* Left Sidebar navigation */}
                        <div className={`hidden md:flex w-64 border-r p-6 flex-col justify-between shrink-0 ${isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200/50'}`}>
                            <div className="space-y-1.5">
                                <p className={`text-sm font-extrabold uppercase tracking-wider mb-4 px-2 ${t.textMuted}`}>Seções do Produto</p>
                                {[
                                    { id: 'gerais', label: 'Dados Gerais', icon: IoCube, ref: sectionGeraisRef },
                                    { id: 'precos', label: 'Preços & Estoque', icon: IoCash, ref: sectionPrecosRef },
                                    ...(tipoNegocio === 'restaurante' && insumosDisponiveis.length > 0 ? [{ id: 'ficha', label: 'Ficha Técnica', icon: IoFlask, ref: sectionFichaRef }] : []),
                                    { id: 'fiscal', label: 'Fiscal (NFC-e)', icon: IoBarcodeOutline, ref: sectionFiscalRef },
                                    { id: 'exibicao', label: 'Foto & Visibilidade', icon: IoImageOutline, ref: sectionFotoRef }
                                ].map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = activeModalTab === tab.id;
                                    
                                    const tabColors = {
                                        gerais: {
                                            active: isDark ? 'bg-blue-955/40 text-blue-400 border-blue-900/50 shadow-md' : 'bg-blue-50 text-blue-600 shadow-sm border-blue-100/50',
                                            hover: isDark ? 'hover:text-blue-300 hover:bg-blue-955/20' : 'hover:text-blue-700 hover:bg-blue-50/50',
                                            text: 'text-blue-600 dark:text-blue-400'
                                        },
                                        precos: {
                                            active: isDark ? 'bg-emerald-955/40 text-emerald-400 border-emerald-900/50 shadow-md' : 'bg-emerald-50 text-emerald-600 shadow-sm border-emerald-100/50',
                                            hover: isDark ? 'hover:text-emerald-300 hover:bg-emerald-955/20' : 'hover:text-emerald-700 hover:bg-emerald-50/50',
                                            text: 'text-emerald-600 dark:text-emerald-400'
                                        },
                                        ficha: {
                                            active: isDark ? 'bg-purple-955/40 text-purple-400 border-purple-900/50 shadow-md' : 'bg-purple-50 text-purple-600 shadow-sm border-purple-100/50',
                                            hover: isDark ? 'hover:text-purple-300 hover:bg-purple-955/20' : 'hover:text-purple-700 hover:bg-purple-50/50',
                                            text: 'text-purple-600 dark:text-purple-400'
                                        },
                                        fiscal: {
                                            active: isDark ? 'bg-amber-955/40 text-amber-400 border-amber-900/50 shadow-md' : 'bg-amber-50 text-amber-600 shadow-sm border-amber-100/50',
                                            hover: isDark ? 'hover:text-amber-300 hover:bg-amber-955/20' : 'hover:text-amber-700 hover:bg-amber-50/50',
                                            text: 'text-amber-600 dark:text-amber-400'
                                        },
                                        exibicao: {
                                            active: isDark ? 'bg-rose-955/40 text-rose-400 border-rose-900/50 shadow-md' : 'bg-rose-50 text-rose-600 shadow-sm border-rose-100/50',
                                            hover: isDark ? 'hover:text-rose-300 hover:bg-rose-955/20' : 'hover:text-rose-700 hover:bg-rose-50/50',
                                            text: 'text-rose-600 dark:text-rose-400'
                                        }
                                    };
                                    
                                    const colors = tabColors[tab.id] || {
                                        active: 'bg-white dark:bg-slate-900 shadow-sm border border-slate-100/50 dark:border-slate-800/80 text-emerald-600',
                                        hover: 'hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-900/30',
                                        text: 'text-emerald-600'
                                    };

                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => scrollToSection(tab.ref, tab.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 transform ${
                                                isActive
                                                    ? `${colors.active} translate-x-1`
                                                    : `${isDark ? 'text-slate-400' : 'text-slate-500'} ${colors.hover}`
                                            }`}
                                        >
                                            <Icon size={16} className={isActive ? colors.text : 'text-slate-400'} />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                            
                            {/* Preco Principal widget */}
                            <div className={`backdrop-blur-sm p-4 rounded-2xl border shadow-sm text-center ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white/80 border-slate-100'}`}>
                                <p className={`text-sm font-extrabold uppercase tracking-wider ${t.textMuted}`}>Preço Principal</p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500 mt-1">
                                    {precoPrincipal}
                                </p>
                            </div>
                        </div>

                        {/* Form Container (Scrollable) */}
                        <div
                            onScroll={handleFormScroll}
                            className={`flex-1 overflow-y-auto px-4 md:px-10 py-8 custom-scrollbar ${t.modalBody}`}
                        >
                            <div className="max-w-5xl mx-auto space-y-8 pb-32">
                                
                                {/* Dados Gerais */}
                                <div ref={sectionGeraisRef} className={`p-6 md:p-8 rounded-3xl border space-y-6 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                                    <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}><IoCube size={18}/></div>
                                        <div>
                                            <h3 className={`text-base font-bold ${t.text}`}>Dados Gerais</h3>
                                            <p className={`text-sm ${t.textSecondary}`}>Identificação e descrição do produto no sistema</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Tipo de Item</label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, tipoItem: 'produto' }))}
                                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black border transition-all duration-300 ${
                                                        formData.tipoItem !== 'servico'
                                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-black'
                                                            : `${isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`
                                                    }`}
                                                >
                                                    📦 Produto
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, tipoItem: 'servico' }))}
                                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black border transition-all duration-300 ${
                                                        formData.tipoItem === 'servico'
                                                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-black'
                                                            : `${isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`
                                                    }`}
                                                >
                                                    🛠️ Serviço
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Nome do Produto / Serviço <span className="text-red-500">*</span></label>
                                            <input type="text" name="nome" value={formData.nome} onChange={handleFormChange} className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 font-bold text-base ${t.inputBg} ${t.inputBorder}`} required autoComplete="off" placeholder={tipoNegocio === 'restaurante' ? "Ex: Hambúrguer Clássico" : "Ex: Parafusadeira Dewalt, Camiseta Slim, etc."} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 md:col-span-2">
                                            <div>
                                                <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Categoria <span className="text-red-500">*</span></label>
                                                <input type="text" name="categoria" value={formData.categoria} onChange={handleFormChange} list="pdv-cat-list" className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 font-bold text-base ${t.inputBg} ${t.inputBorder}`} required autoComplete="off" placeholder="Selecione..." />
                                                <datalist id="pdv-cat-list">
                                                    {(categorias || []).filter(c => c.id !== 'todos').map(c => (
                                                        <option key={c.id} value={c.name || c.nome} />
                                                    ))}
                                                </datalist>
                                            </div>
                                            <div>
                                                <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Cód. Barras</label>
                                                <input type="text" name="codigoBarras" value={formData.codigoBarras} onChange={handleFormChange} className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 font-mono text-base ${t.inputBg} ${t.inputBorder}`} autoComplete="off" placeholder="789..." />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Descrição</label>
                                        <textarea name="descricao" value={formData.descricao} onChange={handleFormChange} placeholder={tipoNegocio === 'restaurante' ? "Do que é feito? Quais os diferenciais e ingredientes?" : "Descrição detalhada, especificações técnicas ou diferenciais do produto"} className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 min-h-[100px] resize-none leading-relaxed text-base font-medium ${t.inputBg} ${t.inputBorder}`} />
                                    </div>
                                </div>

                                {/* Preços e Estoque */}
                                <div ref={sectionPrecosRef} className={`p-6 md:p-8 rounded-3xl border space-y-6 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                                    <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}><IoCash size={18}/></div>
                                            <div>
                                                <h3 className={`text-base font-bold ${t.text}`}>Preços & Estoque</h3>
                                                <p className={`text-sm ${t.textSecondary}`}>Valores de venda, custo comercial e estoques</p>
                                            </div>
                                        </div>
                                        {!formData.fracionadoAtivo && (
                                            <div className={`flex p-1 rounded-xl w-full sm:w-auto overflow-hidden border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100/60 border-slate-200/30'}`}>
                                                <button type="button" onClick={() => setVariacoes([{ id: `v-unique`, nome: 'Padrão', preco: '', ativo: true, estoque: 0, custo: 0 }])} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${!isModoMultiplasVariacoes ? (isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-500 hover:text-slate-350'}`}>Preço Único</button>
                                                <button type="button" onClick={() => { if (!isModoMultiplasVariacoes) setVariacoes([{ id: `v-multi`, nome: 'Médio', preco: '', ativo: true, estoque: 0, custo: 0 }]); }} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${isModoMultiplasVariacoes ? (isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-500 hover:text-slate-355'}`}>Variações</button>
                                            </div>
                                        )}
                                    </div>

                                    {!formData.fracionadoAtivo ? (
                                        <div className="space-y-4">
                                            {variacoes.map((v, index) => (
                                                <div key={v.id} className={`p-5 rounded-2xl border relative group/var transition-all duration-300 ${isDark ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50/30 border-slate-100 hover:border-slate-200'}`}>
                                                    {isModoMultiplasVariacoes && (
                                                        <div className={`absolute -top-3 -right-3 flex gap-1 p-1 rounded-full shadow-md border z-10 ${isDark ? 'bg-slate-955 border-slate-800' : 'bg-white border-slate-100'}`}>
                                                            {index > 0 && (
                                                                <button type="button" onClick={() => reordenarVariacao(index, -1)} className="text-slate-500 hover:text-emerald-500 p-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors" title="Mover para Cima">
                                                                    <IoChevronUp size={14}/>
                                                                </button>
                                                            )}
                                                            {index < variacoes.length - 1 && (
                                                                <button type="button" onClick={() => reordenarVariacao(index, 1)} className="text-slate-500 hover:text-emerald-500 p-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors" title="Mover para Baixo">
                                                                    <IoChevronDown size={14}/>
                                                                </button>
                                                            )}
                                                            <button type="button" onClick={() => removerVariacao(v.id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded-md transition-colors" title="Excluir">
                                                                <IoClose size={15}/>
                                                            </button>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex flex-col gap-4">
                                                        {isModoMultiplasVariacoes ? (
                                                            <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                                <div className={formData.tipoItem === 'servico' ? "col-span-2 sm:col-span-8" : "col-span-2 sm:col-span-6"}>
                                                                    <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Nome da Variação</label>
                                                                    <input type="text" value={v.nome} onChange={e => atualizarVariacao(v.id, 'nome', e.target.value.toUpperCase())} className={`w-full px-3 py-2.5 border rounded-xl text-base font-bold outline-none transition-all duration-300 ${t.inputBg} ${t.inputBorder}`} placeholder={tipoNegocio === 'restaurante' ? "Ex: Grande, Combo..." : "Ex: G, M, Cor, Voltagem, etc."} />
                                                                </div>
                                                                <div className="col-span-1 sm:col-span-2">
                                                                    <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Custo (R$)</label>
                                                                    <input type="number" step="0.01" value={v.custo} onChange={e => atualizarVariacao(v.id, 'custo', e.target.value)} className={`w-full px-3 py-2.5 border rounded-xl text-base font-medium outline-none transition-all duration-300 ${t.inputBg} ${t.inputBorder}`} placeholder="0.00" />
                                                                </div>
                                                                {formData.tipoItem !== 'servico' && (
                                                                    <div className="col-span-1 sm:col-span-2">
                                                                        <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Estoque Qtd</label>
                                                                        <input type="number" value={v.estoque} onChange={e => atualizarVariacao(v.id, 'estoque', e.target.value)} className={`w-full px-3 py-2.5 border rounded-xl text-base font-bold outline-none transition-all duration-300 ${t.inputBg} ${t.inputBorder}`} placeholder="0" />
                                                                    </div>
                                                                )}
                                                                <div className="col-span-2 sm:col-span-2">
                                                                    <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Status</label>
                                                                    <label className={`flex justify-center items-center px-4 py-2 h-[46px] cursor-pointer rounded-xl border transition-all duration-300 ${v.ativo !== false ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                                                        <input type="checkbox" checked={v.ativo !== false} onChange={e => atualizarVariacao(v.id, 'ativo', e.target.checked)} className="hidden" />
                                                                        <span className="text-[11px] font-bold">{v.ativo !== false ? '✅ ATIVO' : 'PAUSADO'}</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                                <div className="col-span-1">
                                                                    <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Custo (R$)</label>
                                                                    <input type="number" step="0.01" value={v.custo} onChange={e => atualizarVariacao(v.id, 'custo', e.target.value)} className={`w-full px-3 py-2.5 border rounded-xl text-base font-medium outline-none transition-all duration-300 ${t.inputBg} ${t.inputBorder}`} placeholder="0.00" />
                                                                </div>
                                                                {formData.tipoItem !== 'servico' && (
                                                                    <div className="col-span-1">
                                                                        <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Estoque Qtd</label>
                                                                        <input type="number" value={v.estoque} onChange={e => atualizarVariacao(v.id, 'estoque', e.target.value)} className={`w-full px-3 py-2.5 border rounded-xl text-base font-bold outline-none transition-all duration-300 ${t.inputBg} ${t.inputBorder}`} placeholder="0" />
                                                                    </div>
                                                                )}
                                                                <div className={formData.tipoItem === 'servico' ? "col-span-1" : "col-span-2 sm:col-span-1"}>
                                                                    <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Status</label>
                                                                    <label className={`flex justify-center items-center px-4 py-2 h-[46px] cursor-pointer rounded-xl border transition-all duration-300 ${v.ativo !== false ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                                                        <input type="checkbox" checked={v.ativo !== false} onChange={e => atualizarVariacao(v.id, 'ativo', e.target.checked)} className="hidden" />
                                                                        <span className="text-[11px] font-bold">{v.ativo !== false ? '✅ ATIVO' : 'PAUSADO'}</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Lote, estoque minimo, validade */}
                                                        {formData.tipoItem !== 'servico' && (
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                                <div>
                                                                    <label className={`text-[10px] font-bold mb-1 block uppercase tracking-wider ${t.textSecondary}`}>Estoque Mínimo</label>
                                                                    <input type="number" value={v.estoqueMinimo || ''} onChange={e => atualizarVariacao(v.id, 'estoqueMinimo', e.target.value)} className={`w-full px-3 py-2 border rounded-xl text-sm font-semibold outline-none transition-all duration-300 ${t.inputBg} ${t.inputBorder}`} placeholder="0" />
                                                                </div>
                                                                <div>
                                                                    <label className={`text-[10px] font-bold mb-1 block uppercase tracking-wider ${t.textSecondary}`}>Lote</label>
                                                                    <input type="text" value={v.lote || ''} onChange={e => atualizarVariacao(v.id, 'lote', e.target.value.toUpperCase())} className={`w-full px-3 py-2 border rounded-xl text-sm font-semibold outline-none transition-all duration-300 ${t.inputBg} ${t.inputBorder}`} placeholder="Ex: LOTE-A" />
                                                                </div>
                                                                <div>
                                                                    <label className={`text-[10px] font-bold mb-1 block uppercase tracking-wider ${t.textSecondary}`}>Data de Validade</label>
                                                                    <input type="date" value={v.dataValidade || ''} onChange={e => atualizarVariacao(v.id, 'dataValidade', e.target.value)} className={`w-full px-3 py-2 border rounded-xl text-sm font-semibold outline-none transition-all duration-300 ${t.inputBg} ${t.inputBorder}`} />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Valores de Venda */}
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                            <div>
                                                                <label className="text-[11px] font-extrabold text-emerald-605 mb-1.5 block uppercase tracking-wider text-emerald-600">Dinheiro (R$) <span className="text-red-500">*</span></label>
                                                                <input type="number" step="0.01" value={v.preco} onChange={e => atualizarVariacao(v.id, 'preco', e.target.value)} className={`w-full px-4 py-3 border rounded-2xl text-lg font-black outline-none transition-all duration-300 ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 focus:bg-slate-900 focus:border-emerald-500 text-emerald-400' : 'bg-emerald-50/[0.03] border-emerald-500/20 focus:bg-white focus:border-emerald-500 text-emerald-600'}`} placeholder="0.00" required />
                                                            </div>
                                                            <div>
                                                                <label className="text-[11px] font-extrabold text-rose-600 mb-1.5 block uppercase tracking-wider">Promoção (R$)</label>
                                                                <input type="number" step="0.01" value={v.precoPromocional || ''} onChange={e => atualizarVariacao(v.id, 'precoPromocional', e.target.value)} className={`w-full px-4 py-3 border rounded-2xl text-lg font-black outline-none transition-all duration-300 ${isDark ? 'bg-rose-500/10 border-rose-500/20 focus:bg-slate-900 focus:border-rose-500 text-rose-400' : 'bg-rose-50/[0.03] border-rose-500/20 focus:bg-white focus:border-rose-500 text-rose-600'}`} placeholder="0.00" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-1.5 mb-1.5 select-none cursor-pointer">
                                                                    <input type="checkbox" id={`pdv-chk-cartao-${v.id}`} checked={v.habilitarCartao !== false} onChange={e => atualizarVariacao(v.id, 'habilitarCartao', e.target.checked)} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5 cursor-pointer" />
                                                                    <label htmlFor={`pdv-chk-cartao-${v.id}`} className="text-[11px] font-extrabold text-sky-600 uppercase tracking-wider cursor-pointer truncate">Cartão (R$)</label>
                                                                </div>
                                                                <input type="number" step="0.01" disabled={v.habilitarCartao === false} value={v.precoCartao || ''} onChange={e => atualizarVariacao(v.id, 'precoCartao', e.target.value)} className={`w-full px-4 py-3 border rounded-2xl text-lg font-black outline-none transition-all duration-300 ${v.habilitarCartao === false ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-100 text-slate-400' : isDark ? 'bg-sky-500/10 border-sky-500/20 focus:bg-slate-900 focus:border-sky-500 text-sky-400' : 'bg-sky-50/[0.03] border-sky-500/20 focus:bg-white focus:border-sky-500 text-sky-600'}`} placeholder="0.00" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-1.5 mb-1.5 select-none cursor-pointer">
                                                                    <input type="checkbox" id={`pdv-chk-crediario-${v.id}`} checked={v.habilitarCrediario !== false} onChange={e => atualizarVariacao(v.id, 'habilitarCrediario', e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer" />
                                                                    <label htmlFor={`pdv-chk-crediario-${v.id}`} className="text-[11px] font-extrabold text-purple-600 uppercase tracking-wider cursor-pointer truncate">Crediário (R$)</label>
                                                                </div>
                                                                <input type="number" step="0.01" disabled={v.habilitarCrediario === false} value={v.precoCrediario || ''} onChange={e => atualizarVariacao(v.id, 'precoCrediario', e.target.value)} className={`w-full px-4 py-3 border rounded-2xl text-lg font-black outline-none transition-all duration-300 ${v.habilitarCrediario === false ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-100 text-slate-400' : isDark ? 'bg-purple-500/10 border-purple-500/20 focus:bg-slate-900 focus:border-purple-500 text-purple-400' : 'bg-purple-50/[0.03] border-purple-500/20 focus:bg-white focus:border-purple-500 text-purple-600'}`} placeholder="0.00" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}

                                    {isModoMultiplasVariacoes && !formData.fracionadoAtivo && (
                                        <button type="button" onClick={adicionarVariacao} className="w-full py-3.5 font-bold flex items-center justify-center gap-1.5 rounded-xl border border-dashed transition-all duration-300 bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                            <IoAddCircleOutline className="text-lg"/> <span>Adicionar Variação</span>
                                        </button>
                                    )}

                                    {/* Venda Fracionada */}
                                    <div className={`border-t pt-5 mt-5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                        <div className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-slate-900/20 border-slate-800/80' : 'bg-slate-50/50 border-slate-150'}`}>
                                            <div>
                                                <h4 className={`text-sm font-bold uppercase tracking-wider ${t.text}`}>Venda Fracionada (Peso / Granel)</h4>
                                                <p className={`text-xs mt-0.5 ${t.textSecondary}`}>Ative para permitir vendas decimais por quilo/litro com valores customizados.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer select-none">
                                                <input type="checkbox" name="fracionadoAtivo" checked={formData.fracionadoAtivo || false} onChange={handleFormChange} className="sr-only peer" />
                                                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-sm shadow-emerald-500/10"></div>
                                            </label>
                                        </div>
                                        {formData.fracionadoAtivo && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-fade-in">
                                                <div>
                                                    <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Preço do Kg/L no Varejo (R$)</label>
                                                    <input type="number" step="0.01" name="precoKgVarejo" value={formData.precoKgVarejo || ''} onChange={handleFormChange} className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 font-bold text-base ${t.inputBg} ${t.inputBorder}`} placeholder="0.00" required />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Ficha Técnica (Insumos) */}
                                {tipoNegocio === 'restaurante' && insumosDisponiveis.length > 0 && (
                                    <div ref={sectionFichaRef} className={`p-6 md:p-8 rounded-3xl border space-y-6 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                                        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600'}`}><IoFlask size={18}/></div>
                                                <div>
                                                    <h3 className={`text-base font-bold ${t.text}`}>Ficha Técnica</h3>
                                                    <p className={`text-sm ${t.textSecondary}`}>Componentes consumidos de estoque a cada venda</p>
                                                </div>
                                            </div>
                                            {formData.fichaTecnica.length > 0 && (
                                                <div className={`px-3 py-1.5 rounded-xl border ${isDark ? 'bg-purple-950/40 border-purple-900/50' : 'bg-purple-50/80 border-purple-100'}`}>
                                                    <p className="text-xs font-bold text-purple-500 uppercase tracking-wider">Custo pela ficha</p>
                                                    <p className="text-lg font-black text-purple-700">R$ {custoFichaTecnica.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className={`flex items-end gap-3 p-4 rounded-2xl border ${isDark ? 'bg-purple-950/20 border-purple-900/30' : 'bg-purple-50/30 border-purple-100/45'}`}>
                                            <div className="flex-1">
                                                <label className="text-sm font-bold text-purple-500 mb-1.5 block uppercase tracking-wider">Adicionar Insumo</label>
                                                <select
                                                    id="seletor-insumo-ficha-pdv"
                                                    defaultValue=""
                                                    className={`w-full px-3 py-2.5 border rounded-xl text-base font-bold outline-none cursor-pointer ${isDark ? 'bg-slate-950 border-purple-900/50 text-purple-300 focus:ring-4 focus:ring-purple-500/10' : 'bg-white border-violet-200 text-violet-800 focus:ring-4 focus:ring-violet-500/10'}`}
                                                >
                                                    <option value="" disabled>Selecione...</option>
                                                    {insumosDisponiveis
                                                        .filter(i => !formData.fichaTecnica.some(f => f.insumoId === i.id))
                                                        .map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)
                                                    }
                                                </select>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const select = document.getElementById('seletor-insumo-ficha-pdv');
                                                    if (select && select.value) {
                                                        adicionarInsumoFicha(select.value);
                                                        select.value = '';
                                                    }
                                                }}
                                                className={`p-3 rounded-xl transition-all shadow-md ${isDark ? 'bg-purple-750 hover:bg-purple-700 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
                                            >
                                                <IoAddCircleOutline size={20} />
                                            </button>
                                        </div>

                                        {formData.fichaTecnica.length > 0 ? (
                                            <div className="space-y-2">
                                                {formData.fichaTecnica.map((ficha) => (
                                                    <div key={ficha.insumoId} className={`p-4 rounded-xl border relative group/ficha transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${isDark ? 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/40' : 'bg-slate-50/30 border-slate-100 hover:bg-slate-55/85'}`}>
                                                        <button type="button" onClick={() => removerInsumoFicha(ficha.insumoId)}
                                                            className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-950 text-red-500 p-1.5 rounded-full shadow-sm opacity-0 group-hover/ficha:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/50 z-10">
                                                            <IoTrashOutline size={12}/>
                                                        </button>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`font-bold text-base truncate ${t.text}`}>{ficha.nomeInsumo}</p>
                                                            <p className={`text-sm ${t.textSecondary}`}>Custo Base: R$ {ficha.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}/{ficha.unidade}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div>
                                                                <label className={`text-sm font-bold mb-1 block uppercase tracking-wider ${t.textSecondary}`}>Consumo por venda</label>
                                                                <div className="flex items-center gap-1.5">
                                                                    <input type="number" step="0.01" min="0" value={ficha.quantidade}
                                                                        onChange={e => atualizarQuantidadeFicha(ficha.insumoId, e.target.value)}
                                                                        className={`w-20 px-2 py-1.5 border rounded-lg text-base font-bold outline-none text-center ${isDark ? 'bg-slate-955 border-purple-900/50 text-purple-400' : 'bg-white border-violet-200 text-violet-800'}`} />
                                                                    <span className={`text-sm font-bold ${t.textSecondary}`}>{ficha.unidade}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className={`text-sm font-bold uppercase tracking-wider ${t.textSecondary}`}>Subtotal</p>
                                                                <p className={`text-base font-black ${t.text}`}>R$ {(ficha.quantidade * ficha.custoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={`text-center py-6 rounded-2xl border ${isDark ? 'bg-slate-955/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                                                <IoFlask className="text-3xl text-slate-350 mx-auto mb-1.5" />
                                                <p className={`text-sm font-medium ${t.textSecondary}`}>Nenhum insumo vinculado a este produto.</p>
                                                <p className="text-sm text-slate-400">Estoque do produto será reduzido diretamente (1:1).</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Fiscal NFC-e */}
                                <div ref={sectionFiscalRef} className={`p-6 md:p-8 rounded-3xl border space-y-6 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                                    <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><IoBarcodeOutline size={18}/></div>
                                        <div>
                                            <h3 className={`text-base font-bold ${t.text}`}>Fiscal (NFC-e / Trib.)</h3>
                                            <p className={`text-sm ${t.textSecondary}`}>Regras de faturamento e regras de impostos estaduais</p>
                                        </div>
                                    </div>
                                    
                                    <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50/[0.03] border-emerald-500/20'}`}>
                                        <div className="mb-2">
                                            <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-slate-800'}`}>Regras Fiscais por Departamento</label>
                                            <select value={formData.fiscal.departamentoId || ''} onChange={handleDepartamentoChange} className={`w-full px-3 py-2.5 border rounded-xl outline-none font-bold text-base shadow-sm cursor-pointer ${isDark ? 'bg-slate-950 border-emerald-900/30 text-emerald-400' : 'bg-white border-emerald-200 text-slate-800'}`}>
                                                <option value="" className={isDark ? 'bg-slate-955 text-slate-100' : 'bg-white text-slate-900'}>-- Usar Regras Manuais --</option>
                                                {departamentosFiscais?.map(d => (
                                                    <option key={d.id} value={d.id} className={isDark ? 'bg-slate-955 text-slate-100' : 'bg-white text-slate-900'}>{d.nome} (CFOP: {d.cfop} / NCM: {d.ncm})</option>
                                                ))}
                                            </select>
                                            <p className={`text-sm font-medium mt-1.5 ml-0.5 text-emerald-600/70 dark:text-emerald-400/70`}>Configuração fiscal automatizada baseada na categoria tributária.</p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="relative">
                                                <label className={`block text-sm font-bold mb-1.5 uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-slate-800'}`}>Código NCM <span className="font-medium text-emerald-600 dark:text-emerald-400">(Busca inteligente)</span></label>
                                                <input type="text" name="ncm" value={termoNcm} onChange={(e) => buscarNcm(e.target.value)} className={`w-full px-3 py-2.5 border rounded-xl outline-none text-base font-mono font-bold ${t.inputBg} ${t.inputBorder} ${formData.fiscal.departamentoId ? 'opacity-50' : ''}`} autoComplete="off" placeholder="Ex: 22021000" disabled={!!formData.fiscal.departamentoId} />
                                                {pesquisandoNcm && <span className="absolute right-3 top-[34px] text-xs text-emerald-500 animate-pulse font-bold">Buscando...</span>}
                                                {ncmResultados.length > 0 && (
                                                    <div className={`absolute z-50 w-full mt-2 border rounded-2xl shadow-xl max-h-48 overflow-y-auto ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-emerald-100'}`}>
                                                        {ncmResultados.map((item) => (
                                                            <div key={item.codigo} onClick={() => { setTermoNcm(item.codigo); setFormData(prev => ({ ...prev, fiscal: { ...prev.fiscal, ncm: item.codigo } })); setNcmResultados([]); }} className={`p-2.5 border-b cursor-pointer transition-colors text-left ${isDark ? 'border-slate-800 hover:bg-slate-900' : 'border-emerald-50 hover:bg-emerald-50/50'}`}>
                                                                <p className={`font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-slate-800'}`}>{item.codigo}</p>
                                                                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{item.descricao}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-slate-800'}`}>CFOP</label>
                                                    <select disabled={!!formData.fiscal.departamentoId} name="cfop" value={formData.fiscal.cfop} onChange={handleFiscalChange} className={`w-full px-3 py-2.5 border rounded-xl outline-none text-sm font-bold ${t.inputBg} ${t.inputBorder} ${formData.fiscal.departamentoId ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                        <option value="5102" className={isDark ? 'bg-slate-955' : ''}>5102</option>
                                                        <option value="5405" className={isDark ? 'bg-slate-955' : ''}>5405</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-slate-800'}`}>Unidade</label>
                                                    <select name="unidade" value={formData.fiscal.unidade} onChange={handleFiscalChange} className={`w-full px-3 py-2.5 border rounded-xl outline-none text-sm font-bold ${t.inputBg} ${t.inputBorder}`}>
                                                        <option value="UN" className={isDark ? 'bg-slate-955' : ''}>UN</option>
                                                        <option value="KG" className={isDark ? 'bg-slate-955' : ''}>KG</option>
                                                        <option value="LT" className={isDark ? 'bg-slate-955' : ''}>LT</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Foto e Canais */}
                                <div ref={sectionFotoRef} className="grid lg:grid-cols-2 gap-6">
                                    
                                    {/* Card da Foto */}
                                    <div className={`p-6 rounded-3xl border space-y-4 shadow-sm transition-all duration-300 flex flex-col justify-between ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                                        <div className={`flex items-center gap-3 border-b pb-3 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600'}`}><IoImageOutline size={16}/></div>
                                            <h4 className={`text-sm font-bold ${t.text}`}>Foto Ilustrativa</h4>
                                        </div>
                                        <div className="flex items-center gap-4 py-2">
                                            <div className={`w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0 group/upload relative shadow-inner ${isDark ? 'bg-slate-950 border-slate-800 text-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover group-hover/upload:scale-105 transition-transform duration-500" /> : <IoImageOutline className="text-2xl text-slate-300"/>}
                                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                    <IoAddCircleOutline className="text-white text-2xl"/>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <label className={`block text-xs font-bold mb-0.5 ${t.text}`}>Imagem do Produto</label>
                                                <p className="text-xs text-slate-400 mb-2">JPG/PNG. Fundo transparente recomendado.</p>
                                                <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 font-bold text-xs rounded-lg transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                                    <span>Selecionar Arquivo</span>
                                                    <input type="file" accept="image/*" onChange={handleFormChange} className="hidden" />
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Canais de Venda */}
                                    <div className={`p-6 rounded-3xl border space-y-4 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                                        <div className={`flex items-center gap-3 border-b pb-3 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600'}`}><IoList size={16}/></div>
                                            <h4 className={`text-sm font-bold ${t.text}`}>Canais de Exibição</h4>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all duration-300 ${formData.exibirDelivery !== false ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'bg-slate-50/50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                                <input type="checkbox" name="exibirDelivery" checked={formData.exibirDelivery !== false} onChange={handleFormChange} className="hidden" />
                                                <span className="text-xs font-black text-center">DELIVERY</span>
                                            </label>
                                            <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all duration-300 ${formData.exibirPdv !== false ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'bg-slate-50/50 dark:bg-slate-955 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                                <input type="checkbox" name="exibirPdv" checked={formData.exibirPdv !== false} onChange={handleFormChange} className="hidden" />
                                                <span className="text-xs font-black text-center">PDV / CAIXA</span>
                                            </label>
                                            <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all duration-300 ${formData.exibirSalao !== false ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'bg-slate-50/50 dark:bg-slate-955 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                                <input type="checkbox" name="exibirSalao" checked={formData.exibirSalao !== false} onChange={handleFormChange} className="hidden" />
                                                <span className="text-xs font-black text-center">{getTerminology('salao', tipoNegocio).toUpperCase()}</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Visibilidade do Produto Geral */}
                                <div className={`p-5 rounded-3xl border shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${formData.ativo ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                                {formData.ativo ? <IoCheckmarkCircle size={18}/> : <IoEyeOff size={18}/>}
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-sm font-bold ${t.text}`}>
                                                    {formData.ativo ? `Item Ativo / Visível no ${getTerminology('cardapio', tipoNegocio)}` : 'Item Oculto / Pausado'}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {formData.ativo ? 'Disponível para venda nos canais ativos.' : 'Bloqueado temporariamente para pedidos.'}
                                                </p>
                                            </div>
                                        </div>
                                        <label htmlFor="ativoMainPdv" className="relative inline-flex items-center cursor-pointer select-none">
                                            <input type="checkbox" id="ativoMainPdv" name="ativo" checked={formData.ativo} onChange={handleFormChange} className="sr-only peer" />
                                            <div className={`w-11 h-6 rounded-full peer transition-all duration-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                                                formData.ativo 
                                                ? 'bg-emerald-600 after:translate-x-full after:border-white' 
                                                : 'bg-slate-200 dark:bg-slate-800'
                                            }`}></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={`flex-none h-20 px-6 sm:px-10 border-t flex items-center justify-end gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.02)] z-20 ${t.modalFooter}`}>
                        <button type="button" onClick={onClose} className={`px-6 py-2.5 rounded-xl border font-bold transition-all text-xs ${t.buttonSecondary}`}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={formLoading} className={`w-full sm:w-auto px-8 py-2.5 rounded-xl font-bold transition-all duration-300 text-xs flex items-center justify-center gap-1.5 ${t.buttonPrimary} shadow-emerald-500/25`}>
                            {formLoading ? (
                                <><span className="animate-spin text-sm border-2 border-white/30 border-t-white rounded-full w-4 h-4"></span> Salvando...</>
                            ) : (
                                <><IoCheckmarkCircleOutline size={18}/> Salvar Alterações</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
