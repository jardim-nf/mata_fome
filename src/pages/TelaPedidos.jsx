// src/pages/TelaPedidos.jsx

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, query, where, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import PagamentoModal from '../components/PagamentoModal';


function ItemCard({ item, onAdicionar }) {
  const precoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL'}).format(item.preco);
  return (
    <div className="border rounded-lg p-4 shadow-md flex flex-col text-center bg-white transform hover:scale-105 transition-transform duration-200">
      <img src={item.imageURL || 'https://via.placeholder.com/150'} alt={item.nome} className="w-32 h-32 object-cover rounded-md mb-2 mx-auto"/>
      <div className="flex-grow flex flex-col justify-between">
        <h3 className="font-bold text-md h-14 flex items-center justify-center">{item.nome}</h3>
        <div>
          <p className="font-semibold text-green-600 text-lg">{precoFormatado}</p>
          <button onClick={() => onAdicionar(item)} className="mt-2 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 font-semibold">Adicionar</button>
        </div>
      </div>
    </div>
  );
}

function ResumoPedido({ pedido, total, onAlterarQuantidade, onEnviar, enviando }) {
    const totalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
    return (
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-lg h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4 border-b pb-2">Resumo do Pedido</h2>
            <div className="flex-grow overflow-y-auto">
                {pedido.length === 0 ? ( <p className="text-gray-500 text-center mt-4">Nenhum item adicionado.</p> ) : (
                    <div className="space-y-3">
                        {pedido.map(item => (
                            <div key={item.id} className="border-b pb-2">
                                <p className="font-semibold">{item.nome}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-gray-700">R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => onAlterarQuantidade(item.id, item.quantidade - 1)} className="bg-gray-200 w-6 h-6 rounded-full font-bold">-</button>
                                        <span>{item.quantidade}</span>
                                        <button onClick={() => onAlterarQuantidade(item.id, item.quantidade + 1)} className="bg-gray-200 w-6 h-6 rounded-full font-bold">+</button>
                                        <button onClick={() => onAlterarQuantidade(item.id, 0)} className="text-red-500 hover:text-red-700">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="border-t pt-4 mt-4">
                <div className="flex justify-between font-bold text-xl">
                    <span>Total:</span>
                    <span>{totalFormatado}</span>
                </div>
                <button onClick={onEnviar} disabled={enviando} className="mt-4 w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:bg-gray-400">
                    {enviando ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>
        </div>
    );
}

export default function TelaPedidos() {
  const params = useParams();
  const mesaId = params.mesaId || params.id;
  const navigate = useNavigate();
  const { estabelecimentoId } = useAuth();

  const [menuPorCategoria, setMenuPorCategoria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [pedidoAtual, setPedidoAtual] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [pedidoIdExistente, setPedidoIdExistente] = useState(null);
  const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);
  const [mesaInfo, setMesaInfo] = useState(null);

  useEffect(() => {
    if (!estabelecimentoId || !mesaId) return;
    
    const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
    const unsubscribeMesa = onSnapshot(mesaRef, (doc) => {
        if (doc.exists()) {
            setMesaInfo(doc.data());
        }
    });

    const carregarDadosDaPagina = async () => {
        try {
            setLoading(true);
            const categoriasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
            const categoriasSnapshot = await getDocs(categoriasRef);
            const menuCompleto = [];
            for (const catDoc of categoriasSnapshot.docs) {
                const categoria = { id: catDoc.id, nome: catDoc.data().nome, itens: [] };
                const itensRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', catDoc.id, 'itens');
                const itensSnapshot = await getDocs(itensRef);
                itensSnapshot.forEach(itemDoc => { categoria.itens.push({ id: itemDoc.id, ...itemDoc.data() }); });
                if (categoria.itens.length > 0) menuCompleto.push(categoria);
            }
            setMenuPorCategoria(menuCompleto);
            
            const pedidosQuery = query(collection(db, "pedidos"), where("estabelecimentoId", "==", estabelecimentoId), where("mesaId", "==", mesaId), where("status", "in", ["recebido", "pagamento"]));
            const pedidosSnapshot = await getDocs(pedidosQuery);
            if (!pedidosSnapshot.empty) {
                const pedidoDoc = pedidosSnapshot.docs[0];
                setPedidoIdExistente(pedidoDoc.id);
                setPedidoAtual(pedidoDoc.data().itens || []);
            } else {
                setPedidoAtual([]);
                setPedidoIdExistente(null);
            }
        } catch (err) {
            console.error("Erro ao carregar dados da página:", err);
            setError("Não foi possível carregar os dados.");
        } finally { setLoading(false); }
    };
    carregarDadosDaPagina();
    
    return () => unsubscribeMesa();
  }, [estabelecimentoId, mesaId]);

  const menuFiltrado = useMemo(() => {
    if (!termoBusca) return menuPorCategoria;
    const buscaLowerCase = termoBusca.toLowerCase();
    return menuPorCategoria.map(cat => ({...cat, itens: cat.itens.filter(item => item.nome.toLowerCase().includes(buscaLowerCase))})).filter(cat => cat.itens.length > 0);
  }, [termoBusca, menuPorCategoria]);

  const handleAdicionarItem = (itemAdicionado) => {
    setPedidoAtual(prev => {
      const itemExistente = prev.find(i => i.id === itemAdicionado.id);
      if (itemExistente) { return prev.map(i => i.id === itemAdicionado.id ? { ...i, quantidade: i.quantidade + 1 } : i); }
      return [...prev, { ...itemAdicionado, quantidade: 1 }];
    });
  };

  const handleAlterarQuantidade = (itemId, novaQuantidade) => {
    setPedidoAtual(prev => {
      if (novaQuantidade <= 0) { return prev.filter(i => i.id !== itemId); }
      return prev.map(i => i.id === itemId ? { ...i, quantidade: novaQuantidade } : i);
    });
  };

  const totalPedido = useMemo(() => pedidoAtual.reduce((total, item) => total + (item.preco * item.quantidade), 0), [pedidoAtual]);

  const handleEnviarPedido = async () => {
    if (pedidoAtual.length === 0 && !pedidoIdExistente) { toast.warn("Nenhum item para salvar."); return; }
    setEnviando(true);
    try {
      const itensParaSalvar = pedidoAtual.map(item => ({ id: item.id, nome: item.nome, preco: item.preco, quantidade: item.quantidade }));
      const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
      if (pedidoIdExistente) {
        const pedidoRef = doc(db, 'pedidos', pedidoIdExistente);
        await updateDoc(pedidoRef, { itens: itensParaSalvar, total: totalPedido });
        await updateDoc(mesaRef, { total: totalPedido });
      } else {
        const novoPedido = { estabelecimentoId, mesaId, tipo: 'mesa', itens: itensParaSalvar, total: totalPedido, status: 'recebido', createdAt: serverTimestamp() };
        const pedidoRef = await addDoc(collection(db, 'pedidos'), novoPedido);
        setPedidoIdExistente(pedidoRef.id);
        await updateDoc(mesaRef, { status: 'ocupada', total: totalPedido });
      }
      toast.success("Pedido salvo com sucesso!");
    } catch (err) {
      console.error("Erro ao enviar pedido: ", err);
      toast.error("Falha ao salvar o pedido.");
    } finally {
      setEnviando(false);
    }
  };

  const handlePedirConta = () => {
    if (!pedidoIdExistente) { toast.error("É preciso salvar o pedido antes de pedir a conta."); return; }
    setIsPagamentoModalOpen(true);
  };

  const handleConfirmarPagamento = async (formaDePagamento) => {
    setIsPagamentoModalOpen(false);
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoIdExistente);
      await updateDoc(pedidoRef, { formaPagamento: formaDePagamento });
      const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
      await updateDoc(mesaRef, { status: 'pagamento' });
      toast.success("Status da mesa alterado para 'Pagamento'.");
    } catch (error) {
      console.error("Erro ao confirmar pagamento:", error);
      toast.error("Falha ao processar pagamento.");
    }
  };

  const handleImprimirComprovante = () => {
    if (pedidoIdExistente) {
        window.open(`/imprimir/pedido/${pedidoIdExistente}`, '_blank');
    } else {
        toast.error("Não há pedido salvo para imprimir.");
    }
  };

  const handleLiberarMesa = async () => {
    if (!window.confirm("Isso irá finalizar o pedido e liberar a mesa. Confirma?")) return;
    try {
        if (pedidoIdExistente) {
            const pedidoRef = doc(db, 'pedidos', pedidoIdExistente);
            await updateDoc(pedidoRef, { status: 'finalizado' });
        }
        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
        await updateDoc(mesaRef, { status: 'livre', total: 0 });
        setPedidoAtual([]);
        toast.success("Mesa liberada com sucesso!");
        navigate('/controle-salao');
    } catch (error) {
        console.error("Erro ao liberar mesa:", error);
        toast.error("Falha ao liberar a mesa.");
    }
  };

  if (loading) return <div className="p-4 text-center text-xl">Carregando...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  return (
    <div className="flex h-screen bg-gray-50">
        <div className="flex-grow p-4 overflow-y-auto">
            <button onClick={() => navigate('/controle-salao')} className="mb-4 text-blue-500 hover:underline">&larr; Voltar para o Salão</button>
            <h1 className="text-3xl font-bold mb-4">Lançar Pedidos - Mesa {mesaId}</h1>
            <div className="mb-6 sticky top-0 z-10 bg-gray-50 py-2">
              <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} placeholder="Pesquisar item pelo nome..." className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" />
            </div>
            <div className="space-y-8">
              {(menuFiltrado || []).map(categoria => (
                  <div key={categoria.id}>
                    <h2 className="text-2xl font-bold mb-4 border-b-2 border-blue-500 pb-2">{categoria.nome}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {categoria.itens.map(item => ( <ItemCard key={item.id} item={item} onAdicionar={handleAdicionarItem} /> ))}
                    </div>
                  </div>
              ))}
            </div>
        </div>
        <div className="w-96 p-4 bg-gray-100 border-l h-full sticky top-0 flex flex-col">
            <div className="flex-grow">
                <ResumoPedido pedido={pedidoAtual} total={totalPedido} onAlterarQuantidade={handleAlterarQuantidade} onEnviar={handleEnviarPedido} enviando={enviando} />
            </div>
            <div className="mt-4 space-y-2">
                {mesaInfo?.status === 'ocupada' && (
                    <button onClick={handlePedirConta} disabled={!pedidoIdExistente} className="w-full bg-blue-500 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-600 disabled:bg-gray-400">
                        Pedir a Conta
                    </button>
                )}
                {mesaInfo?.status === 'pagamento' && (
                    <>
                        <button onClick={handleImprimirComprovante} className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold text-lg hover:bg-orange-600">
                            Imprimir Comprovante
                        </button>
                        <button onClick={handleLiberarMesa} className="w-full bg-red-500 text-white py-3 rounded-lg font-bold text-lg hover:bg-red-600">
                            Liberar Mesa (Pagamento OK)
                        </button>
                    </>
                )}
                 {mesaInfo?.status === 'livre' && pedidoAtual.length > 0 && (
                     <p className="text-center text-gray-600">Salve as alterações para abrir a mesa.</p>
                 )}
            </div>
        </div>
        <PagamentoModal 
          isOpen={isPagamentoModalOpen}
          onClose={() => setIsPagamentoModalOpen(false)}
          onConfirm={handleConfirmarPagamento}
        />
    </div>
  );
}