// src/pages/HistoricoCliente.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import PedidoCard from '../components/PedidoCard';

const HistoricoCliente = () => {
    // Usamos o hook para ir buscar os dados do contexto
    const { currentUser, cashbackBalance } = useAuth(); 
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPedidos = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            };

            try {
                const q = query(
                    collection(db, 'pedidos'),
                    where('clienteId', '==', currentUser.uid),
                    orderBy('timestamp', 'desc')
                );
                const querySnapshot = await getDocs(q);
                const pedidosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPedidos(pedidosData);
            } catch (error) {
                console.error("Erro ao buscar histórico de pedidos:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPedidos();
    }, [currentUser]);

    if (loading) {
        return <div className="text-center p-8">A carregar histórico...</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-center">Meus Pedidos</h1>

            {/* ===== CARTÃO DE CASHBACK ADICIONADO AQUI ===== */}
            <div className="mb-8 p-4 bg-green-100 border-l-4 border-green-500 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-green-800">Seu Saldo de Cashback</h2>
                <p className="text-3xl font-bold text-green-700 mt-2">
                    R$ {(cashbackBalance || 0).toFixed(2).replace('.', ',')}
                </p>
            </div>
            {/* ============================================== */}

            {pedidos.length === 0 ? (
                <p className="text-center text-gray-500">Você ainda não fez nenhum pedido.</p>
            ) : (
                <div className="space-y-4">
                    {pedidos.map(pedido => (
                        <PedidoCard key={pedido.id} pedido={pedido} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default HistoricoCliente;