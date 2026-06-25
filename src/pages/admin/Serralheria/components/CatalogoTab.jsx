import React, { useState } from 'react';
import { db } from '../../../../firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { 
  IoAddOutline, 
  IoTrashOutline, 
  IoPencilOutline,
  IoSettingsOutline
} from 'react-icons/io5';

const CatalogoTab = ({ 
  dbVidros, // perfis
  dbCores, // coberturas
  dbKits, // acessorios
  dbModelos, // modelos de projetos
  setEditingMaterial, 
  estabId 
}) => {
  const [subTab, setSubTab] = useState('perfis'); // perfis, coberturas, acessorios, modelos
  const [nome, setNome] = useState('');
  const [custoM2, setCustoM2] = useState(''); // ou custo por barra/unidade
  const [pesoMetro, setPesoMetro] = useState(''); // kg/m (apenas perfis)
  const [tipoProjeto, setTipoProjeto] = useState('portao'); // portao, telhado, grade, movel (apenas modelos)

  const handleCreateInsumo = async (e) => {
    e.preventDefault();
    if (!nome.trim() || !custoM2) return toast.warn('Nome e Preço são obrigatórios!');

    try {
      let payload = {
        nome: nome.trim(),
        custo: Number(custoM2),
        modulo: 'serralheria',
        tipoVidracaria: subTab === 'perfis' ? 'vidro' : subTab === 'coberturas' ? 'cor' : subTab === 'acessorios' ? 'kit' : 'modelo'
      };

      if (subTab === 'perfis') {
        payload.pesoMetro = Number(pesoMetro) || 0;
        payload.custoBarra = Number(custoM2); // custo de uma barra de 6m
        payload.custoM2 = Number(custoM2) / 6; // custo linear/metro
      } else if (subTab === 'coberturas') {
        payload.adicionalM2 = Number(custoM2); // preço m²
      } else if (subTab === 'modelos') {
        payload.tipoProjeto = tipoProjeto;
        payload.qtdeFolhas = 1;
        payload.larguraPadrao = 3000;
        payload.alturaPadrao = 2000;
      }

      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), payload);
      toast.success('🎉 Material adicionado ao catálogo!');
      
      // Limpar campos
      setNome('');
      setCustoM2('');
      setPesoMetro('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao adicionar material.');
    }
  };

  const handleDeleteInsumo = async (id) => {
    if (!window.confirm('Excluir este item permanentemente do catálogo?')) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success('Item removido!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover.');
    }
  };

  const getSubTitle = () => {
    if (subTab === 'perfis') return 'Perfis Metálicos (Metalon / Tubos de Aço)';
    if (subTab === 'coberturas') return 'Coberturas (Placas de Policarbonato / Vidro / Telhas)';
    if (subTab === 'acessorios') return 'Acessórios & Outros (Roldanas, Fechaduras, Solda)';
    return 'Modelos de Projetos / Portões';
  };

  const getActiveList = () => {
    if (subTab === 'perfis') return dbVidros || [];
    if (subTab === 'coberturas') return dbCores || [];
    if (subTab === 'acessorios') return dbKits || [];
    return dbModelos || [];
  };

  return (
    <div className="space-y-6 text-left">
      {/* Abas Secundárias do Catálogo */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto print:hidden">
        <button
          onClick={() => setSubTab('perfis')}
          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${
            subTab === 'perfis' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          ⛓️ Perfis Metálicos
        </button>
        <button
          onClick={() => setSubTab('coberturas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${
            subTab === 'coberturas' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          🛡️ Coberturas
        </button>
        <button
          onClick={() => setSubTab('acessorios')}
          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${
            subTab === 'acessorios' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          ⚙️ Acessórios / Solda
        </button>
        <button
          onClick={() => setSubTab('modelos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${
            subTab === 'modelos' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          📂 Modelos Prontos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulário de Criação (5 cols) */}
        <div className="glass-card p-5 lg:col-span-5 space-y-4 print:hidden">
          <div>
            <h3 className="text-sm font-black text-slate-900">Novo Cadastro</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Cadastre insumos para a tabela de cálculo do IdeaSerralheiro</p>
          </div>

          <form onSubmit={handleCreateInsumo} className="space-y-3.5">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Nome do Item</label>
              <input
                type="text"
                required
                placeholder={subTab === 'perfis' ? 'Ex: Metalon 50x50x2.00mm' : subTab === 'coberturas' ? 'Ex: Policarbonato Alveolar 6mm' : 'Ex: Roldana Nylon c/ Caixa'}
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="glass-input w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                  {subTab === 'perfis' ? 'Preço da Barra (6m)' : subTab === 'coberturas' ? 'Preço m²' : 'Preço Unitário'}
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="R$ 0.00"
                  value={custoM2}
                  onChange={e => setCustoM2(e.target.value)}
                  className="glass-input w-full font-mono"
                />
              </div>

              {subTab === 'perfis' && (
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Peso p/ Metro (kg/m)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Ex: 2.80"
                    value={pesoMetro}
                    onChange={e => setPesoMetro(e.target.value)}
                    className="glass-input w-full font-mono"
                  />
                </div>
              )}

              {subTab === 'modelos' && (
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Tipo de Estrutura</label>
                  <select
                    value={tipoProjeto}
                    onChange={e => setTipoProjeto(e.target.value)}
                    className="glass-input w-full"
                  >
                    <option value="portao">Portão</option>
                    <option value="telhado">Telhado/Cobertura</option>
                    <option value="grade">Grade/Guarda-corpo</option>
                    <option value="movel">Móvel Industrial</option>
                  </select>
                </div>
              )}
            </div>

            <button type="submit" className="w-full py-2.5 amber-gradient-btn text-xs flex items-center justify-center gap-1">
              <IoAddOutline size={16} /> Adicionar no Catálogo
            </button>
          </form>
        </div>

        {/* Lista de Itens Existentes (7 cols) */}
        <div className="glass-card p-5 lg:col-span-7 space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">{getSubTitle()}</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Materiais disponíveis para orçar na Serralheria</p>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {getActiveList().length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-semibold italic text-xs">
                Nenhum item cadastrado nesta categoria.
              </div>
            ) : (
              getActiveList().map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-all">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{item.nome}</h4>
                    <div className="flex gap-2 text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                      {subTab === 'perfis' && (
                        <>
                          <span>Barra: R$ {item.custoBarra?.toFixed(2)}</span>
                          <span>•</span>
                          <span>Peso: {item.pesoMetro?.toFixed(2)} kg/m</span>
                        </>
                      )}
                      {subTab === 'coberturas' && <span>Preço m²: R$ {item.adicionalM2?.toFixed(2)}</span>}
                      {subTab === 'acessorios' && <span>Preço: R$ {item.custo?.toFixed(2)}</span>}
                      {subTab === 'modelos' && <span className="text-amber-600">Categoria: {item.tipoProjeto}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 print:hidden">
                    <button
                      onClick={() => setEditingMaterial(item)}
                      className="p-2 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-lg text-slate-500 transition-all"
                    >
                      <IoPencilOutline size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteInsumo(item.id)}
                      className="p-2 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg text-red-600 transition-all border border-red-100"
                    >
                      <IoTrashOutline size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogoTab;
