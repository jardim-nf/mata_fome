// src/components/FormularioPedido.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';

const FormularioPedido = ({ itensDoPedido, estabelecimentoId, valorTotal, limparCarrinho, taxas, estabelecimentoInfo }) => {
    const { currentUser, currentClientData, cashbackBalance, setCashbackBalance } = useAuth();
    const navigate = useNavigate();

    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [endereco, setEndereco] = useState('');
    const [metodoPagamento, setMetodoPagamento] = useState('PIX');
    const [trocoPara, setTrocoPara] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [bairro, setBairro] = useState('');
    const [taxaEntrega, setTaxaEntrega] = useState(0);
    const [valorCashbackUsar, setValorCashbackUsar] = useState('');
    const [cashbackAplicado, setCashbackAplicado] = useState(0);
    const [valorFinal, setValorFinal] = useState(valorTotal);

    useEffect(() => {
        if (currentClientData) {
            setNome(currentClientData.nome || '');
            setTelefone(currentClientData.telefone || '');
            const end = currentClientData.endereco;
            if (end) {
                setEndereco(`${end.rua || ''}, ${end.numero || ''} - ${end.complemento || ''}`);
                setBairro(end.bairro || '');
            }
        }
    }, [currentClientData]);

    useEffect(() => {
        const taxaEncontrada = taxas.find(t => t.bairro.toLowerCase() === bairro.toLowerCase());
        const novaTaxa = taxaEncontrada ? taxaEncontrada.taxa : 0;
        setTaxaEntrega(novaTaxa);
    }, [bairro, taxas]);

    useEffect(() => {
        const total = valorTotal + taxaEntrega - cashbackAplicado;
        setValorFinal(total < 0 ? 0 : total);
    }, [valorTotal, taxaEntrega, cashbackAplicado]);

    const handleAplicarCashback = () => {
        const valorAUsar = parseFloat(valorCashbackUsar);
        if (isNaN(valorAUsar) || valorAUsar < 0) return alert("Valor inválido.");
        if (valorAUsar > cashbackBalance) return alert("Saldo de cashback insuficiente.");
        
        const maxAplicavel = valorTotal + taxaEntrega;
        if (valorAUsar > maxAplicavel) {
            alert(`O valor máximo de cashback aplicável é R$ ${maxAplicavel.toFixed(2)}.`);
            setCashbackAplicado(maxAplicavel);
            setValorCashbackUsar(maxAplicavel.toString());
            return;
        }
        setCashbackAplicado(valorAUsar);
        alert(`R$ ${valorAUsar.toFixed(2)} de cashback aplicado!`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (itensDoPedido.length === 0) return alert('O seu carrinho está vazio!');

        const pedidoData = {
            clienteId: currentUser.uid,
            nomeCliente: nome,
            telefoneCliente: telefone,
            enderecoCliente: endereco,
            bairroCliente: bairro,
            itens: itensDoPedido,
            valorSubTotal: valorTotal,
            taxaEntrega: taxaEntrega,
            desconto: cashbackAplicado,
            valorTotal: valorFinal,
            metodoPagamento,
            trocoPara: metodoPagamento === 'Dinheiro' ? trocoPara : '',
            observacoes,
            estabelecimentoId,
            estabelecimentoNome: estabelecimentoInfo.nome,
            cashbackUsado: cashbackAplicado
        };
        
        try {
            const functions = getFunctions();
            const criarPedido = httpsCallable(functions, 'createOrderWithCashback');
            const result = await criarPedido(pedidoData);

            alert(`Pedido #${result.data.orderIdShort.toUpperCase()} enviado com sucesso!`);
            
            if (cashbackAplicado > 0) {
                setCashbackBalance(saldoAtual => saldoAtual - cashbackAplicado);
            }
            
            limparCarrinho();
            navigate('/meus-pedidos');
        } catch (error) {
            console.error('Erro ao enviar pedido:', error);
            alert(`Houve um erro: ${error.message}`);
        }
    };

    return (
        <div className="p-4 border rounded-lg shadow-lg bg-white mt-6">
            <h2 className="text-2xl font-bold mb-4 text-center">Finalizar Pedido</h2>
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label className="block text-gray-700">Nome</label>
                    <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full p-2 border rounded" required />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700">Bairro</label>
                    <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} className="w-full p-2 border rounded" required />
                </div>

                {/* AQUI ESTÁ A OPÇÃO PARA USAR O SEU CASHBACK */}
                {cashbackBalance > 0 && (
                    <div className="my-4 p-4 bg-green-100 border-l-4 border-green-500 rounded">
                        <p className="font-semibold text-green-800">
                            Você tem R$ {cashbackBalance.toFixed(2).replace('.', ',')} de cashback!
                        </p>
                        <div className="flex items-center mt-2">
                            <input
                                type="number"
                                value={valorCashbackUsar}
                                onChange={(e) => setValorCashbackUsar(e.target.value)}
                                className="p-2 border rounded w-full"
                                placeholder="0.00"
                            />
                            <button
                                type="button"
                                onClick={handleAplicarCashback}
                                className="ml-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                Usar
                            </button>
                        </div>
                    </div>
                )}

                <div className="text-lg font-semibold my-4 space-y-1">
                    <p className="flex justify-between"><span>Subtotal:</span> <span>R$ {valorTotal.toFixed(2)}</span></p>
                    <p className="flex justify-between"><span>Taxa de Entrega:</span> <span>R$ {taxaEntrega.toFixed(2)}</span></p>
                    {cashbackAplicado > 0 && (
                        <p className="flex justify-between text-green-600"><span>Cashback Aplicado:</span> <span>- R$ {cashbackAplicado.toFixed(2)}</span></p>
                    )}
                    <p className="text-xl font-bold border-t pt-2 mt-2 flex justify-between"><span>Total a Pagar:</span> <span>R$ {valorFinal.toFixed(2)}</span></p>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700">
                    Finalizar Pedido
                </button>
            </form>
        </div>
    );
};

export default FormularioPedido;