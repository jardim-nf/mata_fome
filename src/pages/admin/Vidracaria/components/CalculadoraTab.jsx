import React, { useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  IoCalculatorOutline, 
  IoSparklesOutline, 
  IoCheckmarkCircleOutline 
} from 'react-icons/io5';
import ThreeDProjectViewer from '../../../../components/ThreeDProjectViewer';
import ProjectSvgViewer from '../../../../components/Vidracaria/ProjectSvgViewer';
import { 
  CORES_ALUMINIO, 
  TIPOS_PUXADOR, 
  CENARIOS_FUNDO, 
  ANGULOS_CORTE, 
  ARREDONDAMENTOS, 
  AREAS_MINIMAS 
} from './EditMaterialModal';
const obterQtdFolhasFixoMovel = (tipoProjeto, modeloNome, totalFolhas) => {
  const nomeLower = String(modeloNome || '').toLowerCase();
  
  if (tipoProjeto === 'espelho') {
    return { fixas: totalFolhas, moveis: 0 };
  }
  
  if (tipoProjeto === 'outros') {
    return { fixas: totalFolhas, moveis: 0 };
  }
  
  const isPivotOrSwing = nomeLower.includes('pivotante') || nomeLower.includes('abrir') || nomeLower.includes('giro');
  
  if (isPivotOrSwing) {
    if (totalFolhas === 1) return { fixas: 0, moveis: 1 };
    if (totalFolhas === 2) return { fixas: 1, moveis: 1 };
    if (totalFolhas === 3) return { fixas: 2, moveis: 1 };
    if (totalFolhas === 4) return { fixas: 2, moveis: 2 };
    return { fixas: 0, moveis: totalFolhas };
  }
  
  // Standard sliding (correr) Box, Janela, Porta
  if (totalFolhas === 2) return { fixas: 1, moveis: 1 };
  if (totalFolhas === 4) return { fixas: 2, moveis: 2 };
  if (totalFolhas === 3) return { fixas: 2, moveis: 1 }; // standard 3-panel (2 fixed, 1 mobile)
  if (totalFolhas === 1) {
    if (nomeLower.includes('fixo') || nomeLower.includes('painel') || nomeLower.includes('resguardo')) {
      return { fixas: 1, moveis: 0 };
    }
    return { fixas: 0, moveis: 1 };
  }
  
  // Fallback
  const moveis = Math.floor(totalFolhas / 2);
  const fixas = totalFolhas - moveis;
  return { fixas, moveis };
};


