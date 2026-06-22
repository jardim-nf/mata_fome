import React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { toast } from 'react-toastify';
import { IoCloseOutline } from 'react-icons/io5';

const EditMaterialModal = ({ editingMaterial, setEditingMaterial, estabId }) => {
  if (!editingMaterial) return null;

  const handleUpdateMaterial = async (e) => {
    e.preventDefault();
    if (!editingMaterial) return;

    try {
      const docRef = doc(db, 'estabelecimentos', estabId, 'insumos', editingMaterial.id);
      const updates = {
        nome: editingMaterial.nome
      };

      if (editingMaterial.tipo === 'vidro') {
        updates.custoM2 = Number(editingMaterial.custo);
      } else if (editingMaterial.tipo === 'cor') {
        updates.adicionalM2 = Number(editingMaterial.custo);
      } else if (editingMaterial.tipo === 'kit') {
        updates.custo = Number(editingMaterial.custo);
      } else if (editingMaterial.tipo === 'modelo') {
        updates.tipoProjeto = editingMaterial.tipoProjeto;
        updates.icone = editingMaterial.icone;
      }

      await updateDoc(docRef, updates);
      toast.success('✅ Material atualizado com sucesso!');
      setEditingMaterial(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar o material.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="modal-animate bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-left">
        {/* Fechar */}
        <button
          onClick={() => setEditingMaterial(null)}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 border border-slate-200 p-1 rounded-lg hover:bg-slate-100 transition-all"
        >
          <IoCloseOutline size={20} />
        </button>

        <div className="border-b border-slate-200 pb-3">
          <span className="text-[10px] bg-slate-100 border border-slate-300 text-slate-800 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            Editar {editingMaterial.tipo === 'vidro' ? 'Vidro' : editingMaterial.tipo === 'cor' ? 'Cor' : editingMaterial.tipo === 'kit' ? 'Kit' : 'Modelo'}
          </span>
          <h3 className="text-xl font-black text-slate-800 mt-2">Alterar Item Cadastrado</h3>
        </div>

        <form onSubmit={handleUpdateMaterial} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Nome / Descrição</label>
            <input
              type="text"
              required
              value={editingMaterial.nome}
              onChange={e => setEditingMaterial({ ...editingMaterial, nome: e.target.value })}
              className="glass-input w-full"
              placeholder="Nome do material"
            />
          </div>

          {editingMaterial.tipo !== 'modelo' && (
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">
                {editingMaterial.tipo === 'vidro' ? 'Custo do m² (R$)' : editingMaterial.tipo === 'cor' ? 'Adicional do m² (R$)' : 'Custo do Kit (R$)'}
              </label>
              <input
                type="number"
                required
                value={editingMaterial.custo}
                onChange={e => setEditingMaterial({ ...editingMaterial, custo: e.target.value })}
                className="glass-input w-full font-mono-val"
                placeholder="Valor em R$"
              />
            </div>
          )}

          {editingMaterial.tipo === 'modelo' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Desenho Técnico (SVG)</label>
                <select
                  value={editingMaterial.tipoProjeto}
                  onChange={e => setEditingMaterial({ ...editingMaterial, tipoProjeto: e.target.value })}
                  className="glass-input w-full"
                >
                  <option value="box">Desenho Box</option>
                  <option value="janela">Desenho Janela</option>
                  <option value="porta">Desenho Porta</option>
                  <option value="espelho">Desenho Espelho</option>
                  <option value="outros">Desenho Genérico</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Ícone Emoji</label>
                <select
                  value={editingMaterial.icone}
                  onChange={e => setEditingMaterial({ ...editingMaterial, icone: e.target.value })}
                  className="glass-input w-full text-sm p-1.5"
                >
                  <option value="🛀">🛀 Box</option>
                  <option value="🪟">🪟 Janela</option>
                  <option value="🚪">🚪 Porta</option>
                  <option value="🪞">🪞 Espelho</option>
                  <option value="🏗️">🏗️ Obra/Outros</option>
                  <option value="📐">📐 Régua</option>
                  <option value="🛡️">🛡️ Escudo/Segurança</option>
                  <option value="🧼">🧼 Limpeza</option>
                </select>
              </div>
            </>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEditingMaterial(null)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/60 rounded-xl font-bold text-xs transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 btn-premium rounded-xl font-bold text-xs transition-all"
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
