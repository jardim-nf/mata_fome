// src/pages/Painel.jsx
import React, { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, query, orderBy, where, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import PedidoCard from "../components/PedidoCard";
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

// Função auxiliar para formatar a data de hoje no formato 'YYYY-MM-DD'
const getTodayFormattedDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function Painel() {
  const [pedidos, setPedidos] = useState([]);
  const [estabelecimentosCache, setEstabelecimentosCache] = useState({}); // Cache para estabelecimentos
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const playedOrderIds = useRef(new Set());
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [showAutoplayWarning, setShowAutoplayWarning] = useState(true);

  const paramStartDate = searchParams.get('startDate');
  const paramEndDate = searchParams.get('endDate');

  const [localStartDate, setLocalStartDate] = useState(paramStartDate || getTodayFormattedDate());
  const [localEndDate, setLocalEndDate] = useState(paramEndDate || getTodayFormattedDate());

  const [showPeriodFilter, setShowPeriodFilter] = useState(false);

  const handleInitialUserGesture = () => {
    if (audioRef.current && !isSoundEnabled && showAutoplayWarning) {
      audioRef.current.muted = true;
      audioRef.current.volume = 0.01;
      
      audioRef.current.play().then(() => {
        setShowAutoplayWarning(false);
        console.log("Gesto de usuário registrado. Áudio desbloqueado (inicialmente mudo).");
      }).catch(e => {
        console.warn("Gesto inicial ainda bloqueado:", e);
      });
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleInitialUserGesture, { once: true });
    return () => {
      document.removeEventListener('click', handleInitialUserGesture);
    };
  }, []);

  const toggleSound = () => {
    if (audioRef.current) {
      if (isSoundEnabled) {
        setIsSoundEnabled(false);
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        console.log("Notificações sonoras desativadas.");
      } else {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.play().then(() => {
          setIsSoundEnabled(true);
          setShowAutoplayWarning(false);
          console.log("Notificações sonoras ativadas por clique no botão!");
        }).catch(e => {
          console.error("Não foi possível tocar som ao ativar (bloqueado mesmo no clique):", e);
          alert("As notificações sonoras ainda estão bloqueadas. Por favor, clique em qualquer lugar da página primeiro e tente 'Ativar Notificações' novamente.");
          setIsSoundEnabled(false);
        });
      }
    }
  };


  useEffect(() => {
    setLoading(true);

    let pedidosQueryRef = collection(db, "pedidos");
    let q;

    if (paramStartDate && paramEndDate) {
      const [startYear, startMonth, startDay] = paramStartDate.split('-').map(Number);
      const startOfDay = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
      const startTimestamp = Timestamp.fromDate(startOfDay);

      const [endYear, endMonth, endDay] = paramEndDate.split('-').map(Number);
      const endOfDay = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
      const endTimestamp = Timestamp.fromDate(endOfDay);
      
      console.log(`Painel: Filtrando de ${startOfDay.toLocaleString()} até ${endOfDay.toLocaleString()}`);

      q = query(
        pedidosQueryRef,
        where('criadoEm', '>=', startTimestamp),
        where('criadoEm', '<=', endTimestamp),
        orderBy('criadoEm', 'desc')
      );
    } else {
      q = query(pedidosQueryRef, orderBy('criadoEm', 'desc'));
      console.log("Painel: Sem filtro de data, buscando todos os pedidos.");
    }

    const unsub = onSnapshot(q, async (snapshot) => { // A função deve ser async para usar await
      let novoPedidoChegou = false;
      const currentPedidosData = []; // Esta vai armazenar o estado completo do snapshot
      const newEstabelecimentosCache = { ...estabelecimentosCache }; // Usar cache para evitar leituras repetidas

      // PRIMEIRO: Processa todas as mudanças para tocar som e atualizar o cache de estabelecimentos
      snapshot.docChanges().forEach((change) => {
        const pedidoData = { id: change.doc.id, ...change.doc.data() };

        if (change.type === "added") {
          if (!playedOrderIds.current.has(pedidoData.id)) {
            novoPedidoChegou = true;
            playedOrderIds.current.add(pedidoData.id);
          }
        }
        // Atualiza cache para itens adicionados/modificados
        if (pedidoData.estabelecimentoId && !newEstabelecimentosCache[pedidoData.estabelecimentoId]) {
            // Se o estabelecimento não está no cache, marca para buscar depois (ou busca aqui se preferir síncrono/lento)
            // Para evitar lentidão com muitos pedidos/estabelecimentos, é melhor buscar assincronamente fora deste loop
            // ou garantir que o cache seja populado de outra forma.
            // Por simplicidade, vamos permitir que ele seja buscado no próximo passo.
        }
      });


      // SEGUNDO: Mapeia todos os documentos no snapshot para o estado, buscando estabelecimentos ausentes
      // Usa Promise.all para buscar estabelecimentos em paralelo, se necessário
      const promises = snapshot.docs.map(async (docSnapshot) => {
        const pedidoData = { id: docSnapshot.id, ...docSnapshot.data() };
        let estabelecimentoInfo = newEstabelecimentosCache[pedidoData.estabelecimentoId];

        // Se o estabelecimento não está no cache, busca no Firestore
        if (!estabelecimentoInfo && pedidoData.estabelecimentoId) {
          try {
            const estabDocRef = doc(db, 'estabelecimentos', pedidoData.estabelecimentoId);
            const estabDocSnap = await getDoc(estabDocRef); // <-- await aqui
            if (estabDocSnap.exists()) {
              estabelecimentoInfo = estabDocSnap.data();
              newEstabelecimentosCache[pedidoData.estabelecimentoId] = estabelecimentoInfo;
            } else {
              console.warn(`Estabelecimento ${pedidoData.estabelecimentoId} não encontrado.`);
            }
          } catch (err) {
            console.error(`Erro ao buscar estabelecimento ${pedidoData.estabelecimentoId}:`, err);
          }
        }
        return { ...pedidoData, estabelecimento: estabelecimentoInfo };
      });

      // Aguarda todas as buscas de estabelecimento serem concluídas
      const todosPedidosComEstabelecimento = await Promise.all(promises);

      // Atualiza o cache de estabelecimentos (agora com novos estabelecimentos que foram buscados)
      setEstabelecimentosCache(newEstabelecimentosCache);

      // Ordena os pedidos (do mais novo para o mais velho)
      const sortedPedidos = todosPedidosComEstabelecimento.sort((a, b) => {
        const dataA = a.criadoEm && typeof a.criadoEm.toDate === 'function' ? a.criadoEm.toDate() : new Date(0);
        const dataB = b.criadoEm && typeof b.criadoEm.toDate === 'function' ? b.criadoEm.toDate() : new Date(0);
        return dataB - dataA;
      });

      setPedidos(sortedPedidos);

      if (novoPedidoChegou && isSoundEnabled && audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.play().catch(e => {
          console.error("Erro ao tocar áudio (autoplay bloqueado APÓS ativação):", e);
        });
      }

      setLoading(false);
      console.log(`Painel: ${sortedPedidos.length} pedidos carregados.`);
    }, (error) => {
      console.error("Erro ao carregar pedidos no Painel:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [paramStartDate, paramEndDate, isSoundEnabled]); // Dependências


  const mudarStatus = async (id, novoStatus) => {
    try {
      const ref = doc(db, "pedidos", id);
      await updateDoc(ref, { status: novoStatus });

      // IMPORTANTE: Não precisamos mais buscar o pedido aqui, pois o onSnapshot vai atualizar o estado
      // _pedido = pedidos.find((p) => p.id === id); // Esta linha pode ser removida ou adaptada
      // A lógica de WhatsApp agora está no PedidoCard, que já tem acesso ao 'pedido' completo.

      // Apenas para fins de depuração ou lógica que precise do pedido atual IMEDIATAMENTE
      // const updatedPedido = pedidos.find(p => p.id === id); 
      // if (!updatedPedido) {
      //   console.warn("Pedido não encontrado no estado local após atualização do status.");
      //   return; 
      // }

      // Como o onSnapshot vai reagir à mudança no DB, não há necessidade de enviar WhatsApp aqui.
      // A lógica de envio de WhatsApp foi movida para o PedidoCard.
      // O 'mudarStatus' do Painel agora só atualiza o DB e o listener cuida da UI.

    } catch (error) {
      console.error("❌ Erro ao mudar status:", error);
      alert("Ocorreu um erro ao atualizar o status do pedido.");
    }
  };

  const excluirPedido = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.")) {
      try {
        const ref = doc(db, "pedidos", id);
        await deleteDoc(ref);
        alert("✅ Pedido excluído com sucesso!");
      } catch (error) {
        console.error("❌ Erro ao excluir pedido:", error);
        alert("Ocorreu um erro ao excluir o pedido. Por favor, tente novamente.");
      }
    }
  };


  const colunas = [
    { titulo: "Recebido", status: "recebido" },
    { titulo: "Em Preparo", status: "preparo" },
    { titulo: "Saiu p/ Entrega", status: "entregando" },
    { titulo: "Finalizado", status: "finalizado" },
  ];

  const pedidosFinalizadosExibidos = pedidos.filter((p) => p.status?.toLowerCase() === "finalizado");
  const countFinalizados = pedidosFinalizadosExibidos.length;


  const handleApplyFilter = () => {
    navigate(`/painel?startDate=${localStartDate}&endDate=${localEndDate}`);
  };


  return (
    <div className="min-h-screen bg-[var(--bege-claro)] p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 text-left">
          <Link
            to="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-gray-200 text-[var(--marrom-escuro)] rounded-lg font-semibold hover:bg-gray-300 transition duration-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 0 010-1.414l4-4a1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Voltar para o Dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-6">
          Painel de Pedidos
        </h1>

        <audio ref={audioRef} src="/campainha.mp3" preload="auto" />

        <div className="text-center mb-6">
          {showAutoplayWarning && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
              <p className="font-bold">Atenção!</p>
              <p>O navegador bloqueia o som automático. Clique em qualquer lugar na página e depois em "Ativar Notificações" para ouvir.</p>
            </div>
          )}
          <button
            onClick={toggleSound}
            className={`px-6 py-2 rounded-lg font-semibold transition duration-300 ${
              isSoundEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
            } text-white`}
          >
            {isSoundEnabled ? '🔊 Notificações Ativadas' : '🔇 Ativar Notificações'}
          </button>
        </div>

        <div className="text-center mb-6">
            <button
                onClick={() => setShowPeriodFilter(!showPeriodFilter)}
                className="bg-gray-200 text-[var(--marrom-escuro)] px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition duration-300"
            >
                {showPeriodFilter ? 'Esconder Filtro de Período' : 'Filtrar por Período Específico'}
            </button>
        </div>

        {showPeriodFilter && (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-center justify-center gap-4">
                <label htmlFor="startDate" className="text-[var(--marrom-escuro)] font-medium">De:</label>
                <input
                    type="date"
                    id="startDate"
                    value={localStartDate}
                    onChange={(e) => setLocalStartDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                />

                <label htmlFor="endDate" className="text-[var(--marrom-escuro)] font-medium">Até:</label>
                <input
                    type="date"
                    id="endDate"
                    value={localEndDate}
                    onChange={(e) => setLocalEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                />

                <button
                    onClick={handleApplyFilter}
                    className="bg-[var(--vermelho-principal)] text-white px-5 py-2 rounded-lg font-semibold hover:bg-red-700 transition duration-300"
                >
                    Aplicar Filtro
                </button>
            </div>
        )}


        {loading ? (
            <p className="text-center text-[var(--cinza-texto)] text-lg mt-8">Carregando pedidos...</p>
        ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {colunas.map((coluna) => (
                <div key={coluna.status} className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-center mb-4 text-[var(--marrom-escuro)]">
                    {coluna.titulo}
                </h2>
                <div className="flex flex-col gap-4">
                    {coluna.status === "finalizado" ? (
                    <div className="text-center py-8">
                        <p className="text-6xl font-extrabold text-[var(--verde-destaque)] mb-4">{countFinalizados}</p>
                        <p className="text-xl text-[var(--cinza-texto)]">Pedidos Finalizados</p>
                    </div>
                    ) : (
                    <>
                        {pedidos
                        .filter(
                            (p) =>
                            p.status?.toLowerCase() === coluna.status.toLowerCase()
                        )
                        .sort((a, b) => {
                            const dataA = a.criadoEm && typeof a.criadoEm.toDate === 'function' ? a.criadoEm.toDate() : new Date(0);
                            const dataB = b.criadoEm && typeof b.criadoEm.toDate === 'function' ? b.criadoEm.toDate() : new Date(0);
                            return dataA - dataB;
                        })
                        .map((pedido) => {
                            const totalDoPedido = pedido.itens ? pedido.itens.reduce((sum, item) => sum + (item.preco * item.quantidade), 0) : 0;
                            
                            return (
                            <PedidoCard
                                key={pedido.id}
                                pedido={pedido}
                                mudarStatus={mudarStatus}
                                excluirPedido={excluirPedido}
                                total={totalDoPedido}
                                // NOVO: Passando o estabelecimento completo para o PedidoCard
                                estabelecimento={pedido.estabelecimento}
                                estabelecimentoPixKey={pedido.estabelecimento?.chavePix || ''}
                            />
                            );
                        })}
                        {pedidos.filter((p) => p.status?.toLowerCase() === coluna.status.toLowerCase()).length === 0 && (
                        <p className="text-gray-500 text-center italic">Nenhum pedido nesta coluna.</p>
                        )}
                    </>
                    )}
                </div>
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
}

export default Painel;