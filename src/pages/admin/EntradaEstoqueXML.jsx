import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEntradaEstoqueXMLData } from '../../hooks/useEntradaEstoqueXMLData';
import {
    IoCloudUploadOutline, IoDocumentTextOutline, IoBusinessOutline,
    IoCartOutline, IoCheckmarkCircleOutline, IoAlertCircleOutline,
    IoTrashOutline, IoSaveOutline, IoCloseOutline, IoSearchOutline,
    IoAddCircleOutline, IoPricetagOutline, IoCubeOutline,
    IoWalletOutline, IoCalendarOutline, IoReceiptOutline, IoRefreshOutline
} from 'react-icons/io5';
import ModalVinculo from '../../components/estoque/ModalVinculo';
import ModalNovoProduto from '../../components/estoque/ModalNovoProduto';
import BackButton from '../../components/BackButton';

const EntradaEstoqueXML = () => {
    const { estabelecimentoIdPrincipal } = useAuth();
    const xmlData = useEntradaEstoqueXMLData(estabelecimentoIdPrincipal);

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <header>
                    <BackButton className="mb-6" />
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <IoCloudUploadOutline className="text-blue-600" /> Entrada de Estoque via XML
                    </h1>
                    <p className="text-gray-500">Importe notas — atualiza estoque, custo, NCM, preço e gera contas a pagar.</p>
                </header>

                {/* ── TELA DE UPLOAD / HISTÓRICO ── */}
                {!xmlData.notaLida && (
                    <>
                        <div className="flex gap-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-1 w-fit">
                            <button onClick={() => xmlData.setAbaAtiva('importar')}
                                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${xmlData.abaAtiva === 'importar' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                                📥 Importar Nota
                            </button>
                            <button onClick={() => { xmlData.setAbaAtiva('historico'); xmlData.buscarHistorico(); }}
                                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${xmlData.abaAtiva === 'historico' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                                📋 Histórico ({xmlData.historico.length})
                            </button>
                        </div>

                        {xmlData.abaAtiva === 'importar' && (
                            <div className="bg-white border-4 border-dashed border-gray-200 rounded-[2.5rem] p-12 text-center hover:border-blue-400 transition-all group">
                                <input type="file" id="fileInput" accept=".xml" onChange={xmlData.handleFileUpload} className="hidden" />
                                <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center">
                                    <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <IoDocumentTextOutline size={48} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Arraste seu arquivo XML aqui</h2>
                                    <p className="text-gray-400 mb-8">Ou clique para buscar no seu computador</p>
                                    <span className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
                                        Selecionar Arquivo
                                    </span>
                                </label>
                            </div>
                        )}

                        {xmlData.abaAtiva === 'historico' && (
                            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <IoReceiptOutline className="text-blue-600" /> Notas Importadas
                                    </h3>
                                    <button onClick={xmlData.buscarHistorico}
                                        className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">
                                        <IoRefreshOutline /> Atualizar
                                    </button>
                                </div>

                                {xmlData.loadingHistorico ? (
                                    <div className="p-12 text-center text-gray-400">Carregando...</div>
                                ) : xmlData.historico.length === 0 ? (
                                    <div className="p-12 text-center text-gray-400">
                                        <IoReceiptOutline size={48} className="mx-auto mb-3 opacity-30" />
                                        <p>Nenhuma nota importada ainda.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {xmlData.historico.map(nota => (
                                            <div key={nota.id}>
                                                <div className="p-5 hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => xmlData.buscarParcelasNota(nota.numeroNota)} >
                                                    <div className="flex flex-wrap justify-between items-start gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold font-mono">
                                                                    NF {nota.numeroNota}
                                                                </span>
                                                                <span className="text-xs text-gray-400">
                                                                    {nota.dataEntrada?.toDate ? nota.dataEntrada.toDate().toLocaleDateString('pt-BR') : '—'}
                                                                </span>
                                                                {nota.pagamento?.parcelas > 1 && (
                                                                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                                                                        {nota.pagamento.parcelas}x {nota.pagamento.metodo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="font-bold text-gray-800">{nota.fornecedorNome}</p>
                                                            <p className="text-xs text-gray-500 font-mono">CNPJ: {nota.fornecedorCnpj}</p>
                                                        </div>
                                                        <div className="text-right flex items-start gap-3">
                                                            <div>
                                                                <p className="text-lg font-black text-gray-900">
                                                                    {Number(nota.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </p>
                                                                <p className="text-xs text-gray-500">{nota.itens?.length || 0} itens</p>
                                                            </div>
                                                            <div className={`p-2 rounded-xl transition-transform duration-300 ${xmlData.notaExpandida === nota.numeroNota ? 'rotate-180 bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <path d="M6 9l6 6 6-6" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap gap-1">
                                                        {nota.itens?.slice(0, 5).map((item, i) => (
                                                            <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                {item.vinculoNome || item.nomeXML}
                                                            </span>
                                                        ))}
                                                        {(nota.itens?.length || 0) > 5 && (
                                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                                                +{nota.itens.length - 5} mais
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* PARCELAS EXPANDIDAS */}
                                                {xmlData.notaExpandida === nota.numeroNota && (
                                                    <div className="bg-indigo-50/50 border-t border-indigo-100 px-5 pb-5 pt-4">
                                                        <p className="text-xs font-bold text-indigo-700 uppercase mb-3 flex items-center gap-2">
                                                            <IoWalletOutline /> Parcelas / Contas a Pagar
                                                        </p>

                                                        {xmlData.loadingParcelas ? (
                                                            <div className="text-center py-4 text-gray-400 text-sm">Carregando parcelas...</div>
                                                        ) : xmlData.parcelasNota.length === 0 ? (
                                                            <div className="text-center py-4 text-gray-400 text-sm">
                                                                Nenhuma parcela encontrada para esta nota.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {xmlData.parcelasNota.map(parcela => {
                                                                    const venc = new Date(parcela.vencimento + 'T12:00:00');
                                                                    const hoje = new Date();
                                                                    const vencida = parcela.status === 'pendente' && venc < hoje;

                                                                    return (
                                                                        <div key={parcela.id} className={`flex items-center justify-between bg-white rounded-2xl px-4 py-3 border shadow-sm ${parcela.status === 'pago' ? 'border-emerald-100' : vencida ? 'border-red-200' : 'border-indigo-100'}`}>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg min-w-[40px] text-center">
                                                                                    {parcela.parcela}/{parcela.totalParcelas}
                                                                                </span>
                                                                                <div>
                                                                                    <p className="text-sm font-bold text-gray-800">
                                                                                        {parcela.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                                    </p>
                                                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                                                        <IoCalendarOutline size={11} />
                                                                                        Vence: {venc.toLocaleDateString('pt-BR')}
                                                                                        {vencida && <span className="text-red-500 font-bold ml-1">⚠️ Vencida</span>}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="text-xs font-bold capitalize text-gray-500">
                                                                                    {parcela.metodo}
                                                                                </span>
                                                                                <button onClick={(e) => xmlData.alternarStatusParcela(e, parcela)}
                                                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${parcela.status === 'pago' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : vencida ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                                                                    {parcela.status === 'pago' ? '✅ Pago' : vencida ? '🔴 Vencida' : '⏳ Pendente'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                                <div className="flex justify-between items-center pt-2 px-1">
                                                                    <span className="text-xs text-gray-500">
                                                                        {xmlData.parcelasNota.filter(p => p.status === 'pago').length} de {xmlData.parcelasNota.length} pagas
                                                                    </span>
                                                                    <span className="text-xs font-bold text-gray-700">
                                                                        Restante: {xmlData.parcelasNota.filter(p => p.status !== 'pago').reduce((acc, p) => acc + (p.valor || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ── TELA DE PROCESSAMENTO DA NOTA ── */}
                {xmlData.notaLida && (
                    <>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-3">
                                <IoPricetagOutline className="text-blue-600 text-xl" />
                                <span className="font-bold text-gray-700">Margem de lucro padrão:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="number" min="0" max="1000" value={xmlData.margemPadrao} onChange={e => xmlData.setMargemPadrao(Number(e.target.value))}
                                    className="w-24 p-2 border border-blue-200 bg-blue-50 rounded-xl text-center font-bold text-blue-700 outline-none" />
                                <span className="font-bold text-gray-500">%</span>
                            </div>
                            <p className="text-xs text-gray-400">Recalcula o preço de venda sugerido de todos os produtos.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-blue-600 mb-2">
                                    <IoDocumentTextOutline size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Dados da Nota</span>
                                </div>
                                <p className="text-xl font-bold text-gray-800">Nº {xmlData.notaLida.numero}</p>
                                <p className="text-sm text-gray-500">Série: {xmlData.notaLida.serie} • Emissão: {new Date(xmlData.notaLida.dataEmissao).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 text-emerald-600">
                                        <IoBusinessOutline size={20} />
                                        <span className="text-xs font-black uppercase tracking-widest">Fornecedor</span>
                                    </div>
                                    {xmlData.fornecedorSalvo ? (
                                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">✅ Cadastrado</span>
                                    ) : (
                                        <button onClick={() => xmlData.setMostrarFormFornecedor(true)}
                                            className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold hover:bg-blue-100">
                                            + Salvar
                                        </button>
                                    )}
                                </div>
                                <p className="text-lg font-bold text-gray-800 truncate">{xmlData.notaLida.fornecedor.nome}</p>
                                <p className="text-sm text-gray-500">CNPJ: {xmlData.notaLida.fornecedor.cnpj}</p>
                                {xmlData.fornecedorSalvo && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        {xmlData.fornecedorSalvo.prazo}d • {xmlData.fornecedorSalvo.condicao} • {xmlData.fornecedorSalvo.telefone}
                                    </p>
                                )}
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-purple-600 mb-2">
                                    <IoCartOutline size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Valor Total</span>
                                </div>
                                <p className="text-2xl font-black text-gray-900">
                                    {xmlData.notaLida.totalNota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                <p className="text-sm text-gray-500">{xmlData.notaLida.produtos.length} itens</p>
                            </div>
                        </div>

                        {xmlData.mostrarFormFornecedor && (
                            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <IoBusinessOutline className="text-blue-600" /> Cadastrar Fornecedor
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[
                                        { label: 'Nome *', key: 'nome', placeholder: 'Razão social' },
                                        { label: 'CNPJ', key: 'cnpj', placeholder: '00.000.000/0000-00' },
                                        { label: 'Telefone', key: 'telefone', placeholder: '(11) 99999-9999' },
                                        { label: 'E-mail', key: 'email', placeholder: 'contato@fornecedor.com' },
                                        { label: 'Contato (nome)', key: 'contato', placeholder: 'Nome do vendedor' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">{f.label}</label>
                                            <input value={xmlData.formFornecedor[f.key]} onChange={e => xmlData.setFormFornecedor(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                placeholder={f.placeholder} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Prazo (dias)</label>
                                        <input type="number" value={xmlData.formFornecedor.prazo} onChange={e => xmlData.setFormFornecedor(prev => ({ ...prev, prazo: e.target.value }))}
                                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Condição</label>
                                        <select value={xmlData.formFornecedor.condicao} onChange={e => xmlData.setFormFornecedor(prev => ({ ...prev, condicao: e.target.value }))}
                                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm">
                                            {['boleto', 'pix', 'cartao', 'cheque', 'dinheiro'].map(c => ( <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option> ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-4">
                                    <button onClick={() => xmlData.setMostrarFormFornecedor(false)} className="px-5 py-2 rounded-xl border text-gray-600 font-bold text-sm hover:bg-gray-50">Cancelar</button>
                                    <button onClick={xmlData.salvarFornecedor} disabled={xmlData.salvandoFornecedor}
                                        className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                                        {xmlData.salvandoFornecedor ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <IoSaveOutline size={16} />}
                                        Salvar Fornecedor
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-gray-700">Progresso dos vínculos</span>
                                <span className="text-sm font-black text-gray-800">{xmlData.totalVinculados}/{xmlData.totalItens}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${xmlData.totalItens > 0 ? (xmlData.totalVinculados / xmlData.totalItens) * 100 : 0}%` }} />
                            </div>
                            {!xmlData.todosVinculados && <p className="text-xs text-amber-600 font-medium mt-2">⚠️ Vincule todos os produtos para liberar a confirmação</p>}
                        </div>

                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <IoCubeOutline className="text-blue-600" /> Itens da Nota
                                </h3>
                                <button onClick={xmlData.limparNota} className="text-red-500 hover:text-red-700 font-bold text-sm flex items-center gap-1">
                                    <IoTrashOutline /> Limpar
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-400 font-black">
                                            <th className="px-4 py-4">Produto na Nota</th>
                                            <th className="px-4 py-4">NCM</th>
                                            <th className="px-4 py-4">Qtd</th>
                                            <th className="px-4 py-4">Custo Unit.</th>
                                            <th className="px-4 py-4">Preço Venda</th>
                                            <th className="px-4 py-4">Total</th>
                                            <th className="px-4 py-4">Vínculo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {xmlData.notaLida.produtos.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-4">
                                                    <p className="text-sm font-bold text-gray-800">{p.nome}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">EAN: {p.ean || 'SEM EAN'} | COD: {p.codigo}</p>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100">{p.ncm || '—'}</span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="bg-gray-100 px-2 py-1 rounded-lg text-sm font-bold text-gray-600">{p.qtd} {p.unidade}</span>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-600 font-mono">
                                                    {p.valorUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-gray-400">R$</span>
                                                        <input type="number" step="0.01" min="0" value={p.precoVendaSugerido} onChange={e => xmlData.atualizarPrecoVenda(idx, e.target.value)}
                                                            className="w-24 p-2 border border-emerald-200 bg-emerald-50 rounded-xl text-sm font-bold text-emerald-800 outline-none text-center" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sm font-black text-gray-900">
                                                    {p.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-4">
                                                    {p.vinculoId ? (
                                                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl border border-emerald-100 text-sm font-bold">
                                                            <IoCheckmarkCircleOutline size={18} />
                                                            <span className="truncate max-w-[100px]">{p.vinculoNome}</span>
                                                            <button onClick={() => xmlData.setModalVinculo({ isOpen: true, itemIndex: idx })} className="ml-auto text-xs underline shrink-0">Trocar</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => xmlData.setModalVinculo({ isOpen: true, itemIndex: idx })}
                                                            className="flex items-center gap-2 text-[11px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-all border border-blue-100">
                                                            <IoAlertCircleOutline size={16} /> Vincular
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <IoWalletOutline className="text-indigo-600" /> Condição de Pagamento
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Método</label>
                                    <select value={xmlData.pagamento.metodo} onChange={e => xmlData.setPagamento(prev => ({ ...prev, metodo: e.target.value }))} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm">
                                        {['boleto', 'pix', 'cartao', 'cheque', 'dinheiro', 'transferencia'].map(m => ( <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option> ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Nº de Parcelas</label>
                                    <input type="number" min="1" max="24" value={xmlData.pagamento.parcelas} onChange={e => xmlData.setPagamento(prev => ({ ...prev, parcelas: Math.max(1, parseInt(e.target.value) || 1) }))}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm font-bold" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">1º Vencimento</label>
                                    <input type="date" value={xmlData.pagamento.primeiroVencimento} onChange={e => xmlData.setPagamento(prev => ({ ...prev, primeiroVencimento: e.target.value }))}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" />
                                </div>
                            </div>
                            {xmlData.parcelas.length > 0 && (
                                <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4">
                                    <p className="text-xs font-bold text-indigo-700 uppercase mb-3 flex items-center gap-2"> <IoReceiptOutline /> Preview das parcelas </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {xmlData.parcelas.map(parcela => (
                                            <div key={parcela.numero} className="bg-white rounded-xl p-3 border border-indigo-100 text-center">
                                                <p className="text-xs text-indigo-600 font-bold">{parcela.numero}/{xmlData.pagamento.parcelas}</p>
                                                <p className="text-sm font-black text-gray-800">{parcela.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(parcela.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {xmlData.todosVinculados && (
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-sm text-emerald-700">
                                <p className="font-bold mb-1">✅ Ao confirmar, para cada produto vinculado:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-xs">
                                    <li>Estoque somado (+quantidade da nota)</li>
                                    <li>Custo atualizado (preço unitário da nota)</li>
                                    <li>NCM atualizado</li>
                                    <li>Preço de venda atualizado (conforme coluna editável)</li>
                                    <li>{xmlData.pagamento.parcelas} conta(s) a pagar criada(s) em {xmlData.pagamento.metodo}</li>
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-end pb-8">
                            <button onClick={xmlData.confirmarEntradaEstoque} disabled={!xmlData.todosVinculados || xmlData.loading || !xmlData.pagamento.primeiroVencimento}
                                className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-green-100 hover:bg-green-700 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                                {xmlData.loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <IoSaveOutline size={20} />}
                                Confirmar Entrada no Estoque
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ── MODAL DUPLICATA ── */}
            {xmlData.modalDuplicata && xmlData.notaDuplicada && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-amber-100 bg-amber-50">
                            <h3 className="font-bold text-amber-800 text-lg">⚠️ Nota já importada anteriormente</h3>
                            <p className="text-sm text-amber-700 mt-1">Esta nota fiscal já foi processada. Veja os dados abaixo.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2 text-sm">
                                {[
                                    ['Nota Nº', xmlData.notaDuplicada.numeroNota],
                                    ['Fornecedor', xmlData.notaDuplicada.fornecedorNome],
                                    ['Valor Total', Number(xmlData.notaDuplicada.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                                    ['Importada em', xmlData.notaDuplicada.dataEntrada?.toDate ? xmlData.notaDuplicada.dataEntrada.toDate().toLocaleString('pt-BR') : '—'],
                                    ['Itens', `${xmlData.notaDuplicada.itens?.length || 0} produtos`],
                                    ['Pagamento', `${xmlData.notaDuplicada.pagamento?.parcelas}x ${xmlData.notaDuplicada.pagamento?.metodo}`],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex justify-between"> <span className="text-gray-500">{label}</span> <span className="font-bold truncate max-w-[220px] text-right">{value}</span> </div>
                                ))}
                            </div>
                            <p className="text-sm text-gray-600 font-medium">O que deseja fazer?</p>
                            <div className="space-y-2">
                                <button onClick={() => xmlData.recalcularDuplicataEFechar(true)} className="w-full py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 text-sm text-left flex items-center gap-3">
                                    <span className="text-xl">🚫</span> <div><p>Cancelar — não importar</p><p className="text-xs text-gray-400 font-normal">Descarta o arquivo e volta para a tela inicial</p></div>
                                </button>
                                <button onClick={() => { xmlData.recalcularDuplicataEFechar(true); xmlData.setAbaAtiva('historico'); }} className="w-full py-3 px-4 rounded-xl border border-blue-100 text-blue-700 font-bold hover:bg-blue-50 text-sm text-left flex items-center gap-3">
                                    <span className="text-xl">📋</span> <div><p>Ver histórico de importações</p><p className="text-xs text-blue-400 font-normal">Consulta as notas já processadas</p></div>
                                </button>
                                <button onClick={() => xmlData.recalcularDuplicataEFechar(false)} className="w-full py-3 px-4 rounded-xl border border-red-100 text-red-700 font-bold hover:bg-red-50 text-sm text-left flex items-center gap-3">
                                    <span className="text-xl">⚠️</span> <div><p>Reimportar mesmo assim</p><p className="text-xs text-red-400 font-normal">Vai somar estoque novamente e criar novas parcelas</p></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAIS DE PRODUTOS ── */}
            {xmlData.modalVinculo.isOpen && xmlData.notaLida && (
                <ModalVinculo produtoNota={xmlData.notaLida.produtos[xmlData.modalVinculo.itemIndex]} produtosSistema={xmlData.produtosSistema}
                    onVincular={xmlData.selecionarVinculo} onCriarNovo={xmlData.abrirCriarNovo} onFechar={() => xmlData.setModalVinculo({ isOpen: false, itemIndex: null })} />
            )}

            {xmlData.modalNovoProduto.isOpen && xmlData.notaLida && (
                <ModalNovoProduto produtoNota={xmlData.notaLida.produtos[xmlData.modalNovoProduto.itemIndex]} margemPadrao={xmlData.margemPadrao} estabelecimentoId={estabelecimentoIdPrincipal}
                    onSalvo={xmlData.onProdutoCriado} onFechar={() => xmlData.setModalNovoProduto({ isOpen: false, itemIndex: null })} />
            )}
        </div>
    );
};

export default EntradaEstoqueXML;