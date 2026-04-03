import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
    collection, doc, serverTimestamp, writeBatch,
    increment, setDoc, getDocs, getDoc,
    query, orderBy, limit, where
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { parseNfeXml } from '../utils/nfeParser';
// Substituir pelo caminho correto do produtoService caso necessário, ou verificar a importação padrão no projeto.
import { produtoService } from '../services/produtoService';

export function useEntradaEstoqueXMLData(estabelecimentoIdPrincipal) {
    const [notaLida, setNotaLida] = useState(null);
    const [loading, setLoading] = useState(false);
    const [produtosSistema, setProdutosSistema] = useState([]);
    
    const [modalVinculo, setModalVinculo] = useState({ isOpen: false, itemIndex: null });
    const [modalNovoProduto, setModalNovoProduto] = useState({ isOpen: false, itemIndex: null });
    const [modalDuplicata, setModalDuplicata] = useState(false);
    
    const [margemPadrao, setMargemPadrao] = useState(50);
    const [fornecedorSalvo, setFornecedorSalvo] = useState(null);
    const [formFornecedor, setFormFornecedor] = useState({
        nome: '', cnpj: '', contato: '', email: '', telefone: '', prazo: '30', condicao: 'boleto'
    });
    
    const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);
    const [mostrarFormFornecedor, setMostrarFormFornecedor] = useState(false);
    const [pagamento, setPagamento] = useState({ metodo: 'boleto', parcelas: 1, primeiroVencimento: '' });
    
    const [notaDuplicada, setNotaDuplicada] = useState(null);
    const [pendingXml, setPendingXml] = useState(null);
    
    const [historico, setHistorico] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('importar');
    
    const [notaExpandida, setNotaExpandida] = useState(null);
    const [parcelasNota, setParcelasNota] = useState([]);
    const [loadingParcelas, setLoadingParcelas] = useState(false);

    // BUSTCA PRODUTOS BASE
    useEffect(() => {
        if (!estabelecimentoIdPrincipal) return;
        if (produtoService && produtoService.buscarProdutosUniversal) {
            produtoService.buscarProdutosUniversal(estabelecimentoIdPrincipal)
                .then(prods => setProdutosSistema(prods))
                .catch(() => toast.error('Erro ao carregar produtos.'));
        }
    }, [estabelecimentoIdPrincipal]);

    // BUSCA HISTORICO
    const buscarHistorico = useCallback(async () => {
        if (!estabelecimentoIdPrincipal) return;
        setLoadingHistorico(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'historico_compras'),
                orderBy('dataEntrada', 'desc'), limit(20))
            );
            setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); } 
        finally { setLoadingHistorico(false); }
    }, [estabelecimentoIdPrincipal]);

    useEffect(() => { buscarHistorico(); }, [buscarHistorico]);

    // BUSCA PARCELAS (ACORDEÃO HISTÓRICO)
    const buscarParcelasNota = async (numeroNota) => {
        if (notaExpandida === numeroNota) {
            setNotaExpandida(null); setParcelasNota([]); return;
        }
        setNotaExpandida(numeroNota); setLoadingParcelas(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'contas_a_pagar'),
                where('numeroNota', '==', numeroNota), orderBy('parcela', 'asc'))
            );
            setParcelasNota(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { toast.error('Erro ao buscar parcelas.'); } 
        finally { setLoadingParcelas(false); }
    };

    const alternarStatusParcela = async (e, parcela) => {
        e.stopPropagation();
        try {
            const novoStatus = parcela.status === 'pago' ? 'pendente' : 'pago';
            const ref = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'contas_a_pagar', parcela.id);
            await setDoc(ref, { status: novoStatus, ...(novoStatus === 'pago' ? { pagoEm: serverTimestamp() } : { pagoEm: null }) }, { merge: true });
            setParcelasNota(prev => prev.map(p => p.id === parcela.id ? { ...p, status: novoStatus } : p ));
            toast.success(novoStatus === 'pago' ? '✅ Marcado como pago!' : 'Revertido para pendente.');
        } catch (err) { toast.error('Erro ao atualizar status.'); }
    }

    // MARGEM MAGICA
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

    const detectarFornecedor = useCallback(async (cnpj) => {
        if (!cnpj || !estabelecimentoIdPrincipal) return;
        try {
            const fornRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'fornecedores', cnpj.replace(/\D/g, ''));
            const snap = await getDoc(fornRef);
            if (snap.exists()) { setFornecedorSalvo(snap.data()); setMostrarFormFornecedor(false); } 
            else { setFornecedorSalvo(null); }
        } catch (e) { console.error(e); }
    }, [estabelecimentoIdPrincipal]);

    const salvarFornecedor = async () => {
        if (!formFornecedor.cnpj || !formFornecedor.nome) return toast.error('CNPJ e Nome são obrigatórios.');
        setSalvandoFornecedor(true);
        try {
            const cnpjLimpo = formFornecedor.cnpj.replace(/\D/g, '');
            const fornRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'fornecedores', cnpjLimpo);
            await setDoc(fornRef, { ...formFornecedor, cnpj: cnpjLimpo, atualizadoEm: serverTimestamp() }, { merge: true });
            setFornecedorSalvo(formFornecedor); setMostrarFormFornecedor(false); toast.success('✅ Fornecedor salvo!');
        } catch (err) { toast.error('Erro ao salvar fornecedor.'); } 
        finally { setSalvandoFornecedor(false); }
    };

    const processarXml = useCallback((notaParsed) => {
        setNotaLida(notaParsed);
        setFormFornecedor(prev => ({ ...prev, nome: notaParsed.fornecedor.nome, cnpj: notaParsed.fornecedor.cnpj }));
        detectarFornecedor(notaParsed.fornecedor.cnpj);
        const venc = new Date(); venc.setDate(venc.getDate() + 30);
        setPagamento(prev => ({ ...prev, primeiroVencimento: venc.toISOString().split('T')[0] }));
        setAbaAtiva('importar'); toast.success('Nota XML lida com sucesso!');
    }, [detectarFornecedor]);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (file.type !== 'text/xml' && !file.name.endsWith('.xml')) { toast.error('Selecione um arquivo XML válido.'); return; }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const notaParsed = parseNfeXml(e.target.result, margemPadrao);
                const snapDuplicata = await getDocs(
                    query(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'historico_compras'),
                    where('numeroNota', '==', notaParsed.numero), where('fornecedorCnpj', '==', notaParsed.fornecedor.cnpj))
                );

                if (!snapDuplicata.empty) {
                    setNotaDuplicada({ id: snapDuplicata.docs[0].id, ...snapDuplicata.docs[0].data() });
                    setModalDuplicata(true); setPendingXml(notaParsed); return;
                }
                processarXml(notaParsed);
            } catch (err) { toast.error('Falha ao processar o XML: ' + err.message); }
        };
        reader.readAsText(file);
    };

    const limparNota = () => {
        setNotaLida(null); setFornecedorSalvo(null); setMostrarFormFornecedor(false);
        const input = document.getElementById('fileInput'); if (input) input.value = '';
    };

    const recalcularDuplicataEFechar = (cancelarImportacaoTotal = false) => {
        setModalDuplicata(false); setNotaDuplicada(null);
        if (cancelarImportacaoTotal) { setPendingXml(null); const input = document.getElementById('fileInput'); if (input) input.value = ''; return; }
        if (pendingXml) { processarXml(pendingXml); }
        setPendingXml(null);
    };

    const selecionarVinculo = (produtoSistema) => {
        const idx = modalVinculo.itemIndex;
        setNotaLida(prev => ({ ...prev, produtos: prev.produtos.map((p, i) => i !== idx ? p : { ...p, vinculoId: produtoSistema.id, vinculoNome: produtoSistema.name, vinculoCategoria: produtoSistema.category, vinculoPath: `estabelecimentos/${estabelecimentoIdPrincipal}/cardapio/${produtoSistema.category}/itens/${produtoSistema.id}` }) }));
        setModalVinculo({ isOpen: false, itemIndex: null });
    };

    const abrirCriarNovo = () => { setModalNovoProduto({ isOpen: true, itemIndex: modalVinculo.itemIndex }); setModalVinculo({ isOpen: false, itemIndex: null }); };
    
    const onProdutoCriado = (novoProduto) => {
        const idx = modalNovoProduto.itemIndex; setProdutosSistema(prev => [...prev, novoProduto]);
        setNotaLida(prev => ({ ...prev, produtos: prev.produtos.map((p, i) => i !== idx ? p : { ...p, vinculoId: novoProduto.id, vinculoNome: novoProduto.name, vinculoCategoria: novoProduto.category, vinculoPath: novoProduto.path }) }));
        setModalNovoProduto({ isOpen: false, itemIndex: null });
    };

    const atualizarPrecoVenda = (idx, valor) => {
        setNotaLida(prev => ({ ...prev, produtos: prev.produtos.map((p, i) => i !== idx ? p : { ...p, precoVendaSugerido: valor }) }));
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

    // FUNÇÃO MASTER DA CONFIRMAÇÃO DE ESTOQUE E PARCELAS
    const confirmarEntradaEstoque = async () => {
        if (!estabelecimentoIdPrincipal) return;
        if (!pagamento.primeiroVencimento) return toast.error('Informe a data do primeiro vencimento.');
        setLoading(true);
        try {
            const batch = writeBatch(db);

            // Atualiza Estoque de Itens
            notaLida.produtos.forEach((prod) => {
                if (!prod.vinculoPath) return;
                const prodRef = doc(db, prod.vinculoPath);
                const updateData = { estoque: increment(prod.qtd), custo: prod.valorUnit, 'fiscal.ncm': prod.ncm };
                if (prod.precoVendaSugerido && Number(prod.precoVendaSugerido) > 0) updateData.preco = Number(prod.precoVendaSugerido);
                batch.update(prodRef, updateData);
            });

            // Insere Parcelas / Contas a pagar
            gerarParcelas().forEach((parcela) => {
                const contaRef = doc(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'contas_a_pagar'));
                batch.set(contaRef, {
                    descricao: `NF ${notaLida.numero} - ${notaLida.fornecedor.nome} (${parcela.numero}/${pagamento.parcelas})`,
                    valor: parcela.valor, vencimento: parcela.vencimento, parcela: parcela.numero, totalParcelas: pagamento.parcelas,
                    metodo: pagamento.metodo, status: 'pendente', fornecedorNome: notaLida.fornecedor.nome, fornecedorCnpj: notaLida.fornecedor.cnpj,
                    numeroNota: notaLida.numero, criadoEm: serverTimestamp(),
                });
            });

            // Cria Histórico
            const historicoRef = doc(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'historico_compras'));
            batch.set(historicoRef, {
                numeroNota: notaLida.numero, serie: notaLida.serie, fornecedorNome: notaLida.fornecedor.nome, fornecedorCnpj: notaLida.fornecedor.cnpj,
                valorTotal: notaLida.totalNota, dataEmissao: notaLida.dataEmissao, dataEntrada: serverTimestamp(),
                pagamento: { metodo: pagamento.metodo, parcelas: pagamento.parcelas },
                itens: notaLida.produtos.map(p => ({
                    nomeXML: p.nome, codigoXML: p.codigo, eanXML: p.ean, ncm: p.ncm, vinculoId: p.vinculoId || null, vinculoNome: p.vinculoNome || null,
                    quantidade: p.qtd, unidade: p.unidade, valorUnit: p.valorUnit, valorTotal: p.valorTotal, precoVenda: Number(p.precoVendaSugerido) || null,
                }))
            });

            await batch.commit();
            toast.success(`✅ Entrada confirmada! ${pagamento.parcelas} parcela(s) criada(s).`);
            buscarHistorico(); limparNota();
        } catch (error) { toast.error('Erro ao salvar entrada de estoque.'); } 
        finally { setLoading(false); }
    };

    const parcelas = notaLida ? gerarParcelas() : [];
    const todosVinculados = notaLida?.produtos.every(p => p.vinculoId);
    const totalVinculados = notaLida?.produtos.filter(p => p.vinculoId).length || 0;
    const totalItens = notaLida?.produtos.length || 0;

    return {
        notaLida, loading, produtosSistema,
        modalVinculo, setModalVinculo, modalNovoProduto, setModalNovoProduto, modalDuplicata, setModalDuplicata,
        margemPadrao, setMargemPadrao, fornecedorSalvo, formFornecedor, setFormFornecedor, salvandoFornecedor, mostrarFormFornecedor, setMostrarFormFornecedor,
        pagamento, setPagamento, notaDuplicada, pendingXml,
        historico, loadingHistorico, abaAtiva, setAbaAtiva,
        notaExpandida, parcelasNota, loadingParcelas, buscarParcelasNota, alternarStatusParcela,
        
        // Metodos
        buscarHistorico, salvarFornecedor, handleFileUpload, limparNota, selecionarVinculo, abrirCriarNovo, onProdutoCriado,
        atualizarPrecoVenda, recalcularDuplicataEFechar, confirmarEntradaEstoque,
        
        // Computed
        parcelas, todosVinculados, totalVinculados, totalItens
    };
}
