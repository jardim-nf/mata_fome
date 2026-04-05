// src/pages/admin/MarketingConfig.jsx — Configuração de Marketing Automático
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { IoArrowBack, IoMegaphoneOutline, IoCheckmarkCircle, IoAlertCircle, IoPeopleOutline, IoCalendarOutline } from 'react-icons/io5';

function MarketingConfig() {
  const { userData } = useAuth();
  const estabId = userData?.estabelecimentosGerenciados?.[0];

  const [config, setConfig] = useState({ ativo: false, diasInativo: 7, mensagem: '', limiteDiario: 20, aniversario: false, aniversarioDesconto: 15, aniversarioMsg: '' });
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // IA State
  const [aiFoco, setAiFoco] = useState('engajamento');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Push States
  const [pushUsers, setPushUsers] = useState([]);
  const [pushTitle, setPushTitle] = useState('Oi, sumido! Bateu uma fome? 👀');
  const [pushBody, setPushBody] = useState('Olha o que separamos pra você hoje com entrega grátis. Entra aí!');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [isSendingPush, setIsSendingPush] = useState(false);

  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      const snap = await getDoc(doc(db, 'estabelecimentos', estabId));
      const data = snap.data()?.marketing || {};
      setConfig({
        ativo: data.ativo || false,
        diasInativo: data.diasInativo || 7,
        mensagem: data.mensagem || `Ei! Faz tempo que você não pede! 🍔 Que tal pedir hoje? Estamos com novidades!`,
        limiteDiario: data.limiteDiario || 20,
        aniversario: data.aniversario || false,
        aniversarioDesconto: data.aniversarioDesconto || 15,
        aniversarioMsg: data.aniversarioMsg || `🎂 Feliz aniversário! Toma um desconto especial pra comemorar!`
      });

      // Últimas campanhas
      try {
        const campSnap = await getDocs(query(collection(db, 'estabelecimentos', estabId, 'campanhas'), orderBy('enviadoEm', 'desc'), limit(20)));
        setCampanhas(campSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn('[MarketingConfig] Erro ao carregar campanhas anteriores:', e);
      }
      
      // Busca clientes com token de Push (FCM)
      try {
        const clientSnap = await getDocs(collection(db, 'clientes'));
        const usersApp = clientSnap.docs.map(d => ({uid: d.id, ...d.data()})).filter(u => u.fcmToken);
        setPushUsers(usersApp);
      } catch(e) {
          console.warn("[MarketingConfig] Erro listando clientes push", e);
      }

      setLoading(false);
    };
    load();
  }, [estabId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId), { marketing: config });
      toast.success('✅ Marketing configurado!');
    } catch (e) {
      toast.error('Erro ao salvar');
    }
    setSaving(false);
  };

  const handleGenerateCopy = async () => {
    setIsGenerating(true);
    setGeneratedText('');
    try {
      // Simulação ou conexão real com o AIContext / Functions no futuro
      await new Promise(r => setTimeout(r, 2500));
      let response = '';
      if (aiFoco === 'engajamento') {
          response = "🍔 Bateu aquela fome de verdade? Não passe vontade! 🔥\n\nNossos lanches estão saindo quentinhos agora mesmo. Peça o seu combo favorito e garanta a melhor pausa do seu dia!\n\n📲 Link na bio para pedir!\n\n#fome #lanches #hamburguer #delivery #sabor";
      } else if (aiFoco === 'promocao') {
          response = "🚨 PROMOÇÃO RELÂMPAGO! 🚨\n\nSó hoje você pede o nosso destaque da casa com um desconto especial. Vai ficar de fora dessa?\n\nCorre no nosso link e aproveita enquanto durar o estoque! 🏃‍♂️💨\n\n#promocao #desconto #delivery #oferta #ifood";
      } else {
          response = "Sabe qual o segredo da felicidade? Nosso cardápio! 😍\n\nMarca aquele amigo(a) que está te devendo um lanche hoje. Se não responder em 5 min, ele paga um X-Tudo pra você! 🍔👇\n\n#amizade #comida #delivery #marcaai #xtudo";
      }
      setGeneratedText(response);
      toast.success('Copy gerada pela IA com sucesso! ✨');
    } catch (e) {
      toast.error('Falha ao gerar o copy');
    }
    setIsGenerating(false);
  };

  const handleShootPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) return toast.error('Preencha título e mensagem!');
    if (!selectedTarget) return toast.error('Selecione para quem enviar!');
    
    setIsSendingPush(true);
    let enviados = 0;
    
    try {
        const sendPushFunction = httpsCallable(functions, 'sendMarketingPush');
        
        let alvos = selectedTarget === 'all' ? pushUsers : pushUsers.filter(u => u.uid === selectedTarget);
        
        for (let user of alvos) {
            try {
                await sendPushFunction({
                    targetUid: user.uid,
                    titulo: pushTitle,
                    mensagem: pushBody
                });
                enviados++;
            } catch (err) {
                console.warn(`Erro enviando para ${user.nome || user.uid}:`, err);
            }
        }
        
        if (enviados > 0) {
            toast.success(`🚀 Notificação disparada com sucesso para ${enviados} cliente(s)!`);
        } else {
            toast.error('Ninguém recebeu. Talvez a chave esteja revogada.');
        }
    } catch (e) {
        console.error(e);
        toast.error('Erro de servidor ao disparar Push Notification!');
    }
    setIsSendingPush(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans pb-20 relative overflow-hidden">
      {/* Background Blobs para o Efeito Glass */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-[10%] left-[20%] w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 pointer-events-none"></div>

      <div className="max-w-2xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm">
            <IoArrowBack size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <IoMegaphoneOutline className="text-purple-500" /> Marketing Automático
            </h1>
            <p className="text-xs text-gray-400 font-medium">Reengaje clientes inativos automaticamente</p>
          </div>
        </div>

        {/* Status */}
        <div className={`rounded-[2rem] p-6 mb-6 border backdrop-blur-xl transition-all duration-500 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${config.ativo ? 'bg-purple-50/70 border-white/60' : 'bg-white/60 border-white/40'}`}>
          <div className="flex items-center gap-4">
            {config.ativo ? (
              <><div className="p-3 bg-purple-100/50 rounded-2xl"><IoCheckmarkCircle className="text-purple-600 text-3xl" /></div><div><p className="font-extrabold text-purple-900 text-lg">Marketing Ativado</p><p className="text-xs text-purple-600 font-medium tracking-wide">Automação roda diariamente às 10h</p></div></>
            ) : (
              <><div className="p-3 bg-slate-100 rounded-2xl"><IoAlertCircle className="text-slate-400 text-3xl" /></div><div><p className="font-extrabold text-slate-700 text-lg">Sistema Pausado</p><p className="text-xs text-slate-500 font-medium tracking-wide">O robô não está enviando mensagens</p></div></>
            )}
          </div>
        </div>

        {/* Explicação */}
        <div className="bg-white/70 backdrop-blur-md rounded-[1.5rem] border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 mb-8">
          <h3 className="text-[13px] font-black text-slate-800 tracking-wide uppercase mb-4 flex items-center gap-2"><span className="text-lg">🤖</span> Entenda a Mágica</h3>
          <div className="space-y-3 text-sm text-slate-600 font-medium">
            <p className="flex items-start gap-2"><span className="text-purple-500 font-bold">1.</span> O sistema escaneia quem <strong>não pede</strong> há X dias.</p>
            <p className="flex items-start gap-2"><span className="text-purple-500 font-bold">2.</span> Cria e agenda uma campanha de resgate.</p>
            <p className="flex items-start gap-2"><span className="text-purple-500 font-bold">3.</span> O WhatsApp Bot dispara automaticamente mensagens magnéticas.</p>
          </div>
        </div>

        {/* Config */}
        <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 space-y-6 mb-8">
          <div className="border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-[13px] font-black text-slate-800 tracking-wide uppercase">⚙️ Gatilhos da Automação</h3>
          </div>

          <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl">
            <div>
              <p className="text-sm font-extrabold text-slate-800">Motor de Recuperação</p>
              <p className="text-xs text-slate-500 font-medium">Ligar procura de clientes inativos</p>
            </div>
            <button onClick={() => setConfig(p => ({...p, ativo: !p.ativo}))}
              className={`w-14 h-7 rounded-full transition-all duration-300 relative ${config.ativo ? 'bg-purple-500 shadow-lg shadow-purple-500/30' : 'bg-slate-300'}`}>
              <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all duration-300 ${config.ativo ? 'left-[30px]' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Considerar inativo após</label>
                <select value={config.diasInativo} onChange={e => setConfig(p => ({...p, diasInativo: Number(e.target.value)}))}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-300 transition-all">
                  <option value={3}>3 dias sem pedir</option>
                  <option value={5}>5 dias sem pedir</option>
                  <option value={7}>7 dias sem pedir</option>
                  <option value={14}>14 dias sem pedir</option>
                  <option value={30}>30 dias sem pedir</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Limite diário de envio</label>
                <input type="number" value={config.limiteDiario} onChange={e => setConfig(p => ({...p, limiteDiario: Number(e.target.value)}))}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-300 transition-all" min={1} max={100} />
              </div>
          </div>

          <div className="pt-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Mensagem Magnética Padrão</label>
            <textarea value={config.mensagem} onChange={e => setConfig(p => ({...p, mensagem: e.target.value}))}
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 resize-none h-28 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-300 transition-all leading-relaxed"
              maxLength={500} placeholder="Oi! Percebemos que sumiu..." />
            <p className="text-[10px] font-bold text-slate-400 text-right mt-1">{config.mensagem.length}/500</p>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-[13px] uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 mt-4">
            <IoMegaphoneOutline size={18}/> {saving ? 'Salvando Definições...' : 'Atualizar Motor de Vendas'}
          </button>
        </div>

        {/* Gerador de IA */}
        <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8 space-y-6 mb-8 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
          
          <div>
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                <span className="text-2xl drop-shadow-md">✨</span> Copywriter de Bolso (IA)
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Textos hipnóticos para Instagram e WhatsApp gerados instantaneamente.</p>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
             <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-2">Diretriz da Inteligência Artificial</label>
             <select value={aiFoco} onChange={e => setAiFoco(e.target.value)}
               className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all cursor-pointer">
               <option value="engajamento">Gerar POST de Engajamento e Interação</option>
               <option value="promocao">Criar CHAMADA AGRESSIVA de Oferta</option>
               <option value="brincadeira">Escrever BRINCADEIRA de Marcar os Amigos</option>
             </select>
          </div>

          <button onClick={handleGenerateCopy} disabled={isGenerating}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black text-[13px] uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center shadow-xl shadow-indigo-600/20">
            {isGenerating ? <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" /> : '🤖 Gerar Copy com IA'}
          </button>

          {generatedText && (
            <div className="mt-6 p-6 bg-gradient-to-b from-indigo-50/80 to-white border border-indigo-100 rounded-[1.5rem] shadow-inner animate-slideUp">
              <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{generatedText}</p>
              <button onClick={() => { navigator.clipboard.writeText(generatedText); toast.success('Copiado para a área de transferência! 🚀'); }}
               className="mt-6 w-full py-3 bg-white text-indigo-600 font-black text-[12px] uppercase tracking-wider rounded-xl border-2 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all shadow-sm">
                📋 Copiar Texto para o Ctrl+V
              </button>
            </div>
          )}
        </div>

        {/* Cupom de Aniversário */}
        <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 space-y-6 mb-8">
          <div className="border-b border-slate-100 pb-4 mb-2">
              <h3 className="text-[13px] font-black text-pink-600 tracking-wide uppercase flex items-center gap-2 border-b-transparent">🎂 Motor de Aniversariantes</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Conceda presentes automáticos nas datas comemorativas</p>
          </div>

          <div className="flex items-center justify-between bg-pink-50/50 p-4 rounded-2xl border border-pink-100/50">
            <div>
              <p className="text-sm font-extrabold text-slate-800">Oferecer Desconto</p>
              <p className="text-xs text-slate-500 font-medium">Boleto grátis! Não, mentira. É só um cupom mesmo.</p>
            </div>
            <button onClick={() => setConfig(p => ({...p, aniversario: !p.aniversario}))}
              className={`w-14 h-7 rounded-full transition-all duration-300 relative ${config.aniversario ? 'bg-pink-500 shadow-lg shadow-pink-500/30' : 'bg-slate-300'}`}>
              <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all duration-300 ${config.aniversario ? 'left-[30px]' : 'left-0.5'}`}></div>
            </button>
          </div>

          {config.aniversario && (
            <div className="animate-slideUp space-y-4">
              <div>
                <label className="text-[10px] font-bold text-pink-500 uppercase tracking-wider block mb-2">Desconto Presenteado</label>
                <select value={config.aniversarioDesconto} onChange={e => setConfig(p => ({...p, aniversarioDesconto: Number(e.target.value)}))}
                  className="w-full p-3.5 bg-white border border-pink-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-pink-500/10 transition-all text-pink-700">
                  <option value={5}>Mimo (5% de desconto)</option>
                  <option value={10}>Padrão (10% de desconto)</option>
                  <option value={15}>Amigão (15% de desconto)</option>
                  <option value={20}>Especial (20% de desconto)</option>
                  <option value={30}>Uau! (30% de desconto)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Torpedo de Parabéns</label>
                <textarea value={config.aniversarioMsg} onChange={e => setConfig(p => ({...p, aniversarioMsg: e.target.value}))}
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 resize-none h-24 outline-none focus:ring-4 focus:ring-pink-500/10 focus:border-pink-300 transition-all leading-relaxed"
                  maxLength={300} placeholder="Feliz Aniversário!" />
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl font-black text-[13px] uppercase tracking-wide transition-all disabled:opacity-50 flex justify-center shadow-xl shadow-pink-500/20 mt-4">
            {saving ? 'Registrando Presente...' : 'Salvar Motor de Aniversário'}
          </button>
        </div>

        {/* Disparo de Push Notifications App (VIP) */}
        <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8 space-y-6 mb-8 relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
             
             <div>
                 <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                    <span className="text-2xl drop-shadow-md">📲</span> Radar Push (App)
                 </h3>
                 <p className="text-sm text-slate-500 font-medium mt-1">Acorde o aplicativo do cliente com uma vibração e mensagem.</p>
             </div>

             <div className="space-y-4 pt-2">
                 <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                    <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-2">Para quem vai o tiro?</label>
                    <select value={selectedTarget} onChange={e => setSelectedTarget(e.target.value)}
                        className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all cursor-pointer">
                        <option value="">-- Selecione a Mira --</option>
                        {pushUsers.length > 0 && <option value="all" className="bg-blue-50 font-bold text-blue-800">🌩️ DISPARO GLOBAL (Todos que baixaram o app e ativaram alertas)</option>}
                        {pushUsers.map(u => (
                            <option key={u.uid} value={u.uid}>🎯 Sniper: {u.nome || u.telefone || 'Sem Nome'} (Inscrito)</option>
                        ))}
                    </select>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-4 bg-white/50 p-1">
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Chamada Curta (Título)</label>
                        <input type="text" value={pushTitle} onChange={e => setPushTitle(e.target.value)}
                            className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all placeholder:font-normal placeholder:text-slate-400" 
                            placeholder="Ex: 🚨 A pizza já tá no forno pra você!" maxLength={35}/>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Mensagem do Alerta (Preview na Tela de Bloqueio)</label>
                        <textarea value={pushBody} onChange={e => setPushBody(e.target.value)} rows={2}
                            className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 resize-none outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all placeholder:text-slate-400" 
                            placeholder="Clique aqui e aproveite o cupom relâmpago de sexta!" maxLength={100}/>
                     </div>
                 </div>
             </div>

             <button onClick={handleShootPush} disabled={isSendingPush || !selectedTarget || pushUsers.length === 0}
                className="w-full mt-2 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[13px] uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center shadow-xl shadow-blue-600/20">
                {isSendingPush ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> : '🚀 APERTAR O BOTÃO VERMELHO (Disparar)'}
             </button>
             {pushUsers.length === 0 && (
                 <div className="text-center bg-rose-50 rounded-xl p-3 border border-rose-100">
                     <p className="text-xs text-rose-600 font-bold">Ainda não há clientes com o push do app ativado no radar.</p>
                 </div>
             )}
        </div>

        {/* Histórico */}
        <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-8">
          <div className="border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-[13px] font-black text-slate-800 tracking-wide uppercase flex items-center gap-2">
                <IoCalendarOutline className="text-purple-500 text-lg" /> Radar Histórico de Abordagens
              </h3>
          </div>
          
          {campanhas.length === 0 ? (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 flex justify-center">
                <p className="text-center font-bold text-slate-400 text-sm">O silêncio antes do lucro.<br/><span className="font-medium text-xs mt-1 block">As campanhas disparadas aparecerão aqui.</span></p>
            </div>
          ) : (
            <div className="space-y-3">
              {campanhas.map(c => (
                <div key={c.id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-3 bg-purple-50 rounded-xl">
                      <IoPeopleOutline className="text-purple-500 text-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{c.clienteNome}</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Foi cutucado após {c.diasInativo} dias em coma de lanche</p>
                  </div>
                  <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl uppercase tracking-wider">{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default withEstablishmentAuth(MarketingConfig);
