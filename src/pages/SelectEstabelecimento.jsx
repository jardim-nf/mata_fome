import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { Store, ChevronRight } from 'lucide-react';

export default function SelectEstabelecimento() {
    const { userData, setEstabelecimentoAtual } = useAuth();
    const navigate = useNavigate();
    const [estabelecimentos, setEstabelecimentos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEstabelecimentos = async () => {
            if (!userData || !userData.estabelecimentosGerenciados || userData.estabelecimentosGerenciados.length === 0) {
                setLoading(false);
                return;
            }

            try {
                // Como Firestore permite no máximo 10 itens no 'in', precisamos fazer chunks
                const ids = userData.estabelecimentosGerenciados;
                const chunks = [];
                for (let i = 0; i < ids.length; i += 10) {
                    chunks.push(ids.slice(i, i + 10));
                }

                let results = [];
                for (const chunk of chunks) {
                    const q = query(
                        collection(db, 'estabelecimentos'),
                        where(documentId(), 'in', chunk)
                    );
                    const snapshot = await getDocs(q);
                    const chunkData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    results = [...results, ...chunkData];
                }

                setEstabelecimentos(results);
            } catch (error) {
                console.error("Erro ao carregar estabelecimentos:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEstabelecimentos();
    }, [userData]);

    const handleSelect = (id) => {
        setEstabelecimentoAtual(id);

        // Lógica de redirecionamento igual ao Login
        const cargosDoUsuario = Array.isArray(userData.cargo) 
            ? userData.cargo 
            : [userData.cargo || ''];

        const cargosNormalizados = cargosDoUsuario.map(cargo => 
            String(cargo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        );

        const temCargo = (cargosExigidos) => {
            return cargosNormalizados.some(cargoUsuario => cargosExigidos.includes(cargoUsuario));
        };

        if (userData.isMasterAdmin) {
            navigate('/master-dashboard', { replace: true });
        } else if (userData.isAdmin) {
            navigate('/admin/dashboard', { replace: true });
        } else if (temCargo(['garcom', 'atendente'])) {
            navigate('/controle-salao', { replace: true });
        } else if (temCargo(['caixa'])) {
            navigate('/pdv', { replace: true });
        } else if (temCargo(['entregador'])) {
            navigate('/entregador', { replace: true });
        } else if (temCargo(['gerente', 'cozinheiro', 'auxiliar'])) {
            navigate('/painel', { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 sm:p-10 border border-gray-100">
                
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm transform -rotate-3">
                        <Store className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
                        Selecione a Loja
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">
                        Qual estabelecimento você quer usar agora?
                    </p>
                </div>

                <div className="space-y-4">
                    {estabelecimentos.map(estab => (
                        <button
                            key={estab.id}
                            onClick={() => handleSelect(estab.id)}
                            className="w-full group flex items-center justify-between p-4 bg-white border-2 border-gray-100 hover:border-yellow-400 hover:bg-yellow-50 rounded-2xl transition-all duration-300 text-left hover:shadow-md"
                        >
                            <div className="flex items-center gap-4">
                                {estab.logo ? (
                                    <img src={estab.logo} alt={estab.nome} className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200">
                                        <Store className="w-6 h-6" />
                                    </div>
                                )}
                                <div>
                                    <h3 className="font-bold text-gray-900 group-hover:text-yellow-700 transition-colors">
                                        {estab.nome}
                                    </h3>
                                    <p className="text-xs text-gray-500 line-clamp-1">
                                        ID: {estab.id}
                                    </p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-yellow-400 group-hover:text-white transition-all text-gray-300">
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </button>
                    ))}

                    {estabelecimentos.length === 0 && (
                        <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-100">
                            <p className="text-red-600 font-medium text-sm">
                                Nenhum estabelecimento vinculado a esta conta.
                            </p>
                            <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="mt-4 text-xs font-bold text-red-500 hover:text-red-700">
                                Fazer Login com outra conta
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
