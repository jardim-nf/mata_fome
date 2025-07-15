import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp, query, orderBy, where } from 'firebase/firestore'; // Adicionado 'where'
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

function AdminCouponManagement() {
    const { currentUser, isAdmin, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [cupons, setCupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Estados para o formulário de novo/editar cupom
    const [codigo, setCodigo] = useState('');
    const [tipoDesconto, setTipoDesconto] = useState('percentual'); // 'percentual', 'valorFixo', 'freteGratis'
    const [valorDesconto, setValorDesconto] = useState('');
    const [minimoPedido, setMinimoPedido] = useState('');
    const [validadeInicio, setValidadeInicio] = useState('');
    const [validadeFim, setValidadeFim] = useState('');
    const [usosMaximos, setUsosMaximos] = useState('');
    const [usosPorUsuario, setUsosPorUsuario] = useState('');
    const [ativo, setAtivo] = useState(true);
    const [estabelecimentosId, setEstabelecimentosId] = useState(''); // String separada por vírgulas
    const [editingCouponId, setEditingCouponId] = useState(null); // ID do cupom sendo editado

    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || !isAdmin) {
                toast.error('Acesso negado. Você precisa ser um administrador para acessar esta página.');
                navigate('/dashboard'); // Ou para a home, dependendo da sua rota
            } else {
                fetchCupons();
            }
        }
    }, [currentUser, isAdmin, authLoading, navigate]);

    const fetchCupons = async () => {
        setLoading(true);
        setError('');
        try {
            const cuponsCollectionRef = collection(db, 'cupons');
            const q = query(cuponsCollectionRef, orderBy('codigo'));
            const querySnapshot = await getDocs(q);
            const cuponsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCupons(cuponsData);
        } catch (err) {
            console.error("Erro ao buscar cupons:", err);
            setError("Erro ao carregar cupons.");
            toast.error("Erro ao carregar cupons.");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setCodigo('');
        setTipoDesconto('percentual');
        setValorDesconto('');
        setMinimoPedido('');
        setValidadeInicio('');
        setValidadeFim('');
        setUsosMaximos('');
        setUsosPorUsuario('');
        setAtivo(true);
        setEstabelecimentosId('');
        setEditingCouponId(null);
    };

    const handleSaveCoupon = async (e) => {
        e.preventDefault();
        setError('');

        if (!codigo || !valorDesconto || !validadeInicio || !validadeFim) {
            toast.error('Por favor, preencha todos os campos obrigatórios (Código, Valor, Validade Início e Fim).');
            return;
        }

        try {
            const newCouponData = {
                codigo: codigo.toUpperCase().trim(),
                tipoDesconto: tipoDesconto,
                valorDesconto: Number(valorDesconto),
                minimoPedido: minimoPedido ? Number(minimoPedido) : null,
                validadeInicio: Timestamp.fromDate(new Date(validadeInicio)),
                validadeFim: Timestamp.fromDate(new Date(validadeFim)),
                usosMaximos: usosMaximos ? Number(usosMaximos) : null,
                usosAtuais: 0, // Sempre inicializa em 0 para novos cupons
                usosPorUsuario: usosPorUsuario ? Number(usosPorUsuario) : null,
                ativo: ativo,
                estabelecimentosId: estabelecimentosId.split(',').map(id => id.trim()).filter(Boolean),
            };

            if (editingCouponId) {
                // Edição de cupom existente
                const couponRef = doc(db, 'cupons', editingCouponId);
                await updateDoc(couponRef, newCouponData);
                toast.success('Cupom atualizado com sucesso!');
            } else {
                // Criação de novo cupom
                // Verificar se o código já existe
                const existingCupons = await getDocs(query(collection(db, 'cupons'), where('codigo', '==', newCouponData.codigo)));
                if (!existingCupons.empty) {
                    toast.error('Já existe um cupom com este código. Por favor, use um código diferente.');
                    return;
                }
                await addDoc(collection(db, 'cupons'), newCouponData);
                toast.success('Cupom criado com sucesso!');
            }
            fetchCupons(); // Recarrega a lista de cupons
            resetForm(); // Limpa o formulário
        } catch (err) {
            console.error("Erro ao salvar cupom:", err);
            setError("Erro ao salvar cupom. Verifique os dados.");
            toast.error("Erro ao salvar cupom.");
        }
    };

    const handleEditClick = (coupon) => {
        setEditingCouponId(coupon.id);
        setCodigo(coupon.codigo);
        setTipoDesconto(coupon.tipoDesconto);
        setValorDesconto(coupon.valorDesconto);
        setMinimoPedido(coupon.minimoPedido || '');
        setValidadeInicio(coupon.validadeInicio ? coupon.validadeInicio.toDate().toISOString().slice(0, 16) : '');
        setValidadeFim(coupon.validadeFim ? coupon.validadeFim.toDate().toISOString().slice(0, 16) : '');
        setUsosMaximos(coupon.usosMaximos || '');
        setUsosPorUsuario(coupon.usosPorUsuario || '');
        setAtivo(coupon.ativo);
        setEstabelecimentosId(coupon.estabelecimentosId ? coupon.estabelecimentosId.join(', ') : '');
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola para o topo para o formulário
    };

    const handleDeleteCoupon = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este cupom? Esta ação é irreversível.')) {
            try {
                await deleteDoc(doc(db, 'cupons', id));
                toast.success('Cupom excluído com sucesso!');
                fetchCupons();
            } catch (err) {
                console.error("Erro ao excluir cupom:", err);
                toast.error("Erro ao excluir cupom.");
            }
        }
    };

    const handleToggleActive = async (couponId, currentStatus) => {
        try {
            const couponRef = doc(db, 'cupons', couponId);
            await updateDoc(couponRef, { ativo: !currentStatus });
            toast.success(`Cupom ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
            fetchCupons();
        } catch (err) {
            console.error("Erro ao mudar status do cupom:", err);
            toast.error("Erro ao mudar status do cupom.");
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Carregando gerenciamento de cupons...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-red-100 text-red-700 p-4 text-center">
                <p className="text-xl font-semibold">Erro:</p>
                <p className="mt-2">{error}</p>
                <button onClick={fetchCupons} className="mt-4 bg-red-500 text-white px-4 py-2 rounded">
                    Tentar Novamente
                </button>
            </div>
        );
    }

    if (!currentUser || !isAdmin) {
        return null; // Redirecionamento já feito no useEffect
    }

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    Voltar para o Dashboard
                </Link>
                <h1 className="text-3xl font-bold text-gray-800">Gerenciamento de Cupons</h1>
                <div></div> {/* Espaçador */}
            </div>

            {/* Formulário de Criação/Edição de Cupom */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">{editingCouponId ? 'Editar Cupom' : 'Criar Novo Cupom'}</h2>
                <form onSubmit={handleSaveCoupon} className="space-y-4">
                    <div>
                        <label htmlFor="codigo" className="block text-sm font-medium text-gray-700">Código do Cupom *</label>
                        <input
                            type="text"
                            id="codigo"
                            value={codigo}
                            onChange={(e) => setCodigo(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            placeholder="EX: DESCONTO10"
                            required
                            disabled={!!editingCouponId}
                        />
                        {editingCouponId && <p className="text-sm text-gray-500 mt-1">O código de um cupom existente não pode ser alterado.</p>}
                    </div>

                    <div>
                        <label htmlFor="tipoDesconto" className="block text-sm font-medium text-gray-700">Tipo de Desconto *</label>
                        <select
                            id="tipoDesconto"
                            value={tipoDesconto}
                            onChange={(e) => setTipoDesconto(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            required
                        >
                            <option value="percentual">Percentual (%)</option>
                            <option value="valorFixo">Valor Fixo (R$)</option>
                            <option value="freteGratis">Frete Grátis</option>
                        </select>
                    </div>

                    {tipoDesconto !== 'freteGratis' && (
                        <div>
                            <label htmlFor="valorDesconto" className="block text-sm font-medium text-gray-700">
                                Valor do Desconto ({tipoDesconto === 'percentual' ? '%' : 'R$'}) *
                            </label>
                            <input
                                type="number"
                                id="valorDesconto"
                                value={valorDesconto}
                                onChange={(e) => setValorDesconto(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                placeholder={tipoDesconto === 'percentual' ? 'Ex: 10 (para 10%)' : 'Ex: 5.00 (para R$5,00)'}
                                step="0.01"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="minimoPedido" className="block text-sm font-medium text-gray-700">Valor Mínimo do Pedido (Opcional)</label>
                        <input
                            type="number"
                            id="minimoPedido"
                            value={minimoPedido}
                            onChange={(e) => setMinimoPedido(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            placeholder="Ex: 50.00"
                            step="0.01"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="validadeInicio" className="block text-sm font-medium text-gray-700">Validade Início *</label>
                            <input
                                type="datetime-local"
                                id="validadeInicio"
                                value={validadeInicio}
                                onChange={(e) => setValidadeInicio(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="validadeFim" className="block text-sm font-medium text-gray-700">Validade Fim *</label>
                            <input
                                type="datetime-local"
                                id="validadeFim"
                                value={validadeFim}
                                onChange={(e) => setValidadeFim(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="usosMaximos" className="block text-sm font-medium text-gray-700">Usos Máximos Totais (Opcional)</label>
                            <input
                                type="number"
                                id="usosMaximos"
                                value={usosMaximos}
                                onChange={(e) => setUsosMaximos(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                placeholder="Ex: 100"
                            />
                            <p className="text-xs text-gray-500 mt-1">Número total de vezes que este cupom pode ser usado por todos os usuários.</p>
                        </div>
                        <div>
                            <label htmlFor="usosPorUsuario" className="block text-sm font-medium text-gray-700">Usos por Usuário (Opcional)</label>
                            <input
                                type="number"
                                id="usosPorUsuario"
                                value={usosPorUsuario}
                                onChange={(e) => setUsosPorUsuario(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                placeholder="Ex: 1"
                            />
                            <p className="text-xs text-gray-500 mt-1">Número de vezes que cada usuário pode usar este cupom.</p>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="estabelecimentosId" className="block text-sm font-medium text-gray-700">IDs dos Estabelecimentos (Separar por vírgula, Opcional)</label>
                        <input
                            type="text"
                            id="estabelecimentosId"
                            value={estabelecimentosId}
                            onChange={(e) => setEstabelecimentosId(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            placeholder="Ex: id1, id2, id3 (Deixe vazio para todos)"
                        />
                        <p className="text-xs text-gray-500 mt-1">IDs dos estabelecimentos aos quais este cupom se aplica. Deixe vazio para aplicar a todos.</p>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="ativo"
                            checked={ativo}
                            onChange={(e) => setAtivo(e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="ativo" className="ml-2 block text-sm font-medium text-gray-700">Ativo</label>
                    </div>

                    <div className="flex gap-4 mt-6">
                        <button
                            type="submit"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition-colors duration-200"
                        >
                            {editingCouponId ? 'Atualizar Cupom' : 'Criar Cupom'}
                        </button>
                        {editingCouponId && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md shadow-sm transition-colors duration-200"
                            >
                                Cancelar Edição
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Lista de Cupons Existentes */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Cupons Existentes ({cupons.length})</h2>
                {cupons.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-4">Nenhum cupom cadastrado ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Validade</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usos (Atual/Max)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {cupons.map((cupom) => (
                                    <tr key={cupom.id} className={!cupom.ativo ? 'bg-gray-100 text-gray-500' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cupom.codigo}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {cupom.tipoDesconto === 'percentual' ? 'Percentual' :
                                             cupom.tipoDesconto === 'valorFixo' ? 'Valor Fixo' : 'Frete Grátis'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {cupom.tipoDesconto === 'freteGratis' ? 'N/A' :
                                             cupom.tipoDesconto === 'percentual' ? `${cupom.valorDesconto}%` :
                                             `R$ ${cupom.valorDesconto.toFixed(2).replace('.', ',')}`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                           {cupom.validadeInicio?.toDate?.().toLocaleDateString?.() || '-'} - {cupom.validadeFim?.toDate?.().toLocaleDateString?.() || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {cupom.usosAtuais || 0} / {cupom.usosMaximos || '∞'}
                                            {cupom.usosPorUsuario && ` (Max ${cupom.usosPorUsuario}/usuário)`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cupom.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {cupom.ativo ? 'Sim' : 'Não'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleEditClick(cupom)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-3"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(cupom.id, cupom.ativo)}
                                                className={`${cupom.ativo ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'} mr-3`}
                                            >
                                                {cupom.ativo ? 'Desativar' : 'Ativar'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCoupon(cupom.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Excluir
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminCouponManagement;