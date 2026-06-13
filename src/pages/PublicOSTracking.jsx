import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { osService } from '../services/osService';
import { toast } from 'react-toastify';
import {
  IoBuildOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoPhonePortraitOutline,
  IoCarOutline,
  IoDocumentTextOutline,
  IoPersonOutline,
  IoTimeOutline,
  IoWalletOutline,
  IoLogoWhatsapp,
  IoSearchOutline,
  IoAlertCircleOutline,
  IoCheckmarkOutline,
  IoCloseOutline
} from 'react-icons/io5';

// Helpers de LGPD
const obfuscatePhone = (phone) => {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 10) {
    const ddd = clean.substring(0, 2);
    const suffix = clean.substring(clean.length - 4);
    const masked = '*'.repeat(clean.length - 6);
    return `(${ddd}) ${masked}-${suffix}`;
  }
  return phone;
};

const obfuscateCPF = (cpf) => {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length === 11) {
    return `***.***.${clean.substring(6, 9)}-**`;
  }
  return cpf;
};

const cleanPhoneInput = (phone) => {
  return phone.replace(/\D/g, '');
};

export default function PublicOSTracking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Parâmetros da URL
  const urlEstabId = searchParams.get('estabId') || searchParams.get('establishmentId');
  const urlOsId = searchParams.get('osId') || searchParams.get('id');

  // Estados
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [os, setOs] = useState(null);
  const [estabInfo, setEstabInfo] = useState(null);

  // Estados do formulário de busca
  const [searchEstab, setSearchEstab] = useState('');
  const [searchOS, setSearchOS] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  // Carrega OS quando temos parâmetros na URL
  useEffect(() => {
    if (urlEstabId && urlOsId) {
      carregarDadosDiretos(urlEstabId, urlOsId);
    }
  }, [urlEstabId, urlOsId]);

  const carregarDadosDiretos = async (estabId, osId) => {
    setLoading(true);
    try {
      // 1. Busca info do Estabelecimento
      const estabDoc = await getDoc(doc(db, 'estabelecimentos', estabId));
      if (estabDoc.exists()) {
        setEstabInfo({ id: estabDoc.id, ...estabDoc.data() });
      }

      // 2. Busca OS
      const osData = await osService.obterOrdemServicoPorId(estabId, osId);
      if (osData) {
        setOs(osData);
      } else {
        toast.error("Ordem de Serviço não encontrada.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar os dados de rastreamento.");
    } finally {
      setLoading(false);
    }
  };

  // Executa busca manual segura
  const handleManualSearch = async (e) => {
    e.preventDefault();
    if (!searchEstab.trim() || !searchOS.trim() || !searchPhone.trim()) {
      toast.warn("Preencha todos os campos para realizar a consulta.");
      return;
    }

    setLoading(true);
    try {
      let estabId = searchEstab.trim();

      // Se o usuário digitou o slug, resolve para ID
      const estabRef = collection(db, 'estabelecimentos');
      const qSlug = query(estabRef, where('slug', '==', estabId.toLowerCase()));
      const slugSnap = await getDocs(qSlug);
      
      if (!slugSnap.empty) {
        estabId = slugSnap.docs[0].id;
      }

      // 1. Carrega info do estabelecimento
      const estabDoc = await getDoc(doc(db, 'estabelecimentos', estabId));
      let tempEstabInfo = null;
      if (estabDoc.exists()) {
        tempEstabInfo = { id: estabDoc.id, ...estabDoc.data() };
      } else {
        toast.error("Loja ou Estabelecimento não encontrado.");
        setLoading(false);
        return;
      }

      // 2. Consulta OS
      const osColRef = collection(db, 'estabelecimentos', estabId, 'ordensServico');
      const qOS = query(osColRef, where('numeroOS', '==', Number(searchOS.trim())));
      const osSnap = await getDocs(qOS);

      if (osSnap.empty) {
        toast.error("Ordem de serviço não localizada neste estabelecimento.");
        setLoading(false);
        return;
      }

      const osData = { id: osSnap.docs[0].id, ...osSnap.docs[0].data() };

      // Validação do telefone para evitar vazamento de dados (LGPD)
      const phoneInputClean = cleanPhoneInput(searchPhone);
      const osPhoneClean = cleanPhoneInput(osData.cliente?.telefone || '');

      if (!osPhoneClean.includes(phoneInputClean) && !phoneInputClean.includes(osPhoneClean)) {
        toast.error("Telefone informado não coincide com os dados da OS.");
        setLoading(false);
        return;
      }

      // Sucesso na busca
      setEstabInfo(tempEstabInfo);
      setOs(osData);
      toast.success("Ordem de serviço localizada!");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao buscar OS. Verifique os dados digitados.");
    } finally {
      setLoading(false);
    }
  };

  // Ações de Orçamento
  const handleDecidirOrcamento = async (status) => {
    if (!os || !estabInfo) return;
    setLoadingAction(true);
    try {
      await osService.atualizarOrdemServico(estabInfo.id, os.id, {
        status: status
      });
      toast.success(status === 'orcamento_aprovado' ? "Orçamento Aprovado!" : "Orçamento Rejeitado.");
      // Atualiza estado local
      const updatedOS = await osService.obterOrdemServicoPorId(estabInfo.id, os.id);
      if (updatedOS) setOs(updatedOS);
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao atualizar a decisão.");
    } finally {
      setLoadingAction(false);
    }
  };

  // Cálculos financeiros
  const valorServicos = useMemo(() => os?.servicos?.reduce((acc, s) => acc + Number(s.valor || 0), 0) || 0, [os]);
  const valorPecas = useMemo(() => os?.pecas?.reduce((acc, p) => acc + Number(p.valor || 0), 0) || 0, [os]);
  const total = useMemo(() => os?.total || 0, [os]);

  // Checa tipo
  const isVeiculo = useMemo(() => ['Carro', 'Moto', 'Caminhão', 'Utilitário'].includes(os?.equipamento?.tipo), [os]);

  // Mapeamento dos steps do progresso
  const progressSteps = [
    { key: 'aberto', label: 'OS Aberta', colors: 'from-blue-500 to-indigo-500', active: ['em_analise', 'aguardando_orcamento', 'orcamento_aprovado', 'orcamento_rejeitado', 'em_manutencao', 'pronto', 'entregue'].includes(os?.status) },
    { key: 'orcamento', label: 'Orçamento', colors: 'from-indigo-500 to-purple-500', active: ['orcamento_aprovado', 'em_manutencao', 'pronto', 'entregue'].includes(os?.status), erro: os?.status === 'orcamento_rejeitado' },
    { key: 'manutencao', label: 'Em Reparo', colors: 'from-purple-500 to-pink-500', active: ['em_manutencao', 'pronto', 'entregue'].includes(os?.status) },
    { key: 'pronto', label: 'Pronto', colors: 'from-pink-500 to-emerald-500', active: ['pronto', 'entregue'].includes(os?.status) },
    { key: 'entregue', label: 'Entregue', colors: 'from-emerald-500 to-teal-500', active: os?.status === 'entregue' }
  ];

  // Configuração de cores e marcas dinâmicas do estabelecimento
  const cores = estabInfo?.cores || { primaria: '#3b82f6', destaque: '#10b981' };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center font-sans text-white p-4">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-lg font-black tracking-wider uppercase">Buscando Atendimento...</h2>
        <p className="text-slate-450 text-xs font-semibold mt-1">Carregando dados oficiais e criptografados.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col relative overflow-x-hidden">
      
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* SEO metadata tags simulados para renderização SPA */}
      <title>{os ? `OS #${os.numeroOS} | Rastreamento` : 'Consultar Ordem de Serviço'}</title>
      
      {/* HEADER / BRAND AREA */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {estabInfo?.logoUrl ? (
              <img src={estabInfo.logoUrl} alt={estabInfo.nome} className="w-10 h-10 rounded-xl object-cover border border-slate-850" />
            ) : (
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-lg">
                {estabInfo?.nome?.charAt(0) || '🛠️'}
              </div>
            )}
            <div>
              <h1 className="text-sm font-black tracking-wide uppercase text-white">{estabInfo?.nome || 'IdeaFood Tech'}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Acompanhamento de Serviços</p>
            </div>
          </div>
          {os && (
            <button
              onClick={() => {
                setOs(null);
                setEstabInfo(null);
                navigate('/rastrear-os');
              }}
              className="text-xs font-black text-slate-450 hover:text-white transition-all bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl"
            >
              Nova Consulta
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 z-10">

        {/* --- TELA 1: FORMULÁRIO DE BUSCA --- */}
        {!os && (
          <div className="max-w-md mx-auto my-12 space-y-8 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">ÁREA DO CLIENTE</span>
              <h2 className="text-2xl md:text-3xl font-black text-white">Consulte sua OS</h2>
              <p className="text-xs text-slate-400 font-bold">Consulte o status do reparo do seu veículo ou dispositivo em tempo real.</p>
            </div>

            <form onSubmit={handleManualSearch} className="bg-slate-900/40 backdrop-blur-lg border border-slate-800/80 rounded-[2.2rem] p-6 md:p-8 shadow-2xl space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-450">Loja / Estabelecimento</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🏢</span>
                  <input
                    type="text"
                    required
                    value={searchEstab}
                    onChange={(e) => setSearchEstab(e.target.value)}
                    placeholder="Nome da loja ou ID"
                    className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 text-white rounded-2xl pl-11 pr-4 py-3 text-xs font-bold transition-all focus:outline-none placeholder:text-slate-600 shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-450">Número da OS</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">#</span>
                  <input
                    type="number"
                    required
                    value={searchOS}
                    onChange={(e) => setSearchOS(e.target.value)}
                    placeholder="Ex: 1024"
                    className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 text-white rounded-2xl pl-11 pr-4 py-3 text-xs font-bold transition-all focus:outline-none placeholder:text-slate-600 shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-450">Telefone / WhatsApp</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">📞</span>
                  <input
                    type="text"
                    required
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    placeholder="Seu telefone cadastrado"
                    className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 text-white rounded-2xl pl-11 pr-4 py-3 text-xs font-bold transition-all focus:outline-none placeholder:text-slate-600 shadow-inner"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-750 text-white font-black text-xs uppercase tracking-wider py-4 rounded-2xl transition-all shadow-lg shadow-indigo-650/20 flex items-center justify-center gap-2 active:scale-98"
              >
                <IoSearchOutline size={16} /> Consultar Ordem de Serviço
              </button>
            </form>

            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold">Seus dados estão protegidos por criptografia e em total conformidade com a LGPD.</p>
            </div>
          </div>
        )}

        {/* --- TELA 2: VISUALIZAÇÃO PREMIUM DA OS --- */}
        {os && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* CARD PRINCIPAL COM STATUS E NÚMERO */}
            <div className="bg-slate-900/30 border border-slate-850 rounded-[2.2rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent pointer-events-none" />
              <div className="space-y-2 text-center md:text-left relative z-10">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-xl text-white font-extrabold text-[10px] uppercase">
                    OS #{os.numeroOS}
                  </span>
                  {os.status === 'orcamento_rejeitado' && (
                    <span className="bg-rose-500/10 text-rose-450 border border-rose-500/20 px-3 py-1 rounded-xl font-black text-[10px] uppercase tracking-wider">
                      Orçamento Recusado
                    </span>
                  )}
                  {os.status === 'sem_conserto' && (
                    <span className="bg-slate-850 text-slate-400 border border-slate-800 px-3 py-1 rounded-xl font-black text-[10px] uppercase tracking-wider">
                      Sem Conserto
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white">
                  Olá, {os.cliente?.nome ? os.cliente.nome.split(' ')[0] : 'Cliente'}!
                </h2>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Acompanhe abaixo o progresso de execução e reparo em tempo real.
                </p>
              </div>

              {/* Contato Loja */}
              {estabInfo?.telefone && (
                <a
                  href={`https://wa.me/${cleanPhoneInput(estabInfo.telefone)}?text=Olá, gostaria de informações sobre a OS #${os.numeroOS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600/15 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 font-black text-xs px-5 py-3 rounded-2xl flex items-center gap-2 transition-all active:scale-95 z-10 shrink-0"
                >
                  <IoLogoWhatsapp size={18} /> SUPORTE VIA WHATSAPP
                </a>
              )}
            </div>

            {/* HORIZONTAL STEPPER PROGRESS */}
            <div className="bg-slate-900/25 border border-slate-900 rounded-[2.2rem] p-6 md:p-8 shadow-md space-y-6">
              <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Progresso do Atendimento</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative">
                {progressSteps.map((step, idx) => {
                  const isCurrent = step.active && (idx === progressSteps.length - 1 || !progressSteps[idx + 1].active);
                  const isErrored = step.erro;

                  return (
                    <div key={step.key} className="flex flex-col items-center text-center space-y-3 relative group">
                      
                      {/* Linha conectora */}
                      {idx < progressSteps.length - 1 && (
                        <div className="hidden sm:block absolute left-1/2 top-4 w-full h-[3px] bg-slate-850 -z-10">
                          <div className={`h-full bg-gradient-to-r ${step.colors} transition-all duration-500 ${
                            progressSteps[idx + 1].active ? 'w-full' : 'w-0'
                          }`} />
                        </div>
                      )}

                      {/* Icon Indicator */}
                      <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
                        isErrored
                          ? 'bg-rose-950/80 border-rose-500 text-rose-400 shadow-lg shadow-rose-950/20'
                          : step.active
                            ? `bg-slate-900 border-indigo-500 text-indigo-400 ${
                                isCurrent ? 'ring-4 ring-indigo-500/20 scale-110 shadow-lg shadow-indigo-650/15' : ''
                              }`
                            : 'bg-slate-950 border-slate-850 text-slate-600'
                      }`}>
                        {isErrored ? (
                          <IoCloseOutline size={18} />
                        ) : step.active ? (
                          <IoCheckmarkOutline size={18} className="stroke-[3]" />
                        ) : (
                          <span className="text-xs font-black">{idx + 1}</span>
                        )}
                      </div>

                      {/* Label */}
                      <div className="space-y-0.5">
                        <p className={`text-[11px] font-black uppercase tracking-wider transition-all ${
                          isErrored ? 'text-rose-450' : step.active ? 'text-white' : 'text-slate-500'
                        }`}>
                          {step.label}
                        </p>
                        {isCurrent && !isErrored && (
                          <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded-md font-black uppercase animate-pulse">
                            Atual
                          </span>
                        )}
                        {isErrored && (
                          <span className="text-[8px] bg-rose-500/10 text-rose-450 border border-rose-500/25 px-1.5 py-0.5 rounded-md font-black uppercase">
                            Recusado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEÇÃO INTERATIVA: APROVAÇÃO DE ORÇAMENTO */}
            {os.status === 'aguardando_orcamento' && (
              <div className="bg-slate-900 border border-indigo-500/25 rounded-[2.2rem] p-6 md:p-8 text-center space-y-6 relative overflow-hidden shadow-2xl">
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-550/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="max-w-md mx-auto space-y-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl mx-auto mb-4 text-indigo-400">
                    💰
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wider">Aprovação do Orçamento</h3>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    Verifique os custos de mão de obra e peças abaixo. Para autorizar a manutenção e reposição dos componentes, clique em aprovar.
                  </p>
                </div>

                <div className="bg-slate-950/80 max-w-sm mx-auto p-5 rounded-2xl border border-slate-850 flex items-center justify-between text-xs font-bold shadow-inner">
                  <span className="text-slate-450 uppercase tracking-widest">Valor do Conserto</span>
                  <span className="text-2xl font-black text-white">R$ {total.toFixed(2)}</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <button
                    disabled={loadingAction}
                    onClick={() => handleDecidirOrcamento('orcamento_aprovado')}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-emerald-550/10 flex items-center justify-center gap-1.5 active:scale-97 transition-all disabled:opacity-50"
                  >
                    <IoCheckmarkCircleOutline size={16} /> APROVAR ORÇAMENTO
                  </button>
                  <button
                    disabled={loadingAction}
                    onClick={() => handleDecidirOrcamento('orcamento_rejeitado')}
                    className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-rose-500 hover:text-rose-650 font-black text-xs uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-1.5 active:scale-97 transition-all disabled:opacity-50"
                  >
                    <IoCloseCircleOutline size={16} /> RECUSAR ORÇAMENTO
                  </button>
                </div>
              </div>
            )}

            {/* SEÇÃO INFORMATIVA DE ORÇAMENTO REJEITADO */}
            {os.status === 'orcamento_rejeitado' && (
              <div className="bg-rose-950/20 border border-rose-500/20 rounded-[2.2rem] p-6 text-center max-w-2xl mx-auto space-y-2">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-sm font-black text-rose-400 uppercase tracking-wider">Orçamento Recusado pelo Cliente</h3>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Esta ordem de serviço foi classificada como recusada. Se você mudou de ideia e deseja executar o conserto, por favor, entre em contato diretamente com a loja.
                </p>
              </div>
            )}

            {/* GRID DE INFORMAÇÕES DO ATENDIMENTO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* COL 1 & 2: EQUIPAMENTO, CHECKLIST E VALORES */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Dados do Aparelho/Veículo */}
                <div className="bg-slate-900/30 border border-slate-850 rounded-[2.2rem] p-6 md:p-8 space-y-6 shadow-xl">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-slate-850 pb-3 flex items-center gap-2">
                    {isVeiculo ? <IoCarOutline size={18} className="text-indigo-400" /> : <IoPhonePortraitOutline size={18} className="text-indigo-400" />}
                    <span>{isVeiculo ? 'Ficha Técnica do Veículo' : 'Ficha Técnica do Equipamento'}</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tipo</p>
                      <p className="text-slate-200 mt-1 text-sm">{os.equipamento?.tipo || '---'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Marca</p>
                      <p className="text-slate-200 mt-1 text-sm">{os.equipamento?.marca || '---'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Modelo</p>
                      <p className="text-slate-200 mt-1 text-sm">{os.equipamento?.modelo || '---'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{isVeiculo ? 'Chassi' : 'Série / IMEI'}</p>
                      <p className="text-indigo-400 mt-1 text-sm font-mono truncate">{os.equipamento?.nSerieOrImei || '---'}</p>
                    </div>
                  </div>

                  {isVeiculo ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-bold border-t border-slate-850 pt-4">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Placa</p>
                        <p className="text-white mt-1 text-sm uppercase bg-slate-800 px-2 py-0.5 rounded inline-block font-mono border border-slate-700">{os.equipamento?.placa || '---'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Quilometragem</p>
                        <p className="text-slate-200 mt-1 text-sm">{os.equipamento?.quilometragem ? `${Number(os.equipamento.quilometragem).toLocaleString('pt-BR')} KM` : '---'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Combustível</p>
                        <p className="text-slate-200 mt-1 text-sm">
                          {os.equipamento?.nivelCombustivel === 'reserva' && '⛽ Reserva'}
                          {os.equipamento?.nivelCombustivel === '1_4' && '⛽ 1/4'}
                          {os.equipamento?.nivelCombustivel === '1_2' && '⛽ 1/2'}
                          {os.equipamento?.nivelCombustivel === '3_4' && '⛽ 3/4'}
                          {os.equipamento?.nivelCombustivel === 'cheio' && '⛽ Cheio'}
                          {!os.equipamento?.nivelCombustivel && '---'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold border-t border-slate-850 pt-4">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Backup dos Dados</p>
                        <p className="text-slate-200 mt-1 text-sm">
                          {os.equipamento?.backupRealizado === 'sim' && '✅ Realizado por Segurança'}
                          {os.equipamento?.backupRealizado === 'nao' && '❌ Não Realizado'}
                          {os.equipamento?.backupRealizado === 'risco_cliente' && '⚠️ Sob Risco do Cliente'}
                          {os.equipamento?.backupRealizado === 'nao_se_aplica' && '🔌 Não se aplica'}
                          {!os.equipamento?.backupRealizado && '---'}
                        </p>
                      </div>
                      {os.equipamento?.acessoriosDeixados && os.equipamento.acessoriosDeixados.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Acessórios Deixados</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {os.equipamento.acessoriosDeixados.map(acc => {
                              const labels = { carregador: '🔌 Carregador', cabo: '🎗️ Cabo', capinha: '📱 Capinha', chip: '📟 Chip', memoria: '💾 SD Card', fone: '🎧 Fone' };
                              return (
                                <span key={acc} className="bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded text-[9px] font-black">
                                  {labels[acc] || acc}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Checklist */}
                  {os.checklist && Object.keys(os.checklist).length > 0 && (
                    <div className="border-t border-slate-850 pt-4 space-y-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">📋 Checklist de Entrada (Status Inicial)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {Object.entries(os.checklist).map(([key, value]) => {
                          const labels = isVeiculo
                            ? { farois: '💡 Faróis/Lanternas', setas: '🔊 Setas/Buzina', pneus: '🛞 Pneus/Rodas', vidros: '🪟 Vidros/Travas', oleo_agua: '🛢️ Óleo/Água', freios: '🛑 Freios/Suspensão', ar_condicionado: '❄️ Ar Condicionado' }
                            : { touch: '📱 Touch/Tela', cam_frontal: '📸 Câm. Frontal', cam_traseira: '📸 Câm. Traseira', som: '🔊 Mic/Áudio', conector_carga: '🔌 Conector Carga', biometria: '🔐 Biometria', botoes: '🎛️ Botões/Teclas' };

                          const label = labels[key] || key;
                          return (
                            <div key={key} className="flex items-center justify-between bg-slate-950/40 border border-slate-850/80 p-2.5 rounded-xl text-[11px] font-bold">
                              <span className="text-slate-450 truncate mr-1">{label}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                value === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                value === 'defeito' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                'bg-slate-800 text-slate-450 border border-slate-750'
                              }`}>
                                {value === 'ok' ? 'OK' : value === 'defeito' ? 'Defeito' : 'N/T'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Galeria de Fotos */}
                  {os.fotos && os.fotos.length > 0 && (
                    <div className="border-t border-slate-850 pt-4 space-y-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">📸 Imagens de Entrada (Estado do Item)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {os.fotos.map((url, idx) => (
                          <a href={url} target="_blank" rel="noreferrer" key={idx} className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-850 hover:border-indigo-500 transition-all">
                            <img src={url} alt={`Foto Check-in ${idx + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Estado Físico */}
                  <div className="border-t border-slate-850 pt-4 space-y-1.5 text-xs">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{isVeiculo ? 'Avarias do Veículo' : 'Avarias do Aparelho'}</p>
                    <p className="text-slate-350 bg-slate-950/40 p-4 rounded-2xl border border-slate-850/60 font-medium leading-relaxed">
                      {os.equipamento?.estadoFisico || "Nenhuma avaria visível ou detalhe técnico anotado na entrada."}
                    </p>
                  </div>
                </div>

                {/* Descrição dos Laudos Técnicos */}
                <div className="bg-slate-900/30 border border-slate-850 rounded-[2.2rem] p-6 md:p-8 space-y-6 shadow-xl">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-slate-850 pb-3 flex items-center gap-2">
                    <IoBuildOutline size={18} className="text-indigo-400" />
                    <span>Laudo e Parecer Técnico</span>
                  </h4>
                  <div className="space-y-4 text-xs font-medium">
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Problema Relatado</p>
                      <p className="text-slate-300 leading-relaxed bg-slate-950/45 p-4 rounded-xl border border-slate-850">{os.defeitoRelatado || '---'}</p>
                    </div>
                    {os.defeitoDetectado && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Problema Detectado em Laboratório</p>
                        <p className="text-slate-350 leading-relaxed bg-slate-950/45 p-4 rounded-xl border border-slate-850">{os.defeitoDetectado}</p>
                      </div>
                    )}
                    {os.diagnosticoTecnico && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Procedimento / Parecer Técnico</p>
                        <p className="text-slate-300 leading-relaxed bg-slate-950/45 p-4 rounded-xl border border-slate-850">{os.diagnosticoTecnico}</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* COL 3: VALORES COMERCIAIS, TERMOS E TIMELINE */}
              <div className="space-y-6">
                
                {/* Resumo de Custos e Totais */}
                <div className="bg-slate-900 border border-slate-855 rounded-[2.2rem] p-6 shadow-xl space-y-5 text-white">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-850 pb-3 flex items-center gap-2">
                    <IoWalletOutline size={16} />
                    <span>Tabela Comercial</span>
                  </h4>

                  <div className="text-xs font-bold space-y-2 border-b border-slate-850 pb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-450">Serviços Executados</span>
                      <span>R$ {valorServicos.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">Substituição de Peças</span>
                      <span>R$ {valorPecas.toFixed(2)}</span>
                    </div>
                    {Number(os.desconto || 0) > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>Desconto</span>
                        <span>- R$ {parseFloat(os.desconto).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-end pt-1">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Preço Final</p>
                      <p className="text-3xl font-black text-white mt-1">R$ {total.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pagamento</p>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider inline-block mt-2 ${
                        os.situacaoFinanceira === 'pago'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      }`}>
                        {os.situacaoFinanceira === 'pago' ? 'PAGO' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Termos de Garantia */}
                <div className="bg-slate-900/30 border border-slate-850 rounded-[2.2rem] p-6 shadow-xl space-y-3">
                  <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Termo de Garantia</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                    Este reparo possui garantia comercial de <span className="text-white font-extrabold">{os.garantiaDias} dias</span> a partir da data de entrega. A garantia cobre exclusivamente defeitos dos componentes substituídos, e perde a validade em casos de mau uso, quedas ou contato com líquidos.
                  </p>
                </div>

                {/* Assinatura Digital do Cliente se já estiver disponível */}
                {os.assinaturaCliente && (
                  <div className="bg-slate-900/30 border border-slate-850 rounded-[2.2rem] p-6 shadow-xl text-center space-y-3">
                    <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Assinatura de Recebimento</h4>
                    <div className="border border-slate-800 rounded-2xl bg-white p-3 inline-block">
                      <img src={os.assinaturaCliente} alt="Assinatura Digital" className="max-h-[60px] object-contain" />
                    </div>
                    <p className="text-[9px] text-slate-500 font-extrabold">Assinado eletronicamente via portal de retirada.</p>
                  </div>
                )}

                {/* Dados da OS / Prazos */}
                <div className="bg-slate-900/30 border border-slate-850 rounded-[2.2rem] p-6 shadow-xl space-y-4">
                  <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-widest border-b border-slate-850 pb-2">Informações Gerais</h4>
                  <div className="text-xs font-bold space-y-2">
                    <div className="flex justify-between items-center bg-slate-950/30 p-3 rounded-xl border border-slate-850/50">
                      <span className="text-slate-500 text-[9px] uppercase">Técnico Responsável</span>
                      <span className="text-slate-350">{os.tecnicoResponsavel?.nome || 'Equipe Geral'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/30 p-3 rounded-xl border border-slate-850/50">
                      <span className="text-slate-500 text-[9px] uppercase">Previsão de Entrega</span>
                      <span className="text-slate-350">
                        {os.dataPrevisaoEntrega
                          ? new Date(os.dataPrevisaoEntrega.toDate ? os.dataPrevisaoEntrega.toDate() : os.dataPrevisaoEntrega).toLocaleDateString('pt-BR')
                          : 'Sem previsão'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline do Cliente */}
                <div className="bg-slate-900/30 border border-slate-850 rounded-[2.2rem] p-6 shadow-xl space-y-5">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-slate-850 pb-2 flex items-center gap-2">
                    <IoTimeOutline size={18} className="text-indigo-400" />
                    <span>Linha do Tempo</span>
                  </h4>
                  <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                    {os.timeline && os.timeline.length > 0 ? (
                      os.timeline.map((event, idx) => (
                        <div key={idx} className="flex gap-3 text-xs relative">
                          {idx !== os.timeline.length - 1 && (
                            <div className="absolute top-4 left-2.5 bottom-[-16px] w-[1px] bg-slate-800" />
                          )}
                          <div className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[9px] font-black text-indigo-400 shrink-0 relative z-10">
                            {idx + 1}
                          </div>
                          <div className="space-y-1">
                            <p className="text-slate-300 font-bold leading-snug">{event.anotacao}</p>
                            <p className="text-[9px] text-slate-500 font-semibold">
                              {event.data?.toDate ? event.data.toDate().toLocaleString('pt-BR') : new Date(event.data).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 font-bold text-center py-4">Sem histórico público registrado.</p>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-[10px] text-slate-650 font-bold mt-12">
        <p>© 2026 {estabInfo?.nome || 'IdeaFood Technology'} • Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
