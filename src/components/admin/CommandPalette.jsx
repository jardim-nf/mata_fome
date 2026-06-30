import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiCommand, FiHome, FiUsers, FiDollarSign, FiSettings, FiActivity } from 'react-icons/fi';

const MOCK_COMMANDS = [
  { id: 1, title: 'Ir para Visão Geral', icon: <FiHome />, path: '/master-dashboard', shortcut: 'G' },
  { id: 2, title: 'Lojas e Estabelecimentos', icon: <FiSettings />, path: '/master/estabelecimentos', shortcut: 'S' },
  { id: 3, title: 'Financeiro e Caixa', icon: <FiDollarSign />, path: '/master/financeiro', shortcut: 'F' },
  { id: 4, title: 'Usuários do Sistema', icon: <FiUsers />, path: '/master/usuarios', shortcut: 'U' },
  { id: 5, title: 'Logs de Auditoria', icon: <FiActivity />, path: '/admin/audit-logs', shortcut: 'A' },
];

export const CommandPalette = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [isOpen]);

  const filteredCommands = MOCK_COMMANDS.filter(cmd => 
    cmd.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-[1000] overflow-hidden"
          >
            <div className="flex items-center px-4 py-4 border-b border-white/10">
              <FiSearch className="text-slate-400 mr-3" size={24} />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="O que você precisa fazer? (Busca global...)"
                className="w-full bg-transparent text-white text-lg outline-none placeholder-slate-500 font-space"
              />
              <div className="flex gap-1 ml-3">
                <kbd className="bg-slate-800 text-slate-400 px-2 py-1 rounded-md text-xs font-mono font-bold">ESC</kbd>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {filteredCommands.length > 0 ? (
                <div className="py-2">
                  <div className="px-3 mb-2 text-xs font-black text-slate-500 uppercase tracking-widest font-bricolage">Ações Rápidas</div>
                  {filteredCommands.map((cmd) => (
                    <div
                      key={cmd.id}
                      onClick={() => handleSelect(cmd.path)}
                      className="flex items-center justify-between px-3 py-3 mx-1 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg text-slate-300 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
                          {cmd.icon}
                        </div>
                        <span className="text-slate-300 group-hover:text-white font-medium">{cmd.title}</span>
                      </div>
                      <div className="text-xs text-slate-600 font-mono font-bold hidden md:block">
                        Saltar para
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">
                  Nenhum comando encontrado para "{search}"
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
