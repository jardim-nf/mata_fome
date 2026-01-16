import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  getDoc, 
  limit,
  orderBy,
  collectionGroup
} from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LIMIT = 50;

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'recebido', label: 'Recebido / Aberto' },
  { value: 'preparo', label: 'Em Preparo' },
  { value: 'em_entrega', label: 'Em Entrega' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'cancelado', label: 'Cancelado' },
];

// --- HELPERS VISUAIS ---

const safeString = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return val.nome || val.name || val.cliente || '';
  }
  return String(val);
};

const getOrderDate = (item) => {
  if (!item) return null;
  const timestamp = 
    item.dataPedido || 
    item.adicionadoEm || 
    item.updatedAt || 
    item.createdAt || 
    item.criadoEm;

  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  return new Date(timestamp);
};

const formatDate = (dateObj) => {
  if (!dateObj) return '--/-- --:--';
  try {
    return format(dateObj, 'dd/MM HH:mm', { locale: ptBR });
  } catch (e) { return 'Data Inv.'; }
};

// Formata ID para não ficar gigante (ex: "pedido_XyZ..." vira "#XyZ...")
const formatId = (id) => {
  if (!id) return '#---';
  // Se for ID longo do Firestore ou customizado
  if (id.length > 8) {
    // Tenta pegar a parte depois do underline se houver (ex: pedido_123 -> 123)
    const parts = id.split('_');
    if (parts.length > 1) return `#${parts[1].substring(0, 6)}...`;
    return `#${id.substring(0, 6)}...`;
  }
  return `#${id}`;
};

function ListarPedidosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [itemsMap, setItemsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [indexErrors, setIndexErrors] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstabelecimento, setFilterEstabelecimento] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  
  // Lista de estabelecimentos (usada para preencher nomes rapidamente)
  const [estabelecimentosList, setEstabelecimentosList] = useState([]);

  // Carregar Estabelecimentos e criar um Mapa para acesso rápido
  useEffect(() => {
    const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setEstabelecimentosList(snap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
    });
    return () => unsub();
  }, []);

  // Cria um dicionário { id: "Nome" } para busca instantânea
  const estabMap = useMemo(() => {
    return estabelecimentosList.reduce((acc, curr) => {
      acc[curr.id] = curr.nome;
      return acc;
    }, {});
  }, [estabelecimentosList]);

  // --- BUSCA GLOBAL ---
  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    setLoading(true);
    setItemsMap({});
    setIndexErrors([]);

    const strategies = [
      // 1. Pedidos (Delivery Global)
      { 
        name: 'GLOBAL_PEDIDOS', 
        q: query(collectionGroup(db, 'pedidos'), orderBy('dataPedido', 'desc'), limit(LIMIT)),
        msg: 'Pedidos (Global)'
      },
      // 2. Vendas (Mesa Global)
      { 
        name: 'GLOBAL_VENDAS', 
        q: query(collectionGroup(db, 'vendas'), orderBy('updatedAt', 'desc'), limit(LIMIT)),
        msg: 'Vendas (Global)'
      },
      // 3. Fallback (Root)
      { 
        name: 'ROOT_PEDIDOS', 
        q: query(collection(db, 'pedidos'), orderBy('createdAt', 'desc'), limit(LIMIT)),
        msg: 'Pedidos (Antigos)'
      }
    ];

    const unsubscribes = strategies.map(strat => {
      return onSnapshot(strat.q, async (snapshot) => {
        const rawDocs = snapshot.docs.map(d => ({ 
          id: d.id, 
          ...d.data(), 
          _path: d.ref.path // Caminho útil para identificar pai
        }));

        const processed = await Promise.all(rawDocs.map(async (item) => {
          
          // --- 1. RESOLUÇÃO DE NOME DO ESTABELECIMENTO ---
          let eNome = item.estabelecimentoNome;
          // Se não tem nome, tenta achar pelo ID no nosso mapa carregado
          if (!eNome && item.estabelecimentoId && estabMap[item.estabelecimentoId]) {
            eNome = estabMap[item.estabelecimentoId];
          }
          // Fallback: Tenta extrair do caminho (path) se for subcoleção
          // Ex: estabelecimentos/ID_DO_ESTAB/pedidos/...
          if (!eNome && item._path && item._path.includes('estabelecimentos/')) {
             const parts = item._path.split('/');
             const estabIdFromPath = parts[1]; // O ID vem logo depois de 'estabelecimentos'
             if (estabMap[estabIdFromPath]) eNome = estabMap[estabIdFromPath];
          }
          if (!eNome) eNome = 'Estabelecimento n/d';

          // --- 2. RESOLUÇÃO DE NOME DO CLIENTE ---
          let cNome = safeString(item.clienteNome || item.cliente);
          
          // Se for Mesa, às vezes o nome vem vazio, então usamos "Mesa X"
          if ((!cNome || cNome === 'Cliente') && (item.mesaNumero || item.mesaId)) {
             cNome = item.mesaNumero ? `Mesa ${item.mesaNumero}` : 'Mesa (Balcão)';
          }

          // Se ainda for desconhecido e tiver ID, busca no banco (último recurso)
          if ((!cNome || cNome === 'Cliente') && item.clienteId) {
             try {
               const cSnap = await getDoc(doc(db, 'clientes', item.clienteId));
               if (cSnap.exists()) cNome = cSnap.data().nome;
             } catch(e) {}
          }
          
          if (!cNome || cNome === 'Cliente') cNome = 'Cliente Balcão / Não Idenf.';

          // --- 3. DEFINIR TIPO ---
          let tipoExibicao = 'DELIVERY';
          if (strat.name.includes('VENDAS') || item.source === 'salao' || item.mesaId || item.mesaNumero || cNome.includes('Mesa')) {
              tipoExibicao = 'SALÃO';
          }

          return {
            ...item,
            clienteNomeFinal: cNome,
            estabelecimentoNomeFinal: eNome,
            tipoExibicao,
            valorFinal: item.totalFinal ?? item.total ?? 0
          };
        }));

        setItemsMap(prev => {
          const next = { ...prev };
          processed.forEach(p => next[p.id] = p);
          return next;
        });
        setLoading(false);

      }, (err) => {
        if (err.code === 'failed-precondition' && err.message.includes('index')) {
           const linkMatch = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
           const link = linkMatch ? linkMatch[0] : null;
           if (link) {
             setIndexErrors(prev => {
               if (prev.some(e => e.link === link)) return prev;
               return [...prev, { label: strat.msg, link }];
             });
           }
        }
      });
    });

    return () => unsubscribes.forEach(u => u());
  }, [currentUser, isMasterAdmin, estabMap]); // Recarrega se a lista de estabs mudar

  // Ordenação e Filtros
  const listaFinal = Object.values(itemsMap).sort((a, b) => {
    const dA = getOrderDate(a) || new Date(0);
    const dB = getOrderDate(b) || new Date(0);
    return dB - dA;
  });

  const displayed = listaFinal.filter(item => {
    const term = searchTerm.toLowerCase();
    const txt = (
      safeString(item.id).toLowerCase() + 
      safeString(item.clienteNomeFinal).toLowerCase() + 
      safeString(item.estabelecimentoNomeFinal).toLowerCase()
    );
    const matchText = txt.includes(term);
    const matchEstab = filterEstabelecimento === 'todos' || item.estabelecimentoId === filterEstabelecimento;
    const matchStatus = filterStatus === 'todos' || item.status === filterStatus;
    return matchText && matchEstab && matchStatus;
  });

  if (authLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!currentUser || !isMasterAdmin) return null;

  return (
    <div className="bg-gray-100 min-h-screen pt-24 pb-8 px-4">
      {/* HEADER FIXO COM BOTÃO VOLTAR */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md p-4 flex justify-between items-center border-b">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
           <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center text-white font-bold text-xs">DF</div>
           <h1 className="font-bold text-lg text-gray-800 hidden sm:block">MONITOR DE PEDIDOS</h1>
        </div>
        <div className="flex gap-3">
            {/* BOTÃO VOLTAR */}
            <Link 
              to="/master-dashboard" 
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar
            </Link>
            <button 
              onClick={logout} 
              className="px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Sair
            </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-6">
        
        {/* Alerta de Índice */}
        {indexErrors.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded shadow-lg mb-8">
            <h3 className="font-bold text-red-700 mb-2">⚠️ Necessário criar índice de grupo</h3>
            <div className="space-y-2">
              {indexErrors.map((error, idx) => (
                <div key={idx} className="bg-white p-2 border flex justify-between items-center">
                  <span className="text-sm">{error.label}</span>
                  <a href={error.link} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-600 text-white px-3 py-1 rounded font-bold">CRIAR</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 border border-gray-100">
           <input type="text" placeholder="Buscar ID, Cliente, Estab..." className="border p-2 rounded outline-none focus:border-yellow-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           <select className="border p-2 rounded outline-none focus:border-yellow-500" value={filterEstabelecimento} onChange={e => setFilterEstabelecimento(e.target.value)}>
              <option value="todos">Todos Estabelecimentos</option>
              {estabelecimentosList.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
           </select>
           <select className="border p-2 rounded outline-none focus:border-yellow-500" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
           </select>
        </div>

        {/* Lista */}
        {loading && listaFinal.length === 0 ? (
           <div className="text-center py-12 text-gray-500">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-2"></div>
             Carregando pedidos...
           </div>
        ) : (
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-12">
             {displayed.length > 0 ? displayed.map(item => (
               <div key={item.id} className={`bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-all relative ${item.tipoExibicao === 'SALÃO' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-orange-500'}`}>
                  
                  <div className="absolute top-3 right-3">
                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${item.tipoExibicao === 'SALÃO' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                       {item.tipoExibicao}
                    </span>
                  </div>

                  <div className="flex justify-between items-start mb-2 pr-16">
                     <div>
                        <span className="font-bold text-gray-800 text-lg">{formatId(item.id)}</span>
                        <span className="text-xs text-gray-400 block mt-0.5">📅 {formatDate(getOrderDate(item))}</span>
                     </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 grid grid-cols-2 gap-4 mt-3 bg-gray-50 p-3 rounded border border-gray-100">
                     <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Estabelecimento</span>
                        <span className="truncate block font-medium text-gray-800" title={item.estabelecimentoNomeFinal}>
                            {item.estabelecimentoNomeFinal}
                        </span>
                     </div>
                     <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Cliente</span>
                        <span className="truncate block font-medium text-gray-800" title={item.clienteNomeFinal}>
                            {item.clienteNomeFinal}
                        </span>
                     </div>
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                     <span className="font-bold text-lg text-green-600">
                        R$ {Number(item.valorFinal).toFixed(2).replace('.', ',')}
                     </span>
                     <div className="flex items-center gap-2">
                       <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          item.status === 'finalizada' || item.status === 'finalizado' ? 'bg-green-100 text-green-700' : 
                          item.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                       }`}>
                          {item.status || 'FINALIZADO'}
                       </span>
                       <button onClick={() => navigate(`/master/pedidos/${item.id}`)} className="px-3 py-1.5 bg-gray-900 text-white rounded text-sm font-medium hover:bg-black transition-colors">
                          Detalhes
                       </button>
                     </div>
                  </div>
               </div>
             )) : (
               <div className="col-span-2 text-center text-gray-500 py-10 bg-white rounded border border-dashed">
                 Nenhum pedido encontrado.
               </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}

export default ListarPedidosMaster;