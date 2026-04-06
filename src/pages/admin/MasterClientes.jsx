import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query, limit } from 'firebase/firestore';
import { FaArrowLeft, FaUsers, FaBoxOpen, FaPhoneAlt, FaShoppingBag, FaStore, FaClock } from 'react-icons/fa';

function MasterClientes() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    
    const fetchClientes = async () => {
      setLoading(true);
      try {
        const estabSnap = await getDocs(collection(db, 'estabelecimentos'));
        const emap = {};
        const elist = [];
        estabSnap.forEach(d => {
            emap[d.id] = d.data().nome || d.id;
            elist.push({ id: d.id, nome: d.data().nome || d.id });
        });
        setEstabMap(emap);
        setEstabList(elist.sort((a,b) => a.nome.localeCompare(b.nome)));

        // Query pedidos directly since totalPedidos isn't maintained on client documents
        const qPed = query(collectionGroup(db, 'pedidos'), limit(3500));
        const snap = await getDocs(qPed);
        let data = snap.docs.map(d => ({ id: d.id, ...d.data(), _path: d.ref.path }));

        const mapByPhone = {};
        data.forEach(p => {
          const cli = p.cliente || {};
          const phone = cli.telefone || p.clienteTelefone || p.telefone || 'Sem número';
          // Filter out generic bad phones if wanted, but let's keep all
          
          if (!mapByPhone[phone]) {
            mapByPhone[phone] = {
              nome: cli.nome || p.nome || 'Não Registrado',
              whatsapp: phone, // display field
              lojas: new Set(),
              pedidosAcumulados: 0,
              dataCadastro: null
            };
          }
          
          let estabId = 'desconhecido';
          if (p._path) {
            const parts = p._path.split('/');
            const idx = parts.indexOf('estabelecimentos');
            if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx+1];
          }
          if (estabId && estabId !== 'desconhecido') {
             mapByPhone[phone].lojas.add(estabId);
          }
          
          mapByPhone[phone].pedidosAcumulados += 1;
          
          if (!mapByPhone[phone].nome || mapByPhone[phone].nome === 'Não Registrado') {
             if (cli.nome || p.nome) mapByPhone[phone].nome = cli.nome || p.nome;
          }

          // Guardar a data mais antiga como cadastro inicial
          const rawDate = p.createdAt || p.dataPedido || null;
          let currentData = null;
          if (rawDate) {
              if (typeof rawDate.toDate === 'function') {
                  currentData = rawDate.toDate();
              } else if (rawDate instanceof Date) {
                  currentData = rawDate;
              } else {
                  currentData = new Date(rawDate);
              }
          }

          if (currentData && !isNaN(currentData.getTime())) {
              const currentTimestamp = currentData.getTime();
              const existingTimestamp = mapByPhone[phone].dataCadastro ? new Date(mapByPhone[phone].dataCadastro).getTime() : Infinity;
              
              if (currentTimestamp < existingTimestamp) {
                  mapByPhone[phone].dataCadastro = currentData;
              }
          }
        });

        let merged = Object.values(mapByPhone).map(c => {
          let lojasArr = Array.from(c.lojas);
          if (lojasArr.length === 0) lojasArr = ['desconhecido'];
          return {
             ...c,
             lojasArray: lojasArr
          };
        });

        // Sort by total orders
        merged.sort((a, b) => b.pedidosAcumulados - a.pedidosAcumulados);

        setClientes(merged);
      } catch (err) {
        console.error('Erro ao buscar clientes globais', err);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, [currentUser, isMasterAdmin]);

  if (authLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-red-500">Acesso Negado</div>;

  const filt_clientes = clientes.filter(c => {
    // Filtro texto
    const textMatch = (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (c.whatsapp || c.telefone || '').includes(searchTerm);
    if (!textMatch) return false;

    // Filtro Estabelecimento
    if (filterEstab !== 'todos') {
        if (!c.lojas.has(filterEstab)) return false;
    }

    return true;
  });

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-rose-50/20 min-h-screen font-sans p-6">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => navigate('/master-dashboard')} className="text-slate-400 hover:text-rose-600 flex items-center gap-2 mb-6 text-sm font-bold transition-colors">
          <FaArrowLeft /> Voltar ao Master
        </button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
            <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md">
                <FaUsers className="text-white text-xl" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rede: CRM Clientes</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Clientes únicos encontrados: <span className="font-bold text-rose-500">{filt_clientes.length}</span>
                </p>
            </div>
            </div>
            
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-role-400">
                    <FaStore className="text-slate-400" />
                    <select 
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer w-full min-w-[180px]"
                        value={filterEstab}
                        onChange={e => setFilterEstab(e.target.value)}
                    >
                        <option value="todos">Todas as Franquias</option>
                        {estabList.map(e => (
                            <option key={e.id} value={e.id}>{e.nome}</option>
                        ))}
                    </select>
                </div>
                <input 
                    type="text" 
                    placeholder="Buscar cliente ou wpp..." 
                    className="w-full sm:w-64 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-rose-400"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">Cruzando dados de clientes (<FaShoppingBag className="inline animate-bounce" />)...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             {filt_clientes.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 uppercase text-[10px] tracking-widest text-slate-400 font-black">
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Contato</th>
                        <th className="p-4 text-center">Pedidos Históricos</th>
                        <th className="p-4 text-right">Lojas Visitadas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filt_clientes.slice(0, 100).map((cli, i) => {
                            let dataCad = 'Data não registrada';
                            if (cli.dataCadastro) {
                                const d = new Date(cli.dataCadastro);
                                if (!isNaN(d.getTime())) {
                                    dataCad = d.toLocaleDateString('pt-BR');
                                }
                            }
                            return (
                                <tr key={cli.id || i} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                                <td className="p-4">
                                    <div className="font-bold text-slate-700">{cli.nome || 'Não Registrado'}</div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                                        <FaClock size={9}/> Desde: {dataCad}
                                    </div>
                                </td>
                                <td className="p-4 text-sm font-semibold text-slate-500">
                                    <div className="flex items-center gap-2"><FaPhoneAlt className="text-slate-300" size={10} /> {cli.whatsapp || cli.telefone || 'Sem número'}</div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className="font-black text-rose-500 text-lg">{cli.pedidosAcumulados}</span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex flex-wrap justify-end gap-1 max-w-[200px] float-right">
                                        {cli.lojasArray.map(l => {
                                            const realName = estabMap[l] || l;
                                            return <span key={l} className="text-[9px] uppercase font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={realName}>{realName}</span>
                                        })}
                                    </div>
                                </td>
                                </tr>
                            )
                        })}
                    </tbody>
                    </table>
                </div>
             ) : (
               <div className="py-20 text-center">
                 <FaBoxOpen className="mx-auto text-4xl text-slate-200 mb-3" />
                 <p className="text-slate-500 font-medium">Nenhum cliente atende à busca.</p>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MasterClientes;
