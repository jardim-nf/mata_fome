// src/pages/admin/ConfigFiscalScreen.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify';
import { AdminDepartamentosFiscais } from '../../components/admin/AdminDepartamentosFiscais';
import BackButton from '../../components/BackButton';
import { 
  IoDocumentTextOutline, IoBusinessOutline, IoLocationOutline, 
  IoSettingsOutline, IoKeyOutline, IoCheckmarkCircleOutline, 
  IoAlertCircleOutline, IoSaveOutline 
} from 'react-icons/io5';

const ConfigFiscalScreen = () => {
  const { userData, currentUser, estabelecimentoIdPrincipal } = useAuth();
  const [loading, setLoading] = useState(false);
  const [estabelecimentoId, setEstabelecimentoId] = useState(null);
  const [activeTab, setActiveTab] = useState('BASICO');
  
  // Estado do Formulário
  const [form, setForm] = useState({
    cnpj: '',
    ie: '',
    razaoSocial: '',
    nomeFantasia: '',
    regimeTributario: '1', // 1=Simples Nacional, 3=Regime Normal
    cep: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    ambiente: '2', // 1=Produção, 2=Homologação
    cscId: '',
    cscCodigo: '',
    certificadoSenha: '',
    certificadoUrl: '', // URL do arquivo no Storage
    certificadoValidade: '' // Data de vencimento do certificado digital
  });

  const [arquivoCertificado, setArquivoCertificado] = useState(null);

  // Carregar dados existentes ao abrir
  useEffect(() => {
    const carregarDados = async () => {
      if (!userData || !currentUser) return;
      
      const id = estabelecimentoIdPrincipal || userData.estabelecimentoIdPrincipal || currentUser.uid;
      setEstabelecimentoId(id);

      try {
        const docRef = doc(db, 'estabelecimentos', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().fiscal) {
          setForm(prev => ({ ...prev, ...docSnap.data().fiscal }));
        }
      } catch (error) {
        console.error("Erro ao carregar configs:", error);
      }
    };
    carregarDados();
  }, [userData, currentUser, estabelecimentoIdPrincipal]);

  // Função auxiliar para mudança de inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Upload do Certificado e Salvamento
  const handleSalvar = async () => {
    setLoading(true);
    try {
      let urlCertificado = form.certificadoUrl;

      // 1. Se o usuário selecionou um novo arquivo .pfx, faz o upload
      if (arquivoCertificado) {
        const storageRef = ref(storage, `certificados/${estabelecimentoId}/certificado.pfx`);
        await uploadBytes(storageRef, arquivoCertificado);
        urlCertificado = await getDownloadURL(storageRef);
      }

      // 2. Prepara objeto para salvar
      const dadosFiscais = {
        ...form,
        certificadoUrl: urlCertificado,
        updatedAt: new Date()
      };

      // 3. Atualiza no Firestore
      const docRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(docRef, { fiscal: dadosFiscais });

      toast.success('Configurações Fiscais salvas com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 sm:p-6 lg:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
      
      {/* ─── NEBULA GLOWS ─── */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-emerald-400/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-blue-400/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[30%] w-[400px] h-[400px] bg-purple-400/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-6">
        
        {/* Voltar */}
        <BackButton to="/admin" className="mb-4" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <IoDocumentTextOutline size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">Configuração Fiscal</h1>
              <p className="text-slate-500 mt-1 font-medium text-sm">Dados para emissão de NFC-e e Matriz Tributária</p>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex bg-slate-200/40 p-1 rounded-2xl mb-8 max-w-2xl border border-slate-200/30 backdrop-blur-md">
          <button 
            onClick={() => setActiveTab('BASICO')} 
            className={`flex-1 py-3 px-6 rounded-xl font-black text-sm transition-all whitespace-nowrap ${activeTab === 'BASICO' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-200/30' : 'text-slate-500 hover:text-slate-800'}`}
          >
            🏢 Dados da Empresa & Certificado
          </button>
          <button 
            onClick={() => setActiveTab('DEPARTAMENTOS')} 
            className={`flex-1 py-3 px-6 rounded-xl font-black text-sm transition-all whitespace-nowrap ${activeTab === 'DEPARTAMENTOS' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-200/30' : 'text-slate-500 hover:text-slate-800'}`}
          >
            📑 Departamentos Fiscais (Grupos)
          </button>
        </div>

        {activeTab === 'BASICO' ? (
          <div className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
              {/* CARTÃO 1: DADOS DA EMPRESA */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md md:col-span-2">
                <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-emerald-600">
                  <IoBusinessOutline size={20} />
                  Dados da Empresa
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">CNPJ (Apenas números)</label>
                    <input name="cnpj" value={form.cnpj} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="00000000000100" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Inscrição Estadual (IE)</label>
                    <input name="ie" value={form.ie} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="Isento ou Número" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Regime Tributário</label>
                    <select name="regimeTributario" value={form.regimeTributario} onChange={handleChange} className="w-full p-3 bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm cursor-pointer">
                      <option value="1">Simples Nacional</option>
                      <option value="3">Regime Normal</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Razão Social</label>
                    <input name="razaoSocial" value={form.razaoSocial} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="Nome Jurídico da Empresa" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Nome Fantasia</label>
                    <input name="nomeFantasia" value={form.nomeFantasia} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="Nome da Loja" />
                  </div>
                </div>
              </div>

              {/* CARTÃO 2: ENDEREÇO */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md md:col-span-2">
                <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-emerald-600">
                  <IoLocationOutline size={20} />
                  Endereço
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">CEP</label>
                    <input name="cep" value={form.cep} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="00000-000" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Logradouro</label>
                    <input name="endereco" value={form.endereco} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="Rua, Av..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Número</label>
                    <input name="numero" value={form.numero} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="123" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Bairro</label>
                    <input name="bairro" value={form.bairro} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Cidade</label>
                    <input name="cidade" value={form.cidade} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">UF</label>
                    <input name="uf" value={form.uf} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" maxLength={2} placeholder="SP" />
                  </div>
                </div>
              </div>

              {/* CARTÃO 3: PARÂMETROS NFC-E */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md">
                <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-emerald-600">
                  <IoSettingsOutline size={20} />
                  Parâmetros NFC-e
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-2">Ambiente</label>
                    <div className="flex bg-slate-200/45 p-1 rounded-2xl border border-slate-200/25">
                      <button onClick={() => setForm({...form, ambiente: '2'})} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${form.ambiente === '2' ? 'bg-white shadow-sm text-emerald-600 border border-emerald-200/30' : 'text-slate-500 hover:text-slate-800'}`}>HOMOLOGAÇÃO (TESTE)</button>
                      <button onClick={() => setForm({...form, ambiente: '1'})} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${form.ambiente === '1' ? 'bg-white shadow-sm text-red-650 border border-red-200/30' : 'text-slate-500 hover:text-slate-800'}`}>PRODUÇÃO</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">CSC ID (Token ID)</label>
                    <input name="cscId" value={form.cscId} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="Ex: 000001" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Código CSC (Alfanumérico)</label>
                    <input name="cscCodigo" value={form.cscCodigo} onChange={handleChange} type="text" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="Ex: A1B2C3D4..." />
                  </div>
                </div>
              </div>

              {/* CARTÃO 4: CERTIFICADO DIGITAL */}
              <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md">
                <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-emerald-600">
                  <IoKeyOutline size={20} />
                  Certificado Digital A1
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Arquivo (.pfx)</label>
                    <div className="relative border-2 border-dashed border-emerald-200/50 hover:border-emerald-500 rounded-2xl p-6 text-center hover:bg-emerald-50/20 bg-white/40 transition-all duration-300 cursor-pointer shadow-inner">
                      <input type="file" accept=".pfx" onChange={(e) => setArquivoCertificado(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <span className="text-3xl block mb-2">📁</span>
                      <p className="text-xs font-bold text-slate-650">{arquivoCertificado ? arquivoCertificado.name : (form.certificadoUrl ? 'Certificado já enviado (Reenviar para trocar)' : 'Clique para selecionar o arquivo .pfx')}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Senha do Certificado</label>
                    <input name="certificadoSenha" value={form.certificadoSenha} onChange={handleChange} type="password" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" placeholder="Digite a senha..." />
                  </div>
                  
                  {form.certificadoUrl && (
                    <p className="text-xs text-green-600 font-extrabold bg-green-50/50 border border-green-200/50 p-2.5 rounded-xl text-center flex items-center justify-center gap-1.5 shadow-sm">
                      <IoCheckmarkCircleOutline className="text-base text-green-500" /> Certificado Configurado
                    </p>
                  )}
                  
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Validade do Certificado</label>
                    <input name="certificadoValidade" value={form.certificadoValidade} onChange={handleChange} type="date" className="w-full p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm" />
                    
                    {form.certificadoValidade && (() => {
                      const venc = new Date(form.certificadoValidade);
                      const hoje = new Date();
                      const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
                      if (diff < 0) return <p className="text-xs text-red-600 font-extrabold bg-red-50 border border-red-200/50 p-2.5 rounded-xl text-center mt-3 flex items-center justify-center gap-1 shadow-sm"><IoAlertCircleOutline className="text-base text-red-500" /> Certificado VENCIDO há {Math.abs(diff)} dias!</p>;
                      if (diff <= 30) return <p className="text-xs text-orange-600 font-extrabold bg-orange-50 border border-orange-200/50 p-2.5 rounded-xl text-center mt-3 flex items-center justify-center gap-1 shadow-sm"><IoAlertCircleOutline className="text-base text-orange-500" /> Certificado vence em {diff} dias</p>;
                      return <p className="text-xs text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-250/30 p-2.5 rounded-xl text-center mt-3 flex items-center justify-center gap-1 shadow-sm"><IoCheckmarkCircleOutline className="text-base text-emerald-500" /> Válido por mais {diff} dias</p>;
                    })()}
                  </div>
                </div>
              </div>

            </div>

            {/* Botão Salvar */}
            <div className="mt-8 mb-20">
              <button 
                onClick={handleSalvar} 
                disabled={loading} 
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold text-base transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 border border-emerald-400/30"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <IoSaveOutline size={18} />} 
                <span>SALVAR CONFIGURAÇÕES DA EMPRESA</span>
              </button>
            </div>
          </div>
        ) : (
          <AdminDepartamentosFiscais />
        )}

      </div>
    </div>
  );
};

export default ConfigFiscalScreen;