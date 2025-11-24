// src/pages/admin/AdminPaymentSettings.jsx
import React, { useState } from 'react';
import { usePayment } from '../../context/PaymentContext';

const AdminPaymentSettings = () => {
  const { paymentMethods } = usePayment();
  const [settings, setSettings] = useState({
    pix: true,
    credit: true,
    debit: true,
    mercadopago: true,
    cash: true
  });

  const togglePaymentMethod = (method) => {
    setSettings(prev => ({
      ...prev,
      [method]: !prev[method]
    }));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configurações de Pagamento</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Métodos de Pagamento Disponíveis</h2>
        
        <div className="space-y-4">
          {paymentMethods.map(method => (
            <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{method.icon}</span>
                <div>
                  <div className="font-medium">{method.name}</div>
                  <div className="text-sm text-gray-500">{method.description}</div>
                </div>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[method.type]}
                  onChange={() => togglePaymentMethod(method.type)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF6B35]"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Configurações de API</h3>
          <p className="text-blue-700 text-sm">
            Configure as chaves de API para cada método de pagamento nas variáveis de ambiente.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPaymentSettings;