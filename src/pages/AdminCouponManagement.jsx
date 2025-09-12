import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { IoArrowBack, IoAddCircleOutline, IoPencil, IoTrash } from 'react-icons/io5';

function AdminCouponManagement() {
    const { currentUser, isAdmin, loading: authLoading, estabelecimentoId } = useAuth();
    const navigate = useNavigate();

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

    // Controle de acesso
    useEffect(() => {
        if (!authLoading && (!currentUser || !isAdmin)) {
            toast.error('Acesso negado.');
            navigate('/login-admin');
        }
    }, [currentUser, isAdmin, authLoading, navigate]);
    
    // EFEITO CORRIGIDO: Busca os cupons do estabelecimento no local correto e em tempo real
    useEffect(() => {
        if (!estabelecimentoId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        // --- CORREÇÃO AQUI: Acessando a subcoleção 'cupons' ---
        const cuponsCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cupons');
        const q = query(cuponsCollectionRef, orderBy('codigo'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const cuponsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCupons(cuponsData);
            setLoading(false);
        }, (err) => {
            console.error("Erro ao buscar cupons:", err);
            toast.error("Erro ao carregar cupons.");
            setLoading(false);
        });

        // Limpa o listener ao desmontar o componente
        return () => unsubscribe();
    }, [estabelecimentoId]);

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

    const handleSaveCoupon = async (e) => {
        e.preventDefault();
        
        // CORREÇÃO da validação do "Frete Grátis"
        if (!codigo || (tipoDesconto !== 'freteGratis' && !valorDesconto) || !validadeInicio || !validadeFim) {
            toast.warn('Preencha os campos obrigatórios: Código, Valor (se aplicável) e Datas de Validade.');
            return;
        }

        try {
            // --- CORREÇÃO AQUI: Referência para a subcoleção ---
            const cuponsCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cupons');

            const newCouponData = {
                codigo: codigo.toUpperCase().trim(),
                tipoDesconto,
                valorDesconto: tipoDesconto === 'freteGratis' ? 0 : Number(valorDesconto),
                minimoPedido: minimoPedido ? Number(minimoPedido) : null,
                validadeInicio: Timestamp.fromDate(new Date(validadeInicio)),
                validadeFim: Timestamp.fromDate(new Date(validadeFim)),
                usosMaximos: usosMaximos ? Number(usosMaximos) : null,
                usosAtuais: editingCouponId ? cupons.find(c => c.id === editingCouponId).usosAtuais : 0,
                ativo,
                estabelecimentoId,
            };

            if (editingCouponId) {
                // --- CORREÇÃO AQUI: Caminho para o documento de edição ---
                const couponRef = doc(cuponsCollectionRef, editingCouponId);
                await updateDoc(couponRef, newCouponData);
                toast.success('Cupom atualizado com sucesso!');
            } else {
                const q = query(cuponsCollectionRef, where('codigo', '==', newCouponData.codigo));
                if (!(await getDocs(q)).empty) {
                    toast.error('Já existe um cupom com este código para este estabelecimento.');
                    return;
                }
                await addDoc(cuponsCollectionRef, newCouponData);
                toast.success('Cupom criado com sucesso!');
            }
            resetForm();
        } catch (err) {
            console.error("Erro ao salvar cupom:", err);
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
        setAtivo(coupon.ativo);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteCoupon = (id, codigo) => {
        toast.warning(
            ({ closeToast }) => (
                <div>
                    <p className="font-semibold">Confirmar exclusão?</p>
                    <p className="text-sm">Deseja realmente excluir o cupom "{codigo}"?</p>
                    <div className="flex justify-end mt-2 space-x-2">
                        <button onClick={closeToast} className="px-3 py-1 text-sm bg-gray-500 text-white rounded">Cancelar</button>
                        <button onClick={async () => {
                            try {
                                // --- CORREÇÃO AQUI: Caminho para o documento a ser deletado ---
                                await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cupons', id));
                                toast.success('Cupom excluído com sucesso!');
                                // O listener onSnapshot vai atualizar a lista automaticamente
                            } catch (err) {
                                toast.error("Erro ao excluir cupom.");
                            }
                            closeToast();
                        }} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Excluir</button>
                    </div>
                </div>
            ), { 
                position: "top-center", 
                autoClose: false, 
                closeOnClick: false, 
                draggable: false 
            }
        );
    };

    if (authLoading || loading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Carregando...</div>;
    }

    return (
        // O restante do seu JSX (formulário e tabela) continua igual
        <div className="bg-gray-900 min-h-screen p-4 sm:p-6 text-white">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-amber-400">Gerenciar Cupons</h1>
                    <Link to="/dashboard" className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                        <IoArrowBack />
                        <span>Voltar ao Dashboard</span>
                    </Link>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8">
                    <h2 className="text-xl font-semibold text-amber-400 mb-4 flex items-center">
                        {editingCouponId ? <IoPencil className="mr-2" /> : <IoAddCircleOutline className="mr-2" />}
                        {editingCouponId ? 'Editar Cupom' : 'Adicionar Novo Cupom'}
                    </h2>
                    <form onSubmit={handleSaveCoupon} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código (Ex: DEZEMBRO10)" disabled={!!editingCouponId} required className="bg-gray-700 p-2 rounded-md border-gray-600" />
                            <select value={tipoDesconto} onChange={(e) => setTipoDesconto(e.target.value)} required className="bg-gray-700 p-2 rounded-md border-gray-600">
                                <option value="percentual">Percentual (%)</option>
                                <option value="valorFixo">Valor Fixo (R$)</option>
                                <option value="freteGratis">Frete Grátis</option>
                            </select>
                            {tipoDesconto !== 'freteGratis' && <input type="number" step="0.01" value={valorDesconto} onChange={(e) => setValorDesconto(e.target.value)} placeholder="Valor do Desconto" required className="bg-gray-700 p-2 rounded-md border-gray-600" />}
                            <input type="datetime-local" value={validadeInicio} onChange={(e) => setValidadeInicio(e.target.value)} required className="bg-gray-700 p-2 rounded-md border-gray-600" title="Data de Início" />
                            <input type="datetime-local" value={validadeFim} onChange={(e) => setValidadeFim(e.target.value)} required className="bg-gray-700 p-2 rounded-md border-gray-600" title="Data de Fim" />
                            <input type="number" value={minimoPedido} onChange={(e) => setMinimoPedido(e.target.value)} placeholder="Pedido Mínimo (R$)" className="bg-gray-700 p-2 rounded-md border-gray-600" />
                            <input type="number" value={usosMaximos} onChange={(e) => setUsosMaximos(e.target.value)} placeholder="Usos Máximos Totais" className="bg-gray-700 p-2 rounded-md border-gray-600" />
                            <div className="flex items-center space-x-2 bg-gray-700 p-2 rounded-md">
                                <input type="checkbox" id="ativo" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 text-amber-500 bg-gray-600 border-gray-500 rounded focus:ring-amber-500" />
                                <label htmlFor="ativo" className="font-medium text-gray-300">Ativo</label>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 pt-4">
                            <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 px-4 rounded-lg transition-colors">
                                {editingCouponId ? 'Salvar Alterações' : 'Criar Cupom'}
                            </button>
                            {editingCouponId && (
                                <button type="button" onClick={resetForm} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                    Cancelar Edição
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold text-amber-400 mb-4">Cupons Cadastrados</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b border-gray-700">
                                <tr>
                                    <th className="p-3 text-sm font-semibold uppercase text-gray-400">Código</th>
                                    <th className="p-3 text-sm font-semibold uppercase text-gray-400">Desconto</th>
                                    <th className="p-3 text-sm font-semibold uppercase text-gray-400">Validade</th>
                                    <th className="p-3 text-sm font-semibold uppercase text-gray-400">Usos</th>
                                    <th className="p-3 text-sm font-semibold uppercase text-gray-400">Status</th>
                                    <th className="p-3 text-sm font-semibold uppercase text-gray-400 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cupons.map(cupom => (
                                    <tr key={cupom.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                        <td className="p-3 font-medium">{cupom.codigo}</td>
                                        <td className="p-3">{cupom.tipoDesconto === 'freteGratis' ? 'Frete Grátis' : `${cupom.valorDesconto}${cupom.tipoDesconto === 'percentual' ? '%' : ' R$'}`}</td>
                                        <td className="p-3 text-sm text-gray-400">{cupom.validadeFim?.toDate().toLocaleDateString('pt-BR')}</td>
                                        <td className="p-3 text-sm text-gray-400">{cupom.usosAtuais} / {cupom.usosMaximos || '∞'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cupom.ativo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {cupom.ativo ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end space-x-2">
                                                <button onClick={() => handleEditClick(cupom)} className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"><IoPencil /></button>
                                                <button onClick={() => handleDeleteCoupon(cupom.id, cupom.codigo)} className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"><IoTrash /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {cupons.length === 0 && <p className="text-center text-gray-500 py-10">Nenhum cupom cadastrado para este estabelecimento.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminCouponManagement;