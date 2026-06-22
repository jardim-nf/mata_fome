// src/pages/admin/AdminPaymentSettings.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import BackButton from '../../components/BackButton';
import { toast } from 'react-toastify';
import { 
  IoWalletOutline, 
  IoSaveOutline, 
  IoQrCodeOutline, 
  IoCardOutline, 
  IoCashOutline, 
  IoInformationCircleOutline
} from 'react-icons/io5';

const AdminPaymentSettings = () => {
  const { estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formasPagamento, setFormasPagamento] = useState({
    pix_automatico: true,
    pix_manual: true,
    card: true,
    cash: true
  });

  const [chavePix, setChavePix] = useState('');
  const [tokenMercadoPago, setTokenMercadoPago] = useState('');

  useEffect(() => {
    if (!estabId) return;
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'estabelecimentos', estabId));
        if (snap.exists()) {
          const data = snap.data();
          
          // Carregar formasPagamento (mesclando com padrões caso não existam)
          const dbFormas = data.formasPagamento || {};
          setFormasPagamento({
            pix_automatico: dbFormas.pix_automatico !== false,
            pix_manual: dbFormas.pix_manual !== false,
            card: dbFormas.card !== false,
            cash: dbFormas.cash !== false
          });

          setChavePix(data.chavePix || '');
          setTokenMercadoPago(data.tokenMercadoPago || '');
        }
      } catch (error) {
        console.error("Erro ao carregar configurações de pagamento:", error);
        toast.error("Erro ao carregar dados do Firestore.");
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [estabId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId), {
        formasPagamento,
        chavePix: chavePix.trim(),
        tokenMercadoPago: tokenMercadoPago.trim()
      });
      toast.success('✅ Configurações de pagamento salvas com sucesso!');
    } catch (error) {
      console.error("Erro ao salvar configurações de pagamento:", error);
      toast.error('Erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key) => {
    setFormasPagamento(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 font-sans pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <BackButton to="/dashboard" />
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <IoWalletOutline className="text-emerald-600" /> Configurações de Pagamento
            </h1>
            <p className="text-xs text-gray-400 font-medium">Configure os métodos de checkout e chaves de API</p>
          </div>
        </div>

        {/* Métodos de Pagamento */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 mb-6">
          <h3 className="text-sm font-black text-gray-800 border-b pb-2 flex items-center gap-2">
            ⚙️ Formas de Pagamento Ativas
          </h3>

          <div className="divide-y divide-gray-50">
            {/* PIX Automático */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-xl mt-0.5">
                  <IoQrCodeOutline size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">PIX Automático (Mercado Pago)</p>
                  <p className="text-xs text-gray-400 font-medium max-w-sm">
                    Reconhecimento automático do pagamento em tempo real no checkout do cliente. Requer Token Mercado Pago.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('pix_automatico')}
                className={`w-14 h-7 rounded-full relative shrink-0 transition-colors duration-200 ${formasPagamento.pix_automatico ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all duration-200 ${formasPagamento.pix_automatico ? 'left-[30px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* PIX Manual */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <div className="bg-green-50 text-green-600 p-2 rounded-xl mt-0.5">
                  <IoQrCodeOutline size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">PIX Copia e Cola (Manual)</p>
                  <p className="text-xs text-gray-400 font-medium max-w-sm">
                    Gera a string PIX estática e o QR Code. O cliente deve enviar o comprovante manualmente pelo WhatsApp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('pix_manual')}
                className={`w-14 h-7 rounded-full relative shrink-0 transition-colors duration-200 ${formasPagamento.pix_manual ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all duration-200 ${formasPagamento.pix_manual ? 'left-[30px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Cartão na Entrega */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <div className="bg-purple-50 text-purple-600 p-2 rounded-xl mt-0.5">
                  <IoCardOutline size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Cartão de Crédito/Débito (Na Entrega)</p>
                  <p className="text-xs text-gray-400 font-medium max-w-sm">
                    Permite ao cliente escolher pagar com cartão através de maquininha levada pelo entregador.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('card')}
                className={`w-14 h-7 rounded-full relative shrink-0 transition-colors duration-200 ${formasPagamento.card ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all duration-200 ${formasPagamento.card ? 'left-[30px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Dinheiro */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <div className="bg-orange-50 text-orange-600 p-2 rounded-xl mt-0.5">
                  <IoCashOutline size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Dinheiro (Na Entrega)</p>
                  <p className="text-xs text-gray-400 font-medium max-w-sm">
                    Permite ao cliente pagar em dinheiro físico na entrega, incluindo o cálculo de troco se necessário.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('cash')}
                className={`w-14 h-7 rounded-full relative shrink-0 transition-colors duration-200 ${formasPagamento.cash ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all duration-200 ${formasPagamento.cash ? 'left-[30px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Integrações / Chaves API */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5 mb-6">
          <h3 className="text-sm font-black text-gray-800 border-b pb-2 flex items-center gap-2">
            🔑 Credenciais & Integrações
          </h3>

          {/* Chave Pix */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
              Chave PIX Recebedora (PIX Manual)
            </label>
            <input
              type="text"
              value={chavePix}
              onChange={e => setChavePix(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none font-bold text-gray-800 focus:bg-white focus:border-emerald-500 transition-all placeholder-gray-400"
              placeholder="CNPJ, CPF, Celular, E-mail ou Chave Aleatória"
            />
            <p className="text-[10px] text-gray-400 font-medium mt-1">
              Chave utilizada para gerar o código "Copia e Cola" e o QR Code no PIX Manual.
            </p>
          </div>

          {/* Mercado Pago Token */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
              Access Token Mercado Pago (PIX Automático)
            </label>
            <input
              type="password"
              value={tokenMercadoPago}
              onChange={e => setTokenMercadoPago(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none font-mono text-gray-800 focus:bg-white focus:border-emerald-500 transition-all placeholder-gray-400"
              placeholder="APP_USR-..."
            />
            <div className="mt-2 flex items-start gap-1.5 bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100 text-xs">
              <IoInformationCircleOutline size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Como obter o Access Token?</p>
                <p className="text-blue-600 font-medium mt-0.5">
                  Acesse o painel do Mercado Pago Developers, crie uma aplicação e copie o seu Access Token de Produção.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Salvar Botão */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all disabled:opacity-50"
        >
          <IoSaveOutline size={18} />
          {saving ? 'Salvando Configurações...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
};

export default withEstablishmentAuth(AdminPaymentSettings);