// src/components/ImageDisplay.jsx
import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage'; // Importe as funções do Storage
import { storage } from '../firebase'; // Importe a instância do Storage do seu firebase.js

function ImageDisplay({ imagePath }) {
    const [imageUrl, setImageUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchImage = async () => {
            if (!imagePath) {
                setError("Caminho da imagem não fornecido.");
                setLoading(false);
                return;
            }

            try {
                // 1. Crie uma referência para o arquivo no Storage
                // imagePath deve ser o caminho COMPLETO do arquivo dentro do seu bucket
                // Ex: 'imagens/minhafoto.jpg' ou 'produtos/sku123/imagem1.png'
                const imageRef = ref(storage, imagePath);

                // 2. Obtenha a URL de download
                const url = await getDownloadURL(imageRef);
                setImageUrl(url);
                setLoading(false);

            } catch (err) {
                console.error("Erro ao buscar imagem do Firebase Storage:", err);
                setError("Não foi possível carregar a imagem.");
                setImageUrl(''); // Limpa a URL se houver erro
                setLoading(false);
            }
        };

        fetchImage();
    }, [imagePath]); // Refaz a busca se o caminho da imagem mudar

    if (loading) {
        return <div className="text-gray-500">Carregando imagem...</div>;
    }

    if (error) {
        return <div className="text-red-600">Erro: {error}</div>;
    }

    if (!imageUrl) {
        return <div className="text-gray-500">Imagem não disponível.</div>;
    }

    return (
        <img
            src={imageUrl}
            alt="Imagem do Firebase Storage"
            className="flex-col sm:flex-row h-auto object-cover rounded-md shadow-md"
            // Adicione estilos ou classes conforme necessário
        />
    );
}

export default ImageDisplay;