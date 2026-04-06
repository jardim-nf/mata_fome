import React, { useState, useEffect } from 'react';
import { collectionGroup, query, where, onSnapshot, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { IoLocationOutline, IoNavigateCircle, IoBicycle, IoCheckmarkCircle, IoWarningOutline, IoSettingsOutline, IoLogOutOutline, IoClose, IoWalletOutline, IoMapOutline, IoCloseCircleOutline, IoReceiptOutline, IoMenu } from 'react-icons/io5';
import { tocarCampainha } from '../utils/audioUtils';

// Constants
const RADIO_LIMITE_KM = 5; // Só recebe pedidos num raio de 5km

// Haversine formula para calcular distância em km entre duas coordenadas GPS
function calcularDistancia(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    var R = 6371; // km
    var dLat = paraRadianos(lat2 - lat1);
    var dLon = paraRadianos(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(paraRadianos(lat1)) * Math.cos(paraRadianos(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

function paraRadianos(valor) {
    return valor * Math.PI / 180;
}

export default function EntregadorApp() {
    const { currentUser, userData } = useAuth();
    const [isOnline, setIsOnline] = useState(false);
    const [localizacaoAtual, setLocalizacaoAtual] = useState(null);
    const [corridasDisponiveis, setCorridasDisponiveis] = useState([]);
    const [minhaCorridaAtual, setMinhaCorridaAtual] = useState(null);
    const [erroGps, setErroGps] = useState('');
    const [statsHoje, setStatsHoje] = useState({ qtde: 0, saldo: 0 });
    const navigate = useNavigate();
    const [showSettings, setShowSettings] = useState(false);
    const [editChavePix, setEditChavePix] = useState('');
    const [isSavingPix, setIsSavingPix] = useState(false);
    const [rejeitadas, setRejeitadas] = useState(new Set());
    const [showCarteira, setShowCarteira] = useState(false);
    const [historicoHoje, setHistoricoHoje] = useState([]);

    const { logout } = useAuth(); // Assume AuthContext provides logout

    // Ligar/Desligar Radar (Escutar pedidos)
    useEffect(() => {
        if (!isOnline) {
            setCorridasDisponiveis([]);
            return;
        }

        const q = query(
            collectionGroup(db, 'pedidos'),
            where('statusLogistica', '==', 'buscando_entregador')
            // Pode adicionar filtro por estabelecimentoId se focado num lugar só, mas a ideia é ser Uber (aberto)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const corridas = snapshot.docs.map(doc => ({
                id: doc.id,
                ref: doc.ref,
                ...doc.data()
            }));

            // Filtrar corridas que estão perto (<= RADIO_LIMITE_KM)
            // OBS: Só dá pra filtrar se a corrida tiver as coordenadas do restaurante.
            // Para o MVP, se não tiver as coordenadas do restaurante, mostramos mesmo assim.
            const corridasPerto = corridas.filter(corrida => {
                // Remove corridas ativamente rejeitadas localmente pelo motoboy
                if (rejeitadas.has(corrida.id)) return false;

                const restLat = corrida.restauranteLat; 
                const restLon = corrida.restauranteLng;

                if (!restLat || !restLon || !localizacaoAtual) return true; // Se não sabemos o GPS de alguém, libera a corrida.
                
                const distancia = calcularDistancia(localizacaoAtual.latitude, localizacaoAtual.longitude, restLat, restLon);
                return distancia <= RADIO_LIMITE_KM;
            });

            // Tocar som de chamamento alto se chegou algo novo
            // Só faz play se antes tinha menos corridas
            if (corridasPerto.length > corridasDisponiveis.length) {
                tocarCampainha();
                if (window.navigator?.vibrate) {
                    window.navigator.vibrate([200, 100, 200, 100, 500]);
                }
            }

            setCorridasDisponiveis(corridasPerto);
        });

        return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline, localizacaoAtual]);

    // Ligar/Desligar GPS e monitorar
    useEffect(() => {
        let watchId;
        if (isOnline) {
            if ("geolocation" in navigator) {
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        setErroGps('');
                        setLocalizacaoAtual({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        });
                        // Opcional: Atualizar a pos do motoboy no Firestore
                        // updateDoc(doc(db, 'usuarios', currentUser.uid), { lat: position.coords.latitude, lng: position.coords.longitude });
                    },
                    (error) => {
                        console.error('Erro GPS:', error);
                        setErroGps('Ative o Localização (GPS) no seu celular para receber corridas!');
                        setIsOnline(false);
                    },
                    { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
                );
            } else {
                setErroGps('Seu celular não suporta GPS.');
                setIsOnline(false);
            }
        } else {
            setLocalizacaoAtual(null);
        }

        return () => {
             if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [isOnline, currentUser]);


    // Monitorar minha corrida aceita atual
    useEffect(() => {
        if (!currentUser) return;
        
        // Verifica se eu peguei a corrida (já estou a caminho)
        const qAtual = query(
            collectionGroup(db, 'pedidos'),
            where('entregadorId', '==', currentUser.uid),
            where('statusLogistica', '==', 'entregador_a_caminho')
        );

        const unsubscribe = onSnapshot(qAtual, (snapshot) => {
            if (!snapshot.empty) {
                setMinhaCorridaAtual({ id: snapshot.docs[0].id, ref: snapshot.docs[0].ref, ...snapshot.docs[0].data() });
            } else {
                setMinhaCorridaAtual(null);
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Calcular Ganhos e Corridas do Dia
    useEffect(() => {
        if (!currentUser) return;

        const dataInicio = new Date();
        dataInicio.setHours(0, 0, 0, 0);

        const qHist = query(
            collectionGroup(db, 'pedidos'),
            where('entregadorId', '==', currentUser.uid),
            where('statusLogistica', '==', 'concluida')
        );

        const unsubscribe = onSnapshot(qHist, (snapshot) => {
            let qtde = 0;
            let total = 0;
            const historyList = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const concluidoEm = data.horarioConclusaoLogistica?.toDate ? data.horarioConclusaoLogistica.toDate() : null;
                // Exibe apenas as de *HOJE*
                if (concluidoEm && concluidoEm >= dataInicio) {
                    qtde++;
                    total += Number(data.taxaEntrega) || 0;
                    historyList.push({ id: docSnap.id, ...data, concluidoEm });
                }
            });
            // Ordenar histórico do mais recente pro mais antigo
            historyList.sort((a,b) => b.concluidoEm - a.concluidoEm);
            setHistoricoHoje(historyList);
            setStatsHoje({ qtde, saldo: total });
        }, (err) => {
            console.error("Erro ao puxar histórico de corridas: ", err);
        });

        return () => unsubscribe();
    }, [currentUser]);


    const aceitarCorrida = async (corridaLocal) => {
        if (minhaCorridaAtual) {
            toast.error("Você já está em uma entrega! Termine para pegar outra.");
            return;
        }

        try {
            await updateDoc(corridaLocal.ref, {
                statusLogistica: 'entregador_a_caminho',
                status: 'em_entrega', // Agora sim, vai ficar na coluna certa no painel do restaurante
                entregadorId: currentUser.uid,
                entregadorNome: userData?.nome || 'Motoboy Parceiro',
                motoboyId: currentUser.uid,
                motoboyNome: userData?.nome || 'Motoboy Parceiro',
                motoboyChavePix: userData?.chavePix || '',
                horarioAceiteLogistica: serverTimestamp()
            });

            toast.success("✅ Corrida aceita! Acelera lá!");
            if (window.navigator?.vibrate) window.navigator.vibrate(200);

        } catch (e) {
            console.error(e);
            toast.error("Alguém pegou a corrida primeiro! Ou erro na rede.");
        }
    };

    const finalizarCorrida = async (corridaLocal) => {
        try {
            await updateDoc(corridaLocal.ref, {
                statusLogistica: 'concluida',
                status: 'finalizado', // Põe como concluído
                horarioConclusaoLogistica: serverTimestamp(),
                dataFinalizado: serverTimestamp()
            });
            setMinhaCorridaAtual(null); // Clear optimistic
            toast.success("🏁 Entrega finalizada com sucesso! Parabéns!");
        } catch (e) {
            toast.error("Erro ao finalizar corrida.");
        }
    }

    const rejeitarCorridaLocamente = (corridaId) => {
        setRejeitadas(prev => {
           const n = new Set(prev);
           n.add(corridaId);
           return n;
        });
        toast.info("Corrida ignorada e removida do radar.");
    };

    // FUNCAO DEV / TESTE: Injeta uma corrida falsa no firebase para testar o radar
    const simularCorridaDeTeste = async () => {
        try {
            // Usa a localização atual do motoboy para gerar a loja perto dele (evita que o filtro de 5km oculte a corrida simulada)
            const lat = localizacaoAtual?.latitude || -23.5505;
            const lng = localizacaoAtual?.longitude || -46.6333;

            await addDoc(collection(db, 'estabelecimentos', 'LOJA_TESTE_UBER', 'pedidos'), {
                statusLogistica: 'aguardando_entregador',
                status: 'pronto',
                taxaEntrega: Math.floor(Math.random() * 10) + 5.50, // Entre R$5.50 e R$15.50
                enderecoOrigem: 'Rua do Restaurante, 123',
                enderecoEntrega: 'Av. Cliente Fictício, 999',
                bairro: 'Centro',
                distanciaTxt: '3km',
                restauranteNome: 'Restaurante Idea Dev',
                coordenadasRestaurante: { latitude: lat, longitude: lng }, // Perto de você
                cliente: { nome: 'João Testador', endereco: { rua: 'Rua Fake', numero: '10', bairro: 'Bairro Teste' } },
                dataPedido: serverTimestamp()
            });
            toast.success("✅ Corrida DEV gerada com sucesso! O Radar vai apitar em instantes.");
        } catch (e) {
            console.error(e);
            toast.error("Erro ao simular corrida de teste.");
        }
    };

    const abrirRotaNoMaps = (lat, lng, label) => {
        if (!lat || !lng) {
            toast.error("Sem coordenadas para " + label);
            return;
        }
        // Utiliza API universal (vai abrir no celular tanto iOS/Android)
        // Se quisermos navegação ativa ('dir' api)
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        window.open(url, '_blank');
    };

    const handleSavePix = async () => {
        if (!editChavePix.trim()) return toast.error('Digite uma chave PIX!');
        setIsSavingPix(true);
        try {
            import('firebase/firestore').then(async ({ doc, updateDoc }) => {
                await updateDoc(doc(db, 'usuarios', currentUser.uid), { chavePix: editChavePix });
            });
            // Update local memory manually since userData from context might delay
            if (userData) userData.chavePix = editChavePix;
            toast.success('Chave PIX atualizada com sucesso!');
            setShowSettings(false);
        } catch (e) {
            toast.error('Erro ao salvar.');
        } finally {
            setIsSavingPix(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (e) {
            toast.error('Erro ao sair.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans overflow-y-auto pb-32">
            
            {/* Header / StatusBar */}
            <div className="bg-slate-800 p-6 shadow-xl sticky top-0 z-50 rounded-b-3xl">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-black text-white flex items-center gap-2">
                           <button onClick={() => navigate('/painel')} className="mr-1 text-slate-300 hover:text-white transition-colors cursor-pointer p-1">
                               <IoMenu className="text-3xl" />
                           </button>
                           <IoBicycle className="text-emerald-400 text-3xl"/> IdeaEntregas
                        </h1>
                        <p className="text-sm font-medium text-slate-400 mt-1">Bem-vindo, {userData?.nome || 'Parceiro'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => {
                                setEditChavePix(userData?.chavePix || '');
                                setShowSettings(true);
                            }}
                            className="text-slate-400 hover:text-white transition-colors bg-slate-700/50 p-2 rounded-full"
                        >
                            <IoSettingsOutline className="text-xl" />
                        </button>
                        <button 
                           onClick={() => setIsOnline(!isOnline)}
                           disabled={!!minhaCorridaAtual}
                           className={`w-16 h-8 rounded-full relative transition-all duration-300 ${isOnline ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40' : 'bg-slate-600'} disabled:opacity-50`}
                        >
                            <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all duration-300 shadow-md ${isOnline ? 'left-9' : 'left-1'}`} />
                        </button>
                    </div>
                </div>
                {isOnline && localizacaoAtual && (
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-900/40 w-max px-3 py-1.5 rounded-full border border-emerald-500/20">
                        <IoNavigateCircle className="animate-spin-slow" size={16}/> RADAR ATIVADO (Sinal Forte)
                    </div>
                )}

                {/* PAINEL DE RENDIMENTOS DO DIA */}
                <div onClick={() => setShowCarteira(true)} className="mt-6 flex justify-between items-center bg-slate-900/50 hover:bg-slate-800 p-4 rounded-2xl border border-slate-700/50 shadow-inner cursor-pointer transition-colors group">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><IoReceiptOutline/> Corridas</span>
                        <span className="text-2xl font-black text-white leading-none group-hover:text-emerald-400 transition-colors">{statsHoje.qtde}</span>
                    </div>
                    <div className="w-px bg-slate-700/50 mx-4"></div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wider mb-1 flex items-center justify-end gap-1"><IoWalletOutline/> Extrato (Hoje)</span>
                        <span className="text-2xl font-black text-emerald-400 leading-none">R$ {statsHoje.saldo.toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 max-w-md mx-auto">

                {erroGps && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-100 p-4 rounded-2xl mb-6 flex items-start gap-3">
                        <IoWarningOutline className="text-3xl text-red-400 shrink-0" />
                        <p className="text-sm font-medium">{erroGps}</p>
                    </div>
                )}

                {/* Se o entregador está em uma corrida ativa, TRAVA TUDO e mostra só a corrida atual */}
                {minhaCorridaAtual ? (
                     <div className="bg-blue-600 rounded-3xl p-6 shadow-2xl shadow-blue-900/50 border border-blue-500 animate-slideUp relative overflow-hidden">
                        <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white opacity-10 rounded-full blur-2xl filter pointer-events-none"></div>
                        
                        <div className="flex items-center gap-2 text-blue-100 mb-6 bg-blue-700/50 w-max px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider">
                           <IoNavigateCircle className="text-lg animate-pulse" /> Você está em rota
                        </div>

                        <h2 className="text-2xl font-black text-white mb-2">
                           Cliente: {minhaCorridaAtual.cliente?.nome || 'Cliente não logado'}
                        </h2>
                        <h3 className="text-lg font-bold text-slate-200 mb-2">
                           Entrega na {minhaCorridaAtual.enderecoEntrega || minhaCorridaAtual.endereco?.rua || minhaCorridaAtual.cliente?.endereco?.rua || 'Endereço não informado'}, {(minhaCorridaAtual.endereco?.numero || minhaCorridaAtual.cliente?.endereco?.numero) || 'SN'}
                        </h3>
                        <p className="text-sm font-medium text-slate-400 mb-4">
                           Bairro: {minhaCorridaAtual.bairro || minhaCorridaAtual.endereco?.bairro || minhaCorridaAtual.cliente?.endereco?.bairro || 'Sem Bairro'}
                        </p>
                        
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => abrirRotaNoMaps(minhaCorridaAtual.restauranteLat, minhaCorridaAtual.restauranteLng, 'Restaurante')}
                                className="flex-1 py-3 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex justify-center items-center gap-2">
                                <IoMapOutline size={18} /> Rota Lojista
                            </button>
                            <button
                                onClick={() => abrirRotaNoMaps(
                                    minhaCorridaAtual.endereco?.lat || minhaCorridaAtual.cliente?.endereco?.lat, 
                                    minhaCorridaAtual.endereco?.lng || minhaCorridaAtual.cliente?.endereco?.lng, 
                                    'Cliente'
                                )}
                                className="flex-1 py-3 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex justify-center items-center gap-2">
                                <IoMapOutline size={18} /> Rota Cliente
                            </button>
                        </div>
                        {(minhaCorridaAtual.pontoReferencia || minhaCorridaAtual.endereco?.referencia || minhaCorridaAtual.cliente?.endereco?.referencia || minhaCorridaAtual.referencia) && <p className="text-blue-200 text-sm italic mb-6">" {minhaCorridaAtual.pontoReferencia || minhaCorridaAtual.endereco?.referencia || minhaCorridaAtual.cliente?.endereco?.referencia || minhaCorridaAtual.referencia} "</p>}

                        <div className="bg-slate-900/40 rounded-2xl p-4 mb-6 backdrop-blur-sm border border-white/10">
                            <p className="text-xs text-blue-300 font-bold uppercase tracking-wider mb-1">Pagamento na Entrega</p>
                            <p className="text-lg text-white font-black">{minhaCorridaAtual.formaPagamento || 'Não informado'} - R$ {(minhaCorridaAtual.totalPedido || 0).toFixed(2).replace('.',',')}</p>
                            
                            <p className="text-xs text-blue-300 font-bold uppercase tracking-wider mb-1 mt-4">Sua Taxa (Frete)</p>
                            <p className="text-2xl text-emerald-400 font-black">+ R$ {(minhaCorridaAtual.taxaEntrega || 0).toFixed(2).replace('.',',')}</p>
                        </div>

                        <button 
                          onClick={() => finalizarCorrida(minhaCorridaAtual)}
                          className="w-full py-4 bg-white hover:bg-slate-100 text-blue-700 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl flex justify-center items-center gap-2">
                          <IoCheckmarkCircle size={22} /> Entrega Encerrada (Concluir)
                        </button>
                     </div>
                ) : (
                    // Se não está em corrida, mostra o mapa/lista de disponíveis (Radar)
                    <>
                        {!isOnline ? (
                            <div className="flex flex-col items-center justify-center pt-20 text-center opacity-50">
                                <IoLocationOutline className="text-8xl text-slate-700 mb-4" />
                                <h3 className="text-xl font-bold text-slate-500">Você está off-line</h3>
                                <p className="text-sm font-medium text-slate-600 mt-2 max-w-[250px]">Ligue o radar ali em cima para começar a receber ofertas de entregas.</p>
                            </div>
                        ) : corridasDisponiveis.length === 0 ? (
                            <div className="flex flex-col items-center justify-center pt-20 text-center">
                                <div className="relative">
                                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full animate-ping absolute top-0 left-0"></div>
                                    <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center relative z-10 border-4 border-slate-700 shadow-[0_0_40px_rgb(16,185,129,0.2)]">
                                        <IoNavigateCircle className="text-4xl text-emerald-400" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-emerald-400 mt-8">Buscando Ofertas...</h3>
                                <p className="text-sm font-medium text-slate-400 mt-2 mb-6">Fique ligado! O radar está varrendo os restaurantes num raio de 5km.</p>
                                
                                {/* Botão DEV para evitar ter que abrir outra aba para criar pedido */}
                                <button
                                    onClick={simularCorridaDeTeste}
                                    className="border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                                >
                                    [DEV] Simular Corrida
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">🔥 Corridas Tocando Agora ({corridasDisponiveis.length})</p>
                                
                                {corridasDisponiveis.map(corrida => (
                                    <div key={corrida.id} className="bg-slate-800 border-2 border-emerald-500/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden animate-slideUp">
                                        <div className="absolute top-0 right-0 p-3 bg-emerald-500/10 rounded-bl-2xl">
                                           <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider animate-pulse">NOVO CHAMADO</p>
                                        </div>
                                        
                                        <div className="pr-20 mb-4">
                                           <h2 className="text-sm font-bold text-emerald-400 mb-1 uppercase tracking-widest">👤 {corrida.cliente?.nome || 'Cliente Local'}</h2>
                                           <h3 className="text-lg font-black text-white">{corrida.enderecoEntrega || corrida.endereco?.rua || corrida.cliente?.endereco?.rua || 'Endereço não informado'}, {(corrida.endereco?.numero || corrida.cliente?.endereco?.numero) || 'SN'}</h3>
                                           <p className="text-sm font-medium text-slate-400">Bairro: {corrida.bairro || corrida.endereco?.bairro || corrida.cliente?.endereco?.bairro || 'Sem Bairro'}</p>
                                        </div>

                                        <div className="flex items-center gap-4 bg-slate-900 rounded-2xl p-4 mb-5 border border-slate-700/50">
                                            <div className="flex-1">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Restaurante</p>
                                                <p className="text-sm font-bold text-white truncate">{corrida.restauranteNome || 'Restaurante Local'}</p>
                                            </div>
                                            <div className="w-px h-8 bg-slate-700"></div>
                                            <div className="flex-1">
                                                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Sua Taxa (Frete)</p>
                                                <p className="text-xl font-black text-emerald-400">R$ {(corrida.taxaEntrega || 0).toFixed(2).replace('.',',')}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => rejeitarCorridaLocamente(corrida.id)}
                                                className="w-1/3 py-4 border-2 border-slate-700 hover:bg-slate-700 text-slate-400 rounded-2xl font-black text-sm uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center">
                                                <IoCloseCircleOutline size={24} />
                                            </button>
                                            <button 
                                                onClick={() => aceitarCorrida(corrida)}
                                                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                                ACEITAR CORRIDA
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* MODAL CONFIGURAÇÕES */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
                    <div className="bg-slate-800 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 border-t sm:border border-slate-700 animate-slideUp">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-white flex items-center gap-2">
                                <IoSettingsOutline className="text-emerald-400" /> Configurações
                            </h2>
                            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white p-2 bg-slate-700/50 rounded-full transition-colors">
                                <IoClose className="text-xl" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-2">Sua Chave PIX</label>
                                <input 
                                    type="text" 
                                    value={editChavePix} 
                                    onChange={(e) => setEditChavePix(e.target.value)} 
                                    placeholder="CPF, Telefone ou Email..."
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-700 bg-slate-900 text-emerald-400 font-bold focus:bg-slate-900 focus:border-emerald-500 outline-none transition-all placeholder-slate-500"
                                />
                                <button 
                                    onClick={handleSavePix}
                                    disabled={isSavingPix || editChavePix === (userData?.chavePix || '')}
                                    className="w-full mt-3 bg-emerald-500 text-white font-black py-3 rounded-xl disabled:opacity-50 hover:bg-emerald-600 transition-colors shadow-lg"
                                >
                                    {isSavingPix ? 'SALVANDO...' : 'ATUALIZAR CHAVE PIX'}
                                </button>
                            </div>
                            
                            <hr className="border-slate-700" />

                            <button 
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 py-4 text-red-400 font-black tracking-wider uppercase text-sm border-2 border-red-500/20 bg-red-500/10 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-95"
                            >
                                <IoLogOutOutline className="text-xl" /> SAIR DO APLICATIVO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CARTEIRA (REPASSES) */}
            {showCarteira && (
                <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
                    <div className="bg-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 border-t sm:border border-slate-700 animate-slideUp flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h2 className="text-xl font-black text-white flex items-center gap-2">
                                <IoWalletOutline className="text-emerald-400" /> Carteira Diária
                            </h2>
                            <button onClick={() => setShowCarteira(false)} className="text-slate-400 hover:text-white p-2 bg-slate-700/50 rounded-full transition-colors">
                                <IoClose className="text-xl" />
                            </button>
                        </div>

                        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-5 mb-6 text-center shrink-0">
                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Total Hoje em Taxas</p>
                            <p className="text-3xl font-black text-emerald-400">R$ {statsHoje.saldo.toFixed(2).replace('.', ',')}</p>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">As corridas são pagas segundo a regra da central.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Histórico de Hoje ({historicoHoje.length})</p>
                            {historicoHoje.length === 0 ? (
                                <div className="text-center py-10 opacity-50">
                                    <IoReceiptOutline className="text-5xl mx-auto text-slate-600 mb-3" />
                                    <p className="text-sm font-medium text-slate-400">Nenhuma entrega concluída hoje.</p>
                                </div>
                            ) : (
                                historicoHoje.map(h => (
                                    <div key={h.id} className="bg-slate-900/80 rounded-xl p-4 flex justify-between items-center border border-slate-700/50">
                                        <div>
                                            <p className="text-sm font-bold text-slate-200">{h.restauranteNome || 'Restaurante'}</p>
                                            <p className="text-[10px] uppercase font-bold text-slate-500">#{h.id.substring(0, 6)} • {h.concluidoEm ? h.concluidoEm.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : ''}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-base font-black text-emerald-400">R$ {(h.taxaEntrega || 0).toFixed(2).replace('.',',')}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
