// src/pages/admin/RelatorioLucro.jsx — Relatório de Lucro Real (Receita − Custo)
import React, { useState, useEffect, useMemo } from 'react';
import BackButton from '../../components/BackButton';

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { Link } from 'react-router-dom';
import { subDays } from 'date-fns';
import { IoArrowBack, IoWalletOutline, IoTrendingUpOutline, IoTrendingDownOutline, IoAlertCircleOutline } from 'react-icons/io5';

function RelatorioLucro() {
  const { userData } = useAuth();
  const estabId = userData?.estabelecimentosGerenciados?.[0];
  const [pedidos, setPedidos] = useState([]);  
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(30);

  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      const [pedSnap, prodSnap] = await Promise.all([
        getDocs(collection(db, 'estabelecimentos', estabId, 'pedidos')),
        getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio'))
      ]);
      setPedidos(pedSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => {
        const dt = p.createdAt?.toDate?.() || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return dt && p.status !== 'cancelado';
      }).map(p => ({ ...p, _date: p.createdAt?.toDate?.() || new Date(p.createdAt.seconds * 1000) })));
      setProdutos(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, [estabId]);

  const analise = useMemo(() => {
    if (pedidos.length === 0) return null;
    const agora = new Date();
    const filtrados = pedidos.filter(p => p._date >= subDays(agora, periodo));

    // Mapa de custos
    const custoPorNome = {};
    produtos.forEach(p => { 
        let custoPadrao = Number(p.custo_estimado || p.custo || p.custoUnitario || 0);
        if (custoPadrao === 0 && p.variacoes && p.variacoes.length > 0) {
            custoPadrao = Number(p.variacoes[0].custo || 0);
        }
        custoPorNome[p.nome] = custoPadrao; 
    });

    let receitaTotal = 0;
    let custoTotal = 0;
    const porProduto = {};

    filtrados.forEach(p => {
      receitaTotal += Number(p.totalFinal) || 0;
      (p.itens || []).forEach(item => {
        const nome = item.nome || 'Desconhecido';
        const qtd = Number(item.quantidade || item.qtd) || 1;
        const preco = Number(item.preco) || 0;
        const custo = custoPorNome[nome] || 0;
        const receita = preco * qtd;
        const custoItem = custo * qtd;

        if (!porProduto[nome]) porProduto[nome] = { nome, receita: 0, custo: 0, qtd: 0 };
        porProduto[nome].receita += receita;
        porProduto[nome].custo += custoItem;
        porProduto[nome].qtd += qtd;
        custoTotal += custoItem;
      });
    });

    const lucroTotal = receitaTotal - custoTotal;
    const margemTotal = receitaTotal > 0 ? (lucroTotal / receitaTotal) * 100 : 0;

    const produtosRanked = Object.values(porProduto).map(p => ({
      ...p,
      lucro: p.receita - p.custo,
      margem: p.receita > 0 ? ((p.receita - p.custo) / p.receita) * 100 : 0
    })).sort((a, b) => b.lucro - a.lucro);

    const semCusto = produtosRanked.filter(p => p.custo === 0 && p.qtd > 0);

    return { receitaTotal, custoTotal, lucroTotal, margemTotal, produtosRanked, semCusto, totalPedidos: filtrados.length };
  }, [pedidos, produtos, periodo]);

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 font-sans pb-20">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <BackButton to="/dashboard" />
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><IoWalletOutline className="text-emerald-500" /> Relatório de Lucro</h1>
            <p className="text-xs text-gray-400 font-medium">Receita - Custo = Lucro real por produto</p>
          </div>
        </div>

        {/* Período */}
        <div className="flex gap-2 mb-5">
          {[7, 15, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setPeriodo(d)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${periodo === d ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {d}d
            </button>
          ))}
        </div>

        {!analise ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-bold">Sem dados suficientes</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Receita</p>
                <p className="text-xl font-black text-gray-900">{fmt(analise.receitaTotal)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Custo</p>
                <p className="text-xl font-black text-red-500">{fmt(analise.custoTotal)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Lucro</p>
                <p className={`text-xl font-black ${analise.lucroTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(analise.lucroTotal)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Margem</p>
                <p className={`text-xl font-black flex items-center gap-1 ${analise.margemTotal >= 30 ? 'text-emerald-600' : analise.margemTotal >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                  {analise.margemTotal >= 30 ? <IoTrendingUpOutline /> : <IoTrendingDownOutline />}
                  {analise.margemTotal.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Alerta custo */}
            {analise.semCusto.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                <p className="text-sm text-amber-800 font-bold flex items-center gap-2">
                  <IoAlertCircleOutline className="text-amber-500" /> {analise.semCusto.length} produtos sem custo cadastrado
                </p>
                <p className="text-xs text-amber-600 mt-1">Cadastre o custo no cardápio para um relatório mais preciso. Produtos sem custo: {analise.semCusto.map(p => p.nome).join(', ')}</p>
              </div>
            )}

            {/* Por produto */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-black text-gray-800 mb-4">💰 Lucro por produto ({analise.totalPedidos} pedidos)</h3>
              <div className="space-y-2">
                {analise.produtosRanked.slice(0, 20).map((p, i) => (
                  <div key={p.nome} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i < 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{p.nome}</p>
                      <p className="text-[10px] text-gray-400">{p.qtd}x vendido • Custo: {fmt(p.custo)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${p.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(p.lucro)}</p>
                      <p className={`text-[10px] font-bold ${p.margem >= 30 ? 'text-emerald-500' : p.margem >= 15 ? 'text-amber-500' : 'text-red-500'}`}>{p.margem.toFixed(0)}% margem</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default withEstablishmentAuth(RelatorioLucro);
