// src/pages/AdminSettings.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  IoSave, 
  IoLockClosed, 
  IoTime, 
  IoGameController, 
  IoCalendarOutline, 
  IoWalletOutline, 
  IoCheckmarkCircle,
  IoPrintOutline,
  IoBanOutline,
  IoShareSocialOutline
} from 'react-icons/io5'; 
import { SiMercadopago } from 'react-icons/si';

const diasDaSemana = [
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' }
];

const AdminSettings = () => {
  const { primeiroEstabelecimento } = useAuth(); 
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vinculando, setVinculando] = useState(false);

  // Estados do Formulário Gerais
  const [senhaMaster, setSenhaMaster] = useState('');
  const [tempoMinimo, setTempoMinimo] = useState('');
  const [tempoMaximo, setTempoMaximo] = useState('');
  const [valorMinimoRaspadinha, setValorMinimoRaspadinha] = useState('9999');
  
  // Estado para os Horários
  const [horarios, setHorarios] = useState({
    segunda: { ativo: true, abertura: '18:00', fechamento: '23:30' },
    terca:   { ativo: true, abertura: '18:00', fechamento: '23:30' },
    quarta:  { ativo: true, abertura: '18:00', fechamento: '23:30' },
    quinta:  { ativo: true, abertura: '18:00', fechamento: '23:30' },
    sexta:   { ativo: true, abertura: '18:00', fechamento: '23:30' },
    sabado:  { ativo: true, abertura: '18:00', fechamento: '23:30' },
    domingo: { ativo: true, abertura: '18:00', fechamento: '23:30' },
  });

  // Novos Estados: Impressão e Categorias (QZ TRAY)
  const [categorias, setCategorias] = useState([]);
  const [roteamentoImpressao, setRoteamentoImpressao] = useState({});
  const [impressoraBalcao, setImpressoraBalcao] = useState('');
  const [impressoraCozinha, setImpressoraCozinha] = useState('');

  // Estado Mercado Pago
  const [mpConectado, setMpConectado] = useState(false);

  // Opt-out
  const [optoutMensagem, setOptoutMensagem] = useState('SAIR');

  // Indicação de Clientes
  const [indicacaoAtivo, setIndicacaoAtivo] = useState(false);
  const [indicacaoTipo, setIndicacaoTipo] = useState('fixo'); // 'fixo' | 'percentual'
  const [indicacaoValor, setIndicacaoValor] = useState('5');
  const [indicacaoPercentual, setIndicacaoPercentual] = useState('5');
  const [savingIndicacao, setSavingIndicacao] = useState(false);

  // =========================================================
  // 1. CAPTURA DO CÓDIGO OAUTH (MERCADO PAGO)
  // =========================================================
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && primeiroEstabelecimento) {
      const finalizarVinculo = async () => {
        setVinculando(true);
        try {
          const functions = getFunctions();
          const vincularFn = httpsCallable(functions, 'vincularMercadoPago');
          
          await vincularFn({ code, estabelecimentoId: primeiroEstabelecimento });
          
          toast.success("Conta Mercado Pago vinculada com sucesso! 🚀");
          setMpConectado(true);
          setSearchParams({}); 
        } catch (error) {
          console.error("Erro ao vincular:", error);
          toast.error("Falha ao vincular conta. Tente novamente.");
        } finally {
          setVinculando(false);
        }
      };
      finalizarVinculo();
    }
  }, [searchParams, primeiroEstabelecimento, setSearchParams]);

  // =========================================================
  // 2. CARREGAR DADOS AO INICIAR A PÁGINA
  // =========================================================
  useEffect(() => {
    const fetchSettings = async () => {
      if (!primeiroEstabelecimento) return;

      try {
        // A. Carrega as Configurações da Loja
        const docRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setSenhaMaster(data.senhaMaster || '');
          setTempoMinimo(data.tempoMinimo || '40');
          setTempoMaximo(data.tempoMaximo || '60');
          setValorMinimoRaspadinha(data.valorMinimoRaspadinha || '9999');
          setMpConectado(data.mp_conectado || false); 
          
          // Carrega os dados da impressora QZ Tray
          setImpressoraBalcao(data.impressoraBalcao || '');
          setImpressoraCozinha(data.impressoraCozinha || '');

          if (data.roteamentoImpressao) {
            setRoteamentoImpressao(data.roteamentoImpressao);
          }

          if (data.horariosFuncionamento) {
            setHorarios(data.horariosFuncionamento);
          } else if (data.horaAbertura && data.horaFechamento) {
             const oldHorarios = {};
             diasDaSemana.forEach(dia => {
               oldHorarios[dia.key] = {
                 ativo: true,
                 abertura: data.horaAbertura,
                 fechamento: data.horaFechamento
               };
             });
             setHorarios(oldHorarios);
          }

          // Carregar indicação
          if (data.indicacao) {
            setIndicacaoAtivo(data.indicacao.ativo || false);
            setIndicacaoTipo(data.indicacao.tipo || 'fixo');
            setIndicacaoValor(String(data.indicacao.valor || '5'));
            setIndicacaoPercentual(String(data.indicacao.percentual || '5'));
          }
        }

        // B. Carrega as Categorias do Cardápio (Para Mapeamento de Impressão)
        const cardapioRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio');
        const cardapioSnap = await getDocs(cardapioRef);
        const nomesCategorias = cardapioSnap.docs.map(d => d.data().nome || d.id);
        
        // Remove duplicadas (se houver) e salva no estado
        setCategorias([...new Set(nomesCategorias)]);

      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
        toast.error("Erro ao carregar dados da loja.");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [primeiroEstabelecimento]);

  const handleConectarMP = () => {
    const clientId = '310854362032422'; 
    const redirectUri = encodeURIComponent('https://matafome-98455.web.app/admin/configuracoes');
    const url = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&redirect_uri=${redirectUri}&state=${primeiroEstabelecimento}`;
    window.location.href = url;
  };

  const handleHorarioChange = (diaKey, campo, valor) => {
    setHorarios(prev => ({
      ...prev,
      [diaKey]: {
        ...prev[diaKey],
        [campo]: valor
      }
    }));
  };

  // Atualiza o roteamento de uma categoria específica
  const handleRoteamentoChange = (categoria, destino) => {
    setRoteamentoImpressao(prev => ({
      ...prev,
      [categoria]: destino
    }));
  };

  // =========================================================
  // 3. SALVAR TODAS AS CONFIGURAÇÕES MANUAIS
  // =========================================================
  const handleSave = async (e) => {
    e.preventDefault();
    if (!primeiroEstabelecimento) return;

    setSaving(true);
    try {
      const docRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
      
      await updateDoc(docRef, {
        senhaMaster,
        tempoMinimo,
        tempoMaximo,
        valorMinimoRaspadinha,
        horariosFuncionamento: horarios, 
        roteamentoImpressao: roteamentoImpressao, 
        impressoraBalcao,
        impressoraCozinha,
        indicacao: {
          ativo: indicacaoAtivo,
          tipo: indicacaoTipo,
          valor: Number(indicacaoValor) || 5,
          percentual: Number(indicacaoPercentual) || 5
        },
        updatedAt: new Date()
      });

      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || vinculando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
        {vinculando && <p className="font-bold text-gray-600 animate-pulse">Finalizando conexão com o Mercado Pago...</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Configurações Gerais</h1>
          <p className="text-gray-500">Gerencie segurança, horários, pagamentos e gamificação do sistema.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* BLOCO NOVO: Roteamento e QZ Tray Impressoras */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="p-2 bg-gray-800 text-white rounded-lg">
                <IoPrintOutline size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Impressão Automática (QZ Tray)</h2>
                <p className="text-sm text-gray-500">Defina o nome das suas impressoras no Windows e o destino de cada categoria.</p>
              </div>
            </div>

            {/* Configuração dos nomes das Impressoras */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nome da Impressora - BALCÃO</label>
                <input 
                  type="text" 
                  value={impressoraBalcao} 
                  onChange={(e) => setImpressoraBalcao(e.target.value)} 
                  placeholder="Ex: EPSON TM-T20" 
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-800 outline-none transition-all" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nome da Impressora - COZINHA</label>
                <input 
                  type="text" 
                  value={impressoraCozinha} 
                  onChange={(e) => setImpressoraCozinha(e.target.value)} 
                  placeholder="Ex: POS-80C" 
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-800 outline-none transition-all" 
                />
              </div>
              <p className="col-span-1 md:col-span-2 text-xs text-gray-500 font-medium">
                * Importante: Digite <b>exatamente</b> o nome de como a impressora está instalada no Painel de Controle do computador. O aplicativo QZ Tray precisa estar aberto.
              </p>
            </div>

            <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Destino por Categoria de Produto</h3>
            {categorias.length === 0 ? (
              <div className="bg-yellow-50 text-yellow-700 p-4 rounded-xl text-sm font-medium border border-yellow-200">
                Nenhuma categoria de produto foi encontrada. Cadastre produtos no cardápio primeiro.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categorias.map(cat => (
                  <div key={cat} className="flex flex-col bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors">
                    <label className="text-sm font-bold text-gray-700 mb-2 truncate" title={cat}>
                      {cat}
                    </label>
                    <select
                      value={roteamentoImpressao[cat] || 'balcao'} // Padrão é sempre Balcão
                      onChange={(e) => handleRoteamentoChange(cat, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-800 outline-none transition-all text-sm font-medium text-gray-700 bg-white"
                    >
                      <option value="balcao">🏪 Balcão / Caixa</option>
                      <option value="cozinha">🍳 Cozinha / Produção</option>
                      <option value="ambos">🏪 + 🍳 Ambos</option>
                      <option value="nenhum">❌ Não Imprimir</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-[11px] text-gray-400 uppercase tracking-widest font-bold">
              * Bebidas e Sobremesas geralmente ficam no Balcão. Lanches e Pratos quentes vão direto para a Cozinha.
            </p>
          </div>

          {/* BLOCO: Mercado Pago */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 border-b pb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <IoWalletOutline size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Pagamentos Automáticos</h2>
                <p className="text-sm text-gray-500">Receba via PIX direto na sua conta</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <SiMercadopago size={32} className="text-[#009EE3]" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Mercado Pago</h3>
                  <p className="text-xs text-gray-500">Taxa de 0,99% no PIX com recebimento na hora</p>
                </div>
              </div>

              {mpConectado ? (
                <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-bold text-sm">
                  <IoCheckmarkCircle size={20} /> Conta Conectada
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={handleConectarMP}
                  className="bg-[#009EE3] hover:bg-[#0081BA] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-100 active:scale-95 whitespace-nowrap"
                >
                  Conectar Minha Conta
                </button>
              )}
            </div>
          </div>

          {/* BLOCO: Horário de Funcionamento Automático por Dia */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <IoCalendarOutline size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Horário de Funcionamento</h2>
                <p className="text-sm text-gray-500">Configure a abertura e fechamento para cada dia da semana.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {diasDaSemana.map((dia) => (
                <div key={dia.key} className="flex flex-col md:flex-row md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 gap-4">
                  
                  {/* Toggle Ativo/Inativo e Nome do Dia */}
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={horarios[dia.key]?.ativo}
                        onChange={(e) => handleHorarioChange(dia.key, 'ativo', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                    <span className={`font-medium ${horarios[dia.key]?.ativo ? 'text-gray-800' : 'text-gray-400'}`}>
                      {dia.label}
                    </span>
                  </div>

                  {/* Inputs de Horário */}
                  <div className={`flex items-center gap-4 w-full md:w-auto ${!horarios[dia.key]?.ativo && 'opacity-50 pointer-events-none'}`}>
                    <div className="flex flex-col w-full md:w-32">
                      <span className="text-xs text-gray-500 mb-1">Abre às</span>
                      <input 
                        type="time" 
                        value={horarios[dia.key]?.abertura} 
                        onChange={(e) => handleHorarioChange(dia.key, 'abertura', e.target.value)} 
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm" 
                      />
                    </div>
                    <span className="text-gray-400 mt-5">-</span>
                    <div className="flex flex-col w-full md:w-32">
                      <span className="text-xs text-gray-500 mb-1">Fecha às</span>
                      <input 
                        type="time" 
                        value={horarios[dia.key]?.fechamento} 
                        onChange={(e) => handleHorarioChange(dia.key, 'fechamento', e.target.value)} 
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm" 
                      />
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* BLOCO: Operação (Tempos) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 border-b pb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <IoTime size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Tempo de Entrega</h2>
                <p className="text-sm text-gray-500">Estimativa de tempo mostrada ao cliente</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tempo Mínimo (min)</label>
                <input type="number" value={tempoMinimo} onChange={(e) => setTempoMinimo(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tempo Máximo (min)</label>
                <input type="number" value={tempoMaximo} onChange={(e) => setTempoMaximo(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all" />
              </div>
            </div>
          </div>

          {/* BLOCO: Segurança */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 border-b pb-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <IoLockClosed size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Segurança</h2>
                <p className="text-sm text-gray-500">Senha usada para cancelar pedidos no PDV</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Senha Master</label>
                <input type="text" value={senhaMaster} onChange={(e) => setSenhaMaster(e.target.value)} placeholder="Ex: 1234" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-gray-50 focus:bg-white" />
              </div>
            </div>
          </div>

          {/* BLOCO: Opt-out de Marketing */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 border-b pb-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <IoBanOutline size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Opt-out de Marketing</h2>
                <p className="text-sm text-gray-500">Clientes que enviarem "SAIR" são descadastrados automaticamente</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-bold text-red-800 mb-2">🚫 Como funciona o descadastro automático:</p>
              <ol className="text-sm text-red-700 space-y-1 list-decimal list-inside">
                <li>O cliente envia uma mensagem com a palavra: <strong>SAIR</strong>, <strong>PARAR</strong>, <strong>STOP</strong> ou <strong>CANCELAR</strong></li>
                <li>O sistema detecta automaticamente e registra o opt-out</li>
                <li>Uma confirmação é enviada ao cliente</li>
                <li>O cliente não receberá mais mensagens de marketing automático</li>
              </ol>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Link do Webhook (configurar no UAZAPI)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-700 break-all">
                  {`https://us-central1-matafome-98455.cloudfunctions.net/webhookWhatsAppOptout?estabId=${primeiroEstabelecimento || 'SEU_ESTAB_ID'}`}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    const url = `https://us-central1-matafome-98455.cloudfunctions.net/webhookWhatsAppOptout?estabId=${primeiroEstabelecimento}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Link copiado!');
                  }}
                  className="shrink-0 px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
                >
                  Copiar
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Configure este link como webhook de mensagens recebidas no painel do UAZAPI.</p>
            </div>
          </div>

          {/* BLOCO: Gamificação (RASPADINHA) */}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 border-b pb-4">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <IoGameController size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Gamificação (Raspadinha)</h2>
                <p className="text-sm text-gray-500">Configurações de prêmios para o cliente</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor Mínimo do Pedido (R$)</label>
                <input
                  type="number"
                  value={valorMinimoRaspadinha}
                  onChange={(e) => setValorMinimoRaspadinha(e.target.value)}
                  placeholder="Ex: 100"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
                <p className="mt-2 text-xs text-gray-500">O cliente ganha uma raspadinha se o pedido ultrapassar esse valor.</p>
              </div>
            </div>
          </div>


          {/* BOTÃO FINALIZAR */}
          <div className="flex justify-end pt-4 pb-10">
            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-green-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
              {saving ? 'Salvando...' : <><IoSave size={20} /> Salvar Alterações</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AdminSettings;