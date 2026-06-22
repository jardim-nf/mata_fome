import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { 
  IoPersonOutline, 
  IoDownloadOutline, 
  IoLogoWhatsapp 
} from 'react-icons/io5';
import { db } from '../../../../firebase';
import { collection, getDocs } from 'firebase/firestore';

const ClientesTab = ({ pedidos, setSelectedOS, STATUS_OS, estabId }) => {
  const [searchClienteQuery, setSearchClienteQuery] = useState('');
  const [clientesBase, setClientesBase] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientes = async () => {
      if (!estabId) return;
      try {
        const colRef = collection(db, 'estabelecimentos', estabId, 'clientes');
        const snap = await getDocs(colRef);
        setClientesBase(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro ao carregar clientes na aba:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, [estabId]);

  // Agrupar e calcular métricas de clientes únicos a partir de pedidos e base de clientes
  const uniqueClients = useMemo(() => {
    // 1. Mapear clientes cadastrados na base de dados
    const list = clientesBase.map(c => {
      const cleanPhone = (c.telefone || '').replace(/\D/g, '');
      const osCliente = pedidos.filter(p => {
        const pPhone = (p.cliente?.telefone || '').replace(/\D/g, '');
        return p.clienteId === c.id || (cleanPhone && pPhone === cleanPhone) || (p.cliente?.nome && p.cliente.nome.toLowerCase() === (c.nome || '').toLowerCase());
      });

      const totalGasto = osCliente.reduce((s, p) => s + (p.projeto?.precoVenda || 0), 0);
      
      const ultimaOS = [...osCliente].sort((a, b) => {
        const da = a.criadoEm ? new Date(a.criadoEm) : new Date(0);
        const db = b.criadoEm ? new Date(b.criadoEm) : new Date(0);
        return db - da;
      })[0];

      const dataUltima = ultimaOS?.criadoEm 
        ? new Date(ultimaOS.criadoEm).toLocaleDateString('pt-BR') 
        : '—';

      const formatAddress = (endereco) => {
        if (!endereco) return 'Não informado';
        if (typeof endereco === 'string') return endereco;
        const parts = [
            endereco.rua,
            endereco.numero && `nº ${endereco.numero}`,
            endereco.bairro,
            endereco.cidade
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Não informado';
      };

      return { 
        nome: c.nome || 'N/A', 
        tel: c.telefone || 'Não informado', 
        end: formatAddress(c.endereco), 
        osList: osCliente, 
        totalGasto, 
        dataUltima 
      };
    });

    // 2. Adicionar clientes que só existem no histórico de pedidos (para integridade de dados antigos)
    const existingNames = new Set(list.map(c => c.nome.toLowerCase().trim()));
    
    pedidos.forEach(p => {
      const name = p.cliente?.nome || '';
      if (name && !existingNames.has(name.toLowerCase().trim())) {
        existingNames.add(name.toLowerCase().trim());
        
        const osCliente = pedidos.filter(p2 => p2.cliente?.nome === name);
        const totalGasto = osCliente.reduce((s, p2) => s + (p2.projeto?.precoVenda || 0), 0);
        
        const ultimaOS = [...osCliente].sort((a, b) => {
          const da = a.criadoEm ? new Date(a.criadoEm) : new Date(0);
          const db = b.criadoEm ? new Date(b.criadoEm) : new Date(0);
          return db - da;
        })[0];

        const dataUltima = ultimaOS?.criadoEm 
          ? new Date(ultimaOS.criadoEm).toLocaleDateString('pt-BR') 
          : '—';

        list.push({ 
          nome: name, 
          tel: p.cliente?.telefone || 'Não informado', 
          end: p.cliente?.endereco || 'Não informado', 
          osList: osCliente, 
          totalGasto, 
          dataUltima 
        });
      }
    });

    // Filtrar pela busca
    const q = searchClienteQuery.toLowerCase().trim();
    const filtered = q
      ? list.filter(c => c.nome.toLowerCase().includes(q) || c.tel.toLowerCase().includes(q))
      : list;

    // Ordenar por gasto (ou nome alfabético se empatado)
    return filtered.sort((a, b) => {
      if (b.totalGasto !== a.totalGasto) {
        return b.totalGasto - a.totalGasto;
      }
      return a.nome.localeCompare(b.nome);
    });
  }, [clientesBase, pedidos, searchClienteQuery]);

  const totalClientes = uniqueClients.length;

  const handleExportCSV = () => {
    const csvContent = uniqueClients.map(c => 
      `"${c.nome}","${c.tel}","${c.end}",${c.osList.length},"${c.totalGasto.toFixed(2)}"`
    );
    const csv = 'Nome,Telefone,Endereço,Projetos,Total Gasto\n' + csvContent.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_vidracaria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('📄 CSV exportado com sucesso!');
  };

  return (
    <div className="glass-card p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <IoPersonOutline /> Clientes da Vidraçaria
          </h2>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{totalClientes} clientes cadastrados</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-56">
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchClienteQuery}
              onChange={e => setSearchClienteQuery(e.target.value)}
              className="glass-input w-full text-xs py-2 pl-3 pr-8"
            />
            <span className="absolute right-3 top-2 text-slate-400 text-xs">🔍</span>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-black transition-all whitespace-nowrap"
          >
            <IoDownloadOutline size={14} /> CSV
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {uniqueClients.map(cliente => (
          <div key={cliente.nome} className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all">
            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-4">
              {/* Info Principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0">
                    {cliente.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 truncate">{cliente.nome}</h4>
                    <p className="text-[10px] text-slate-500 font-semibold">{cliente.tel}</p>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 truncate pl-10" title={cliente.end}>📍 {cliente.end}</p>
              </div>

              {/* Métricas */}
              <div className="flex items-center gap-3 sm:gap-4 pl-10 sm:pl-0">
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Projetos</p>
                  <p className="text-sm font-black text-slate-900">{cliente.osList.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Total</p>
                  <p className="text-sm font-black text-emerald-700">R$ {cliente.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Última OS</p>
                  <p className="text-[10px] font-bold text-slate-700">{cliente.dataUltima}</p>
                </div>
                
                {/* Botão WhatsApp */}
                {cliente.tel && cliente.tel !== 'Não informado' && (
                  <a
                    href={`https://wa.me/55${cliente.tel.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${cliente.nome}! Aqui é da vidraçaria. Como posso ajudar?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all hover:scale-110 shrink-0"
                    title="Enviar WhatsApp"
                  >
                    <IoLogoWhatsapp size={16} />
                  </a>
                )}
              </div>
            </div>

            {/* OS do cliente */}
            <div className="flex flex-wrap gap-1.5 mt-2 pl-10">
              {cliente.osList.map(os => (
                <button
                  key={os.id}
                  onClick={() => setSelectedOS(os)}
                  className={`px-2 py-0.5 rounded-lg border text-[8px] sm:text-[9px] font-black uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-0.5 shadow-sm ${
                    STATUS_OS[os.status]?.color || 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                  title={`OS #${os.id.substring(0, 5).toUpperCase()}`}
                >
                  <span>{os.projeto?.tipoProjeto === 'box' ? '🛀' : os.projeto?.tipoProjeto === 'janela' ? '🪟' : os.projeto?.tipoProjeto === 'porta' ? '🚪' : os.projeto?.tipoProjeto === 'espelho' ? '🪞' : '🏗️'}</span>
                  {os.projeto?.modelo}
                </button>
              ))}
            </div>
          </div>
        ))}
        {uniqueClients.length === 0 && (
          <div className="py-12 text-center text-slate-400 font-semibold">
            <span className="text-4xl block mb-2">👥</span>
            Nenhum cliente encontrado.
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientesTab;
