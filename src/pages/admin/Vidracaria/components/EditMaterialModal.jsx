import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { toast } from 'react-toastify';
import { IoCloseOutline } from 'react-icons/io5';

// Opções Padrões Compartilhadas
export const CORES_ALUMINIO = [
  { id: 'fosco', nome: 'Fosco Natural (Anodizado)' },
  { id: 'branco', nome: 'Branco (Pintura Epóxi)' },
  { id: 'preto', nome: 'Preto Fosco' },
  { id: 'preto_anod', nome: 'Preto Brilhante (Anodizado)' },
  { id: 'bronze', nome: 'Bronze Escuro' },
  { id: 'brilhante', nome: 'Cromado / Polido / Brilhante' },
  { id: 'inox', nome: 'Aço Inox Escovado' },
  { id: 'dourado', nome: 'Dourado / Gold Premium' },
  { id: 'rose', nome: 'Champagne / Rosé Gold' },
  { id: 'grafite', nome: 'Cinza Grafite / Antracite' },
  { id: 'corten', nome: 'Aço Corten / Rustico' },
  { id: 'amadeirado', nome: 'Textura Amadeirada' }
];

export const TIPOS_PUXADOR = [
  { id: 'padrao', nome: 'Puxador H Standard (30cm)' },
  { id: 'h_simples', nome: 'Puxador H Simples (40cm)' },
  { id: 'barra', nome: 'Puxador de Barra Tubular (60cm)' },
  { id: 'barra_45', nome: 'Puxador Angular 45º (80cm)' },
  { id: 'knob', nome: 'Puxador Redondo / Knob (Botão)' },
  { id: 'concha', nome: 'Puxador Tipo Concha (Sobrepor)' },
  { id: 'furo', nome: 'Apenas Furação (Sem Puxador)' },
  { id: 'sem', nome: 'Sem Furo e Sem Puxador' }
];

export const CENARIOS_FUNDO = [
  { id: 'banheiro_premium', nome: '🛁 Banheiro Premium (Claro)' },
  { id: 'banheiro_rustico', nome: '🪵 Banheiro Rústico (Madeira/Escuro)' },
  { id: 'sala_tijolo', nome: '🧱 Sala Industrial (Tijolo)' },
  { id: 'escritorio_concreto', nome: '🏢 Escritório (Concreto)' }
];

export const ANGULOS_CORTE = [
  { id: '90', nome: '90° (Corte Reto)' },
  { id: '45', nome: '45° (Meia Esquadria)' }
];

export const ARREDONDAMENTOS = [
  { id: 50, nome: '50 mm (Padrão)' },
  { id: 100, nome: '100 mm (Vidros Grandes)' },
  { id: 0, nome: 'Sem Arredondamento (Corte Exato)' }
];

export const AREAS_MINIMAS = [
  { id: 0.5, nome: '0,50 m² (Padrão)' },
  { id: 1.0, nome: '1,00 m² (Portas/Painéis)' },
  { id: 0, nome: 'Sem Mínimo (Cobrar Área Real)' }
];

