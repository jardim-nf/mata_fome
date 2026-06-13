import { create } from 'zustand';

export const usePdvStore = create((set, get) => ({
  // --- CAIXA STATE ---
  caixaAberto: null,
  verificandoCaixa: true,
  mostrarFechamentoCaixa: false,
  mostrarMovimentacao: false,
  movimentacoesDoTurno: { totalSuprimento: 0, totalSangria: 0 },
  listaTurnos: [],
  carregandoHistorico: false,
  mostrarResumoTurno: false,
  turnoSelecionadoResumo: null,
  vendasBaseLocal: [],

  // --- CART STATE ---
  vendaAtual: null,
  vendasSuspensas: [],
  mostrarSuspensas: false,
  descontoValor: '',
  acrescimoValor: '',
  pagamentosAdicionados: [],
  produtoParaSelecao: null,
  itemParaEditar: null,
  produtoParaPeso: null,
  clienteSelecionado: null,
  produtoParaOpcoes: null,
  barcodeAviso: null,

  // --- ADDITIONAL UI STATE ---
  mostrarAberturaCaixa: false,
  vendasHistoricoExibicao: [],
  tituloHistorico: 'Histórico',
  mostrarListaTurnos: false,
  mostrarHistorico: false,
  mostrarFinalizacao: false,
  mostrarRecibo: false,
  dadosRecibo: null,

  // --- SETTERS & MUTATORS ---
  setCaixaAberto: (val) => set((state) => ({ caixaAberto: typeof val === 'function' ? val(state.caixaAberto) : val })),
  setVerificandoCaixa: (val) => set((state) => ({ verificandoCaixa: typeof val === 'function' ? val(state.verificandoCaixa) : val })),
  setMostrarFechamentoCaixa: (val) => set((state) => ({ mostrarFechamentoCaixa: typeof val === 'function' ? val(state.mostrarFechamentoCaixa) : val })),
  setMostrarMovimentacao: (val) => set((state) => ({ mostrarMovimentacao: typeof val === 'function' ? val(state.mostrarMovimentacao) : val })),
  setMovimentacoesDoTurno: (val) => set((state) => ({ movimentacoesDoTurno: typeof val === 'function' ? val(state.movimentacoesDoTurno) : val })),
  setListaTurnos: (val) => set((state) => ({ listaTurnos: typeof val === 'function' ? val(state.listaTurnos) : val })),
  setCarregandoHistorico: (val) => set((state) => ({ carregandoHistorico: typeof val === 'function' ? val(state.carregandoHistorico) : val })),
  setMostrarResumoTurno: (val) => set((state) => ({ mostrarResumoTurno: typeof val === 'function' ? val(state.mostrarResumoTurno) : val })),
  setTurnoSelecionadoResumo: (val) => set((state) => ({ turnoSelecionadoResumo: typeof val === 'function' ? val(state.turnoSelecionadoResumo) : val })),
  
  setMostrarAberturaCaixa: (val) => set((state) => ({ mostrarAberturaCaixa: typeof val === 'function' ? val(state.mostrarAberturaCaixa) : val })),
  setVendasHistoricoExibicao: (val) => set((state) => ({ vendasHistoricoExibicao: typeof val === 'function' ? val(state.vendasHistoricoExibicao) : val })),
  setTituloHistorico: (val) => set((state) => ({ tituloHistorico: typeof val === 'function' ? val(state.tituloHistorico) : val })),
  setMostrarListaTurnos: (val) => set((state) => ({ mostrarListaTurnos: typeof val === 'function' ? val(state.mostrarListaTurnos) : val })),
  setMostrarHistorico: (val) => set((state) => ({ mostrarHistorico: typeof val === 'function' ? val(state.mostrarHistorico) : val })),
  setMostrarFinalizacao: (val) => set((state) => ({ mostrarFinalizacao: typeof val === 'function' ? val(state.mostrarFinalizacao) : val })),
  setMostrarRecibo: (val) => set((state) => ({ mostrarRecibo: typeof val === 'function' ? val(state.mostrarRecibo) : val })),
  setDadosRecibo: (val) => set((state) => ({ dadosRecibo: typeof val === 'function' ? val(state.dadosRecibo) : val })),
  
  setVendasBaseLocal: (val) => set((state) => ({ vendasBaseLocal: typeof val === 'function' ? val(state.vendasBaseLocal) : val })),
  setVendaAtual: (val) => set((state) => ({ vendaAtual: typeof val === 'function' ? val(state.vendaAtual) : val })),
  setVendasSuspensas: (val) => set((state) => ({ vendasSuspensas: typeof val === 'function' ? val(state.vendasSuspensas) : val })),
  setMostrarSuspensas: (val) => set((state) => ({ mostrarSuspensas: typeof val === 'function' ? val(state.mostrarSuspensas) : val })),
  setDescontoValor: (val) => set((state) => ({ descontoValor: typeof val === 'function' ? val(state.descontoValor) : val })),
  setAcrescimoValor: (val) => set((state) => ({ acrescimoValor: typeof val === 'function' ? val(state.acrescimoValor) : val })),
  setPagamentosAdicionados: (val) => set((state) => ({ pagamentosAdicionados: typeof val === 'function' ? val(state.pagamentosAdicionados) : val })),
  
  setProdutoParaSelecao: (val) => set((state) => ({ produtoParaSelecao: typeof val === 'function' ? val(state.produtoParaSelecao) : val })),
  setItemParaEditar: (val) => set((state) => ({ itemParaEditar: typeof val === 'function' ? val(state.itemParaEditar) : val })),
  setProdutoParaPeso: (val) => set((state) => ({ produtoParaPeso: typeof val === 'function' ? val(state.produtoParaPeso) : val })),
  setClienteSelecionado: (val) => set((state) => ({ clienteSelecionado: typeof val === 'function' ? val(state.clienteSelecionado) : val })),
  setProdutoParaOpcoes: (val) => set((state) => ({ produtoParaOpcoes: typeof val === 'function' ? val(state.produtoParaOpcoes) : val })),
  setBarcodeAviso: (val) => set((state) => ({ barcodeAviso: typeof val === 'function' ? val(state.barcodeAviso) : val })),
}));
