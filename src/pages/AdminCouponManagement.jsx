import React, { useState } from 'react';
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
    IoAlertCircle,
    IoListOutline,
    IoSparkles,
    IoClose
} from 'react-icons/io5';

// Importa todas as lógicas, validadores e comunicadores firebase do Hook refatorado
import { useAdminCouponData } from '../hooks/useAdminCouponData';
import BackButton from '../components/BackButton';

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

    // Custom confirmation modal states
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [couponToDelete, setCouponToDelete] = useState(null);

    // Callback para abrir o modal de confirmação
    const handleDeleteCoupon = (id, codigoCupom) => {
        setCouponToDelete({ id, codigo: codigoCupom });
        setDeleteConfirmOpen(true);
    };

    // Callback para efetivar a exclusão
    const confirmarExcluir = async () => {
        if (!couponToDelete) return;
        await performDeleteCoupon(couponToDelete.id);
        setDeleteConfirmOpen(false);
        setCouponToDelete(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
                <div className="text-center relative z-10">
                    <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-650 font-bold">Carregando cupons...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 sm:p-6 lg:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
            {/* ─── NEBULA GLOWS ─── */}
            <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-blue-400/5 rounded-full blur-[130px] pointer-events-none"></div>

            <div className="max-w-6xl mx-auto relative z-10 space-y-6">
                <BackButton className="mb-6" />

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20">
                            <IoGiftOutline size={24} />
                        </div>
                        Cupons de Desconto
                    </h1>
                    <p className="text-slate-500 mt-2 ml-[60px] font-medium">Crie e gerencie códigos promocionais para seus clientes.</p>
                </div>

                {/* Stats Bento Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    <div className="group bg-white/70 border border-slate-150/40 rounded-[2rem] p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl bg-blue-200 opacity-20 transform translate-x-8 -translate-y-8"></div>
                        <div>
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Total de Cupons</p>
                            <p className="text-2xl font-black text-slate-800">{estatisticas.total}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shadow-inner">
                            <IoGiftOutline className="text-blue-600 text-lg" />
                        </div>
                    </div>

                    <div className="group bg-white/70 border border-slate-150/40 rounded-[2rem] p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl bg-green-200 opacity-20 transform translate-x-8 -translate-y-8"></div>
                        <div>
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Cupons Ativos</p>
                            <p className="text-2xl font-black text-emerald-600">{estatisticas.ativos}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shadow-inner">
                            <IoCheckmarkCircle className="text-green-600 text-lg" />
                        </div>
                    </div>

                    <div className="group bg-white/70 border border-slate-150/40 rounded-[2rem] p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl bg-orange-200 opacity-20 transform translate-x-8 -translate-y-8"></div>
                        <div>
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Cupons Expirados</p>
                            <p className="text-2xl font-black text-orange-600">{estatisticas.expirados}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shadow-inner">
                            <IoCalendarOutline className="text-orange-600 text-lg" />
                        </div>
                    </div>

                    <div className="group bg-white/70 border border-slate-150/40 rounded-[2rem] p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl bg-purple-200 opacity-20 transform translate-x-8 -translate-y-8"></div>
                        <div>
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Usos Totais</p>
                            <p className="text-2xl font-black text-purple-650">{estatisticas.usosTotais}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shadow-inner">
                            <IoCashOutline className="text-purple-600 text-lg" />
                        </div>
                    </div>
                </div>

                {/* Formulário (Bento Glassmorphic) */}
                <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm backdrop-blur-md p-6 sm:p-8 mb-10">
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20">
                            {editingCouponId ? (
                                <IoPencil size={20} />
                            ) : (
                                <IoAddCircleOutline size={20} />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">
                                {editingCouponId ? '✏️ Editar Cupom' : '➕ Criar Novo Cupom'}
                            </h2>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">
                                {editingCouponId ? 'Atualize os dados e restrições do cupom' : 'Cadastre um novo código de desconto para a loja'}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveCoupon} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Código do Cupom *</label>
                                <input 
                                    value={codigo} 
                                    onChange={(e) => setCodigo(e.target.value)} 
                                    placeholder="EXEMPLO10"
                                    disabled={!!editingCouponId}
                                    required 
                                    className="w-full p-4 bg-slate-50/50 hover:bg-[#f8fafc]/90 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-semibold text-slate-700 placeholder-slate-400 shadow-sm uppercase"
                                />
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-1.5 tracking-wider">
                                    {editingCouponId ? 'Código não pode ser alterado' : 'Use letras e números sem espaços'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Tipo de Desconto *</label>
                                <select 
                                    value={tipoDesconto} 
                                    onChange={(e) => setTipoDesconto(e.target.value)} 
                                    required 
                                    className="w-full p-4 bg-white border border-slate-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-semibold text-slate-700 shadow-sm cursor-pointer appearance-none"
                                    style={{ 
                                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, 
                                      backgroundRepeat: 'no-repeat', 
                                      backgroundPosition: 'right 1.25rem center', 
                                      backgroundSize: '1em' 
                                    }}
                                >
                                    <option value="percentual">Percentual (%)</option>
                                    <option value="valorFixo">Valor Fixo (R$)</option>
                                    <option value="freteGratis">Frete Grátis</option>
                                </select>
                            </div>

                            {tipoDesconto !== 'freteGratis' && (
                                <div>
                                    <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Valor do Desconto *</label>
                                    <input 
                                        type="number" 
                                        step={tipoDesconto === 'percentual' ? "1" : "0.01"}
                                        min="0"
                                        max={tipoDesconto === 'percentual' ? "100" : undefined}
                                        value={valorDesconto} 
                                        onChange={(e) => setValorDesconto(e.target.value)} 
                                        placeholder={tipoDesconto === 'percentual' ? '10' : '5.00'}
                                        required 
                                        className="w-full p-4 bg-slate-50/50 hover:bg-[#f8fafc]/90 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-semibold text-slate-700 placeholder-slate-400 shadow-sm"
                                    />
                                    <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-1.5 tracking-wider">
                                        {tipoDesconto === 'percentual' ? 'Máximo: 100%' : 'Use ponto para decimais'}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Pedido Mínimo (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    min="0"
                                    value={minimoPedido} 
                                    onChange={(e) => setMinimoPedido(e.target.value)} 
                                    placeholder="0.00"
                                    className="w-full p-4 bg-slate-50/50 hover:bg-[#f8fafc]/90 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-semibold text-slate-700 placeholder-slate-400 shadow-sm"
                                />
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-1.5 tracking-wider">Deixe em branco para sem mínimo</p>
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Data de Início *</label>
                                <input 
                                    type="datetime-local" 
                                    value={validadeInicio} 
                                    onChange={(e) => setValidadeInicio(e.target.value)} 
                                    required 
                                    className="w-full p-4 bg-slate-50/50 hover:bg-[#f8fafc]/90 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-semibold text-slate-750 shadow-sm cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Data de Fim *</label>
                                <input 
                                    type="datetime-local" 
                                    value={validadeFim} 
                                    onChange={(e) => setValidadeFim(e.target.value)} 
                                    required 
                                    className="w-full p-4 bg-slate-50/50 hover:bg-[#f8fafc]/90 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-semibold text-slate-750 shadow-sm cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Usos Máximos</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={usosMaximos} 
                                    onChange={(e) => setUsosMaximos(e.target.value)} 
                                    placeholder="Ilimitado"
                                    className="w-full p-4 bg-slate-50/50 hover:bg-[#f8fafc]/90 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-semibold text-slate-700 placeholder-slate-400 shadow-sm"
                                />
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-1.5 tracking-wider">Deixe em branco para ilimitados</p>
                            </div>

                            {/* Status Switcher Toggle */}
                            <div 
                              className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer col-span-1 md:col-span-2 lg:col-span-1 mt-6 ${
                                ativo 
                                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 border-transparent shadow-lg shadow-amber-500/15' 
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                              onClick={() => setAtivo(!ativo)}
                            >
                                <div>
                                    <p className={`font-extrabold ${ativo ? 'text-amber-955' : 'text-slate-600'}`}>
                                        {ativo ? '✅ Cupom Ativo' : 'Cupom Inativo'}
                                    </p>
                                    <p className={`text-[10px] ${ativo ? 'text-amber-900/80' : 'text-slate-400'} mt-0.5`}>
                                        {ativo ? 'Disponível no checkout' : 'Desativado temporariamente'}
                                    </p>
                                </div>
                                <div className={`w-14 h-7 rounded-full p-1 transition-all ${ativo ? 'bg-amber-955/20' : 'bg-slate-300'}`}>
                                    <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${ativo ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex w-full gap-4 pt-4">
                            <button 
                                type="submit" 
                                disabled={formLoading}
                                className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-955 font-bold py-4 px-6 rounded-2xl flex items-center justify-center space-x-3 shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                            >
                                {formLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-amber-955 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <IoCheckmarkCircle className="text-xl" />
                                        <span>{editingCouponId ? 'Salvar Alterações' : 'Criar Cupom'}</span>
                                    </>
                                )}
                            </button>
                            {editingCouponId && (
                                <button 
                                    type="button" 
                                    onClick={resetForm}
                                    className="px-8 py-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-2xl font-bold transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center space-x-2 shadow-sm"
                                >
                                    <IoCloseCircleOutline className="text-lg" />
                                    <span>Cancelar</span>
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Cabeçalho da Lista */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-12 mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <IoListOutline className="text-amber-500" />
                            Cupons Cadastrados
                            <span className="text-sm font-extrabold bg-amber-100 text-amber-800 px-3 py-1 rounded-full border border-amber-200">
                                {cupons.length}
                            </span>
                        </h2>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mt-1 flex items-center gap-1">
                            <IoSparkles className="text-amber-500" /> Gerencie e acompanhe a validade e uso dos cupons
                        </p>
                    </div>
                </div>

                {/* Lista de Cupons (Grid de Cards Translúcidos) */}
                <div className="min-h-[250px]">
                    {cupons.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fadeIn">
                            {cupons.map(cupom => {
                                const expirado = isExpirado(cupom.validadeFim);
                                const cupomAtivo = isAtivo(cupom);
                                return (
                                    <div 
                                        key={cupom.id} 
                                        className={`group bg-white/80 rounded-[2.2rem] shadow-sm border transition-all duration-300 hover:shadow-xl flex flex-col justify-between overflow-hidden relative ${
                                            expirado 
                                                ? 'border-red-200 hover:border-red-300' 
                                                : cupomAtivo
                                                    ? 'border-slate-150/40 hover:border-amber-200/80' 
                                                    : 'border-slate-150/40 hover:border-slate-350'
                                        }`}
                                    >
                                        <div className="p-6 flex flex-col flex-1">
                                            {/* Top info */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="min-w-0">
                                                    <h3 className="font-extrabold text-slate-800 text-lg leading-tight truncate group-hover:text-amber-700 transition-colors" title={cupom.codigo}>
                                                        {cupom.codigo}
                                                    </h3>
                                                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center w-fit mt-1.5 border shadow-sm ${
                                                        expirado 
                                                            ? 'bg-red-50 text-red-700 border-red-100' 
                                                            : cupomAtivo
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                                : 'bg-slate-50 text-slate-500 border-slate-100'
                                                    }`}>
                                                        {expirado ? '🔴 Expirado' : cupomAtivo ? '🟢 Ativo' : '⏸️ Inativo'}
                                                    </span>
                                                </div>
                                                <div className={`p-3 rounded-xl shadow-sm ${
                                                    expirado 
                                                        ? 'bg-red-100 text-red-600' 
                                                        : cupomAtivo
                                                            ? 'bg-amber-100 text-amber-955 shadow-amber-500/10' 
                                                            : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    <IoGiftOutline className="text-xl" />
                                                </div>
                                            </div>

                                            {/* Details list */}
                                            <div className="space-y-2.5 mb-6 bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50 mt-1">
                                                <div className="flex justify-between text-xs font-bold">
                                                    <span className="text-slate-400 uppercase tracking-wider">Desconto:</span>
                                                    <span className="text-blue-600 font-extrabold">{formatarDesconto(cupom)}</span>
                                                </div>
                                                {cupom.minimoPedido && (
                                                    <div className="flex justify-between text-xs font-bold">
                                                        <span className="text-slate-400 uppercase tracking-wider">Min. Pedido:</span>
                                                        <span className="text-slate-700">R$ {cupom.minimoPedido.toFixed(2).replace('.', ',')}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-xs font-bold">
                                                    <span className="text-slate-400 uppercase tracking-wider">Validade:</span>
                                                    <span className="text-slate-700">{cupom.validadeFim?.toDate().toLocaleDateString('pt-BR')}</span>
                                                </div>
                                                {cupom.totalDescontoGerado > 0 && (
                                                    <div className="flex justify-between text-xs font-bold border-t border-slate-150/40 pt-2">
                                                        <span className="text-slate-400 uppercase tracking-wider">Economia:</span>
                                                        <span className="text-emerald-700">R$ {Number(cupom.totalDescontoGerado).toFixed(2).replace('.', ',')}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-xs font-bold">
                                                    <span className="text-slate-400 uppercase tracking-wider">Usos:</span>
                                                    <span className="text-slate-700 flex items-center gap-1">
                                                        {cupom.usosMaximos ? (
                                                            `${cupom.usosAtuais || 0}/${cupom.usosMaximos}`
                                                        ) : (
                                                            <>
                                                                <IoInfinite className="text-slate-400 shrink-0" size={10} />
                                                                {cupom.usosAtuais || 0}
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="grid grid-cols-2 gap-2 mt-auto">
                                                <button 
                                                    onClick={() => handleEditClick(cupom)}
                                                    className="py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-955 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-amber-400/20 border border-amber-400/30 flex items-center justify-center gap-1"
                                                    title="Editar"
                                                >
                                                    <IoPencil size={12} /> Editar
                                                </button>
                                                <button 
                                                    onClick={() => (cupom.usosAtuais || 0) >= 1 ? toast.warn('❌ Cupom com usos registrados não pode ser excluído.') : handleDeleteCoupon(cupom.id, cupom.codigo)}
                                                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 flex items-center justify-center gap-1 ${
                                                        (cupom.usosAtuais || 0) >= 1
                                                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                            : 'bg-white hover:bg-red-50 text-red-500 border-slate-200 hover:border-red-200'
                                                    }`}
                                                    title={(cupom.usosAtuais || 0) >= 1 ? 'Não é possível excluir cupons já utilizados' : 'Excluir cupom'}
                                                >
                                                    <IoTrash size={12} /> Excluir
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-white/70 backdrop-blur-md rounded-[2.5rem] border-2 border-dashed border-slate-200/60 shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
                            <div className="relative z-10 flex flex-col items-center text-center p-6">
                                <div className="w-16 h-16 bg-amber-50 text-amber-300 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                    <IoGiftOutline className="text-3xl" />
                                </div>
                                <h3 className="text-xl font-black text-slate-700 mb-1">Nenhum cupom cadastrado</h3>
                                <p className="text-slate-400 font-semibold text-sm max-w-sm">Comece criando cupons de desconto para atrair mais clientes e aumentar suas vendas.</p>
                            </div>
                        </div>
                    )}
                </div>

                {cupons.length > 0 && (
                    <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] p-6 mt-8 shadow-sm backdrop-blur-md">
                        <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20 shrink-0">
                                <IoSparkles size={20} />
                            </div>
                            <div>
                                <p className="text-slate-800 font-black text-base">💡 Dica de Sucesso</p>
                                <p className="text-slate-500 text-xs font-semibold uppercase mt-1 tracking-wider leading-relaxed">
                                    Os cupons ativos aparecem automaticamente para os clientes durante o fechamento de pedidos no checkout. Monitore a quantidade de usos e a economia total gerada para avaliar a eficácia das suas campanhas.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Custom deletion dialog modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999999] px-4 animate-fadeIn" onClick={() => { setDeleteConfirmOpen(false); setCouponToDelete(null); }}>
                    <div className="bg-white border border-slate-150/40 rounded-[2.2rem] p-8 w-full max-w-md shadow-2xl relative transition-all duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <IoAlertCircle size={32} />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                                Excluir Cupom?
                            </h2>
                            <p className="text-sm text-slate-500 mb-8 px-4 leading-relaxed">
                                Tem certeza que deseja excluir o cupom <strong>"{couponToDelete?.codigo}"</strong>? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-4 w-full">
                                <button type="button" onClick={() => { setDeleteConfirmOpen(false); setCouponToDelete(null); }} 
                                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full font-bold text-sm transition-all active:scale-95 shadow-sm">
                                    Cancelar
                                </button>
                                <button type="button" onClick={confirmarExcluir} 
                                    className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-sm shadow-lg shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    Sim, Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                @keyframes pulse-subtle {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.02); opacity: 0.95; }
                }
                .animate-pulse-subtle {
                    animation: pulse-subtle 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
}

export default withEstablishmentAuth(AdminCouponManagement);
