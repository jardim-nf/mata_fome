import React from 'react';
import { isPedidoCancelado, traduzirPagamento } from '../../../utils/reportUtils';
import { format } from 'date-fns';
import { FaMotorcycle } from "react-icons/fa";

export default function DetailedTable({ filteredPedidos }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente/Mesa</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entregador</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagamento</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Líquido</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPedidos.map(p => {
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
                                        <div>{p.clienteNome} <div className="text-xs text-gray-400">{p.bairro}</div></div>
                                    }
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {p.motoboyNome ? <div className="flex items-center gap-1"><FaMotorcycle className="text-gray-500"/> {p.motoboyNome}</div> : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {traduzirPagamento(p.formaPagamento)}
                                </td>
                                <td className={`px-4 py-3 text-sm font-bold ${pedidoCancelado ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                    {p.totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
