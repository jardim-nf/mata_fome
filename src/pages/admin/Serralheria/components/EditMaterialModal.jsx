import React, { useState, useEffect } from 'react';
import { db } from '../../../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { IoCloseOutline, IoSaveOutline } from 'react-icons/io5';

const EditMaterialModal = ({ editingMaterial, setEditingMaterial, estabId }) => {
  const [nome, setNome] = useState('');
  const [custo, setCusto] = useState('');
  const [pesoMetro, setPesoMetro] = useState('');
  const [tipoProjeto, setTipoProjeto] = useState('portao');

  useEffect(() => {
    if (editingMaterial) {
      setNome(editingMaterial.nome || '');
      setCusto(editingMaterial.custo || editingMaterial.custoBarra || editingMaterial.adicionalM2 || 0);
      setPesoMetro(editingMaterial.pesoMetro || 0);
      setTipoProjeto(editingMaterial.tipoProjeto || 'portao');
    }
  }, [editingMaterial]);

  if (!editingMaterial) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!nome.trim() || !custo) return toast.warn('Preencha os campos obrigatórios!');

    try {
      const docRef = doc(db, 'estabelecimentos', estabId, 'insumos', editingMaterial.id);
      
      let payload = {
        nome: nome.trim(),
        custo: Number(custo)
      };

      // Ajustar propriedades específicas de acordo com o tipo
      if (editingMaterial.tipoVidracaria === 'vidro') {
        // perfis
        payload.pesoMetro = Number(pesoMetro) || 0;
        payload.custoBarra = Number(custo);
        payload.custoM2 = Number(custo) / 6; // linear meter
      } else if (editingMaterial.tipoVidracaria === 'cor') {
        // coberturas
        payload.adicionalM2 = Number(custo);
      } else if (editingMaterial.tipoVidracaria === 'modelo') {
        payload.tipoProjeto = tipoProjeto;
      }

      await updateDoc(docRef, payload);
      toast.success('✅ Item atualizado com sucesso!');
      setEditingMaterial(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar material.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[7000] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative text-left">
        <button
          onClick={() => setEditingMaterial(null)}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 border border-slate-200 p-1 rounded-lg hover:bg-slate-100 transition-all"
        >
          <IoCloseOutline size={20} />
        </button>

        <div>
          <h3 className="text-sm font-black text-slate-900">Editar Material</h3>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Atualize as informações do item selecionado</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Nome do Material</label>
            <input
              type="text"
              required
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="glass-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Preço / Custo</label>
              <input
                type="number"
                required
                step="0.01"
                value={custo}
                onChange={e => setCusto(e.target.value)}
                className="glass-input w-full font-mono"
              />
            </div>

            {editingMaterial.tipoVidracaria === 'vidro' && (
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Peso (kg/m)</label>
                <input
                  type="number"
                  step="0.001"
                  value={pesoMetro}
                  onChange={e => setPesoMetro(e.target.value)}
                  className="glass-input w-full font-mono"
                />
              </div>
            )}

            {editingMaterial.tipoVidracaria === 'modelo' && (
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Tipo Projeto</label>
                <select
                  value={tipoProjeto}
                  onChange={e => setTipoProjeto(e.target.value)}
                  className="glass-input w-full font-semibold"
                >
                  <option value="portao">Portão</option>
                  <option value="telhado">Telhado</option>
                  <option value="grade">Grade</option>
                  <option value="movel">Móvel Industrial</option>
                </select>
              </div>
            )}
          </div>

          <button type="submit" className="w-full py-2.5 amber-gradient-btn text-xs flex items-center justify-center gap-1.5">
            <IoSaveOutline size={16} /> Salvar Alterações
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditMaterialModal;
