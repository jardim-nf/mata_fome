import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import {
    collection, doc, serverTimestamp, writeBatch,
    increment, setDoc, getDocs, addDoc, getDoc,
    query, orderBy, limit, where
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import {
    IoCloudUploadOutline, IoDocumentTextOutline, IoBusinessOutline,
    IoCartOutline, IoCheckmarkCircleOutline, IoAlertCircleOutline,
    IoTrashOutline, IoSaveOutline, IoCloseOutline, IoSearchOutline,
    IoAddCircleOutline, IoPricetagOutline, IoCubeOutline,
    IoWalletOutline, IoCalendarOutline, IoReceiptOutline, IoRefreshOutline
} from 'react-icons/io5';
import { produtoService } from '../../services/produtoService';

// ─── MODAL: VINCULAR PRODUTO ──────────────────────────────────────────────────
const ModalVinculo = ({ produtoNota, produtosSistema, onVincular, onCriarNovo, onFechar }) => {
    const [busca, setBusca] = useState('');
    const filtrados = produtosSistema.filter(p =>
        p.name?.toLowerCase().includes(busca.toLowerCase()) ||
        p.categoriaNome?.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Vincular ao Produto</h3>
                    <button onClick={onFechar}><IoCloseOutline size={24} className="text-gray-400" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-xs text-blue-600 font-bold uppercase mb-1">Produto na Nota:</p>
                        <p className="text-sm font-semibold text-gray-800">{produtoNota?.nome}</p>
                        <p className="text-xs text-gray-500 mt-1">NCM: {produtoNota?.ncm} • {produtoNota?.qtd} {produtoNota?.unidade}</p>
                    </div>
                    <div className="relative">
                        <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text" placeholder="Buscar produto no sistema..."
                            value={busca} onChange={e => setBusca(e.target.value)} autoFocus
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                        {filtrados.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">
                                {produtosSistema.length === 0 ? 'Carregando...' : 'Nenhum produto encontrado.'}
                            </div>
                        ) : filtrados.map(prod => (
                            <button key={prod.id} onClick={() => onVincular(prod)}
                                className="w-full text-left p-4 hover:bg-blue-50 transition-colors flex justify-between items-center group">
                                <div>
                                    <p className="font-bold text-sm text-gray-800">{prod.name}</p>
                                    <p className="text-xs text-gray-500">{prod.categoriaNome}</p>
                                </div>
                                <IoCheckmarkCircleOutline size={20} className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>
                    <button onClick={onCriarNovo}
                        className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm">
                        <IoAddCircleOutline size={20} /> Produto não existe — Cadastrar agora
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── MODAL: CADASTRAR NOVO PRODUTO ───────────────────────────────────────────
const ModalNovoProduto = ({ produtoNota, margemPadrao, estabelecimentoId, onSalvo, onFechar }) => {
    const [categorias, setCategorias] = useState([]);
    const [salvando, setSalvando] = useState(false);

    const custoUnit = Number(produtoNota?.valorUnit) || 0;
    const precoSugerido = custoUnit * (1 + margemPadrao / 100);

    const [form, setForm] = useState({
        nome: produtoNota?.nome || '',
        categoria: '',
        preco: precoSugerido.toFixed(2),
        custo: custoUnit.toFixed(2),
        estoque: produtoNota?.qtd || 0,
        estoqueMinimo: 0,
        unidade: produtoNota?.unidade || 'UN',
        codigoBarras: produtoNota?.ean && produtoNota.ean !== 'SEM GTIN' ? produtoNota.ean : '',
        descricao: '',
        fiscal: {
            ncm: produtoNota?.ncm || '',
            cfop: '5102',
            unidade: produtoNota?.unidade || 'UN',
            origem: '0',
            csosn: '102',
            cest: '',
            aliquotaIcms: 0,
        }
    });

    useEffect(() => {
        const buscar = async () => {
            if (!estabelecimentoId) return;
            const snap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio'));
            setCategorias(snap.docs.map(d => ({ id: d.id, nome: d.data().nome || d.id })));
        };
        buscar();
    }, [estabelecimentoId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleFiscalChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, fiscal: { ...prev.fiscal, [name]: value } }));
    };

    const salvar = async () => {
        if (!form.nome.trim() || !form.categoria) {
            toast.error('Preencha Nome e Categoria.'); return;
        }
        setSalvando(true);
        try {
            const catRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', form.categoria);
            await setDoc(catRef, {
                nome: categorias.find(c => c.id === form.categoria)?.nome || form.categoria,
                ativo: true, ordem: 99
            }, { merge: true });

            const itensRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', form.categoria, 'itens');
            const novoDoc = await addDoc(itensRef, {
                nome: form.nome.trim(),
                preco: Number(form.preco) || 0,
                custo: Number(form.custo) || 0,
                estoque: Number(form.estoque) || 0,
                estoqueMinimo: Number(form.estoqueMinimo) || 0,
                descricao: form.descricao,
                codigoBarras: form.codigoBarras,
                ativo: true,
                disponivel: true,
                fiscal: form.fiscal,
                criadoEm: serverTimestamp(),
            });

            toast.success(`✅ "${form.nome}" cadastrado!`);
            onSalvo({
                id: novoDoc.id,
                name: form.nome.trim(),
                category: form.categoria,
                categoriaNome: categorias.find(c => c.id === form.categoria)?.nome || form.categoria,
                path: `estabelecimentos/${estabelecimentoId}/cardapio/${form.categoria}/itens/${novoDoc.id}`,
                preco: Number(form.preco),
            });
        } catch (err) {
            console.error(err);
            toast.error('Erro ao cadastrar produto.');
        } finally { setSalvando(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                            <IoAddCircleOutline className="text-blue-600" /> Cadastrar Novo Produto
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Dados pré-preenchidos com a nota fiscal</p>
                    </div>
                    <button onClick={onFechar}><IoCloseOutline size={24} className="text-gray-400" /></button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm">
                        <p className="text-xs text-blue-600 font-bold uppercase mb-1">Produto na Nota:</p>
                        <p className="font-semibold text-gray-800">{produtoNota?.nome}</p>
                        <p className="text-xs text-gray-500 mt-1">
                            NCM: {produtoNota?.ncm} • EAN: {produtoNota?.ean || 'SEM EAN'} • Qtd: {produtoNota?.qtd} {produtoNota?.unidade}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Nome *</label>
                            <input name="nome" value={form.nome} onChange={handleChange}
                                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Categoria *</label>
                            <select name="categoria" value={form.categoria} onChange={handleChange}
                                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm">
                                <option value="">Selecione...</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Cód. Barras</label>
                            <input name="codigoBarras" value={form.codigoBarras} onChange={handleChange}
                                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm font-mono" />
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <IoPricetagOutline /> Preços & Estoque
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="text-xs font-bold text-emerald-600 uppercase mb-1 block">Venda (R$)</label>
                                <input name="preco" value={form.preco} onChange={handleChange} type="number" step="0.01"
                                    className="w-full p-3 border border-emerald-200 bg-emerald-50 rounded-xl text-sm font-bold text-emerald-800 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Custo (R$)</label>
                                <input name="custo" value={form.custo} onChange={handleChange} type="number" step="0.01"
                                    className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Estoque</label>
                                <input name="estoque" value={form.estoque} onChange={handleChange} type="number"
                                    className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mín.</label>
                                <input name="estoqueMinimo" value={form.estoqueMinimo} onChange={handleChange} type="number"
                                    className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <h4 className="text-xs font-bold text-emerald-700 uppercase mb-3">🏢 Dados Fiscais</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold text-emerald-700 uppercase mb-1 block">NCM</label>
                                <input name="ncm" value={form.fiscal.ncm} onChange={handleFiscalChange}
                                    className="w-full p-3 border border-emerald-200 bg-white rounded-xl text-sm font-mono outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-emerald-700 uppercase mb-1 block">CFOP</label>
                                <select name="cfop" value={form.fiscal.cfop} onChange={handleFiscalChange}
                                    className="w-full p-3 border border-emerald-200 bg-white rounded-xl text-sm outline-none">
                                    <option value="5102">5102 - Venda Normal</option>
                                    <option value="5405">5405 - Subs. Tributária</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-emerald-700 uppercase mb-1 block">Unidade</label>
                                <select name="unidade" value={form.fiscal.unidade} onChange={handleFiscalChange}
                                    className="w-full p-3 border border-emerald-200 bg-white rounded-xl text-sm outline-none">
                                    {['UN', 'KG', 'LT', 'CX', 'PC'].map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Descrição (opcional)</label>
                        <textarea name="descricao" value={form.descricao} onChange={handleChange}
                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm resize-none"
                            rows={2} placeholder="Detalhes do produto..." />
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                    <button onClick={onFechar}
                        className="px-6 py-3 rounded-xl border font-bold text-gray-600 hover:bg-gray-100 text-sm">
                        Cancelar
                    </button>
                    <button onClick={salvar} disabled={salvando}
                        className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 text-sm flex items-center gap-2 disabled:opacity-50">
                        {salvando
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <IoCheckmarkCircleOutline size={18} />}
                        Salvar Produto
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
const EntradaEstoqueXML = () => {
    const { estabelecimentoIdPrincipal } = useAuth();
    const [notaLida, setNotaLida] = useState(null);
    const [loading, setLoading] = useState(false);
    const [produtosSistema, setProdutosSistema] = useState([]);
    const [modalVinculo, setModalVinculo] = useState({ isOpen: false, itemIndex: null });
    const [modalNovoProduto, setModalNovoProduto] = useState({ isOpen: false, itemIndex: null });
    const [margemPadrao, setMargemPadrao] = useState(50);
    const [fornecedorSalvo, setFornecedorSalvo] = useState(null);
    const [formFornecedor, setFormFornecedor] = useState({
        nome: '', cnpj: '', contato: '', email: '', telefone: '', prazo: '30', condicao: 'boleto'
    });
    const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);
    const [mostrarFormFornecedor, setMostrarFormFornecedor] = useState(false);
    const [pagamento, setPagamento] = useState({ metodo: 'boleto', parcelas: 1, primeiroVencimento: '' });
    const [notaDuplicada, setNotaDuplicada] = useState(null);
    const [modalDuplicata, setModalDuplicata] = useState(false);
    const [pendingXml, setPendingXml] = useState(null);
    const [historico, setHistorico] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('importar');
    const [notaExpandida, setNotaExpandida] = useState(null);
    const [parcelasNota, setParcelasNota] = useState([]);
    const [loadingParcelas, setLoadingParcelas] = useState(false);

    // ── BUSCA PRODUTOS ──
    useEffect(() => {
        if (!estabelecimentoIdPrincipal) return;
        produtoService.buscarProdutosUniversal(estabelecimentoIdPrincipal)
            .then(prods => setProdutosSistema(prods))
            .catch(() => toast.error('Erro ao carregar produtos.'));
    }, [estabelecimentoIdPrincipal]);

    // ── BUSCA HISTÓRICO ──
    const buscarHistorico = useCallback(async () => {
        if (!estabelecimentoIdPrincipal) return;
        setLoadingHistorico(true);
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'historico_compras'),
                    orderBy('dataEntrada', 'desc'),
                    limit(20)
                )
            );
            setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistorico(false);
        }
    }, [estabelecimentoIdPrincipal]);

    useEffect(() => { buscarHistorico(); }, [buscarHistorico]);

    // ── BUSCA PARCELAS DE UMA NOTA ──
    const buscarParcelasNota = async (numeroNota) => {
        if (notaExpandida === numeroNota) {
            setNotaExpandida(null);
            setParcelasNota([]);
            return;
        }
        setNotaExpandida(numeroNota);
        setLoadingParcelas(true);
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'contas_a_pagar'),
                    where('numeroNota', '==', numeroNota),
                    orderBy('parcela', 'asc')
                )
            );
            setParcelasNota(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
            toast.error('Erro ao buscar parcelas.');
        } finally {
            setLoadingParcelas(false);
        }
    };

    // ── RECALCULA PREÇOS QUANDO MARGEM MUDA ──
    useEffect(() => {
        if (!notaLida) return;
        setNotaLida(prev => ({
            ...prev,
            produtos: prev.produtos.map(p => ({
                ...p,
                precoVendaSugerido: (p.valorUnit * (1 + margemPadrao / 100)).toFixed(2)
            }))
        }));
    }, [margemPadrao]);

    // ── DETECTA FORNECEDOR PELO CNPJ ──
    const detectarFornecedor = useCallback(async (cnpj) => {
        if (!cnpj || !estabelecimentoIdPrincipal) return;
        try {
            const fornRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'fornecedores', cnpj.replace(/\D/g, ''));
            const snap = await getDoc(fornRef);
            if (snap.exists()) {
                setFornecedorSalvo(snap.data());
                setMostrarFormFornecedor(false);
            } else {
                setFornecedorSalvo(null);
            }
        } catch (e) { console.error(e); }
    }, [estabelecimentoIdPrincipal]);

    // ── PROCESSA XML ──
    const processarXml = useCallback((xmlDoc, numeroNota, cnpj, nomeFornecedor, detList) => {
        const ide = xmlDoc.getElementsByTagName('ide')[0];
        const produtos = [];

        for (let i = 0; i < detList.length; i++) {
            const prod = detList[i].getElementsByTagName('prod')[0];
            const custo = parseFloat(prod.getElementsByTagName('vUnCom')[0]?.textContent || 0);
            produtos.push({
                item: i + 1,
                codigo: prod.getElementsByTagName('cProd')[0]?.textContent,
                ean: prod.getElementsByTagName('cEAN')[0]?.textContent,
                nome: prod.getElementsByTagName('xProd')[0]?.textContent,
                ncm: prod.getElementsByTagName('NCM')[0]?.textContent,
                qtd: parseFloat(prod.getElementsByTagName('qCom')[0]?.textContent || 0),
                unidade: prod.getElementsByTagName('uCom')[0]?.textContent,
                valorUnit: custo,
                valorTotal: parseFloat(prod.getElementsByTagName('vProd')[0]?.textContent || 0),
                precoVendaSugerido: (custo * (1 + margemPadrao / 100)).toFixed(2),
                vinculoId: null, vinculoNome: null, vinculoPath: null, vinculoCategoria: null,
            });
        }

        setNotaLida({
            numero: numeroNota,
            serie: ide?.getElementsByTagName('serie')[0]?.textContent,
            dataEmissao: ide?.getElementsByTagName('dhEmi')[0]?.textContent || ide?.getElementsByTagName('dEmi')[0]?.textContent,
            fornecedor: { nome: nomeFornecedor, cnpj },
            produtos,
            totalNota: produtos.reduce((acc, p) => acc + p.valorTotal, 0),
        });

        setFormFornecedor(prev => ({ ...prev, nome: nomeFornecedor, cnpj }));
        detectarFornecedor(cnpj);

        const venc = new Date();
        venc.setDate(venc.getDate() + 30);
        setPagamento(prev => ({ ...prev, primeiroVencimento: venc.toISOString().split('T')[0] }));
        setAbaAtiva('importar');
        toast.success('Nota XML lida com sucesso!');
    }, [margemPadrao, detectarFornecedor]);

    // ── UPLOAD DO XML ──
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (file.type !== 'text/xml' && !file.name.endsWith('.xml')) {
            toast.error('Selecione um arquivo XML válido.'); return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const xmlDoc = new DOMParser().parseFromString(e.target.result, 'text/xml');
                const ide = xmlDoc.getElementsByTagName('ide')[0];
                const emit = xmlDoc.getElementsByTagName('emit')[0];
                const detList = xmlDoc.getElementsByTagName('det');

                const numeroNota = ide?.getElementsByTagName('nNF')[0]?.textContent || '';
                const cnpj = emit?.getElementsByTagName('CNPJ')[0]?.textContent || '';
                const nomeFornecedor = emit?.getElementsByTagName('xNome')[0]?.textContent || '';

                // 🔥 VERIFICA DUPLICATA
                const snapDuplicata = await getDocs(
                    query(
                        collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'historico_compras'),
                        where('numeroNota', '==', numeroNota),
                        where('fornecedorCnpj', '==', cnpj)
                    )
                );

                if (!snapDuplicata.empty) {
                    const importacaoAnterior = { id: snapDuplicata.docs[0].id, ...snapDuplicata.docs[0].data() };
                    setNotaDuplicada(importacaoAnterior);
                    setModalDuplicata(true);
                    setPendingXml({ xmlDoc, numeroNota, cnpj, nomeFornecedor, detList });
                    return;
                }

                processarXml(xmlDoc, numeroNota, cnpj, nomeFornecedor, detList);
            } catch (err) {
                console.error(err);
                toast.error('Falha ao processar o XML.');
            }
        };
        reader.readAsText(file);
    };

    const limparNota = () => {
        setNotaLida(null);
        setFornecedorSalvo(null);
        setMostrarFormFornecedor(false);
        const input = document.getElementById('fileInput');
        if (input) input.value = '';
    };

    const selecionarVinculo = (produtoSistema) => {
        const idx = modalVinculo.itemIndex;
        setNotaLida(prev => ({
            ...prev,
            produtos: prev.produtos.map((p, i) => i !== idx ? p : {
                ...p,
                vinculoId: produtoSistema.id,
                vinculoNome: produtoSistema.name,
                vinculoCategoria: produtoSistema.category,
                vinculoPath: `estabelecimentos/${estabelecimentoIdPrincipal}/cardapio/${produtoSistema.category}/itens/${produtoSistema.id}`,
            })
        }));
        setModalVinculo({ isOpen: false, itemIndex: null });
    };

    const abrirCriarNovo = () => {
        setModalNovoProduto({ isOpen: true, itemIndex: modalVinculo.itemIndex });
        setModalVinculo({ isOpen: false, itemIndex: null });
    };

    const onProdutoCriado = (novoProduto) => {
        const idx = modalNovoProduto.itemIndex;
        setProdutosSistema(prev => [...prev, novoProduto]);
        setNotaLida(prev => ({
            ...prev,
            produtos: prev.produtos.map((p, i) => i !== idx ? p : {
                ...p,
                vinculoId: novoProduto.id,
                vinculoNome: novoProduto.name,
                vinculoCategoria: novoProduto.category,
                vinculoPath: novoProduto.path,
            })
        }));
        setModalNovoProduto({ isOpen: false, itemIndex: null });
    };

    const atualizarPrecoVenda = (idx, valor) => {
        setNotaLida(prev => ({
            ...prev,
            produtos: prev.produtos.map((p, i) => i !== idx ? p : { ...p, precoVendaSugerido: valor })
        }));
    };

    const salvarFornecedor = async () => {
        if (!formFornecedor.cnpj || !formFornecedor.nome) {
            toast.error('CNPJ e Nome são obrigatórios.'); return;
        }
        setSalvandoFornecedor(true);
        try {
            const cnpjLimpo = formFornecedor.cnpj.replace(/\D/g, '');
            const fornRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'fornecedores', cnpjLimpo);
            await setDoc(fornRef, { ...formFornecedor, cnpj: cnpjLimpo, atualizadoEm: serverTimestamp() }, { merge: true });
            setFornecedorSalvo(formFornecedor);
            setMostrarFormFornecedor(false);
            toast.success('✅ Fornecedor salvo!');
        } catch (err) {
            toast.error('Erro ao salvar fornecedor.');
        } finally { setSalvandoFornecedor(false); }
    };

    const gerarParcelas = () => {
        if (!pagamento.primeiroVencimento || !notaLida) return [];
        const valorParcela = notaLida.totalNota / pagamento.parcelas;
        return Array.from({ length: pagamento.parcelas }, (_, i) => {
            const data = new Date(pagamento.primeiroVencimento + 'T12:00:00');
            data.setMonth(data.getMonth() + i);
            return { numero: i + 1, valor: valorParcela, vencimento: data.toISOString().split('T')[0] };
        });
    };

    const confirmarEntradaEstoque = async () => {
        if (!estabelecimentoIdPrincipal) return;
        if (!pagamento.primeiroVencimento) {
            toast.error('Informe a data do primeiro vencimento.'); return;
        }
        setLoading(true);
        try {
            const batch = writeBatch(db);

            notaLida.produtos.forEach((prod) => {
                if (!prod.vinculoPath) return;
                const prodRef = doc(db, prod.vinculoPath);
                const updateData = {
                    estoque: increment(prod.qtd),
                    custo: prod.valorUnit,
                    'fiscal.ncm': prod.ncm,
                };
                if (prod.precoVendaSugerido && Number(prod.precoVendaSugerido) > 0) {
                    updateData.preco = Number(prod.precoVendaSugerido);
                }
                batch.update(prodRef, updateData);
            });

            gerarParcelas().forEach((parcela) => {
                const contaRef = doc(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'contas_a_pagar'));
                batch.set(contaRef, {
                    descricao: `NF ${notaLida.numero} - ${notaLida.fornecedor.nome} (${parcela.numero}/${pagamento.parcelas})`,
                    valor: parcela.valor,
                    vencimento: parcela.vencimento,
                    parcela: parcela.numero,
                    totalParcelas: pagamento.parcelas,
                    metodo: pagamento.metodo,
                    status: 'pendente',
                    fornecedorNome: notaLida.fornecedor.nome,
                    fornecedorCnpj: notaLida.fornecedor.cnpj,
                    numeroNota: notaLida.numero,
                    criadoEm: serverTimestamp(),
                });
            });

            const historicoRef = doc(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'historico_compras'));
            batch.set(historicoRef, {
                numeroNota: notaLida.numero,
                serie: notaLida.serie,
                fornecedorNome: notaLida.fornecedor.nome,
                fornecedorCnpj: notaLida.fornecedor.cnpj,
                valorTotal: notaLida.totalNota,
                dataEmissao: notaLida.dataEmissao,
                dataEntrada: serverTimestamp(),
                pagamento: { metodo: pagamento.metodo, parcelas: pagamento.parcelas },
                itens: notaLida.produtos.map(p => ({
                    nomeXML: p.nome, codigoXML: p.codigo, eanXML: p.ean, ncm: p.ncm,
                    vinculoId: p.vinculoId || null, vinculoNome: p.vinculoNome || null,
                    quantidade: p.qtd, unidade: p.unidade,
                    valorUnit: p.valorUnit, valorTotal: p.valorTotal,
                    precoVenda: Number(p.precoVendaSugerido) || null,
                }))
            });

            await batch.commit();
            toast.success(`✅ Entrada confirmada! ${pagamento.parcelas} parcela(s) criada(s).`);
            buscarHistorico();
            limparNota();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar entrada de estoque.');
        } finally { setLoading(false); }
    };

    const parcelas = notaLida ? gerarParcelas() : [];
    const todosVinculados = notaLida?.produtos.every(p => p.vinculoId);
    const totalVinculados = notaLida?.produtos.filter(p => p.vinculoId).length || 0;
    const totalItens = notaLida?.produtos.length || 0;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                <header>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <IoCloudUploadOutline className="text-blue-600" /> Entrada de Estoque via XML
                    </h1>
                    <p className="text-gray-500">Importe notas — atualiza estoque, custo, NCM, preço e gera contas a pagar.</p>
                </header>

                {/* ── TELA DE UPLOAD / HISTÓRICO ── */}
                {!notaLida && (
                    <>
                        <div className="flex gap-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-1 w-fit">
                            <button onClick={() => setAbaAtiva('importar')}
                                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${abaAtiva === 'importar' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                                📥 Importar Nota
                            </button>
                            <button onClick={() => { setAbaAtiva('historico'); buscarHistorico(); }}
                                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${abaAtiva === 'historico' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                                📋 Histórico ({historico.length})
                            </button>
                        </div>

                        {abaAtiva === 'importar' && (
                            <div className="bg-white border-4 border-dashed border-gray-200 rounded-[2.5rem] p-12 text-center hover:border-blue-400 transition-all group">
                                <input type="file" id="fileInput" accept=".xml" onChange={handleFileUpload} className="hidden" />
                                <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center">
                                    <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <IoDocumentTextOutline size={48} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Arraste seu arquivo XML aqui</h2>
                                    <p className="text-gray-400 mb-8">Ou clique para buscar no seu computador</p>
                                    <span className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
                                        Selecionar Arquivo
                                    </span>
                                </label>
                            </div>
                        )}

                        {abaAtiva === 'historico' && (
                            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <IoReceiptOutline className="text-blue-600" /> Notas Importadas
                                    </h3>
                                    <button onClick={buscarHistorico}
                                        className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">
                                        <IoRefreshOutline /> Atualizar
                                    </button>
                                </div>

                                {loadingHistorico ? (
                                    <div className="p-12 text-center text-gray-400">Carregando...</div>
                                ) : historico.length === 0 ? (
                                    <div className="p-12 text-center text-gray-400">
                                        <IoReceiptOutline size={48} className="mx-auto mb-3 opacity-30" />
                                        <p>Nenhuma nota importada ainda.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {historico.map(nota => (
                                            <div key={nota.id}>
                                                {/* LINHA DA NOTA */}
                                                <div
                                                    className="p-5 hover:bg-gray-50/50 transition-colors cursor-pointer"
                                                    onClick={() => buscarParcelasNota(nota.numeroNota)}
                                                >
                                                    <div className="flex flex-wrap justify-between items-start gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold font-mono">
                                                                    NF {nota.numeroNota}
                                                                </span>
                                                                <span className="text-xs text-gray-400">
                                                                    {nota.dataEntrada?.toDate
                                                                        ? nota.dataEntrada.toDate().toLocaleDateString('pt-BR')
                                                                        : '—'}
                                                                </span>
                                                                {nota.pagamento?.parcelas > 1 && (
                                                                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                                                                        {nota.pagamento.parcelas}x {nota.pagamento.metodo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="font-bold text-gray-800">{nota.fornecedorNome}</p>
                                                            <p className="text-xs text-gray-500 font-mono">CNPJ: {nota.fornecedorCnpj}</p>
                                                        </div>
                                                        <div className="text-right flex items-start gap-3">
                                                            <div>
                                                                <p className="text-lg font-black text-gray-900">
                                                                    {Number(nota.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </p>
                                                                <p className="text-xs text-gray-500">{nota.itens?.length || 0} itens</p>
                                                            </div>
                                                            <div className={`p-2 rounded-xl transition-transform duration-300 ${notaExpandida === nota.numeroNota ? 'rotate-180 bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <path d="M6 9l6 6 6-6" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap gap-1">
                                                        {nota.itens?.slice(0, 5).map((item, i) => (
                                                            <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                {item.vinculoNome || item.nomeXML}
                                                            </span>
                                                        ))}
                                                        {(nota.itens?.length || 0) > 5 && (
                                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                                                +{nota.itens.length - 5} mais
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* PARCELAS EXPANDIDAS */}
                                                {notaExpandida === nota.numeroNota && (
                                                    <div className="bg-indigo-50/50 border-t border-indigo-100 px-5 pb-5 pt-4">
                                                        <p className="text-xs font-bold text-indigo-700 uppercase mb-3 flex items-center gap-2">
                                                            <IoWalletOutline /> Parcelas / Contas a Pagar
                                                        </p>

                                                        {loadingParcelas ? (
                                                            <div className="text-center py-4 text-gray-400 text-sm">Carregando parcelas...</div>
                                                        ) : parcelasNota.length === 0 ? (
                                                            <div className="text-center py-4 text-gray-400 text-sm">
                                                                Nenhuma parcela encontrada para esta nota.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {parcelasNota.map(parcela => {
                                                                    const venc = new Date(parcela.vencimento + 'T12:00:00');
                                                                    const hoje = new Date();
                                                                    const vencida = parcela.status === 'pendente' && venc < hoje;

                                                                    return (
                                                                        <div key={parcela.id}
                                                                            className={`flex items-center justify-between bg-white rounded-2xl px-4 py-3 border shadow-sm ${parcela.status === 'pago' ? 'border-emerald-100' : vencida ? 'border-red-200' : 'border-indigo-100'}`}>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg min-w-[40px] text-center">
                                                                                    {parcela.parcela}/{parcela.totalParcelas}
                                                                                </span>
                                                                                <div>
                                                                                    <p className="text-sm font-bold text-gray-800">
                                                                                        {parcela.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                                    </p>
                                                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                                                        <IoCalendarOutline size={11} />
                                                                                        Vence: {venc.toLocaleDateString('pt-BR')}
                                                                                        {vencida && <span className="text-red-500 font-bold ml-1">⚠️ Vencida</span>}
                                                                                    </p>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-3">
                                                                                <span className="text-xs font-bold capitalize text-gray-500">
                                                                                    {parcela.metodo}
                                                                                </span>
                                                                                <button
                                                                                    onClick={async (e) => {
                                                                                        e.stopPropagation();
                                                                                        try {
                                                                                            const novoStatus = parcela.status === 'pago' ? 'pendente' : 'pago';
                                                                                            const ref = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'contas_a_pagar', parcela.id);
                                                                                            await setDoc(ref, {
                                                                                                status: novoStatus,
                                                                                                ...(novoStatus === 'pago' ? { pagoEm: serverTimestamp() } : { pagoEm: null })
                                                                                            }, { merge: true });
                                                                                            setParcelasNota(prev => prev.map(p =>
                                                                                                p.id === parcela.id ? { ...p, status: novoStatus } : p
                                                                                            ));
                                                                                            toast.success(novoStatus === 'pago' ? '✅ Marcado como pago!' : 'Revertido para pendente.');
                                                                                        } catch (err) {
                                                                                            toast.error('Erro ao atualizar status.');
                                                                                        }
                                                                                    }}
                                                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${parcela.status === 'pago' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : vencida ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                                                                    {parcela.status === 'pago' ? '✅ Pago' : vencida ? '🔴 Vencida' : '⏳ Pendente'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}

                                                                <div className="flex justify-between items-center pt-2 px-1">
                                                                    <span className="text-xs text-gray-500">
                                                                        {parcelasNota.filter(p => p.status === 'pago').length} de {parcelasNota.length} pagas
                                                                    </span>
                                                                    <span className="text-xs font-bold text-gray-700">
                                                                        Restante: {parcelasNota
                                                                            .filter(p => p.status !== 'pago')
                                                                            .reduce((acc, p) => acc + (p.valor || 0), 0)
                                                                            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ── TELA DE PROCESSAMENTO DA NOTA ── */}
                {notaLida && (
                    <>
                        {/* MARGEM */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-3">
                                <IoPricetagOutline className="text-blue-600 text-xl" />
                                <span className="font-bold text-gray-700">Margem de lucro padrão:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="number" min="0" max="1000" value={margemPadrao}
                                    onChange={e => setMargemPadrao(Number(e.target.value))}
                                    className="w-24 p-2 border border-blue-200 bg-blue-50 rounded-xl text-center font-bold text-blue-700 outline-none" />
                                <span className="font-bold text-gray-500">%</span>
                            </div>
                            <p className="text-xs text-gray-400">Recalcula o preço de venda sugerido de todos os produtos.</p>
                        </div>

                        {/* CARDS RESUMO */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-blue-600 mb-2">
                                    <IoDocumentTextOutline size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Dados da Nota</span>
                                </div>
                                <p className="text-xl font-bold text-gray-800">Nº {notaLida.numero}</p>
                                <p className="text-sm text-gray-500">Série: {notaLida.serie} • Emissão: {new Date(notaLida.dataEmissao).toLocaleDateString()}</p>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 text-emerald-600">
                                        <IoBusinessOutline size={20} />
                                        <span className="text-xs font-black uppercase tracking-widest">Fornecedor</span>
                                    </div>
                                    {fornecedorSalvo ? (
                                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">✅ Cadastrado</span>
                                    ) : (
                                        <button onClick={() => setMostrarFormFornecedor(true)}
                                            className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold hover:bg-blue-100">
                                            + Salvar
                                        </button>
                                    )}
                                </div>
                                <p className="text-lg font-bold text-gray-800 truncate">{notaLida.fornecedor.nome}</p>
                                <p className="text-sm text-gray-500">CNPJ: {notaLida.fornecedor.cnpj}</p>
                                {fornecedorSalvo && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        {fornecedorSalvo.prazo}d • {fornecedorSalvo.condicao} • {fornecedorSalvo.telefone}
                                    </p>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-purple-600 mb-2">
                                    <IoCartOutline size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Valor Total</span>
                                </div>
                                <p className="text-2xl font-black text-gray-900">
                                    {notaLida.totalNota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                <p className="text-sm text-gray-500">{notaLida.produtos.length} itens</p>
                            </div>
                        </div>

                        {/* FORM FORNECEDOR */}
                        {mostrarFormFornecedor && (
                            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <IoBusinessOutline className="text-blue-600" /> Cadastrar Fornecedor
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[
                                        { label: 'Nome *', key: 'nome', placeholder: 'Razão social' },
                                        { label: 'CNPJ', key: 'cnpj', placeholder: '00.000.000/0000-00' },
                                        { label: 'Telefone', key: 'telefone', placeholder: '(11) 99999-9999' },
                                        { label: 'E-mail', key: 'email', placeholder: 'contato@fornecedor.com' },
                                        { label: 'Contato (nome)', key: 'contato', placeholder: 'Nome do vendedor' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">{f.label}</label>
                                            <input value={formFornecedor[f.key]}
                                                onChange={e => setFormFornecedor(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                placeholder={f.placeholder}
                                                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Prazo (dias)</label>
                                        <input type="number" value={formFornecedor.prazo}
                                            onChange={e => setFormFornecedor(prev => ({ ...prev, prazo: e.target.value }))}
                                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Condição</label>
                                        <select value={formFornecedor.condicao}
                                            onChange={e => setFormFornecedor(prev => ({ ...prev, condicao: e.target.value }))}
                                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm">
                                            {['boleto', 'pix', 'cartao', 'cheque', 'dinheiro'].map(c => (
                                                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-4">
                                    <button onClick={() => setMostrarFormFornecedor(false)}
                                        className="px-5 py-2 rounded-xl border text-gray-600 font-bold text-sm hover:bg-gray-50">Cancelar</button>
                                    <button onClick={salvarFornecedor} disabled={salvandoFornecedor}
                                        className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                                        {salvandoFornecedor
                                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            : <IoSaveOutline size={16} />}
                                        Salvar Fornecedor
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PROGRESSO */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-gray-700">Progresso dos vínculos</span>
                                <span className="text-sm font-black text-gray-800">{totalVinculados}/{totalItens}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-green-500 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${totalItens > 0 ? (totalVinculados / totalItens) * 100 : 0}%` }} />
                            </div>
                            {!todosVinculados && (
                                <p className="text-xs text-amber-600 font-medium mt-2">
                                    ⚠️ Vincule todos os produtos para liberar a confirmação
                                </p>
                            )}
                        </div>

                        {/* TABELA */}
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <IoCubeOutline className="text-blue-600" /> Itens da Nota
                                </h3>
                                <button onClick={limparNota}
                                    className="text-red-500 hover:text-red-700 font-bold text-sm flex items-center gap-1">
                                    <IoTrashOutline /> Limpar
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-400 font-black">
                                            <th className="px-4 py-4">Produto na Nota</th>
                                            <th className="px-4 py-4">NCM</th>
                                            <th className="px-4 py-4">Qtd</th>
                                            <th className="px-4 py-4">Custo Unit.</th>
                                            <th className="px-4 py-4">Preço Venda</th>
                                            <th className="px-4 py-4">Total</th>
                                            <th className="px-4 py-4">Vínculo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {notaLida.produtos.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-4">
                                                    <p className="text-sm font-bold text-gray-800">{p.nome}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">
                                                        EAN: {p.ean || 'SEM EAN'} | COD: {p.codigo}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100">
                                                        {p.ncm || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="bg-gray-100 px-2 py-1 rounded-lg text-sm font-bold text-gray-600">
                                                        {p.qtd} {p.unidade}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-600 font-mono">
                                                    {p.valorUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-gray-400">R$</span>
                                                        <input type="number" step="0.01" min="0"
                                                            value={p.precoVendaSugerido}
                                                            onChange={e => atualizarPrecoVenda(idx, e.target.value)}
                                                            className="w-24 p-2 border border-emerald-200 bg-emerald-50 rounded-xl text-sm font-bold text-emerald-800 outline-none text-center" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sm font-black text-gray-900">
                                                    {p.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-4">
                                                    {p.vinculoId ? (
                                                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl border border-emerald-100 text-sm font-bold">
                                                            <IoCheckmarkCircleOutline size={18} />
                                                            <span className="truncate max-w-[100px]">{p.vinculoNome}</span>
                                                            <button onClick={() => setModalVinculo({ isOpen: true, itemIndex: idx })}
                                                                className="ml-auto text-xs underline shrink-0">Trocar</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setModalVinculo({ isOpen: true, itemIndex: idx })}
                                                            className="flex items-center gap-2 text-[11px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-all border border-blue-100">
                                                            <IoAlertCircleOutline size={16} /> Vincular
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* PAGAMENTO */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <IoWalletOutline className="text-indigo-600" /> Condição de Pagamento
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Método</label>
                                    <select value={pagamento.metodo}
                                        onChange={e => setPagamento(prev => ({ ...prev, metodo: e.target.value }))}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm">
                                        {['boleto', 'pix', 'cartao', 'cheque', 'dinheiro', 'transferencia'].map(m => (
                                            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Nº de Parcelas</label>
                                    <input type="number" min="1" max="24" value={pagamento.parcelas}
                                        onChange={e => setPagamento(prev => ({ ...prev, parcelas: Math.max(1, parseInt(e.target.value) || 1) }))}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm font-bold" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">1º Vencimento</label>
                                    <input type="date" value={pagamento.primeiroVencimento}
                                        onChange={e => setPagamento(prev => ({ ...prev, primeiroVencimento: e.target.value }))}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" />
                                </div>
                            </div>

                            {parcelas.length > 0 && (
                                <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4">
                                    <p className="text-xs font-bold text-indigo-700 uppercase mb-3 flex items-center gap-2">
                                        <IoReceiptOutline /> Preview das parcelas
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {parcelas.map(parcela => (
                                            <div key={parcela.numero} className="bg-white rounded-xl p-3 border border-indigo-100 text-center">
                                                <p className="text-xs text-indigo-600 font-bold">{parcela.numero}/{pagamento.parcelas}</p>
                                                <p className="text-sm font-black text-gray-800">
                                                    {parcela.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                                <p className="text-[10px] text-gray-500">
                                                    {new Date(parcela.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* O QUE SERÁ ATUALIZADO */}
                        {todosVinculados && (
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-sm text-emerald-700">
                                <p className="font-bold mb-1">✅ Ao confirmar, para cada produto vinculado:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-xs">
                                    <li>Estoque somado (+quantidade da nota)</li>
                                    <li>Custo atualizado (preço unitário da nota)</li>
                                    <li>NCM atualizado</li>
                                    <li>Preço de venda atualizado (conforme coluna editável)</li>
                                    <li>{pagamento.parcelas} conta(s) a pagar criada(s) em {pagamento.metodo}</li>
                                </ul>
                            </div>
                        )}

                        {/* BOTÃO CONFIRMAR */}
                        <div className="flex justify-end pb-8">
                            <button onClick={confirmarEntradaEstoque}
                                disabled={!todosVinculados || loading || !pagamento.primeiroVencimento}
                                className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-green-100 hover:bg-green-700 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                                {loading
                                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <IoSaveOutline size={20} />}
                                Confirmar Entrada no Estoque
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ── MODAL DUPLICATA ── */}
            {modalDuplicata && notaDuplicada && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-amber-100 bg-amber-50">
                            <h3 className="font-bold text-amber-800 text-lg">⚠️ Nota já importada anteriormente</h3>
                            <p className="text-sm text-amber-700 mt-1">Esta nota fiscal já foi processada. Veja os dados abaixo.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2 text-sm">
                                {[
                                    ['Nota Nº', notaDuplicada.numeroNota],
                                    ['Fornecedor', notaDuplicada.fornecedorNome],
                                    ['Valor Total', Number(notaDuplicada.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                                    ['Importada em', notaDuplicada.dataEntrada?.toDate ? notaDuplicada.dataEntrada.toDate().toLocaleString('pt-BR') : '—'],
                                    ['Itens', `${notaDuplicada.itens?.length || 0} produtos`],
                                    ['Pagamento', `${notaDuplicada.pagamento?.parcelas}x ${notaDuplicada.pagamento?.metodo}`],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex justify-between">
                                        <span className="text-gray-500">{label}</span>
                                        <span className="font-bold truncate max-w-[220px] text-right">{value}</span>
                                    </div>
                                ))}
                            </div>

                            <p className="text-sm text-gray-600 font-medium">O que deseja fazer?</p>

                            <div className="space-y-2">
                                <button
                                    onClick={() => {
                                        setModalDuplicata(false);
                                        setNotaDuplicada(null);
                                        setPendingXml(null);
                                        const input = document.getElementById('fileInput');
                                        if (input) input.value = '';
                                    }}
                                    className="w-full py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 text-sm text-left flex items-center gap-3">
                                    <span className="text-xl">🚫</span>
                                    <div>
                                        <p>Cancelar — não importar</p>
                                        <p className="text-xs text-gray-400 font-normal">Descarta o arquivo e volta para a tela inicial</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        setModalDuplicata(false);
                                        setNotaDuplicada(null);
                                        setPendingXml(null);
                                        const input = document.getElementById('fileInput');
                                        if (input) input.value = '';
                                        setAbaAtiva('historico');
                                    }}
                                    className="w-full py-3 px-4 rounded-xl border border-blue-100 text-blue-700 font-bold hover:bg-blue-50 text-sm text-left flex items-center gap-3">
                                    <span className="text-xl">📋</span>
                                    <div>
                                        <p>Ver histórico de importações</p>
                                        <p className="text-xs text-blue-400 font-normal">Consulta as notas já processadas</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        setModalDuplicata(false);
                                        setNotaDuplicada(null);
                                        if (pendingXml) {
                                            const { xmlDoc, numeroNota, cnpj, nomeFornecedor, detList } = pendingXml;
                                            processarXml(xmlDoc, numeroNota, cnpj, nomeFornecedor, detList);
                                        }
                                        setPendingXml(null);
                                    }}
                                    className="w-full py-3 px-4 rounded-xl border border-red-100 text-red-700 font-bold hover:bg-red-50 text-sm text-left flex items-center gap-3">
                                    <span className="text-xl">⚠️</span>
                                    <div>
                                        <p>Reimportar mesmo assim</p>
                                        <p className="text-xs text-red-400 font-normal">Vai somar estoque novamente e criar novas parcelas</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL VINCULAR ── */}
            {modalVinculo.isOpen && notaLida && (
                <ModalVinculo
                    produtoNota={notaLida.produtos[modalVinculo.itemIndex]}
                    produtosSistema={produtosSistema}
                    onVincular={selecionarVinculo}
                    onCriarNovo={abrirCriarNovo}
                    onFechar={() => setModalVinculo({ isOpen: false, itemIndex: null })}
                />
            )}

            {/* ── MODAL NOVO PRODUTO ── */}
            {modalNovoProduto.isOpen && notaLida && (
                <ModalNovoProduto
                    produtoNota={notaLida.produtos[modalNovoProduto.itemIndex]}
                    margemPadrao={margemPadrao}
                    estabelecimentoId={estabelecimentoIdPrincipal}
                    onSalvo={onProdutoCriado}
                    onFechar={() => setModalNovoProduto({ isOpen: false, itemIndex: null })}
                />
            )}
        </div>
    );
};

export default EntradaEstoqueXML;