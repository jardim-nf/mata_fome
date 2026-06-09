import React, { useState, useMemo } from 'react';
import { isPedidoCancelado, traduzirPagamento } from '../../../utils/reportUtils';
import { format } from 'date-fns';
import { FaMotorcycle } from "react-icons/fa";
import { IoChevronUp, IoChevronDown } from "react-icons/io5";

// Helper: extrai nome seguro de clienteNome (pode vir como objeto do Firestore)
const safeClienteNome = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.nome || val.name || 'Cliente';
    return String(val);
};

export default function DetailedTable({ filteredPedidos }) {
    const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });

    const handleSort = (key) => {
        if (!key) return;
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedPedidos = useMemo(() => {
        let sortableItems = [...filteredPedidos];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'cliente_mesa') {
                    aValue = a.tipo === 'mesa' ? `Mesa ${String(a.mesaNumero).padStart(4, '0')}` : safeClienteNome(a.clienteNome).toLowerCase();
                    bValue = b.tipo === 'mesa' ? `Mesa ${String(b.mesaNumero).padStart(4, '0')}` : safeClienteNome(b.clienteNome).toLowerCase();
                } else if (sortConfig.key === 'pagamento') {
                    aValue = traduzirPagamento(a.formaPagamento).toLowerCase();
                    bValue = traduzirPagamento(b.formaPagamento).toLowerCase();
                } else if (sortConfig.key === 'valorLiquido') {
                    aValue = a.totalFinal || 0;
                    bValue = b.totalFinal || 0;
                } else if (sortConfig.key === 'data') {
                    aValue = a.data ? new Date(a.data).getTime() : 0;
                    bValue = b.data ? new Date(b.data).getTime() : 0;
                } else if (sortConfig.key === 'status') {
                    aValue = (a.status || '').toLowerCase();
                    bValue = (b.status || '').toLowerCase();
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredPedidos, sortConfig]);

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <IoChevronDown className="inline-block ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return sortConfig.direction === 'asc' ? <IoChevronUp className="inline-block ml-1 text-blue-600" /> : <IoChevronDown className="inline-block ml-1 text-blue-600" />;
    };

    const Th = ({ label, sortKey, className = "" }) => (
        <th 
            className={`px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors group select-none ${className}`}
            onClick={() => handleSort(sortKey)}
        >
            <div className="flex items-center">
                {label}
                {sortKey && getSortIcon(sortKey)}
            </div>
        </th>
    );

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <Th label="Data" sortKey="data" />
                        <Th label="ID" sortKey={null} />
                        <Th label="Cliente/Mesa" sortKey="cliente_mesa" />
                        <Th label="Entregador" sortKey={null} />
                        <Th label="Pagamento" sortKey="pagamento" />
                        <Th label="Valor Líquido" sortKey="valorLiquido" />
                        <Th label="Status" sortKey="status" />
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {sortedPedidos.map(p => {
                        const pedidoCancelado = isPedidoCancelado(p);
                        const teveItemCancelado = p.itens?.some(it => String(it.status).toLowerCase() === 'cancelado');
                        return (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{format(p.data, 'dd/MM HH:mm')}</td>
                                <td className="px-4 py-3 text-sm">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.tipo === 'mesa' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {p.tipo.toUpperCase()}
                                    </span>
                                    <span className="ml-2 text-gray-500 font-mono text-xs">#{p.id.slice(0,6)}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {p.tipo === 'mesa' ? 
                                        <div className="font-bold">Mesa {p.mesaNumero} <span className="text-gray-400 font-normal text-xs">{p.loteHorario}</span></div> : 
                                        <div>{safeClienteNome(p.clienteNome)} <div className="text-xs text-gray-400">{p.bairro}</div></div>
                                    }
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {p.motoboyNome ? <div className="flex items-center gap-1"><FaMotorcycle className="text-gray-500"/> {p.motoboyNome}</div> : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {p.pagamentos && Object.keys(p.pagamentos).length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {Object.entries(p.pagamentos).map(([chave, dadosPgto], idx) => (
                                                <div key={idx} className="text-[11px] flex items-center justify-between gap-2 border-b border-gray-100 last:border-0 pb-1 last:pb-0">
                                                    <span className="font-semibold text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                        {traduzirPagamento(dadosPgto.formaPagamento)}
                                                    </span>
                                                    <span className="text-gray-600 font-medium">
                                                        {Number(dadosPgto.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[11px] font-semibold text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                            {traduzirPagamento(p.formaPagamento)}
                                        </span>
                                    )}
                                </td>
                                <td className={`px-4 py-3 text-sm font-bold ${pedidoCancelado ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                    <div>{p.totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                    {p.status === 'pago_parcial' && p.valorOriginal > p.totalFinal && (
                                        <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                                            de {Number(p.valorOriginal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${pedidoCancelado ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {pedidoCancelado ? 'CANCELADO' : p.status}
                                    </span>
                                    {teveItemCancelado && !pedidoCancelado && (
                                        <p className="text-[10px] text-red-500 font-bold mt-1">Teve item cancelado</p>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
