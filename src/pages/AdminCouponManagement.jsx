import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { 
    IoArrowBack, 
    IoAddCircleOutline, 
    IoPencil, 
    IoTrash, 
    IoCloseCircleOutline,
    IoGiftOutline,
    IoCalendarOutline,
    IoCashOutline,
    IoCheckmarkCircle,
    IoCloseCircle,
    IoInfinite,
    IoAlertCircle
} from 'react-icons/io5';

function AdminCouponManagement() {
    const { estabelecimentoIdPrincipal } = useAuth();

    const [cupons, setCupons] = useState([]);
    const [loading, setLoading] = useState(true);

    const [codigo, setCodigo] = useState('');
    const [tipoDesconto, setTipoDesconto] = useState('percentual');
    const [valorDesconto, setValorDesconto] = useState('');
    const [minimoPedido, setMinimoPedido] = useState('');
    const [validadeInicio, setValidadeInicio] = useState('');
    const [validadeFim, setValidadeFim] = useState('');
    const [usosMaximos, setUsosMaximos] = useState('');
    const [ativo, setAtivo] = useState(true);
    const [editingCouponId, setEditingCouponId] = useState(null);
    const [formLoading, setFormLoading] = useState(false);

    // Busca os cupons em tempo real
    useEffect(() => {
        if (!estabelecimentoIdPrincipal) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const cuponsCollectionRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'cupons');
        const q = query(cuponsCollectionRef, orderBy('codigo'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const cuponsData = querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            setCupons(cuponsData);
            console.log("🎫 Cupons carregados:", cuponsData.length);
            setLoading(false);
        }, (err) => {
            console.error("❌ Erro ao buscar cupons:", err);
            toast.error("❌ Erro ao carregar cupons. Permissão ou conexão falhou.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [estabelecimentoIdPrincipal]);

    const resetForm = () => {
        setCodigo('');
        setTipoDesconto('percentual');
        setValorDesconto('');
        setMinimoPedido('');
        setValidadeInicio('');
        setValidadeFim('');
        setUsosMaximos('');
        setAtivo(true);
        setEditingCouponId(null);
    };

    // --- FUNÇÕES AUXILIARES DE STATUS (MOVIDAS PARA O TOPO) ---
    const isExpirado = (validadeFim) => {
        if (!validadeFim) return false;
        return validadeFim.toDate() < new Date(); 
    };

    const isAtivo = (cupom) => {
        return cupom.ativo && !isExpirado(cupom.validadeFim);
    };

    const formatarDesconto = (cupom) => {
        switch(cupom.tipoDesconto) {
            case 'percentual':
                return `${cupom.valorDesconto}% OFF`;
            case 'valorFixo':
                return `R$ ${cupom.valorDesconto.toFixed(2).replace('.', ',')} OFF`;
            case 'freteGratis':
                return '🛵 Frete Grátis';
            default:
                return cupom.tipoDesconto;
        }
    };
    
    // --- ESTATÍSTICAS (DEFINIDA APÓS AS FUNÇÕES) ---
    const estatisticas = {
        total: cupons.length,
        ativos: cupons.filter(c => isAtivo(c)).length,
        expirados: cupons.filter(c => isExpirado(c.validadeFim)).length,
        usosTotais: cupons.reduce((acc, c) => acc + (c.usosAtuais || 0), 0)
    };


    const handleSaveCoupon = async (e) => {
        e.preventDefault();
        
        if (!estabelecimentoIdPrincipal) {
            toast.error('❌ Estabelecimento não identificado.');
            return;
        }

        if (!codigo || (tipoDesconto !== 'freteGratis' && !valorDesconto) || !validadeInicio || !validadeFim) {
            toast.warn('⚠️ Preencha os campos obrigatórios: Código, Valor (se aplicável) e Datas de Validade.');
            return;
        }

        // Validação de datas
        const inicio = new Date(validadeInicio);
        const fim = new Date(validadeFim);
        if (inicio >= fim) {
            toast.warn('⚠️ A data de fim deve ser posterior à data de início.');
            return;
        }

        setFormLoading(true);
        try {
            const cuponsCollectionRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'cupons');
            
            // 💡 Conversão de Valores
            const valorDesc = tipoDesconto === 'freteGratis' ? 0 : Number(valorDesconto);
            const minPedido = minimoPedido ? Number(minimoPedido) : null;
            const usosMax = usosMaximos ? Number(usosMaximos) : null;

            if (isNaN(valorDesc) || (minPedido !== null && isNaN(minPedido)) || (usosMax !== null && isNaN(usosMax))) {
                 toast.error('❌ Erro: Por favor, verifique se os valores numéricos estão corretos.');
                 setFormLoading(false);
                 return;
            }

            const newCouponData = {
                codigo: codigo.toUpperCase().trim(),
                tipoDesconto,
                valorDesconto: valorDesc,
                minimoPedido: minPedido,
                validadeInicio: Timestamp.fromDate(inicio),
                validadeFim: Timestamp.fromDate(fim),
                usosMaximos: usosMax,
                usosAtuais: editingCouponId ? cupons.find(c => c.id === editingCouponId)?.usosAtuais || 0 : 0,
                ativo,
                estabelecimentoId: estabelecimentoIdPrincipal,
                atualizadoEm: new Date()
            };

            if (editingCouponId) {
                console.log(`📝 Editando cupom ${editingCouponId}...`);
                const couponRef = doc(cuponsCollectionRef, editingCouponId);
                await updateDoc(couponRef, newCouponData);
                toast.success('✅ Cupom atualizado com sucesso!');
            } else {
                // 1. Verificação de duplicidade (Requer permissão de LEITURA)
                console.log(`🔍 Verificando duplicidade para código: ${newCouponData.codigo}`);
                
                const q = query(cuponsCollectionRef, where('codigo', '==', newCouponData.codigo));
                const existingCoupons = await getDocs(q); 
                
                if (!existingCoupons.empty) {
                    toast.error(`❌ Já existe um cupom com o código ${newCouponData.codigo} para este estabelecimento.`);
                    setFormLoading(false);
                    return;
                }
                
                // 2. Criação do documento (Requer permissão de ESCRITA)
                console.log('➕ Criando novo cupom...');
                await addDoc(cuponsCollectionRef, { 
                    ...newCouponData, 
                    criadoEm: new Date() 
                });
                toast.success('✅ Cupom criado com sucesso!');
            }
            resetForm();
        } catch (err) {
            // 🔑 CAPTURA DE ERRO MELHORADA
            console.error("❌ ERRO NO SALVAMENTO DO CUPOM:", err);
            
            if (err.code === 'permission-denied') {
                toast.error("🔒 Permissão negada! Verifique as Regras de Segurança do Firestore para a coleção /cupons.");
            } else if (err.code === 'unavailable') {
                 toast.error("🌐 Erro de conexão. Tente novamente.");
            } else {
                toast.error(`❌ Erro ao salvar cupom: ${err.message}`);
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleEditClick = (coupon) => {
        setEditingCouponId(coupon.id);
        setCodigo(coupon.codigo);
        setTipoDesconto(coupon.tipoDesconto);
        setValorDesconto(coupon.valorDesconto?.toString() || '');
        setMinimoPedido(coupon.minimoPedido?.toString() || '');
        // Converte o Timestamp do Firebase para a string de formato 'datetime-local' em hora LOCAL (sem converter para UTC)
        const toLocalDatetimeString = (timestamp) => {
            if (!timestamp) return '';
            const d = timestamp.toDate();
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        setValidadeInicio(toLocalDatetimeString(coupon.validadeInicio));
        setValidadeFim(toLocalDatetimeString(coupon.validadeFim));
        setUsosMaximos(coupon.usosMaximos?.toString() || '');
        setAtivo(coupon.ativo);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteCoupon = (id, codigo) => {
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
                                Tem certeza que deseja excluir o cupom <strong>"{codigo}"</strong>? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex justify-end mt-4 space-x-3">
                                <button 
                                    onClick={closeToast} 
                                    className="px-4 py-2 text-sm bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={async () => {
                                        try {
                                            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'cupons', id));
                                            toast.success('✅ Cupom excluído com sucesso!');
                                        } catch (err) {
                                            console.error("❌ Erro ao excluir cupom:", err);
                                            toast.error("❌ Erro ao excluir cupom.");
                                        }
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
                {/* Header */}

                {/* Estatísticas */}
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

                {/* Formulário */}
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Código do Cupom *
                                </label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tipo de Desconto *
                                </label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Valor do Desconto *
                                    </label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pedido Mínimo (R$)
                                </label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    min="0"
                                    value={minimoPedido} 
                                    onChange={(e) => setMinimoPedido(e.target.value)} 
                                    placeholder="0.00"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Deixe em branco para nenhum mínimo
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Data de Início *
                                </label>
                                <input 
                                    type="datetime-local" 
                                    value={validadeInicio} 
                                    onChange={(e) => setValidadeInicio(e.target.value)} 
                                    required 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Data de Fim *
                                </label>
                                <input 
                                    type="datetime-local" 
                                    value={validadeFim} 
                                    onChange={(e) => setValidadeFim(e.target.value)} 
                                    required 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Usos Máximos
                                </label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={usosMaximos} 
                                    onChange={(e) => setUsosMaximos(e.target.value)} 
                                    placeholder="Ilimitado"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Deixe em branco para usos ilimitados
                                </p>
                            </div>

                            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg self-end">
                                <input 
                                    type="checkbox" 
                                    id="ativo" 
                                    checked={ativo} 
                                    onChange={(e) => setAtivo(e.target.checked)} 
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="ativo" className="text-sm font-medium text-gray-700">
                                    Cupom ativo
                                </label>
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

                {/* Lista de Cupons */}
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
                                    const ativo = isAtivo(cupom);
                                    return (
                                        <div 
                                            key={cupom.id} 
                                            className={`flex items-center justify-between p-4 rounded-lg border transition-colors group ${
                                                expirado 
                                                    ? 'bg-red-50 border-red-200' 
                                                    : ativo
                                                        ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                                                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className="flex items-center space-x-4 flex-1">
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                                    expirado 
                                                        ? 'bg-red-100 text-red-600' 
                                                        : ativo
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
                                                                : ativo
                                                                    ? 'bg-green-500 text-white' 
                                                                    : 'bg-gray-500 text-white'
                                                            }`}>
                                                            {expirado ? 'Expirado' : ativo ? 'Ativo' : 'Inativo'}
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

                {/* Dica rápida */}
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

// ✅ Aplica o HOC específico para estabelecimento
export default withEstablishmentAuth(AdminCouponManagement);
