// src/pages/ListaEstabelecimentos.jsx - VERSÃO CORRIGIDA COM isAdminMaster

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { 
    IoRestaurant, 
    IoLocation, 
    IoStar, 
    IoSearch,
    IoAddCircle,
    IoStorefront,
    IoPerson
} from 'react-icons/io5';

// Função para formatar o endereço
const formatarEndereco = (endereco) => {
    if (!endereco) return 'Endereço não informado';
    
    // Se endereco for uma string, retorna diretamente
    if (typeof endereco === 'string') return endereco;
    
    // Se endereco for um objeto, formata as partes
    if (typeof endereco === 'object') {
        const partes = [];
        if (endereco.rua) partes.push(endereco.rua);
        if (endereco.numero) partes.push(endereco.numero);
        if (endereco.bairro) partes.push(endereco.bairro);
        if (endereco.cidade) partes.push(endereco.cidade);
        
        return partes.length > 0 ? partes.join(', ') : 'Endereço não informado';
    }
    
    return 'Endereço não informado';
};

const ListaEstabelecimentos = () => {
    const { currentUser, userRole, isAdminMaster } = useAuth();
    const navigate = useNavigate();
    const [estabelecimentos, setEstabelecimentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchEstabelecimentos = async () => {
            try {
                setLoading(true);
                let estabelecimentosQuery;
                
                if (isAdminMaster) {
                    // Admin Master vê todos os estabelecimentos
                    estabelecimentosQuery = query(collection(db, 'estabelecimentos'));
                } else if (userRole === 'proprietario' && currentUser) {
                    // Proprietário vê apenas seus estabelecimentos
                    estabelecimentosQuery = query(
                        collection(db, 'estabelecimentos'),
                        where('proprietarioId', '==', currentUser.uid)
                    );
                } else {
                    // Cliente ou usuário não logado vê estabelecimentos ativos
                    estabelecimentosQuery = query(
                        collection(db, 'estabelecimentos'),
                        where('ativo', '==', true)
                    );
                }

                const querySnapshot = await getDocs(estabelecimentosQuery);
                const estabelecimentosData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setEstabelecimentos(estabelecimentosData);
            } catch (error) {
                console.error('Erro ao buscar estabelecimentos:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEstabelecimentos();
    }, [currentUser, userRole, isAdminMaster]);

    const filteredEstabelecimentos = estabelecimentos.filter(estabelecimento => {
        const enderecoFormatado = formatarEndereco(estabelecimento.endereco);
        return (
            estabelecimento.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            estabelecimento.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            enderecoFormatado.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    const handleEstabelecimentoClick = (estabelecimentoId) => {
        if (userRole === 'cliente' || !userRole) {
            navigate(`/cardapio-publico/${estabelecimentoId}`);
        } else {
            navigate(`/controle-salao/${estabelecimentoId}`);
        }
    };

    const handleCriarEstabelecimento = () => {
        navigate('/criar-estabelecimento');
    };

    // Verifica se o usuário pode criar estabelecimentos
    const podeCriarEstabelecimento = isAdminMaster || userRole === 'proprietario';

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-700 font-medium">Carregando estabelecimentos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                            <IoStorefront className="text-white text-2xl" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        {isAdminMaster ? 'Todos os Estabelecimentos' : 
                         userRole === 'proprietario' ? 'Meus Estabelecimentos' : 
                         'Estabelecimentos Disponíveis'}
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        {isAdminMaster ? 'Gerencie todos os estabelecimentos da plataforma' :
                         userRole === 'proprietario' ? 'Gerencie seus estabelecimentos' :
                         'Encontre os melhores estabelecimentos perto de você'}
                    </p>
                </div>

                {/* Search and Actions Bar */}
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-center mb-8">
                    <div className="relative flex-1 max-w-2xl w-full">
                        <IoSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl" />
                        <input
                            type="text"
                            placeholder="Buscar estabelecimentos por nome, categoria ou endereço..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white shadow-sm"
                        />
                    </div>

                    {podeCriarEstabelecimento && (
                        <button
                            onClick={handleCriarEstabelecimento}
                            className="flex items-center space-x-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-lg"
                        >
                            <IoAddCircle className="text-xl" />
                            <span>Criar Estabelecimento</span>
                        </button>
                    )}
                </div>

                {/* Estabelecimentos Grid */}
                {filteredEstabelecimentos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredEstabelecimentos.map((estabelecimento) => (
                            <div
                                key={estabelecimento.id}
                                onClick={() => handleEstabelecimentoClick(estabelecimento.id)}
                                className="bg-white rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group hover:border-blue-300"
                            >
                                {/* Imagem do Estabelecimento */}
                                <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden">
                                    {estabelecimento.imageUrl ? (
                                        <img
                                            src={estabelecimento.imageUrl}
                                            alt={estabelecimento.nome}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <IoRestaurant className="text-4xl text-blue-400" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    
                                    {/* Status Badge */}
                                    <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold ${
                                        estabelecimento.ativo 
                                            ? 'bg-green-500 text-white' 
                                            : 'bg-red-500 text-white'
                                    }`}>
                                        {estabelecimento.ativo ? 'Ativo' : 'Inativo'}
                                    </div>
                                </div>

                                {/* Informações do Estabelecimento */}
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="text-xl font-bold text-gray-900 line-clamp-2 flex-1">
                                            {estabelecimento.nome}
                                        </h3>
                                        {estabelecimento.avaliacao && (
                                            <div className="flex items-center space-x-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                                                <IoStar className="text-sm" />
                                                <span className="text-sm font-bold">{estabelecimento.avaliacao}</span>
                                            </div>
                                        )}
                                    </div>

                                    {estabelecimento.categoria && (
                                        <p className="text-gray-600 mb-3 flex items-center space-x-2">
                                            <IoRestaurant className="text-gray-400" />
                                            <span>{estabelecimento.categoria}</span>
                                        </p>
                                    )}

                                    {/* Endereço formatado */}
                                    <p className="text-gray-600 mb-4 flex items-start space-x-2">
                                        <IoLocation className="text-gray-400 mt-1 flex-shrink-0" />
                                        <span className="text-sm line-clamp-2">
                                            {formatarEndereco(estabelecimento.endereco)}
                                        </span>
                                    </p>

                                    {/* Badge de Role */}
                                    <div className="flex items-center justify-between">
                                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                            isAdminMaster 
                                                ? 'bg-purple-100 text-purple-700'
                                                : userRole === 'proprietario'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-green-100 text-green-700'
                                        }`}>
                                            {isAdminMaster ? 'Admin Master' :
                                             userRole === 'proprietario' ? 'Proprietário' :
                                             userRole === 'admin' ? 'Administrador' :
                                             'Cliente'}
                                        </div>
                                        
                                        <button className="text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors duration-200">
                                            {userRole === 'cliente' || !userRole ? 'Ver Cardápio' : 'Gerenciar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-16 text-center">
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <IoStorefront className="text-3xl text-blue-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">
                            {estabelecimentos.length === 0 ? 'Nenhum estabelecimento encontrado' : 'Nenhum resultado na busca'}
                        </h3>
                        <p className="text-gray-600 mb-8 text-lg max-w-md mx-auto">
                            {estabelecimentos.length === 0 
                                ? userRole === 'proprietario' 
                                    ? 'Você ainda não possui estabelecimentos cadastrados.'
                                    : 'Não há estabelecimentos disponíveis no momento.'
                                : 'Tente ajustar os termos de busca para encontrar o que procura.'}
                        </p>
                        {podeCriarEstabelecimento && estabelecimentos.length === 0 && (
                            <button
                                onClick={handleCriarEstabelecimento}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-lg inline-flex items-center space-x-3"
                            >
                                <IoAddCircle className="text-xl" />
                                <span>Criar Primeiro Estabelecimento</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Info Footer */}
                <div className="mt-12 text-center">
                    <div className="inline-flex items-center space-x-6 bg-white rounded-2xl shadow-sm border border-gray-200 px-6 py-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <IoStorefront className="text-blue-600" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm text-gray-600">Total de Estabelecimentos</p>
                                <p className="text-lg font-bold text-gray-900">{estabelecimentos.length}</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-gray-300"></div>
                        <div className="flex items-center space-x-2">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <IoPerson className="text-green-600" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm text-gray-600">Seu Perfil</p>
                                <p className="text-lg font-bold text-gray-900 capitalize">
                                    {isAdminMaster ? 'Admin Master' : 
                                     userRole === 'admin' ? 'Administrador' :
                                     userRole || 'Visitante'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ListaEstabelecimentos;