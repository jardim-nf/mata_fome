// src/components/DashboardSummary.jsx - VERSÃO 3: EXPANSÍVEL
import React, { useState } from "react";

const DashboardSummary = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Cabeçalho Cliqueável */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-900">Resumo do Dia</h2>
            <div className="hidden sm:flex items-center space-x-4 text-sm text-gray-500">
              <span>•</span>
              <span>Atualizado: 16:53</span>
              <span>•</span>
              <span>Atualiza a cada 30s</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Dados Resumidos */}
            <div className="text-right">
              <div className="text-xl font-bold text-blue-700">R$ 156,50</div>
              <div className="text-xs text-gray-600">Faturamento Total</div>
            </div>
            
            {/* Ícone de Expansão */}
            <div className={`transform transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Expansível */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Faturamento Total */}
            <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="text-2xl font-bold text-blue-700">R$ 156,50</div>
              <div className="text-sm text-gray-600 mt-1">Faturamento Total Hoje</div>
            </div>

            {/* Vendas Delivery */}
            <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
              <div className="text-xl font-bold text-red-700">0</div>
              <div className="text-sm text-gray-600 mt-1">Vendas Delivery</div>
              <div className="text-lg font-semibold text-red-600 mt-2">R$ 0,00</div>
              <div className="text-xs text-gray-500">Faturamento Delivery</div>
            </div>

            {/* Vendas Salão */}
            <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
              <div className="text-xl font-bold text-green-700">1</div>
              <div className="text-sm text-gray-600 mt-1">Vendas Salão</div>
              <div className="text-lg font-semibold text-green-600 mt-2">R$ 156,50</div>
              <div className="text-xs text-gray-500">Faturamento Salão</div>
            </div>

            {/* Total Geral */}
            <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="text-xl font-bold text-purple-700">1</div>
              <div className="text-sm text-gray-600 mt-1">Total de Vendas Hoje</div>
              <div className="text-xs text-gray-500 mt-2">Atualizado às 16:53</div>
              <div className="text-xs text-gray-400">Próxima atualização em 30s</div>
            </div>

          </div>
        </div>
      )}

      {/* Versão Mobile do Status */}
      <div className="sm:hidden px-4 pb-3 border-t border-gray-100 pt-3">
        <div className="text-center text-sm text-gray-500">
          Atualizado: 16:53 • Atualiza a cada 30s
        </div>
      </div>
    </div>
  );
};

export default DashboardSummary;