import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <BackButton />
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaMicrophoneAlt className="text-orange-500" /> Karaokê Admin
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Gerencie a fila da TV</p>
                </div>
            </div>
            <button 
                onClick={handleNext}
                disabled={waitingList.length === 0 && singingList.length === 0}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow-md font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Próximo <FaStepForward />
            </button>
        </div>

        {/* Adicionar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <form onSubmit={handleAdd} className="flex gap-2">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome do Cantor"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
                <button
                    type="submit"
                    disabled={!newName.trim()}
                    className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white px-6 rounded-lg font-medium flex items-center justify-center transition-colors"
                >
                    <FaPlus />
                </button>
            </form>
        </div>

        {/* Cantando Agora */}
        {singingList.length > 0 && (
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-5 rounded-xl shadow-md text-white">
                <h2 className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FaPlay className="text-xs" /> Cantando Agora
                </h2>
                {singingList.map(singer => (
                    <div key={singer.id} className="text-2xl font-bold">
                        {singer.name}
                    </div>
                ))}
            </div>
        )}

        {/* Fila */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 p-4">
                <h2 className="text-gray-700 font-semibold flex items-center gap-2">
                    <FaListUl className="text-gray-400" /> Próximos da Fila ({waitingList.length})
                </h2>
            </div>
            
            <div className="divide-y divide-gray-100">
                {waitingList.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        Ninguém na fila no momento.
                    </div>
                ) : (
                    waitingList.map((item, index) => (
                        <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <span className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 font-bold rounded-full text-sm">
                                    {index + 1}
                                </span>
                                <span className="font-medium text-gray-800">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setAsSinging(item.id)}
                                    className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                                    title="Chamar agora (pular fila)"
                                >
                                    <FaPlay />
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remover"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
