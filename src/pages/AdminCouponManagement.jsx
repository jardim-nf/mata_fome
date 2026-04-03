import React from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { 
    IoAddCircleOutline, 
    IoPencil, 
    IoTrash, 
    IoCloseCircleOutline,
    IoGiftOutline,
    IoCalendarOutline,
    IoCashOutline,
    IoCheckmarkCircle,
    IoInfinite,
    IoAlertCircle
} from 'react-icons/io5';

// Importa todas as lógicas, validadores e comunicadores firebase do Hook refatorado
import { useAdminCouponData } from '../hooks/useAdminCouponData';

function AdminCouponManagement() {
    const { estabelecimentoIdPrincipal } = useAuth();
    
    // Instanciando The One Hook!
    const {
        cupons, loading, formLoading,
        codigo, setCodigo,
        tipoDesconto, setTipoDesconto,
        valorDesconto, setValorDesconto,
        minimoPedido, setMinimoPedido,
        validadeInicio, setValidadeInicio,
        validadeFim, setValidadeFim,
        usosMaximos, setUsosMaximos,
        ativo, setAtivo,
        editingCouponId,
        isExpirado, isAtivo, formatarDesconto,
        estatisticas,
        handleSaveCoupon,
        handleEditClick,
        performDeleteCoupon,
        resetForm
    } = useAdminCouponData(estabelecimentoIdPrincipal);

    // O Confirmation Alert visual continua aqui, mas a exclusão DB foi injetada no backend (Hook)
    const handleDeleteCoupon = (id, codigoCupom) => {
        toast.warning(
            ({ closeToast }) => (
                <div className="p-4">
                    <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <IoAlertCircle className="text-red-600 text-sm" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-900">Confirmar exclusão?</p>
                            <p className="text-sm text-gray-600 mt-1">
                                Tem certeza que deseja excluir o cupom <strong>"{codigoCupom}"</strong>? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex justify-end mt-4 space-x-3">
                                <button 
                                    type="button"
                                    onClick={closeToast} 
                                    className="px-4 py-2 text-sm bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="button"
                                    onClick={async () => {
                                        await performDeleteCoupon(id);
                                        closeToast();
                                    }} 
                                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ), { 
                position: "top-center", 
                autoClose: false, 
                closeOnClick: false, 
                draggable: false,
                closeButton: false
            }
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando cupons...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="w-full text-sm sm:text-base lg:max-w-6xl lg:mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total de Cupons</p>
                                <p className="text-2xl font-bold text-gray-900">{estatisticas.total}</p>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <IoGiftOutline className="text-blue-600 text-lg" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Cupons Ativos</p>
                                <p className="text-2xl font-bold text-green-600">{estatisticas.ativos}</p>
                            </div>
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <IoCheckmarkCircle className="text-green-600 text-lg" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Cupons Expirados</p>
                                <p className="text-2xl font-bold text-orange-600">{estatisticas.expirados}</p>
                            </div>
                            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                <IoCalendarOutline className="text-orange-600 text-lg" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Usos Totais</p>
                                <p className="text-2xl font-bold text-purple-600">{estatisticas.usosTotais}</p>
                            </div>
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <IoCashOutline className="text-purple-600 text-lg" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            {editingCouponId ? (
                                <IoPencil className="text-blue-600 text-lg" />
                            ) : (
                                <IoAddCircleOutline className="text-blue-600 text-lg" />
                            )}
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {editingCouponId ? 'Editar Cupom' : 'Criar Novo Cupom'}
                        </h2>
                    </div>

                    <form onSubmit={handleSaveCoupon} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Código do Cupom *</label>
                                <input 
                                    value={codigo} 
                                    onChange={(e) => setCodigo(e.target.value)} 
                                    placeholder="EXEMPLO10"
                                    disabled={!!editingCouponId}
                                    required 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all uppercase"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {editingCouponId ? 'Código não pode ser alterado' : 'Use letras e números'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Desconto *</label>
                                <select 
                                    value={tipoDesconto} 
                                    onChange={(e) => setTipoDesconto(e.target.value)} 
                                    required 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                >
                                    <option value="percentual">Percentual (%)</option>
                                    <option value="valorFixo">Valor Fixo (R$)</option>
                                    <option value="freteGratis">Frete Grátis</option>
                                </select>
                            </div>

                            {tipoDesconto !== 'freteGratis' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Valor do Desconto *</label>
                                    <input 
                                        type="number" 
                                        step={tipoDesconto === 'percentual' ? "1" : "0.01"}
                                        min="0"
                                        max={tipoDesconto === 'percentual' ? "100" : undefined}
                                        value={valorDesconto} 
                                        onChange={(e) => setValorDesconto(e.target.value)} 
                                        placeholder={tipoDesconto === 'percentual' ? '10' : '5.00'}
                                        required 
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {tipoDesconto === 'percentual' ? 'Máximo: 100%' : 'Use ponto para decimais'}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Pedido Mínimo (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    min="0"
                                    value={minimoPedido} 
                                    onChange={(e) => setMinimoPedido(e.target.value)} 
                                    placeholder="0.00"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                                <p className="text-xs text-gray-500 mt-1">Deixe em branco para nenhum mínimo</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Início *</label>
                                <input 
                                    type="datetime-local" 
                                    value={validadeInicio} 
                                    onChange={(e) => setValidadeInicio(e.target.value)} 
                                    required 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Fim *</label>
                                <input 
                                    type="datetime-local" 
                                    value={validadeFim} 
                                    onChange={(e) => setValidadeFim(e.target.value)} 
                                    required 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Usos Máximos</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={usosMaximos} 
                                    onChange={(e) => setUsosMaximos(e.target.value)} 
                                    placeholder="Ilimitado"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                                <p className="text-xs text-gray-500 mt-1">Deixe em branco para usos ilimitados</p>
                            </div>

                            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg self-end">
                                <input 
                                    type="checkbox" 
                                    id="ativo" 
                                    checked={ativo} 
                                    onChange={(e) => setAtivo(e.target.checked)} 
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="ativo" className="text-sm font-medium text-gray-700">Cupom ativo</label>
                            </div>
                        </div>

                        <div className="flex w-full gap-3 pt-4">
                            <button 
                                type="submit" 
                                disabled={formLoading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                                {formLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <IoCheckmarkCircle className="text-lg" />
                                        <span>{editingCouponId ? 'Salvar Alterações' : 'Criar Cupom'}</span>
                                    </>
                                )}
                            </button>
                            {editingCouponId && (
                                <button 
                                    type="button" 
                                    onClick={resetForm}
                                    className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                                >
                                    <IoCloseCircleOutline />
                                    <span>Cancelar</span>
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <IoGiftOutline className="text-green-600 text-lg" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Cupons Cadastrados ({cupons.length})
                            </h2>
                        </div>
                    </div>

                    <div className="p-6">
                        {cupons.length > 0 ? (
                            <div className="space-y-4">
                                {cupons.map(cupom => {
                                    const expirado = isExpirado(cupom.validadeFim);
                                    const cupomAtivo = isAtivo(cupom);
                                    return (
                                        <div 
                                            key={cupom.id} 
                                            className={`flex items-center justify-between p-4 rounded-lg border transition-colors group ${
                                                expirado 
                                                    ? 'bg-red-50 border-red-200' 
                                                    : cupomAtivo
                                                        ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                                                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className="flex items-center space-x-4 flex-1">
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                                    expirado 
                                                        ? 'bg-red-100 text-red-600' 
                                                        : cupomAtivo
                                                            ? 'bg-green-100 text-green-600' 
                                                            : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    <IoGiftOutline className="text-xl" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3 mb-1">
                                                        <span className="font-bold text-lg text-gray-900">{cupom.codigo}</span>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                            expirado 
                                                                ? 'bg-red-500 text-white' 
                                                                : cupomAtivo
                                                                    ? 'bg-green-500 text-white' 
                                                                    : 'bg-gray-500 text-white'
                                                            }`}>
                                                            {expirado ? 'Expirado' : cupomAtivo ? 'Ativo' : 'Inativo'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                                        <span className="font-semibold text-blue-600">{formatarDesconto(cupom)}</span>
                                                        {cupom.minimoPedido && (
                                                            <span>Mín: R$ {cupom.minimoPedido.toFixed(2).replace('.', ',')}</span>
                                                        )}
                                                        <span>Validade: {cupom.validadeFim?.toDate().toLocaleDateString('pt-BR')}</span>
                                                        {cupom.totalDescontoGerado > 0 && (
                                                            <span className="text-green-700 font-semibold">
                                                                💸 R$ {Number(cupom.totalDescontoGerado).toFixed(2).replace('.', ',')} em descontos
                                                            </span>
                                                        )}
                                                        <span className="flex items-center space-x-1">
                                                            {cupom.usosMaximos ? (
                                                                <>
                                                                    <span>{cupom.usosAtuais || 0}/{cupom.usosMaximos} usos</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <IoInfinite className="text-gray-400" />
                                                                    <span>{cupom.usosAtuais || 0} usos</span>
                                                                </>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditClick(cupom)}
                                                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                    aria-label="Editar"
                                                    title="Editar cupom"
                                                >
                                                    <IoPencil />
                                                </button>
                                                <button
                                                    onClick={() => (cupom.usosAtuais || 0) >= 1 ? toast.warn('❌ Cupom com usos registrados não pode ser excluído.') : handleDeleteCoupon(cupom.id, cupom.codigo)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        (cupom.usosAtuais || 0) >= 1
                                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                                                    }`}
                                                    aria-label="Excluir"
                                                    title={(cupom.usosAtuais || 0) >= 1 ? 'Não é possível excluir cupons já utilizados' : 'Excluir cupom'}
                                                >
                                                    <IoTrash />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <IoGiftOutline className="text-2xl text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Nenhum cupom cadastrado
                                </h3>
                                <p className="text-gray-600 max-w-md mx-auto">
                                    Comece criando cupons de desconto para atrair mais clientes e aumentar suas vendas.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {cupons.length > 0 && (
                    <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-sm">💡</span>
                            </div>
                            <div>
                                <p className="text-blue-800 font-medium">Dica rápida</p>
                                <p className="text-blue-700 text-sm">
                                    Os cupons ativos aparecem automaticamente para os clientes durante o checkout.
                                    Monitore os usos para avaliar a eficácia de suas promoções.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default withEstablishmentAuth(AdminCouponManagement);
