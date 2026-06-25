import React, { useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { IoPersonOutline, IoDownloadOutline } from 'react-icons/io5';

const ClientesTab = ({ pedidos, setSelectedOS, STATUS_OS, dbClientes }) => {
  const [searchClienteQuery, setSearchClienteQuery] = useState('');
  const clientesBase = dbClientes || [];

  // Calcular métricas agrupadas por cliente
  const uniqueClients = useMemo(() => {
    const list = clientesBase.map(c => {
      const cleanPhone = (c.telefone || '').replace(/\D/g, '');
      const osCliente = pedidos.filter(p => {
        const pPhone = (p.cliente?.telefone || '').replace(/\D/g, '');
        return p.clienteId === c.id || (cleanPhone && pPhone === cleanPhone) || (p.cliente?.nome && p.cliente.nome.toLowerCase() === (c.nome || '').toLowerCase());
      });

      const totalGasto = osCliente.reduce((sum, p) => sum + (p.projeto?.precoVenda || 0), 0);
      
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

    // Mesclar com clientes que só existem nos pedidos antigos
    const existingNames = new Set(list.map(c => c.nome.toLowerCase().trim()));
    pedidos.forEach(p => {
      const name = p.cliente?.nome || '';
      if (name && !existingNames.has(name.toLowerCase().trim())) {
        existingNames.add(name.toLowerCase().trim());
        
        const osCliente = pedidos.filter(p2 => p2.cliente?.nome === name);
        const totalGasto = osCliente.reduce((sum, p2) => sum + (p2.projeto?.precoVenda || 0), 0);
        
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

    // Ordenar por gasto
    return filtered.sort((a, b) => b.totalGasto - a.totalGasto);
  }, [clientesBase, pedidos, searchClienteQuery]);

  const handleExportCSV = () => {
    const csvContent = uniqueClients.map(c => 
      `"${c.nome}","${c.tel}","${c.end}",${c.osList.length},"${c.totalGasto.toFixed(2)}"`
    );
    const csv = 'Nome,Telefone,Endereço,Projetos,Total Gasto\n' + csvContent.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_serralheria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('📄 CSV exportado com sucesso!');
  };

  return (
    <div className="glass-card p-4 sm:p-6 space-y-4 text-left">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <IoPersonOutline /> Clientes do IdeaSerralheiro
          </h2>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{uniqueClients.length} clientes na base</p>
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0">
                    {cliente.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 truncate">{cliente.nome}</h4>
                    <p className="text-[10px] text-slate-500 font-semibold">{cliente.tel}</p>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 truncate pl-10" title={cliente.end}>📍 {cliente.end}</p>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 pl-10 sm:pl-0">
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Projetos</p>
                  <p className="text-sm font-black text-slate-900">{cliente.osList.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Total</p>
                  <p className="text-sm font-black text-amber-700">R$ {cliente.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Última OS</p>
                  <p className="text-[10px] font-bold text-slate-700">{cliente.dataUltima}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientesTab;
