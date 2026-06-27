import React, { useEffect, useState, useRef } from 'react';
import { FaTerminal } from 'react-icons/fa';

export default function LiveTerminal({ socket, isConnected }) {
  const [logs, setLogs] = useState([
    'Conectando ao núcleo da bridge local...',
    isConnected ? 'Status: ONLINE' : 'Status: AGUARDANDO CONEXÃO...'
  ]);
  const endRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleStdout = (data) => {
      setLogs((prev) => [...prev, data.toString()]);
    };

    const handleStderr = (data) => {
      setLogs((prev) => [...prev, `[ERRO] ${data.toString()}`]);
    };

    const handleExit = (data) => {
      setLogs((prev) => [...prev, `[PROCESSO FINALIZADO com código ${data.code}]`]);
    };

    const handleFileLog = (data) => {
      if (data.path) {
        setLogs((prev) => [...prev, `[FILE SYSTEM] Modificado: ${data.path}`]);
      }
    };

    const handleWebSearch = (data) => {
      if (data.query) {
        setLogs((prev) => [...prev, `[WEB] Pesquisando: ${data.query}`]);
      }
    };

    socket.on('command_stdout', handleStdout);
    socket.on('command_stderr', handleStderr);
    socket.on('command_exit', handleExit);
    socket.on('write_file_success', handleFileLog);
    socket.on('web_search', handleWebSearch);

    return () => {
      socket.off('command_stdout', handleStdout);
      socket.off('command_stderr', handleStderr);
      socket.off('command_exit', handleExit);
      socket.off('write_file_success', handleFileLog);
      socket.off('web_search', handleWebSearch);
    };
  }, [socket]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="w-full h-full bg-slate-950 text-emerald-400 font-mono text-sm p-4 overflow-y-auto flex flex-col gap-1 shadow-inner border border-emerald-900/50 rounded-lg">
      <div className="flex items-center gap-2 text-emerald-500 mb-2 border-b border-emerald-900/50 pb-2">
        <FaTerminal />
        <span className="font-bold">LIVE CONSOLE</span>
      </div>
      {logs.map((log, index) => (
        <div key={index} className="whitespace-pre-wrap break-words">
          <span className="text-emerald-700 select-none mr-2">{'>'}</span>
          {log}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
