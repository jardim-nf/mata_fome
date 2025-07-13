// src/pages/Painel.jsx
import React, { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebase";
import PedidoCard from "../components/PedidoCard";
import { Link, useSearchParams } from 'react-router-dom';

function Painel() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const audioRef = useRef(null);
  const playedOrderIds = useRef(new Set()); 
  const [isSoundEnabled, setIsSoundEnabled] = useState(false); // NOVO ESTADO: controla se o som está habilitado

  const paramStartDate = searchParams.get('startDate');
  const paramEndDate = searchParams.get('endDate');

  // NOVO: Função para ativar/desativar o som manualmente
  const toggleSound = () => {
    if (audioRef.current) {
      if (!isSoundEnabled) {
        audioRef.current.muted = false; // Garante que não está mutado
        audioRef.current.play().then(() => {
          setIsSoundEnabled(true); // Se tocou, ativa
          console.log("Notificações sonoras ativadas!");
        }).catch(e => {
          console.error("Não foi possível tocar som ao ativar (ainda bloqueado):", e);
          alert("Por favor, clique em qualquer lugar da página para permitir a reprodução automática de áudio e tente ativar novamente.");
        });
      } else {
        setIsSoundEnabled(false); // Desativa
        audioRef.current.pause(); // Pausa se já estiver tocando
        audioRef.current.currentTime = 0; // Reseta para o início
        console.log("Notificações sonoras desativadas.");
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

      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
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


    const unsub = onSnapshot(q, (snapshot) => {
      let novoPedidoChegou = false;

      snapshot.docChanges().forEach((change) => {
        const pedidoData = { id: change.doc.id, ...change.doc.data() };

        if (change.type === "added") {
          if (!playedOrderIds.current.has(pedidoData.id)) {
            novoPedidoChegou = true;
            playedOrderIds.current.add(pedidoData.id);
          }
        }
      });

      const todosPedidosNoSnapshot = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPedidos(todosPedidosNoSnapshot);

      // --- MUDANÇA AQUI: Só toca o som se o usuário já habilitou ---
      if (novoPedidoChegou && isSoundEnabled && audioRef.current) { // Verifica 'isSoundEnabled'
        audioRef.current.muted = false; // Garante que não está mutado
        audioRef.current.play().catch(e => {
          console.error("Erro ao tocar áudio (autoplay bloqueado APÓS ativação ou outro):", e);
          // Este erro só deve aparecer se o navegador bloquear mesmo APÓS o primeiro clique
        });
      }

      setLoading(false);
      console.log(`Painel: ${todosPedidosNoSnapshot.length} pedidos carregados.`);
    }, (error) => {
      console.error("Erro ao carregar pedidos no Painel:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [paramStartDate, paramEndDate, isSoundEnabled]); // Adicionado isSoundEnabled às dependências para reativar o listener se o estado mudar


  const mudarStatus = async (id, novoStatus) => {
    try {
      const ref = doc(db, "pedidos", id);
      await updateDoc(ref, { status: novoStatus });

      const _pedido = pedidos.find((p) => p.id === id);
      const statusFormatado = novoStatus.toLowerCase();

      if (!_pedido?.cliente?.telefone) {
        console.warn("⚠️ Pedido sem telefone do cliente. Não é possível enviar mensagem via WhatsApp.");
        return;
      }

      const numero = _pedido.cliente.telefone.replace(/\D/g, "");
      let mensagem = "";
      let shouldOpenWhatsApp = true; 

      if (statusFormatado === "preparo") {
        mensagem = `Olá ${_pedido.cliente.nome}, seu pedido está em preparo! 👨‍🍳`;
      } else if (statusFormatado === "entregando") {
        mensagem = `Olá ${_pedido.cliente.nome}, seu pedido saiu para entrega! 🛵📦`;
      } else if (statusFormatado === "finalizado") {
        mensagem = `Olá ${_pedido.cliente.nome}, seu pedido foi finalizado com sucesso! ✅ Muito obrigado!`;
      } else {
        shouldOpenWhatsApp = false; 
      }

      if (mensagem && shouldOpenWhatsApp) {
        const texto = encodeURIComponent(mensagem);
        const url = `https://wa.me/55${numero}?text=${texto}`;
        console.log("📤 Abrindo WhatsApp:", url);
        window.open(url, "_blank");
      }
    } catch (error) {
      console.error("❌ Erro ao mudar status ou enviar mensagem:", error);
      alert("Ocorreu um erro ao atualizar o status ou enviar a mensagem.");
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


  return (
    <div className="min-h-screen bg-[var(--bege-claro)] p-4">
      <div className="max-w-7xl mx-auto">
        {/* Botão de Voltar para o Dashboard */}
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

        {/* ELEMENTO DE ÁUDIO ESCONDIDO PARA NOTIFICAÇÕES */}
        <audio ref={audioRef} src="/campainha.mp3" preload="auto" muted /> {/* Adicionado 'muted' */}

        {/* NOVO BOTÃO PARA ATIVAR/DESATIVAR O SOM */}
        <div className="text-center mb-6">
          <button
            onClick={toggleSound}
            className={`px-6 py-2 rounded-lg font-semibold transition duration-300 ${
              isSoundEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
            } text-white`}
          >
            {isSoundEnabled ? '🔊 Desativar Som' : '🔇 Ativar Som'}
          </button>
        </div>

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