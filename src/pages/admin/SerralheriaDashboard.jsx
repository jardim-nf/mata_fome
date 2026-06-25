// src/pages/admin/SerralheriaDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import BackButton from '../../components/BackButton';
import { toast } from 'react-toastify';
import { 
  IoCalculatorOutline, 
  IoBuildOutline, 
  IoPersonOutline, 
  IoAnalyticsOutline, 
  IoListOutline, 
  IoGridOutline,
  IoCutOutline,
  IoRefreshOutline,
  IoAddOutline,
  IoTrashOutline,
  IoDownloadOutline
} from 'react-icons/io5';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import './SerralheriaDashboard.css';

// Sub-componentes
import DashboardTab from './Serralheria/components/DashboardTab';
import CalculadoraTab from './Serralheria/components/CalculadoraTab';
import KanbanTab from './Serralheria/components/KanbanTab';
import CatalogoTab from './Serralheria/components/CatalogoTab';
import ClientesTab from './Serralheria/components/ClientesTab';
import OsDetailModal from './Serralheria/components/OsDetailModal';
import EditMaterialModal from './Serralheria/components/EditMaterialModal';
import ModalFinalizacaoOS from './Serralheria/components/ModalFinalizacaoOS';

const STATUS_FLOW = ['orcamento', 'medicao', 'producao', 'instalacao', 'concluido'];

const STATUS_OS = {
  orcamento: { label: 'Orçamento', color: 'bg-amber-50 text-amber-700 border-amber-200', borderCol: 'border-l-amber-500' },
  medicao: { label: 'Medição', color: 'bg-slate-100 text-slate-800 border-slate-300', borderCol: 'border-l-slate-600' },
  producao: { label: 'Corte & Solda', color: 'bg-purple-50 text-purple-700 border-purple-200', borderCol: 'border-l-purple-500' },
  instalacao: { label: 'Pintura/Instal.', color: 'bg-orange-50 text-orange-700 border-orange-200', borderCol: 'border-l-orange-500' },
  concluido: { label: 'Concluído', color: 'bg-green-50 text-green-700 border-green-200', borderCol: 'border-l-emerald-500' }
};