export const PERFIS_ALUMINIO = [
  // === JANELA DE CORRER 2 FOLHAS ===
  { codigo: 'SU-001', nome: 'Trilho Sup. Correr 2F', categoria: 'Janela Correr 2F', svg: 'M2,18 L2,2 L28,2 L28,18 L24,18 L24,6 L20,6 L20,14 L10,14 L10,6 L6,6 L6,18 Z' },
  { codigo: 'SU-002', nome: 'Trilho Inf. Correr 2F', categoria: 'Janela Correr 2F', svg: 'M2,2 L2,18 L28,18 L28,2 L24,2 L24,14 L20,14 L20,6 L10,6 L10,14 L6,14 L6,2 Z' },
  { codigo: 'SU-003', nome: 'Marco Lateral 2F', categoria: 'Janela Correr 2F', svg: 'M8,2 L8,18 L22,18 L22,2 L18,2 L18,14 L12,14 L12,2 Z' },
  { codigo: 'SU-004', nome: 'Marco Bandeira 2F', categoria: 'Janela Correr 2F', svg: 'M4,6 L4,14 L26,14 L26,6 L22,6 L22,10 L8,10 L8,6 Z' },
  { codigo: 'SU-005', nome: 'Travessa Folha 2F', categoria: 'Janela Correr 2F', svg: 'M6,4 L6,16 L24,16 L24,4 L20,4 L20,12 L10,12 L10,4 Z' },
  { codigo: 'SU-006', nome: 'Montante Folha 2F', categoria: 'Janela Correr 2F', svg: 'M10,2 L10,18 L20,18 L20,2 L17,2 L17,15 L13,15 L13,2 Z' },

  // === JANELA DE CORRER 3/4 FOLHAS ===
  { codigo: 'SU-010', nome: 'Trilho Sup. 3 Folhas', categoria: 'Janela Correr 3/4F', svg: 'M1,18 L1,2 L29,2 L29,18 L26,18 L26,6 L21,6 L21,14 L16,14 L16,6 L14,6 L14,14 L9,14 L9,6 L4,6 L4,18 Z' },
  { codigo: 'SU-011', nome: 'Trilho Inf. 3 Folhas', categoria: 'Janela Correr 3/4F', svg: 'M1,2 L1,18 L29,18 L29,2 L26,2 L26,14 L21,14 L21,6 L16,6 L16,14 L14,14 L14,6 L9,6 L9,14 L4,14 L4,2 Z' },
  { codigo: 'SU-012', nome: 'Marco Lateral Liso 3F', categoria: 'Janela Correr 3/4F', svg: 'M9,2 L9,18 L21,18 L21,2 L18,2 L18,15 L12,15 L12,2 Z' },
  { codigo: 'SU-121', nome: 'Trilho Sup. 4 Folhas', categoria: 'Janela Correr 3/4F', svg: 'M1,18 L1,2 L29,2 L29,18 L27,18 L27,6 L23,6 L23,14 L19,14 L19,6 L16,6 L16,14 L14,14 L14,6 L11,6 L11,14 L7,14 L7,6 L3,6 L3,18 Z' },
  { codigo: 'SU-122', nome: 'Trilho Inf. 4 Folhas', categoria: 'Janela Correr 3/4F', svg: 'M1,2 L1,18 L29,18 L29,2 L27,2 L27,14 L23,14 L23,6 L19,6 L19,14 L16,14 L16,6 L14,6 L14,14 L11,14 L11,6 L7,6 L7,14 L3,14 L3,2 Z' },

  // === MAXIM-AR ===
  { codigo: 'SU-079', nome: 'Marco Maxim-ar', categoria: 'Maxim-ar', svg: 'M4,2 L4,18 L26,18 L26,2 L22,2 L22,14 L8,14 L8,2 Z M8,4 L8,8 L22,8' },
  { codigo: 'SU-080', nome: 'Travessa Sup. Folha', categoria: 'Maxim-ar', svg: 'M6,4 L6,16 L24,16 L24,4 L20,4 L20,12 L10,12 L10,4 Z' },
  { codigo: 'SU-081', nome: 'Montante Folha Maxim', categoria: 'Maxim-ar', svg: 'M10,2 L10,18 L20,18 L20,2 L16,2 L16,14 L14,14 L14,2 Z' },
  { codigo: 'SU-082', nome: 'Travessa c/ Olhal', categoria: 'Maxim-ar', svg: 'M4,6 L4,14 L26,14 L26,6 L22,6 L22,10 L18,10 L18,6 Z M12,6 L12,10 L8,10 L8,6 Z' },
  { codigo: 'SU-084', nome: 'Pingadeira Folha', categoria: 'Maxim-ar', svg: 'M4,8 L4,14 L26,14 L26,8 L22,8 L22,11 L8,11 L8,8 Z M8,14 L8,17 L6,18 M22,14 L22,17 L24,18' },
  { codigo: 'SU-276', nome: 'Pingadeira Marco', categoria: 'Maxim-ar', svg: 'M4,6 L4,16 L26,16 L26,6 L24,6 L24,13 L6,13 L6,6 Z M6,16 L4,18 M24,16 L26,18' },

  // === PORTA DE CORRER ===
  { codigo: 'SU-228', nome: 'Trilho Inf. Porta 2F', categoria: 'Porta Correr', svg: 'M2,2 L2,18 L28,18 L28,2 L24,2 L24,12 L18,12 L18,6 L12,6 L12,12 L6,12 L6,2 Z' },
  { codigo: 'SU-230', nome: 'Trilho Inf. Porta 3F', categoria: 'Porta Correr', svg: 'M1,2 L1,18 L29,18 L29,2 L26,2 L26,12 L21,12 L21,6 L16,6 L16,12 L14,12 L14,6 L9,6 L9,12 L4,12 L4,2 Z' },
  { codigo: 'SU-110', nome: 'Travessa Folha Porta', categoria: 'Porta Correr', svg: 'M4,4 L4,16 L26,16 L26,4 L22,4 L22,12 L8,12 L8,4 Z' },
  { codigo: 'SU-111', nome: 'Montante Folha Porta', categoria: 'Porta Correr', svg: 'M10,2 L10,18 L20,18 L20,2 L16,2 L16,14 L14,14 L14,2 Z' },
  { codigo: 'SU-186', nome: 'Travessa Inf. Porta', categoria: 'Porta Correr', svg: 'M4,8 L4,18 L26,18 L26,8 L22,8 L22,14 L8,14 L8,8 Z' },
  { codigo: 'SU-271', nome: 'Trilho Inf. Geral', categoria: 'Porta Correr', svg: 'M3,2 L3,18 L27,18 L27,2 L23,2 L23,14 L17,14 L17,4 L13,4 L13,14 L7,14 L7,2 Z' },

  // === PORTA PIVOTANTE/GIRO ===
  { codigo: 'SU-041', nome: 'Marco Pivotante', categoria: 'Porta Pivotante', svg: 'M6,2 L6,18 L24,18 L24,2 L20,2 L20,14 L10,14 L10,2 Z' },
  { codigo: 'SU-241', nome: 'Montante s/ Baguete', categoria: 'Porta Pivotante', svg: 'M10,2 L10,18 L20,18 L20,2 Z M12,4 L12,16 L18,16 L18,4 Z' },
  { codigo: 'SU-049', nome: 'Contramarco Pivotante', categoria: 'Porta Pivotante', svg: 'M4,2 L4,18 L26,18 L26,2 L22,2 L22,14 L16,14 L16,6 L14,6 L14,14 L8,14 L8,2 Z' },

  // === BOX — TRILHOS ===
  { codigo: 'AL-80', nome: 'Capa Trilho Superior', categoria: 'Box — Trilhos', svg: 'M4,6 L4,16 L26,16 L26,6 L22,6 L22,12 L8,12 L8,6 Z' },
  { codigo: 'AL-81', nome: 'Trilho Superior Box', categoria: 'Box — Trilhos', svg: 'M2,18 L2,2 L28,2 L28,18 L24,18 L24,6 L20,6 L20,14 L10,14 L10,6 L6,6 L6,18 Z' },
  { codigo: 'AL-82', nome: 'Trilho Inf. c/ Batente', categoria: 'Box — Trilhos', svg: 'M2,2 L2,18 L28,18 L28,2 L24,2 L24,14 L18,14 L18,8 L12,8 L12,14 L6,14 L6,2 Z' },

  // === BOX — PERFIS ===
  { codigo: 'AL-66', nome: 'Perfil U p/ Vidro 8mm', categoria: 'Box — Perfis', svg: 'M8,2 L8,18 L22,18 L22,2 L19,2 L19,15 L11,15 L11,2 Z' },
  { codigo: 'AL-66L', nome: 'Perfil U Largo 10mm', categoria: 'Box — Perfis', svg: 'M7,2 L7,18 L23,18 L23,2 L20,2 L20,15 L10,15 L10,2 Z' },
  { codigo: 'AL-64', nome: 'Cadeirinha de Canto', categoria: 'Box — Perfis', svg: 'M4,2 L4,18 L18,18 L18,12 L10,12 L10,2 Z M18,2 L26,2 L26,18 L20,18 L20,8 L18,8 Z' },
  { codigo: 'AL-88', nome: 'Batedor Box', categoria: 'Box — Perfis', svg: 'M10,2 L10,18 L20,18 L20,2 L17,2 L17,12 L16,14 L16,14 L13,12 L13,2 Z' },
  { codigo: 'AL-90', nome: 'Arremate de Acabamento', categoria: 'Box — Perfis', svg: 'M6,6 L6,14 L24,14 L24,6 L20,6 L20,10 L10,10 L10,6 Z' },

  // === PERFIS U / F / L ===
  { codigo: 'SU-035', nome: 'Perfil U (Canal)', categoria: 'Perfis U / F / L', svg: 'M6,2 L6,18 L24,18 L24,2 L20,2 L20,14 L10,14 L10,2 Z' },
  { codigo: 'SU-036', nome: 'Perfil F', categoria: 'Perfis U / F / L', svg: 'M6,2 L6,18 L24,18 L24,14 L10,14 L10,10 L20,10 L20,6 L10,6 L10,2 Z' },
  { codigo: 'SU-037', nome: 'Perfil L (Cantoneira)', categoria: 'Perfis U / F / L', svg: 'M6,2 L6,18 L24,18 L24,14 L10,14 L10,2 Z' },
  { codigo: 'SU-038', nome: 'Perfil T', categoria: 'Perfis U / F / L', svg: 'M4,2 L4,6 L12,6 L12,18 L18,18 L18,6 L26,6 L26,2 Z' },

  // === MONTANTES / CONTRAMARCO ===
  { codigo: 'SU-250', nome: 'Montante Lateral', categoria: 'Montantes', svg: 'M6,2 L6,18 L24,18 L24,2 L20,2 L20,14 L16,14 L16,6 L14,6 L14,14 L10,14 L10,2 Z' },
  { codigo: 'SU-039', nome: 'Montante Central', categoria: 'Montantes', svg: 'M4,2 L4,18 L10,18 L10,14 L13,14 L13,18 L17,18 L17,14 L20,14 L20,18 L26,18 L26,2 L20,2 L20,6 L17,6 L17,2 L13,2 L13,6 L10,6 L10,2 Z' },
  { codigo: 'SU-085', nome: 'Coluna Marco', categoria: 'Montantes', svg: 'M8,2 L8,18 L22,18 L22,2 L18,2 L18,14 L12,14 L12,2 Z' },
  { codigo: 'SU-086', nome: 'Coluna Marco Reforçado', categoria: 'Montantes', svg: 'M6,2 L6,18 L24,18 L24,2 L20,2 L20,14 L16,14 L16,6 L14,6 L14,14 L10,14 L10,2 Z' },

  // === LINHA 45 (PREMIUM/PORTAS/PIVOTANTES) ===
  { codigo: 'P45-001', nome: 'Trilho Sup. Linha 45', categoria: 'Linha 45 (Premium)', svg: 'M2,18 L2,2 L28,2 L28,18 L25,18 L25,6 L21,6 L21,15 L9,15 L9,6 L5,6 L5,18 Z' },
  { codigo: 'P45-002', nome: 'Trilho Inf. Linha 45', categoria: 'Linha 45 (Premium)', svg: 'M2,2 L2,18 L28,18 L28,2 L25,2 L25,14 L21,14 L21,5 L9,5 L9,14 L5,14 L5,2 Z' },
  { codigo: 'P45-005', nome: 'Montante Folha Linha 45', categoria: 'Linha 45 (Premium)', svg: 'M8,2 L8,18 L22,18 L22,2 L18,2 L18,14 L12,14 L12,2 Z' },
  { codigo: 'P45-012', nome: 'Baguete Linha 45', categoria: 'Linha 45 (Premium)', svg: 'M10,4 L10,16 L20,16 L20,4 Z' },

  // === LINHA GOLD (PREMIUM/ALTO PADRÃO) ===
  { codigo: 'LG-048', nome: 'Marco Lateral 2F Gold', categoria: 'Linha Gold', svg: 'M2,2 L2,18 L28,18 L28,2 L24,2 L24,14 L6,14 L6,2 Z' },
  { codigo: 'LG-079', nome: 'Trilho Sup. 2F Gold', categoria: 'Linha Gold', svg: 'M1,18 L1,2 L29,2 L29,18 L25,18 L25,6 L5,6 L5,18 Z' },
  { codigo: 'LG-102', nome: 'Travessa Folha Gold', categoria: 'Linha Gold', svg: 'M4,4 L4,16 L26,16 L26,4 L20,4 L20,12 L10,12 L10,4 Z' },

  // === LINHA 25 / 30 (RESIDENCIAL PADRÃO) ===
  { codigo: 'L25-001', nome: 'Trilho Sup. Linha 25', categoria: 'Linha 25/30', svg: 'M2,18 L2,2 L28,2 L28,18 L24,18 L24,6 L6,6 L6,18 Z' },
  { codigo: 'L30-002', nome: 'Trilho Inf. Linha 30', categoria: 'Linha 25/30', svg: 'M2,2 L2,18 L28,18 L28,2 L24,2 L24,14 L6,14 L6,2 Z' },
  { codigo: 'L25-008', nome: 'Montante Folha L25', categoria: 'Linha 25/30', svg: 'M8,2 L8,18 L22,18 L22,2 L18,2 L18,14 L12,14 L12,2 Z' },

  // === ACESSÓRIOS / GUARNIÇÕES ===
  { codigo: 'GUA-256', nome: 'Guarnição Borracha', categoria: 'Acessórios', svg: 'M10,4 L10,16 L20,16 L20,4 L17,4 L15,2 L13,4 Z M12,6 L12,14 L18,14 L18,6 Z' },
  { codigo: 'ESC-300', nome: 'Escova de Vedação', categoria: 'Acessórios', svg: 'M8,6 L8,14 L14,14 L14,6 Z M14,4 L14,16 L16,16 L16,4 Z M16,2 L16,18 L22,16 L22,4 Z' },
  { codigo: 'ROL-440', nome: 'Roldana Concavo', categoria: 'Acessórios', svg: 'M9,10 A6,6 0 1,1 21,10 A6,6 0 1,1 9,10 Z M12,10 A3,3 0 1,1 18,10 A3,3 0 1,1 12,10 Z' },
];

