import { useCallback, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { tocarBeepErro } from '../utils/audioUtils';
import { usePdvStore } from '../store/usePdvStore';

export function usePdvCart(caixaAberto, inputBuscaRef, showPrompt, showConfirm) {
    const {
        vendaAtual, setVendaAtual,
        vendasSuspensas, setVendasSuspensas,
        mostrarSuspensas, setMostrarSuspensas,
        descontoValor, setDescontoValor,
        acrescimoValor, setAcrescimoValor,
        pagamentosAdicionados, setPagamentosAdicionados,
        produtoParaSelecao, setProdutoParaSelecao,
        itemParaEditar, setItemParaEditar,
        produtoParaPeso, setProdutoParaPeso,
        clienteSelecionado, setClienteSelecionado,
        produtoParaOpcoes, setProdutoParaOpcoes,
        barcodeAviso, setBarcodeAviso,
    } = usePdvStore();

    const bufferCodigoBarras = useRef('');
    const timeoutCodigoBarras = useRef(null);
    
    // Dependência de ref do bloqueio do scanner para usar no listener 
    const pdvSyncRef = useRef({});

    const iniciarVendaBalcao = useCallback((fecharModaisFront = true) => {
        if (!caixaAberto) return;
        setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
        setDescontoValor(''); setAcrescimoValor(''); setPagamentosAdicionados([]);
        setClienteSelecionado(null);
        setProdutoParaOpcoes(null);
        if (fecharModaisFront) {
            setTimeout(() => inputBuscaRef.current?.focus(), 100);
        }
    }, [caixaAberto, inputBuscaRef, setVendaAtual, setDescontoValor, setAcrescimoValor, setPagamentosAdicionados, setClienteSelecionado, setProdutoParaOpcoes]);

    const suspenderVenda = useCallback(() => {
        if (!vendaAtual || vendaAtual.itens.length === 0) return toast.warning("O carrinho está vazio!");
        showPrompt("Nome identificador (Opcional):", (nomeCliente) => {
            const nome = nomeCliente || `Cliente ${vendasSuspensas.length + 1}`;
            setVendasSuspensas(prev => [...prev, { ...vendaAtual, nomeReferencia: nome, dataSuspensao: new Date(), descontoGuardado: descontoValor, acrescimoGuardado: acrescimoValor, pagamentosGuardados: pagamentosAdicionados }]);
            iniciarVendaBalcao();
        }, { title: 'Suspender Venda', placeholder: 'Ex: Mesa 5, João...', submitText: 'Suspender' });
    }, [vendaAtual, vendasSuspensas, iniciarVendaBalcao, descontoValor, acrescimoValor, pagamentosAdicionados, showPrompt, setVendasSuspensas]);

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

    const handleSelectFracaoOption = useCallback((p, option) => {
        setProdutoParaOpcoes(null);
        if (option === 'saco') {
            adicionarItem(p, null, vendaAtual);
        } else if (option === 'fracao') {
            setProdutoParaPeso({
                ...p,
                name: `${p.name} (Varejo/Kg)`,
                price: Number(p.precoKgVarejo || 0),
                isFracao: true
            });
        }
    }, [vendaAtual, setProdutoParaOpcoes, setProdutoParaPeso]);

    const handleProdutoClick = useCallback((p) => {
        const ePeso = p.vendidoPorPeso === true || String(p.fiscal?.unidade || '').trim().toUpperCase() === 'KG' || String(p.unidade || '').trim().toUpperCase() === 'KG';
        const cb = (nova) => { 
            if (p.fracionadoAtivo) {
                setProdutoParaOpcoes(p);
            } else if (ePeso) {
                setProdutoParaPeso(p); 
            } else if (p.temVariacoes) {
                setProdutoParaSelecao(p); 
            } else {
                adicionarItem(p, null, nova); 
            }
        };
        if (!vendaAtual) { const novaVenda = { id: Date.now().toString(), itens: [], total: 0 }; setVendaAtual(novaVenda); setTimeout(() => cb(novaVenda), 0); } else { cb(null); }
    }, [vendaAtual, setVendaAtual, setProdutoParaOpcoes, setProdutoParaPeso, setProdutoParaSelecao]);

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

    const salvarEdicaoItem = (uid, novaQuantidade, novaObservacao, novoNome, novoPreco) => {
        setVendaAtual(prev => { 
            if (!prev) return null; 
            const nv = prev.itens.map(i => i.uid === uid ? { 
                ...i, 
                quantity: novaQuantidade, 
                observacao: novaObservacao,
                name: novoNome !== undefined ? novoNome : i.name,
                price: novoPreco !== undefined ? Number(novoPreco) : i.price
            } : i ); 
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
                
                let codigoBusca = codigo;
                let isEscala = false;
                let codInterno = '';
                let valorOuPesoRaw = 0;

                // Decodifica código de barras de balança (EAN-13 iniciado com '2')
                if (codigo.length === 13 && codigo.startsWith('2')) {
                    isEscala = true;
                    codInterno = codigo.substring(1, 6);
                    valorOuPesoRaw = parseInt(codigo.substring(6, 12), 10);
                    // Procura pelo código interno sem zeros à esquerda
                    codigoBusca = String(parseInt(codInterno, 10));
                }

                const pEncontrado = state.produtos.find(p => 
                    String(p.codigoBarras) === codigo || 
                    String(p.codigo) === codigo || 
                    String(p.referencia) === codigo ||
                    String(p.codigoBarras) === codigoBusca ||
                    String(p.codigo) === codigoBusca ||
                    (isEscala && (String(p.codigo) === codInterno || String(p.codigoBarras) === codInterno))
                );

                if (pEncontrado) {
                    if (isEscala) {
                        const ePeso = pEncontrado.vendidoPorPeso === true || 
                                      String(pEncontrado.fiscal?.unidade || '').trim().toUpperCase() === 'KG' || 
                                      String(pEncontrado.unidade || '').trim().toUpperCase() === 'KG';
                        if (ePeso) {
                            const precoKg = parseFloat(pEncontrado.price || 0);
                            if (precoKg > 0) {
                                const tipoEtiqueta = localStorage.getItem('balanca_tipo_etiqueta') || 'preco'; // 'preco' ou 'peso'
                                let pesoCalculado = 0;
                                let totalCalculado = 0;
                                
                                if (tipoEtiqueta === 'peso') {
                                    pesoCalculado = valorOuPesoRaw / 1000;
                                    totalCalculado = precoKg * pesoCalculado;
                                } else {
                                    totalCalculado = valorOuPesoRaw / 100;
                                    pesoCalculado = totalCalculado / precoKg;
                                }
                                
                                pesoCalculado = Math.round(pesoCalculado * 1000) / 1000;
                                totalCalculado = Math.round(totalCalculado * 100) / 100;

                                if (pesoCalculado > 0) {
                                    const cbPeso = () => {
                                        state.adicionarItemPeso(pEncontrado, pesoCalculado, totalCalculado);
                                    };
                                    if (!vendaAtual) {
                                        const novaVenda = { id: Date.now().toString(), itens: [], total: 0 };
                                        setVendaAtual(novaVenda);
                                        setTimeout(cbPeso, 50);
                                    } else {
                                        cbPeso();
                                    }
                                    return;
                                }
                            }
                        }
                    }
                    state.handleProdutoClick(pEncontrado);
                } else {
                    tocarBeepErro();
                    setBarcodeAviso(`Produto não registrado.`);
                    setTimeout(() => setBarcodeAviso(null), 3000);
                }
                return;
            }
            bufferCodigoBarras.current += e.key;
            if (timeoutCodigoBarras.current) clearTimeout(timeoutCodigoBarras.current);
            timeoutCodigoBarras.current = setTimeout(() => { bufferCodigoBarras.current = ''; }, 50);
        };
        window.addEventListener('keydown', onBarcodeRead); 
        return () => window.removeEventListener('keydown', onBarcodeRead);
    }, [vendaAtual, setVendaAtual, setBarcodeAviso]);

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
        handleProdutoClick, handleSelectFracaoOption, adicionarItem, adicionarItemPeso, salvarEdicaoItem, removerItem,
        barcodeAviso, pdvSyncRef,
        clienteSelecionado, setClienteSelecionado,
        produtoParaOpcoes, setProdutoParaOpcoes
    };
}
