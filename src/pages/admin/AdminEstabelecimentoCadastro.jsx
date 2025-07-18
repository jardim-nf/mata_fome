// src/pages/AdminEstabelecimentoCadastro.jsx (Exemplo)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'; // Importe getDocs para buscar usuários
import { db } from "../../firebase";

import { toast } from 'react-toastify';
import { useAuth } from "../../context/AuthContext"; // Corrigido para subir duas pastas // Esta linha está com o caminho incorreto/ Se precisar verificar admin aqui

function AdminEstabelecimentoCadastro() {
  const navigate = useNavigate();
  const { currentUser, isAdmin, loading: authLoading } = useAuth(); // Para controle de acesso

  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [complemento, setComplemento] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rating, setRating] = useState(4); // Valor padrão
  const [horarioFuncionamento, setHorarioFuncionamento] = useState('');
  const [telefoneWhatsApp, setTelefoneWhatsApp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [adminUidVinculado, setAdminUidVinculado] = useState(''); // Estado para o UID do admin a ser vinculado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redireciona se não for admin
    if (!authLoading && (!currentUser || !isAdmin)) {
      toast.error('Acesso negado. Você precisa ser um administrador para acessar esta página.');
      navigate('/');
    }
  }, [currentUser, isAdmin, authLoading, navigate]);


  const handleCadastro = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validações básicas
    if (!nome.trim() || !slug.trim() || !adminUidVinculado.trim()) {
      setError('Nome, Slug e UID do Administrador são campos obrigatórios.');
      setLoading(false);
      return;
    }

    try {
      // Opcional: Verificar se o slug já existe
      const qSlug = query(collection(db, 'estabelecimentos'), where('slug', '==', slug.trim()));
      const slugSnapshot = await getDocs(qSlug);
      if (!slugSnapshot.empty) {
        setError('Este "slug" já está em uso por outro estabelecimento. Por favor, escolha outro.');
        setLoading(false);
        return;
      }

      // Opcional: Verificar se o adminUID vinculado existe e é válido (se você tiver uma coleção de usuários admin)
      // Por enquanto, vamos assumir que o UID é válido.

      const novoEstabelecimento = {
        nome: nome.trim(),
        slug: slug.trim(),
        chavePix: chavePix.trim(),
        imageUrl: imageUrl.trim(),
        rating: Number(rating),
        adminUID: adminUidVinculado.trim(), // Vincula o UID do administrador
        endereco: {
          rua: rua.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          complemento: complemento.trim(),
        },
        informacoes_contato: {
          horario_funcionamento: horarioFuncionamento.trim(),
          telefone_whatsapp: telefoneWhatsApp.trim(),
          instagram: instagram.trim(),
        },
        // O cardápio será adicionado posteriormente, como você fez.
        // cardapio: [], // Poderia iniciar vazio aqui
      };

      await addDoc(collection(db, 'estabelecimentos'), novoEstabelecimento);
      toast.success('Estabelecimento cadastrado com sucesso!');
      navigate('/admin/dashboard'); // Redireciona após o cadastro
    } catch (err) {
      console.error("Erro ao cadastrar estabelecimento:", err);
      setError('Erro ao cadastrar estabelecimento. Tente novamente.');
      toast.error('Erro ao cadastrar estabelecimento.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="text-center p-4">Carregando...</div>;
  }
  if (!currentUser || !isAdmin) {
    return null; // ou um componente de "Acesso negado"
  }

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white shadow-lg rounded-lg my-8">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Cadastrar Novo Estabelecimento</h1>
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}
      
      <form onSubmit={handleCadastro} className="space-y-4">
        {/* Dados Básicos */}
        <div>
          <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome do Estabelecimento *</label>
          <input type="text" id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700">Slug (URL amigável) *</label>
          <input type="text" id="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} required 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
          <p className="mt-1 text-xs text-gray-500">Será a parte final da URL do cardápio (ex: /cardapios/seunome).</p>
        </div>
        <div>
          <label htmlFor="chavePix" className="block text-sm font-medium text-gray-700">Chave PIX (Para Receber Pagamentos)</label>
          <input type="text" id="chavePix" value={chavePix} onChange={(e) => setChavePix(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>
        <div>
          <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700">URL da Imagem/Logo (Opcional)</label>
          <input type="text" id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>
        <div>
          <label htmlFor="rating" className="block text-sm font-medium text-gray-700">Avaliação Inicial (1-5, Opcional)</label>
          <input type="number" id="rating" value={rating} onChange={(e) => setRating(e.target.value)} min="1" max="5"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>

        {/* Informações de Contato */}
        <h2 className="text-xl font-bold mt-8 mb-4">Informações de Contato</h2>
        <div>
          <label htmlFor="horarioFuncionamento" className="block text-sm font-medium text-gray-700">Horário de Funcionamento</label>
          <input type="text" id="horarioFuncionamento" value={horarioFuncionamento} onChange={(e) => setHorarioFuncionamento(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>
        <div>
          <label htmlFor="telefoneWhatsApp" className="block text-sm font-medium text-gray-700">Telefone/WhatsApp</label>
          <input type="tel" id="telefoneWhatsApp" value={telefoneWhatsApp} onChange={(e) => setTelefoneWhatsApp(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>
        <div>
          <label htmlFor="instagram" className="block text-sm font-medium text-gray-700">Instagram (@usuario)</label>
          <input type="text" id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>

        {/* Endereço */}
        <h2 className="text-xl font-bold mt-8 mb-4">Endereço do Estabelecimento</h2>
        <div>
          <label htmlFor="rua" className="block text-sm font-medium text-gray-700">Rua</label>
          <input type="text" id="rua" value={rua} onChange={(e) => setRua(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>
        <div>
          <label htmlFor="numero" className="block text-sm font-medium text-gray-700">Número</label>
          <input type="text" id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>
        <div>
          <label htmlFor="bairro" className="block text-sm font-medium text-gray-700">Bairro</label>
          <input type="text" id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>
        <div>
          <label htmlFor="cidade" className="block text-sm font-medium text-gray-700">Cidade</label>
          <input type="text" id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>
        <div>
          <label htmlFor="complemento" className="block text-sm font-medium text-gray-700">Complemento</label>
          <input type="text" id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
        </div>

        {/* Vinculação de Administrador */}
        <h2 className="text-xl font-bold mt-8 mb-4">Vincular Administrador</h2>
        <div>
          <label htmlFor="adminUid" className="block text-sm font-medium text-gray-700">UID do Administrador Vinculado *</label>
          <input type="text" id="adminUid" value={adminUidVinculado} onChange={(e) => setAdminUidVinculado(e.target.value)} required 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
          <p className="mt-1 text-xs text-gray-500">Este é o UID do usuário que será o administrador principal deste estabelecimento.</p>
        </div>
        
        <button type="submit" disabled={loading}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          {loading ? 'Cadastrando...' : 'Cadastrar Estabelecimento'}
        </button>
      </form>
    </div>
  );
}

export default AdminEstabelecimentoCadastro;