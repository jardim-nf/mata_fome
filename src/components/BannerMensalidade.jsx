// src/components/BannerMensalidade.jsx — Aviso de Mensalidade para Admin do Estabelecimento
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaLock,
  FaTimes, FaWhatsapp, FaCalendarAlt, FaShieldAlt
} from 'react-icons/fa';

const BannerMensalidade = () => {
  const { currentUser, userData , estabelecimentoIdPrincipal } = useAuth();
  const [status, setStatus] = useState(null); // 'ok' | 'vencendo' | 'atrasado' | 'bloqueado'
  const [info, setInfo] = useState(null);
  const [certInfo, setCertInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!currentUser || !userData) return;

    const checkMensalidade = async () => {
      try {
        const estabId = userData.estabelecimentoIdPrincipal;
        if (!estabId) return;

        // Buscar dados do estabelecimento (nextBillingDate, currentPlanId)
        const estabDoc = await getDoc(doc(db, 'estabelecimentos', estabId));
        if (!estabDoc.exists()) return;
        const estabData = estabDoc.data();

        // Verificar certificado digital
        if (estabData.fiscal?.certificadoUrl) {
          const certValidade = estabData.fiscal?.certificadoValidade;
          if (certValidade) {
            const certDate = certValidade.toDate ? certValidade.toDate() : new Date(certValidade);
            const diasParaVencer = differenceInDays(certDate, new Date());
            setCertInfo({
              vencimento: certDate,
              diasParaVencer,
              status: diasParaVencer < 0 ? 'vencido' : diasParaVencer <= 30 ? 'vencendo' : 'ok'
            });
          }
        }

        // Buscar faturas pendentes deste estabelecimento
        const faturasQuery = query(
          collection(db, 'faturas'),
          where('estabelecimentoId', '==', estabId),
          where('status', '==', 'pendente')
        );
        const faturasSnap = await getDocs(faturasQuery);

        if (faturasSnap.empty) {
          // Sem faturas pendentes — tudo em dia
          const nextBilling = estabData.nextBillingDate;
          if (nextBilling) {
            const nextDate = nextBilling.toDate ? nextBilling.toDate() : new Date(nextBilling);
            const diasRestantes = differenceInDays(nextDate, new Date());
            setStatus('ok');
            setInfo({
              proximoVencimento: nextDate,
              diasRestantes,
              planoId: estabData.currentPlanId || null
            });
          }
          return;
        }

        // Verificar a fatura mais antiga pendente
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let maisAtrasada = null;
        let diasAtraso = 0;

        faturasSnap.docs.forEach(d => {
          const fatura = d.data();
          const venc = fatura.vencimento?.toDate ? fatura.vencimento.toDate() : new Date(fatura.vencimento);
          venc.setHours(0, 0, 0, 0);
          const diff = differenceInDays(hoje, venc);
          if (diff > diasAtraso) {
            diasAtraso = diff;
            maisAtrasada = { ...fatura, id: d.id, vencimentoDate: venc };
          }
        });

        if (!maisAtrasada) {
          // Faturas pendentes mas ainda não vencidas
          const proximaFatura = faturasSnap.docs
            .map(d => {
              const data = d.data();
              return {
                ...data,
                id: d.id,
                vencimentoDate: data.vencimento?.toDate ? data.vencimento.toDate() : new Date(data.vencimento)
              };
            })
            .sort((a, b) => a.vencimentoDate - b.vencimentoDate)[0];

          const diasParaVencer = differenceInDays(proximaFatura.vencimentoDate, hoje);

          if (diasParaVencer <= 5) {
            setStatus('vencendo');
            setInfo({
              valor: proximaFatura.valor,
              vencimento: proximaFatura.vencimentoDate,
              diasParaVencer,
              descricao: proximaFatura.descricao
            });
          } else {
            setStatus('ok');
            setInfo({
              proximoVencimento: proximaFatura.vencimentoDate,
              diasRestantes: diasParaVencer
            });
          }
          return;
        }

        // Fatura atrasada
        if (diasAtraso > 15) {
          setStatus('bloqueado');
        } else {
          setStatus('atrasado');
        }
        setInfo({
          valor: maisAtrasada.valor,
          vencimento: maisAtrasada.vencimentoDate,
          diasAtraso,
          descricao: maisAtrasada.descricao
        });

      } catch (err) {
        console.error('[BannerMensalidade] Erro:', err);
      }
    };

    checkMensalidade();
  }, [currentUser, userData]);

  if (!status || dismissed) return null;

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d) => d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : '--';

  // ─── Status: OK ───
  if (status === 'ok' && !certInfo?.status?.includes('venc')) return null;

  // ─── Certificado vencendo/vencido (mostrar mesmo se mensalidade OK) ───
  const certBanner = certInfo && certInfo.status !== 'ok' ? (
    <div className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold ${
      certInfo.status === 'vencido'
        ? 'bg-red-50 border border-red-200 text-red-700'
        : 'bg-orange-50 border border-orange-200 text-orange-700'
    }`}>
      <FaShieldAlt />
      <span>
        {certInfo.status === 'vencido'
          ? `🔐 Certificado digital VENCIDO desde ${fmtDate(certInfo.vencimento)}! Emissão de NFC-e bloqueada.`
          : `🔐 Certificado digital vence em ${certInfo.diasParaVencer} dias (${fmtDate(certInfo.vencimento)}). Renove para evitar interrupção na emissão.`
        }
      </span>
    </div>
  ) : null;

  // ─── Status: Vencendo (amarelo) ───
  if (status === 'vencendo') {
    return (
      <div className="space-y-2 mb-4">
        <div className="relative bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4 shadow-sm animate-slideDown">
          <button onClick={() => setDismissed(true)} className="absolute top-3 right-3 text-amber-400 hover:text-amber-600 transition-colors">
            <FaTimes size={12} />
          </button>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <FaExclamationTriangle className="text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-amber-800 text-sm tracking-tight">
                ⏰ Mensalidade vence em {info.diasParaVencer} {info.diasParaVencer === 1 ? 'dia' : 'dias'}
              </h4>
              <p className="text-amber-700 text-xs mt-1 font-medium">
                {info.descricao} • Vencimento: {fmtDate(info.vencimento)} • Valor: {fmt(info.valor)}
              </p>
              <p className="text-amber-600 text-[10px] mt-2 font-bold">
                Evite a suspensão — entre em contato com o suporte para regularizar.
              </p>
            </div>
          </div>
        </div>
        {certBanner}
      </div>
    );
  }

  // ─── Status: Atrasado (vermelho) ───
  if (status === 'atrasado') {
    return (
      <div className="space-y-2 mb-4">
        <div className="relative bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0 animate-pulse mt-0.5">
              <FaTimesCircle className="text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-red-800 text-sm tracking-tight">
                🚨 Mensalidade ATRASADA há {info.diasAtraso} {info.diasAtraso === 1 ? 'dia' : 'dias'}
              </h4>
              <p className="text-red-700 text-xs mt-1 font-medium">
                {info.descricao} • Venceu em: {fmtDate(info.vencimento)} • Valor: {fmt(info.valor)}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <a href="https://wa.me/5500000000000?text=Olá, preciso regularizar minha mensalidade do sistema IdeaFood."
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-emerald-500 text-white text-[11px] font-black px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors">
                  <FaWhatsapp /> Falar com Suporte
                </a>
                <span className="text-red-500 text-[10px] font-bold">
                  ⚠️ Após 15 dias, o acesso será suspenso automaticamente.
                </span>
              </div>
            </div>
          </div>
        </div>
        {certBanner}
      </div>
    );
  }

  // ─── Status: Bloqueado (overlay) ───
  if (status === 'bloqueado') {
    return (
      <>
        {/* Overlay de bloqueio */}
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-red-200">
            <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6 border border-red-100">
              <FaLock className="text-red-500 text-3xl" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
              Acesso Suspenso
            </h2>
            <p className="text-slate-500 text-sm font-medium mb-4">
              Sua mensalidade está atrasada há <span className="text-red-600 font-black">{info.diasAtraso} dias</span>.
              O acesso ao painel administrativo foi temporariamente suspenso.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500 font-medium">Valor pendente:</span>
                <span className="text-red-700 font-black">{fmt(info.valor)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Vencimento:</span>
                <span className="text-red-700 font-black">{fmtDate(info.vencimento)}</span>
              </div>
            </div>
            <a href="https://wa.me/5500000000000?text=Olá, preciso regularizar minha mensalidade do sistema IdeaFood. Meu acesso está suspenso."
              target="_blank" rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 text-white font-black py-3 rounded-xl hover:bg-emerald-600 transition-colors text-sm">
              <FaWhatsapp /> Regularizar via WhatsApp
            </a>
            <p className="text-[10px] text-slate-400 mt-4 font-medium">
              O acesso será restaurado automaticamente após a confirmação do pagamento pelo administrador.
            </p>
          </div>
        </div>
        {certBanner}
      </>
    );
  }

  // ─── Só certificado com problema (mensalidade ok) ───
  if (certBanner) {
    return <div className="mb-4">{certBanner}</div>;
  }

  return null;
};

export default BannerMensalidade;
