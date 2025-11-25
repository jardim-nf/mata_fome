import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import './ModalPagamento.css';
import { IoReceiptOutline, IoFastFoodOutline } from 'react-icons/io5';

const ModalPagamento = ({ mesa, estabelecimentoId, onClose, onSucesso }) => {
  const [etapa, setEtapa] = useState(1);
  const [pagamentos, setPagamentos] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);

  // Helper para calcular total de uma lista de itens
  const calcularTotalItens = (itens) => {
    if (!itens || itens.length === 0) return 0;
    return itens.reduce((total, item) => total + (item.preco * item.quantidade), 0);
  };

  // ✅ 1. LÓGICA INTELIGENTE DE INICIALIZAÇÃO
  // Agrupa os itens por pessoa e calcula o valor exato de cada um
  useEffect(() => {
    if (mesa && mesa.itens) {
      const pagamentosIniciais = {};
      
      // Itera sobre cada item do pedido
      mesa.itens.forEach(item => {
        // Identifica o dono (se não tiver, vai para "Mesa/Geral")
        // IMPORTANTE: Normaliza o nome para evitar duplicatas (trim)
        const dono = item.destinatario || item.clienteNome || 'Mesa';
        
        if (!pagamentosIniciais[dono]) {
          pagamentosIniciais[dono] = {
            valor: 0,
            formaPagamento: 'dinheiro',
            status: 'pendente',
            itens: [] // Guardamos os itens para exibir na tela
          };
        }

        // Soma o valor deste item para este dono
        pagamentosIniciais[dono].valor += (item.preco * item.quantidade);
        pagamentosIniciais[dono].itens.push(item);
      });

      // Se por acaso a mesa estiver vazia (sem itens), cria um padrão
      if (Object.keys(pagamentosIniciais).length === 0) {
        pagamentosIniciais['Cliente 1'] = { valor: 0, formaPagamento: 'dinheiro', status: 'pendente', itens: [] };
      }

      setPagamentos(pagamentosIniciais);
    }
  }, [mesa]);

  // Calcula quanto já foi distribuído nos pagamentos
  const calcularTotalPagamentos = () => {
    return Object.values(pagamentos).reduce((total, dados) => total + dados.valor, 0);
  };

  const calcularTotalMesa = () => {
    return calcularTotalItens(mesa.itens);
  };

  // Funções de Edição
  const editarFormaPagamento = (pessoaId, novaForma) => {
    setPagamentos(prev => ({
      ...prev,
      [pessoaId]: { ...prev[pessoaId], formaPagamento: novaForma }
    }));
  };

  const editarValorPagamento = (pessoaId, novoValor) => {
    setPagamentos(prev => ({
      ...prev,
      [pessoaId]: { ...prev[pessoaId], valor: parseFloat(novoValor) || 0 }
    }));
  };

  const adicionarPessoa = () => {
    const novaPessoa = `Cliente ${Object.keys(pagamentos).length + 1}`;
    setPagamentos(prev => ({
      ...prev,
      [novaPessoa]: { valor: 0, formaPagamento: 'dinheiro', status: 'pendente', itens: [] }
    }));
  };

  const removerPessoa = (pessoaId) => {
    if (Object.keys(pagamentos).length <= 1) {
      alert('Precisa ter pelo menos um pagante.');
      return;
    }
    setPagamentos(prev => {
      const novos = { ...prev };
      delete novos[pessoaId];
      return novos;
    });
  };

  // Funções de Redistribuição (Úteis se o cliente quiser mudar a lógica na hora)
  const dividirIgualmente = () => {
    const total = calcularTotalMesa();
    const pessoas = Object.keys(pagamentos);
    const valorPorPessoa = total / pessoas.length;
    
    setPagamentos(prev => {
      const novos = { ...prev };
      pessoas.forEach(p => {
        novos[p].valor = valorPorPessoa;
        // Mantém os itens visuais, mas o valor muda
      });
      return novos;
    });
  };

  const pagarTudoUmCliente = () => {
    const total = calcularTotalMesa();
    const nomes = Object.keys(pagamentos);
    const pagante = nomes[0]; // Pega o primeiro

    setPagamentos({
      [pagante]: {
        valor: total,
        formaPagamento: 'dinheiro',
        status: 'pendente',
        itens: mesa.itens // Atribui todos os itens visualmente a ele
      }
    });
  };

  // Finalizar Pagamento
  const finalizarPagamento = async () => {
    setCarregando(true);
    try {
      // Verifica divergência de valores
      const totalPago = calcularTotalPagamentos();
      const totalMesa = calcularTotalMesa();
      
      // Aceita uma margem de erro de 10 centavos para arredondamentos
      if (Math.abs(totalPago - totalMesa) > 0.10) {
        if(!window.confirm(`O valor total (R$ ${totalPago.toFixed(2)}) é diferente do total da mesa (R$ ${totalMesa.toFixed(2)}). Deseja fechar mesmo assim?`)) {
            setCarregando(false);
            return;
        }
      }

      const dadosVenda = {
        mesaId: mesa.id,
        mesaNumero: mesa.numero,
        estabelecimentoId: estabelecimentoId,
        itens: mesa.itens,
        pagamentos: pagamentos,
        total: totalMesa,
        status: 'pago',
        criadoEm: new Date(),
        criadoPor: auth.currentUser?.uid,
        funcionario: auth.currentUser?.displayName || 'Garçom'
      };

      const docRef = await addDoc(collection(db, `estabelecimentos/${estabelecimentoId}/vendas`), dadosVenda);

      // Limpa a mesa
      if (mesa.id) {
        await updateDoc(doc(db, `estabelecimentos/${estabelecimentoId}/mesas/${mesa.id}`), {
          status: 'livre',
          clientes: [],
          nomesOcupantes: ["Mesa"], // Reseta nomes
          itens: [],
          total: 0,
          pagamentos: {},
          ultimaAtualizacao: new Date()
        });
      }

      if (onSucesso) onSucesso({ vendaId: docRef.id });
      onClose();

    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao processar: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  // --- RENDERIZADORES ---

  const renderizarEtapa1 = () => (
    <div className="etapa">
      <h3>👥 Conferência de Valores</h3>
      <p>O sistema calculou o valor individual baseado no que cada um pediu.</p>
      
      <div className="opcoes-divisao">
        {/* Opção Padrão: Cada um paga o seu */}
        <button className="opcao-grande destaque" onClick={() => setEtapa(2)}>
          <strong>🧾 Cobrar por Consumo</strong>
          <span>Seguir o pedido de cada um</span>
        </button>
        
        {/* Opções Extras de Divisão */}
        <div className="botoes-extras-divisao">
            <button className="btn-secundario" onClick={() => { dividirIgualmente(); setEtapa(2); }}>
                🔢 Dividir Igualmente
            </button>
            <button className="btn-secundario" onClick={() => { pagarTudoUmCliente(); setEtapa(2); }}>
                👤 Um Pagante (Total)
            </button>
        </div>
      </div>
    </div>
  );

  const renderizarEtapa2 = () => (
    <div className="etapa">
      <h3>💳 Formas de Pagamento</h3>
      <p>Defina como cada pessoa irá pagar:</p>
      
      <div className="lista-pagamentos custom-scrollbar">
        {Object.entries(pagamentos).map(([pessoa, dados]) => (
          <div key={pessoa} className="item-pagamento">
            
            <div className="info-topo">
                <div className="info-pessoa">
                <strong>{pessoa}</strong>
                {/* 🔴 AQUI ESTÁ A LISTA DE ITENS EMBAIXO DO NOME */}
                {dados.itens && dados.itens.length > 0 ? (
                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-1">
                        {dados.itens.map((item, idx) => (
                            <span key={idx} className="bg-gray-100 px-1.5 rounded">
                                {item.quantidade}x {item.nome}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-xs text-gray-400 italic">Sem itens registrados</span>
                )}
                </div>
                <div className="valor-pessoa">
                    R$ {dados.valor.toFixed(2)}
                </div>
            </div>
            
            <div className="formas-pagamento">
              {['dinheiro', 'credito', 'debito', 'pix'].map(forma => (
                <button
                  key={forma}
                  className={`forma-btn ${dados.formaPagamento === forma ? 'ativa' : ''}`}
                  onClick={() => editarFormaPagamento(pessoa, forma)}
                >
                  {forma === 'dinheiro' && '💵'}
                  {forma === 'credito' && '💳'}
                  {forma === 'debito' && '🏦'}
                  {forma === 'pix' && '📱'}
                  <span className="ml-1 capitalize">{forma}</span>
                </button>
              ))}
            </div>
            
            {/* Remove apenas se tiver mais de 1 pessoa na lista */}
            {Object.keys(pagamentos).length > 1 && (
                <button className="btn-remover-texto" onClick={() => removerPessoa(pessoa)}>
                    Remover Pagante
                </button>
            )}
          </div>
        ))}
      </div>
      
      <button className="btn-adicionar" onClick={adicionarPessoa}>
        ➕ Adicionar Outro Pagante
      </button>
      
      <div className="botoes-navegacao">
        <button onClick={() => setEtapa(1)}>⬅️ Voltar</button>
        <button onClick={() => setEtapa(3)}>Continuar ➡️</button>
      </div>
    </div>
  );

  const renderizarEtapa3 = () => {
      const totalMesa = calcularTotalMesa();
      const totalPagamentos = calcularTotalPagamentos();
      const diferenca = totalPagamentos - totalMesa;
      const batendo = Math.abs(diferenca) < 0.10;

      return (
        <div className="etapa">
        <h3>✅ Confirmar e Finalizar</h3>
        
        <div className="resumo-pagamento">
            <div className="total-linha">
                <span>Total da Mesa:</span>
                <strong>R$ {totalMesa.toFixed(2)}</strong>
            </div>
            <div className="total-linha">
                <span>Total Recebido:</span>
                <strong style={{ color: batendo ? '#16a34a' : '#dc2626' }}>
                    R$ {totalPagamentos.toFixed(2)}
                </strong>
            </div>
            
            {!batendo && (
                <div className="aviso-erro">
                    {diferenca > 0 
                        ? `Sobrando R$ ${diferenca.toFixed(2)}` 
                        : `Faltando R$ ${Math.abs(diferenca).toFixed(2)}`
                    }
                </div>
            )}

            {modoEdicao ? (
                 <div className="modo-edicao">
                    {Object.entries(pagamentos).map(([pessoa, dados]) => (
                    <div key={pessoa} className="item-edicao">
                        <strong>{pessoa}</strong>
                        <input 
                            type="number" 
                            value={dados.valor} 
                            onChange={(e) => editarValorPagamento(pessoa, e.target.value)}
                        />
                    </div>
                    ))}
                    <button onClick={() => setModoEdicao(false)} className="btn-ok">Concluir Edição</button>
                </div>
            ) : (
                <div className="lista-confirmacao custom-scrollbar">
                    {Object.entries(pagamentos).map(([pessoa, dados]) => (
                    <div key={pessoa} className="item-confirmacao">
                        <div className="flex flex-col">
                            <span className="font-bold">{pessoa}</span>
                            <span className="text-xs text-gray-500">{dados.formaPagamento}</span>
                        </div>
                        <strong>R$ {dados.valor.toFixed(2)}</strong>
                    </div>
                    ))}
                </div>
            )}
        </div>
        
        <div className="botoes-acao">
            <button className="btn-editar" onClick={() => setModoEdicao(!modoEdicao)}>
                {modoEdicao ? 'Cancelar Edição' : '✏️ Ajustar Valores'}
            </button>
            
            <button 
                className={`btn-finalizar ${!batendo && !modoEdicao ? 'btn-aviso' : ''}`}
                onClick={finalizarPagamento}
                disabled={carregando}
            >
                {carregando ? 'Processando...' : batendo ? '✅ Finalizar Mesa' : '⚠️ Finalizar com Diferença'}
            </button>

            <button onClick={() => setEtapa(2)} className="btn-voltar-simples">Voltar</button>
        </div>
        </div>
      );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-pagamento">
        <div className="modal-header">
          <h2>Pagamento - Mesa {mesa?.numero}</h2>
          <button className="btn-fechar" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {etapa === 1 && renderizarEtapa1()}
          {etapa === 2 && renderizarEtapa2()}
          {etapa === 3 && renderizarEtapa3()}
        </div>
      </div>
    </div>
  );
};

export default ModalPagamento;