const EditMaterialModal = ({
  editingMaterial,
  setEditingMaterial,
  estabId,
  dbVidros = [],
  dbCores = [],
  dbKits = [],
  dbAcessorios = []
}) => {
  if (!editingMaterial) return null;

  const tipo = editingMaterial.tipoVidracaria; // 'modelo', 'vidro', 'cor', 'kit', 'acessorio'
  const isModelo = tipo === 'modelo';

  // Sub-aba interna do modal para quando estamos editando um Modelo
  const [activeSubTab, setActiveSubTab] = useState('vidros'); // vidros, cores, kits, acessorios

  // States para cadastro rápido e edição de materiais vinculados
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingSubItemId, setEditingSubItemId] = useState(null);
  const [quickAddNome, setQuickAddNome] = useState('');
  const [quickAddCusto, setQuickAddCusto] = useState('');
  const [quickAddMaterial, setQuickAddMaterial] = useState('polimero');

  // Reset inputs de cadastro rápido ao mudar de sub-aba
  useEffect(() => {
    setShowQuickAdd(false);
    setEditingSubItemId(null);
    setQuickAddNome('');
    setQuickAddCusto('');
    setQuickAddMaterial('polimero');
  }, [activeSubTab]);

  // States genéricas
  const [nome, setNome] = useState('');
  const [tipoProjeto, setTipoProjeto] = useState('box');
  const [icone, setIcone] = useState('🛀');
  const [linhaAluminio, setLinhaAluminio] = useState('box');
  const [custoMaoObra, setCustoMaoObra] = useState(150);
  const [markupPercent, setMarkupPercent] = useState(50);

  // Medidas padrão (medidas prontas)
  const [larguraPadrao, setLarguraPadrao] = useState(1200);
  const [alturaPadrao, setAlturaPadrao] = useState(1900);
  const [folgaLarguraPadrao, setFolgaLarguraPadrao] = useState(50);
  const [descontoAlturaPadrao, setDescontoAlturaPadrao] = useState(50);
  const [descontoAlturaMovelPadrao, setDescontoAlturaMovelPadrao] = useState(20);
  const [qtdeFolhas, setQtdeFolhas] = useState(2);

  // Parâmetros Padrões Permitidos (Múltipla Escolha via Checkbox)
  const [coresAluminioPermitidas, setCoresAluminioPermitidas] = useState([]);
  const [tiposPuxadorPermitidos, setTiposPuxadorPermitidos] = useState([]);
  const [cenariosFundoPermitidos, setCenariosFundoPermitidos] = useState([]);
  const [angulosCortePermitidos, setAngulosCortePermitidos] = useState([]);
  const [arredondamentosPermitidos, setArredondamentosPermitidos] = useState([]);
  const [areasMinimasPermitidas, setAreasMinimasPermitidas] = useState([]);
  const [custoFrete, setCustoFrete] = useState(0);

  // Vínculos de IDs
  const [vidrosIds, setVidrosIds] = useState([]);
  const [coresIds, setCoresIds] = useState([]);
  const [kitsIds, setKitsIds] = useState([]);
  const [acessoriosIds, setAcessoriosIds] = useState([]);

  // States para outros tipos de materiais
  const [custoM2, setCustoM2] = useState('');
  const [adicionalM2, setAdicionalM2] = useState('');
  const [custo, setCusto] = useState('');
  const [material, setMaterial] = useState('polimero');

  // Inicializa states com os valores do item sendo editado
  useEffect(() => {
    if (editingMaterial) {
      setNome(editingMaterial.nome || '');
      setTipoProjeto(editingMaterial.tipoProjeto || 'box');
      setIcone(editingMaterial.icone || '🛀');
      setLinhaAluminio(editingMaterial.linhaAluminio || 'box');
      setCustoMaoObra(editingMaterial.custoMaoObra ?? 150);
      setMarkupPercent(editingMaterial.markupPercent ?? 50);

      // Medidas padrão
      setLarguraPadrao(editingMaterial.larguraPadrao ?? 1200);
      setAlturaPadrao(editingMaterial.alturaPadrao ?? 1900);
      
      const tProj = editingMaterial.tipoProjeto || 'box';
      setFolgaLarguraPadrao(editingMaterial.folgaLarguraPadrao ?? (tProj === 'box' ? 50 : tProj === 'janela' ? 40 : tProj === 'porta' ? 50 : 0));
      setDescontoAlturaPadrao(editingMaterial.descontoAlturaPadrao ?? (tProj === 'box' ? 55 : tProj === 'janela' ? 30 : tProj === 'porta' ? 40 : 0));
      setDescontoAlturaMovelPadrao(editingMaterial.descontoAlturaMovelPadrao ?? (tProj === 'box' || tProj === 'janela' || tProj === 'porta' ? 20 : 0));
      setQtdeFolhas(editingMaterial.qtdeFolhas ?? 2);

      // Parâmetros permitidos
      setCoresAluminioPermitidas(editingMaterial.coresAluminioPermitidas || []);
      setTiposPuxadorPermitidos(editingMaterial.tiposPuxadorPermitidos || []);
      setCenariosFundoPermitidos(editingMaterial.cenariosFundoPermitidos || []);
      setAngulosCortePermitidos(editingMaterial.angulosCortePermitidos || []);
      setArredondamentosPermitidos(editingMaterial.arredondamentosPermitidos || []);
      setAreasMinimasPermitidas(editingMaterial.areasMinimasPermitidas || []);
      setCustoFrete(editingMaterial.custoFrete ?? 0);

      // IDs vinculados
      setVidrosIds(editingMaterial.vidrosIds || []);
      setCoresIds(editingMaterial.coresIds || []);
      setKitsIds(editingMaterial.kitsIds || []);
      setAcessoriosIds(editingMaterial.acessoriosIds || []);

      // Outros materiais
      setCustoM2(editingMaterial.custoM2 ?? '');
      setAdicionalM2(editingMaterial.adicionalM2 ?? '');
      setCusto(editingMaterial.custo ?? '');
      setMaterial(editingMaterial.material || 'polimero');
    }
  }, [editingMaterial]);

  const getSingularLabel = (tab) => {
    switch (tab) {
      case 'vidros': return 'Vidro';
      case 'cores': return 'Cor';
      case 'kits': return 'Kit';
      case 'acessorios': return 'Acessório';
      default: return '';
    }
  };

  const getQuickAddPlaceholder = (tab) => {
    switch (tab) {
      case 'vidros': return 'Temperado 10mm Incolor';
      case 'cores': return 'Verde Jateado';
      case 'kits': return 'Kit Box Padrão 8mm';
      case 'acessorios': return 'Roldana Excêntrica Zamac';
      default: return '';
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddNome.trim()) {
      return toast.warn('Por favor, informe o nome do item!');
    }
    if (!quickAddCusto || Number(quickAddCusto) < 0) {
      return toast.warn('Por favor, informe um custo válido!');
    }

    try {
      const getSingularType = (tab) => {
        if (tab === 'acessorios') return 'acessorio';
        return tab.substring(0, tab.length - 1);
      };
      const tipoInsumo = getSingularType(activeSubTab);

      const payload = {
        nome: quickAddNome.trim().toUpperCase(),
        tipoVidracaria: tipoInsumo,
        criadoEm: new Date().toISOString()
      };

      if (tipoInsumo === 'vidro') {
        payload.custoM2 = Number(quickAddCusto);
      } else if (tipoInsumo === 'cor') {
        payload.adicionalM2 = Number(quickAddCusto);
      } else if (tipoInsumo === 'kit') {
        payload.custo = Number(quickAddCusto);
      } else if (tipoInsumo === 'acessorio') {
        payload.material = quickAddMaterial;
        payload.custo = Number(quickAddCusto);
      }

      // 1. Cadastra no Firestore
      const docRef = await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), payload);
      toast.success(`✅ Novo ${getSingularLabel(activeSubTab)} cadastrado com sucesso!`);

      // 2. Vincula automaticamente ao modelo
      const newItemId = docRef.id;
      if (activeSubTab === 'vidros') {
        setVidrosIds([...vidrosIds, newItemId]);
      } else if (activeSubTab === 'cores') {
        setCoresIds([...coresIds, newItemId]);
      } else if (activeSubTab === 'kits') {
        setKitsIds([...kitsIds, newItemId]);
      } else if (activeSubTab === 'acessorios') {
        setAcessoriosIds([...acessoriosIds, newItemId]);
      }

      // 3. Reset form
      handleCancelForm();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao cadastrar e vincular item.');
    }
  };

  const handleCancelForm = () => {
    setShowQuickAdd(false);
    setEditingSubItemId(null);
    setQuickAddNome('');
    setQuickAddCusto('');
    setQuickAddMaterial('polimero');
  };

  const handleUpdateSubItem = async () => {
    if (!quickAddNome.trim()) {
      return toast.warn('Por favor, informe o nome do item!');
    }
    if (!quickAddCusto || Number(quickAddCusto) < 0) {
      return toast.warn('Por favor, informe um custo válido!');
    }

    try {
      const getSingularType = (tab) => {
        if (tab === 'acessorios') return 'acessorio';
        return tab.substring(0, tab.length - 1);
      };
      const tipoInsumo = getSingularType(activeSubTab);

      const payload = {
        nome: quickAddNome.trim().toUpperCase()
      };

      if (tipoInsumo === 'vidro') {
        payload.custoM2 = Number(quickAddCusto);
      } else if (tipoInsumo === 'cor') {
        payload.adicionalM2 = Number(quickAddCusto);
      } else if (tipoInsumo === 'kit') {
        payload.custo = Number(quickAddCusto);
      } else if (tipoInsumo === 'acessorio') {
        payload.material = quickAddMaterial;
        payload.custo = Number(quickAddCusto);
      }

      await updateDoc(doc(db, 'estabelecimentos', estabId, 'insumos', editingSubItemId), payload);
      toast.success(`✅ ${getSingularLabel(activeSubTab)} atualizado com sucesso!`);

      handleCancelForm();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar item.');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingMaterial) return;

    try {
      const docRef = doc(db, 'estabelecimentos', estabId, 'insumos', editingMaterial.id);
      let updates = { nome };

      if (tipo === 'modelo') {
        updates.tipoProjeto = tipoProjeto;
        updates.icone = icone;
        updates.linhaAluminio = linhaAluminio;
        updates.custoMaoObra = Number(custoMaoObra) || 0;
        updates.markupPercent = Number(markupPercent) || 0;

        // Persiste as medidas padrão
        updates.larguraPadrao = Number(larguraPadrao) || 0;
        updates.alturaPadrao = Number(alturaPadrao) || 0;
        updates.folgaLarguraPadrao = Number(folgaLarguraPadrao) || 0;
        updates.descontoAlturaPadrao = Number(descontoAlturaPadrao) || 0;
        updates.descontoAlturaMovelPadrao = Number(descontoAlturaMovelPadrao) || 0;
        updates.qtdeFolhas = Number(qtdeFolhas) || 2;

        // Persiste as opções permitidas configuradas
        updates.coresAluminioPermitidas = coresAluminioPermitidas;
        updates.tiposPuxadorPermitidos = tiposPuxadorPermitidos;
        updates.cenariosFundoPermitidos = cenariosFundoPermitidos;
        updates.angulosCortePermitidos = angulosCortePermitidos;
        updates.arredondamentosPermitidos = arredondamentosPermitidos;
        updates.areasMinimasPermitidas = areasMinimasPermitidas;
        updates.custoFrete = Number(custoFrete) || 0;

        // Persiste os vínculos de IDs
        updates.vidrosIds = vidrosIds;
        updates.coresIds = coresIds;
        updates.kitsIds = kitsIds;
        updates.acessoriosIds = acessoriosIds;
      } else if (tipo === 'vidro') {
        updates.custoM2 = Number(custoM2) || 0;
      } else if (tipo === 'cor') {
        updates.adicionalM2 = Number(adicionalM2) || 0;
      } else if (tipo === 'kit') {
        updates.custo = Number(custo) || 0;
      } else if (tipo === 'acessorio') {
        updates.material = material;
        updates.custo = Number(custo) || 0;
      }

      await updateDoc(docRef, updates);
      toast.success('✅ Item atualizado com sucesso!');
      setEditingMaterial(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar o item.');
    }
  };

  const toggleVinculo = (list, setList, id) => {
    if (list.includes(id)) {
      setList(list.filter(item => item !== id));
    } else {
      setList([...list, id]);
    }
  };

  const getTipoLabel = () => {
    switch (tipo) {
      case 'modelo': return 'Modelo de Projeto';
      case 'vidro': return 'Tipo de Vidro';
      case 'cor': return 'Cor de Vidro';
      case 'kit': return 'Kit de Alumínio';
      case 'acessorio': return 'Acessório / Ferragem';
      default: return 'Material';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className={`modal-animate bg-white border border-slate-200 rounded-2xl w-full ${isModelo ? 'max-w-5xl md:max-w-6xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative text-left`}>
        {/* Fechar */}
        <button
          onClick={() => setEditingMaterial(null)}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 border border-slate-200 p-1.5 rounded-lg hover:bg-slate-100 transition-all z-10"
        >
          <IoCloseOutline size={20} />
        </button>

        <div className="border-b border-slate-200 pb-3">
          <span className="text-xs bg-slate-100 border border-slate-350 text-slate-800 font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
            Editar {getTipoLabel()}
          </span>
          <h3 className="text-xl font-black text-slate-800 mt-2">Alterar Configurações</h3>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          
          {/* Se for Modelo, usa layout expansivo de duas colunas */}
          {isModelo ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Coluna Esquerda (Configurações Gerais, Medidas e Parâmetros) - 7 Colunas */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Nome */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Nome / Descrição do Modelo</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="glass-input w-full text-sm font-bold"
                    placeholder="Digite o nome..."
                  />
                </div>

                {/* Tipo de Desenho (SVG) & Ícone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Tipo de Desenho (SVG)</label>
                    <select
                      value={tipoProjeto}
                      onChange={e => {
                        const newT = e.target.value;
                        setTipoProjeto(newT);
                        setFolgaLarguraPadrao(newT === 'box' ? 50 : newT === 'janela' ? 40 : newT === 'porta' ? 50 : 0);
                        setDescontoAlturaPadrao(newT === 'box' ? 50 : newT === 'janela' ? 30 : newT === 'porta' ? 40 : 0);
                      }}
                      className="glass-input w-full text-sm font-semibold"
                    >
                      <option value="box">Desenho Box</option>
                      <option value="janela">Desenho Janela</option>
                      <option value="porta">Desenho Porta</option>
                      <option value="espelho">Desenho Espelho</option>
                      <option value="outros">Desenho Genérico</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Ícone Visual</label>
                    <select
                      value={icone}
                      onChange={e => setIcone(e.target.value)}
                      className="glass-input w-full text-sm font-semibold"
                    >
                      <option value="🛀">🛀 Box</option>
                      <option value="🪟">🪟 Janela</option>
                      <option value="🚪">🚪 Porta</option>
                      <option value="🪞">🪞 Espelho</option>
                      <option value="🏗️">🏗️ Obra / Geral</option>
                    </select>
                  </div>
                </div>

                {/* Medidas Prontas / Padrão */}
                <div className="bg-slate-50/60 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200/60 pb-2">
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">📏 Medidas Prontas & Divisão de Folhas</h4>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-slate-500 font-extrabold uppercase whitespace-nowrap">Qtd Folhas:</label>
                      <select
                        value={qtdeFolhas}
                        onChange={e => setQtdeFolhas(Number(e.target.value) || 2)}
                        className="glass-input text-sm py-1 px-2.5 font-bold"
                      >
                        <option value={1}>1 Folha</option>
                        <option value={2}>2 Folhas</option>
                        <option value={3}>3 Folhas</option>
                        <option value={4}>4 Folhas</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">Largura (mm)</label>
                      <input
                        type="number"
                        value={larguraPadrao}
                        onChange={e => setLarguraPadrao(Math.max(0, parseInt(e.target.value) || 0))}
                        className="glass-input w-full text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">Altura (mm)</label>
                      <input
                        type="number"
                        value={alturaPadrao}
                        onChange={e => setAlturaPadrao(Math.max(0, parseInt(e.target.value) || 0))}
                        className="glass-input w-full text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">Folga Larg. (mm)</label>
                      <input
                        type="number"
                        value={folgaLarguraPadrao}
                        onChange={e => setFolgaLarguraPadrao(Math.max(0, parseInt(e.target.value) || 0))}
                        className="glass-input w-full text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">Desc. Fixo (mm)</label>
                      <input
                        type="number"
                        value={descontoAlturaPadrao}
                        onChange={e => setDescontoAlturaPadrao(Math.max(0, parseInt(e.target.value) || 0))}
                        className="glass-input w-full text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">Desc. Móvel (mm)</label>
                      <input
                        type="number"
                        value={descontoAlturaMovelPadrao}
                        onChange={e => setDescontoAlturaMovelPadrao(Math.max(0, parseInt(e.target.value) || 0))}
                        className="glass-input w-full text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Parâmetros Habilitados na Calculadora */}
                <div className="bg-slate-50/60 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">🛠️ Parâmetros Habilitados na Calculadora</h4>
                  
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Linha de Alumínio Padrão</label>
                      <select
                        value={linhaAluminio}
                        onChange={e => setLinhaAluminio(e.target.value)}
                        className="glass-input w-full text-sm font-bold"
                      >
                        <option value="box">Box / Temperado (AL)</option>
                        <option value="suprema">Linha Suprema (SU)</option>
                        <option value="gold">Linha Gold (LG)</option>
                        <option value="linha45">Linha 45 (P45)</option>
                        <option value="linha25_30">Linha 25 / 30 (L25/L30)</option>
                        <option value="outros">Outros / Sem Linha</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* 1. Cores de Alumínio */}
                      <details className="bg-white border border-slate-200 rounded-xl p-3 select-none">
                        <summary className="text-sm font-black text-slate-700 cursor-pointer outline-none flex justify-between items-center">
                          <span>🎨 Cores Alumínio ({coresAluminioPermitidas.length})</span>
                          <span className="text-[10px] text-slate-400 font-bold">Ver</span>
                        </summary>
                        <div className="grid grid-cols-1 gap-2 mt-2 pt-2 border-t border-slate-100 max-h-[120px] overflow-y-auto pr-1 text-left">
                          {CORES_ALUMINIO.map(item => {
                            const isChecked = coresAluminioPermitidas.includes(item.id);
                            return (
                              <label key={item.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer hover:text-slate-900">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleVinculo(coresAluminioPermitidas, setCoresAluminioPermitidas, item.id)}
                                  className="rounded text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
                                />
                                <span className="truncate">{item.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>

                      {/* 2. Tipos de Puxador */}
                      <details className="bg-white border border-slate-200 rounded-xl p-3 select-none">
                        <summary className="text-sm font-black text-slate-700 cursor-pointer outline-none flex justify-between items-center">
                          <span>🚪 Puxadores ({tiposPuxadorPermitidos.length})</span>
                          <span className="text-[10px] text-slate-400 font-bold">Ver</span>
                        </summary>
                        <div className="grid grid-cols-1 gap-2 mt-2 pt-2 border-t border-slate-100 max-h-[120px] overflow-y-auto pr-1 text-left">
                          {TIPOS_PUXADOR.map(item => {
                            const isChecked = tiposPuxadorPermitidos.includes(item.id);
                            return (
                              <label key={item.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer hover:text-slate-900">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleVinculo(tiposPuxadorPermitidos, setTiposPuxadorPermitidos, item.id)}
                                  className="rounded text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
                                />
                                <span className="truncate">{item.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>

                      {/* 3. Cenários de Fundo */}
                      <details className="bg-white border border-slate-200 rounded-xl p-3 select-none">
                        <summary className="text-sm font-black text-slate-700 cursor-pointer outline-none flex justify-between items-center">
                          <span>🌆 Cenários 3D ({cenariosFundoPermitidos.length})</span>
                          <span className="text-[10px] text-slate-400 font-bold">Ver</span>
                        </summary>
                        <div className="grid grid-cols-1 gap-2 mt-2 pt-2 border-t border-slate-100 max-h-[120px] overflow-y-auto pr-1 text-left">
                          {CENARIOS_FUNDO.map(item => {
                            const isChecked = cenariosFundoPermitidos.includes(item.id);
                            return (
                              <label key={item.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer hover:text-slate-900">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleVinculo(cenariosFundoPermitidos, setCenariosFundoPermitidos, item.id)}
                                  className="rounded text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
                                />
                                <span className="truncate">{item.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>

                      {/* 4. Ângulos de Corte */}
                      <details className="bg-white border border-slate-200 rounded-xl p-3 select-none">
                        <summary className="text-sm font-black text-slate-700 cursor-pointer outline-none flex justify-between items-center">
                          <span>📐 Ângulos Corte ({angulosCortePermitidos.length})</span>
                          <span className="text-[10px] text-slate-400 font-bold">Ver</span>
                        </summary>
                        <div className="grid grid-cols-1 gap-2 mt-2 pt-2 border-t border-slate-100 max-h-[120px] overflow-y-auto pr-1 text-left">
                          {ANGULOS_CORTE.map(item => {
                            const isChecked = angulosCortePermitidos.includes(item.id);
                            return (
                              <label key={item.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer hover:text-slate-900">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleVinculo(angulosCortePermitidos, setAngulosCortePermitidos, item.id)}
                                  className="rounded text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
                                />
                                <span>{item.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>

                      {/* 5. Arredondamentos */}
                      <details className="bg-white border border-slate-200 rounded-xl p-3 select-none">
                        <summary className="text-sm font-black text-slate-700 cursor-pointer outline-none flex justify-between items-center">
                          <span>🔘 Arredondamentos ({arredondamentosPermitidos.length})</span>
                          <span className="text-[10px] text-slate-400 font-bold">Ver</span>
                        </summary>
                        <div className="grid grid-cols-1 gap-2 mt-2 pt-2 border-t border-slate-100 max-h-[120px] overflow-y-auto pr-1 text-left">
                          {ARREDONDAMENTOS.map(item => {
                            const isChecked = arredondamentosPermitidos.includes(item.id);
                            return (
                              <label key={item.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer hover:text-slate-900">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleVinculo(arredondamentosPermitidos, setArredondamentosPermitidos, item.id)}
                                  className="rounded text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
                                />
                                <span>{item.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>

                      {/* 6. Áreas Mínimas */}
                      <details className="bg-white border border-slate-200 rounded-xl p-3 select-none">
                        <summary className="text-sm font-black text-slate-700 cursor-pointer outline-none flex justify-between items-center">
                          <span>📦 Áreas Mínimas ({areasMinimasPermitidas.length})</span>
                          <span className="text-[10px] text-slate-400 font-bold">Ver</span>
                        </summary>
                        <div className="grid grid-cols-1 gap-2 mt-2 pt-2 border-t border-slate-100 max-h-[120px] overflow-y-auto pr-1 text-left">
                          {AREAS_MINIMAS.map(item => {
                            const isChecked = areasMinimasPermitidas.includes(item.id);
                            return (
                              <label key={item.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer hover:text-slate-900">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleVinculo(areasMinimasPermitidas, setAreasMinimasPermitidas, item.id)}
                                  className="rounded text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
                                />
                                <span>{item.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Frete / Transporte Padrão (R$)</label>
                      <input
                        type="number"
                        value={custoFrete}
                        onChange={e => setCustoFrete(parseFloat(e.target.value) || 0)}
                        className="glass-input w-full text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Financeiro */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Mão de Obra Padrão (R$)</label>
                    <input
                      type="number"
                      required
                      value={custoMaoObra}
                      onChange={e => setCustoMaoObra(parseFloat(e.target.value) || 0)}
                      className="glass-input w-full text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Markup Padrão (%)</label>
                    <input
                      type="number"
                      required
                      value={markupPercent}
                      onChange={e => setMarkupPercent(parseInt(e.target.value) || 0)}
                      className="glass-input w-full text-sm font-mono"
                    />
                  </div>
                </div>

              </div>

              {/* Coluna Direita (Vínculo de Materiais Disponíveis e QuickAdd) - 5 Colunas */}
              <div className="lg:col-span-5 space-y-4 lg:border-l lg:border-slate-200/80 lg:pl-5">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">🔗 Vincular Materiais Disponíveis</h4>
                
                {/* Abas de Vínculo */}
                <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
                  {[
                    { id: 'vidros', label: '💎 Vidros', count: dbVidros.length },
                    { id: 'cores', label: '🎨 Cores', count: dbCores.length },
                    { id: 'kits', label: '⚙️ Kits', count: dbKits.length },
                    { id: 'acessorios', label: '⛓️ Acessórios', count: dbAcessorios.length }
                  ].map(subTab => (
                    <button
                      key={subTab.id}
                      type="button"
                      onClick={() => setActiveSubTab(subTab.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        activeSubTab === subTab.id
                          ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      {subTab.label}
                    </button>
                  ))}
                </div>

                {/* Seção de Cadastro Rápido Inline */}
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-extrabold uppercase">Itens da Categoria</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (showQuickAdd) {
                        handleCancelForm();
                      } else {
                        setShowQuickAdd(true);
                      }
                    }}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 transition-colors"
                  >
                    {showQuickAdd ? '✕ Fechar Painel' : `➕ Novo ${getSingularLabel(activeSubTab)}`}
                  </button>
                </div>

                {showQuickAdd && (
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3.5 modal-animate text-left">
                    <h5 className="text-xs font-black uppercase tracking-wide text-slate-700">
                      {editingSubItemId ? `Editar ${getSingularLabel(activeSubTab)}` : `Cadastrar Novo ${getSingularLabel(activeSubTab)}`}
                    </h5>
                    
                    <div className="grid grid-cols-1 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">Nome / Descrição</label>
                        <input
                          type="text"
                          placeholder={`Ex: ${getQuickAddPlaceholder(activeSubTab)}`}
                          value={quickAddNome}
                          onChange={e => setQuickAddNome(e.target.value)}
                          className="glass-input w-full text-sm py-2 px-3"
                        />
                      </div>
                      
                      {activeSubTab === 'acessorios' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500 font-bold block">Material</label>
                            <select
                              value={quickAddMaterial}
                              onChange={e => setQuickAddMaterial(e.target.value)}
                              className="glass-input w-full text-sm py-2 px-2.5 font-semibold"
                            >
                              <option value="polimero">Polímero</option>
                              <option value="zamac">Zamac</option>
                              <option value="latao">Latão</option>
                              <option value="inox">Inox</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500 font-bold block">Custo (R$)</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={quickAddCusto}
                              onChange={e => setQuickAddCusto(e.target.value)}
                              className="glass-input w-full text-sm py-2 px-2.5 font-mono"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500 font-bold block">
                            {activeSubTab === 'vidros' ? 'Custo (R$ / m²)' : activeSubTab === 'cores' ? 'Adicional (R$ / m²)' : 'Custo (R$)'}
                          </label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={quickAddCusto}
                            onChange={e => setQuickAddCusto(e.target.value)}
                            className="glass-input w-full text-sm py-2 px-3 font-mono"
                          />
                        </div>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={editingSubItemId ? handleUpdateSubItem : handleQuickAdd}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      {editingSubItemId ? 'Salvar Alterações do Item 💾' : 'Cadastrar & Vincular Automaticamente 🚀'}
                    </button>
                  </div>
                )}

                {/* Listagem de Itens Vinculáveis */}
                <div className="max-h-[350px] overflow-y-auto space-y-1.5 pr-1 pt-1">
                  {activeSubTab === 'vidros' && dbVidros.map(item => {
                    const isChecked = vidrosIds.includes(item.id);
                    const isEditingItem = editingSubItemId === item.id;
                    return (
                      <label key={item.id} className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-all text-sm font-semibold ${isEditingItem ? 'border-indigo-400 bg-indigo-50/40' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVinculo(vidrosIds, setVidrosIds, item.id)}
                          className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4 shrink-0"
                        />
                        <div className="flex justify-between w-full min-w-0 items-center">
                          <span className="truncate pr-2">{item.nome}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-teal-650 font-bold text-xs">R$ {Number(item.custoM2).toFixed(2)}/m²</span>
                            <button
                              type="button"
                              title="Editar este item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingSubItemId(item.id);
                                setQuickAddNome(item.nome);
                                setQuickAddCusto(item.custoM2);
                                setShowQuickAdd(true);
                              }}
                              className="p-1 hover:bg-slate-200/80 rounded transition-all ml-0.5 text-xs"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                      </label>
                    );
                  })}

                  {activeSubTab === 'cores' && dbCores.map(item => {
                    const isChecked = coresIds.includes(item.id);
                    const isEditingItem = editingSubItemId === item.id;
                    return (
                      <label key={item.id} className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-all text-sm font-semibold ${isEditingItem ? 'border-indigo-400 bg-indigo-50/40' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVinculo(coresIds, setCoresIds, item.id)}
                          className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4 shrink-0"
                        />
                        <div className="flex justify-between w-full min-w-0 items-center">
                          <span className="truncate pr-2">{item.nome}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-emerald-600 font-bold text-xs">+ R$ {Number(item.adicionalM2).toFixed(2)}/m²</span>
                            <button
                              type="button"
                              title="Editar este item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingSubItemId(item.id);
                                setQuickAddNome(item.nome);
                                setQuickAddCusto(item.adicionalM2);
                                setShowQuickAdd(true);
                              }}
                              className="p-1 hover:bg-slate-200/80 rounded transition-all ml-0.5 text-xs"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                      </label>
                    );
                  })}

                  {activeSubTab === 'kits' && dbKits.map(item => {
                    const isChecked = kitsIds.includes(item.id);
                    const isEditingItem = editingSubItemId === item.id;
                    return (
                      <label key={item.id} className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-all text-sm font-semibold ${isEditingItem ? 'border-indigo-400 bg-indigo-50/40' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVinculo(kitsIds, setKitsIds, item.id)}
                          className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4 shrink-0"
                        />
                        <div className="flex justify-between w-full min-w-0 items-center">
                          <span className="truncate pr-2">{item.nome}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-purple-650 font-bold text-xs">R$ {Number(item.custo).toFixed(2)}</span>
                            <button
                              type="button"
                              title="Editar este item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingSubItemId(item.id);
                                setQuickAddNome(item.nome);
                                setQuickAddCusto(item.custo);
                                setShowQuickAdd(true);
                              }}
                              className="p-1 hover:bg-slate-200/80 rounded transition-all ml-0.5 text-xs"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                      </label>
                    );
                  })}

                  {activeSubTab === 'acessorios' && dbAcessorios.map(item => {
                    const isChecked = acessoriosIds.includes(item.id);
                    const isEditingItem = editingSubItemId === item.id;
                    return (
                      <label key={item.id} className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-all text-sm font-semibold ${isEditingItem ? 'border-indigo-400 bg-indigo-50/40' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVinculo(acessoriosIds, setAcessoriosIds, item.id)}
                          className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4 shrink-0"
                        />
                        <div className="flex justify-between w-full min-w-0 items-center">
                          <span className="truncate pr-2">{item.nome} ({item.material})</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-slate-650 font-bold text-xs">R$ {Number(item.custo).toFixed(2)}</span>
                            <button
                              type="button"
                              title="Editar este item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingSubItemId(item.id);
                                setQuickAddNome(item.nome);
                                setQuickAddCusto(item.custo);
                                setQuickAddMaterial(item.material || 'polimero');
                                setShowQuickAdd(true);
                              }}
                              className="p-1 hover:bg-slate-200/80 rounded transition-all ml-0.5 text-xs"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                      </label>
                    );
                  })}

                  {((activeSubTab === 'vidros' && dbVidros.length === 0) ||
                    (activeSubTab === 'cores' && dbCores.length === 0) ||
                    (activeSubTab === 'kits' && dbKits.length === 0) ||
                    (activeSubTab === 'acessorios' && dbAcessorios.length === 0)) && (
                    <p className="text-center text-xs text-slate-450 font-bold py-6">
                      Nenhum item global cadastrado nesta categoria.
                    </p>
                  )}
                </div>

              </div>

            </div>
          ) : (
            // Layout Compacto para Vidros, Cores, Kits e Acessórios
            <div className="space-y-4">
              
              {/* Nome - Todos os tipos têm */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Nome / Descrição</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="glass-input w-full text-sm font-bold"
                  placeholder="Digite o nome..."
                />
              </div>

              {/* Campos específicos para VIDRO */}
              {tipo === 'vidro' && (
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Preço de Custo (R$ / m²)</label>
                  <input
                    type="number"
                    required
                    value={custoM2}
                    onChange={e => setCustoM2(e.target.value)}
                    className="glass-input w-full text-sm font-mono"
                    placeholder="Ex: 120"
                  />
                </div>
              )}

              {/* Campos específicos para COR */}
              {tipo === 'cor' && (
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Valor Adicional (R$ / m²)</label>
                  <input
                    type="number"
                    required
                    value={adicionalM2}
                    onChange={e => setAdicionalM2(e.target.value)}
                    className="glass-input w-full text-sm font-mono"
                    placeholder="Ex: 30"
                  />
                </div>
              )}

              {/* Campos específicos para KIT */}
              {tipo === 'kit' && (
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    required
                    value={custo}
                    onChange={e => setCusto(e.target.value)}
                    className="glass-input w-full text-sm font-mono"
                    placeholder="Ex: 80"
                  />
                </div>
              )}

              {/* Campos específicos para ACESSÓRIO */}
              {tipo === 'acessorio' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Material</label>
                    <select
                      value={material}
                      onChange={e => setMaterial(e.target.value)}
                      className="glass-input w-full text-sm font-semibold"
                    >
                      <option value="polimero">Polímero</option>
                      <option value="zamac">Zamac</option>
                      <option value="latao">Latão</option>
                      <option value="inox">Inox</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">Preço de Custo (R$)</label>
                    <input
                      type="number"
                      required
                      value={custo}
                      onChange={e => setCusto(e.target.value)}
                      className="glass-input w-full text-sm font-mono"
                      placeholder="Ex: 15"
                    />
                  </div>
                </div>
              )}

            </div>
          )}

          <div className="flex gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingMaterial(null)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-350 rounded-xl font-bold text-sm transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-sm transition-all shadow-md"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMaterialModal;