const SerralheriaDashboard = () => {
  const { estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal;

  // Controle de Abas
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, calculadora, otimizador, kanban, catalogo, clientes

  // Dados do Firestore
  const [pedidos, setPedidos] = useState([]);
  const [dbVidros, setDbVidros] = useState([]); // perfis metalon
  const [dbCores, setDbCores] = useState([]); // coberturas
  const [dbKits, setDbKits] = useState([]); // acessorios
  const [dbModelos, setDbModelos] = useState([]); // modelos de projetos
  const [dbClientes, setDbClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form de OS (Sincronizado do filho)
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEndereco, setClienteEndereco] = useState('');
  const [clienteCep, setClienteCep] = useState('');
  const [dataInstalacao, setDataInstalacao] = useState('');
  const [vidraceiro, setVidraceiro] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Modais
  const [selectedOS, setSelectedOS] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [osParaFinalizar, setOsParaFinalizar] = useState(null);
  const [salvandoOS, setSalvandoOS] = useState(false);

  // Estados do Otimizador 1D
  const [otimizerPecas, setOtimizerPecas] = useState([
    { id: 1, length: 1500, qtd: 4, label: 'Marco Sup/Inf' },
    { id: 2, length: 1900, qtd: 4, label: 'Marco Lateral' },
    { id: 3, length: 1800, qtd: 8, label: 'Travessas Grade' }
  ]);
  const [novaPecaLength, setNovaPecaLength] = useState('');
  const [novaPecaQtd, setNovaPecaQtd] = useState(1);
  const [novaPecaLabel, setNovaPecaLabel] = useState('');
  const [barsOptimized, setBarsOptimized] = useState([]);
  const [optimizationStats, setOptimizationStats] = useState(null);

  // Bloquear scroll do body quando o modal da OS estiver aberto
  useEffect(() => {
    if (selectedOS) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedOS]);

  // --- ESCUTAS FIRESTORE ---
  useEffect(() => {
    if (!estabId) return;

    const unsubInsumos = onSnapshot(
      collection(db, 'estabelecimentos', estabId, 'insumos'),
      (snap) => {
        const allInsumos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const filtered = allInsumos.filter(i => i.modulo === 'serralheria');
        const vidros = filtered.filter(i => i.tipoVidracaria === 'vidro');
        const cores = filtered.filter(i => i.tipoVidracaria === 'cor');
        const kits = filtered.filter(i => i.tipoVidracaria === 'kit');
        const modelos = filtered.filter(i => i.tipoVidracaria === 'modelo');

        setDbVidros(vidros);
        setDbCores(cores);
        setDbKits(kits);
        setDbModelos(modelos);
      },
      (err) => {
        console.error('Erro ao escutar insumos:', err);
      }
    );

    const unsubPedidos = onSnapshot(
      collection(db, 'estabelecimentos', estabId, 'ordensServico'),
      (snap) => {
        const osList = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.modulo === 'serralheria');

        osList.sort((a, b) => {
          const dateA = a.criadoEm ? new Date(a.criadoEm) : new Date(0);
          const dateB = b.criadoEm ? new Date(b.criadoEm) : new Date(0);
          return dateB - dateA;
        });

        setPedidos(osList);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao escutar ordens de serviço:', err);
        setLoading(false);
      }
    );

    const unsubClientes = onSnapshot(
      collection(db, 'estabelecimentos', estabId, 'clientes'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDbClientes(list);
      },
      (err) => {
        console.error('Erro ao escutar clientes:', err);
      }
    );

    return () => {
      unsubInsumos();
      unsubPedidos();
      unsubClientes();
    };
  }, [estabId]);

  // Seeding de Insumos Padrão para Locksmith
  const handleSeedInsumos = async () => {
    const defaultInsumos = [
      // Perfis (tipoVidracaria: 'vidro')
      { nome: 'Metalon 50x50x2.00mm', custo: 180, pesoMetro: 2.8, modulo: 'serralheria', tipoVidracaria: 'vidro', custoBarra: 180, custoM2: 30 },
      { nome: 'Metalon 30x30x1.50mm', custo: 110, pesoMetro: 1.3, modulo: 'serralheria', tipoVidracaria: 'vidro', custoBarra: 110, custoM2: 18.3 },
      { nome: 'Metalon 20x20x1.50mm', custo: 80, pesoMetro: 0.9, modulo: 'serralheria', tipoVidracaria: 'vidro', custoBarra: 80, custoM2: 13.3 },
      { nome: 'Tubo Redondo 2" x 1.50mm', custo: 140, pesoMetro: 2.1, modulo: 'serralheria', tipoVidracaria: 'vidro', custoBarra: 140, custoM2: 23.3 },
      // Coberturas (tipoVidracaria: 'cor')
      { nome: 'Chapa Policarbonato Alveolar 6mm', custo: 85, adicionalM2: 85, modulo: 'serralheria', tipoVidracaria: 'cor' },
      { nome: 'Chapa Policarbonato Compacto 3mm', custo: 220, adicionalM2: 220, modulo: 'serralheria', tipoVidracaria: 'cor' },
      { nome: 'Telha Termoacústica Sanduíche', custo: 160, adicionalM2: 160, modulo: 'serralheria', tipoVidracaria: 'cor' },
      { nome: 'Telha Galvalume Trapézio', custo: 65, adicionalM2: 65, modulo: 'serralheria', tipoVidracaria: 'cor' },
      // Acessorios (tipoVidracaria: 'kit')
      { nome: 'Roldana de Nylon c/ Rolamento', custo: 25, modulo: 'serralheria', tipoVidracaria: 'kit' },
      { nome: 'Kit Fechadura p/ Portão de Correr', custo: 60, modulo: 'serralheria', tipoVidracaria: 'kit' },
      { nome: 'Puxador Barra Inox 60cm', custo: 95, modulo: 'serralheria', tipoVidracaria: 'kit' },
      { nome: 'Caixa de Eletrodo p/ Solda', custo: 120, modulo: 'serralheria', tipoVidracaria: 'kit' },
      // Modelos (tipoVidracaria: 'modelo')
      { nome: 'Portão Deslizante Gradeado', tipoProjeto: 'portao', larguraPadrao: 3000, alturaPadrao: 2000, espacamentoPadrao: 120, custoMaoObra: 400, markupPercent: 60, modulo: 'serralheria', tipoVidracaria: 'modelo' },
      { nome: 'Telhado de Policarbonato Reto', tipoProjeto: 'telhado', larguraPadrao: 4000, alturaPadrao: 3000, caimentoPadrao: 10, custoMaoObra: 600, markupPercent: 70, modulo: 'serralheria', tipoVidracaria: 'modelo' },
      { nome: 'Guarda-corpo de Sacada', tipoProjeto: 'grade', larguraPadrao: 2500, alturaPadrao: 1000, espacamentoPadrao: 110, custoMaoObra: 300, markupPercent: 60, modulo: 'serralheria', tipoVidracaria: 'modelo' },
      { nome: 'Mesa Estilo Industrial', tipoProjeto: 'movel', larguraPadrao: 1600, alturaPadrao: 750, custoMaoObra: 250, markupPercent: 70, modulo: 'serralheria', tipoVidracaria: 'modelo' }
    ];

    try {
      const promises = defaultInsumos.map(ins => 
        addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), ins)
      );
      await Promise.all(promises);
      toast.success('🎉 Insumos e Modelos padrão importados com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao importar insumos padrão.');
    }
  };

  // CEP Lookup
  const handleCepLookup = async (cepValue) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    setClienteCep(cleanCep);
    
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data && !data.erro) {
          const autoEnd = `${data.logradouro}${data.bairro ? ` - ${data.bairro}` : ''}, ${data.localidade} - ${data.uf}`;
          setClienteEndereco(autoEnd);
          toast.success('📍 CEP localizado e preenchido!');
        } else {
          toast.error('CEP não encontrado.');
        }
      } catch (err) {
        console.error('Erro ao consultar CEP:', err);
      }
    }
  };

  // Criar OS
  const handleCreateOS = async (payload) => {
    try {
      // Registrar cliente se não existir
      const cleanPhone = payload.cliente.telefone.replace(/\D/g, '');
      const clientExists = dbClientes.some(c => {
        const cPhone = (c.telefone || '').replace(/\D/g, '');
        const matchPhone = cleanPhone && cPhone && cPhone === cleanPhone;
        const matchNome = c.nome && c.nome.toLowerCase() === payload.cliente.nome.toLowerCase();
        return matchPhone || matchNome;
      });

      let finalClienteId = null;

      if (!clientExists) {
        let clientId = cleanPhone;
        const hasValidPhone = cleanPhone && cleanPhone.length >= 8;
        if (!hasValidPhone) {
          clientId = doc(collection(db, 'estabelecimentos', estabId, 'clientes')).id;
        }

        const clientData = {
          id: clientId,
          nome: payload.cliente.nome.toUpperCase().trim(),
          telefone: cleanPhone || '',
          cpf: null,
          email: null,
          limiteCrediario: 0,
          saldoDevedor: 0,
          nascimento: null,
          endereco: payload.cliente.endereco ? payload.cliente.endereco.toUpperCase().trim() : '',
          cep: payload.cliente.cep || '',
          saldoCashback: 0,
          fidelidade: { carimbos: 0, premioDisponivel: false, cartelasCompletadas: 0 },
          criadoEm: new Date()
        };

        await setDoc(doc(db, 'estabelecimentos', estabId, 'clientes', clientId), clientData);

        if (hasValidPhone) {
          await setDoc(doc(db, 'clientes', cleanPhone), {
            nome: clientData.nome,
            telefone: clientData.telefone,
            cpf: clientData.cpf,
            email: clientData.email,
            limiteCrediario: clientData.limiteCrediario,
            endereco: clientData.endereco,
            nascimento: clientData.nascimento,
            criadoEm: clientData.criadoEm
          });
        }
        finalClienteId = clientId;
        toast.success(`👥 Novo cliente ${clientData.nome} cadastrado com sucesso!`);
      } else {
        const existing = dbClientes.find(c => {
          const cPhone = (c.telefone || '').replace(/\D/g, '');
          const matchPhone = cleanPhone && cPhone && cPhone === cleanPhone;
          const matchNome = c.nome && c.nome.toLowerCase() === payload.cliente.nome.toLowerCase();
          return matchPhone || matchNome;
        });
        if (existing) {
          finalClienteId = existing.id;
        }
      }

      const finalPayload = {
        ...payload,
        clienteId: finalClienteId
      };

      await addDoc(collection(db, 'estabelecimentos', estabId, 'ordensServico'), finalPayload);
      toast.success('✅ Orçamento / OS cadastrada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar OS no banco de dados.');
    }
  };

  // Deletar OS
  const handleDeleteOS = async (id) => {
    if (!window.confirm('Tem certeza de que deseja deletar este orçamento/OS permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'ordensServico', id));
      setSelectedOS(null);
      toast.success('OS removida!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao deletar OS.');
    }
  };

  // Atualizar Status da OS
  const handleUpdateStatus = async (id, newStatus) => {
    if (newStatus === 'concluido') {
      const os = pedidos.find(p => p.id === id);
      if (os && os.situacaoFinanceira !== 'pago') {
        setOsParaFinalizar(os);
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId, 'ordensServico', id), {
        status: newStatus
      });
      if (selectedOS && selectedOS.id === id) {
        setSelectedOS(prev => ({ ...prev, status: newStatus }));
      }
      toast.success(`Status atualizado para: ${STATUS_OS[newStatus]?.label}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status.');
    }
  };

  // Finalizar e Faturar OS (Estilo PDV)
  const handleFinalizarOS = async (payloadPagamento) => {
    if (!osParaFinalizar) return;
    setSalvandoOS(true);
    try {
      const osId = osParaFinalizar.id;
      const docRef = doc(db, 'estabelecimentos', estabId, 'ordensServico', osId);
      
      const cleanPhone = (osParaFinalizar.cliente?.telefone || '').replace(/\D/g, '');
      let finalClientId = payloadPagamento.clienteId;
      
      // Se o cliente não existia na lista de clientes, cadastrá-lo para fins de crediário
      if (payloadPagamento.clienteNaoExiste) {
        const clientData = {
          id: finalClientId,
          nome: (osParaFinalizar.cliente?.nome || 'CLIENTE OS').toUpperCase().trim(),
          telefone: cleanPhone,
          cpf: osParaFinalizar.cliente?.cpf || '',
          email: osParaFinalizar.cliente?.email || '',
          limiteCrediario: 0,
          saldoDevedor: 0,
          fidelidade: { carimbos: 0, premioDisponivel: false, cartelasCompletadas: 0 },
          criadoEm: new Date()
        };
        await setDoc(doc(db, 'estabelecimentos', estabId, 'clientes', finalClientId), clientData);
        if (cleanPhone && cleanPhone.length >= 8) {
          await setDoc(doc(db, 'clientes', cleanPhone), {
            nome: clientData.nome,
            telefone: clientData.telefone,
            cpf: clientData.cpf,
            email: clientData.email,
            limiteCrediario: clientData.limiteCrediario,
            criadoEm: clientData.criadoEm
          });
        }
      }

      // Atualizar o status e anexar os dados do faturamento
      const faturamentoData = {
        status: 'concluido',
        situacaoFinanceira: 'pago',
        pagamentos: payloadPagamento.pagamentos,
        desconto: payloadPagamento.desconto,
        acrescimo: payloadPagamento.acrescimo,
        total: payloadPagamento.total,
        valorRecebido: payloadPagamento.valorRecebido,
        troco: payloadPagamento.troco,
        garantia: payloadPagamento.garantia,
        observacaoGarantia: payloadPagamento.observacaoGarantia,
        faturadoEm: new Date(),
        updatedAt: new Date()
      };
      
      await updateDoc(docRef, faturamentoData);
      
      // Registrar no crediário (fiado) se houver
      const valorCrediario = payloadPagamento.pagamentos
        .filter(p => p.forma === 'crediario')
        .reduce((acc, p) => acc + p.valor, 0);
        
      if (valorCrediario > 0 && finalClientId) {
        // Atualizar saldo devedor na subcoleção de clientes do estabelecimento
        const cRef = doc(db, 'estabelecimentos', estabId, 'clientes', finalClientId);
        const cSnap = await getDoc(cRef);
        const currentSaldo = cSnap.exists() ? (cSnap.data().saldoDevedor || 0) : 0;
        const novoSaldo = currentSaldo + valorCrediario;
        
        await updateDoc(cRef, {
          saldoDevedor: novoSaldo
        });

        // Sincronizar com a coleção global do cliente
        const gRef = doc(db, 'clientes', finalClientId);
        const gSnap = await getDoc(gRef);
        if (gSnap.exists()) {
          await updateDoc(gRef, {
            saldoDevedor: (gSnap.data().saldoDevedor || 0) + valorCrediario
          });
        }

        // Criar registro na subcoleção historico_crediario do cliente
        const crediarioPagt = payloadPagamento.pagamentos.find(p => p.forma === 'crediario');
        const dataVencimentoObj = crediarioPagt?.dataVencimento
          ? new Date(crediarioPagt.dataVencimento + 'T12:00:00')
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

        const histRef = doc(collection(db, 'estabelecimentos', estabId, 'clientes', finalClientId, 'historico_crediario'));
        await setDoc(histRef, {
          tipo: 'compra',
          valor: valorCrediario,
          saldoPendente: valorCrediario,
          status: 'pendente',
          dataVencimento: dataVencimentoObj,
          descricao: `OS #${osId.substring(0, 5).toUpperCase()}`,
          vendaId: osId,
          data: new Date(),
          itens: [
            {
              nome: `PROJETO: ${osParaFinalizar.projeto?.modelo?.toUpperCase() || 'ESTRUTURA'}`,
              quantidade: 1,
              preco: osParaFinalizar.projeto?.precoVenda || 0
            }
          ]
        });
      }

      // Se o modal de detalhes estiver visualizando a OS finalizada, atualiza o estado local
      if (selectedOS && selectedOS.id === osId) {
        setSelectedOS(prev => ({
          ...prev,
          ...faturamentoData
        }));
      }

      toast.success('🎉 Ordem de Serviço concluída e faturada com sucesso!');
      setOsParaFinalizar(null);
    } catch (err) {
      console.error("Erro ao faturar OS:", err);
      toast.error('Erro ao finalizar o faturamento da OS.');
    } finally {
      setSalvandoOS(false);
    }
  };

  const handleSendToOtimizer = (pecas) => {
    setOtimizerPecas(pecas);
    setActiveTab('otimizador');
    toast.success('🚀 Peças do projeto enviadas para o Otimizador!');
  };

  const exportarPdfPlanoCorte1D = async () => {
    const element = document.getElementById('printable-otimizador-1d');
    if (!element) {
      toast.warn('Execute a otimização antes de exportar o PDF!');
      return;
    }

    const toastId = toast.loading('📄 Gerando PDF da Folha de Corte...');

    try {
      // Ajusta temporariamente estilos para renderizar bem no canvas
      const scrollContainers = element.querySelectorAll('.overflow-y-auto');
      const originalScrolls = [];
      scrollContainers.forEach(container => {
        originalScrolls.push({
          el: container,
          maxHeight: container.style.maxHeight,
          overflow: container.style.overflow
        });
        container.style.maxHeight = 'none';
        container.style.overflow = 'visible';
      });

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Restaura os estilos originais
      scrollContainers.forEach((container, i) => {
        container.style.maxHeight = originalScrolls[i].maxHeight;
        container.style.overflow = originalScrolls[i].overflow;
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 12;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      
      let heightLeft = contentHeight;
      let position = margin;

      // Adiciona cabeçalho ao PDF
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42); // slate-900
      pdf.setFont('helvetica', 'bold');
      pdf.text('FOLHA DE CORTE - SERRALHERIA', margin, margin + 4);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text(`Gerado em: ${new Date().toLocaleString()}`, margin, margin + 9);
      pdf.line(margin, margin + 11, pdfWidth - margin, margin + 11);

      position += 14;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= (pdfHeight - position - margin);

      while (heightLeft > 0) {
        pdf.addPage();
        position = margin;
        const offset = heightLeft - contentHeight + margin;
        pdf.addImage(imgData, 'PNG', margin, offset, contentWidth, contentHeight);
        heightLeft -= (pdfHeight - (margin * 2));
      }

      pdf.save(`Plano_de_Corte_1D_Serralheria_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.update(toastId, { render: '✅ PDF exportado com sucesso!', type: 'success', autoClose: 3000, isLoading: false });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.update(toastId, { render: '❌ Falha ao gerar PDF.', type: 'error', autoClose: 3000, isLoading: false });
    }
  };

  // OTIMIZADOR 1D - Algoritmo First Fit Decreasing
  const run1DOptimization = () => {
    const BAR_LENGTH = 6000; // 6 metros em mm
    const SAW_CUT = 3; // folga da serra em mm
    
    // Expandir peças em uma lista plana individual
    let flatPieces = [];
    otimizerPecas.forEach(p => {
      for (let i = 0; i < p.qtd; i++) {
        flatPieces.push({
          id: `${p.id}-${i}`,
          length: p.length,
          label: p.label
        });
      }
    });

    // Ordenar peças em ordem decrescente de tamanho
    flatPieces.sort((a, b) => b.length - a.length);

    // Filtrar peças impossíveis
    const invalidPieces = flatPieces.filter(p => p.length > BAR_LENGTH);
    if (invalidPieces.length > 0) {
      return toast.error(`Algumas peças excedem o limite de ${BAR_LENGTH} mm.`);
    }

    let bars = []; // { id, remaining, cuts: [] }

    flatPieces.forEach(piece => {
      let placed = false;
      
      for (let i = 0; i < bars.length; i++) {
        // Precisamos verificar se cabe a peça mais a folga de serra se não for o primeiro corte
        const requiredSpace = piece.length + (bars[i].cuts.length > 0 ? SAW_CUT : 0);
        if (bars[i].remaining >= requiredSpace) {
          bars[i].cuts.push(piece);
          bars[i].remaining -= requiredSpace;
          placed = true;
          break;
        }
      }

      if (!placed) {
        bars.push({
          id: bars.length + 1,
          remaining: BAR_LENGTH - piece.length,
          cuts: [piece]
        });
      }
    });

    // Estatísticas
    const totalPiecesLength = flatPieces.reduce((acc, p) => acc + p.length, 0);
    const totalBarsUsed = bars.length;
    const totalBarsLength = totalBarsUsed * BAR_LENGTH;
    const wasteLength = totalBarsLength - totalPiecesLength;
    const efficiency = totalBarsLength > 0 ? (totalPiecesLength / totalBarsLength) * 100 : 0;

    setBarsOptimized(bars);
    setOptimizationStats({
      totalPieces: flatPieces.length,
      barsUsed: totalBarsUsed,
      totalPiecesLength,
      wasteLength,
      efficiency
    });

    toast.success('🚀 Otimização de corte concluída!');
  };

  const handleAddOtimizerPeca = (e) => {
    e.preventDefault();
    const len = Number(novaPecaLength);
    const qty = Number(novaPecaQtd);
    if (!len || len <= 0 || !qty || qty <= 0) return toast.warn('Preencha valores válidos.');

    const newPiece = {
      id: Date.now(),
      length: len,
      qtd: qty,
      label: novaPecaLabel.trim() || `Corte ${len}mm`
    };

    setOtimizerPecas(prev => [...prev, newPiece]);
    setNovaPecaLength('');
    setNovaPecaQtd(1);
    setNovaPecaLabel('');
  };

  const handleRemoveOtimizerPeca = (id) => {
    setOtimizerPecas(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-100/50 pb-12 text-slate-800">
      
      {/* Top Header */}
      <div className="bg-slate-900 text-white shadow-xl shadow-slate-900/10 mb-6 print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-left">
            <BackButton />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏭</span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">
                  IdeaSerralheiro
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Módulo de Gestão Física & Orçamentos de Serralheria</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {dbVidros.length === 0 && (
              <button
                onClick={handleSeedInsumos}
                className="px-3.5 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
              >
                <IoRefreshOutline className="animate-spin-slow" size={14} /> Importar Insumos Padrão
              </button>
            )}
            <div className="h-6 w-[1px] bg-slate-700 hidden sm:block" />
            <span className="text-xs bg-slate-800/80 border border-slate-700/60 font-black px-3 py-1.5 rounded-xl uppercase tracking-wider text-slate-300">
              Ambiente Locksmith
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Seletor de Abas Principal */}
        <div className="bg-white border border-slate-200 rounded-3xl p-2.5 shadow-sm flex flex-wrap gap-1.5 print:hidden">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <IoAnalyticsOutline size={16} /> },
            { id: 'calculadora', label: 'Calculadora de Projetos', icon: <IoCalculatorOutline size={16} /> },
            { id: 'otimizador', label: 'Otimizador de Corte (1D)', icon: <IoCutOutline size={16} /> },
            { id: 'kanban', label: 'Quadro Kanban', icon: <IoGridOutline size={16} /> },
            { id: 'catalogo', label: 'Catálogo de Insumos', icon: <IoBuildOutline size={16} /> },
            { id: 'clientes', label: 'CRM Clientes', icon: <IoPersonOutline size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] py-3 rounded-2xl font-black text-xs uppercase transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-950/20'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* --- TABS RENDERING --- */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-semibold">Carregando painel de serralheria...</p>
          </div>
        ) : (
          <>
            {/* ABA 1: DASHBOARD METRICS */}
            {activeTab === 'dashboard' && (
              <DashboardTab
                pedidos={pedidos}
                dbClientes={dbClientes}
              />
            )}

            {/* ABA 2: CALCULADORA DE VÃO E CÁLCULO FÍSICO */}
            {activeTab === 'calculadora' && (
              <CalculadoraTab
                dbVidros={dbVidros}
                dbCores={dbCores}
                dbKits={dbKits}
                dbModelos={dbModelos}
                dbClientes={dbClientes}
                pedidos={pedidos}
                estabId={estabId}
                handleCreateOS={handleCreateOS}
                handleCepLookup={handleCepLookup}
                clienteNome={clienteNome} setClienteNome={setClienteNome}
                clienteTelefone={clienteTelefone} setClienteTelefone={setClienteTelefone}
                clienteEndereco={clienteEndereco} setClienteEndereco={setClienteEndereco}
                clienteCep={clienteCep} setClienteCep={setClienteCep}
                dataInstalacao={dataInstalacao} setDataInstalacao={setDataInstalacao}
                vidraceiro={vidraceiro} setVidraceiro={setVidraceiro}
                observacoes={observacoes} setObservacoes={setObservacoes}
                onSendToOtimizer={handleSendToOtimizer}
              />
            )}

            {/* ABA 3: OTIMIZADOR DE PLANO DE CORTE (1D) */}
            {activeTab === 'otimizador' && (
              <div className="space-y-6">
                <div className="bg-slate-900 text-white p-4 sm:p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-lg">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black tracking-tight">Otimizador de Plano de Corte (1D)</h2>
                    <p className="text-xs text-slate-300 font-semibold mt-1">
                      Determine como cortar barras padrão de metalon de 6 metros (6000 mm) para minimizar desperdício de aço.
                    </p>
                  </div>
                  <button
                    onClick={run1DOptimization}
                    disabled={otimizerPecas.length === 0}
                    className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    🚀 Otimizar Plano de Corte
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                  {/* Lista de Peças a Cortar (5 cols) */}
                  <div className="glass-card p-5 lg:col-span-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-950">Lista de Cortes Solicitados</h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Adicione os pedaços que precisa cortar do seu projeto</p>
                    </div>

                    <form onSubmit={handleAddOtimizerPeca} className="grid grid-cols-12 gap-2 bg-slate-50 border border-slate-200/60 p-3 rounded-2xl">
                      <div className="col-span-6">
                        <label className="text-[8px] uppercase font-black text-slate-400 block mb-0.5">Comprimento (mm)</label>
                        <input
                          type="number"
                          required
                          placeholder="Ex: 1200"
                          value={novaPecaLength}
                          onChange={e => setNovaPecaLength(e.target.value)}
                          className="glass-input w-full font-mono py-1.5"
                        />
                      </div>
                      <div className="col-span-6">
                        <label className="text-[8px] uppercase font-black text-slate-400 block mb-0.5">Quantidade</label>
                        <input
                          type="number"
                          required
                          min={1}
                          placeholder="Qtd"
                          value={novaPecaQtd}
                          onChange={e => setNovaPecaQtd(e.target.value)}
                          className="glass-input w-full font-mono py-1.5"
                        />
                      </div>
                      <div className="col-span-10 mt-1">
                        <label className="text-[8px] uppercase font-black text-slate-400 block mb-0.5">Descrição (Rótulo)</label>
                        <input
                          type="text"
                          placeholder="Ex: Travessa Base"
                          value={novaPecaLabel}
                          onChange={e => setNovaPecaLabel(e.target.value)}
                          className="glass-input w-full py-1.5 text-[10px]"
                        />
                      </div>
                      <div className="col-span-2 mt-1 flex items-end">
                        <button
                          type="submit"
                          className="w-full h-8 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center transition-all"
                        >
                          <IoAddOutline size={18} />
                        </button>
                      </div>
                    </form>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {otimizerPecas.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 font-semibold py-8">Nenhum corte adicionado ainda.</p>
                      ) : (
                        otimizerPecas.map(p => (
                          <div key={p.id} className="flex justify-between items-center bg-white border border-slate-200/80 p-3 rounded-xl hover:bg-slate-50 transition-all">
                            <div className="text-xs font-semibold">
                              <span className="font-extrabold text-slate-950 block">{p.label}</span>
                              <span className="text-[10px] text-slate-400">📏 {p.length} mm | Qtd: <strong>{p.qtd}x</strong></span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveOtimizerPeca(p.id)}
                              className="text-red-500 hover:text-white hover:bg-red-500 border border-red-200 p-1.5 rounded-lg transition-all"
                            >
                              <IoTrashOutline size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Resultados do Otimizador (7 cols) */}
                  <div id="printable-otimizador-1d" className="glass-card p-5 lg:col-span-7 space-y-4 bg-white">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <div>
                        <h3 className="text-sm font-black text-slate-950">Plano de Corte Otimizado</h3>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Layout de corte das barras de 6.00m (6000mm)</p>
                      </div>
                      {barsOptimized.length > 0 && (
                        <button
                          type="button"
                          onClick={exportarPdfPlanoCorte1D}
                          data-html2canvas-ignore="true"
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] uppercase rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
                          title="Exportar PDF para Oficina"
                        >
                          <IoDownloadOutline size={12} /> PDF Oficina
                        </button>
                      )}
                    </div>

                    {optimizationStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl text-xs font-semibold">
                        <div>
                          <span className="text-[9px] text-amber-700 block uppercase font-bold">Barras de 6m</span>
                          <span className="text-sm font-mono font-black text-slate-900">{optimizationStats.barsUsed} barras</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-amber-700 block uppercase font-bold">Aproveitamento</span>
                          <span className="text-sm font-mono font-black text-emerald-600">{optimizationStats.efficiency.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-amber-700 block uppercase font-bold">Total Utilizado</span>
                          <span className="text-sm font-mono font-black text-slate-900">{(optimizationStats.totalPiecesLength / 1000).toFixed(2)} m</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-amber-700 block uppercase font-bold">Sobras Totais</span>
                          <span className="text-sm font-mono font-black text-slate-500">{(optimizationStats.wasteLength / 1000).toFixed(2)} m</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                      {barsOptimized.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <IoCutOutline size={36} className="text-slate-300 mb-2 animate-bounce-slow" />
                          <p className="text-xs font-semibold text-center">Clique no botão "Otimizar Plano de Corte" para organizar a montagem.</p>
                        </div>
                      ) : (
                        barsOptimized.map(bar => {
                          const usedLength = 6000 - bar.remaining;
                          const efficiency = (usedLength / 6000) * 100;
                          
                          return (
                            <div key={bar.id} className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2.5">
                              <div className="flex justify-between items-center text-xs font-semibold">
                                <span className="font-extrabold text-slate-900">Barra #{bar.id} (6000 mm)</span>
                                <span className="text-[10px] text-slate-400">
                                  Usado: <strong className="text-slate-900">{usedLength}mm</strong> ({efficiency.toFixed(1)}%) | Sobra: <strong className="text-amber-600">{bar.remaining}mm</strong>
                                </span>
                              </div>
                              
                              {/* Barra Segmentada Visual */}
                              <div className="flex h-7 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-inner font-mono text-[9px] text-white font-extrabold text-center items-center">
                                {bar.cuts.map((cut, idx) => {
                                  const widthPercent = (cut.length / 6000) * 100;
                                  // Paleta de cores para os segmentos
                                  const bgColors = [
                                    'bg-slate-800',
                                    'bg-amber-600',
                                    'bg-indigo-700',
                                    'bg-emerald-700',
                                    'bg-sky-700',
                                    'bg-purple-700'
                                  ];
                                  const colorClass = bgColors[idx % bgColors.length];

                                  return (
                                    <div
                                      key={cut.id}
                                      style={{ width: `${widthPercent}%` }}
                                      className={`${colorClass} h-full border-r border-white/20 last:border-r-0 flex items-center justify-center flex-col overflow-hidden px-1`}
                                      title={`${cut.label}: ${cut.length}mm`}
                                    >
                                      <span className="truncate leading-none">{cut.length}</span>
                                    </div>
                                  );
                                })}
                                {bar.remaining > 0 && (
                                  <div
                                    style={{ width: `${(bar.remaining / 6000) * 100}%` }}
                                    className="bg-slate-200 text-slate-500 h-full flex items-center justify-center flex-col overflow-hidden px-1"
                                    title={`Sobral/Retalho: ${bar.remaining}mm`}
                                  >
                                    <span className="truncate leading-none font-bold text-slate-400">Sobra</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 4: KANBAN GESTÃO DE OS */}
            {activeTab === 'kanban' && (
              <KanbanTab
                pedidos={pedidos}
                setSelectedOS={setSelectedOS}
                handleUpdateStatus={handleUpdateStatus}
                STATUS_FLOW={STATUS_FLOW}
                STATUS_OS={STATUS_OS}
              />
            )}

            {/* ABA 5: CATÁLOGO DE MATERIAIS */}
            {activeTab === 'catalogo' && (
              <CatalogoTab
                dbVidros={dbVidros}
                dbCores={dbCores}
                dbKits={dbKits}
                dbModelos={dbModelos}
                setEditingMaterial={setEditingMaterial}
                estabId={estabId}
              />
            )}

            {/* ABA 6: CRM CLIENTES */}
            {activeTab === 'clientes' && (
              <ClientesTab
                pedidos={pedidos}
                setSelectedOS={setSelectedOS}
                STATUS_OS={STATUS_OS}
                estabId={estabId}
                dbClientes={dbClientes}
              />
            )}
          </>
        )}

        {/* --- MODAL DETALHE OS / RECIBO --- */}
        {selectedOS && (
          <OsDetailModal
            selectedOS={selectedOS}
            setSelectedOS={setSelectedOS}
            handleDeleteOS={handleDeleteOS}
            handleUpdateStatus={handleUpdateStatus}
            STATUS_FLOW={STATUS_FLOW}
            STATUS_OS={STATUS_OS}
          />
        )}

        {/* --- MODAL EDIÇÃO MATERIAL --- */}
        {editingMaterial && (
          <EditMaterialModal
            editingMaterial={editingMaterial}
            setEditingMaterial={setEditingMaterial}
            estabId={estabId}
            dbVidros={dbVidros}
            dbCores={dbCores}
            dbKits={dbKits}
            dbModelos={dbModelos}
          />
        )}

        {/* --- MODAL DE FATURAMENTO / FINALIZAÇÃO DA OS --- */}
        {osParaFinalizar && (
          <ModalFinalizacaoOS
            visivel={!!osParaFinalizar}
            os={osParaFinalizar}
            onClose={() => setOsParaFinalizar(null)}
            onFinalizar={handleFinalizarOS}
            salvando={salvandoOS}
            estabelecimentoId={estabId}
          />
        )}

      </div>
    </div>
  );
};

export default withEstablishmentAuth(SerralheriaDashboard);
