// src/pages/admin/ConfigFiscalScreen.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../firebase'; // Certifique-se de ter o 'storage' exportado no seu firebase.js
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const ConfigFiscalScreen = () => {
  const { userData, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [estabelecimentoId, setEstabelecimentoId] = useState(null);
  
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
    certificadoUrl: '' // URL do arquivo no Storage
  });

  const [arquivoCertificado, setArquivoCertificado] = useState(null);

  // Carregar dados existentes ao abrir
  useEffect(() => {
    const carregarDados = async () => {
      if (!userData || !currentUser) return;
      
      // Assume que estamos configurando o primeiro estabelecimento do usuário ou o próprio usuário
      const id = userData.estabelecimentosGerenciados?.[0] || currentUser.uid;
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
  }, [userData, currentUser]);

  // Função auxiliar para máscaras simples
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

      alert('✅ Configurações Fiscais salvas com sucesso!');
    } catch (error) {
      console.error(error);
      alert('❌ Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <div className="max-w-4xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Configuração Fiscal</h1>
            <p className="text-gray-500 mt-1">Dados para emissão de NFC-e</p>
          </div>
          <button onClick={() => window.history.back()} className="text-gray-500 hover:text-gray-800 font-bold">Voltar</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* CARTÃO 1: DADOS DA EMPRESA */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 md:col-span-2">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-emerald-600">🏢 Dados da Empresa</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">CNPJ (Apenas números)</label>
                <input name="cnpj" value={form.cnpj} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="00000000000100" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Inscrição Estadual (IE)</label>
                <input name="ie" value={form.ie} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="Isento ou Número" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Regime Tributário</label>
                <select name="regimeTributario" value={form.regimeTributario} onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all">
                  <option value="1">Simples Nacional</option>
                  <option value="3">Regime Normal</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Razão Social</label>
                <input name="razaoSocial" value={form.razaoSocial} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="Nome Jurídico da Empresa" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nome Fantasia</label>
                <input name="nomeFantasia" value={form.nomeFantasia} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="Nome da Loja" />
              </div>
            </div>
          </div>

          {/* CARTÃO 2: ENDEREÇO */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 md:col-span-2">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-emerald-600">📍 Endereço</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">CEP</label>
                <input name="cep" value={form.cep} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="00000-000" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Logradouro</label>
                <input name="endereco" value={form.endereco} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="Rua, Av..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Número</label>
                <input name="numero" value={form.numero} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="123" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Bairro</label>
                <input name="bairro" value={form.bairro} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Cidade</label>
                <input name="cidade" value={form.cidade} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">UF</label>
                <input name="uf" value={form.uf} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" maxLength={2} placeholder="SP" />
              </div>
            </div>
          </div>

          {/* CARTÃO 3: PARÂMETROS NFC-E */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-emerald-600">⚙️ Parâmetros NFC-e</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">Ambiente</label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button onClick={() => setForm({...form, ambiente: '2'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${form.ambiente === '2' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>HOMOLOGAÇÃO (TESTE)</button>
                  <button onClick={() => setForm({...form, ambiente: '1'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${form.ambiente === '1' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>PRODUÇÃO</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">CSC ID (Token ID)</label>
                <input name="cscId" value={form.cscId} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="Ex: 000001" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Código CSC (Alfanumérico)</label>
                <input name="cscCodigo" value={form.cscCodigo} onChange={handleChange} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="Ex: A1B2C3D4..." />
              </div>
            </div>
          </div>

          {/* CARTÃO 4: CERTIFICADO DIGITAL */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-emerald-600">🔐 Certificado Digital A1</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Arquivo (.pfx)</label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-all">
                  <input type="file" accept=".pfx" onChange={(e) => setArquivoCertificado(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <span className="text-3xl block mb-2">📁</span>
                  <p className="text-sm font-bold text-gray-600">{arquivoCertificado ? arquivoCertificado.name : (form.certificadoUrl ? 'Certificado já enviado (Reenviar para trocar)' : 'Clique para selecionar o arquivo .pfx')}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Senha do Certificado</label>
                <input name="certificadoSenha" value={form.certificadoSenha} onChange={handleChange} type="password" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 outline-none transition-all" placeholder="Digite a senha..." />
              </div>
              {form.certificadoUrl && <p className="text-xs text-green-600 font-bold bg-green-50 p-2 rounded-lg text-center">✅ Certificado Configurado</p>}
            </div>
          </div>

        </div>

        {/* Botão Salvar */}
        <div className="mt-8 mb-20">
          <button onClick={handleSalvar} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2">
            {loading ? <span className="animate-spin">⏳</span> : '💾'} SALVAR CONFIGURAÇÕES
          </button>
        </div>

      </div>
    </div>
  );
};

export default ConfigFiscalScreen;