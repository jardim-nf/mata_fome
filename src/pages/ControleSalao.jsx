// src/pages/ControleSalao.jsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { toast } from 'react-toastify';
import MesaCard from "../components/MesaCard";
import AdicionarMesaModal from "../components/AdicionarMesaModal";

export default function ControleSalao() {
    const { estabelecimentoId } = useAuth();
    const [mesas, setMesas] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!estabelecimentoId) return;

        const mesasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'mesas');
        const q = query(mesasRef); // Removemos o orderBy daqui para fazer no código

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            // ▼▼▼ 2. ORDENAÇÃO NUMÉRICA ADICIONADA AQUI ▼▼▼
            // Isso garante que "2" venha antes de "10"
            data.sort((a, b) => 
                String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true })
            );
            
            setMesas(data);
        });

        return () => unsub();
    }, [estabelecimentoId]);
    
    const handleAdicionarMesa = async (numeroMesa) => {
        const mesaJaExiste = mesas.some(
            (mesa) => String(mesa.numero).toLowerCase() === numeroMesa.toLowerCase()
        );

        if (mesaJaExiste) {
            toast.error(`A mesa "${numeroMesa}" já existe!`);
            return;
        }

        try {
            const mesasCollectionRef = collection(db, 'estabelecimentos', estabelecimentoId, 'mesas');
            await addDoc(mesasCollectionRef, { 
                // ▼▼▼ 1. SALVANDO COMO NÚMERO (SE FOR POSSÍVEL) ▼▼▼
                // Se o valor for um número ("10"), salva como número. Se for texto ("Bar"), salva como texto.
                numero: !isNaN(parseFloat(numeroMesa)) ? parseFloat(numeroMesa) : numeroMesa,
                status: 'livre', 
                total: 0,
            });
            toast.success(`Mesa "${numeroMesa}" adicionada com sucesso!`);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Erro ao adicionar mesa: ", error);
            toast.error("Falha ao adicionar a mesa.");
        }
    };

    const handleExcluirMesa = async (mesaId, numeroMesa) => {
        if (!window.confirm(`Tem certeza que deseja excluir a Mesa ${numeroMesa}?`)) {
            return;
        }
        
        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            await deleteDoc(mesaRef);
            toast.success(`Mesa ${numeroMesa} excluída com sucesso!`);
        } catch (error) {
            console.error("Erro ao excluir mesa:", error);
            toast.error("Falha ao excluir a mesa.");
        }
    };

    return (
        <div className="p-4 md:p-6">
             <AdicionarMesaModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleAdicionarMesa}
            />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Controle de Salão</h1>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow"
                >
                    Adicionar Mesa
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {mesas.map((mesa) => (
                    <MesaCard
                        key={mesa.id}
                        mesa={mesa}
                        onClick={() => navigate(`/mesa/${mesa.id}`)}
                        onExcluir={handleExcluirMesa}
                    />
                ))}
            </div>
        </div>
    );
}