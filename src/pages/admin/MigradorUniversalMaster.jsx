import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import Papa from 'papaparse';
import { 
  FaStore, 
  FaCloudUploadAlt, 
  FaFileCsv, 
  FaCheckCircle, 
  FaArrowLeft, 
  FaRandom,
  FaDatabase,
  FaBolt
} from 'react-icons/fa';
import { IoLogOutOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLECOES_SUPORTADAS = [
  { id: 'clientes', label: 'Clientes (Base de Clientes)', campos: ['nome', 'telefone', 'endereco', 'cpf', 'email', 'nascimento'] },
  { id: 'fornecedores', label: 'Fornecedores', campos: ['razaoSocial', 'cnpj', 'telefone', 'endereco', 'contato_nome'] },
  { id: 'produtos_estoque', label: 'Produtos de Estoque (Retail)', campos: ['nome', 'custo', 'preco', 'codigo_barras', 'estoque_atual'] },
];

function MigradorUniversalMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [estabelecimentosList, setEstabelecimentosList] = useState([]);
  
  // States do Flow
  const [step, setStep] = useState(1);
  const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Mapeamento e Preview
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvData, setCsvData] = useState([]); // Apenas preview
  const [fieldMapping, setFieldMapping] = useState({}); // { campoDestino: 'CabecalhoCSV' }

  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        navigate('/master-dashboard');
        return;
      }
      setLoading(false);
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      if (!isMasterAdmin || !currentUser) return;
      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome'));
        const querySnapshot = await getDocs(q);
        setEstabelecimentosList(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        toast.error('Erro ao carregar estabelecimentos.');
      }
    };
    fetchEstabelecimentos();
  }, [isMasterAdmin, currentUser]);

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) processCsvFile(e.target.files[0]);
  };

  const processCsvFile = (selectedFile) => {
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Apenas arquivos .csv são permitidos.');
        return;
    }
    setFile(selectedFile);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (!results.meta.fields || results.meta.fields.length === 0) {
            toast.error("CSV não possui colunas válidas no cabeçalho.");
            return;
        }
        setCsvHeaders(results.meta.fields);
        setCsvData(results.data);
        
        // Auto-mapeamento basico (se headers forem idênticos)
        const colDef = COLECOES_SUPORTADAS.find(c => c.id === selectedCollection);
        const autoMap = {};
        if (colDef) {
            colDef.campos.forEach(campo => {
               const match = results.meta.fields.find(h => h.trim().toLowerCase() === campo.toLowerCase());
               if(match) autoMap[campo] = match;
            });
        }
        setFieldMapping(autoMap);
        setStep(2);
      },
      error: function(error) {
          toast.error("Erro ao ler CSV: " + error.message);
      }
    });
  };

  const handleMappingChange = (campoDestino, cabecalhoCSV) => {
    setFieldMapping(prev => ({
        ...prev,
        [campoDestino]: cabecalhoCSV
    }));
  };

  const executeImport = async () => {
     if(!selectedEstabelecimentoId || !selectedCollection || !csvData.length) return;
     
     const mappedFieldsCount = Object.values(fieldMapping).filter(Boolean).length;
     if(mappedFieldsCount === 0) {
         toast.error("Você precisa mapear ao menos 1 coluna!");
         return;
     }

     setImporting(true);

     try {
        const batch = writeBatch(db);
        const colRef = collection(db, 'estabelecimentos', selectedEstabelecimentoId, selectedCollection);
        
        let operations = 0;

        csvData.forEach(row => {
            const dataToInsert = {};
            let hasData = false;

            // Constroi o objeto de acordo com o mapeamento
            Object.keys(fieldMapping).forEach(campoKey => {
                const headerCSV = fieldMapping[campoKey];
                if (headerCSV && row[headerCSV] !== undefined && row[headerCSV].trim() !== '') {
                    dataToInsert[campoKey] = row[headerCSV].trim();
                    hasData = true;
                }
            });

            if (hasData) {
                // Para clientes, é util validar telefone se for ID ou algo do tipo,
                // Mas aqui vamos deixar o Firestore gerar os IDs.
                const newDocRef = doc(colRef);
                batch.set(newDocRef, {
                    ...dataToInsert,
                    createdAt: new Date(),
                    _migratedViaCsv: true
                });
                operations++;

                // O limite do batch é 500 ops. Em produção, você deverá dividir lotes se > 500.
                if(operations >= 490) {
                    // Aviso sobre limites em migrações simples
                    console.warn("Muitos registros, o limite ideal por batch seria atingido. (TODO: Implementar Chunks)");
                }
            }
        });

        if(operations === 0) {
             throw new Error("Nenhum dado extraído das colunas mapeadas. Verifique a planilha.");
        }

        await batch.commit();

        await auditLogger('DADOS_IMPORTADOS_CSV', 
            { uid: currentUser.uid, email: currentUser.email }, 
            { estabelecimentoId: selectedEstabelecimentoId, colecao: selectedCollection }, 
            { qtdDocs: operations, fileName: file.name }
        );

        toast.success(`Foram importados ${operations} registros para a coleção '${selectedCollection}'.`);
        
        // Reset para fazer outro
        setTimeout(() => {
            setStep(1);
            setFile(null);
            setCsvHeaders([]);
            setCsvData([]);
            setFieldMapping({});
        }, 3000);

     } catch (error) {
         console.error(error);
         toast.error(`Erro ao importar: ${error.message}`);
     } finally {
         setImporting(false);
     }
  };

  if (authLoading || loading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;

  const currentCollectionDef = COLECOES_SUPORTADAS.find(c => c.id === selectedCollection);

  return (
    <div className="bg-[#F5F5F7] min-h-screen pt-4 pb-24 px-4 sm:px-8 font-sans text-[#1D1D1F]">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Data Migration Center</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-12 pb-12">
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col mb-10 px-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <span className="bg-[#1D1D1F] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-2"><FaBolt className="text-yellow-400" /> Ferramenta de Carga CSV</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Migrador Universal</h1>
            <p className="text-[#86868B] text-sm mt-2 font-medium">Extraia, mapeie as colunas e despeje dados brutais de CSV no MongoDB Firebase Ecosystem.</p>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border border-[#E5E5EA] overflow-hidden">
            <div className="p-8 md:p-10">
                
                {/* STEP 1: CONFIGS & UPLOAD */}
                {step === 1 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Seleção de Loja */}
                            <div>
                                <label className="block text-[11px] font-black text-[#86868B] uppercase tracking-widest mb-3">Loja de Destino</label>
                                <div className="relative">
                                    <select
                                        value={selectedEstabelecimentoId}
                                        onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                                        className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] font-bold text-sm rounded-2xl block p-4 transition-all hover:border-[#86868B] focus:border-black appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled hidden>Selecione uma loja...</option>
                                        {estabelecimentosList.map(est => (
                                            <option key={est.id} value={est.id}>{est.nome}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#86868B] font-bold text-[10px]">▼</div>
                                </div>
                            </div>
                            
                            {/* Seleção de Tabela */}
                            <div>
                                <label className="block text-[11px] font-black text-[#86868B] uppercase tracking-widest mb-3">Tabela do Banco (Coleção)</label>
                                <div className="relative">
                                    <select
                                        value={selectedCollection}
                                        onChange={(e) => setSelectedCollection(e.target.value)}
                                        className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] font-bold text-sm rounded-2xl block p-4 transition-all hover:border-[#86868B] focus:border-black appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled hidden>Selecione a coleção...</option>
                                        {COLECOES_SUPORTADAS.map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#86868B] font-bold text-[10px]">▼</div>
                                </div>
                            </div>
                        </div>

                        {selectedEstabelecimentoId && selectedCollection && (
                             <div className="pt-2">
                             <label className="block text-[11px] font-black text-[#86868B] uppercase tracking-widest mb-3">Dataset CSV (Dados Crus)</label>
                             <div
                                 className={`relative border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300 cursor-pointer group ${
                                     dragActive 
                                     ? 'border-[#1D1D1F] bg-black/5' 
                                     : 'border-[#E5E5EA] bg-[#F5F5F7] hover:bg-white hover:border-[#1D1D1F]'
                                 }`}
                                 onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                             >
                                 <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" id="file-upload" />
                                 <div className="flex flex-col items-center pointer-events-none">
                                     <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-6 transition-colors shadow-sm ${dragActive ? 'bg-[#1D1D1F] text-white' : 'bg-white border border-[#E5E5EA] text-[#1D1D1F] group-hover:scale-110'}`}>
                                         <FaFileCsv className="text-3xl" />
                                     </div>
                                     <p className="text-xl font-bold text-[#1D1D1F] group-hover:text-black transition-colors tracking-tight">
                                         Arraste e Solte o arquivo CSV
                                     </p>
                                     <p className="text-sm font-medium text-[#86868B] mt-2">
                                         Ou clique sobre esta área para escolher no sistema
                                     </p>
                                 </div>
                             </div>
                         </div>
                        )}
                    </div>
                )}

                {/* STEP 2: MAPEAMENTO DE COLUNAS */}
                {step === 2 && (
                     <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        
                        <div className="flex items-start gap-4 p-5 bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA]">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#E5E5EA] shrink-0">
                                <FaDatabase className="text-[#1D1D1F] text-sm" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[#1D1D1F] text-base mb-1">Mapeamento de Esqueleto de Dados</h3>
                                <p className="text-sm text-[#86868B] font-medium leading-relaxed">
                                    Identificamos <strong>{csvData.length} registros</strong> válidos e <strong>{csvHeaders.length} colunas</strong> no documento "{file?.name}". Relacione-as aos conectores oficiais abaixo.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                           {currentCollectionDef?.campos.map(campo => (
                               <div key={campo} className="flex flex-col md:flex-row items-center gap-4 bg-white border border-[#E5E5EA] p-5 rounded-2xl hover:border-black/20 transition-all shadow-sm">
                                   <div className="w-full md:w-5/12">
                                        <p className="text-[10px] font-black uppercase text-[#86868B] tracking-widest">Nó de Destino (Ideafood)</p>
                                        <p className="text-sm font-black text-[#1D1D1F] mt-1">{campo}</p>
                                   </div>
                                   <div className="hidden md:flex text-[#E5E5EA]">
                                       <FaRandom />
                                   </div>
                                   <div className="w-full md:w-6/12">
                                       <p className="text-[10px] font-black uppercase text-[#86868B] tracking-widest mb-2 block md:hidden">Tubo de Origem (Seu CSV)</p>
                                        <div className="relative">
                                            <select
                                                value={fieldMapping[campo] || ''}
                                                onChange={(e) => handleMappingChange(campo, e.target.value)}
                                                className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] font-bold text-sm rounded-xl focus:ring-2 focus:ring-black px-4 py-3 appearance-none cursor-pointer"
                                            >
                                                <option value="">-- Passar em Branco --</option>
                                                {csvHeaders.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#86868B] font-bold text-[10px]">▼</div>
                                        </div>
                                   </div>
                               </div>
                           ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-[#E5E5EA]">
                            <button
                                onClick={() => setStep(1)}
                                type="button"
                                className="px-6 py-4 bg-[#F5F5F7] text-[#1D1D1F] font-bold text-sm rounded-2xl hover:bg-[#E5E5EA] transition-colors border border-[#E5E5EA]"
                            >
                                Reconfigurar Arquivo
                            </button>
                            <button
                                onClick={executeImport}
                                disabled={importing}
                                className="flex-1 py-4 bg-[#1D1D1F] text-white font-bold text-sm rounded-2xl hover:bg-black transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-3 active:scale-95"
                            >
                                {importing ? (
                                     <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Transferindo Matriz...</>
                                ) : (
                                     <><FaCheckCircle /> Comitar Extrato ({csvData.length} Documentos)</>
                                )}
                            </button>
                        </div>
                     </div>
                )}
            </div>
        </div>

      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E5EA;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #C7C7CC;
        }
      `}</style>
    </div>
  );
}

export default MigradorUniversalMaster;
