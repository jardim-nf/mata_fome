// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashBoardSummary from "../components/DashBoardSummary";
import BannerMensalidade from "../components/BannerMensalidade";
import { useAuth } from "../context/AuthContext";
import { useEstablishment } from "../hooks/useEstablishment";
import { db } from "../firebase";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";

import { 
  IoStatsChart, IoShareSocial, IoColorPalette, IoSettings, IoTrashBin,
  IoStorefront, IoRestaurant, IoDesktopOutline, IoTicketOutline,
  IoFastFoodOutline, IoList, IoDocumentTextOutline, IoLogOutOutline,
  IoArrowBackOutline, IoPersonOutline, IoChevronDownOutline,
  IoCloudUploadOutline, IoTrendingUp, IoMegaphoneOutline, IoWalletOutline,
  IoFlaskOutline
} from "react-icons/io5"; 
import { FaUsers, FaMotorcycle, FaMapMarkedAlt, FaBullhorn, FaTimes } from 'react-icons/fa'; 

const ActionButton = ({ title, subtitle, icon, themeColor }) => {
  const themes = {
    blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:shadow-blue-200",
    green: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:shadow-emerald-200",
    purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:shadow-purple-200",
    orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:shadow-orange-200",
    yellow: "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:shadow-amber-200",
    teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:shadow-teal-200",
    pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-600 group-hover:shadow-pink-200",
    red: "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:shadow-rose-200",
    indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:shadow-indigo-200",
    slate: "bg-slate-50 text-slate-600 group-hover:bg-slate-600 group-hover:shadow-slate-200",
    cyan: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:shadow-cyan-200",
    emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:shadow-emerald-200",
    amber: "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:shadow-amber-200",
  };

  return (
    <div className="group relative h-full bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 transform hover:-translate-y-1 overflow-hidden flex flex-col cursor-pointer">
      <div className="absolute -right-6 -top-6 text-9xl opacity-[0.03] text-slate-900 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 pointer-events-none">{icon}</div>
      <div className="relative z-10 flex flex-col h-full">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-5 transition-all duration-300 shadow-sm group-hover:text-white group-hover:shadow-lg ${themes[themeColor] || themes.slate}`}>{icon}</div>
        <div className="mt-auto">
          <h2 className="text-xl font-extrabold text-slate-800 mb-2 group-hover:text-slate-900 tracking-tight">{title}</h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-2">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, loading, logout, estabelecimentoIdPrincipal } = useAuth();
  const { estabelecimentoInfo } = useEstablishment(estabelecimentoIdPrincipal);
  const isVarejo = estabelecimentoInfo?.tipoNegocio === 'varejo';
  const [showSummary, setShowSummary] = useState(false);
  
  // Megafone State
  const [globalAviso, setGlobalAviso] = useState(null);

  useEffect(() => {
    const fetchAvisoGlobal = async () => {
      try {
        const q = query(collection(db, 'avisos_gerais'), where('ativo', '==', true), orderBy('createdAt', 'desc'), limit(10));
        const snap = await getDocs(q);
        
        let avisoAchado = null;
        for (const doc of snap.docs) {
           const data = doc.data();
           const alvo = data.alvo || 'todos';
           
           if (alvo === 'todos' || alvo === estabelecimentoIdPrincipal) {
               const isLido = localStorage.getItem(`aviso_lido_${doc.id}`);
               if (!isLido) {
                   avisoAchado = { id: doc.id, ...data };
                   break;
               }
           }
        }
        
        if (avisoAchado) {
           setGlobalAviso(avisoAchado);
        }
      } catch (err) {
        console.error("Erro ao ler broadcast", err);
      }
    };
    if (currentUser && estabelecimentoIdPrincipal) {
      fetchAvisoGlobal();
    }
  }, [currentUser, estabelecimentoIdPrincipal]);

  const dispensarAvisoGlobal = () => {
    if (globalAviso) {
      localStorage.setItem(`aviso_lido_${globalAviso.id}`, 'true');
      setGlobalAviso(null);
    }
  };

  useEffect(() => {
    if (currentUser && !loading) {
      const userRole = currentUser?.role || currentUser?.cargo;
      if (userRole === 'garcom' || userRole === 'garçom') {
        navigate('/controle-salao', { replace: true });
        return;
      }
      
      if (!estabelecimentoIdPrincipal) {
        if (currentUser.isMasterAdmin) {
          navigate('/master-dashboard', { replace: true });
        } else {
          navigate('/selecionar-estabelecimento', { replace: true });
        }
      }
    }
  }, [currentUser, loading, navigate, estabelecimentoIdPrincipal]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
    </div>
  );

  const isRealAdmin = currentUser?.isAdmin === true || currentUser?.isMasterAdmin === true;

  // Permissão vem direto do Firestore — sem listas hardcoded
  const temPermissao = (perm) => {
    if (isRealAdmin) return true;
    return currentUser?.permissoes?.includes(perm);
  };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nomeUsuario = currentUser?.displayName || currentUser?.nome || currentUser?.email?.split('@')[0] || 'Admin';

  const menuGroups = [
    {
      id: "operacao",
      title: "⚡ Operação",
      description: "Telas de acompanhamento e vendas",
      items: [
        { path: '/painel', title: isVarejo ? 'Monitor de Vendas' : 'Monitor de Pedidos', sub: isVarejo ? 'Vendas em tempo real' : 'Delivery e Salão em tempo real', icon: <IoStorefront />, cor: 'blue', perm: 'painel' },
        ...(isVarejo ? [] : [{ path: '/controle-salao', title: 'Controle de Salão', sub: 'Mapa de mesas e comandas', icon: <IoRestaurant />, cor: 'green', perm: 'controle-salao' }]),
        { path: '/pdv', title: 'Frente de Caixa (PDV)', sub: 'Caixa rápido e emissão NFC-e', icon: <IoDesktopOutline />, cor: 'purple', perm: 'pdv' },
        { path: `/totem/${estabelecimentoIdPrincipal || 'loja'}`, title: '🚀 Lançar Totem', sub: 'Abre o app de Autoatendimento', icon: <IoDesktopOutline />, cor: 'yellow', adminOnly: true },
      ]
    },
    {
      id: "cardapio",
      title: isVarejo ? "🛒 Catálogo & Estoque" : "🍔 Cardápio & Estoque",
      description: "Gestão do que você vende",
      items: [
        { path: '/admin/gerenciar-cardapio', title: isVarejo ? 'Catálogo Digital' : 'Cardápio Digital', sub: 'Produtos, fotos e variações', icon: <IoFastFoodOutline />, cor: 'orange', adminOnly: true },
        { path: '/admin/ordenar-categorias', title: 'Categorias', sub: isVarejo ? 'Ordem de exibição do catálogo' : 'Ordem de exibição do cardápio', icon: <IoList />, cor: 'teal', adminOnly: true },
        { path: '/admin/entrada-estoque', title: 'Entrada de Estoque', sub: 'Importe NF-e e atualize', icon: <IoCloudUploadOutline />, cor: 'cyan', adminOnly: true },
        { path: '/admin/insumos', title: 'Gestão de Insumos', sub: 'Matérias-primas e ficha técnica', icon: <IoFlaskOutline />, cor: 'purple', adminOnly: true },
      ]
    },
    {
      id: "logistica",
      title: "🛵 Logística",
      description: "Área de entregas e motoboys",
      items: [
        { path: '/admin/entregadores', title: 'Entregadores', sub: 'Gerencie motoboys e rotas', icon: <FaMotorcycle />, cor: 'indigo', adminOnly: true },
        { path: '/admin/taxas-de-entrega', title: 'Taxas de Entrega', sub: 'Valores de frete por bairro', icon: <FaMapMarkedAlt />, cor: 'amber', adminOnly: true },
      ]
    },
    {
      id: "financas",
      title: "📈 Finanças e Análises",
      description: "Seus lucros e inteligência",
      items: [
        { path: '/admin/analytics', title: 'Análises e Gráficos', sub: 'Métricas e faturamento', icon: <IoStatsChart />, cor: 'blue', perm: 'relatorios' },
        { path: '/admin/reports', title: 'Relatórios de Fechamento', sub: 'Extratos para contabilidade', icon: <IoDocumentTextOutline />, cor: 'slate', perm: 'relatorios' },
        { path: '/admin/lucro', title: 'Relatório de Lucro', sub: 'Receita − Custo = Lucro real', icon: <IoWalletOutline />, cor: 'emerald', perm: 'financeiro' },
        { path: '/admin/contas-pagar', title: 'Contas a Pagar', sub: 'Despesas, salários, aluguel', icon: <IoWalletOutline />, cor: 'red', perm: 'financeiro' },
        ...(isVarejo ? [] : [{ path: '/admin/auditoria-mesas', title: 'Auditoria de Mesas', sub: 'Quem fechou, valores e cancelamentos', icon: <IoDocumentTextOutline />, cor: 'indigo', adminOnly: true }]),
        { path: '/admin/previsao', title: 'Previsão de Demanda', sub: 'IA analisa demanda futura', icon: <IoTrendingUp />, cor: 'cyan', adminOnly: true },
      ]
    },
    {
      id: "equipe",
      title: "👤 Equipe e Atendimento",
      description: "Tudo sobre quem trabalha com você",
      items: [
        { path: '/admin/gestao-funcionarios', title: 'Equipe e Acessos', sub: isVarejo ? 'Gerencie vendedores e permissões' : 'Gerencie garçons e permissões', icon: <FaUsers />, cor: 'indigo', adminOnly: true },
        { path: '/admin/ranking', title: 'Ranking da Equipe', sub: isVarejo ? 'Performance de vendedores' : 'Performance de garçons', icon: <IoStatsChart />, cor: 'amber', perm: 'relatorios' },
        { path: '/admin/avaliacoes', title: 'Avaliações', sub: 'Responder reviews dos clientes', icon: <IoStatsChart />, cor: 'yellow', adminOnly: true },
      ]
    },
    {
      id: "marketing",
      title: "🚀 Marketing e Vendas",
      description: "Como trazer mais clientes",
      items: [
        { path: '/nossos-clientes', title: 'Base de Clientes', sub: 'Disparo manual via Zap', icon: <IoPersonOutline />, cor: 'cyan', adminOnly: true },
        { path: '/admin/marketing', title: 'Painel de Marketing', sub: 'Avisos Push e Copy com IA', icon: <IoMegaphoneOutline />, cor: 'purple', adminOnly: true },
        { path: '/admin/cashback', title: 'Cashback e Carteira', sub: 'Devolva saldo nas compras', icon: <IoWalletOutline />, cor: 'emerald', adminOnly: true },
        { path: '/admin/cupons', title: 'Cupons de Desconto', sub: 'Crie códigos promocionais', icon: <IoTicketOutline />, cor: 'yellow', adminOnly: true },
      ]
    },
    {
      id: "bots",
      title: "🤖 Robôs",
      description: "Peça ajuda à inteligência",
      items: [
        { path: '/admin/whatsapp', title: 'Bot WhatsApp', sub: isVarejo ? 'Venda automática no Zap' : 'Pedido automático no Zap', icon: <IoShareSocial />, cor: 'green', adminOnly: true },
        { path: '/admin/bot-pedidos', title: 'Copilot IA', sub: isVarejo ? 'Assistente IA fecha vendas' : 'Assistente IA fecha pedidos', icon: <IoMegaphoneOutline />, cor: 'teal', adminOnly: true },
      ]
    },
    {
      id: "config",
      title: "⚙️ Configurações",
      description: "Administração do sistema",
      items: [
        { path: '/admin/multi-platform', title: 'Integrações', sub: 'iFood e impressoras', icon: <IoShareSocial />, cor: 'teal', adminOnly: true },
        { path: '/admin/cores', title: 'Identidade Visual', sub: 'Cores e tema da loja', icon: <IoColorPalette />, cor: 'pink', adminOnly: true },
        { path: '/admin/config-fiscal', title: 'Fiscal & Certificado', sub: 'NFC-e e PlugNotas', icon: <IoDocumentTextOutline />, cor: 'emerald', adminOnly: true },
        { path: '/admin/relatorio-nfce', title: 'Relatório NFC-e', sub: 'Notas fiscais emitidas', icon: <IoDocumentTextOutline />, cor: 'emerald', adminOnly: true },
        { path: '/admin/configuracoes', title: 'Configurações Gerais', sub: 'Senha Master e segurança', icon: <IoSettings />, cor: 'slate', adminOnly: true },
        { path: '/admin/relatorio-cancelamentos', title: 'Cancelamentos', sub: 'Auditoria de exclusões', icon: <IoTrashBin />, cor: 'red', adminOnly: true },
      ]
    }
  ];

  // Filtra as permissões 
  const gruposPermitidos = menuGroups.map(grupo => {
    const itens = grupo.items.filter(item => {
      if (isRealAdmin) return true;
      if (item.adminOnly) return false;
      if (item.perm && !temPermissao(item.perm)) return false;
      return true;
    });
    return { ...grupo, items: itens };
  }).filter(g => g.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans pb-20">
      
      {/* GLOBAL MEGAFONE BANNER */}
      {globalAviso && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
           <div className={`bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-2 ${
             globalAviso.tipo === 'urgente' ? 'border-red-500' :
             globalAviso.tipo === 'dica' ? 'border-yellow-400' :
             'border-blue-500'
           }`}>
              <div className={`px-6 py-4 flex justify-between items-center ${
                globalAviso.tipo === 'urgente' ? 'bg-red-50 text-red-700' :
                globalAviso.tipo === 'dica' ? 'bg-yellow-50 text-yellow-800' :
                'bg-blue-50 text-blue-800'
              }`}>
                 <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                      globalAviso.tipo === 'urgente' ? 'bg-red-500' :
                      globalAviso.tipo === 'dica' ? 'bg-yellow-400' :
                      'bg-blue-500'
                    }`}>
                      <FaBullhorn />
                    </div>
                    <span className="font-extrabold uppercase tracking-widest text-[10px]">Mensagem da Matafome Corporativo</span>
                 </div>
                 <button onClick={dispensarAvisoGlobal} className="hover:scale-110 active:scale-95 transition-transform"><FaTimes size={18}/></button>
              </div>
              
              <div className="p-8 text-center flex flex-col items-center">
                 <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-4">{globalAviso.titulo}</h2>
                 <p className="text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">{globalAviso.mensagem}</p>
                 
                 <button 
                   onClick={dispensarAvisoGlobal} 
                   className="mt-8 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold w-full sm:w-auto hover:bg-slate-800 active:scale-95 transition-all shadow-md"
                 >
                   Ciente, Entendi
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className="w-full space-y-8">

        {/* TOP BAR — compacto */}
        <div className="bg-white rounded-2xl px-5 py-4 border border-slate-100 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                {saudacao}, {nomeUsuario} 👋
                {currentUser?.isMasterAdmin && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                    ⚡ MASTER
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentUser?.isMasterAdmin && (
              <button
                onClick={() => navigate('/master')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 font-bold text-sm transition-all duration-200 shrink-0"
                title="Painel Master"
              >
                <IoStatsChart className="text-lg" />
                <span className="hidden sm:inline">Painel Master</span>
              </button>
            )}
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 font-bold text-sm transition-all duration-200 shrink-0"
              title="Sair"
            >
              <IoLogOutOutline className="text-lg" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* AVISO DE MENSALIDADE E CERTIFICADO */}
        <BannerMensalidade />

        {/* FATURAMENTO */}
        {(isRealAdmin || temPermissao('financeiro')) && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
            <button 
              onClick={() => setShowSummary(!showSummary)}
              className="w-full flex items-center justify-between p-5 sm:p-6 hover:bg-slate-50 transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl shadow-inner">
                  💰
                </div>
                <div className="text-left">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">Faturamento e Resumo do Dia</h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Clique para {showSummary ? 'ocultar' : 'visualizar'} o desempenho das vendas de hoje
                  </p>
                </div>
              </div>
              <div className={`p-2 rounded-full bg-slate-100 text-slate-500 transform transition-transform duration-300 ${showSummary ? 'rotate-180' : ''}`}>
                <IoChevronDownOutline className="text-xl" />
              </div>
            </button>

            {showSummary && (
              <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 animate-fadeIn">
                <DashBoardSummary />
              </div>
            )}
          </div>
        )}

        {/* MENU GROUPS — renderizados todos verticalmente */}
        <div className="space-y-12">
          {gruposPermitidos.map((grupo, idx) => (
            <div key={grupo.id} className="animate-slideUp" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div className="mb-6 ml-2">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{grupo.title}</h3>
                <p className="text-sm text-slate-500 font-medium">{grupo.description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 auto-rows-fr">
                {grupo.items.map((item, itemIdx) => (
                  <Link key={itemIdx} to={item.path} className="h-full">
                    <ActionButton title={item.title} subtitle={item.sub} icon={item.icon} themeColor={item.cor} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;