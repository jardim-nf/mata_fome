// src/pages/AdminEstablishmentManagement.jsx
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

function AdminEstablishmentManagement() {
    const [estabelecimentos, setEstabelecimentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados para o formulário de cadastro/edição
    const [showForm, setShowForm] = useState(false);
    const [editingEstablishment, setEditingEstablishment] = useState(null); // Armazena o estabelecimento sendo editado

    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [chavePix, setChavePix] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [tipo, setTipo] = useState('');
    const [valor, setValor] = useState(''); // Ex: "R$ 10-20" ou "Alto"
    const [rating, setRating] = useState('');
    const [slug, setSlug] = useState(''); // O NOVO CAMPO SLUG
    
    // Campos de Endereço (para manter a estrutura)
    const [enderecoRua, setEnderecoRua] = useState('');
    const [enderecoNumero, setEnderecoNumero] = useState('');
    const [enderecoBairro, setEnderecoBairro] = useState('');
    const [enderecoComplemento, setEnderecoComplemento] = useState(''); 
    const [enderecoCidade, setEnderecoCidade] = useState('');
    const [enderecoEstado, setEnderecoEstado] = useState('');
    const [enderecoCep, setEnderecoCep] = useState('');

    const [formError, setFormError] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // Efeito para carregar a lista de estabelecimentos
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'estabelecimentos'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEstabelecimentos(data);
            setLoading(false);
        }, (err) => {
            console.error("Erro ao carregar estabelecimentos:", err);
            setError("Não foi possível carregar os estabelecimentos.");
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Função para abrir o formulário (para adicionar ou editar)
    const openForm = (establishmentToEdit = null) => {
        setEditingEstablishment(establishmentToEdit);
        if (establishmentToEdit) {
            setNome(establishmentToEdit.nome || '');
            setDescricao(establishmentToEdit.descricao || '');
            setWhatsapp(establishmentToEdit.whatsapp || '');
            setChavePix(establishmentToEdit.chavePix || '');
            setImageUrl(establishmentToEdit.imageUrl || '');
            setTipo(establishmentToEdit.tipo || '');
            setValor(establishmentToEdit.valor || '');
            setRating(establishmentToEdit.rating || '');
            setSlug(establishmentToEdit.slug || '');
            
            setEnderecoRua(establishmentToEdit.endereco?.rua || '');
            setEnderecoNumero(establishmentToEdit.endereco?.numero || '');
            setEnderecoBairro(establishmentToEdit.endereco?.bairro || '');
            setEnderecoComplemento(establishmentToEdit.endereco?.complemento || '');
            setEnderecoCidade(establishmentToEdit.endereco?.cidade || '');
            setEnderecoEstado(establishmentToEdit.endereco?.estado || '');
            setEnderecoCep(establishmentToEdit.endereco?.cep || '');

        } else {
            setNome('');
            setDescricao('');
            setWhatsapp('');
            setChavePix('');
            setImageUrl('');
            setTipo('');
            setValor('');
            setRating('');
            setSlug('');
            
            setEnderecoRua('');
            setEnderecoNumero('');
            setEnderecoBairro('');
            setEnderecoComplemento('');
            setEnderecoCidade('');
            setEnderecoEstado('');
            setEnderecoCep('');
        }
        setFormError('');
        setShowForm(true);
    };

    // Função para fechar o formulário
    const closeForm = () => {
        setShowForm(false);
        setEditingEstablishment(null);
        setFormError('');
    };

    // Função para gerar um slug a partir do nome (opcional, mas útil)
    const generateSlug = (name) => {
        return name
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-');
    };

    // Efeito para gerar o slug automaticamente ao digitar o nome
    useEffect(() => {
        if (!editingEstablishment && nome.trim() !== '' && slug.trim() === '') {
            setSlug(generateSlug(nome));
        } else if (editingEstablishment && nome.trim() !== '' && (slug.trim() === generateSlug(editingEstablishment.nome || '') || slug.trim() === '')) {
            setSlug(generateSlug(nome));
        }
    }, [nome, editingEstablishment]);

    // Função para salvar (adicionar ou atualizar) o estabelecimento
    const handleSaveEstablishment = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setFormError('');

        // Validações básicas
        if (!nome.trim() || !whatsapp.trim() || !slug.trim()) {
            setFormError("Nome, WhatsApp e Slug são obrigatórios.");
            setFormLoading(false);
            return;
        }

        // Validação de unicidade do slug
        try {
            const q = query(collection(db, 'estabelecimentos'), where('slug', '==', slug.trim()));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                if (editingEstablishment && querySnapshot.docs[0].id === editingEstablishment.id) {
                } else {
                    setFormError("Este slug já está em uso por outro estabelecimento. Escolha outro.");
                    setFormLoading(false);
                    return;
                }
            }
        } catch (err) {
            console.error("Erro na validação de slug:", err);
            setFormError("Erro ao validar slug. Tente novamente.");
            setFormLoading(false);
            return;
        }

        const establishmentData = {
            nome: nome.trim(),
            descricao: descricao.trim(),
            whatsapp: whatsapp.trim(),
            chavePix: chavePix.trim(),
            imageUrl: imageUrl.trim(),
            tipo: tipo.trim(),
            valor: valor.trim(),
            rating: Number(rating) || 0,
            slug: slug.trim(),
            endereco: {
                rua: enderecoRua.trim(),
                numero: enderecoNumero.trim(),
                bairro: enderecoBairro.trim(),
                complemento: enderecoComplemento.trim(),
                cidade: enderecoCidade.trim(),
                estado: enderecoEstado.trim(),
                cep: enderecoCep.trim(),
            }
        };

        try {
            if (editingEstablishment) {
                const estabRef = doc(db, 'estabelecimentos', editingEstablishment.id);
                await updateDoc(estabRef, establishmentData);
                alert('Estabelecimento atualizado com sucesso!');
            } else {
                await addDoc(collection(db, 'estabelecimentos'), establishmentData);
                alert('Estabelecimento cadastrado com sucesso!');
            }
            closeForm();
        } catch (err) {
            console.error("Erro ao salvar estabelecimento:", err);
            setFormError("Erro ao salvar estabelecimento. Verifique o console.");
        } finally {
            setFormLoading(false);
        }
    };

    // Função para excluir estabelecimento
    const handleDeleteEstablishment = async (id, nomeEstab) => {
        if (window.confirm(`Tem certeza que deseja excluir o estabelecimento "${nomeEstab}"? Esta ação é irreversível!`)) {
            try {
                await deleteDoc(doc(db, 'estabelecimentos', id));
                alert('Estabelecimento excluído com sucesso!');
            } catch (err) {
                console.error("Erro ao excluir estabelecimento:", err);
                alert("Erro ao excluir estabelecimento. Verifique o console.");
            }
        }
    };

    if (loading) {
        return <div className="text-center p-4 text-[var(--marrom-escuro)]">Carregando estabelecimentos...</div>;
    }

    if (error) {
        return <div className="text-center p-4 text-red-600 font-semibold">{error}</div>;
    }

    return (
        <div className="min-h-screen bg-[var(--bege-claro)] p-6">
            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-8">
                <Link to="/dashboard" className="inline-flex items-center px-4 py-2 bg-gray-200 text-[var(--marrom-escuro)] rounded-lg font-semibold hover:bg-gray-300 transition duration-300 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Voltar para o Dashboard
                </Link>

                <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-8">
                    Gerenciar Estabelecimentos
                </h1>

                {/* Botão para adicionar novo estabelecimento */}
                <div className="text-right mb-6">
                    <button
                        onClick={() => openForm()}
                        className="bg-[var(--verde-destaque)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-300"
                    >
                        + Cadastrar Novo Estabelecimento
                    </button>
                </div>

                {/* Formulário de Cadastro/Edição (Condicional) */}
                {showForm && (
                    <form onSubmit={handleSaveEstablishment} className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200 shadow-inner">
                        <h4 className="text-xl font-bold text-[var(--marrom-escuro)] mb-6">{editingEstablishment ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}</h4>
                        {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="nome" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Nome do Estabelecimento *</label>
                                <input type="text" id="nome" value={nome} onChange={(e) => setNome(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" required />
                            </div>
                            <div>
                                <label htmlFor="slug" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Slug da URL *</label>
                                <input type="text" id="slug" value={slug} onChange={(e) => setSlug(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="ex: meu-restaurante-online" required />
                                <p className="text-xs text-gray-500 mt-1">Será o link: /loja/{slug || 'nome-slug'}</p>
                            </div>
                            <div>
                                <label htmlFor="whatsapp" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">WhatsApp (com DDD) *</label>
                                <input type="text" id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="ex: 5522999999999" required />
                            </div>
                            <div>
                                <label htmlFor="chavePix" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Chave PIX (Opcional)</label>
                                <input type="text" id="chavePix" value={chavePix} onChange={(e) => setChavePix(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                            <div>
                                <label htmlFor="imageUrl" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">URL da Imagem/Logo (Opcional)</label>
                                <input type="text" id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="ex: https://link-da-sua-logo.png" />
                            </div>
                            <div>
                                <label htmlFor="tipo" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Tipo (Ex: Restaurante, Pizzaria)</label>
                                <input type="text" id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                            <div>
                                <label htmlFor="valor" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Valor (Ex: $, $$, $$$)</label>
                                <input type="text" id="valor" value={valor} onChange={(e) => setValor(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                            <div>
                                <label htmlFor="rating" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Avaliação (1-5)</label>
                                <input type="number" id="rating" value={rating} onChange={(e) => setRating(e.target.value)} min="1" max="5" step="0.1"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                        </div>

                        {/* Campos de Endereço */}
                        <h5 className="text-md font-bold text-[var(--marrom-escuro)] mb-3 mt-6">Endereço</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="enderecoRua" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Rua</label>
                                <input type="text" id="enderecoRua" value={enderecoRua} onChange={(e) => setEnderecoRua(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                            <div>
                                <label htmlFor="enderecoNumero" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Número</label>
                                <input type="text" id="enderecoNumero" value={enderecoNumero} onChange={(e) => setEnderecoNumero(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                            <div>
                                <label htmlFor="enderecoBairro" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Bairro</label>
                                <input type="text" id="enderecoBairro" value={enderecoBairro} onChange={(e) => setEnderecoBairro(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                            <div>
                                <label htmlFor="enderecoComplemento" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Complemento</label>
                                <input type="text" id="enderecoComplemento" value={enderecoComplemento} onChange={(e) => setEnderecoComplemento(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                            <div>
                                <label htmlFor="enderecoCidade" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Cidade</label>
                                <input type="text" id="enderecoCidade" value={enderecoCidade} onChange={(e) => setEnderecoCidade(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                            <div>
                                <label htmlFor="enderecoEstado" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Estado (UF)</label>
                                <input type="text" id="enderecoEstado" value={enderecoEstado} onChange={(e) => setEnderecoEstado(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" maxLength="2" />
                            </div>
                            <div>
                                <label htmlFor="enderecoCep" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">CEP</label>
                                <input type="text" id="enderecoCep" value={enderecoCep} onChange={(e) => setEnderecoCep(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label htmlFor="descricao" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Descrição</label>
                            <textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows="3"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"></textarea>
                        </div>

                        <div className="flex gap-4 justify-end">
                            <button type="button" onClick={closeForm} className="bg-gray-300 text-[var(--marrom-escuro)] px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 transition duration-300">Cancelar</button>
                            <button type="submit" disabled={formLoading} className="bg-[var(--vermelho-principal)] text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition duration-300">
                                {formLoading ? 'Salvando...' : (editingEstablishment ? 'Salvar Edição' : 'Cadastrar Estabelecimento')}
                            </button>
                        </div>
                    </form>
                )}

                {/* Lista de Estabelecimentos Cadastrados */}
                <div className="mt-8">
                    <h2 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-6 text-center">Estabelecimentos Cadastrados</h2>
                    {estabelecimentos.length === 0 ? (
                        <p className="text-center text-[var(--cinza-texto)] italic">Nenhum estabelecimento cadastrado ainda.</p>
                    ) : (
                        <ul className="space-y-4">
                            {estabelecimentos.map(estab => (
                                <li key={estab.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm">
                                    <div>
                                        <h3 className="text-lg font-semibold text-[var(--marrom-escuro)]">{estab.nome}</h3>
                                        {estab.slug && (
                                            <p className="text-sm text-gray-600">
                                                Link: <a href={`/loja/${estab.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                    /loja/{estab.slug}
                                                </a>
                                        </p>
                                        )}
                                        <p className="text-sm text-gray-500">WhatsApp: {estab.whatsapp}</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => openForm(estab)}
                                            className="text-blue-600 hover:text-blue-800 transition duration-300 text-sm font-semibold"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDeleteEstablishment(estab.id, estab.nome)}
                                            className="text-red-600 hover:text-red-800 transition duration-300 text-sm font-semibold"
                                        >
                                            Excluir
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminEstablishmentManagement;