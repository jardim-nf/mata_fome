import React from 'react';
import { IoCart, IoAdd, IoRemove, IoTrash } from 'react-icons/io5';
import SplitPayment from './SplitPayment';
import { formatarMoeda } from '../../utils/formatCurrency';


const formatarItemCarrinho = (item) => {
  let nome = item.nome;
  if (item.variacaoSelecionada?.nome) nome += ` - ${item.variacaoSelecionada.nome}`;
  if (item.adicionaisSelecionados?.length > 0)
    nome += ` (+ ${item.adicionaisSelecionados.map(a => a.nome).join(', ')})`;
  if (item.observacao) nome += ` (Obs: ${item.observacao})`;
  return nome;
};

export default function CartSection({
  carrinho,
  subtotalCalculado,
  taxaAplicada,
  discountAmount,
  finalOrderTotal,
  isRetirada,
  bairro,
  bairrosDisponiveis,
  isLojaAberta,
  couponCodeInput, setCouponCodeInput,
  appliedCoupon, couponLoading,
  onApplyCoupon, onRemoveCoupon,
  alterarQuantidade, removerItem,
  onCheckout,
}) {
  return (
    <div id="resumo-carrinho" className="bg-white p-6 rounded-xl border shadow-lg text-left text-gray-900 w-full transition-all duration-300">

      {/* Cupom */}
      <div className="mt-2 mb-6 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Cupom de Desconto</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Possui um código?"
            value={couponCodeInput}
            onChange={e => setCouponCodeInput(e.target.value.toUpperCase())}
            className="w-full sm:flex-1 p-3 sm:p-2 border rounded-lg text-sm"
            disabled={!!appliedCoupon}
          />
          <button
            onClick={onApplyCoupon}
            disabled={couponLoading || !couponCodeInput || !!appliedCoupon}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-gray-800 text-white rounded-lg text-sm font-bold disabled:opacity-50 shrink-0"
          >
            {couponLoading ? '...' : appliedCoupon ? 'Aplicado' : 'Aplicar'}
          </button>
        </div>
        {appliedCoupon && (
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-green-600 font-bold">✅ Cupom {appliedCoupon.codigo} ativo</span>
            <button onClick={onRemoveCoupon} className="text-xs text-red-500 underline">Remover</button>
          </div>
        )}
      </div>

      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <IoCart className="text-green-600" /> Resumo do Pedido
      </h3>

      {carrinho.length === 0 ? (
        <p className="text-gray-500 py-4 text-center">Seu carrinho está vazio.</p>
      ) : (
        <>
          <div className="space-y-4 mb-4 max-h-60 overflow-y-auto pr-2">
            {carrinho.map(item => (
              <div key={item.cartItemId} className="flex justify-between items-start border-b pb-3">
                <div className="flex-1 pr-2">
                  <p className="font-bold text-sm text-gray-900">{formatarItemCarrinho(item)}</p>
                  <p className="text-xs text-gray-500">R$ {item.precoFinal.toFixed(2)} cada</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-gray-200 rounded-lg">
                    <button onClick={() => alterarQuantidade(item.cartItemId, -1)} className="px-2 py-1 text-red-500 hover:bg-gray-100 rounded-l-lg"><IoRemove /></button>
                    <span className="px-2 text-sm font-bold">{item.qtd}</span>
                    <button onClick={() => alterarQuantidade(item.cartItemId, 1)} className="px-2 py-1 text-green-600 hover:bg-gray-100 rounded-r-lg"><IoAdd /></button>
                  </div>
                  <button onClick={() => removerItem(item.cartItemId)} className="text-red-500 p-1.5 hover:bg-red-50 rounded"><IoTrash /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>R$ {subtotalCalculado.toFixed(2)}</span>
            </div>
            {!isRetirada && (
              <div className="flex justify-between text-gray-700">
                <span>Taxa de Entrega:</span>
                <span>
                  {bairro && bairrosDisponiveis.includes(bairro)
                    ? (taxaAplicada > 0 ? `R$ ${taxaAplicada.toFixed(2)}` : 'Grátis')
                    : 'A calcular'}
                </span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600 font-bold">
                <span>Desconto:</span>
                <span>- R$ {discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base pt-1 border-t">
              <span>Total:</span>
              <span>{formatarMoeda(finalOrderTotal)}</span>
            </div>
          </div>

          {/* Dividir conta */}
          <SplitPayment total={finalOrderTotal} />

          {!isLojaAberta ? (
            <button disabled className="w-full mt-6 py-4 rounded-xl font-bold text-lg text-gray-500 bg-gray-200 cursor-not-allowed border-2 border-gray-300">
              ⛔ Loja Fechada no Momento
            </button>
          ) : !isRetirada && (!bairro || !bairrosDisponiveis.includes(bairro)) ? (
            <button disabled className="w-full mt-6 py-4 rounded-xl font-bold text-lg text-gray-500 bg-gray-200 cursor-not-allowed border-2 border-gray-300">
              ⚠️ Selecione o Bairro acima
            </button>
          ) : (
            <button
              onClick={onCheckout}
              className="w-full mt-6 py-4 rounded-xl font-bold text-lg text-white shadow-lg active:scale-95 transition-all bg-green-600 hover:bg-green-700"
            >
              ✅ Finalizar Pedido
            </button>
          )}
        </>
      )}
    </div>
  );
}