const CalculadoraTab = ({
  setEditingMaterial,
  modelo, setModelo,
  modeloObjId, setModeloObjId,
  modeloNomeCompleto, setModeloNomeCompleto,
  largura, setLargura,
  altura, setAltura,
  arredondamentoMm, setArredondamentoMm,
  areaMinimaM2, setAreaMinimaM2,
  folgaLargura, setFolgaLargura,
  descontoAltura, setDescontoAltura,
  descontoAlturaMovel, setDescontoAlturaMovel,
  tipoVidroId, setTipoVidroId,
  corVidroId, setCorVidroId,
  kitAluminioId, setKitAluminioId,
  linhaAluminioId, setLinhaAluminioId,
  acessorioId, setAcessorioId,
  custoMaoObra, setCustoMaoObra,
  markupPercent, setMarkupPercent,
  ladoAbertura, setLadoAbertura,
  sentidoAbertura, setSentidoAbertura,
  tipoPuxador, setTipoPuxador,
  corAluminio, setCorAluminio,
  custoFrete, setCustoFrete,
  perfisSelecionados, setPerfisSelecionados,
  previewOpen, setPreviewOpen,
  viewMode3D, setViewMode3D,
  copilotOpen, setCopilotOpen,
  showPerfilSelector, setShowPerfilSelector,
  searchPerfilQuery, setSearchPerfilQuery,
  clienteNome, setClienteNome,
  clienteTelefone, setClienteTelefone,
  clienteEndereco, setClienteEndereco,
  clienteCep, setClienteCep,
  dataInstalacao, setDataInstalacao,
  vidraceiro, setVidraceiro,
  observacoes, setObservacoes,
  cenarioFundo, setCenarioFundo,
  anguloCorte, setAnguloCorte,
  
  dbVidros, dbCores, dbKits, dbAcessorios, dbModelos, dbLinhas, dbClientes, pedidos,
  alertaSeguranca,
  handleCreateOS,
  handleCepLookup,
  aplicarFolgasPadrao,
  showSuggestions,
  setShowSuggestions,
  onSendToOtimizer
}) => {
  const [showCalcSafetyDetails, setShowCalcSafetyDetails] = React.useState(null);

  // Determina os filtros com base no modelo selecionado
  const selectedModel = dbModelos.find(m => m.id === modeloObjId);

  const filteredVidros = selectedModel?.vidrosIds && selectedModel.vidrosIds.length > 0
    ? (dbVidros || []).filter(v => selectedModel.vidrosIds.includes(v.id))
    : (selectedModel?.vidros && selectedModel.vidros.length > 0)
    ? selectedModel.vidros
    : [];

  const filteredCores = selectedModel?.coresIds && selectedModel.coresIds.length > 0
    ? (dbCores || []).filter(c => selectedModel.coresIds.includes(c.id))
    : (selectedModel?.cores && selectedModel.cores.length > 0)
    ? selectedModel.cores
    : [];

  const filteredKits = selectedModel?.kitsIds && selectedModel.kitsIds.length > 0
    ? (dbKits || []).filter(k => selectedModel.kitsIds.includes(k.id))
    : (selectedModel?.kits && selectedModel.kits.length > 0)
    ? selectedModel.kits
    : [];

  const filteredAcessorios = selectedModel?.acessoriosIds && selectedModel.acessoriosIds.length > 0
    ? (dbAcessorios || []).filter(a => selectedModel.acessoriosIds.includes(a.id))
    : (selectedModel?.acessorios && selectedModel.acessorios.length > 0)
    ? selectedModel.acessorios
    : [];

  const filteredCoresAluminio = selectedModel?.coresAluminioPermitidas && selectedModel.coresAluminioPermitidas.length > 0
    ? CORES_ALUMINIO.filter(c => selectedModel.coresAluminioPermitidas.includes(c.id))
    : CORES_ALUMINIO;

  const filteredTiposPuxador = selectedModel?.tiposPuxadorPermitidos && selectedModel.tiposPuxadorPermitidos.length > 0
    ? TIPOS_PUXADOR.filter(p => selectedModel.tiposPuxadorPermitidos.includes(p.id))
    : TIPOS_PUXADOR;

  const filteredCenariosFundo = selectedModel?.cenariosFundoPermitidos && selectedModel.cenariosFundoPermitidos.length > 0
    ? CENARIOS_FUNDO.filter(cf => selectedModel.cenariosFundoPermitidos.includes(cf.id))
    : CENARIOS_FUNDO;

  const filteredAngulosCorte = selectedModel?.angulosCortePermitidos && selectedModel.angulosCortePermitidos.length > 0
    ? ANGULOS_CORTE.filter(a => selectedModel.angulosCortePermitidos.includes(a.id))
    : ANGULOS_CORTE;

  const filteredArredondamentos = selectedModel?.arredondamentosPermitidos && selectedModel.arredondamentosPermitidos.length > 0
    ? ARREDONDAMENTOS.filter(arr => selectedModel.arredondamentosPermitidos.includes(arr.id))
    : ARREDONDAMENTOS;

  const filteredAreasMinimas = selectedModel?.areasMinimasPermitidas && selectedModel.areasMinimasPermitidas.length > 0
    ? AREAS_MINIMAS.filter(am => selectedModel.areasMinimasPermitidas.includes(am.id))
    : AREAS_MINIMAS;

  const selectedVidro = filteredVidros.find(v => v.id === tipoVidroId) || filteredVidros[0];
  const selectedCor = filteredCores.find(c => c.id === corVidroId) || filteredCores[0];
  const selectedKit = filteredKits.find(k => k.id === kitAluminioId) || filteredKits[0];
  const selectedAcessorio = filteredAcessorios.find(a => a.id === acessorioId) || filteredAcessorios[0];

  // 1. Sincroniza dimensões padrão, folgas, linha e outras configurações padrão quando o modelo selecionado muda
  useEffect(() => {
    if (selectedModel) {
      setCustoMaoObra(selectedModel.custoMaoObra ?? 150);
      setMarkupPercent(selectedModel.markupPercent ?? 50);

      // Preenche as dimensões padrões e folgas do modelo
      if (selectedModel.larguraPadrao !== undefined && selectedModel.larguraPadrao > 0) {
        setLargura(selectedModel.larguraPadrao);
      }
      if (selectedModel.alturaPadrao !== undefined && selectedModel.alturaPadrao > 0) {
        setAltura(selectedModel.alturaPadrao);
      }
      const tProj = selectedModel.tipoProjeto || 'box';
      const defaultFolga = tProj === 'box' ? 50 : tProj === 'janela' ? 40 : tProj === 'porta' ? 50 : 0;
      const defaultDesconto = (tProj === 'box' || tProj === 'janela' || tProj === 'porta') ? 55 : 0;
      const defaultDescontoMovel = (tProj === 'box' || tProj === 'janela' || tProj === 'porta') ? 20 : 0;

      const folga = (selectedModel.folgaLarguraPadrao === undefined || selectedModel.folgaLarguraPadrao === null || (selectedModel.folgaLarguraPadrao === 0 && tProj !== 'outros' && tProj !== 'espelho'))
        ? defaultFolga
        : selectedModel.folgaLarguraPadrao;

      const desconto = (selectedModel.descontoAlturaPadrao === undefined || selectedModel.descontoAlturaPadrao === null || (selectedModel.descontoAlturaPadrao === 0 && tProj !== 'outros' && tProj !== 'espelho'))
        ? defaultDesconto
        : selectedModel.descontoAlturaPadrao;

      const descontoMovel = (selectedModel.descontoAlturaMovelPadrao === undefined || selectedModel.descontoAlturaMovelPadrao === null || (selectedModel.descontoAlturaMovelPadrao === 0 && tProj !== 'outros' && tProj !== 'espelho'))
        ? defaultDescontoMovel
        : selectedModel.descontoAlturaMovelPadrao;

      setFolgaLargura(folga);
      setDescontoAltura(desconto);
      if (setDescontoAlturaMovel) {
        setDescontoAlturaMovel(descontoMovel);
      }

      // Linha de alumínio padrão
      if (selectedModel.linhaAluminio) {
        setLinhaAluminioId(selectedModel.linhaAluminio);
      } else {
        const nomeLower = selectedModel.nome.toLowerCase();
        if (nomeLower.includes('suprema')) setLinhaAluminioId('suprema');
        else if (nomeLower.includes('gold')) setLinhaAluminioId('gold');
        else if (nomeLower.includes('temperad') || nomeLower.includes('box') || selectedModel.tipoProjeto === 'box') setLinhaAluminioId('box');
        else if (nomeLower.includes('45')) setLinhaAluminioId('linha45');
        else if (nomeLower.includes('25') || nomeLower.includes('30')) setLinhaAluminioId('linha25_30');
        else setLinhaAluminioId('outros');
      }

      // Preenche outras configurações padrão
      if (selectedModel.corAluminio) {
        setCorAluminio(selectedModel.corAluminio);
      }
      if (selectedModel.tipoPuxador) {
        setTipoPuxador(selectedModel.tipoPuxador);
      }
      if (selectedModel.cenarioFundo) {
        setCenarioFundo(selectedModel.cenarioFundo);
      }
      if (selectedModel.anguloCorte !== undefined) {
        setAnguloCorte(String(selectedModel.anguloCorte));
      }
      if (selectedModel.arredondamentoMm !== undefined) {
        setArredondamentoMm(selectedModel.arredondamentoMm);
      }
      if (selectedModel.areaMinimaM2 !== undefined) {
        setAreaMinimaM2(selectedModel.areaMinimaM2);
      }
      if (selectedModel.custoFrete !== undefined) {
        setCustoFrete(selectedModel.custoFrete);
      }
    }
  }, [modeloObjId]);

  // 2. Sincroniza seleções quando as listas filtradas mudam, garantindo que tenhamos itens válidos selecionados
  useEffect(() => {
    if (filteredVidros.length > 0) {
      if (!tipoVidroId || !filteredVidros.some(v => v.id === tipoVidroId)) {
        setTipoVidroId(filteredVidros[0].id);
      }
    } else {
      setTipoVidroId('');
    }

    if (filteredCores.length > 0) {
      if (!corVidroId || !filteredCores.some(c => c.id === corVidroId)) {
        setCorVidroId(filteredCores[0].id);
      }
    } else {
      setCorVidroId('');
    }

    if (filteredKits.length > 0) {
      if (!kitAluminioId || !filteredKits.some(k => k.id === kitAluminioId)) {
        setKitAluminioId(filteredKits[0].id);
      }
    } else {
      setKitAluminioId('');
    }

    if (filteredAcessorios.length > 0) {
      if (!acessorioId || !filteredAcessorios.some(a => a.id === acessorioId)) {
        setAcessorioId(filteredAcessorios[0].id);
      }
    } else {
      setAcessorioId('');
    }

    if (filteredCoresAluminio.length > 0) {
      if (!corAluminio || !filteredCoresAluminio.some(c => c.id === corAluminio)) {
        setCorAluminio(filteredCoresAluminio[0].id);
      }
    } else {
      setCorAluminio('');
    }

    if (filteredTiposPuxador.length > 0) {
      if (!tipoPuxador || !filteredTiposPuxador.some(p => p.id === tipoPuxador)) {
        setTipoPuxador(filteredTiposPuxador[0].id);
      }
    } else {
      setTipoPuxador('');
    }

    if (filteredCenariosFundo.length > 0) {
      if (!cenarioFundo || !filteredCenariosFundo.some(cf => cf.id === cenarioFundo)) {
        setCenarioFundo(filteredCenariosFundo[0].id);
      }
    } else {
      setCenarioFundo('');
    }

    if (filteredAngulosCorte.length > 0) {
      if (!anguloCorte || !filteredAngulosCorte.some(a => a.id === anguloCorte)) {
        setAnguloCorte(String(filteredAngulosCorte[0].id));
      }
    } else {
      setAnguloCorte('');
    }

    if (filteredArredondamentos.length > 0) {
      if (arredondamentoMm === undefined || !filteredArredondamentos.some(arr => arr.id === arredondamentoMm)) {
        setArredondamentoMm(filteredArredondamentos[0].id);
      }
    } else {
      setArredondamentoMm(0);
    }

    if (filteredAreasMinimas.length > 0) {
      if (areaMinimaM2 === undefined || !filteredAreasMinimas.some(am => am.id === areaMinimaM2)) {
        setAreaMinimaM2(filteredAreasMinimas[0].id);
      }
    } else {
      setAreaMinimaM2(0);
    }
  }, [
    filteredVidros, 
    filteredCores, 
    filteredKits, 
    filteredAcessorios,
    filteredCoresAluminio,
    filteredTiposPuxador,
    filteredCenariosFundo,
    filteredAngulosCorte,
    filteredArredondamentos,
    filteredAreasMinimas
  ]);

  // Sincroniza automaticamente os perfis que acompanham a Linha selecionada
  useEffect(() => {
    let padrao = [];

    if (linhaAluminioId === 'suprema') {
      padrao = ['SU-001', 'SU-002', 'SU-003', 'SU-005', 'SU-006', 'ESC-300', 'GUA-256', 'ROL-440'];
    } else if (linhaAluminioId === 'gold') {
      padrao = ['LG-079', 'LG-048', 'LG-102', 'SU-111', 'ESC-300', 'GUA-256', 'ROL-440'];
    } else if (linhaAluminioId === 'box' || modelo === 'box') {
      padrao = ['AL-80', 'AL-81', 'AL-82', 'AL-66', 'AL-88', 'ESC-300', 'GUA-256', 'ROL-440'];
    } else if (linhaAluminioId === 'linha45') {
      padrao = ['P45-001', 'P45-002', 'P45-005', 'P45-012', 'ESC-300', 'GUA-256'];
    } else if (linhaAluminioId === 'linha25_30') {
      padrao = ['L25-001', 'L30-002', 'L25-008', 'ESC-300', 'GUA-256'];
    }

    if (padrao.length > 0) {
      if (selectedModel && selectedModel.perfisPermitidos && selectedModel.perfisPermitidos.length > 0) {
        const filtrado = padrao.filter(codigo => selectedModel.perfisPermitidos.includes(codigo));
        if (filtrado.length > 0) {
          setPerfisSelecionados(filtrado);
        } else {
          setPerfisSelecionados([selectedModel.perfisPermitidos[0]]);
        }
      } else {
        setPerfisSelecionados(padrao);
      }
    }
  }, [linhaAluminioId, selectedModel, setPerfisSelecionados, modelo]);

  const obterMedidaArredondada = (medidaMm, arredMm) => {
    const val = Number(medidaMm) || 0;
    if (!arredMm || arredMm <= 0) return val / 1000;
    return Math.ceil(val / arredMm) * arredMm / 1000;
  };

  const qtdeFolhas = selectedModel?.qtdeFolhas || 2;
  const overlaps = qtdeFolhas === 4 || qtdeFolhas === 3 ? 2 : (qtdeFolhas === 2 ? 1 : 0);

  const { fixas: qtdFixas, moveis: qtdMoveis } = obterQtdFolhasFixoMovel(modelo, modeloNomeCompleto, qtdeFolhas);

  // Cada folha individual tem largura e altura calculadas
  const larguraVidroFolha = Math.round((Number(largura || 0) + (overlaps * Number(folgaLargura || 0))) / qtdeFolhas) || 0;
  const alturaVidroFixoFolha = Math.max(1, Number(altura || 0) - Number(descontoAltura || 0)) || 0;
  const alturaVidroMovelFolha = Math.max(1, Number(altura || 0) - Number(descontoAlturaMovel || 0)) || 0;

  // O arredondamento é feito sobre a folha individual (como as têmperas faturam)
  const larguraFaturadaFolha = obterMedidaArredondada(larguraVidroFolha, arredondamentoMm);
  const alturaFaturadaFixoFolha = obterMedidaArredondada(alturaVidroFixoFolha, arredondamentoMm);
  const alturaFaturadaMovelFolha = obterMedidaArredondada(alturaVidroMovelFolha, arredondamentoMm);

  // A área faturada e a área real por folha
  const areaTeoricaFixoFolha = larguraFaturadaFolha * alturaFaturadaFixoFolha;
  const areaTeoricaMovelFolha = larguraFaturadaFolha * alturaFaturadaMovelFolha;
  
  // O faturamento mínimo de área (ex: 0.50m²) se aplica a CADA FOLHA individualmente nas têmperas!
  const areaSqmFixoFolha = parseFloat(Math.max(areaMinimaM2, areaTeoricaFixoFolha).toFixed(4)) || 0;
  const areaSqmMovelFolha = parseFloat(Math.max(areaMinimaM2, areaTeoricaMovelFolha).toFixed(4)) || 0;

  // Totais do projeto (soma de todas as folhas)
  const areaSqm = (areaSqmFixoFolha * qtdFixas) + (areaSqmMovelFolha * qtdMoveis);
  const areaRealSqm = ((larguraVidroFolha * alturaVidroFixoFolha / 1000000) * qtdFixas) + 
                       ((larguraVidroFolha * alturaVidroMovelFolha / 1000000) * qtdMoveis);

  // Para compatibilidade e exibição
  const larguraVidro = larguraVidroFolha * qtdeFolhas; 
  const alturaVidro = qtdMoveis > 0 ? alturaVidroMovelFolha : alturaVidroFixoFolha;
  const larguraFaturada = larguraFaturadaFolha * qtdeFolhas;
  const alturaFaturada = qtdMoveis > 0 ? alturaFaturadaMovelFolha : alturaFaturadaFixoFolha;

  const glassCostPerSqm = (Number(selectedVidro?.custoM2) || 0) + (Number(selectedCor?.adicionalM2) || 0);
  const totalGlassCost = areaSqm * glassCostPerSqm;
  const totalKitCost = Number(selectedKit?.custo) || 0;
  const totalAcessorioCost = Number(selectedAcessorio?.custo) || 0;
  
  const totalCostPrice = totalGlassCost + totalKitCost + totalAcessorioCost + Number(custoMaoObra) + Number(custoFrete);
  const salePrice = totalCostPrice * (1 + Number(markupPercent) / 100);

  // Sugestões para preenchimento automático do cliente
  const querySug = clienteNome.trim().toLowerCase();
  const suggestions = React.useMemo(() => {
    if (querySug.length < 2 || !showSuggestions) return [];

    // Mapear clientes cadastrados na base do estabelecimento
    const list = (dbClientes || []).map(c => {
      const formatAddress = (endereco) => {
        if (!endereco) return '';
        if (typeof endereco === 'string') return endereco;
        const parts = [
          endereco.rua,
          endereco.numero && `nº ${endereco.numero}`,
          endereco.bairro,
          endereco.cidade
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : '';
      };
      return {
        nome: c.nome || '',
        telefone: c.telefone || '',
        endereco: formatAddress(c.endereco),
        cep: c.cep || c.endereco?.cep || ''
      };
    });

    // Adicionar clientes únicos baseados em pedidos antigos que não estejam na lista
    const existingNames = new Set(list.map(c => c.nome.toLowerCase().trim()));
    pedidos.forEach(p => {
      const name = p.cliente?.nome || '';
      if (name && !existingNames.has(name.toLowerCase().trim())) {
        existingNames.add(name.toLowerCase().trim());
        list.push({
          nome: name,
          telefone: p.cliente?.telefone || '',
          endereco: typeof p.cliente?.endereco === 'string' ? p.cliente.endereco : '',
          cep: p.cliente?.cep || ''
        });
      }
    });

    // Filtrar e retornar as top 5 sugestões
    return list
      .filter(c => c.nome.toLowerCase().includes(querySug))
      .slice(0, 5);
  }, [dbClientes, pedidos, querySug, showSuggestions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
      {/* Calculadora (Esquerda - 7 cols) */}
      <div className="glass-card lg:col-span-7 p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200 pb-3 text-slate-900">
          <h2 className="text-lg font-black flex items-center gap-2">
            <IoCalculatorOutline /> Calculadora Inteligente de Projetos
          </h2>
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white text-xs font-black uppercase tracking-wider px-3.5 py-2 rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all scale-[1.02] hover:scale-[1.04]"
          >
            <IoSparklesOutline className="text-amber-300 animate-pulse" />
            IdeaCopilot 🤖
          </button>
        </div>

        <div className="space-y-6">
          {/* Grupo 1: Tipologia & Dimensões do Vão */}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-white/50 space-y-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <span>🏗️</span> 1. Tipologia & Dimensões do Vão
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="md:col-span-2 lg:col-span-1 xl:col-span-2">
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Modelo do Projeto</label>
                <div className="flex gap-2 items-center">
                  <select 
                    value={modeloObjId} 
                    onChange={e => {
                      const selId = e.target.value;
                      setModeloObjId(selId);
                      const sel = dbModelos.find(m => m.id === selId);
                      if (sel) {
                        const tProj = sel.tipoProjeto || 'outros';
                        setModelo(tProj);
                        setModeloNomeCompleto(sel.nome);
                        aplicarFolgasPadrao(tProj);
                      }
                    }} 
                    className="glass-input flex-1"
                  >
                    {dbModelos.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.icone || '🏗️'} {m.nome}
                      </option>
                    ))}
                    {dbModelos.length === 0 && <option value="">Nenhum modelo cadastrado</option>}
                  </select>
                  {modeloObjId && (
                    <button
                      type="button"
                      title="Editar este modelo de projeto"
                      onClick={() => {
                        const sel = dbModelos.find(m => m.id === modeloObjId);
                        if (sel) {
                          setEditingMaterial({ id: sel.id, tipoVidracaria: 'modelo', ...sel });
                        }
                      }}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-350 rounded-xl transition-all text-xs shrink-0"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Determina a tipologia do projeto (Box, Janela, Porta) e carrega as folgas e regras padrões.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Largura (mm)</label>
                <input type="number" placeholder="Ex: 1200" value={largura} onChange={e => setLargura(Math.max(1, parseInt(e.target.value) || 0))} className="glass-input w-full font-bold" />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Largura total da abertura medida na obra, em milímetros.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Altura (mm)</label>
                <input type="number" placeholder="Ex: 1900" value={altura} onChange={e => setAltura(Math.max(1, parseInt(e.target.value) || 0))} className="glass-input w-full font-bold" />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Altura total da abertura medida na obra, em milímetros.
                </span>
              </div>

              {/* Banners de Alerta de Segurança (NBR 7199 - Colapsável) */}
              {alertaSeguranca && (() => {
                const isSuccess = alertaSeguranca.tipo === 'success';
                const expanded = showCalcSafetyDetails !== null ? showCalcSafetyDetails : !isSuccess;
                
                return (
                  <div className={`md:col-span-2 lg:col-span-1 xl:col-span-2 rounded-xl border flex flex-col shadow-sm overflow-hidden transition-all duration-300 ${
                    alertaSeguranca.tipo === 'critical' 
                      ? 'bg-red-50/70 text-red-900 border-red-200/80' 
                      : alertaSeguranca.tipo === 'warning'
                      ? 'bg-amber-50/70 text-amber-900 border-amber-200/80'
                      : 'bg-emerald-50/70 text-emerald-900 border-emerald-200/80'
                  }`}>
                    {/* Header Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setShowCalcSafetyDetails(showCalcSafetyDetails === null ? isSuccess : !showCalcSafetyDetails)}
                      className="w-full flex items-center justify-between p-3.5 hover:bg-black/5 transition-all text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {alertaSeguranca.tipo === 'critical' ? '🚫' : alertaSeguranca.tipo === 'warning' ? '⚠️' : '🛡️'}
                        </span>
                        <div>
                          <span className="font-extrabold uppercase tracking-wider text-[10px] block">
                            {alertaSeguranca.tipo === 'critical' 
                              ? 'Alerta Crítico (ABNT NBR 7199)' 
                              : alertaSeguranca.tipo === 'warning' 
                              ? 'Alerta de Segurança (ABNT NBR 7199)' 
                              : 'Conformidade Técnica'}
                          </span>
                          {isSuccess && !expanded && (
                            <span className="text-[9px] text-emerald-700/85 font-bold block mt-0.5">
                              ✓ Sistema em total conformidade técnica.
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                          alertaSeguranca.score >= 90 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : alertaSeguranca.score >= 60 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200'
                        }`}>
                          Score: {alertaSeguranca.score}/100
                        </span>
                        <span className="text-slate-400 text-[10px] font-bold">
                          {expanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="p-3.5 border-t border-slate-200/50 bg-white/50 space-y-3">
                        {/* Progress score bar */}
                        <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              alertaSeguranca.score >= 90 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : alertaSeguranca.score >= 60 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                            }`}
                            style={{ width: `${alertaSeguranca.score}%` }}
                          />
                        </div>
                        
                        <p className="text-xs font-bold leading-relaxed">{alertaSeguranca.mensagem}</p>
                        
                        {/* Checklist Grid */}
                        {alertaSeguranca.checklist && alertaSeguranca.checklist.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-200/60">
                            {alertaSeguranca.checklist.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-2 bg-white/60 p-2 rounded-xl border border-slate-100 shadow-sm">
                                <span className="text-xs shrink-0 select-none">
                                  {item.status === 'success' ? '✅' : '❌'}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-black text-slate-800 leading-tight truncate">{item.text}</p>
                                  <p className="text-[9px] font-semibold text-slate-500 leading-tight mt-0.5">{item.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {alertaSeguranca.sugestoes && alertaSeguranca.sugestoes.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                            <span className="text-[10px] font-black uppercase text-slate-500">Ajuste Rápido:</span>
                            {alertaSeguranca.sugestoes.map((sug, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => {
                                  setLargura(sug.w);
                                  setAltura(sug.h);
                                }}
                                className="text-[10px] font-extrabold bg-white text-slate-800 hover:bg-slate-100 border border-slate-350 rounded-xl px-2.5 py-1.5 shadow-sm transition-all cursor-pointer hover:scale-95 active:scale-90"
                              >
                                {sug.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Grupo 2: Vidro & Acabamentos */}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-white/50 space-y-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <span>💎</span> 2. Vidro & Acabamentos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Tipo de Vidro</label>
                <div className="flex gap-2 items-center">
                  <select value={tipoVidroId} onChange={e => setTipoVidroId(e.target.value)} className="glass-input flex-1">
                    {filteredVidros.map(item => (
                      <option key={item.id} value={item.id}>{item.nome} - R$ {item.custoM2}/m²</option>
                    ))}
                    {filteredVidros.length === 0 && <option value="">Nenhum vidro disponível</option>}
                  </select>
                  {tipoVidroId && (
                    <button
                      type="button"
                      title="Editar este tipo de vidro"
                      onClick={() => {
                        const sel = dbVidros.find(v => v.id === tipoVidroId);
                        if (sel) {
                          setEditingMaterial({ id: sel.id, tipoVidracaria: 'vidro', ...sel });
                        }
                      }}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-350 rounded-xl transition-all text-xs shrink-0"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Especificação técnica e espessura do vidro utilizado (ex: Temperado 8mm).
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Cor do Vidro</label>
                <div className="flex gap-2 items-center">
                  <select value={corVidroId} onChange={e => setCorVidroId(e.target.value)} className="glass-input flex-1">
                    {filteredCores.map(item => (
                      <option key={item.id} value={item.id}>{item.nome} (+ R$ {item.adicionalM2}/m²)</option>
                    ))}
                    {filteredCores.length === 0 && <option value="">Nenhuma cor disponível</option>}
                  </select>
                  {corVidroId && (
                    <button
                      type="button"
                      title="Editar esta cor de vidro"
                      onClick={() => {
                        const sel = dbCores.find(c => c.id === corVidroId);
                        if (sel) {
                          setEditingMaterial({ id: sel.id, tipoVidracaria: 'cor', ...sel });
                        }
                      }}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-350 rounded-xl transition-all text-xs shrink-0"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Tonalidade do vidro que determina a estética e adicionais de preço por m².
                </span>
              </div>

              {(modelo === 'box' || modelo === 'janela' || modelo === 'porta') && (
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                    {modeloNomeCompleto.toLowerCase().includes('abrir') || modeloNomeCompleto.toLowerCase().includes('giro') || modeloNomeCompleto.toLowerCase().includes('pivotante')
                      ? 'Lado de Fixação (Dobradiça/Pivô)'
                      : 'Lado Móvel (Folha de Correr)'}
                  </label>
                  <select 
                    value={ladoAbertura} 
                    onChange={e => setLadoAbertura(e.target.value)} 
                    className="glass-input w-full"
                  >
                    <option value="esquerda">Esquerda</option>
                    <option value="direita">Direita</option>
                  </select>
                  <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                    Lado para onde a folha móvel corre ou onde as dobradiças serão fixadas.
                  </span>
                </div>
              )}

              {(modelo === 'box' || modelo === 'janela' || modelo === 'porta') && (
                modeloNomeCompleto.toLowerCase().includes('abrir') || 
                modeloNomeCompleto.toLowerCase().includes('giro') || 
                modeloNomeCompleto.toLowerCase().includes('pivotante') ||
                modeloNomeCompleto.toLowerCase().includes('basculante') || 
                modeloNomeCompleto.toLowerCase().includes('maxim-ar')
              ) && (
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Sentido de Abertura</label>
                  <select 
                    value={sentidoAbertura} 
                    onChange={e => setSentidoAbertura(e.target.value)} 
                    className="glass-input w-full"
                  >
                    <option value="dentro">Para Dentro</option>
                    <option value="fora">Para Fora</option>
                  </select>
                  <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                    Direção do movimento de abertura das folhas (para dentro ou para fora).
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Grupo 3: Alumínios, Kits & Componentes */}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-white/50 space-y-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <span>🛠️</span> 3. Alumínios, Kits & Componentes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Kit Ferragens/Alumínio</label>
                <div className="flex gap-2 items-center">
                  <select value={kitAluminioId} onChange={e => setKitAluminioId(e.target.value)} className="glass-input flex-1">
                    {filteredKits.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nome} - R$ {item.custo}
                      </option>
                    ))}
                    {filteredKits.length === 0 && <option value="">Nenhum kit disponível</option>}
                  </select>
                  {kitAluminioId && (
                    <button
                      type="button"
                      title="Editar este kit de alumínio"
                      onClick={() => {
                        const sel = dbKits.find(k => k.id === kitAluminioId);
                        if (sel) {
                          setEditingMaterial({ id: sel.id, tipoVidracaria: 'kit', ...sel });
                        }
                      }}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-350 rounded-xl transition-all text-xs shrink-0"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Kit padronizado de trilhos e ferragens para installation do modelo.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Acessório / Ferragem</label>
                <div className="flex gap-2 items-center">
                  <select value={acessorioId} onChange={e => setAcessorioId(e.target.value)} className="glass-input flex-1">
                    {filteredAcessorios.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nome} ({item.material === 'polimero' ? 'Polímero' : 'Zamac'}) - R$ {item.custo}
                      </option>
                    ))}
                    {filteredAcessorios.length === 0 && <option value="">Nenhum acessório disponível</option>}
                  </select>
                  {acessorioId && (
                    <button
                      type="button"
                      title="Editar este acessório/ferragem"
                      onClick={() => {
                        const sel = dbAcessorios.find(a => a.id === acessorioId);
                        if (sel) {
                          setEditingMaterial({ id: sel.id, tipoVidracaria: 'acessorio', ...sel });
                        }
                      }}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-350 rounded-xl transition-all text-xs shrink-0"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Componentes adicionais de fixação ou acabamento em Zamac ou Polímero.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Cor do Alumínio</label>
                <select value={corAluminio} onChange={e => setCorAluminio(e.target.value)} className="glass-input w-full">
                  {filteredCoresAluminio.map(item => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                  {filteredCoresAluminio.length === 0 && <option value="">Nenhuma cor permitida</option>}
                </select>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Acabamento superficial dos perfis de alumínio e ferragens (ex: Fosco, Branco).
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Tipo de Puxador</label>
                <select value={tipoPuxador} onChange={e => setTipoPuxador(e.target.value)} className="glass-input w-full">
                  {filteredTiposPuxador.map(item => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                  {filteredTiposPuxador.length === 0 && <option value="">Nenhum puxador permitido</option>}
                </select>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Modelo de puxador a ser instalado na folha móvel de vidro.
                </span>
              </div>

              {/* Seletor Visual de Perfis de Alumínio (Múltipla Seleção) */}
              <div className="md:col-span-2 lg:col-span-1 xl:col-span-2 text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center gap-1">
                    📐 Perfis de Alumínio Selecionados ({perfisSelecionados.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPerfilSelector(!showPerfilSelector)}
                    className="text-[9px] font-bold text-teal-600 hover:text-teal-800 underline underline-offset-2 transition-colors"
                  >
                    {showPerfilSelector ? 'Fechar Catálogo ✕' : 'Adicionar do Catálogo →'}
                  </button>
                </div>

                {/* Lista de Perfis Selecionados (Modo Compacto) */}
                {!showPerfilSelector && (() => {
                  const perfAtuais = PERFIS_ALUMINIO.filter(p => perfisSelecionados.includes(p.codigo));
                  const displayList = perfAtuais.length > 0 ? perfAtuais : [PERFIS_ALUMINIO[0]];
                  return (
                    <div className="flex flex-col gap-2">
                      {displayList.map(perf => (
                        <div
                          key={perf.codigo}
                          className="flex items-center justify-between p-2.5 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100/50 transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            <svg viewBox="0 0 30 20" className="w-10 h-7 shrink-0">
                              <rect width="30" height="20" fill="white" stroke="#d1d5db" strokeWidth="0.5" rx="1" />
                              <path d={perf.svg} fill="#0d9488" stroke="#0f766e" strokeWidth="0.5" fillRule="evenodd" />
                            </svg>
                            <div>
                              <p className="text-xs font-black text-slate-900">{perf.codigo}</p>
                              <p className="text-[9px] text-slate-500 font-semibold">{perf.nome} • {perf.categoria}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (perfisSelecionados.length > 1) {
                                setPerfisSelecionados(perfisSelecionados.filter(c => c !== perf.codigo));
                                toast.info(`📐 Perfil ${perf.codigo} removido.`);
                              } else {
                                toast.warning("Selecione pelo menos um perfil!");
                              }
                            }}
                            className="text-[10px] text-slate-400 hover:text-red-500 font-bold px-2 py-1 transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowPerfilSelector(true)}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all mt-1"
                      >
                        + Selecionar Outro Perfil do Catálogo
                      </button>
                    </div>
                  );
                })()}

                {/* Grid de Perfis (Catálogo Aberto) */}
                {showPerfilSelector && (() => {
                  const modelNameLower = selectedModel?.nome?.toLowerCase() || '';
                  const modelTipo = selectedModel?.tipoProjeto || '';
                  const basePerfis = (selectedModel && selectedModel.perfisPermitidos && selectedModel.perfisPermitidos.length > 0)
                    ? PERFIS_ALUMINIO.filter(p => selectedModel.perfisPermitidos.includes(p.codigo))
                    : PERFIS_ALUMINIO;
                  const filteredPerfis = basePerfis.filter(p => {
                    // 1. Filtragem por busca textual
                    if (searchPerfilQuery) {
                      const q = searchPerfilQuery.toLowerCase();
                      if (!p.codigo.toLowerCase().includes(q) && 
                          !p.nome.toLowerCase().includes(q) && 
                          !p.categoria.toLowerCase().includes(q)) {
                        return false;
                      }
                    }
                    
                    // 2. Filtragem por Linha de Alumínio
                    if (linhaAluminioId === 'suprema') {
                      return p.codigo.startsWith('SU-') || p.codigo.startsWith('GUA-') || p.codigo.startsWith('ESC-') || p.codigo.startsWith('ROL-');
                    }
                    if (linhaAluminioId === 'gold') {
                      return p.codigo.startsWith('LG-') || p.codigo.startsWith('GUA-') || p.codigo.startsWith('ESC-') || p.codigo.startsWith('ROL-');
                    }
                    if (linhaAluminioId === 'box' || modelTipo === 'box') {
                      return p.codigo.startsWith('AL-') || p.codigo.startsWith('GUA-') || p.codigo.startsWith('ESC-') || p.codigo.startsWith('ROL-');
                    }
                    if (linhaAluminioId === 'linha45') {
                      return p.codigo.startsWith('P45-') || p.codigo.startsWith('GUA-') || p.codigo.startsWith('ESC-') || p.codigo.startsWith('ROL-');
                    }
                    if (linhaAluminioId === 'linha25_30') {
                      return p.codigo.startsWith('L25-') || p.codigo.startsWith('L30-') || p.codigo.startsWith('GUA-') || p.codigo.startsWith('ESC-') || p.codigo.startsWith('ROL-');
                    }
                    
                    return true;
                  });
                  return (
                    <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-3 shadow-lg max-h-[420px] overflow-y-auto">
                      <div className="flex items-center gap-2 sticky top-0 bg-white z-10 pb-2">
                        <input
                          type="text"
                          placeholder="🔍 Buscar perfil... (código ou nome)"
                          value={searchPerfilQuery}
                          onChange={e => setSearchPerfilQuery(e.target.value)}
                          className="glass-input flex-1 text-[10px] py-1.5"
                        />
                        <span className="text-[8px] font-black text-slate-400 whitespace-nowrap">{filteredPerfis.length} perfis</span>
                      </div>
                      {/* Agrupar por categoria */}
                      {[...new Set(filteredPerfis.map(p => p.categoria))].map(cat => (
                        <div key={cat}>
                          <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1.5 border-b border-slate-100 pb-1">
                            {cat}
                          </p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {filteredPerfis.filter(p => p.categoria === cat).map(perfil => {
                              const isSelected = perfisSelecionados.includes(perfil.codigo);
                              return (
                                <button
                                  key={perfil.codigo}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      if (perfisSelecionados.length > 1) {
                                        setPerfisSelecionados(perfisSelecionados.filter(c => c !== perfil.codigo));
                                        toast.info(`📐 Perfil ${perfil.codigo} removido!`);
                                      } else {
                                        toast.warning("Selecione pelo menos um perfil!");
                                      }
                                    } else {
                                      setPerfisSelecionados([...perfisSelecionados, perfil.codigo]);
                                      toast.success(`📐 Perfil ${perfil.codigo} adicionado!`);
                                    }
                                  }}
                                  className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all hover:scale-105 ${
                                    isSelected
                                      ? 'border-teal-400 bg-teal-50 shadow-md shadow-teal-200/50'
                                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                                  }`}
                                >
                                  <svg viewBox="0 0 30 20" className="w-14 h-10">
                                    <rect width="30" height="20" fill="white" stroke="#e2e8f0" strokeWidth="0.3" rx="1" />
                                    <path 
                                      d={perfil.svg} 
                                      fill={isSelected ? '#0d9488' : '#94a3b8'} 
                                      stroke={isSelected ? '#0f766e' : '#64748b'} 
                                      strokeWidth="0.4" 
                                      fillRule="evenodd" 
                                    />
                                  </svg>
                                  <span className={`text-[8px] font-black mt-1 ${isSelected ? 'text-teal-700' : 'text-slate-600'}`}>
                                    {perfil.codigo}
                                  </span>
                                  <span className="text-[7px] text-slate-400 font-semibold leading-tight text-center truncate w-full">
                                    {perfil.nome}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Grupo 4: Parâmetros Técnicos & Folgas */}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-white/50 space-y-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <span>⚙️</span> 4. Parâmetros Técnicos & Folgas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Ângulo de Corte</label>
                <select value={anguloCorte} onChange={e => setAnguloCorte(e.target.value)} className="glass-input w-full font-bold">
                  {filteredAngulosCorte.map(item => (
                    <option key={item.id} value={String(item.id)}>{item.nome}</option>
                  ))}
                  {filteredAngulosCorte.length === 0 && <option value="">Nenhum ângulo permitido</option>}
                </select>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Ângulo de corte das pontas dos perfis de alumínio (90º reto ou 45º meia-esquadria).
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Cenário de Fundo (3D)</label>
                <select value={cenarioFundo} onChange={e => setCenarioFundo(e.target.value)} className="glass-input w-full">
                  {filteredCenariosFundo.map(item => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                  {filteredCenariosFundo.length === 0 && <option value="">Nenhum cenário permitido</option>}
                </select>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Ambiente tridimensional de fundo para simulação realista do projeto.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Folga Largura (mm)</label>
                <input type="number" placeholder="Ex: 50" value={folgaLargura} onChange={e => setFolgaLargura(parseInt(e.target.value) || 0)} className="glass-input w-full font-bold" />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Valor somado à largura total para compensar transpassos entre as folhas.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Desconto Altura Fixo (mm)</label>
                <input type="number" placeholder="Ex: 55" value={descontoAltura} onChange={e => setDescontoAltura(parseInt(e.target.value) || 0)} className="glass-input w-full font-bold" />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Valor subtraído da altura total para folga dos perfis da folha fixa.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Desconto Altura Móvel (mm)</label>
                <input type="number" placeholder="Ex: 20" value={descontoAlturaMovel} onChange={e => setDescontoAlturaMovel(parseInt(e.target.value) || 0)} className="glass-input w-full font-bold" />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Valor subtraído da altura total para folga e curso da folha móvel (porta).
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Arredondamento Têmpera</label>
                <select value={arredondamentoMm} onChange={e => setArredondamentoMm(parseInt(e.target.value))} className="glass-input w-full">
                  {filteredArredondamentos.map(item => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                  {filteredArredondamentos.length === 0 && <option value="0">Sem arredondamento</option>}
                </select>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Múltiplo de arredondamento das dimensões exigido pela têmpera para faturamento.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Área Mínima Faturamento</label>
                <select value={areaMinimaM2} onChange={e => setAreaMinimaM2(parseFloat(e.target.value))} className="glass-input w-full">
                  {filteredAreasMinimas.map(item => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                  {filteredAreasMinimas.length === 0 && <option value="0">Sem área mínima</option>}
                </select>
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Área mínima cobrada por folha individual pelas têmperas parceiras.
                </span>
              </div>
            </div>
          </div>

          {/* Grupo 5: Precificação & Margem */}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-white/50 space-y-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <span>💰</span> 5. Precificação & Margem
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Mão de Obra (R$)</label>
                <input type="number" value={custoMaoObra} onChange={e => setCustoMaoObra(Math.max(0, parseFloat(e.target.value) || 0))} className="glass-input w-full font-bold" />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Custo estimado do serviço de instalação e montagem do projeto.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Frete/Transporte (R$)</label>
                <input type="number" value={custoFrete} onChange={e => setCustoFrete(Math.max(0, parseFloat(e.target.value) || 0))} placeholder="0" className="glass-input w-full font-bold" />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Custo logístico de transporte e entrega dos materiais até a obra.
                </span>
              </div>

              <div className="md:col-span-2 lg:col-span-1 xl:col-span-2">
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Markup de Lucro ({markupPercent}%)</label>
                <div className="flex items-center gap-2">
                  <input type="range" min="10" max="250" step="5" value={markupPercent} onChange={e => setMarkupPercent(parseInt(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900" />
                  <span className="text-xs font-bold font-mono text-slate-800">{markupPercent}%</span>
                </div>
                <span className="text-[10px] text-slate-700 font-semibold mt-1.5 block leading-tight">
                  Percentual de margem de lucro aplicado sobre o custo total para gerar o preço de venda.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sumário */}
        <div className="glass-details bg-slate-100/50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Área Faturada</span>
            <span className="text-sm font-black font-mono">{areaSqm.toFixed(3)} m²</span>
            <span className="text-[9px] text-slate-400 block font-mono">Real: {areaRealSqm.toFixed(3)} m²</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Custo Total Matéria</span>
            <span className="text-sm font-black font-mono">R$ {totalCostPrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Margem Adicionada</span>
            <span className="text-sm font-black font-mono text-slate-700">R$ {(salePrice - totalCostPrice).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-900 block">Preço Final Orçado</span>
            <span className="text-base font-black font-mono text-emerald-600">R$ {salePrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Memória de Cálculo Dinâmica */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3 shadow-sm">
          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
            <span>🧾</span> Memória de Cálculo & Regras de Têmpera
          </h4>
          <div className="space-y-2.5 text-xs text-slate-600">
            {/* Comparativo de Medidas */}
            <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/50 space-y-1.5 font-sans">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-slate-500">Modelo do Projeto:</span>
                <span className="font-bold text-slate-800">{selectedModel?.nome || 'Não selecionado'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-slate-500">Medidas do Vão Obra:</span>
                <span className="font-bold font-mono text-slate-800">{largura} x {altura} mm</span>
              </div>
              <div className="flex justify-between text-[11px] bg-slate-50 px-1.5 py-0.5 rounded border border-dashed border-slate-200/60">
                <span className="font-semibold text-slate-500">Engenharia (Folga/Descontos):</span>
                <span className="font-bold font-mono text-slate-700">
                  +{folgaLargura}mm larg | -{descontoAltura}mm alt fixo | -{descontoAlturaMovel}mm alt móvel
                </span>
              </div>
              <div className="flex flex-col gap-0.5 border-t border-slate-100 pt-1.5">
                <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wide">Medidas de Corte do Vidro:</span>
                {qtdFixas > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">• Fixo:</span>
                    <span className="font-bold font-mono text-emerald-600">
                      {qtdFixas} fls de {larguraVidroFolha} x {alturaVidroFixoFolha} mm
                    </span>
                  </div>
                )}
                {qtdMoveis > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">• Móvel/Porta:</span>
                    <span className="font-bold font-mono text-emerald-600">
                      {qtdMoveis} fls de {larguraVidroFolha} x {alturaVidroMovelFolha} mm
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-0.5">
                  <span>Área Real Total:</span>
                  <span className="font-mono">{areaRealSqm.toFixed(3)} m²</span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5 border-t border-slate-100 pt-1.5">
                <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wide">Faturado Têmpera (Arred.):</span>
                {qtdFixas > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">• Fixo (Arred.):</span>
                    <span className="font-bold font-mono text-slate-900">
                      {qtdFixas} fls de {Math.round(larguraFaturadaFolha * 1000)} x {Math.round(alturaFaturadaFixoFolha * 1000)} mm
                    </span>
                  </div>
                )}
                {qtdMoveis > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">• Móvel (Arred.):</span>
                    <span className="font-bold font-mono text-slate-900">
                      {qtdMoveis} fls de {Math.round(larguraFaturadaFolha * 1000)} x {Math.round(alturaFaturadaMovelFolha * 1000)} mm
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-0.5">
                  <span>Área Faturada Total:</span>
                  <span className="font-mono">{areaSqm.toFixed(3)} m²</span>
                </div>
              </div>
              {areaMinimaM2 > 0 && ((qtdFixas > 0 && areaTeoricaFixoFolha < areaMinimaM2) || (qtdMoveis > 0 && areaTeoricaMovelFolha < areaMinimaM2)) && (
                <div className="text-[10px] font-bold text-amber-600 flex items-center gap-1 pt-1 border-t border-dashed border-slate-200 mt-1">
                  <span>⚠️</span> Aplicada Área Mínima de {areaMinimaM2.toFixed(2)} m² por folha
                  {qtdFixas > 0 && areaTeoricaFixoFolha < areaMinimaM2 && ` (Fixo era ${areaTeoricaFixoFolha.toFixed(3)} m²)`}
                  {qtdMoveis > 0 && areaTeoricaMovelFolha < areaMinimaM2 && ` (Móvel era ${areaTeoricaMovelFolha.toFixed(3)} m²)`}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
              <span className="font-semibold text-slate-700">Vidro Base ({selectedVidro?.nome || 'Carregando...'})</span>
              <span className="font-mono text-slate-600">R$ {selectedVidro?.custoM2 || 0} x {areaSqm.toFixed(3)}m² = <strong className="text-slate-900 font-extrabold">R$ {(areaSqm * (selectedVidro?.custoM2 || 0)).toFixed(2)}</strong></span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
              <span className="font-semibold text-slate-700">Adicional Cor ({selectedCor?.nome || 'Carregando...'})</span>
              <span className="font-mono text-slate-600">+ R$ {selectedCor?.adicionalM2 || 0} x {areaSqm.toFixed(3)}m² = <strong className="text-slate-900 font-extrabold">R$ {(areaSqm * (selectedCor?.adicionalM2 || 0)).toFixed(2)}</strong></span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
              <span className="font-semibold text-slate-700">Acessórios / Kit Ferragem ({selectedKit?.nome || 'Nenhum'})</span>
              <span className="font-mono text-slate-600">Custo Kit = <strong className="text-slate-900 font-extrabold">R$ {Number(selectedKit?.custo || 0).toFixed(2)}</strong></span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
              <span className="font-semibold text-slate-700">Acessório Extra ({selectedAcessorio?.nome || 'Nenhum'} - {selectedAcessorio?.material === 'polimero' ? 'Polímero' : 'Zamac'})</span>
              <span className="font-mono text-slate-600">Custo = <strong className="text-slate-900 font-extrabold">R$ {Number(selectedAcessorio?.custo || 0).toFixed(2)}</strong></span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
              <span className="font-semibold text-slate-700">Mão de Obra & Instalação</span>
              <span className="font-mono text-slate-600">Valor fixo = <strong className="text-slate-900 font-extrabold">R$ {Number(custoMaoObra).toFixed(2)}</strong></span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
              <span className="font-semibold text-slate-700">Ângulo de Corte</span>
              <span className="font-mono text-slate-600">Configurado = <strong className="text-slate-900 font-extrabold">{anguloCorte}º</strong></span>
            </div>
            {Number(custoFrete) > 0 && (
              <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
                <span className="font-semibold text-slate-700">Frete / Transporte</span>
                <span className="font-mono text-slate-600">Valor fixo = <strong className="text-slate-900 font-extrabold">R$ {Number(custoFrete).toFixed(2)}</strong></span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 mt-2 bg-slate-100 border border-slate-200 px-3 rounded-lg text-slate-900 font-black">
              <span>Margem Markup ({markupPercent}%)</span>
              <span className="font-mono">R$ {totalCostPrice.toFixed(2)} x {markupPercent}% = <strong>R$ {(salePrice - totalCostPrice).toFixed(2)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Visualizer & Cadastro OS (Direita - 5 cols) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        {/* Visualizador Esquemático com Linhas de Cota */}
        <div className="glass-card p-5 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden group">
          {/* 2D / 3D Toggle */}
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 print:hidden z-10">
            <button
              key="2d-btn"
              type="button"
              onClick={() => setViewMode3D(false)}
              className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${!viewMode3D ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Vista 2D
            </button>
            <button
              key="3d-btn"
              type="button"
              onClick={() => setViewMode3D(true)}
              className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${viewMode3D ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Vista 3D
            </button>
          </div>

          <div className="absolute top-3 right-3 flex items-center gap-1.5 print:hidden z-10">
            <button
              type="button"
              onClick={() => setPreviewOpen(!previewOpen)}
              className="text-[10px] uppercase font-black tracking-wider text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm hover:bg-slate-50 transition-all cursor-pointer font-bold"
            >
              {previewOpen ? 'Ver Fechado 🔒' : 'Ver Aberto 🔓'}
            </button>
          </div>

          <div className="w-full flex-grow flex items-center justify-center p-4 mt-8">
            {viewMode3D ? (
              <div className="w-full h-[230px]">
                <ThreeDProjectViewer
                  tipo="vidracaria"
                  modeloType={modelo}
                  modeloNome={modeloNomeCompleto}
                  w={larguraVidro}
                  h={alturaVidro}
                  lado={ladoAbertura}
                  sentido={sentidoAbertura}
                  puxador={tipoPuxador}
                  aluminio={corAluminio}
                  corGlass={selectedCor?.nome || 'Incolor'}
                  isOpen={previewOpen}
                  wVao={largura}
                  hVao={altura}
                  cenarioFundo={cenarioFundo}
                  onChangeDimensions={(newW, newH) => {
                    if (newW !== undefined) setLargura(newW);
                    if (newH !== undefined) setAltura(newH);
                  }}
                />
              </div>
            ) : (
              <ProjectSvgViewer
                modeloType={modelo}
                modeloNome={modeloNomeCompleto}
                w={larguraVidro}
                h={alturaVidro}
                wVao={largura}
                hVao={altura}
                lado={ladoAbertura}
                sentido={sentidoAbertura}
                puxador={tipoPuxador}
                aluminio={corAluminio}
                corGlass={selectedCor?.nome}
                isOpen={previewOpen}
              />
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-extrabold mt-1 text-center bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg w-full leading-normal">
            📏 Vão Obra: {largura}x{altura} mm | 🔍 Corte: {qtdFixas > 0 ? `${qtdFixas} Fixo (${larguraVidroFolha}x${alturaVidroFixoFolha})` : ''}{qtdFixas > 0 && qtdMoveis > 0 ? ' + ' : ''}{qtdMoveis > 0 ? `${qtdMoveis} Móvel (${larguraVidroFolha}x${alturaVidroMovelFolha})` : ''} mm
          </div>
        </div>

        {/* Plano de Corte & Engenharia */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
            <span>📐</span> Engenharia & Plano de Corte (Chapa Padrão)
          </h3>
          
          {/* Descontos e Folgas */}
          <div className="text-xs text-slate-600 space-y-1.5">
            <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider block">Folgas Aplicadas</span>
            {modelo === 'box' && (
              <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                🔧 <strong>Box de Correr:</strong> Subtração padrão de <strong>50 mm</strong> na altura do vidro para folga dos trilhos e transpasso de <strong>50 mm</strong> na largura para transpasse das folhas de vedação.
              </p>
            )}
            {modelo === 'janela' && (
              <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                🔧 <strong>Janela de Correr:</strong> Subtração padrão de <strong>30 mm</strong> na altura e transpasso de <strong>40 mm</strong> na largura das folhas.
              </p>
            )}
            {modelo === 'porta' && (
              <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                🔧 <strong>Porta de Correr:</strong> Subtração de <strong>40 mm</strong> na altura e transpasso de <strong>50 mm</strong> na largura das folhas.
              </p>
            )}
            {modelo === 'espelho' && (
              <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                🔧 <strong>Espelho sob Medida:</strong> Medida nominal exata para colagem direta. Sem folgas.
              </p>
            )}
            {modelo === 'outros' && (
              <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                🔧 <strong>Projeto Personalizado:</strong> Folgas e descontos devem ser calculados manualmente.
              </p>
            )}
          </div>

          {/* Plano de Corte */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-4">
            {/* SVG Otimizador */}
            {largura <= 3210 && altura <= 2200 ? (
              <svg width="150" height="103" className="border border-slate-300 bg-slate-100 rounded-lg shrink-0">
                {/* Chapa Padrão */}
                <rect width="150" height="103" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
                {/* Peça Cortada */}
                <rect 
                  width={(largura * 0.0467).toFixed(1)} 
                  height={(altura * 0.0467).toFixed(1)} 
                  fill="rgba(16, 185, 129, 0.15)" 
                  stroke="#10b981" 
                  strokeWidth="1.5" 
                />
                <text x="75" y="55" fill="#64748b" fontSize="8" textAnchor="middle" fontWeight="bold">Chapa 3.21x2.20m</text>
              </svg>
            ) : (
              <div className="w-[150px] h-[103px] bg-red-50 border border-red-200 rounded-lg flex items-center justify-center p-2 text-center text-[9px] font-black text-red-600 shrink-0">
                ⚠️ MEDIDA EXCEDIDA! Excede limite da chapa.
              </div>
            )}

            <div className="text-xs space-y-1">
              <span className="font-extrabold text-[10px] uppercase tracking-wider text-slate-800 block">Otimização de Matéria-Prima</span>
              <p className="text-slate-600">Aproveitamento: <strong>{((areaRealSqm / 7.062) * 100).toFixed(1)}%</strong> da chapa padrão.</p>
              <p className="text-slate-400 text-[10px]">Área da chapa: 7.06 m² (3.21 x 2.20m)</p>
              {largura > 3210 || altura > 2200 ? (
                <p className="text-red-600 font-bold text-[9px] mt-1">⚠️ Peça não cabe em chapa comum. Necessário vidro Jumbo.</p>
              ) : (
                <p className="text-emerald-600 font-semibold text-[9px] mt-1">✓ Peça cabe na chapa padrão de têmperas.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const pecasParaOtimizar = [];
              if (qtdFixas > 0) {
                pecasParaOtimizar.push({
                  id: Date.now() + 1,
                  largura: larguraVidroFolha,
                  altura: alturaVidroFixoFolha,
                  qtd: qtdFixas,
                  label: `${modeloNomeCompleto || 'Vidro'} (Fixo) (${largura}x${altura} mm)`
                });
              }
              if (qtdMoveis > 0) {
                pecasParaOtimizar.push({
                  id: Date.now() + 2,
                  largura: larguraVidroFolha,
                  altura: alturaVidroMovelFolha,
                  qtd: qtdMoveis,
                  label: `${modeloNomeCompleto || 'Vidro'} (Móvel) (${largura}x${altura} mm)`
                });
              }
              if (onSendToOtimizer) {
                onSendToOtimizer(pecasParaOtimizar);
              }
            }}
            className="mt-3.5 w-full py-2.5 bg-gradient-to-r from-teal-600 to-teal-800 hover:from-teal-700 hover:to-teal-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            🚀 Enviar Peças para o Plano de Corte
          </button>
        </div>

        {/* Criar OS */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 mb-4">
            📝 Salvar Orçamento / Abrir OS
          </h3>
          
          <form onSubmit={handleCreateOS} className="space-y-4">
            {/* Nome do Cliente */}
            <div className="relative">
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Nome do Cliente</label>
              <input
                type="text"
                required
                placeholder="Ex: João da Silva"
                value={clienteNome}
                onChange={e => {
                  setClienteNome(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="glass-input w-full py-2.5"
              />
              <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                Nome completo do cliente para emissão da OS e controle de cadastro.
              </span>
              
              {/* Dropdown de sugestão flutuante */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden max-h-48 overflow-y-auto">
                  {suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setClienteNome(sug.nome);
                        setClienteTelefone(sug.telefone);
                        setClienteEndereco(sug.endereco);
                        setClienteCep(sug.cep || '');
                        setShowSuggestions(false);
                        toast.success(`👥 Cliente ${sug.nome} carregado!`);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 text-xs font-semibold text-slate-700 flex flex-col gap-0.5"
                    >
                      <span className="font-extrabold text-slate-900">{sug.nome}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        📞 {sug.telefone || 'Sem telefone'} | 📍 {sug.endereco || 'Sem endereço'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  value={clienteTelefone}
                  onChange={e => setClienteTelefone(e.target.value)}
                  onFocus={() => setShowSuggestions(false)}
                  className="glass-input w-full py-2.5"
                />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Número de contato do cliente para comunicação.
                </span>
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Previsão de Instalação</label>
                <input
                  type="date"
                  value={dataInstalacao}
                  onChange={e => setDataInstalacao(e.target.value)}
                  onFocus={() => setShowSuggestions(false)}
                  className="glass-input w-full py-2.5"
                />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Data agendada ou prometida para a entrega/instalação.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">CEP (Local da Obra)</label>
                <input
                  type="text"
                  placeholder="Ex: 01001-000"
                  value={clienteCep}
                  onChange={e => handleCepLookup(e.target.value)}
                  onFocus={() => setShowSuggestions(false)}
                  maxLength={9}
                  className="glass-input w-full py-2.5 font-bold text-slate-800 placeholder:text-slate-400"
                />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  CEP do local da obra para buscar o endereço automaticamente.
                </span>
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Instalador Responsável</label>
                <input
                  type="text"
                  placeholder="Nome do instalador"
                  value={vidraceiro}
                  onChange={e => setVidraceiro(e.target.value)}
                  onFocus={() => setShowSuggestions(false)}
                  className="glass-input w-full py-2.5"
                />
                <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                  Nome do profissional encarregado de executar a instalação.
                </span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Endereço de Entrega Completo</label>
              <input
                type="text"
                placeholder="Rua, Número, Bairro, Cidade - UF"
                value={clienteEndereco}
                onChange={e => setClienteEndereco(e.target.value)}
                onFocus={() => setShowSuggestions(false)}
                className="glass-input w-full py-2.5"
              />
              <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                Endereço completo onde o vidro e acessórios serão instalados.
              </span>
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Observações Adicionais</label>
              <textarea
                placeholder="Detalhes específicos da obra, horários ou restrições..."
                rows="2"
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                className="glass-input w-full text-xs"
              />
              <span className="text-[10px] text-slate-700 font-semibold mt-1 block leading-tight">
                Instruções extras relevantes para a fabricação ou instalação.
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-slate-900 to-emerald-700 hover:from-black hover:to-emerald-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <IoCheckmarkCircleOutline size={16} /> Confirmar & Criar Ordem de Serviço
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CalculadoraTab;
