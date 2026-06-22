import React, { useState } from 'react';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { toast } from 'react-toastify';
import { IoCreateOutline, IoTrashOutline } from 'react-icons/io5';
import { useConfirmDialog } from '../../../../hooks/useDialogs.jsx';

const CatalogoTab = ({ dbVidros, dbCores, dbKits, dbModelos, setEditingMaterial, estabId }) => {
  const [confirm, ConfirmUI] = useConfirmDialog();
  // Buscas Individuais
  const [searchVidrosQuery, setSearchVidrosQuery] = useState('');
  const [searchCoresQuery, setSearchCoresQuery] = useState('');
  const [searchKitsQuery, setSearchKitsQuery] = useState('');
  const [searchModelosQuery, setSearchModelosQuery] = useState('');

  // Form de Catálogo (CRUD)
  const [newVidroNome, setNewVidroNome] = useState('');
  const [newVidroCusto, setNewVidroCusto] = useState('');
  const [newCorNome, setNewCorNome] = useState('');
  const [newCorCusto, setNewCorCusto] = useState('');
  const [newKitNome, setNewKitNome] = useState('');
  const [newKitCusto, setNewKitCusto] = useState('');
  const [newModeloNome, setNewModeloNome] = useState('');
  const [newModeloTipo, setNewModeloTipo] = useState('box');
  const [newModeloIcone, setNewModeloIcone] = useState('🛀');

  // Adicionar e Excluir Vidros
  const handleAddVidro = async (e) => {
    e.preventDefault();
    if (!newVidroNome || !newVidroCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newVidroNome,
        custoM2: Number(newVidroCusto),
        tipoVidracaria: 'vidro',
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

  const handleDeleteVidro = async (id) => {
    const ok = await confirm("Excluir este vidro permanentemente?", {
      title: 'Excluir Vidro',
      variant: 'warning',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success('Vidro removido!');
    } catch (e) { 
      console.error(e);
      toast.error('Erro ao remover vidro.'); 
    }
  };

  // Adicionar e Excluir Cores
  const handleAddCor = async (e) => {
    e.preventDefault();
    if (!newCorNome || !newCorCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newCorNome,
        adicionalM2: Number(newCorCusto),
        tipoVidracaria: 'cor',
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

  const handleDeleteCor = async (id) => {
    const ok = await confirm("Excluir esta cor permanentemente?", {
      title: 'Excluir Cor',
      variant: 'warning',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success('Cor removida!');
    } catch (e) { 
      console.error(e);
      toast.error('Erro ao remover cor.'); 
    }
  };

  // Adicionar e Excluir Kits
  const handleAddKit = async (e) => {
    e.preventDefault();
    if (!newKitNome || !newKitCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newKitNome,
        custo: Number(newKitCusto),
        tipoVidracaria: 'kit',
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

  const handleDeleteKit = async (id) => {
    const ok = await confirm("Excluir este kit permanentemente?", {
      title: 'Excluir Kit',
      variant: 'warning',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success('Kit removido!');
    } catch (e) { 
      console.error(e);
      toast.error('Erro ao remover kit.'); 
    }
  };

  // Adicionar e Excluir Modelos
  const handleAddModelo = async (e) => {
    e.preventDefault();
    if (!newModeloNome) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newModeloNome,
        tipoProjeto: newModeloTipo,
        icone: newModeloIcone,
        tipoVidracaria: 'modelo',
        ativo: true,
        categoria: 'Vidraçaria - Modelo'
      });
      setNewModeloNome('');
      setNewModeloTipo('box');
      setNewModeloIcone('🛀');
      toast.success('Modelo de projeto cadastrado!');
    } catch (e) { 
      console.error(e);
      toast.error('Erro ao cadastrar modelo.'); 
    }
  };

  const handleDeleteModelo = async (id) => {
    const ok = await confirm("Excluir este modelo permanentemente?", {
      title: 'Excluir Modelo',
      variant: 'warning',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success('Modelo removido!');
    } catch (e) { 
      console.error(e);
      toast.error('Erro ao remover modelo.'); 
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CRUD 1: Vidros */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
          💎 Tipos de Vidros (Preço m²)
        </h3>
        
        <input
          type="text"
          placeholder="🔍 Pesquisar vidro..."
          value={searchVidrosQuery}
          onChange={e => setSearchVidrosQuery(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:border-slate-400 focus:outline-none placeholder:text-slate-400 font-semibold"
        />

        <form onSubmit={handleAddVidro} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Nome do Vidro"
              value={newVidroNome}
              onChange={e => setNewVidroNome(e.target.value)}
              className="glass-input flex-1 text-xs"
            />
            <input
              type="number"
              required
              placeholder="Preço R$/m²"
              value={newVidroCusto}
              onChange={e => setNewVidroCusto(e.target.value)}
              className="glass-input w-28 text-xs font-semibold"
            />
          </div>
          <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs">
            Adicionar Vidro
          </button>
        </form>

        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {dbVidros
            .filter(item => item.nome.toLowerCase().includes(searchVidrosQuery.toLowerCase()))
            .map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200/80 hover:border-slate-400 shadow-sm hover:shadow rounded-2xl text-xs transition-all duration-200">
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold shrink-0">
                    💎
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-800 block truncate">{item.nome}</span>
                    <span className="font-mono text-slate-800 font-bold">R$ {Number(item.custoM2).toFixed(2)} / m²</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingMaterial({ id: item.id, tipo: 'vidro', nome: item.nome, custo: item.custoM2 })}
                    className="p-2 bg-slate-900/10 hover:bg-slate-900 text-slate-800 hover:text-white rounded-xl border border-slate-800/10 transition-all"
                  >
                    <IoCreateOutline size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteVidro(item.id)}
                    className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-500/10 transition-all"
                  >
                    <IoTrashOutline size={13} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* CRUD 2: Cores */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
          🎨 Cores & Acréscimos (m²)
        </h3>
        
        <input
          type="text"
          placeholder="🔍 Pesquisar cor..."
          value={searchCoresQuery}
          onChange={e => setSearchCoresQuery(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:border-slate-400 focus:outline-none placeholder:text-slate-400 font-semibold"
        />

        <form onSubmit={handleAddCor} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Cor / Acabamento"
              value={newCorNome}
              onChange={e => setNewCorNome(e.target.value)}
              className="glass-input flex-1 text-xs"
            />
            <input
              type="number"
              required
              placeholder="R$ Adicional"
              value={newCorCusto}
              onChange={e => setNewCorCusto(e.target.value)}
              className="glass-input w-28 text-xs font-semibold"
            />
          </div>
          <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs">
            Adicionar Cor
          </button>
        </form>

        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {dbCores
            .filter(item => item.nome.toLowerCase().includes(searchCoresQuery.toLowerCase()))
            .map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200/80 hover:border-emerald-400 shadow-sm hover:shadow rounded-2xl text-xs transition-all duration-200">
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold shrink-0">
                    🎨
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-800 block truncate">{item.nome}</span>
                    <span className="font-mono text-emerald-600 font-bold">+ R$ {Number(item.adicionalM2).toFixed(2)} / m²</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingMaterial({ id: item.id, tipo: 'cor', nome: item.nome, custo: item.adicionalM2 })}
                    className="p-2 bg-slate-900/10 hover:bg-slate-900 text-slate-800 hover:text-white rounded-xl border border-slate-800/10 transition-all"
                  >
                    <IoCreateOutline size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCor(item.id)}
                    className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-500/10 transition-all"
                  >
                    <IoTrashOutline size={13} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* CRUD 3: Kits */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
          ⚙️ Kits Alumínio / Ferragens
        </h3>
        
        <input
          type="text"
          placeholder="🔍 Pesquisar kit..."
          value={searchKitsQuery}
          onChange={e => setSearchKitsQuery(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:border-slate-400 focus:outline-none placeholder:text-slate-400 font-semibold"
        />

        <form onSubmit={handleAddKit} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Nome do Kit / Ferragem"
              value={newKitNome}
              onChange={e => setNewKitNome(e.target.value)}
              className="glass-input flex-1 text-xs"
            />
            <input
              type="number"
              required
              placeholder="Preço Kit"
              value={newKitCusto}
              onChange={e => setNewKitCusto(e.target.value)}
              className="glass-input w-28 text-xs font-semibold"
            />
          </div>
          <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs">
            Adicionar Kit
          </button>
        </form>

        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {dbKits
            .filter(item => item.nome.toLowerCase().includes(searchKitsQuery.toLowerCase()))
            .map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200/80 hover:border-purple-400 shadow-sm hover:shadow rounded-2xl text-xs transition-all duration-200">
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-bold shrink-0">
                    ⚙️
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-800 block truncate">{item.nome}</span>
                    <span className="font-mono text-purple-600 font-bold">R$ {Number(item.custo).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingMaterial({ id: item.id, tipo: 'kit', nome: item.nome, custo: item.custo })}
                    className="p-2 bg-slate-900/10 hover:bg-slate-900 text-slate-800 hover:text-white rounded-xl border border-slate-800/10 transition-all"
                  >
                    <IoCreateOutline size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteKit(item.id)}
                    className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-500/10 transition-all"
                  >
                    <IoTrashOutline size={13} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* CRUD 4: Modelos */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
          📐 Modelos de Projetos
        </h3>
        
        <input
          type="text"
          placeholder="🔍 Pesquisar modelo..."
          value={searchModelosQuery}
          onChange={e => setSearchModelosQuery(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:border-slate-400 focus:outline-none placeholder:text-slate-400 font-semibold"
        />

        <form onSubmit={handleAddModelo} className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              placeholder="Nome do Modelo"
              value={newModeloNome}
              onChange={e => setNewModeloNome(e.target.value)}
              className="glass-input flex-1 text-xs"
            />
            <div className="flex gap-2">
              <select
                value={newModeloTipo}
                onChange={e => setNewModeloTipo(e.target.value)}
                className="glass-input w-28 text-xs"
              >
                <option value="box">Box</option>
                <option value="janela">Janela</option>
                <option value="porta">Porta</option>
                <option value="espelho">Espelho</option>
                <option value="outros">Outros</option>
              </select>
              <select
                value={newModeloIcone}
                onChange={e => setNewModeloIcone(e.target.value)}
                className="glass-input w-20 text-sm p-1"
              >
                <option value="🛀">🛀</option>
                <option value="🪟">🪟</option>
                <option value="🚪">🚪</option>
                <option value="🪞">🪞</option>
                <option value="🏗️">🏗️</option>
              </select>
            </div>
          </div>
          <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs">
            Adicionar Modelo
          </button>
        </form>

        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {dbModelos
            .filter(item => item.nome.toLowerCase().includes(searchModelosQuery.toLowerCase()))
            .map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200/80 hover:border-slate-400 shadow-sm hover:shadow rounded-2xl text-xs transition-all duration-200">
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-bold shrink-0">
                    {item.icone || '🏗️'}
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-800 block truncate">{item.nome}</span>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Desenho: {item.tipoProjeto || 'outros'}</span>
                  </div>
                </div>
                {item.isDefaultMerged ? (
                  <span className="px-2.5 py-1 bg-slate-100 border border-slate-200/60 text-slate-500 rounded-lg font-bold text-[10px] uppercase">
                    Padrão
                  </span>
                ) : (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingMaterial({ id: item.id, tipo: 'modelo', nome: item.nome, tipoProjeto: item.tipoProjeto || 'outros', icone: item.icone || '🏗️' })}
                      className="p-2 bg-slate-900/10 hover:bg-slate-900 text-slate-800 hover:text-white rounded-xl border border-slate-800/10 transition-all"
                    >
                      <IoCreateOutline size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteModelo(item.id)}
                      className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-500/10 transition-all"
                    >
                      <IoTrashOutline size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
      <ConfirmUI />
    </div>
  );
};

export default CatalogoTab;
