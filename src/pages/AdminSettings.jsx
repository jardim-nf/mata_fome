// src/pages/AdminSettings.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';

import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  IoSaveOutline, 
  IoLockClosedOutline, 
  IoTimeOutline, 
  IoGameControllerOutline, 
  IoCalendarOutline, 
  IoWalletOutline, 
  IoCheckmarkCircleOutline,
  IoPrintOutline,
  IoBanOutline,
  IoShareSocialOutline,
  IoSettingsOutline,
  IoBuildOutline
} from 'react-icons/io5'; 
import { SiMercadopago } from 'react-icons/si';
import { useLocalSync } from '../context/LocalSyncContext';

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
  const [activeTab, setActiveTab] = useState('IMPRESSAO'); // IMPRESSAO, HORARIOS, PAGAMENTO, INDICACAO, SISTEMA

  const { localServerIp, saveIp, isConnected } = useLocalSync();
  const [localIpInput, setLocalIpInput] = useState(localServerIp || '');

  // Estados do Formulário Gerais
  const [senhaMaster, setSenhaMaster] = useState('');
  const [tempoMinimo, setTempoMinimo] = useState('');
  const [tempoMaximo, setTempoMaximo] = useState('');
  const [valorMinimoRaspadinha, setValorMinimoRaspadinha] = useState('9999');
  const [segmentoOS, setSegmentoOS] = useState('geral');
  
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
  const [impressoraBar, setImpressoraBar] = useState('');

  // Estado Mercado Pago
  const [mpConectado, setMpConectado] = useState(false);

  // Indicação de Clientes
  const [indicacaoAtivo, setIndicacaoAtivo] = useState(false);
  const [indicacaoTipo, setIndicacaoTipo] = useState('fixo'); // 'fixo' | 'percentual'
  const [indicacaoValor, setIndicacaoValor] = useState('5');
  const [indicacaoPercentual, setIndicacaoPercentual] = useState('5');

  // Novas Configurações Operacionais (PDV e Estoque)
  const [controlarEstoque, setControlarEstoque] = useState(true);
  const [bloquearEstoqueZerado, setBloquearEstoqueZerado] = useState(true);
  const [alertaEstoqueBaixo, setAlertaEstoqueBaixo] = useState(true);
  const [permitirMultiplosCaixas, setPermitirMultiplosCaixas] = useState(true);
  const [permitirDescontoPDV, setPermitirDescontoPDV] = useState(true);
  const [requererSenhaMasterCritico, setRequererSenhaMasterCritico] = useState(true);

  // Financeiro & Vendas no PDV
  const [permitirVendaPrazo, setPermitirVendaPrazo] = useState(true);
  const [arredondarCentavos, setArredondarCentavos] = useState(true);
  const [imprimirFechamentoAutomatico, setImprimirFechamentoAutomatico] = useState(true);
  const [exigirClientePDV, setExigirClientePDV] = useState(true);

  // Controle Avançado de Estoque
  const [controlarInsumos, setControlarInsumos] = useState(true);
  const [permitirEstoqueNegativo, setPermitirEstoqueNegativo] = useState(true);
  const [habilitarModuloPerdas, setHabilitarModuloPerdas] = useState(true);

  // Delivery & Cardápio Online
  const [bloquearForaHorario, setBloquearForaHorario] = useState(true);
  const [permitirAgendamentoPedidos, setPermitirAgendamentoPedidos] = useState(true);
  const [exigirTaxaEntregaCadastrada, setExigirTaxaEntregaCadastrada] = useState(true);
  const [limitePedidosEspera, setLimitePedidosEspera] = useState(0);

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
          setSegmentoOS(data.segmentoOS || 'geral');
          
          // Carrega os dados da impressora QZ Tray
          setImpressoraBalcao(data.impressoraBalcao || '');
          setImpressoraCozinha(data.impressoraCozinha || '');
          setImpressoraBar(data.impressoraBar || '');

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

          // Carregar novas configurações operacionais (padrão true se undefined)
          setControlarEstoque(data.controlarEstoque !== false);
          setBloquearEstoqueZerado(data.bloquearEstoqueZerado !== false);
          setAlertaEstoqueBaixo(data.alertaEstoqueBaixo !== false);
          setPermitirMultiplosCaixas(data.permitirMultiplosCaixas !== false);
          setPermitirDescontoPDV(data.permitirDescontoPDV !== false);
          setRequererSenhaMasterCritico(data.requererSenhaMasterCritico !== false);

          // Financeiro & PDV
          setPermitirVendaPrazo(data.permitirVendaPrazo !== false);
          setArredondarCentavos(data.arredondarCentavos !== false);
          setImprimirFechamentoAutomatico(data.imprimirFechamentoAutomatico !== false);
          setExigirClientePDV(data.exigirClientePDV !== false);

          // Estoque Avançado
          setControlarInsumos(data.controlarInsumos !== false);
          setPermitirEstoqueNegativo(data.permitirEstoqueNegativo !== false);
          setHabilitarModuloPerdas(data.habilitarModuloPerdas !== false);

          // Delivery & Cardápio
          setBloquearForaHorario(data.bloquearForaHorario !== false);
          setPermitirAgendamentoPedidos(data.permitirAgendamentoPedidos !== false);
          setExigirTaxaEntregaCadastrada(data.exigirTaxaEntregaCadastrada !== false);
          setLimitePedidosEspera(data.limitePedidosEspera !== undefined ? Number(data.limitePedidosEspera) : 0);
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
        segmentoOS,
        horariosFuncionamento: horarios, 
        roteamentoImpressao: roteamentoImpressao, 
        impressoraBalcao,
        impressoraCozinha,
        impressoraBar,
        controlarEstoque,
        bloquearEstoqueZerado,
        alertaEstoqueBaixo,
        permitirMultiplosCaixas,
        permitirDescontoPDV,
        requererSenhaMasterCritico,
        permitirVendaPrazo,
        arredondarCentavos,
        imprimirFechamentoAutomatico,
        exigirClientePDV,
        controlarInsumos,
        permitirEstoqueNegativo,
        habilitarModuloPerdas,
        bloquearForaHorario,
        permitirAgendamentoPedidos,
        exigirTaxaEntregaCadastrada,
        limitePedidosEspera: Number(limitePedidosEspera) || 0,
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

    if (localIpInput !== localServerIp) {
      saveIp(localIpInput);
    }
  };

  if (loading || vinculando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] font-sans">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-4"></div>
        {vinculando && <p className="font-black text-slate-600 animate-pulse text-sm">Finalizando conexão com o Mercado Pago...</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 sm:p-6 lg:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
      
      {/* ─── NEBULA GLOWS ─── */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-blue-400/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[30%] w-[400px] h-[400px] bg-purple-400/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-6">
        
        {/* Voltar */}
        <BackButton to="/admin" className="mb-4" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-750 to-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-500/25">
              <IoSettingsOutline size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">Configurações Gerais</h1>
              <p className="text-slate-500 mt-1 font-medium text-sm">Controle de segurança, horários, impressões e regras do sistema</p>
            </div>
          </div>
        </div>

        {/* Abas Estilo Pílula */}
        <div className="flex bg-slate-200/40 p-1 rounded-2xl mb-8 overflow-x-auto border border-slate-200/30 backdrop-blur-md gap-1 scrollbar-none">
          <button 
            type="button"
            onClick={() => setActiveTab('IMPRESSAO')} 
            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all whitespace-nowrap ${activeTab === 'IMPRESSAO' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'}`}
          >
            🖨️ Impressão & Roteamento
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('HORARIOS')} 
            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all whitespace-nowrap ${activeTab === 'HORARIOS' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'}`}
          >
            🕒 Horários da Loja
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('PAGAMENTO')} 
            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all whitespace-nowrap ${activeTab === 'PAGAMENTO' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'}`}
          >
            💳 Mercado Pago
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('INDICACAO')} 
            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all whitespace-nowrap ${activeTab === 'INDICACAO' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'}`}
          >
            📢 Indicação de Amigos
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('SISTEMA')} 
            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all whitespace-nowrap ${activeTab === 'SISTEMA' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'}`}
          >
            ⚙️ Operações & Sistema
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* TAB 1: IMPRESSÃO & QZ TRAY */}
          {activeTab === 'IMPRESSAO' && (
            <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                  <IoPrintOutline size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">Impressão Automática (QZ Tray)</h2>
                  <p className="text-xs text-slate-400 font-semibold">Defina o nome exato das impressoras no Windows e onde imprimir cada item do cardápio</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Impressora - Balcão (Caixa)</label>
                  <input 
                    type="text" 
                    value={impressoraBalcao} 
                    onChange={(e) => setImpressoraBalcao(e.target.value)} 
                    placeholder="Ex: EPSON TM-T20" 
                    className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Impressora - Cozinha (Produção)</label>
                  <input 
                    type="text" 
                    value={impressoraCozinha} 
                    onChange={(e) => setImpressoraCozinha(e.target.value)} 
                    placeholder="Ex: POS-80C" 
                    className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Impressora - Bar (Bebidas)</label>
                  <input 
                    type="text" 
                    value={impressoraBar} 
                    onChange={(e) => setImpressoraBar(e.target.value)} 
                    placeholder="Ex: POS-80Bar" 
                    className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                  />
                </div>
                <div className="col-span-1 md:col-span-3 text-[10px] text-slate-400 font-extrabold leading-relaxed uppercase tracking-wider flex items-center gap-1.5">
                  <span>* Digite exatamente o nome registrado nas configurações de impressoras e dispositivos do Windows.</span>
                </div>
              </div>

              <h3 className="text-sm font-black text-slate-750 mt-8 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                <span>Destino por Categoria de Produto</span>
              </h3>

              {categorias.length === 0 ? (
                <div className="bg-amber-50/50 text-amber-700 p-4 rounded-2xl text-xs font-bold border border-amber-200/30">
                  Nenhuma categoria encontrada. Cadastre produtos no cardápio primeiro.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categorias.map(cat => (
                    <div key={cat} className="flex flex-col bg-white/80 p-4 rounded-2xl border border-slate-200/50 shadow-sm hover:border-slate-350 transition-all duration-300">
                      <label className="text-xs font-black text-slate-700 mb-2 truncate" title={cat}>
                        {cat}
                      </label>
                      <select
                        value={roteamentoImpressao[cat] || 'balcao'}
                        onChange={(e) => handleRoteamentoChange(cat, e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 text-xs font-bold text-slate-705 cursor-pointer"
                      >
                        <option value="balcao">🏪 Balcão / Caixa</option>
                        <option value="cozinha">🍳 Cozinha / Produção</option>
                        <option value="bar">🍺 Bar / Copa</option>
                        <option value="ambos">🏪 + 🍳 Ambos</option>
                        <option value="nenhum">❌ Não Imprimir</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HORÁRIOS DA LOJA */}
          {activeTab === 'HORARIOS' && (
            <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                  <IoCalendarOutline size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">Horários de Funcionamento</h2>
                  <p className="text-xs text-slate-400 font-semibold">Defina os horários automáticos de abertura e fechamento para cada dia</p>
                </div>
              </div>

              <div className="space-y-4">
                {diasDaSemana.map((dia) => {
                  const isDayActive = horarios[dia.key]?.ativo;
                  return (
                    <div key={dia.key} className="flex flex-col md:flex-row md:items-center justify-between bg-white/80 p-5 rounded-3xl border border-slate-200/50 hover:border-slate-300 transition-all shadow-sm gap-4">
                      
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={isDayActive}
                            onChange={(e) => handleHorarioChange(dia.key, 'ativo', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                        <span className={`text-sm font-black transition-colors duration-205 ${isDayActive ? 'text-slate-800' : 'text-slate-400'}`}>
                          {dia.label}
                        </span>
                      </div>

                      <div className={`flex items-center gap-4 w-full md:w-auto ${!isDayActive && 'opacity-40 pointer-events-none'}`}>
                        <div className="flex flex-col w-full md:w-32">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Abertura</span>
                          <input 
                            type="time" 
                            value={horarios[dia.key]?.abertura} 
                            onChange={(e) => handleHorarioChange(dia.key, 'abertura', e.target.value)} 
                            className="p-2 bg-white border border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 rounded-xl outline-none text-xs font-bold text-center text-slate-700" 
                          />
                        </div>
                        <span className="text-slate-300 font-bold mt-4">-</span>
                        <div className="flex flex-col w-full md:w-32">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Fechamento</span>
                          <input 
                            type="time" 
                            value={horarios[dia.key]?.fechamento} 
                            onChange={(e) => handleHorarioChange(dia.key, 'fechamento', e.target.value)} 
                            className="p-2 bg-white border border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 rounded-xl outline-none text-xs font-bold text-center text-slate-700" 
                          />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: MERCADO PAGO */}
          {activeTab === 'PAGAMENTO' && (
            <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-655">
                  <IoWalletOutline size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">Pagamentos Integrados</h2>
                  <p className="text-xs text-slate-400 font-semibold">Configure o recebimento de PIX automático na hora com conciliação</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200/50">
                    <SiMercadopago size={36} className="text-[#009EE3]" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Mercado Pago (PIX Automático)</h3>
                    <p className="text-xs text-slate-450 font-semibold mt-0.5">Taxa competitiva no PIX e liberação do saldo imediatamente</p>
                  </div>
                </div>

                {mpConectado ? (
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/60 text-emerald-700 px-4 py-2.5 rounded-2xl font-black text-xs shadow-sm">
                    <IoCheckmarkCircleOutline className="text-base text-emerald-500 animate-bounce" /> Conta Vinculada com Sucesso
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={handleConectarMP}
                    className="bg-[#009EE3] hover:bg-[#0081BA] text-white font-extrabold text-xs py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-blue-500/10 active:scale-95 whitespace-nowrap"
                  >
                    Vincular Conta Mercado Pago
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: INDICAÇÃO DE AMIGOS */}
          {activeTab === 'INDICACAO' && (
            <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-650">
                  <IoShareSocialOutline size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">Indicação de Amigos (Boca a Boca)</h2>
                  <p className="text-xs text-slate-400 font-semibold">Premie clientes que convidam novos clientes para comprar no seu delivery</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Toggle Geral */}
                <div className="flex items-center justify-between bg-slate-50/50 p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Ativar Programa de Indicações</h3>
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Concede um cupom/crédito ao cliente quando o indicado realizar o primeiro pedido</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={indicacaoAtivo}
                      onChange={(e) => setIndicacaoAtivo(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {indicacaoAtivo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/50 p-6 rounded-3xl border border-slate-100 shadow-inner animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-455 uppercase tracking-widest mb-2">Formato da Recompensa</label>
                      <div className="flex bg-slate-105 p-1 rounded-2xl border border-slate-200/50 bg-slate-100">
                        <button 
                          type="button"
                          onClick={() => setIndicacaoTipo('fixo')} 
                          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${indicacaoTipo === 'fixo' ? 'bg-white shadow-sm text-purple-600 border border-purple-200/20' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          💵 VALOR FIXO (R$)
                        </button>
                        <button 
                          type="button"
                          onClick={() => setIndicacaoTipo('percentual')} 
                          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${indicacaoTipo === 'percentual' ? 'bg-white shadow-sm text-purple-600 border border-purple-200/20' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          🏷️ PERCENTUAL (%)
                        </button>
                      </div>
                    </div>

                    {indicacaoTipo === 'fixo' ? (
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Valor do Bônus (R$)</label>
                        <input 
                          type="number" 
                          value={indicacaoValor} 
                          onChange={(e) => setIndicacaoValor(e.target.value)} 
                          placeholder="Ex: 5" 
                          className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                        />
                        <p className="text-[10px] text-slate-400 font-semibold mt-1.5">O cliente que indicou ganhará R$ {indicacaoValor} em crédito no sistema.</p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Porcentagem do Bônus (%)</label>
                        <input 
                          type="number" 
                          value={indicacaoPercentual} 
                          onChange={(e) => setIndicacaoPercentual(e.target.value)} 
                          placeholder="Ex: 10" 
                          className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                        />
                        <p className="text-[10px] text-slate-400 font-semibold mt-1.5">O cliente que indicou ganhará {indicacaoPercentual}% do valor total do primeiro pedido do amigo.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SISTEMA & PARÂMETROS */}
          {activeTab === 'SISTEMA' && (
            <div className="space-y-6">
              
              {/* Sub-Card 1: Tempos Operacionais */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-650">
                    <IoTimeOutline size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Tempo Estimado de Entrega</h2>
                    <p className="text-xs text-slate-400 font-semibold">Previsão média mostrada para o cliente no cardápio online</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Tempo Mínimo (minutos)</label>
                    <input 
                      type="number" 
                      value={tempoMinimo} 
                      onChange={(e) => setTempoMinimo(e.target.value)} 
                      className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-slate-500/10 focus:border-slate-550 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Tempo Máximo (minutos)</label>
                    <input 
                      type="number" 
                      value={tempoMaximo} 
                      onChange={(e) => setTempoMaximo(e.target.value)} 
                      className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-slate-500/10 focus:border-slate-550 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Card: Parâmetros de PDV & Caixa */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-655">
                    <IoSettingsOutline size={20} className="text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Parâmetros de PDV & Caixa</h2>
                    <p className="text-xs text-slate-400 font-semibold">Defina permissões e regras operacionais do caixa e recebimentos no balcão</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Múltiplos Caixas */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Múltiplos Caixas por Usuário</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Permite abrir mais de uma sessão de caixa simultaneamente por operador.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={permitirMultiplosCaixas}
                        onChange={(e) => setPermitirMultiplosCaixas(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>

                  {/* Permitir Desconto no PDV */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Permitir Desconto no PDV</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Habilita a aplicação de descontos manuais na tela do caixa.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={permitirDescontoPDV}
                        onChange={(e) => setPermitirDescontoPDV(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>

                  {/* Requerer Senha do Gerente */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Requerer Senha do Gerente</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Exige senha do gerente para descontos elevados ou excluir itens do carrinho.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={requererSenhaMasterCritico}
                        onChange={(e) => setRequererSenhaMasterCritico(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>

                  {/* Permitir Vendas a Prazo */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Permitir Vendas a Prazo ("Fiado")</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Permite finalizar a venda e lançar o débito na conta acumulada do cliente.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={permitirVendaPrazo}
                        onChange={(e) => setPermitirVendaPrazo(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>

                  {/* Arredondar Centavos */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Arredondar Centavos</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Arredonda valores quebrados de vendas (facilita troco em dinheiro físico).</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={arredondarCentavos}
                        onChange={(e) => setArredondarCentavos(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>

                  {/* Imprimir Fechamento Automatico */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Imprimir Fechamento de Caixa</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Imprime o resumo financeiro automaticamente na impressora de balcão ao fechar o caixa.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={imprimirFechamentoAutomatico}
                        onChange={(e) => setImprimirFechamentoAutomatico(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>

                  {/* Exigir Cliente PDV */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Exigir Cliente no PDV</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Obriga a identificação ou cadastro de um cliente antes de finalizar qualquer venda.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={exigirClientePDV}
                        onChange={(e) => setExigirClientePDV(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Card: Controle Avançado de Estoque */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-655">
                    <IoSettingsOutline size={20} className="text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Controle Avançado de Estoque</h2>
                    <p className="text-xs text-slate-400 font-semibold">Gerencie a contagem de produtos, estoque de ingredientes e alertas de reposição</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Controlar Estoque */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm col-span-1 md:col-span-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Controlar Estoque Geral</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Habilita a contagem e visualização do estoque em toda a aplicação.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={controlarEstoque}
                        onChange={(e) => setControlarEstoque(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Bloquear Estoque Zerado */}
                  <div className={`flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm ${!controlarEstoque && 'opacity-40 pointer-events-none'}`}>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Bloquear Estoque Zerado</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Impede a conclusão de vendas no caixa caso o produto esteja sem estoque.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={bloquearEstoqueZerado}
                        onChange={(e) => setBloquearEstoqueZerado(e.target.checked)}
                        disabled={!controlarEstoque}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Alerta Estoque Baixo */}
                  <div className={`flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm ${!controlarEstoque && 'opacity-40 pointer-events-none'}`}>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Aviso de Estoque Baixo</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Exibe alertas visuais no painel administrativo para produtos abaixo do mínimo.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={alertaEstoqueBaixo}
                        onChange={(e) => setAlertaEstoqueBaixo(e.target.checked)}
                        disabled={!controlarEstoque}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Controlar Insumos / Ficha Tecnica */}
                  <div className={`flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm ${!controlarEstoque && 'opacity-40 pointer-events-none'}`}>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Controlar Insumos (Ficha Técnica)</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Permite dar baixas automáticas em ingredientes vinculados (Ex: pão, carne).</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={controlarInsumos}
                        onChange={(e) => setControlarInsumos(e.target.checked)}
                        disabled={!controlarEstoque}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Permitir Estoque Negativo */}
                  <div className={`flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm ${!controlarEstoque && 'opacity-40 pointer-events-none'}`}>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Permitir Estoque Negativo</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Permite finalizar vendas mesmo sem saldo no sistema (fica saldo negativo).</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={permitirEstoqueNegativo}
                        onChange={(e) => setPermitirEstoqueNegativo(e.target.checked)}
                        disabled={!controlarEstoque}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Habilitar Modulo Perdas */}
                  <div className={`flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm ${!controlarEstoque && 'opacity-40 pointer-events-none'}`}>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Módulo de Perdas & Desperdícios</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Habilita ferramentas para os operadores lançarem perdas de mercadorias.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={habilitarModuloPerdas}
                        onChange={(e) => setHabilitarModuloPerdas(e.target.checked)}
                        disabled={!controlarEstoque}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Card: Cardápio & Delivery Online */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-655">
                    <IoSettingsOutline size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Cardápio & Delivery Online</h2>
                    <p className="text-xs text-slate-400 font-semibold">Controle as regras de envio de pedidos diretamente pelos clientes na web</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bloquear Pedidos fora de Horário */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Bloquear Fora do Horário</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Impede clientes de finalizarem compras no site se o restaurante estiver fechado.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={bloquearForaHorario}
                        onChange={(e) => setBloquearForaHorario(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  {/* Permitir Agendamento de Pedidos */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Permitir Agendar Pedidos</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Habilita opção para clientes agendarem a data e hora de entrega do pedido.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={permitirAgendamentoPedidos}
                        onChange={(e) => setPermitirAgendamentoPedidos(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  {/* Exigir Taxa de Entrega Cadastrada */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold">Exigir Bairro com Taxa</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Impede clientes fora dos bairros com taxas configuradas de concluírem pedidos.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={exigirTaxaEntregaCadastrada}
                        onChange={(e) => setExigirTaxaEntregaCadastrada(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  {/* Limite de Pedidos Simultaneos */}
                  <div className="flex flex-col justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-bold font-bold">Limite de Pedidos em Espera</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Número máximo de pedidos pendentes na cozinha antes de fechar o site (0 = ilimitado).</p>
                    </div>
                    <div className="mt-2.5">
                      <input 
                        type="number" 
                        value={limitePedidosEspera} 
                        onChange={(e) => setLimitePedidosEspera(e.target.value)} 
                        className="w-full p-2 bg-white border border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 rounded-xl outline-none text-xs font-bold text-center text-slate-700 shadow-sm"
                        placeholder="Ex: 15 (0 para ilimitado)"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Card 2: Segurança */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                    <IoLockClosedOutline size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Segurança da Loja</h2>
                    <p className="text-xs text-slate-400 font-semibold">Controle administrativo e validação de operações críticas</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Senha Master (Excluir pedidos no PDV)</label>
                    <input 
                      type="text" 
                      value={senhaMaster} 
                      onChange={(e) => setSenhaMaster(e.target.value)} 
                      placeholder="Ex: 1234" 
                      className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-red-500/10 focus:border-red-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Sub-Card 3: Gamificação */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <IoGameControllerOutline size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Gamificação (Raspadinha Digital)</h2>
                    <p className="text-xs text-slate-400 font-semibold">Premie e incentive compras de ticket médio maior</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Valor Mínimo do Pedido para ganhar (R$)</label>
                    <input 
                      type="number" 
                      value={valorMinimoRaspadinha} 
                      onChange={(e) => setValorMinimoRaspadinha(e.target.value)} 
                      placeholder="Ex: 100" 
                      className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                    />
                    <p className="text-[10px] text-slate-400 font-semibold mt-1.5">Se o pedido passar desse valor, o cliente recebe uma raspadinha no checkout.</p>
                  </div>
                </div>
              </div>

              {/* Sub-Card: Segmento de Ordens de Serviço */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-650">
                    <IoBuildOutline size={20} className="text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Segmento de Ordens de Serviço (OS)</h2>
                    <p className="text-xs text-slate-400 font-semibold">Defina o ramo de atuação para personalizar os tipos e campos de suas ordens de serviço</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Ramo/Segmento de OS</label>
                    <select
                      value={segmentoOS}
                      onChange={(e) => setSegmentoOS(e.target.value)}
                      className="w-full p-3.5 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="geral">🔌 Geral (Ambos / Todos os campos)</option>
                      <option value="eletronicos">📱 Assistência de Eletrônicos / Celulares</option>
                      <option value="automotivo">🚗 Oficina Mecânica / Automotiva</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sub-Card 4: Servidor Local */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    <IoPrintOutline size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Servidor Local (Sync Offline)</h2>
                    <p className="text-xs text-slate-400 font-semibold">Comunicação e sincronização direta no salão sem internet</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Endereço IP do Computador Caixa</label>
                    <input 
                      type="text" 
                      value={localIpInput} 
                      onChange={(e) => setLocalIpInput(e.target.value)} 
                      placeholder="Ex: 192.168.1.100" 
                      className="w-full p-3 bg-white/80 hover:bg-white border border-slate-200 focus:bg-white focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" 
                    />
                    {isConnected ? (
                      <p className="text-[10px] text-emerald-655 font-black mt-1.5 flex items-center gap-1">🟢 Sincronizado e Conectado ao Servidor Local.</p>
                    ) : localIpInput ? (
                      <p className="text-[10px] text-rose-500 font-black mt-1.5 flex items-center gap-1">🔴 Servidor desconectado (verifique se o app local está aberto no IP).</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Sub-Card 5: Opt-out de Marketing */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                    <IoBanOutline size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Opt-out de Marketing (Descadastro WhatsApp)</h2>
                    <p className="text-xs text-slate-400 font-semibold">Gerenciamento automático de pedidos de cancelamento de envio de mensagens</p>
                  </div>
                </div>

                <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 text-xs font-semibold text-rose-800 space-y-2 leading-relaxed">
                  <p className="font-extrabold text-rose-900">🚫 Como funciona o descadastro automático:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1 text-[11px] text-rose-700 font-medium">
                    <li>Se o cliente responder "SAIR", "PARAR", "STOP" ou "CANCELAR" no WhatsApp</li>
                    <li>O webhook registra o bloqueio e evita disparos de campanhas de fidelização e marketing</li>
                    <li>Uma confirmação automática é emitida de volta ao número</li>
                  </ul>
                </div>

                <div className="bg-slate-50/50 border border-slate-200/50 p-5 rounded-3xl">
                  <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Webhook URL (configurar no painel UAZAPI)</span>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 text-[11px] bg-white border border-slate-200 rounded-xl px-4 py-3 font-mono text-slate-700 break-all select-all shadow-sm">
                      {`https://us-central1-matafome-98455.cloudfunctions.net/webhookWhatsAppOptout?estabId=${primeiroEstabelecimento || 'SEU_ESTAB_ID'}`}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `https://us-central1-matafome-98455.cloudfunctions.net/webhookWhatsAppOptout?estabId=${primeiroEstabelecimento}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Link copiado para a área de transferência!');
                      }}
                      className="shrink-0 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      Copiar Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BOTÃO SALVAR GLOBAL */}
          <div className="mt-8 mb-20">
            <button 
              type="submit" 
              disabled={saving} 
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold text-base transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 border border-emerald-400/30"
            >
              {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <IoSaveOutline size={18} />} 
              <span>SALVAR TODAS AS CONFIGURAÇÕES</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AdminSettings;