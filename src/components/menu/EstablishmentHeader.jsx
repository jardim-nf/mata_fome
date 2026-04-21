import React, { useState } from 'react';
import { IoLocationSharp, IoTime, IoLogOutOutline, IoReceiptOutline, IoNotificationsOutline } from 'react-icons/io5';
import { useAuth } from '../../context/AuthContext';

export default function EstablishmentHeader({ estabelecimentoInfo, coresEstabelecimento, isLojaAberta, currentTime, currentUser, onLogout, saldoCarteira = 0, onViewHistory }) {
  const { requestPushPermission } = useAuth();
  const [askedPush, setAskedPush] = useState(false);

  if (!estabelecimentoInfo) return null;

  const getHorarioTexto = () => {
    if (estabelecimentoInfo.horariosFuncionamento) {
      const dias = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
      const config = estabelecimentoInfo.horariosFuncionamento[dias[currentTime.getDay()]];
      if (config?.ativo) return `Aberto das ${config.abertura} às ${config.fechamento}`;
      return 'Fechado Hoje';
    }
    if (estabelecimentoInfo.horaAbertura && estabelecimentoInfo.horaFechamento) {
      return `Aberto das ${estabelecimentoInfo.horaAbertura} às ${estabelecimentoInfo.horaFechamento}`;
    }
    return 'Horário não informado';
  };

  return (
    <div className="rounded-xl p-6 mb-6 mt-6 border flex gap-6 items-center shadow-lg relative"
      style={{ backgroundColor: coresEstabelecimento.primaria }}>
      <div className="absolute top-4 right-4 z-10">
        {currentUser && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {!askedPush && 'Notification' in window && Notification.permission === 'default' && (
                <button onClick={async () => { setAskedPush(true); await requestPushPermission(); }} className="flex items-center gap-1 text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 shadow-sm hover:bg-indigo-100 transition-colors animate-pulse">
                  <IoNotificationsOutline size={16} /><span className="hidden sm:inline">Avisos</span>
                </button>
              )}
              <button onClick={onViewHistory} className="flex items-center gap-1.5 text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors">
                <IoReceiptOutline size={16} /><span>Meus Pedidos</span>
              </button>
              <button onClick={onLogout} className="flex items-center gap-1.5 text-sm text-red-500 bg-white px-3 py-1 rounded-full border border-red-100 hover:bg-red-50 transition-colors">
                <IoLogOutOutline size={18} /><span>Sair</span>
              </button>
            </div>
            {saldoCarteira > 0 && (
              <div className="bg-[#00E6A4] text-gray-900 px-3 py-1.5 rounded-xl border-2 border-white shadow-md flex flex-col items-end animate-bounce-short">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Seu Cashback</span>
                <span className="text-sm font-black">R$ {saldoCarteira.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <img src={estabelecimentoInfo.imageUrl} className="w-24 h-24 rounded-xl object-cover border-4 border-white bg-white" alt="Logo" />
      <div className="flex-1 text-white">
        <h1 className="text-3xl font-bold mb-2 flex flex-wrap items-center gap-3">
          {estabelecimentoInfo.nome}
          {!isLojaAberta && (
            <span className="text-xs bg-red-600 text-white px-3 py-1 rounded-full font-black tracking-widest border-2 border-white shadow-sm uppercase animate-pulse">
              FECHADO
            </span>
          )}
        </h1>
        <div className="text-sm text-white/90 font-medium">
          <p className="flex items-center gap-2"><IoLocationSharp /> {estabelecimentoInfo.endereco?.rua}</p>
          <p className="flex items-center gap-2 mt-1 text-xs sm:text-sm">
            <IoTime className="shrink-0" />{getHorarioTexto()}
          </p>
        </div>
      </div>
    </div>
  );
}