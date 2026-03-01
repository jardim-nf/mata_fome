import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
// 🔥 Adicionei updateDoc, arrayUnion e increment
import { addDoc, collection, Timestamp, doc, updateDoc, arrayUnion, increment } from 'firebase/firestore'; 
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

// 🔥 Receba mesaId como prop (se vier null, é delivery/balcão)
const FormularioPedido = ({ carrinho, total, limparCarrinho, estabelecimentoId, onAplicarCupom, mesaId = null }) => {
    const { currentUser, currentClientData, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    // Se tiver mesaId, começa como false (não é entrega), senão começa true
    const [isRetirada, setIsRetirada] = useState(mesaId ? true : false);
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [complemento, setComplemento] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('pix');
    const [trocoPara, setTrocoPara] = useState('');
    const [cupomInput, setCupomInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
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

        // Se NÃO for mesa e NÃO for retirada, exige endereço
        if (!mesaId && !isRetirada && (!rua || !numero || !bairro || !cidade)) {
            toast.warn('Por favor, preencha o endereço de entrega completo.');
            return;
        }

        if (!estabelecimentoId) {
            toast.error("Erro: Estabelecimento não identificado.");
            return;
        }

        setIsSubmitting(true);

        try {
            // ---------------------------------------------------------
            // 🟢 CENÁRIO 1: É PEDIDO PARA MESA (Atualiza o Controle de Salão)
            // ---------------------------------------------------------
            if (mesaId) {
                const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
                
                // Prepara os itens para adicionar na mesa
                // Adicionamos status 'cozinha' para saber que acabaram de chegar
                const itensComStatus = carrinho.map(item => ({
                    ...item,
                    statusPedido: 'cozinha', 
                    dataPedido: Timestamp.now()
                }));

                await updateDoc(mesaRef, {
                    status: 'ocupada', // Garante que a mesa fique vermelha/ocupada
                    itens: arrayUnion(...itensComStatus), // Adiciona itens ao array existente
                    total: increment(total), // Soma ao total existente da mesa
                    updatedAt: Timestamp.now(),
                    // Opcional: Salvar nome do cliente na mesa se estiver vazia
                    ...(nome && { nomeClienteAtual: nome }) 
                });

                toast.success(`Pedidos enviados para a Mesa!`);
            } 
            
            // ---------------------------------------------------------
            // 🔵 CENÁRIO 2: É DELIVERY OU RETIRADA (Salva na lista de Pedidos)
            // ---------------------------------------------------------
            else {
                const pedido = {
                    clienteId: currentUser ? currentUser.uid : 'anonimo',
                    clienteNome: nome,
                    clienteTelefone: telefone,
                    endereco: isRetirada ? null : { rua, numero, bairro, cidade, complemento },
                    itens: carrinho,
                    total: total,
                    formaPagamento: formaPagamento, 
                    metodoPagamento: formaPagamento,
                    trocoPara: formaPagamento === 'dinheiro' ? trocoPara : '',
                    tipoEntrega: isRetirada ? 'retirada' : 'delivery',
                    status: 'recebido',
                    createdAt: Timestamp.now(), 
                    dataPedido: Timestamp.now(),
                    estabelecimentoId: estabelecimentoId,
                };

                const pedidosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos');
                await addDoc(pedidosRef, pedido);
                toast.success('🎉 Pedido Delivery enviado com sucesso!');
            }

            limparCarrinho();
            // Se for mesa, talvez redirecionar de volta para a mesa
            if(mesaId) {
                 // navigate(-1) ou para a página da mesa
            }
            
        } catch (error) {
            console.error("Erro ao finalizar pedido:", error);
            toast.error("Houve um erro ao enviar seu pedido.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 border rounded-lg shadow-lg bg-white">
            <h2 className="text-xl font-bold mb-4">
                {mesaId ? 'Confirmar Pedido na Mesa' : 'Seus Dados'}
            </h2>
            <form onSubmit={handleFinalizarPedido} className="space-y-4">
                
                {/* Se for MESA, talvez não precise pedir nome/telefone toda hora, 
                    mas mantivemos opcional ou preenchido */}
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome (Opcional)" className="w-full p-2 border rounded"/>
                
                {/* Só mostra campos de endereço se NÃO for mesa */}
                {!mesaId && (
                    <>
                        <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone *" required className="w-full p-2 border rounded"/>
                        
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="entrega" checked={!isRetirada} onChange={() => setIsRetirada(false)} /> 
                                Entrega
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="entrega" checked={isRetirada} onChange={() => setIsRetirada(true)} /> 
                                Retirada
                            </label>
                        </div>

                        {!isRetirada && (
                            <div className="space-y-2 animate-fade-in">
                                <input type="text" value={rua} onChange={e => setRua(e.target.value)} placeholder="Rua *" required={!isRetirada} className="w-full p-2 border rounded"/>
                                <div className="flex gap-2">
                                    <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Nº *" required={!isRetirada} className="w-1/3 p-2 border rounded"/>
                                    <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro *" required={!isRetirada} className="w-2/3 p-2 border rounded"/>
                                </div>
                                <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade *" required={!isRetirada} className="w-full p-2 border rounded"/>
                                <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Complemento" className="w-full p-2 border rounded"/>
                            </div>
                        )}
                    </>
                )}

                <div className="flex gap-2 pt-2">
                    <input type="text" value={cupomInput} onChange={e => setCupomInput(e.target.value)} placeholder="Cupom de desconto" className="w-full p-2 border rounded"/>
                    <button type="button" onClick={() => onAplicarCupom(cupomInput)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Aplicar</button>
                </div>
                
                {/* Se for mesa, geralmente pagase no final, mas se quiser deixar pré-definido: */}
                <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="w-full p-2 border rounded">
                    <option value="pix">PIX</option>
                    <option value="cartao">Cartão</option>
                    <option value="dinheiro">Dinheiro</option>
                    {mesaId && <option value="pagar_no_caixa">Pagar no Caixa (Ao sair)</option>}
                </select>

                {formaPagamento === 'dinheiro' && (
                    <input type="number" value={trocoPara} onChange={e => setTrocoPara(e.target.value)} placeholder="Troco para quanto?" className="w-full p-2 border rounded"/>
                )}

                <button type="submit" disabled={isSubmitting || (authLoading && !mesaId)} className="w-full bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400">
                    {isSubmitting ? 'Enviando...' : (mesaId ? 'Enviar para Cozinha' : 'Finalizar Pedido')}
                </button>
            </form>
        </div>
    );
};

export default FormularioPedido;