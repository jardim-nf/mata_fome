import React, { useState } from 'react';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { toast } from 'react-toastify';
import { IoCreateOutline, IoTrashOutline } from 'react-icons/io5';
import { useConfirmDialog } from '../../../../hooks/useDialogs.jsx';

const CatalogoTab = ({
  dbVidros = [],
  dbCores = [],
  dbKits = [],
  dbAcessorios = [],
  dbModelos = [],
  setEditingMaterial,
  estabId
}) => {
  const [confirm, ConfirmUI] = useConfirmDialog();
  const [activeSubTab, setActiveSubTab] = useState('modelos'); // modelos, vidros, cores, kits, acessorios
  const [searchQuery, setSearchQuery] = useState('');

  // Form de Novo Modelo
  const [newModeloNome, setNewModeloNome] = useState('');

  const handleAddModelo = async (e) => {
    e.preventDefault();
    if (!newModeloNome) return;
    try {
      const docData = {
        nome: newModeloNome,
        tipoProjeto: 'box',
        icone: '🛀',
        linhaAluminio: 'box',
        tipoVidracaria: 'modelo',
        modulo: 'vidracaria',
        ativo: true,
        categoria: 'Vidraçaria - Modelo',
        vidros: [],
        cores: [],
        kits: [],
        acessorios: [],
        perfisPermitidos: [],
        custoMaoObra: 150,
        markupPercent: 50,
        folgaLarguraPadrao: 50,
        descontoAlturaPadrao: 50
      };

      const docRef = await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), docData);
      
      setNewModeloNome('');
      toast.success('Modelo de projeto cadastrado!');
      
      // Abre o modal de edição imediatamente com o item recém-cadastrado
      setEditingMaterial({ id: docRef.id, ...docData });
    } catch (e) {
      console.error(e);
      toast.error('Erro ao cadastrar modelo.');
    }
  };

  // Form de Novo Vidro
  const [newVidroNome, setNewVidroNome] = useState('');
  const [newVidroCusto, setNewVidroCusto] = useState('');

  const handleAddVidro = async (e) => {
    e.preventDefault();
    if (!newVidroNome || !newVidroCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newVidroNome,
        custoM2: Number(newVidroCusto),
        tipoVidracaria: 'vidro',
        modulo: 'vidracaria',
        ativo: true,
        categoria: 'Vidraçaria - Vidro'
      });
      setNewVidroNome('');
      setNewVidroCusto('');
      toast.success('Vidro cadastrado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao cadastrar vidro.');
    }
  };

  // Form de Nova Cor
  const [newCorNome, setNewCorNome] = useState('');
  const [newCorCusto, setNewCorCusto] = useState('');

  const handleAddCor = async (e) => {
    e.preventDefault();
    if (!newCorNome || !newCorCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newCorNome,
        adicionalM2: Number(newCorCusto),
        tipoVidracaria: 'cor',
        modulo: 'vidracaria',
        ativo: true,
        categoria: 'Vidraçaria - Cor'
      });
      setNewCorNome('');
      setNewCorCusto('');
      toast.success('Cor cadastrada com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao cadastrar cor.');
    }
  };

  // Form de Novo Kit
  const [newKitNome, setNewKitNome] = useState('');
  const [newKitCusto, setNewKitCusto] = useState('');

  const handleAddKit = async (e) => {
    e.preventDefault();
    if (!newKitNome || !newKitCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newKitNome,
        custo: Number(newKitCusto),
        tipoVidracaria: 'kit',
        modulo: 'vidracaria',
        ativo: true,
        categoria: 'Vidraçaria - Kit'
      });
      setNewKitNome('');
      setNewKitCusto('');
      toast.success('Kit cadastrado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao cadastrar kit.');
    }
  };

  // Form de Novo Acessório
  const [newAcessorioNome, setNewAcessorioNome] = useState('');
  const [newAcessorioMaterial, setNewAcessorioMaterial] = useState('polimero');
  const [newAcessorioCusto, setNewAcessorioCusto] = useState('');

  const handleAddAcessorio = async (e) => {
    e.preventDefault();
    if (!newAcessorioNome || !newAcessorioCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newAcessorioNome,
        material: newAcessorioMaterial,
        custo: Number(newAcessorioCusto),
        tipoVidracaria: 'acessorio',
        modulo: 'vidracaria',
        ativo: true,
        categoria: 'Vidraçaria - Acessório'
      });
      setNewAcessorioNome('');
      setNewAcessorioMaterial('polimero');
      setNewAcessorioCusto('');
      toast.success('Acessório cadastrado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao cadastrar acessório.');
    }
  };

  const handleDeleteItem = async (id, tipoLabel) => {
    const ok = await confirm(`Excluir este ${tipoLabel} permanentemente?`, {
      title: `Excluir ${tipoLabel}`,
      variant: 'warning',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success(`${tipoLabel} removido!`);
    } catch (e) {
      console.error(e);
      toast.error(`Erro ao remover ${tipoLabel}.`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left">
      {/* Abas Internas */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
        {[
          { id: 'modelos', label: '📐 Modelos', count: dbModelos.length },
          { id: 'vidros', label: '💎 Vidros', count: dbVidros.length },
          { id: 'cores', label: '🎨 Cores', count: dbCores.length },
          { id: 'kits', label: '⚙️ Kits Alumínio', count: dbKits.length },
          { id: 'acessorios', label: '⛓️ Acessórios', count: dbAcessorios.length }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveSubTab(tab.id);
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === tab.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Caixa de Busca */}
      <input
        type="text"
        placeholder={`🔍 Pesquisar em ${activeSubTab}...`}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full text-xs border border-slate-200 rounded-xl px-4 py-3 bg-slate-50/50 focus:bg-white focus:border-slate-400 focus:outline-none placeholder:text-slate-400 font-semibold transition-all shadow-sm"
      />

      {/* ==================== TAB: MODELOS ==================== */}
      {activeSubTab === 'modelos' && (
        <div className="glass-card p-6 space-y-5 shadow-xl border border-slate-200/60 rounded-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">📐 Modelos de Projetos</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Cadastre os tipos de projetos que você fabrica. As dimensões e regras de folgas serão configuradas na calculadora.
            </p>
          </div>

          <form onSubmit={handleAddModelo} className="bg-slate-50/60 border border-slate-200/50 p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Nome do Modelo de Projeto</label>
              <input
                type="text"
                required
                placeholder="Ex: Janela 2 Folhas Suprema, Box Elegance..."
                value={newModeloNome}
                onChange={e => setNewModeloNome(e.target.value)}
                className="glass-input w-full text-xs"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs transition-colors whitespace-nowrap">
                Cadastrar Novo Modelo
              </button>
            </div>
          </form>

          {/* Listagem */}
          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {dbModelos
              .filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(item => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 hover:border-slate-400 shadow-sm rounded-2xl text-xs transition-all">
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-250 flex items-center justify-center text-slate-800 font-bold shrink-0">
                      {item.icone || '📐'}
                    </div>
                    <div className="min-w-0">
                      <span className="font-extrabold text-slate-800 block truncate">{item.nome}</span>
                      <div className="flex flex-wrap gap-2 mt-0.5 text-[9px] font-semibold text-slate-500 uppercase">
                        <span>Desenho: {item.tipoProjeto}</span>
                        <span>• Linha: {item.linhaAluminio || 'box'}</span>
                        <span>• Mão de Obra: R$ {item.custoMaoObra || 0}</span>
                        <span>• Markup: {item.markupPercent || 0}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingMaterial({ id: item.id, tipoVidracaria: 'modelo', ...item })}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 transition-all"
                    >
                      <IoCreateOutline size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id, 'Modelo')}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl border border-red-200 transition-all"
                    >
                      <IoTrashOutline size={14} />
                    </button>
                  </div>
                </div>
              ))}
            {dbModelos.filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
              <p className="text-center text-xs text-slate-400 py-6 font-bold">Nenhum modelo localizado.</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: VIDROS ==================== */}
      {activeSubTab === 'vidros' && (
        <div className="glass-card p-6 space-y-5 shadow-xl border border-slate-200/60 rounded-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">💎 Vidros Cadastrados</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Cadastre as espessuras e tipos de vidros para cálculo do preço de custo por metro quadrado (m²).
            </p>
          </div>

          <form onSubmit={handleAddVidro} className="bg-slate-50/60 border border-slate-200/50 p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Nome / Espessura do Vidro</label>
              <input
                type="text"
                required
                placeholder="Ex: Temperado 8mm Incolor"
                value={newVidroNome}
                onChange={e => setNewVidroNome(e.target.value)}
                className="glass-input w-full text-xs"
              />
            </div>
            <div className="w-full sm:w-36">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Custo (R$ / m²)</label>
              <input
                type="number"
                required
                placeholder="Ex: 120"
                value={newVidroCusto}
                onChange={e => setNewVidroCusto(e.target.value)}
                className="glass-input w-full text-xs font-mono"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs transition-colors">
                Cadastrar Vidro
              </button>
            </div>
          </form>

          {/* Listagem */}
          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {dbVidros
              .filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(item => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 hover:border-slate-400 shadow-sm rounded-2xl text-xs transition-all">
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-slate-800 text-sm block truncate">{item.nome}</span>
                    <span className="text-[10px] font-mono text-teal-600 font-bold block mt-0.5">Custo: R$ {Number(item.custoM2).toFixed(2)}/m²</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => setEditingMaterial({ id: item.id, tipoVidracaria: 'vidro', ...item })}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 transition-all"
                    >
                      <IoCreateOutline size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id, 'Vidro')}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl border border-red-200 transition-all"
                    >
                      <IoTrashOutline size={14} />
                    </button>
                  </div>
                </div>
              ))}
            {dbVidros.filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
              <p className="text-center text-xs text-slate-400 py-6 font-bold">Nenhum vidro localizado.</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: CORES ==================== */}
      {activeSubTab === 'cores' && (
        <div className="glass-card p-6 space-y-5 shadow-xl border border-slate-200/60 rounded-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">🎨 Cores de Vidro</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Cadastre as cores de vidro e seus respectivos adicionais por metro quadrado (m²).
            </p>
          </div>

          <form onSubmit={handleAddCor} className="bg-slate-50/60 border border-slate-200/50 p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Nome da Cor / Acabamento</label>
              <input
                type="text"
                required
                placeholder="Ex: Fumê, Verde, Bronze"
                value={newCorNome}
                onChange={e => setNewCorNome(e.target.value)}
                className="glass-input w-full text-xs"
              />
            </div>
            <div className="w-full sm:w-36">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Adicional (R$ / m²)</label>
              <input
                type="number"
                required
                placeholder="Ex: 30"
                value={newCorCusto}
                onChange={e => setNewCorCusto(e.target.value)}
                className="glass-input w-full text-xs font-mono"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs transition-colors">
                Cadastrar Cor
              </button>
            </div>
          </form>

          {/* Listagem */}
          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {dbCores
              .filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(item => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 hover:border-slate-400 shadow-sm rounded-2xl text-xs transition-all">
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-slate-800 text-sm block truncate">{item.nome}</span>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold block mt-0.5">Adicional: + R$ {Number(item.adicionalM2).toFixed(2)}/m²</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => setEditingMaterial({ id: item.id, tipoVidracaria: 'cor', ...item })}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 transition-all"
                    >
                      <IoCreateOutline size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id, 'Cor')}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl border border-red-200 transition-all"
                    >
                      <IoTrashOutline size={14} />
                    </button>
                  </div>
                </div>
              ))}
            {dbCores.filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
              <p className="text-center text-xs text-slate-400 py-6 font-bold">Nenhuma cor localizada.</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: KITS ==================== */}
      {activeSubTab === 'kits' && (
        <div className="glass-card p-6 space-y-5 shadow-xl border border-slate-200/60 rounded-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">⚙️ Kits de Alumínio e Ferragens</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Cadastre os kits de ferragens e alumínio fechados que são computados como valor fixo no orçamento.
            </p>
          </div>

          <form onSubmit={handleAddKit} className="bg-slate-50/60 border border-slate-200/50 p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Nome do Kit</label>
              <input
                type="text"
                required
                placeholder="Ex: Kit Box Padrão 8mm, Kit Engenharia 2F"
                value={newKitNome}
                onChange={e => setNewKitNome(e.target.value)}
                className="glass-input w-full text-xs"
              />
            </div>
            <div className="w-full sm:w-36">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Custo Fixo (R$)</label>
              <input
                type="number"
                required
                placeholder="Ex: 85"
                value={newKitCusto}
                onChange={e => setNewKitCusto(e.target.value)}
                className="glass-input w-full text-xs font-mono"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs transition-colors">
                Cadastrar Kit
              </button>
            </div>
          </form>

          {/* Listagem */}
          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {dbKits
              .filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(item => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 hover:border-slate-400 shadow-sm rounded-2xl text-xs transition-all">
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-slate-800 text-sm block truncate">{item.nome}</span>
                    <span className="text-[10px] font-mono text-purple-650 font-bold block mt-0.5">Preço de Custo: R$ {Number(item.custo).toFixed(2)}</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => setEditingMaterial({ id: item.id, tipoVidracaria: 'kit', ...item })}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 transition-all"
                    >
                      <IoCreateOutline size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id, 'Kit')}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl border border-red-200 transition-all"
                    >
                      <IoTrashOutline size={14} />
                    </button>
                  </div>
                </div>
              ))}
            {dbKits.filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
              <p className="text-center text-xs text-slate-400 py-6 font-bold">Nenhum kit localizado.</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: ACESSÓRIOS ==================== */}
      {activeSubTab === 'acessorios' && (
        <div className="glass-card p-6 space-y-5 shadow-xl border border-slate-200/60 rounded-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">⛓️ Acessórios e Ferragens Avulsas</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Cadastre fechaduras, roldanas, puxadores ou qualquer acessório cobrado à parte do kit básico.
            </p>
          </div>

          <form onSubmit={handleAddAcessorio} className="bg-slate-50/60 border border-slate-200/50 p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Nome do Acessório</label>
              <input
                type="text"
                required
                placeholder="Ex: Fechadura Blindex, Roldana Latão"
                value={newAcessorioNome}
                onChange={e => setNewAcessorioNome(e.target.value)}
                className="glass-input w-full text-xs"
              />
            </div>
            <div className="w-full sm:w-36">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Material</label>
              <select
                value={newAcessorioMaterial}
                onChange={e => setNewAcessorioMaterial(e.target.value)}
                className="glass-input w-full text-xs font-semibold"
              >
                <option value="polimero">Polímero</option>
                <option value="zamac">Zamac</option>
                <option value="latao">Latão</option>
                <option value="inox">Inox</option>
              </select>
            </div>
            <div className="w-full sm:w-32">
              <label className="text-[9px] font-extrabold uppercase text-slate-500 block mb-1">Custo (R$)</label>
              <input
                type="number"
                required
                placeholder="Ex: 15"
                value={newAcessorioCusto}
                onChange={e => setNewAcessorioCusto(e.target.value)}
                className="glass-input w-full text-xs font-mono"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs transition-colors">
                Cadastrar Acessório
              </button>
            </div>
          </form>

          {/* Listagem */}
          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {dbAcessorios
              .filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(item => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 hover:border-slate-400 shadow-sm rounded-2xl text-xs transition-all">
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-slate-800 text-sm block truncate">{item.nome}</span>
                    <div className="flex gap-2 mt-0.5 text-[9px] font-semibold text-slate-500 uppercase">
                      <span>Material: {item.material}</span>
                      <span className="font-mono text-purple-650 font-bold">• Custo: R$ {Number(item.custo).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => setEditingMaterial({ id: item.id, tipoVidracaria: 'acessorio', ...item })}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 transition-all"
                    >
                      <IoCreateOutline size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id, 'Acessório')}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl border border-red-200 transition-all"
                    >
                      <IoTrashOutline size={14} />
                    </button>
                  </div>
                </div>
              ))}
            {dbAcessorios.filter(item => item.nome.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
              <p className="text-center text-xs text-slate-400 py-6 font-bold">Nenhum acessório localizado.</p>
            )}
          </div>
        </div>
      )}

      <ConfirmUI />
    </div>
  );
};

export default CatalogoTab;
