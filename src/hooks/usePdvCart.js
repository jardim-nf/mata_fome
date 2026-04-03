import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';

export function usePdvCart(caixaAberto, inputBuscaRef, showPrompt, showConfirm) {
    const [vendaAtual, setVendaAtual] = useState(null);
    const [vendasSuspensas, setVendasSuspensas] = useState([]);
    const [mostrarSuspensas, setMostrarSuspensas] = useState(false);
    
    // Pagamento State Guardado na venda atual interativamente
    const [descontoValor, setDescontoValor] = useState('');
    const [acrescimoValor, setAcrescimoValor] = useState('');
    const [pagamentosAdicionados, setPagamentosAdicionados] = useState([]);

    const [produtoParaSelecao, setProdutoParaSelecao] = useState(null);
    const [itemParaEditar, setItemParaEditar] = useState(null);
    const [produtoParaPeso, setProdutoParaPeso] = useState(null);

    const [barcodeAviso, setBarcodeAviso] = useState(null);
    const bufferCodigoBarras = useRef('');
    const timeoutCodigoBarras = useRef(null);
    
    // Dependência de ref do bloqueio do scanner para usar no listener 
    const pdvSyncRef = useRef({});

    const iniciarVendaBalcao = useCallback((fecharModaisFront = true) => {
        if (!caixaAberto) return;
        setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
        setDescontoValor(''); setAcrescimoValor(''); setPagamentosAdicionados([]);
        if (fecharModaisFront) {
            setTimeout(() => inputBuscaRef.current?.focus(), 100);
        }
    }, [caixaAberto, inputBuscaRef]);

    const suspenderVenda = useCallback(() => {
        if (!vendaAtual || vendaAtual.itens.length === 0) return toast.warning("O carrinho está vazio!");
        showPrompt("Nome identificador (Opcional):", (nomeCliente) => {
            const nome = nomeCliente || `Cliente ${vendasSuspensas.length + 1}`;
            setVendasSuspensas(prev => [...prev, { ...vendaAtual, nomeReferencia: nome, dataSuspensao: new Date(), descontoGuardado: descontoValor, acrescimoGuardado: acrescimoValor, pagamentosGuardados: pagamentosAdicionados }]);
            iniciarVendaBalcao();
        }, { title: 'Suspender Venda', placeholder: 'Ex: Mesa 5, João...', submitText: 'Suspender' });
    }, [vendaAtual, vendasSuspensas, iniciarVendaBalcao, descontoValor, acrescimoValor, pagamentosAdicionados, showPrompt]);

    const restaurarVendaSuspensa = (vs) => {
        const doRestore = () => {
            setVendaAtual({ id: vs.id, itens: vs.itens, total: vs.total }); 
            setDescontoValor(vs.descontoGuardado || ''); 
            setAcrescimoValor(vs.acrescimoGuardado || ''); 
            setPagamentosAdicionados(vs.pagamentosGuardados || []);
            setVendasSuspensas(prev => prev.filter(v => v.id !== vs.id)); 
            setMostrarSuspensas(false); 
            setTimeout(() => inputBuscaRef.current?.focus(), 100);
        };
        if (vendaAtual && vendaAtual.itens.length > 0) { 
            showConfirm("O seu carrinho atual tem produtos. Substituir pela venda em espera?", doRestore, { title: 'Atenção', variant: 'warning' }); 
        } else { doRestore(); }
    };

    const excluirVendaSuspensa = (id) => { showConfirm("Excluir este pedido em espera?", () => setVendasSuspensas(prev => prev.filter(v => v.id !== id)), { variant: 'danger' }); };

    const tocarBeepErro = () => { 
        try { 
            const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            const osc = ctx.createOscillator(); const gain = ctx.createGain(); 
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, ctx.currentTime); 
            gain.gain.setValueAtTime(0.15, ctx.currentTime); 
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); 
            osc.connect(gain); gain.connect(ctx.destination); 
            osc.start(); osc.stop(ctx.currentTime + 0.5); 
        } catch (e) { console.error(e); } 
    };

    const handleProdutoClick = useCallback((p) => {
        const ePeso = p.vendidoPorPeso === true || String(p.fiscal?.unidade || '').trim().toUpperCase() === 'KG' || String(p.unidade || '').trim().toUpperCase() === 'KG';
        const cb = (nova) => { if (ePeso) setProdutoParaPeso(p); else if (p.temVariacoes) setProdutoParaSelecao(p); else adicionarItem(p, null, nova); };
        if (!vendaAtual) { const novaVenda = { id: Date.now().toString(), itens: [], total: 0 }; setVendaAtual(novaVenda); setTimeout(() => cb(novaVenda), 0); } else { cb(null); }
    }, [vendaAtual]);

    const adicionarItemPeso = (produto, pesoKg, totalCalculado) => {
        setVendaAtual(prev => { 
            if (!prev) return null; 
            const nv = [...prev.itens, { 
                uid: `${produto.id}-peso-${Date.now()}`, 
                id: produto.id, 
                name: `${produto.name} (${pesoKg} Kg)`, 
                price: totalCalculado, 
                quantity: 1, 
                observacao: `Peso: ${pesoKg} Kg`, 
                pesoKg,
                categoriaId: produto.categoriaId || produto.categoria
            }]; 
            return { ...prev, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) }; 
        });
        setProdutoParaPeso(null); 
        inputBuscaRef.current?.focus();
    };

    const adicionarItem = (p, v, vendaRef = null) => {
        setVendaAtual(prev => {
            const target = prev || vendaRef; if (!target) return null;
            const uid = `${p.id}-${v ? v.id : 'p'}`; const ex = target.itens.find(i => i.uid === uid);
            const nv = ex ? target.itens.map(i => i.uid === uid ? { ...i, quantity: i.quantity + 1 } : i) : [...target.itens, { 
                uid, id: p.id, name: v ? `${p.name} - ${v.nome}` : p.name, 
                price: v ? Number(v.preco) : p.price, quantity: 1, observacao: '',
                categoriaId: p.categoriaId || p.categoria,
                ...(v ? { variacaoId: v.id } : {})
            }];
            return { ...target, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) };
        }); 
        setProdutoParaSelecao(null);
        inputBuscaRef.current?.focus();
    };

    const salvarEdicaoItem = (uid, novaQuantidade, novaObservacao) => {
        setVendaAtual(prev => { 
            if (!prev) return null; 
            const nv = prev.itens.map(i => i.uid === uid ? { ...i, quantity: novaQuantidade, observacao: novaObservacao } : i ); 
            return { ...prev, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) }; 
        }); 
        setItemParaEditar(null);
        inputBuscaRef.current?.focus();
    };

    const removerItem = (uid) => setVendaAtual(prev => ({ 
        ...prev, 
        itens: prev.itens.filter(i => i.uid !== uid), 
        total: prev.itens.filter(i => i.uid !== uid).reduce((s, i) => s + (i.price * i.quantity), 0) 
    }));

    // Listener do Scanner Global
    useEffect(() => {
        const onBarcodeRead = (e) => {
            if (e.key.length > 1 && e.key !== 'Enter') return;
            if (e.key === 'Enter' && bufferCodigoBarras.current.length >= 3) {
                const codigo = bufferCodigoBarras.current; bufferCodigoBarras.current = '';
                if (timeoutCodigoBarras.current) clearTimeout(timeoutCodigoBarras.current);
                const state = pdvSyncRef.current; if (state.bloqueado) return;
                const pEncontrado = state.produtos.find(p => String(p.codigoBarras) === codigo || String(p.codigo) === codigo || String(p.referencia) === codigo );
                if (pEncontrado) state.handleProdutoClick(pEncontrado); else { tocarBeepErro(); setBarcodeAviso(`Produto não registado.`); setTimeout(() => setBarcodeAviso(null), 3000); }
                return;
            }
            bufferCodigoBarras.current += e.key;
            if (timeoutCodigoBarras.current) clearTimeout(timeoutCodigoBarras.current);
            timeoutCodigoBarras.current = setTimeout(() => { bufferCodigoBarras.current = ''; }, 50);
        };
        window.addEventListener('keydown', onBarcodeRead); 
        return () => window.removeEventListener('keydown', onBarcodeRead);
    }, []);

    return {
        vendaAtual, setVendaAtual,
        vendasSuspensas, setVendasSuspensas,
        mostrarSuspensas, setMostrarSuspensas,
        descontoValor, setDescontoValor,
        acrescimoValor, setAcrescimoValor,
        pagamentosAdicionados, setPagamentosAdicionados,
        produtoParaSelecao, setProdutoParaSelecao,
        itemParaEditar, setItemParaEditar,
        produtoParaPeso, setProdutoParaPeso,
        iniciarVendaBalcao, suspenderVenda, restaurarVendaSuspensa, excluirVendaSuspensa,
        handleProdutoClick, adicionarItem, adicionarItemPeso, salvarEdicaoItem, removerItem,
        barcodeAviso, pdvSyncRef
    };
}
