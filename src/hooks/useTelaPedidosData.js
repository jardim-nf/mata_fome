import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { 
    doc, getDoc, collection, getDocs, onSnapshot, updateDoc, 
    serverTimestamp, writeBatch, addDoc 
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { estoqueService } from '../services/estoqueService';

const normalizarTexto = (texto) => {
    if (!texto) return '';
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

export function useTelaPedidosData(estabelecimentoId, mesaId, userData, user) {
    const navigate = useNavigate();

    // Estados do Banco e Estrutura
    const [loading, setLoading] = useState(true);
    const [mesa, setMesa] = useState(null);
    const [cardapio, setCardapio] = useState([]);
    const [categorias, setCategorias] = useState(['Todos']);
    const [coresEstabelecimento, setCoresEstabelecimento] = useState({
        primaria: '#111827', destaque: '#059669', background: '#f9fafb', texto: { principal: '#111827' }
    });
    const [ordemCategorias, setOrdemCategorias] = useState([]);
    const [senhaMasterEstabelecimento, setSenhaMasterEstabelecimento] = useState('');

    // Estados Voláteis (Controlados pelo Banco em tempo real e UI)
    const [resumoPedido, setResumoPedido] = useState([]);
    const [ocupantes, setOcupantes] = useState(['Mesa']);
    const [clienteSelecionado, setClienteSelecionado] = useState('Mesa');
    
    const [termoBusca, setTermoBusca] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
    const [salvando, setSalvando] = useState(false);
    const [pedidoRecemEnviadoId, setPedidoRecemEnviadoId] = useState(null);

    // Carga Pesada Principal: Cardápio
    useEffect(() => {
        if (!estabelecimentoId) return;

        const carregarConfigECardapio = async () => {
            setLoading(true);
            try {
                const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
                const estabSnap = await getDoc(estabRef);
                if (estabSnap.exists()) {
                    const dados = estabSnap.data();
                    if (dados.cores) setCoresEstabelecimento(prev => ({ ...prev, ...dados.cores }));
                    if (dados.ordemCategorias) setOrdemCategorias(dados.ordemCategorias);
                    if (dados.senhaMaster) setSenhaMasterEstabelecimento(String(dados.senhaMaster));
                }

                const categoriasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
                const categoriasSnap = await getDocs(categoriasRef);

                let listaCats = ['Todos'];
                const catsAtivas = [];
                categoriasSnap.docs.forEach(cDoc => {
                    if (cDoc.data().ativo !== false) {
                        const nome = cDoc.data().nome || cDoc.id;
                        listaCats.push(nome);
                        catsAtivas.push({ id: cDoc.id, nome });
                    }
                });

                const promessasItens = catsAtivas.map(cat => {
                    const p1 = getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', cat.id, 'itens')).then(s => ({snap: s, tipo: 'itens', cat}));
                    const p2 = getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', cat.id, 'produtos')).then(s => ({snap: s, tipo: 'produtos', cat}));
                    return [p1, p2];
                }).flat();

                const resultadosBuscas = await Promise.all(promessasItens);
                let produtosFinaisBrutos = [];

                for (const res of resultadosBuscas) {
                    for (const docItem of res.snap.docs) {
                        const dados = docItem.data();
                        if (dados.ativo === false) continue;

                        produtosFinaisBrutos.push({
                            ...dados,
                            id: docItem.id,
                            categoria: res.cat.nome,
                            categoriaId: res.cat.id,
                            tipoColecao: res.tipo 
                        });
                    }
                }

                setCardapio(produtosFinaisBrutos);
                setCategorias([...new Set(listaCats)]);

            } catch (error) {
                console.error("Erro ao carregar cardápio:", error);
            } finally {
                setLoading(false);
            }
        };

        carregarConfigECardapio();
    }, [estabelecimentoId]);

    // Listener de Tempo Real: Mesa
    useEffect(() => {
        if (!estabelecimentoId || !mesaId) return;
        
        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
        const unsubscribe = onSnapshot(mesaRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMesa({ id: docSnap.id, ...data });
                if (data.itens) setResumoPedido(data.itens);
                
                if (data.nomesOcupantes && data.nomesOcupantes.length > 0) {
                    setOcupantes(data.nomesOcupantes);
                    setClienteSelecionado(prev => data.nomesOcupantes.includes(prev) ? prev : (data.nomesOcupantes[0] || 'Mesa'));
                } else {
                    setOcupantes(['Mesa']);
                }
            } else {
                navigate('/controle-salao');
            }
        });
        
        return () => unsubscribe();
    }, [estabelecimentoId, mesaId, navigate]);

    // ==========================================
    // MÉTODOS DE NEGÓCIO E COMPUTAÇÃO (MIGRADOS)
    // ==========================================

    const enrichWithGlobalAdicionais = useCallback((item) => {
        const termosAdicionais = ['adicionais', 'adicional', 'extra', 'extras', 'complemento', 'complementos', 'acrescimo', 'acrescimos', 'molho', 'molhos', 'opcoes', 'opções'];
        const categoriaItemNorm = normalizarTexto(item.categoria || '');
        const categoriaIdNorm = normalizarTexto(item.categoriaId || '');
        
        if (termosAdicionais.some(t => categoriaItemNorm.includes(t))) return item;

        const categoriasComAdicionais = [
            'classico', 'classicos', 'clássico', 'clássicos', 'os-classicos', 'os classicos',
            'novato', 'novatos', 'os-novatos', 'os novatos',
            'queridinho', 'queridinhos', 'os-queridinhos', 'os queridinhos',
            'grande', 'grandes', 'grandes-fomes', 'grandes fomes',
            'hamburguer', 'hamburgueres', 'hambúrguer', 'hambúrgueres', 'burger', 'burgers',
            'artesanal', 'artesanais', 'smash', 'gourmet'
        ];

        const permitido = categoriasComAdicionais.some(cat => 
            categoriaItemNorm.includes(cat) || categoriaIdNorm.includes(cat)
        );

        if (!permitido) return item;

        const globais = cardapio.filter(p => {
            const cat = normalizarTexto(p.categoria || '');
            return termosAdicionais.some(termo => cat.includes(termo));
        });

        const idsExistentes = new Set((item.adicionais || []).map(a => a.id));
        const globaisFiltrados = globais.filter(g => !idsExistentes.has(g.id));

        return { ...item, adicionais: [...(item.adicionais || []), ...globaisFiltrados] };
    }, [cardapio]);

    const categoriasOrdenadas = useMemo(() => {
        return [...categorias].sort((a, b) => {
            if (a === 'Todos') return -1;
            if (b === 'Todos') return 1;
            if (!ordemCategorias.length) return a.localeCompare(b);
            const idxA = ordemCategorias.indexOf(a), idxB = ordemCategorias.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [categorias, ordemCategorias]);

    const produtosFiltrados = useMemo(() => {
        return cardapio.filter(p =>
            (!termoBusca || p.nome.toLowerCase().includes(termoBusca.toLowerCase())) &&
            (categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva)
        );
    }, [cardapio, termoBusca, categoriaAtiva]);

    const quantidadesNoCarrinho = useMemo(() => {
        const mapa = {};
        resumoPedido.forEach(item => {
            if (item.status === 'cancelado') return;
            const idOrig = item.produtoIdOriginal;
            if (idOrig) {
                if (!mapa[idOrig]) mapa[idOrig] = 0;
                mapa[idOrig] += item.quantidade;
            }
        });
        return mapa;
    }, [resumoPedido]);

    const itensAgrupados = useMemo(() => {
        return resumoPedido.reduce((acc, item) => {
            const k = item.cliente || 'Mesa';
            if (!acc[k]) acc[k] = []; acc[k].push(item); return acc;
        }, {});
    }, [resumoPedido]);

    const totalGeral = useMemo(() => {
        return resumoPedido.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
    }, [resumoPedido]);

    const totalItens = useMemo(() => {
        return resumoPedido.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + i.quantidade, 0);
    }, [resumoPedido]);

    const temItensPendentes = useMemo(() => {
        return resumoPedido.some(i => (!i.status || i.status === 'pendente') && i.status !== 'cancelado');
    }, [resumoPedido]);

    // Função interna para checar subcoleções e enriquecer
    const prepararProdutoParaSelecao = async (prod) => {
        let itemAtualizado = { ...prod };
        const precisaBuscarAdicionais = itemAtualizado.adicionais === undefined;
        const precisaBuscarVariacoes = itemAtualizado.variacoes === undefined;

        if (precisaBuscarAdicionais || precisaBuscarVariacoes) {
            const toastId = toast.loading("Carregando opções...", { autoClose: false });
            try {
                if (precisaBuscarAdicionais) {
                    const adicsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', prod.categoriaId, prod.tipoColecao, prod.id, 'adicionais'));
                    itemAtualizado.adicionais = adicsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                }
                if (precisaBuscarVariacoes) {
                    const varsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', prod.categoriaId, prod.tipoColecao, prod.id, 'variacoes'));
                    itemAtualizado.variacoes = varsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                }
                
                setCardapio(prev => prev.map(p => p.id === prod.id ? itemAtualizado : p));
                toast.dismiss(toastId);
            } catch (e) {
                console.error("Erro ao buscar subcoleções:", e);
                toast.dismiss(toastId);
            }
        }

        const itemEnriquecido = enrichWithGlobalAdicionais(itemAtualizado);
        const temOpcoes = (itemEnriquecido.opcoes && itemEnriquecido.opcoes.length > 0) || 
                          (itemEnriquecido.variacoes && itemEnriquecido.variacoes.length > 0) || 
                          (itemEnriquecido.tamanhos && itemEnriquecido.tamanhos.length > 0) || 
                          (itemEnriquecido.adicionais && itemEnriquecido.adicionais.length > 0);

        return { itemEnriquecido, itemAtualizado, temOpcoes };
    };

    const confirmarAdicaoAoCarrinho = async (itemConfig) => {
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        const { nome, variacaoSelecionada, observacao, precoFinal, adicionaisSelecionados, ...restoDoItem } = itemConfig;
        
        let nomeFinal = nome;
        if (variacaoSelecionada) nomeFinal += ` - ${variacaoSelecionada.nome}`;
        
        const temAdicionais = adicionaisSelecionados && adicionaisSelecionados.length > 0;
        const listaFinalAdicionais = temAdicionais ? adicionaisSelecionados : [];

        if (temAdicionais) {
             const nomesAdics = listaFinalAdicionais.map(a => a.nome).join(', ');
             nomeFinal += ` (+ ${nomesAdics})`;
        }

        const nomeGarcom = userData?.nome || user?.displayName || "Garçom";
        const novaLista = [...resumoPedido];
        
        const indexExistente = novaLista.findIndex(i => {
            const adicsAtuais = i.adicionaisSelecionados || [];
            const adicsNovos = listaFinalAdicionais;
            const mesmaQtd = adicsAtuais.length === adicsNovos.length;
            const mesmosAdics = mesmaQtd && adicsAtuais.every(a => adicsNovos.some(b => b.nome === a.nome));

            return i.produtoIdOriginal === itemConfig.id && 
                   i.nome === nomeFinal &&
                   i.observacao === (observacao || '') &&
                   i.cliente === clienteSelecionado &&
                   (!i.status || i.status === 'pendente') &&
                   i.status !== 'cancelado' &&
                   mesmosAdics;
        });

        const toastConfigNinja = {
            position: "top-center", 
            autoClose: 800,         
            hideProgressBar: true,  
            closeButton: false,     
            theme: "dark",          
            style: { 
                borderRadius: '50px', 
                minHeight: '40px', 
                padding: '8px 20px', 
                fontWeight: '900', 
                fontSize: '13px', 
                textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }
        };

        if (indexExistente >= 0) {
            novaLista[indexExistente].quantidade += 1;
            novaLista[indexExistente].adicionadoPor = nomeGarcom;
            toast.success(`+1 ${nomeFinal}`, toastConfigNinja);
        } else {
            const novoItem = {
                ...restoDoItem,
                id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
                produtoIdOriginal: itemConfig.id, 
                categoriaId: itemConfig.categoriaId,
                categoria: itemConfig.categoria || '', 
                nome: nomeFinal, 
                preco: precoFinal,
                observacao: observacao || '', 
                quantidade: 1, 
                cliente: clienteSelecionado,
                adicionadoEm: new Date(), 
                status: 'pendente',
                adicionadoPor: nomeGarcom,
                adicionaisSelecionados: listaFinalAdicionais,
                adicionais: listaFinalAdicionais, 
                variacaoSelecionada: variacaoSelecionada || null
            };
            novaLista.push(novoItem);
            toast.success(`Adicionado: ${nomeFinal}`, toastConfigNinja);
        }

        setResumoPedido(novaLista);

        try {
            const novoTotal = novaLista.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                itens: novaLista,
                total: novoTotal,
                updatedAt: serverTimestamp()
            });
        } catch(e) { console.error(e); }
    };

    const confirmarNovaPessoa = async (novoNomeTemp) => {
        if (!novoNomeTemp.trim()) return false;
        const novoNome = novoNomeTemp.trim();
        const novosOcupantes = [...ocupantes, novoNome];
        setOcupantes(novosOcupantes); 
        setClienteSelecionado(novoNome); 
        await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { nomesOcupantes: novosOcupantes });
        return true;
    };

    const salvarEdicaoPessoa = async (index, novoNomeTemp) => {
        if (!novoNomeTemp.trim()) return false;
        const nomeAntigo = ocupantes[index];
        const novoNome = novoNomeTemp.trim();
        if (nomeAntigo === novoNome) return false;
        
        const novosOcupantes = [...ocupantes];
        novosOcupantes[index] = novoNome;
        setOcupantes(novosOcupantes);
        
        if (clienteSelecionado === nomeAntigo) setClienteSelecionado(novoNome);
        
        const novosItens = resumoPedido.map(i => (i.cliente === nomeAntigo ? { ...i, cliente: novoNome } : i));
        setResumoPedido(novosItens);
        
        await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
            nomesOcupantes: novosOcupantes, 
            itens: novosItens 
        });
        return true;
    };

    const confirmarExclusao = async (itemParaExcluir, qtdExcluir, senhaDigitada) => {
        if(senhaMasterEstabelecimento && senhaDigitada !== senhaMasterEstabelecimento) {
            toast.error("Senha errada");
            return false;
        }
        
        const qtdAtual = itemParaExcluir.quantidade || 1;
        const qtdRemover = Math.min(qtdExcluir, qtdAtual);
        const cancelaInteiro = qtdRemover >= qtdAtual;

        let novaLista;
        if (cancelaInteiro) {
            novaLista = resumoPedido.map(i => 
                i.id === itemParaExcluir.id ? { ...i, status: 'cancelado' } : i
            );
        } else {
            novaLista = resumoPedido.map(i => 
                i.id === itemParaExcluir.id ? { ...i, quantidade: qtdAtual - qtdRemover } : i
            );
        }
        
        const novoTotal = novaLista.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
        
        await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
            itens: novaLista, 
            total: novoTotal 
        });

        // Grava Logo de Auditoria
        try {
            const logsRef = collection(db, 'estabelecimentos', estabelecimentoId, 'auditLogs');
            await addDoc(logsRef, {
                tipo: 'cancelamento_item',
                mesaNumero: mesa?.numero || 'N/A',
                item: {
                    nome: `${itemParaExcluir.nome || itemParaExcluir.name || 'Item'} – ${itemParaExcluir.variacao || itemParaExcluir.opcaoSelecionada || 'Único'}`,
                    quantidade: qtdRemover,
                    precoUnitario: itemParaExcluir.preco || 0,
                    observacao: itemParaExcluir.observacao || null
                },
                valorTotalCancelado: (itemParaExcluir.preco || 0) * qtdRemover,
                data: serverTimestamp()
            });
        } catch (e) {
            console.error('[AUDIT] Erro ao gravar log de cancelamento:', e);
        }
        
        toast.info(cancelaInteiro ? "Item cancelado com sucesso!" : `${qtdRemover}x removido(s) com sucesso!`);
        return true;
    };

    const ajustarQuantidade = async (id, qtd) => {
        if (navigator.vibrate) navigator.vibrate(20);
        const novaLista = resumoPedido.map(i => i.id === id ? { ...i, quantidade: qtd } : i).filter(i => i.quantidade > 0);
        setResumoPedido(novaLista);
        
        const novoTotal = novaLista.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
        await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
            itens: novaLista, 
            total: novoTotal 
        });
    };

    const dispararImpressao = async (setor, onSucesso = () => {}) => {
        const toastId = toast.loading("Enviando sinal para o Caixa...");
        try {
            if (pedidoRecemEnviadoId) {
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', pedidoRecemEnviadoId), {
                    solicitarImpressao: true,
                    setorImpressao: setor || 'tudo'
                });
            } else {
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), {
                    solicitarImpressaoConferencia: true,
                    setorImpressao: setor || 'tudo'
                });
            }
            toast.update(toastId, { render: `Impressão enviada com sucesso! ${setor ? `(${setor})` : ''}`, type: "success", isLoading: false, autoClose: 2000 });
            onSucesso();
        } catch (error) {
            toast.update(toastId, { render: "Erro ao comunicar com o Caixa.", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const salvarAlteracoes = async () => {
        setSalvando(true);
        try {
            const itensNovos = resumoPedido.filter(i => (!i.status || i.status === 'pendente') && i.status !== 'cancelado');
            const novoTotalMesa = resumoPedido.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
            
            const batch = writeBatch(db);
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            
            let idPedidoGerado = null;

            if(itensNovos.length > 0) {
                idPedidoGerado = `pedido_${mesaId}_${Date.now()}`;
                const pedidoRef = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', idPedidoGerado);
                
                batch.set(pedidoRef, {
                    id: idPedidoGerado, 
                    mesaId: mesaId, 
                    mesaNumero: mesa?.numero || 'Sem Número',
                    clienteNome: `Mesa ${mesa?.numero}`,
                    tipo: 'mesa',
                    itens: itensNovos.map(i => ({...i, status: 'recebido'})), 
                    status: 'recebido', 
                    total: itensNovos.reduce((a,i) => a + (i.preco * i.quantidade), 0), 
                    dataPedido: serverTimestamp(), 
                    createdAt: serverTimestamp(), 
                    source: 'salao'
                });

                const todosItensAtualizados = resumoPedido.map(i => {
                    if ((!i.status || i.status === 'pendente') && i.status !== 'cancelado') {
                        return { ...i, status: 'enviado', pedidoCozinhaId: idPedidoGerado, _estoqueBaixado: true };
                    }
                    return i;
                });
                
                batch.update(mesaRef, { 
                    itens: todosItensAtualizados, 
                    status: 'ocupada', 
                    total: novoTotalMesa, 
                    updatedAt: serverTimestamp() 
                });
                
                // 🔧 BAIXA DE ESTOQUE: A mesa é considerada uma venda contínua, então damos baixa no estoque *na hora* de pedir.
                try {
                    await estoqueService.darBaixaEstoque(estabelecimentoId, itensNovos);
                } catch (e) {
                    console.error("Erro interno ao dar baixa de estoque na Mesa:", e);
                }

            } else {
                batch.update(mesaRef, { 
                    itens: resumoPedido, 
                    total: novoTotalMesa, 
                    updatedAt: serverTimestamp() 
                });
            }

            await batch.commit();
            toast.success("Pedido confirmado com sucesso!", { position: "top-center", autoClose: 2000, theme: "colored" });
            
            if (idPedidoGerado) {
                setPedidoRecemEnviadoId(idPedidoGerado);
            }

        } catch(error) { 
            console.error("Erro fatal ao salvar pedido:", error); 
            toast.error("Erro na internet! Tente novamente.", { position: "top-center", theme: "colored", autoClose: 4000 }); 
        } finally { 
            setSalvando(false); 
        }
    };

    return {
        // Variáveis de Estado Principal
        loading,
        mesa,
        categoriasOrdenadas,
        produtosFiltrados,
        coresEstabelecimento,
        senhaMasterEstabelecimento,
        
        // Estados Voláteis (Carrinho / Busca)
        resumoPedido,
        quantidadesNoCarrinho,
        itensAgrupados,
        totalGeral,
        totalItens,
        temItensPendentes,
        ocupantes,
        clienteSelecionado, setClienteSelecionado,
        termoBusca, setTermoBusca,
        categoriaAtiva, setCategoriaAtiva,
        salvando,
        pedidoRecemEnviadoId,
        
        // Funções de Negócio Embutidas
        prepararProdutoParaSelecao,
        confirmarAdicaoAoCarrinho,
        confirmarNovaPessoa,
        salvarEdicaoPessoa,
        confirmarExclusao,
        ajustarQuantidade,
        dispararImpressao,
        salvarAlteracoes
    };
}
