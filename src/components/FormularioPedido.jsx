// src/components/FormularioPedido.jsx
import React, { useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore"; // Importe Timestamp aqui
import { db } from "../firebase";

function FormularioPedido() {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [itens, setItens] = useState([{ nome: "", quantidade: 1, preco: 0 }]); // Adicione preço para consistência

  const adicionarItem = () => {
    setItens([...itens, { nome: "", quantidade: 1, preco: 0 }]);
  };

  const atualizarItem = (index, campo, valor) => {
    const novosItens = [...itens];
    novosItens[index][campo] = valor;
    setItens(novosItens);
  };

  const removerItem = (index) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleSalvar = async (e) => {
    e.preventDefault();

    if (!nome.trim() || !telefone.trim()) {
      alert("Preencha o nome e telefone do cliente.");
      return;
    }

    // Verifica se todos os itens têm nome e quantidade válida
    if (itens.length === 0 || itens.some((item) => item.nome.trim() === "" || item.quantidade < 1 || item.preco < 0)) {
      alert("Preencha todos os itens corretamente (nome, quantidade e preço positivo).");
      return;
    }

    await addDoc(collection(db, "pedidos"), {
      cliente: { nome: nome.trim(), telefone: telefone.trim() },
      status: "recebido", // Pedidos criados manualmente começam como "recebido"
      itens: itens.map(item => ({ nome: item.nome.trim(), quantidade: Number(item.quantidade), preco: Number(item.preco) })),
      criadoEm: Timestamp.now(), // Use Timestamp para consistência
    });

    setNome("");
    setTelefone("");
    setItens([{ nome: "", quantidade: 1, preco: 0 }]);
    alert("✅ Pedido cadastrado com sucesso!");
  };

  return (
    <form
      onSubmit={handleSalvar}
      className="bg-white p-6 rounded-lg shadow-lg max-w-2xl mx-auto border border-gray-200"
    >
      <h2 className="text-2xl font-bold text-[var(--vermelho-principal)] mb-6 text-center">
        Novo Pedido Manual
      </h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">
          Nome do Cliente *
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
          placeholder="Ex: João da Silva"
          required
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">
          Telefone (com DDD) *
        </label>
        <input
          type="tel" // Alterado para 'tel' para melhor UX
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
          placeholder="Ex: 22999999999"
          required
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--marrom-escuro)] mb-2">
          Itens do Pedido *
        </label>

        {itens.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 mb-3 bg-gray-50 p-3 rounded border border-gray-100"
          >
            <input
              type="text"
              placeholder="Nome do Item"
              value={item.nome}
              onChange={(e) => atualizarItem(i, "nome", e.target.value)}
              className="flex-1 border rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <input
              type="number"
              min="1"
              placeholder="Qtd"
              value={item.quantidade}
              onChange={(e) =>
                atualizarItem(i, "quantidade", Number(e.target.value))
              }
              className="w-16 border rounded px-2 py-1 text-center focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Preço"
              value={item.preco}
              onChange={(e) =>
                atualizarItem(i, "preco", Number(e.target.value))
              }
              className="w-24 border rounded px-2 py-1 text-right focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <button
              type="button"
              onClick={() => removerItem(i)}
              className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg"
              aria-label="Remover item"
            >
              -
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={adicionarItem}
          className="text-[var(--marrom-escuro)] hover:underline mt-2 text-sm flex items-center gap-1"
        >
          <span className="text-lg">+</span> Adicionar Outro Item
        </button>
      </div>

      <div className="text-center">
        <button
          type="submit"
          className="bg-[var(--vermelho-principal)] text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-semibold shadow-md text-lg"
        >
          Salvar Pedido Manualmente
        </button>
      </div>
    </form>
  );
}

export default FormularioPedido;