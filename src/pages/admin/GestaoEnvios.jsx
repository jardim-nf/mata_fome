import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  IoCubeOutline, IoDocumentTextOutline, IoPrintOutline, 
  IoCheckmarkCircleOutline, IoArrowForwardOutline, IoSyncOutline,
  IoBusOutline, IoArrowBackOutline
} from 'react-icons/io5';
import { vendaService } from '../../services/vendaService';

const STATUS_COLUMNS = [
  { id: 'novo', title: 'Pagamento Aprovado', color: 'bg-blue-500', nextStatus: 'preparando' },
  { id: 'preparando', title: 'Embalagem / Separação', color: 'bg-orange-500', nextStatus: 'pronto' },
  { id: 'pronto', title: 'Pronto para Envio', color: 'bg-purple-500', nextStatus: 'enviado' },
  { id: 'enviado', title: 'Enviado', color: 'bg-emerald-500', nextStatus: 'entregue' },
];

function GestaoEnvios() {
  const { currentUser, estabelecimentoIdPrincipal } = useAuth();
  const estabelecimentoId = estabelecimentoIdPrincipal;
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [loadingAction, setLoadingAction] = useState(null);

  const carregarPedidos = useCallback(async () => {
    if (!estabelecimentoId) return;
    setCarregando(true);
    try {
      const q = query(
        collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos'),
        where('status', 'not-in', ['cancelado', 'recusado'])
      );
      
      const snap = await getDocs(q);
      const lista = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        statusLogistica: d.data().statusLogistica || 'novo'
      }));

      const pedidosAtivos = lista.filter(p => p.statusLogistica !== 'entregue');
      pedidosAtivos.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      setPedidos(pedidosAtivos);
    } catch (error) {
      console.error("Erro ao carregar pedidos para o kanban:", error);
      toast.error("Erro ao carregar os pedidos.");
    } finally {
      setCarregando(false);
    }
  }, [estabelecimentoId]);

  useEffect(() => {
    carregarPedidos();
  }, [carregarPedidos]);

  const avançarStatus = async (pedidoId, novoStatus) => {
    try {
      setLoadingAction(pedidoId);
      const ref = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', pedidoId);
      await updateDoc(ref, {
        statusLogistica: novoStatus,
        updatedAt: new Date()
      });
      
      toast.success(`Pedido movido para a etapa: ${novoStatus}`);
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao avançar status:", error);
      toast.error("Erro ao atualizar o pedido.");
    } finally {
      setLoadingAction(null);
    }
  };

  const emitirNfe = async (pedido) => {
    setLoadingAction(`nfe-${pedido.id}`);
    try {
      let destinatario = null;
      if (pedido.clienteId) {
         const cliSnap = await getDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', pedido.clienteId));
         if (cliSnap.exists()) {
             const c = cliSnap.data();
             destinatario = {
                 cpfCnpj: c.cpf || null,
                 nome: c.nome,
                 inscricaoEstadual: c.inscricaoEstadual || null,
                 indicadorIe: c.indicadorIe || 9,
                 email: c.email || null,
                 telefone: c.telefone || null,
                 endereco: c.endereco || null
             };
         }
      }

      if (!destinatario || !destinatario.cpfCnpj) {
          const cpfDigitado = window.prompt("⚠️ O cliente deste pedido não possui CPF/CNPJ.\n\nPara emitir a NF-e, digite o CPF ou CNPJ (somente números):");
          if (!cpfDigitado) {
              setLoadingAction(null);
              return;
          }
          if (!destinatario) {
              destinatario = {
                  nome: pedido.nomeCliente || 'Consumidor Final'
              };
          }
          destinatario.cpfCnpj = cpfDigitado.replace(/\\D/g, '');
      }

      const frete = {
          modalidade: 1, 
          valor: pedido.taxaEntrega || 0
      };

      const result = await vendaService.emitirNfe(estabelecimentoId, pedido.id, destinatario, frete);
      if (result.sucesso) {
          toast.success("NF-e autorizada com sucesso!");
          carregarPedidos();
      } else {
          toast.error(`Erro na Sefaz: ${result.error}`);
      }
    } catch (error) {
        console.error("Erro ao emitir NFE:", error);
        toast.error("Falha ao comunicar com serviço fiscal.");
    } finally {
        setLoadingAction(null);
    }
  };

  const emitirNfce = async (pedido) => {
    setLoadingAction(`nfce-${pedido.id}`);
    try {
      let cpf = null;
      if (pedido.clienteId) {
         const cliSnap = await getDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', pedido.clienteId));
         if (cliSnap.exists()) {
             cpf = cliSnap.data().cpf || null;
         }
      }
      if (!cpf) {
          const querCpf = window.confirm("Emitir NFC-e (Cupom) COM CPF na nota?\n\n- OK: Sim, quero digitar o CPF.\n- Cancelar: Não, emitir sem CPF (Anônimo).");
          if (querCpf) {
              const cpfDigitado = window.prompt("Digite o CPF (somente números):");
              if (cpfDigitado) {
                  cpf = cpfDigitado.replace(/\\D/g, '');
              }
          }
      }

      const result = await vendaService.emitirNfce(pedido.id, cpf);
      if (result.sucesso) {
          toast.success("NFC-e autorizada com sucesso!");
          carregarPedidos();
      } else {
          toast.error(`Erro na Sefaz: ${result.error}`);
      }
    } catch (error) {
        console.error("Erro ao emitir NFCE:", error);
        toast.error("Falha ao comunicar com serviço fiscal.");
    } finally {
        setLoadingAction(null);
    }
  };

  const baixarDanfe = async (uuid) => {
      setLoadingAction(`pdf-${uuid}`);
      try {
          const res = await vendaService.baixarPdfNfe(uuid);
          if (res.success) {
              toast.success("Download iniciado.");
          } else {
              toast.error("Erro ao baixar DANFE.");
          }
      } finally {
          setLoadingAction(null);
      }
  };

  const baixarDanfeNfce = async (uuid) => {
      setLoadingAction(`pdf-${uuid}`);
      try {
          const res = await vendaService.baixarPdfNfce(uuid);
          if (res.success) {
              toast.success("Download iniciado.");
          } else {
              toast.error("Erro ao baixar DANFE.");
          }
      } finally {
          setLoadingAction(null);
      }
  };

  const sincronizarNotaFiscal = async (pedidoId, chaveAcesso) => {
      setLoadingAction(`sync-${pedidoId}`);
      try {
          const res = await vendaService.sincronizarStatusNfe(estabelecimentoId, pedidoId, chaveAcesso);
          if (res.success) {
              toast.success("Nota Fiscal autorizada pela SEFAZ!");
              carregarPedidos();
          } else if (res.pending) {
              toast.info("A SEFAZ ainda está processando. Tente novamente em instantes.");
          } else {
              toast.error(res.message || res.error || "A nota foi rejeitada ou houve um erro.");
              carregarPedidos(); // Atualiza a tela para sumir o 'Processando'
          }
      } finally {
          setLoadingAction(null);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              title="Voltar"
            >
              <IoArrowBackOutline size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <IoCubeOutline className="text-emerald-500" /> Gestão de Envios
              </h1>
              <p className="text-slate-500 font-medium text-sm mt-1">Acompanhe os pedidos de E-commerce, emita NF-e e Etiquetas de Envio.</p>
            </div>
          </div>
          <button
            onClick={carregarPedidos}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95"
          >
            <IoSyncOutline className={carregando ? "animate-spin" : ""} size={20} />
            Atualizar Kanban
          </button>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="flex overflow-x-auto pb-8 snap-x gap-6">
            {STATUS_COLUMNS.map((coluna) => {
              const pedidosDaColuna = pedidos.filter(p => p.statusLogistica === coluna.id);
              
              return (
                <div key={coluna.id} className="min-w-[320px] w-[320px] bg-slate-100 rounded-3xl p-4 flex flex-col snap-start shrink-0 border border-slate-200 shadow-sm h-fit max-h-[75vh]">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${coluna.color}`}></span>
                      {coluna.title}
                    </h3>
                    <span className="bg-white text-slate-500 font-bold text-xs px-2.5 py-1 rounded-full shadow-sm border border-slate-100">
                      {pedidosDaColuna.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 px-1 custom-scrollbar">
                    {pedidosDaColuna.length === 0 ? (
                      <div className="bg-transparent border border-dashed border-slate-300 rounded-2xl h-24 flex items-center justify-center text-slate-400 text-xs font-bold uppercase">
                        Vazio
                      </div>
                    ) : (
                      pedidosDaColuna.map(pedido => (
                        <div key={pedido.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-400">#{pedido.id.slice(-6).toUpperCase()}</span>
                            <span className="text-emerald-600 font-extrabold text-sm">
                              R$ {(pedido.total || 0).toFixed(2)}
                            </span>
                          </div>
                          
                          <h4 className="font-bold text-slate-800 text-sm mb-1 leading-tight line-clamp-1">{pedido.nomeCliente || 'Cliente Padrão'}</h4>
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-xs text-slate-500 line-clamp-2 flex-1">
                              {pedido.itens ? pedido.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ') : 'Itens...'}
                            </p>
                            {pedido.createdAt && (
                              <span className="text-[10px] text-slate-400 font-medium ml-2 shrink-0">
                                {pedido.createdAt.toDate ? pedido.createdAt.toDate().toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : new Date(pedido.createdAt).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}
                              </span>
                            )}
                          </div>

                          {coluna.id === 'pronto' && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
                              {pedido.fiscal ? (
                                <div className="space-y-2">
                                  {pedido.fiscal.status === 'PROCESSANDO_NFE' ? (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-blue-600 text-[11px] font-black uppercase">
                                        <IoSyncOutline className="animate-spin" size={14} /> {pedido.fiscal.modelo === '65' ? 'NFC-e' : 'NF-e'} Processando
                                      </div>
                                      <button 
                                        onClick={() => sincronizarNotaFiscal(pedido.id, pedido.fiscal.chaveAcesso)}
                                        disabled={loadingAction === `sync-${pedido.id}`}
                                        className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-md font-bold transition-colors"
                                      >
                                        {loadingAction === `sync-${pedido.id}` ? '...' : 'Sincronizar'}
                                      </button>
                                    </div>
                                  ) : pedido.fiscal.status === 'ERRO' ? (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-red-600 text-[11px] font-black uppercase" title={pedido.fiscal.statusSefaz}>
                                        <IoSyncOutline size={14} /> Erro: {String(pedido.fiscal.statusSefaz || '').substring(0, 20)}
                                      </div>
                                      <button 
                                        onClick={() => emitirNfe(pedido)}
                                        className="text-[10px] bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded-md font-bold transition-colors"
                                      >
                                        Reemitir
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-black uppercase">
                                      <IoCheckmarkCircleOutline size={14} /> {pedido.fiscal.modelo === '65' ? 'NFC-e' : 'NF-e'} Emitida ({pedido.fiscal.numero || pedido.fiscal.idBrasilNfe || 'S/N'})
                                    </div>
                                  )}
                                  <div className="flex gap-2 mt-2">
                                    <button 
                                      onClick={() => pedido.fiscal.modelo === '65' ? baixarDanfeNfce(pedido.fiscal.chaveAcesso) : baixarDanfe(pedido.fiscal.chaveAcesso)}
                                      disabled={loadingAction === `pdf-${pedido.fiscal.chaveAcesso}` || !pedido.fiscal.chaveAcesso || pedido.fiscal.status === 'ERRO'}
                                      className={`flex-1 ${pedido.fiscal.chaveAcesso && pedido.fiscal.status !== 'ERRO' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'} text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors`}
                                    >
                                      {loadingAction === `pdf-${pedido.fiscal.chaveAcesso}` ? 'Baixando...' : <><IoPrintOutline size={14}/> DANFE</>}
                                    </button>
                                    <button 
                                      onClick={() => window.open(`/imprimir-etiqueta/${pedido.id}?estabelecimentoId=${estabelecimentoId}`, '_blank')}
                                      className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                                    >
                                      <IoBusOutline size={14} /> Etiqueta
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => emitirNfe(pedido)}
                                    disabled={loadingAction === `nfe-${pedido.id}` || loadingAction === `nfce-${pedido.id}`}
                                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                                    title="NF-e (Requer CPF/CNPJ e Endereço)"
                                  >
                                    {loadingAction === `nfe-${pedido.id}` ? 'Emitindo...' : <><IoDocumentTextOutline size={14} /> NF-e (55)</>}
                                  </button>
                                  <button 
                                    onClick={() => emitirNfce(pedido)}
                                    disabled={loadingAction === `nfe-${pedido.id}` || loadingAction === `nfce-${pedido.id}`}
                                    className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                                    title="NFC-e (Cupom Fiscal)"
                                  >
                                    {loadingAction === `nfce-${pedido.id}` ? 'Emitindo...' : <><IoDocumentTextOutline size={14} /> NFC-e (65)</>}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <button
                            onClick={() => avançarStatus(pedido.id, coluna.nextStatus)}
                            disabled={loadingAction === pedido.id || (coluna.id === 'pronto' && !pedido.fiscal)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors border border-slate-200 group-hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span>
                              {coluna.id === 'pronto' && !pedido.fiscal ? 'Emita a NF-e' : 'Avançar Etapa'}
                            </span>
                            <IoArrowForwardOutline />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default GestaoEnvios;
