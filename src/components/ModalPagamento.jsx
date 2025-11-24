import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import './ModalPagamento.css';

const ModalPagamento = ({ mesa, estabelecimentoId, onClose, onSucesso }) => {
  const [etapa, setEtapa] = useState(1);
  const [pagamentos, setPagamentos] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);

  // ✅ DEBUG - Ver estrutura completa da mesa
  console.log('🔍 ESTRUTURA COMPLETA DA MESA:', mesa);
  console.log('📦 Propriedades da mesa:', mesa ? Object.keys(mesa) : 'Mesa vazia');
  console.log('🍽️ Itens da mesa:', mesa?.itens);
  console.log('💰 Total da mesa:', mesa?.total);

  // ✅ CORREÇÃO: Usar mesa.itens em vez de mesa.pedidos
  const calcularTotalPedidos = (itens) => {
    console.log('📋 Itens recebidos para cálculo:', itens);
    
    if (!itens || itens.length === 0) {
      console.log('⚠️ Nenhum item encontrado na mesa!');
      return 0;
    }
    
    const total = itens.reduce((total, item) => {
      return total + (item.preco * item.quantidade);
    }, 0);
    
    console.log('💰 Total calculado:', total);
    return total;
  };

  // Inicializar pagamentos com os dados da mesa
  useEffect(() => {
    if (mesa && mesa.itens) {
      const total = calcularTotalPedidos(mesa.itens);
      const pessoas = mesa.clientes || ['Cliente 1'];
      
      const pagamentosIniciais = {};
      pessoas.forEach(pessoa => {
        pagamentosIniciais[pessoa] = {
          valor: total / pessoas.length,
          formaPagamento: 'dinheiro',
          status: 'pendente'
        };
      });
      
      // Adicionar opção "Mesa" para pagamento único
      pagamentosIniciais['Mesa'] = {
        valor: total,
        formaPagamento: 'dinheiro',
        status: 'pendente'
      };
      
      setPagamentos(pagamentosIniciais);
    }
  }, [mesa]);

