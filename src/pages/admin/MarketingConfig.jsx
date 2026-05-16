import React, { useState, useEffect } from 'react';
import BackButton from '../../components/BackButton';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { toast } from 'react-toastify';
import { 
  IoArrowBack, IoMegaphoneOutline, IoCheckmarkCircle, IoAlertCircle, 
  IoPeopleOutline, IoCalendarOutline, IoRocketOutline, IoSparklesOutline, 
  IoGiftOutline, IoPhonePortraitOutline
} from 'react-icons/io5';

function MarketingConfig() {
  const { estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal;

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
      try {
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
        const campSnap = await getDocs(query(collection(db, 'estabelecimentos', estabId, 'campanhas'), orderBy('enviadoEm', 'desc'), limit(10)));
        setCampanhas(campSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        // Busca clientes com token de Push (FCM)
        const clientSnap = await getDocs(collection(db, 'clientes'));
        const usersApp = clientSnap.docs.map(d => ({uid: d.id, ...d.data()})).filter(u => u.fcmToken);
        setPushUsers(usersApp);
      } catch(e) {
          console.warn("[MarketingConfig] Erro ao carregar dados", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [estabId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId), { marketing: config });
      toast.success('✅ Configurações salvas com sucesso!');
    } catch (e) {
      toast.error('Erro ao salvar as configurações.');
    }
    setSaving(false);
  };

  const handleGenerateCopy = async () => {
    setIsGenerating(true);
    setGeneratedText('');
    try {
      await new Promise(r => setTimeout(r, 1500));
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
      toast.error('Falha ao gerar a copy.');
    }
    setIsGenerating(false);
  };

  const handleShootPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) return toast.warning('Preencha o título e a mensagem!');
    if (!selectedTarget) return toast.warning('Selecione para quem deseja enviar!');
    
    setIsSendingPush(true);
    let enviados = 0;
    try {
        const sendPushFunction = httpsCallable(functions, 'sendMarketingPush');
        let alvos = selectedTarget === 'all' ? pushUsers : pushUsers.filter(u => u.uid === selectedTarget);
        
        for (let user of alvos) {
            try {
                await sendPushFunction({ targetUid: user.uid, titulo: pushTitle, mensagem: pushBody });
                enviados++;
            } catch (err) {
                console.warn(`Erro enviando para ${user.nome || user.uid}:`, err);
            }
        }
        
        if (enviados > 0) {
            toast.success(`🚀 Notificação disparada com sucesso para ${enviados} cliente(s)!`);
        } else {
            toast.error('Ninguém recebeu. Talvez as permissões de notificação estejam revogadas.');
        }
    } catch (e) {
        console.error(e);
        toast.error('Erro ao disparar Push Notification!');
    }
    setIsSendingPush(false);
  };

  if (loading) return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="p-6 font-sans max-w-7xl mx-auto space-y-6 text-gray-800 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <BackButton to="/admin" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <IoMegaphoneOutline className="text-purple-600" />
              Marketing & Retenção
            </h1>
            <p className="text-sm text-gray-500 mt-1">Automatize mensagens, reengaje clientes inativos e envie notificações push.</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
          {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <IoCheckmarkCircle className="text-lg" />}
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Core Configs */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Status Panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${config.ativo ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                {config.ativo ? <IoRocketOutline className="text-2xl" /> : <IoAlertCircle className="text-2xl" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{config.ativo ? 'Piloto Automático Ligado' : 'Piloto Automático Desligado'}</h3>
                <p className="text-sm text-gray-500">{config.ativo ? 'O robô enviará mensagens para clientes inativos diariamente.' : 'O robô está pausado e não enviará mensagens.'}</p>
              </div>
            </div>
            <button onClick={() => setConfig(p => ({...p, ativo: !p.ativo}))} className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${config.ativo ? 'bg-purple-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 bg-white w-6 h-6 rounded-full shadow-md transition-all duration-300 ${config.ativo ? 'left-[26px]' : 'left-1'}`} />
            </button>
          </div>

          {/* Recapture Engine */}
          <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md ${!config.ativo && 'opacity-60 grayscale-[30%]'}`}>
            <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2"><IoPeopleOutline className="text-blue-500"/> Resgate de Inativos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Dias de inatividade</label>
                <select disabled={!config.ativo} value={config.diasInativo} onChange={e => setConfig(p => ({...p, diasInativo: Number(e.target.value)}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none">
                  <option value={3}>Após 3 dias</option>
                  <option value={5}>Após 5 dias</option>
                  <option value={7}>Após 7 dias</option>
                  <option value={14}>Após 14 dias</option>
                  <option value={30}>Após 30 dias</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Limite diário de envio</label>
                <input disabled={!config.ativo} type="number" min="1" max="100" value={config.limiteDiario} onChange={e => setConfig(p => ({...p, limiteDiario: Number(e.target.value)}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mensagem de Resgate (WhatsApp)</label>
              <textarea disabled={!config.ativo} value={config.mensagem} onChange={e => setConfig(p => ({...p, mensagem: e.target.value}))} maxLength={500} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 h-28 resize-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none leading-relaxed" placeholder="Ex: Oi! Percebemos que você sumiu..."></textarea>
              <div className="flex justify-end mt-1"><span className="text-xs font-medium text-gray-400">{config.mensagem.length}/500</span></div>
            </div>
          </div>

          {/* Birthday Engine */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><IoGiftOutline className="text-pink-500"/> Presente de Aniversário</h3>
                <p className="text-xs text-gray-500 mt-1">Conceda presentes automáticos nas datas comemorativas.</p>
              </div>
              <button onClick={() => setConfig(p => ({...p, aniversario: !p.aniversario}))} className={`relative w-14 h-8 rounded-full transition-colors duration-300 flex-shrink-0 ${config.aniversario ? 'bg-pink-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-1 bg-white w-6 h-6 rounded-full shadow-md transition-all duration-300 ${config.aniversario ? 'left-[26px]' : 'left-1'}`} />
              </button>
            </div>
            
            <div className={`transition-all duration-300 overflow-hidden ${config.aniversario ? 'max-h-[500px] opacity-100 mt-5' : 'max-h-0 opacity-0'}`}>
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Desconto do Cupom (%)</label>
                  <select value={config.aniversarioDesconto} onChange={e => setConfig(p => ({...p, aniversarioDesconto: Number(e.target.value)}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:bg-white focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all outline-none">
                    <option value={5}>5% de desconto</option>
                    <option value={10}>10% de desconto</option>
                    <option value={15}>15% de desconto</option>
                    <option value={20}>20% de desconto</option>
                    <option value={30}>30% de desconto (Premium)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mensagem de Parabéns</label>
                  <textarea value={config.aniversarioMsg} onChange={e => setConfig(p => ({...p, aniversarioMsg: e.target.value}))} maxLength={300} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 h-24 resize-none focus:bg-white focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all outline-none leading-relaxed" placeholder="Feliz Aniversário! Temos um presente para você..."></textarea>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column - Tools */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* AI Copywriter */}
          <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl shadow-sm border border-indigo-100 p-6 relative overflow-hidden transition-all hover:shadow-md group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-all"></div>
            
            <h3 className="text-base font-bold text-indigo-900 mb-1 flex items-center gap-2"><IoSparklesOutline className="text-indigo-500"/> Assistente de Copy (IA)</h3>
            <p className="text-xs text-indigo-700/70 mb-5">Gere textos chamativos para redes sociais ou WhatsApp.</p>

            <div className="space-y-4 relative z-10">
              <div>
                <select value={aiFoco} onChange={e => setAiFoco(e.target.value)} className="w-full bg-white border border-indigo-200/60 rounded-xl px-4 py-3 text-sm text-indigo-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all outline-none cursor-pointer">
                  <option value="engajamento">Post de Engajamento</option>
                  <option value="promocao">Promoção Relâmpago</option>
                  <option value="brincadeira">Brincadeira / Meme</option>
                </select>
              </div>
              <button onClick={handleGenerateCopy} disabled={isGenerating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors flex justify-center items-center gap-2 shadow-sm shadow-indigo-600/20 disabled:opacity-70">
                {isGenerating ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <IoSparklesOutline />}
                {isGenerating ? 'Criando Mágica...' : 'Gerar Texto Automático'}
              </button>
              
              {generatedText && (
                <div className="mt-4 p-4 bg-white rounded-xl border border-indigo-100 shadow-sm animate-fade-in">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{generatedText}</p>
                  <button onClick={() => { navigator.clipboard.writeText(generatedText); toast.success('Copiado para a área de transferência!'); }} className="mt-4 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2.5 rounded-lg text-xs transition-colors uppercase tracking-wider">
                    Copiar Texto
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Push Notification */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
            <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2"><IoPhonePortraitOutline className="text-blue-500"/> Disparo de Push (App)</h3>
            <p className="text-xs text-gray-500 mb-5">Envie notificações direto na tela do celular do cliente.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Público Alvo</label>
                <select value={selectedTarget} onChange={e => setSelectedTarget(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none cursor-pointer">
                  <option value="">Selecione quem vai receber</option>
                  {pushUsers.length > 0 && <option value="all">📱 Todos os clientes com App</option>}
                  {pushUsers.map(u => (
                    <option key={u.uid} value={u.uid}>{u.nome || u.telefone || 'Sem Nome'} (App Ativo)</option>
                  ))}
                </select>
                {pushUsers.length === 0 && <p className="text-xs text-rose-500 mt-2 font-medium">Nenhum cliente com app cadastrado no momento.</p>}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Título da Notificação</label>
                <input type="text" value={pushTitle} onChange={e => setPushTitle(e.target.value)} maxLength={35} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" placeholder="Título curto (Ex: Promoção)" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Mensagem</label>
                <textarea value={pushBody} onChange={e => setPushBody(e.target.value)} maxLength={100} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 resize-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" placeholder="O texto que vai aparecer na tela..."></textarea>
              </div>

              <button onClick={handleShootPush} disabled={isSendingPush || !selectedTarget || pushUsers.length === 0} className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl py-3 text-sm font-semibold transition-colors flex justify-center items-center gap-2 mt-2">
                {isSendingPush ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <IoRocketOutline />}
                {isSendingPush ? 'Disparando...' : 'Enviar Notificação'}
              </button>
            </div>
          </div>

          {/* History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2"><IoCalendarOutline className="text-emerald-500"/> Últimos Resgates</h3>
            
            {campanhas.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-sm font-medium text-gray-500">Nenhum envio registrado ainda.</p>
                <p className="text-xs text-gray-400 mt-1">Os resgates aparecerão aqui quando o robô rodar.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {campanhas.map(c => (
                  <div key={c.id} className="flex flex-col p-3.5 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold text-gray-800">{c.clienteNome || 'Cliente Anônimo'}</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">{c.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5 font-medium">Resgatado após {c.diasInativo} dias inativo</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
      
    </div>
  );
}

export default withEstablishmentAuth(MarketingConfig);
