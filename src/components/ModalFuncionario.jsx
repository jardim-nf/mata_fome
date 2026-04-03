import React, { useState } from 'react';
import { toast } from 'react-toastify';

export const ModalFuncionario = ({ funcionario, onClose, onSave, cargos, permissoesDisponiveis, loading }) => {
    const [nome, setNome] = useState(funcionario?.nome || '');
    const [email, setEmail] = useState(funcionario?.email || '');
    const [senha, setSenha] = useState('');
    // Normaliza para lowercase para evitar bugs no select
    const [cargo, setCargo] = useState(funcionario?.cargo?.toLowerCase() || cargos[0].toLowerCase());
    const [telefone, setTelefone] = useState(funcionario?.telefone || '');
    const [permissoes, setPermissoes] = useState(funcionario?.permissoes || []);
    
    // Função de toggle de permissão
    const togglePermissao = (key) => {
        setPermissoes(prev => 
            prev.includes(key)
                ? prev.filter(p => p !== key)
                : [...prev, key]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!nome.trim() || !email.trim() || !cargo.trim()) {
            toast.warning("Preencha Nome, Email e Cargo.");
            return;
        }

        // Validação da Senha: Apenas no modo Adicionar
        if (!funcionario) {
            if (!senha || senha.length < 6) {
                toast.warning("A senha é obrigatória e deve ter no mínimo 6 caracteres para novos funcionários.");
                return;
            }
        }

        const payload = { 
            nome: nome.trim(), 
            email: email.trim(), 
            // CONVERTE PARA MINÚSCULO PARA BATER COM O CHECK DE ROTAS (App.jsx)
            cargo: cargo.toLowerCase(), 
            telefone: telefone.trim() || null, 
            permissoes, 
            status: funcionario?.status || 'ativo',
            isAdmin: false, 
            isMasterAdmin: false 
        };

        // CORREÇÃO: Só adiciona a senha se for CRIAÇÃO (evita undefined na edição)
        if (!funcionario) {
            payload.senha = senha;
        }

        onSave(payload);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {funcionario ? 'Editar Funcionário' : 'Adicionar Novo Funcionário'}
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                        {/* Nome */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome *
                            </label>
                            <input 
                                type="text" 
                                value={nome} 
                                onChange={(e) => setNome(e.target.value)} 
                                required 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Digite o nome completo"
                            />
                        </div>
                        
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email *
                            </label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required
                                disabled={!!funcionario}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder="exemplo@email.com"
                            />
                            {funcionario && (
                                <p className="text-xs text-gray-500 mt-1">
                                    O email não pode ser alterado
                                </p>
                            )}
                        </div>
                        
                        {/* Cargo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cargo *
                            </label>
                            <select 
                                value={cargo} 
                                onChange={(e) => setCargo(e.target.value)} 
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white capitalize"
                            >
                                {cargos.map(c => (
                                    <option key={c} value={c.toLowerCase()}>{c}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Telefone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Telefone
                            </label>
                            <input 
                                type="tel" 
                                value={telefone} 
                                onChange={(e) => setTelefone(e.target.value)} 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="(11) 99999-9999"
                            />
                        </div>
                        
                        {/* SENHA: SOMENTE PARA NOVOS FUNCIONÁRIOS */}
                        {!funcionario && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Senha * (Mínimo 6 caracteres)
                                </label>
                                <input 
                                    type="password" 
                                    value={senha} 
                                    onChange={(e) => setSenha(e.target.value)} 
                                    required
                                    minLength={6}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Digite a senha"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    A senha será usada para o funcionário fazer login
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Permissões */}
                    <div className="mb-6 border border-gray-200 p-4 rounded-lg bg-gray-50">
                        <h3 className="text-md font-semibold text-gray-700 mb-3">Permissões de Acesso:</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {permissoesDisponiveis.map(p => (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => togglePermissao(p.key)}
                                    className={`flex items-center justify-between p-3 rounded-md transition-colors border ${
                                        permissoes.includes(p.key)
                                            ? 'bg-green-500 text-white border-green-600'
                                            : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-300'
                                    }`}
                                >
                                    <span className="text-left">{p.label}</span>
                                    <span>{permissoes.includes(p.key) ? '✅' : '❌'}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button 
                            type="button" 
                            onClick={onClose}
                            disabled={loading}
                            className="py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading && (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            )}
                            {funcionario ? 'Salvar Alterações' : 'Adicionar Funcionário'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
