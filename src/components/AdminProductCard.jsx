// src/components/AdminProductCard.jsx

import React from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Certifique-se de que o caminho para o seu db está correto

// Este componente é EXCLUSIVAMENTE para a visão e gerenciamento do ADMINISTRADOR
// Ele recebe o item do produto e o ID do estabelecimento para operações no Firestore
// e funções de callback para Edição e Exclusão.
const AdminProductCard = ({ produto, estabelecimentoId, onEdit, onDelete }) => {

  // Lógica para ativar/desativar produto
  const toggleAtivo = async () => {
    if (!estabelecimentoId || !produto || !produto.id) {
      alert("Operação inválida. ID do estabelecimento ou produto ausente.");
      return;
    }

    const confirmAction = window.confirm(
      `Tem certeza que deseja ${produto.ativo ? 'DESATIVAR' : 'ATIVAR'} o produto "${produto.nome}"?`
    );

    if (!confirmAction) return;

    try {
      const produtoRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', produto.id);
      await updateDoc(produtoRef, {
        ativo: !produto.ativo // Inverte o valor atual (true vira false, false vira true)
      });
      alert(`Produto "${produto.nome}" foi ${produto.ativo ? 'desativado' : 'ativado'} com sucesso!`);
    } catch (error) {
      console.error("Erro ao atualizar status do produto:", error);
      alert("Erro ao atualizar status do produto. Por favor, tente novamente.");
    }
  };

  // Lógica para exclusão
  const handleDelete = () => {
    if (onDelete && produto.id) {
      onDelete(produto.id); // Chama a função onDelete passada como prop do AdminMenuManagement
    } else {
      alert("Operação de exclusão inválida.");
    }
  };

  // Lógica para edição
  const handleEdit = () => {
    if (onEdit) {
      onEdit(produto); // Chama a função onEdit passada como prop do AdminMenuManagement
    } else {
      alert("Operação de edição inválida.");
    }
  };

  return (
    // Aplica um estilo visual para produtos desativados (opacidade e borda vermelha)
    <div className={`bg-white p-4 rounded-lg shadow-md mb-4 ${!produto.ativo ? 'opacity-50 border-red-400 border-2' : ''}`}>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">{produto.nome}</h3>
      <p className="text-gray-600 mb-2">{produto.descricao}</p>
      <p className="text-lg font-bold text-gray-900 mb-3">R$ {produto.preco ? produto.preco.toFixed(2).replace('.', ',') : '0,00'}</p>
      
      {produto.imageUrl && (
        <img src={produto.imageUrl} alt={produto.nome} className="w-full h-32 object-cover rounded-md mb-3" />
      )}
      
      <div className="flex justify-between items-center mt-4">
        {/* VISÃO DO ADMINISTRADOR: Mostra status e botões de gerenciamento */}
        <span className={`text-sm font-medium ${produto.ativo ? 'text-green-600' : 'text-red-600'}`}>
          Status: {produto.ativo ? 'Ativo' : 'Desativado'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleEdit}
            className="px-3 py-1 rounded-md text-blue-500 hover:text-blue-700 text-sm font-medium transition-colors duration-200"
          >
            Editar
          </button>
          <button
            onClick={toggleAtivo}
            className={`px-3 py-1 rounded-md text-white text-sm font-medium transition-colors duration-200 
              ${produto.ativo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {produto.ativo ? 'Desativar' : 'Ativar'}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1 rounded-md text-red-500 hover:text-red-700 text-sm font-medium transition-colors duration-200"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProductCard;