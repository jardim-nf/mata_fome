import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaPlay, FaTrash, FaPlus, FaMicrophoneAlt, FaListUl, FaStepForward } from 'react-icons/fa';
import BackButton from '../../components/BackButton';

export default function KaraokeAdmin() {
  const [queue, setQueue] = useState([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    // Busca apenas waiting e singing, sem order by pra não pedir index composto no firebase
    const q = query(
      collection(db, 'karaoke_queue'),
      where('status', 'in', ['waiting', 'singing'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordena localmente: singing primeiro, depois waiting por createdAt
      data.sort((a, b) => {
        if (a.status === 'singing' && b.status !== 'singing') return -1;
        if (b.status === 'singing' && a.status !== 'singing') return 1;
        
        const timeA = a.createdAt?.toMillis() || Date.now();
        const timeB = b.createdAt?.toMillis() || Date.now();
        return timeA - timeB;
      });
      setQueue(data);
    }, (error) => {
      console.error("Erro ao buscar fila:", error);
      toast.error("Erro ao carregar fila do karaokê");
    });

    return () => unsubscribe();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      await addDoc(collection(db, 'karaoke_queue'), {
        name: newName.trim(),
        status: 'waiting',
        createdAt: serverTimestamp()
      });
      setNewName('');
      toast.success('Cantor adicionado à fila!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao adicionar à fila.');
    }
  };

  const handleNext = async () => {
    const currentSinging = queue.filter(q => q.status === 'singing');
    const nextWaiting = queue.find(q => q.status === 'waiting');

    try {
      const updatePromises = currentSinging.map(c => 
        updateDoc(doc(db, 'karaoke_queue', c.id), { 
          status: 'waiting',
          createdAt: serverTimestamp() 
        })
      );

      if (nextWaiting) {
        updatePromises.push(
          updateDoc(doc(db, 'karaoke_queue', nextWaiting.id), { status: 'singing' })
        );
      }

      await Promise.all(updatePromises);
      
      if (nextWaiting) {
        toast.success(`A vez agora é de ${nextWaiting.name}!`);
      } else if (currentSinging.length > 0) {
        toast.info('A fila acabou.');
      } else {
        toast.warning('A fila já está vazia.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao chamar próximo.');
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Remover da fila?')) {
      try {
        await deleteDoc(doc(db, 'karaoke_queue', id));
        toast.info('Removido com sucesso.');
      } catch (err) {
        toast.error('Erro ao remover.');
      }
    }
  };

  const handleClearList = async () => {
    if(queue.length === 0) return;
    if(window.confirm('Tem certeza que deseja APAGAR TODOS os cantores da fila e quem está cantando agora? Isso não pode ser desfeito.')) {
      try {
        const batch = writeBatch(db);
        queue.forEach(q => {
          const docRef = doc(db, 'karaoke_queue', q.id);
          batch.delete(docRef);
        });
        await batch.commit();
        toast.success('Lista limpa com sucesso!');
      } catch (err) {
        console.error(err);
        toast.error('Erro ao limpar a lista.');
      }
    }
  };

  const setAsSinging = async (id) => {
    try {
        const currentSinging = queue.filter(q => q.status === 'singing');
        const updatePromises = currentSinging.map(c => 
            updateDoc(doc(db, 'karaoke_queue', c.id), { 
                status: 'waiting',
                createdAt: serverTimestamp()
            })
        );
        updatePromises.push(updateDoc(doc(db, 'karaoke_queue', id), { status: 'singing' }));
        await Promise.all(updatePromises);
        toast.success('Cantor atualizado!');
    } catch(err) {
        toast.error('Erro ao atualizar status.');
    }
  }

  const singingList = queue.filter(q => q.status === 'singing');
  const waitingList = queue.filter(q => q.status === 'waiting');

  return (
    <div className="p-4 sm:p-6 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-[1600px] w-full mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
                <BackButton />
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2 tracking-tight">
                        <FaMicrophoneAlt className="text-orange-500" /> Karaokê Admin
                    </h1>
                    <p className="text-sm text-gray-500 font-medium mt-0.5">Gerencie a fila da TV</p>
                </div>
            </div>
        </div>

        {/* Adicionar */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Nome do próximo cantor..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all font-semibold text-gray-700 placeholder-gray-400"
                    />
                </div>
                <button
                    type="submit"
                    disabled={!newName.trim()}
                    className="bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md sm:w-auto w-full active:scale-95"
                >
                    <FaPlus /> Adicionar
                </button>
            </form>
        </div>

        {/* Top Actions: Cantando Agora & Próximo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cantando Agora */}
            {singingList.length > 0 ? (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 rounded-2xl shadow-md text-white flex flex-col justify-center min-h-[120px]">
                    <div className="flex items-center gap-2 mb-3">
                        <FaPlay className="text-sm animate-pulse" />
                        <h2 className="text-sm font-black opacity-90 uppercase tracking-widest">Cantando Agora</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                    {singingList.map(singer => (
                        <div key={singer.id} className="text-2xl md:text-3xl font-black drop-shadow-md bg-white/20 px-5 py-2 rounded-xl border border-white/30 backdrop-blur-md truncate">
                            {singer.name}
                        </div>
                    ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white border-2 border-dashed border-gray-200 p-6 rounded-2xl text-gray-400 flex flex-col justify-center items-center min-h-[120px]">
                    <FaMicrophoneAlt className="text-3xl mb-2 opacity-50" />
                    <p className="font-medium text-sm uppercase tracking-wider">Ninguém cantando</p>
                </div>
            )}

            {/* Próximo Button */}
            <button 
                onClick={handleNext}
                disabled={waitingList.length === 0 && singingList.length === 0}
                className="bg-orange-500 hover:bg-orange-600 text-white p-6 rounded-2xl shadow-md flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all min-h-[120px]"
            >
                <div className="flex items-center gap-3 font-black text-2xl">
                    Chamar Próximo <FaStepForward />
                </div>
                {waitingList.length > 0 && (
                    <span className="text-sm font-bold bg-white/20 px-4 py-1.5 rounded-full mt-1 border border-white/20">
                        Será: {waitingList[0].name}
                    </span>
                )}
            </button>
        </div>

        {/* Fila */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[50vh]">
            <div className="bg-gray-50/80 border-b border-gray-100 p-5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-gray-800 font-black text-lg flex items-center gap-2 tracking-tight">
                    <FaListUl className="text-orange-500" /> Próximos da Fila 
                    <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md text-sm">{waitingList.length}</span>
                </h2>
                {queue.length > 0 && (
                    <button 
                        onClick={handleClearList}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-red-100 active:scale-95 shadow-sm"
                    >
                        <FaTrash /> Limpar Lista Completa
                    </button>
                )}
            </div>
            
            <div className="p-5 sm:p-6">
                {waitingList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <FaMicrophoneAlt className="text-4xl text-gray-300" />
                        </div>
                        <p className="text-lg font-bold text-gray-500">Ninguém na fila no momento.</p>
                        <p className="text-sm text-gray-400 mt-1">Adicione o primeiro cantor acima.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                        {waitingList.map((item, index) => (
                            <div key={item.id} className="bg-white border-2 border-gray-100 rounded-2xl p-5 flex flex-col justify-between hover:border-orange-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50 group-hover:from-orange-100 group-hover:to-orange-50 text-gray-600 group-hover:text-orange-600 font-black rounded-xl text-2xl shadow-sm border border-gray-200 group-hover:border-orange-200 transition-colors">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-gray-800 text-xl truncate tracking-tight" title={item.name}>{item.name}</h3>
                                        <p className="text-xs text-gray-400 font-bold mt-0.5 uppercase tracking-wider">Aguardando</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 mt-auto border-t border-gray-100 pt-4">
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-3 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors active:scale-95"
                                        title="Remover da fila"
                                    >
                                        <FaTrash />
                                    </button>
                                    <button
                                        onClick={() => setAsSinging(item.id)}
                                        className="flex-1 px-4 py-3 bg-gray-50 text-gray-700 hover:bg-orange-500 hover:text-white border border-gray-200 hover:border-orange-500 rounded-xl transition-all font-black text-sm flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                        title="Chamar para cantar agora"
                                    >
                                        <FaPlay className="text-xs" /> Chamar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

      </div>



    </div>
  );
}
