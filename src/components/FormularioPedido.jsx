import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { addDoc, collection, Timestamp, runTransaction, doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const FormularioPedido = ({ carrinho, total, limparCarrinho, estabelecimentoId, onAplicarCupom }) => {
    const { currentUser, currentClientData, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // Estados do formulário
    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [isRetirada, setIsRetirada] = useState(false);
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [complemento, setComplemento] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('pix');
    const [trocoPara, setTrocoPara] = useState('');
    const [cupomInput, setCupomInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Efeito para preencher os dados do usuário logado
    useEffect(() => {
        // Usamos "optional chaining" (?.) para acessar propriedades aninhadas com segurança.
        // Isso previne o erro que você viu na imagem!
        if (currentUser && currentClientData) {
            setNome(currentClientData.nome || '');
            setTelefone(currentClientData.telefone || '');
            setRua(currentClientData.endereco?.rua || '');
            setNumero(currentClientData.endereco?.numero || '');
            setBairro(currentClientData.endereco?.bairro || '');
            setCidade(currentClientData.endereco?.cidade || '');
            setComplemento(currentClientData.endereco?.complemento || '');
        }
    }, [currentUser, currentClientData]);
    
    const handleFinalizarPedido = async (e) => {
        e.preventDefault();
        
        if (carrinho.length === 0) {
            toast.warn('Seu carrinho está vazio!');
            return;
        }
        if (!isRetirada && (!rua || !numero || !bairro || !cidade)) {
            toast.warn('Por favor, preencha o endereço de entrega completo.');
            return;
        }

        setIsSubmitting(true);

        const pedido = {
            clienteId: currentUser.uid,
            clienteNome: nome,
            clienteTelefone: telefone,
            endereco: isRetirada ? null : { rua, numero, bairro, cidade, complemento },
            itens: carrinho,
            total: total,
            formaPagamento,
            trocoPara: formaPagamento === 'dinheiro' ? trocoPara : '',
            tipoEntrega: isRetirada ? 'retirada' : 'delivery',
            status: 'recebido',
            timestamp: Timestamp.now(),
            estabelecimentoId: estabelecimentoId,
        };

        try {
            await addDoc(collection(db, 'pedidos'), pedido);
            toast.success('🎉 Pedido enviado com sucesso!');
            limparCarrinho();
            // Opcional: Redirecionar para uma página de confirmação
            // navigate('/meus-pedidos'); 
        } catch (error) {
            console.error("Erro ao finalizar pedido:", error);
            toast.error("Houve um erro ao enviar seu pedido.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 border rounded-lg shadow-lg bg-white">
            <h2 className="text-xl font-bold mb-4">Seus Dados</h2>
            <form onSubmit={handleFinalizarPedido} className="space-y-4">
                {/* Campos de Nome e Telefone */}
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome Completo *" required className="flex-col sm:flex-row p-2 border rounded"/>
                <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone *" required className="flex-col sm:flex-row p-2 border rounded"/>
                
                {/* Tipo de Entrega */}
                <div className="flex gap-4">
                    <label><input type="radio" name="entrega" checked={!isRetirada} onChange={() => setIsRetirada(false)} /> Entrega</label>
                    <label><input type="radio" name="entrega" checked={isRetirada} onChange={() => setIsRetirada(true)} /> Retirada</label>
                </div>

                {/* Campos de Endereço (condicional) */}
                {!isRetirada && (
                    <div className="space-y-2 animate-fade-in">
                        <input type="text" value={rua} onChange={e => setRua(e.target.value)} placeholder="Rua *" required={!isRetirada} className="flex-col sm:flex-row p-2 border rounded"/>
                        <div className="flex gap-2">
                            <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Nº *" required={!isRetirada} className="w-1/3 p-2 border rounded"/>
                            <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro *" required={!isRetirada} className="w-2/3 p-2 border rounded"/>
                        </div>
                        <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade *" required={!isRetirada} className="flex-col sm:flex-row p-2 border rounded"/>
                        <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Complemento / Ponto de referência" className="flex-col sm:flex-row p-2 border rounded"/>
                    </div>
                )}

                {/* Cupom */}
                <div className="flex gap-2 pt-2">
                    <input type="text" value={cupomInput} onChange={e => setCupomInput(e.target.value)} placeholder="Cupom de desconto" className="flex-col sm:flex-row p-2 border rounded"/>
                    <button type="button" onClick={() => onAplicarCupom(cupomInput)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Aplicar</button>
                </div>
                
                {/* Pagamento */}
                <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="flex-col sm:flex-row p-2 border rounded">
                    <option value="pix">PIX</option>
                    <option value="cartao">Cartão na Entrega</option>
                    <option value="dinheiro">Dinheiro</option>
                </select>
                {formaPagamento === 'dinheiro' && (
                    <input type="number" value={trocoPara} onChange={e => setTrocoPara(e.target.value)} placeholder="Troco para quanto?" className="flex-col sm:flex-row p-2 border rounded"/>
                )}

                {/* Botão Finalizar */}
                <button type="submit" disabled={isSubmitting || authLoading || !currentUser} className="flex-col sm:flex-row bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400">
                    {isSubmitting ? 'Enviando...' : 'Finalizar Pedido'}
                </button>
                 {!currentUser && <p className="text-red-500 text-center text-sm">Você precisa estar logado para finalizar o pedido.</p>}
            </form>
        </div>
    );
};

export default FormularioPedido;