// ✅ CORREÇÃO - Calcular apenas pagamentos individuais OU mesa, nunca ambos
const calcularTotalPagamentos = () => {
  console.log('📊 Calculando total dos pagamentos:', pagamentos);
  
  // Verifica se existe pagamento da mesa
  const pagamentoMesa = pagamentos['Mesa'];
  
  if (pagamentoMesa && pagamentoMesa.valor > 0) {
    // ✅ MODO PAGAMENTO ÚNICO - usa apenas o valor da mesa
    console.log('💳 Modo Pagamento Único - Valor:', pagamentoMesa.valor);
    return pagamentoMesa.valor;
  } else {
    // ✅ MODO DIVISÃO INDIVIDUAL - soma apenas os clientes
    const totalIndividual = Object.entries(pagamentos).reduce((total, [pessoa, dados]) => {
      // Ignora a "Mesa" e soma apenas clientes reais
      if (pessoa !== 'Mesa') {
        return total + dados.valor;
      }
      return total;
    }, 0);
    
    console.log('👥 Modo Divisão Individual - Valor:', totalIndividual);
    return totalIndividual;
  }
};
  // ✅ FUNÇÃO PARA EDITAR FORMA DE PAGAMENTO
  const editarFormaPagamento = (pessoaId, novaForma) => {
    setPagamentos(prev => ({
      ...prev,
      [pessoaId]: {
        ...prev[pessoaId],
        formaPagamento: novaForma
      }
    }));
  };

  // ✅ FUNÇÃO PARA EDITAR VALOR
  const editarValorPagamento = (pessoaId, novoValor) => {
    setPagamentos(prev => ({
      ...prev,
      [pessoaId]: {
        ...prev[pessoaId],
        valor: parseFloat(novoValor) || 0
      }
    }));
  };

  // ✅ FUNÇÃO PARA REDISTRIBUIR VALORES IGUALMENTE
  const redistribuirValores = () => {
    const total = calcularTotalPedidos(mesa.itens);
    const pessoas = Object.keys(pagamentos).filter(key => key !== 'Mesa');
    const valorPorPessoa = total / pessoas.length;
    
    setPagamentos(prev => {
      const novosPagamentos = { ...prev };
      pessoas.forEach(pessoa => {
        novosPagamentos[pessoa] = {
          ...novosPagamentos[pessoa],
          valor: valorPorPessoa
        };
      });
      novosPagamentos['Mesa'] = {
        ...novosPagamentos['Mesa'],
        valor: total
      };
      return novosPagamentos;
    });
  };

  // ✅ FUNÇÃO PARA ADICIONAR NOVA PESSOA
  const adicionarPessoa = () => {
    const novaPessoa = `Cliente ${Object.keys(pagamentos).length}`;
    setPagamentos(prev => ({
      ...prev,
      [novaPessoa]: {
        valor: 0,
        formaPagamento: 'dinheiro',
        status: 'pendente'
      }
    }));
  };

  // ✅ FUNÇÃO PARA REMOVER PESSOA
  const removerPessoa = (pessoaId) => {
    if (Object.keys(pagamentos).length <= 2) {
      alert('É necessário ter pelo menos uma pessoa para pagar!');
      return;
    }
    
    setPagamentos(prev => {
      const novosPagamentos = { ...prev };
      delete novosPagamentos[pessoaId];
      return novosPagamentos;
    });
  };

  // ✅ FUNÇÃO PARA FINALIZAR PAGAMENTO
  const finalizarPagamento = async () => {
    setCarregando(true);
    
    try {
      console.log('🔍 DEBUG - Iniciando pagamento...');
      console.log('👤 Usuário logado:', auth.currentUser);
      console.log('📁 Estabelecimento ID:', estabelecimentoId);
      console.log('💳 Dados pagamentos:', pagamentos);

      const dadosVenda = {
        mesaId: mesa.id,
        mesaNumero: mesa.numero,
        estabelecimentoId: estabelecimentoId,
        itens: mesa.itens,
        pagamentos: pagamentos,
        total: calcularTotalPedidos(mesa.itens),
        status: 'pago',
        criadoEm: new Date(),
        criadoPor: auth.currentUser.uid,
        funcionario: auth.currentUser.displayName || 'Garçom'
      };

      console.log('💾 Tentando salvar venda...');

      const docRef = await addDoc(
        collection(db, `estabelecimentos/${estabelecimentoId}/vendas`), 
        dadosVenda
      );

      console.log('✅ Venda salva com ID:', docRef.id);

      if (mesa.id) {
        await updateDoc(doc(db, `estabelecimentos/${estabelecimentoId}/mesas/${mesa.id}`), {
          status: 'livre',
          clientes: [],
          itens: [],
          total: 0,
          ultimaAtualizacao: new Date()
        });
      }

      console.log('✅ Mesa liberada com sucesso!');
      
      if (onSucesso) {
        onSucesso({
          vendaId: docRef.id,
          total: dadosVenda.total,
          mesa: mesa.numero
        });
      }
      
      onClose();

    } catch (error) {
      console.error('❌ ERRO ao processar pagamento:', error);
      console.error('📋 Detalhes:', error.message, error.code);
      alert('Erro ao processar pagamento: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  // Renderizar etapa 1 - Seleção de pessoas
  const renderizarEtapa1 = () => (
    <div className="etapa">
      <h3>👥 Divisão da Conta</h3>
      <p>Selecione como a conta será dividida:</p>
      
      <div className="opcoes-divisao">
        <button 
          className="opcao-grande"
          onClick={() => {
            console.log('🎯 Clicou em Pagamento Único');
            const total = calcularTotalPedidos(mesa.itens);
            setPagamentos({
              'Mesa': {
                valor: total,
                formaPagamento: 'dinheiro',
                status: 'pendente'
              }
            });
            setEtapa(2);
          }}
        >
          <strong>💳 Pagamento Único</strong>
          <span>Uma pessoa paga toda a conta</span>
        </button>
        
        <button 
          className="opcao-grande"
          onClick={() => {
            console.log('🎯 Clicou em Divisão Igual');
            const total = calcularTotalPedidos(mesa.itens);
            const pessoas = ['Cliente 1', 'Cliente 2'];
            const valorPorPessoa = total / pessoas.length;
            
            const novosPagamentos = {};
            pessoas.forEach(pessoa => {
              novosPagamentos[pessoa] = {
                valor: valorPorPessoa,
                formaPagamento: 'dinheiro',
                status: 'pendente'
              };
            });
            
            novosPagamentos['Mesa'] = {
              valor: total,
              formaPagamento: 'dinheiro',
              status: 'pendente'
            };
            
            setPagamentos(novosPagamentos);
            setEtapa(2);
          }}
        >
          <strong>🔢 Divisão Igual</strong>
          <span>Valor dividido igualmente</span>
        </button>
      </div>
    </div>
  );

  // Renderizar etapa 2 - Formas de pagamento
  const renderizarEtapa2 = () => (
    <div className="etapa">
      <h3>💳 Formas de Pagamento</h3>
      <p>Defina como cada pessoa irá pagar:</p>
      
      <div className="lista-pagamentos">
        {Object.entries(pagamentos).map(([pessoa, dados]) => (
          <div key={pessoa} className="item-pagamento">
            <div className="info-pessoa">
              <strong>{pessoa}</strong>
              <span>R$ {dados.valor.toFixed(2)}</span>
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
                  {forma}
                </button>
              ))}
            </div>
            
            {pessoa !== 'Mesa' && (
              <button 
                className="btn-remover"
                onClick={() => removerPessoa(pessoa)}
              >
                ❌
              </button>
            )}
          </div>
        ))}
      </div>
      
      <button className="btn-adicionar" onClick={adicionarPessoa}>
        ➕ Adicionar Pessoa
      </button>
      
      <div className="botoes-navegacao">
        <button onClick={() => setEtapa(1)}>⬅️ Voltar</button>
        <button onClick={() => setEtapa(3)}>Continuar ➡️</button>
      </div>
    </div>
  );

  // Renderizar etapa 3 - Confirmação e edição
  const renderizarEtapa3 = () => (
    <div className="etapa">
      <h3>✅ Confirmar Pagamentos</h3>
      
      <div className="resumo-pagamento">
        <div className="total-geral">
          <strong>Total da Mesa: R$ {calcularTotalPedidos(mesa.itens).toFixed(2)}</strong>
          <span>Total dos Pagamentos: R$ {calcularTotalPagamentos().toFixed(2)}</span>
        </div>
        
        {modoEdicao ? (
          <div className="modo-edicao">
            <h4>✏️ Editando Pagamentos</h4>
            
            {Object.entries(pagamentos).map(([pessoa, dados]) => (
              <div key={pessoa} className="item-edicao">
                <div className="info-edicao">
                  <strong>{pessoa}</strong>
                  
                  <div className="controles-edicao">
                    <input 
                      type="number"
                      value={dados.valor}
                      onChange={(e) => editarValorPagamento(pessoa, e.target.value)}
                      step="0.01"
                      min="0"
                    />
                    
                    <select 
                      value={dados.formaPagamento}
                      onChange={(e) => editarFormaPagamento(pessoa, e.target.value)}
                    >
                      <option value="dinheiro">💵 Dinheiro</option>
                      <option value="credito">💳 Crédito</option>
                      <option value="debito">🏦 Débito</option>
                      <option value="pix">📱 PIX</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="botoes-edicao">
              <button onClick={redistribuirValores}>
                🔄 Dividir Igualmente
              </button>
              <button onClick={() => setModoEdicao(false)}>
                ✅ Concluir Edição
              </button>
            </div>
          </div>
        ) : (
          <div className="lista-confirmacao">
            {Object.entries(pagamentos).map(([pessoa, dados]) => (
              <div key={pessoa} className="item-confirmacao">
                <div className="info-confirmacao">
                  <span className="pessoa">{pessoa}</span>
                  <span className="valor">R$ {dados.valor.toFixed(2)}</span>
                  <span className="forma">
                    {dados.formaPagamento === 'dinheiro' && '💵 Dinheiro'}
                    {dados.formaPagamento === 'credito' && '💳 Crédito'}
                    {dados.formaPagamento === 'debito' && '🏦 Débito'}
                    {dados.formaPagamento === 'pix' && '📱 PIX'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="botoes-acao">
        {!modoEdicao && (
          <button 
            className="btn-editar"
            onClick={() => setModoEdicao(true)}
          >
            ✏️ Editar Pagamentos
          </button>
        )}
        
        <button 
          className="btn-finalizar"
          onClick={finalizarPagamento}
          disabled={carregando || calcularTotalPagamentos() !== calcularTotalPedidos(mesa.itens)}
        >
          {carregando ? '💾 Processando...' : '✅ Finalizar Pagamento'}
        </button>
        
        <button onClick={() => setEtapa(2)}>
          ⬅️ Voltar
        </button>
      </div>
      
      {calcularTotalPagamentos() !== calcularTotalPedidos(mesa.itens) && (
        <div className="aviso">
          ⚠️ O total dos pagamentos (R$ {calcularTotalPagamentos().toFixed(2)}) 
          não confere com o total da mesa (R$ {calcularTotalPedidos(mesa.itens).toFixed(2)})
        </div>
      )}
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-pagamento">
        <div className="modal-header">
          <h2>💳 Pagamento - Mesa {mesa?.numero}</h2>
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