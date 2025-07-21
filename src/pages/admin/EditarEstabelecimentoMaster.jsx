// src/pages/admin/EditarEstabelecimentoMaster.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

// Componente para Inputs, para manter o código do formulário limpo
function FormInput({ label, name, value, onChange, helpText = '', ...props }) {
    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-slate-600">{label}</label>
            <input
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                {...props}
                className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
            />
            {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
        </div>
    );
}

function EditarEstabelecimentoMaster() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isMasterAdmin, loading: authLoading } = useAuth();
    
    const [formData, setFormData] = useState(null);
    const [availableAdmins, setAvailableAdmins] = useState([]);
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (authLoading) return;
        if (!isMasterAdmin) {
            toast.error('Acesso negado.');
            navigate('/master-dashboard');
            return;
        }

        const fetchData = async () => {
            try {
                const docRef = doc(db, 'estabelecimentos', id);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) throw new Error('Estabelecimento não encontrado.');
                
                const data = docSnap.data();
                setFormData({
                    nome: data.nome || '', slug: data.slug || '', chavePix: data.chavePix || '',
                    imageUrl: data.imageUrl || '', rating: data.rating || 0, adminUID: data.adminUID || '',
                    ativo: data.ativo !== undefined ? data.ativo : true,
                    endereco: data.endereco || {}, informacoes_contato: data.informacoes_contato || {}
                });

                const adminsQuery = query(collection(db, 'usuarios'), where('isAdmin', '==', true));
                const adminsSnapshot = await getDocs(adminsQuery);
                setAvailableAdmins(adminsSnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome, email: doc.data().email })));
            } catch (err) {
                setError(err.message);
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, isMasterAdmin, authLoading, navigate]);

    const slugify = useCallback((text) => text.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-'), []);

    useEffect(() => {
        if (formData && !slugManuallyEdited && formData.nome) {
            setFormData(prev => ({...prev, slug: slugify(prev.nome)}));
        }
    }, [formData?.nome, slugManuallyEdited, slugify]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        if (name === 'slug') setSlugManuallyEdited(true);

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: val } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: val }));
        }
    };
    
    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const estabRef = doc(db, 'estabelecimentos', id);
            await updateDoc(estabRef, formData);
            toast.success('Estabelecimento atualizado com sucesso!');
            navigate('/master/estabelecimentos');
        } catch (err) {
            toast.error('Erro ao atualizar o estabelecimento.');
            setLoading(false);
        }
    };

    if (authLoading || loading) return <div className="text-center p-8">Carregando...</div>;
    if (error) return <div className="text-center p-8 text-red-600">Erro: {error}</div>;

    return (
        <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <form onSubmit={handleUpdate}>
                    {/* Cabeçalho com Ações */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                        <div>
                            <Link to="/master/estabelecimentos" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                Voltar para a Lista
                            </Link>
                            <h1 className="text-3xl font-bold text-slate-800">Editar Estabelecimento</h1>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <button type="submit" disabled={loading} className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white text-base font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300">
                                {loading ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>

                    {/* Layout Principal em Duas Colunas */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Coluna Esquerda */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">Dados Principais</h2>
                                <div className="space-y-4">
                                    <FormInput label="Nome do Estabelecimento" name="nome" value={formData.nome} onChange={handleInputChange} required />
                                    <FormInput label="Slug (URL)" name="slug" value={formData.slug} onChange={handleInputChange} required helpText="Gerado do nome, mas pode ser editado."/>
                                    <div>
                                        <label htmlFor="adminUID" className="block text-sm font-medium text-slate-600">Admin Vinculado *</label>
                                        <select id="adminUID" name="adminUID" value={formData.adminUID} onChange={handleInputChange} required className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5">
                                            <option value="">Selecione um administrador</option>
                                            {availableAdmins.map(admin => <option key={admin.id} value={admin.id}>{admin.nome} ({admin.email})</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">Contato e Horários</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormInput label="Telefone/WhatsApp" name="informacoes_contato.telefone_whatsapp" value={formData.informacoes_contato.telefone_whatsapp} onChange={handleInputChange} />
                                    <FormInput label="Instagram" name="informacoes_contato.instagram" value={formData.informacoes_contato.instagram} onChange={handleInputChange} placeholder="@usuario" />
                                </div>
                                <div className="mt-4">
                                    <FormInput label="Horário de Funcionamento" name="informacoes_contato.horario_funcionamento" value={formData.informacoes_contato.horario_funcionamento} onChange={handleInputChange} placeholder="Ex: Ter - Dom: 18h às 23h"/>
                                </div>
                            </div>
                        </div>

                        {/* Coluna Direita */}
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-lg font-bold text-slate-800 mb-4">Status</h2>
                                <label className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange} />
                                        <div className={`block w-14 h-8 rounded-full ${formData.ativo ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.ativo ? 'transform translate-x-full' : ''}`}></div>
                                    </div>
                                    <div className="ml-3 text-base font-semibold text-slate-700">{formData.ativo ? 'Ativo' : 'Inativo'}</div>
                                </label>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-lg font-bold text-slate-800 mb-4">Configurações</h2>
                                <div className="space-y-4">
                                    <FormInput label="URL da Imagem/Logo" name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} />
                                    <FormInput label="Chave PIX" name="chavePix" value={formData.chavePix} onChange={handleInputChange} />
                                    <FormInput label="Avaliação (1-5)" name="rating" type="number" min="0" max="5" step="0.1" value={formData.rating} onChange={handleInputChange} />
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-lg font-bold text-slate-800 mb-4">Endereço</h2>
                                <div className="space-y-4">
                                    <FormInput label="Rua" name="endereco.rua" value={formData.endereco.rua} onChange={handleInputChange} />
                                    <FormInput label="Número" name="endereco.numero" value={formData.endereco.numero} onChange={handleInputChange} />
                                    <FormInput label="Bairro" name="endereco.bairro" value={formData.endereco.bairro} onChange={handleInputChange} />
                                    <FormInput label="Cidade" name="endereco.cidade" value={formData.endereco.cidade} onChange={handleInputChange} />
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditarEstabelecimentoMaster;