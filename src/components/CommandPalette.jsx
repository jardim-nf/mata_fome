import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoSearch, IoGrid, IoRestaurant, IoCart, IoSettings, IoClose } from 'react-icons/io5';

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    const commands = [
        { id: 'pdv', name: 'Caixa / PDV', icon: <IoCart />, route: '/pdv' },
        { id: 'salao', name: 'Controle de Salão', icon: <IoRestaurant />, route: '/controle-salao' },
        { id: 'pedidos', name: 'Painel de Pedidos / KDS', icon: <IoCart />, route: '/painel' },
        { id: 'dashboard', name: 'Dashboard Principal', icon: <IoGrid />, route: '/dashboard' },
        { id: 'config', name: 'Configurações', icon: <IoSettings />, route: '/admin/configuracoes' },
    ];

    const filteredCommands = commands.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

    const executeCommand = (cmd) => {
        setIsOpen(false);
        navigate(cmd.route);
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < filteredCommands.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter' && filteredCommands.length > 0) {
            e.preventDefault();
            executeCommand(filteredCommands[selectedIndex]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-start justify-center pt-[15vh]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center px-4 py-3 border-b border-gray-100">
                    <IoSearch className="text-gray-400 text-xl" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full bg-transparent border-none outline-none px-3 text-lg text-gray-800 placeholder-gray-400"
                        placeholder="Para onde você quer ir? (Ex: pdv, salão...)"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleInputKeyDown}
                    />
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <IoClose className="text-xl" />
                    </button>
                </div>

                <div className="max-h-80 overflow-y-auto p-2">
                    {filteredCommands.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">Nenhum resultado encontrado.</div>
                    ) : (
                        filteredCommands.map((cmd, index) => (
                            <button
                                key={cmd.id}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                                    index === selectedIndex ? 'bg-orange-50 text-orange-600' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                                onClick={() => executeCommand(cmd)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <span className={`text-xl ${index === selectedIndex ? 'text-orange-500' : 'text-gray-400'}`}>
                                    {cmd.icon}
                                </span>
                                <span className="font-medium">{cmd.name}</span>
                            </button>
                        ))
                    )}
                </div>
                
                <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
                    <span>Use <kbd className="bg-gray-200 px-1 rounded">↑</kbd> <kbd className="bg-gray-200 px-1 rounded">↓</kbd> para navegar</span>
                    <span><kbd className="bg-gray-200 px-1 rounded">Enter</kbd> para selecionar</span>
                </div>
            </div>
            
            {/* Fechar ao clicar fora */}
            <div className="absolute inset-0 z-[-1]" onClick={() => setIsOpen(false)} />
        </div>
    );
}
