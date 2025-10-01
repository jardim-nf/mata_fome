// src/pages/admin/ImportarCardapioMaster.jsx - VERSÃO "PARRUDA" E OTIMIZADA

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, writeBatch, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';

// Componente de Header (sem alterações)
function DashboardHeader({ currentUser, logout, navigate }) {
    const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';
    const handleLogout = async () => { /* ... (seu código de logout aqui, sem alterações) ... */ };
    return ( <header> {/* ... (seu código de header aqui, sem alterações) ... */} </header> );
}

function ImportarCardapioMaster() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [estabelecimentosList, setEstabelecimentosList] = useState([]);
    const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
    const [file, setFile] = useState(null);
    const [importing, setImporting] = useState(false);
    
    // Hooks de useEffect para controle de acesso e busca de estabelecimentos (sem alterações)
    useEffect(() => { /* ... (seu código aqui, sem alterações) ... */ }, [currentUser, isMasterAdmin, authLoading, navigate]);
    useEffect(() => { /* ... (seu código aqui, sem alterações) ... */ }, [isMasterAdmin, currentUser]);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    // ▼▼▼ FUNÇÃO handleImport TOTALMENTE REESCRITA E OTIMIZADA ▼▼▼
    const handleImport = async (e) => {
        e.preventDefault();
        if (!selectedEstabelecimentoId || !file) {
            toast.error('Selecione um estabelecimento e um arquivo JSON.');
            return;
        }

        setImporting(true);

        try {
            const fileContent = await file.text();
            const dataToImport = JSON.parse(fileContent);

            if (!dataToImport || !Array.isArray(dataToImport.categorias)) {
                throw new Error('Estrutura de arquivo JSON inválida. Espera um objeto com "categorias".');
            }

            const batch = writeBatch(db);
            const produtosCollectionRef = collection(db, 'produtos');

            // 1. DELETAR produtos antigos deste estabelecimento na coleção principal 'produtos'
            console.log(`Buscando produtos antigos do estabelecimento ${selectedEstabelecimentoId} para deletar...`);
            const q = query(produtosCollectionRef, where('estabelecimentoId', '==', selectedEstabelecimentoId));
            const oldProductsSnapshot = await getDocs(q);
            
            if (!oldProductsSnapshot.empty) {
                console.log(`Deletando ${oldProductsSnapshot.size} produtos antigos.`);
                oldProductsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            }

            // 2. ADICIONAR os novos produtos na coleção principal 'produtos'
            let productCount = 0;
            dataToImport.categorias.forEach(categoria => {
                if (categoria.itens && Array.isArray(categoria.itens)) {
                    categoria.itens.forEach(item => {
                        const itemId = item.id || item.nome.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]+/g, '');
                        const productRef = doc(produtosCollectionRef, itemId);
                        
                        // Cria o novo objeto do produto com TODOS os campos necessários
                        const newProductData = {
                            ...item, // nome, preco, descricao, imageUrl, etc.
                            categoria: categoria.nome, // Adiciona o nome da categoria ao produto
                            ordemCategoria: categoria.ordem || 0, // Adiciona a ordem da categoria
                            estabelecimentoId: selectedEstabelecimentoId // ADIÇÃO CRUCIAL!
                        };
                        
                        batch.set(productRef, newProductData);
                        productCount++;
                    });
                }
            });

            await batch.commit();

            await auditLogger(
                'CARDAPIO_IMPORTADO_OTIMIZADO',
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'estabelecimento', id: selectedEstabelecimentoId, name: estabelecimentosList.find(e => e.id === selectedEstabelecimentoId)?.nome },
                { fileName: file.name, numProdutos: productCount }
            );

            toast.success(`Cardápio importado com sucesso! ${productCount} produtos foram adicionados/atualizados.`);
            setFile(null);

        } catch (error) {
            console.error("Erro na importação:", error);
            toast.error(`Erro na importação: ${error.message}`);
        } finally {
            setImporting(false);
        }
    };

    if (authLoading || loading) {
        return <div className="text-center p-8">Carregando...</div>;
    }
    if (!currentUser || !isMasterAdmin) return null;

    // O JSX da página continua o mesmo
    return (
        <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4">
           {/* ... (todo o seu JSX aqui, sem alterações) ... */}
           {/* ... Apenas certifique-se que o onSubmit do form chama a nova handleImport ... */}
        </div>
    );
}

export default ImportarCardapioMaster;