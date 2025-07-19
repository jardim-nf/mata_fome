// src/pages/admin/EditarEstabelecimentoMaster.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // Caminho relativo correto para firebase.js
import { useAuth } from '../../context/AuthContext'; // Caminho relativo correto para AuthContext.js
import { toast } from 'react-toastify';

function EditarEstabelecimentoMaster() {
  const { id } = useParams(); // Pega o ID do estabelecimento da URL
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

  const [estabelecimento, setEstabelecimento] = useState(null);
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [complemento, setComplemento] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rating, setRating] = useState(0);
  const [horarioFuncionamento, setHorarioFuncionamento] = useState('');
  const [telefoneWhatsApp, setTelefoneWhatsApp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [adminUidVinculado, setAdminUidVinculado] = useState('');
  const [ativo, setAtivo] = useState(true); // NOVO ESTADO: para o status 'ativo'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Efeito para carregar dados do estabelecimento
  useEffect(() => {
    if (!authLoading && (!currentUser || !isMasterAdmin)) {
      toast.error('Acesso negado. Esta página é exclusiva do Administrador Master.');
      navigate('/master-dashboard');
      setLoading(false);
      return;
    }

    const fetchEstabelecimento = async () => {
      try {
        const docRef = doc(db, 'estabelecimentos', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setEstabelecimento(data);
          setNome(data.nome || '');
          setSlug(data.slug || '');
          setChavePix(data.chavePix || '');
          setImageUrl(data.imageUrl || '');
          setRating(data.rating || 0);
          setAdminUidVinculado(data.adminUID || '');
          setAtivo(data.ativo !== undefined ? data.ativo : true); // Define 'ativo' ou padrão para true

          if (data.endereco) {
            setRua(data.endereco.rua || '');
            setNumero(data.endereco.numero || '');
            setBairro(data.endereco.bairro || '');
            setCidade(data.endereco.cidade || '');
            setComplemento(data.endereco.complemento || '');
          }
          if (data.informacoes_contato) {
            setHorarioFuncionamento(data.informacoes_contato.horario_funcionamento || '');
            setTelefoneWhatsApp(data.informacoes_contato.telefone_whatsapp || '');
            setInstagram(data.informacoes_contato.instagram || '');
          }
        } else {
          setError('Estabelecimento não encontrado.');
          toast.error('Estabelecimento não encontrado.');
          navigate('/master/estabelecimentos'); // Volta para a lista se não encontrar
        }
      } catch (err) {
        console.error("Erro ao carregar estabelecimento:", err);
        setError('Erro ao carregar detalhes do estabelecimento.');
        toast.error('Erro ao carregar detalhes do estabelecimento.');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && currentUser && isMasterAdmin) {
        fetchEstabelecimento();
    }
  }, [id, currentUser, isMasterAdmin, authLoading, navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true); // Reutiliza o estado de loading para o update
    setError('');

    try {
      const estabRef = doc(db, 'estabelecimentos', id);
      const updatedData = {
        nome: nome.trim(),
        slug: slug.trim(),
        chavePix: chavePix.trim(),
        imageUrl: imageUrl.trim(),
        rating: Number(rating),
        adminUID: adminUidVinculado.trim(),
        ativo: ativo, // NOVO: Salva o status 'ativo'
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
        // Não atualizamos o 'cardapio' aqui, pois ele tem sua própria ferramenta
      };

      await updateDoc(estabRef, updatedData);
      toast.success('Estabelecimento atualizado com sucesso!');
      navigate('/master/estabelecimentos'); // Volta para a lista após a atualização
    } catch (err) {
      console.error("Erro ao atualizar estabelecimento:", err);
      setError('Erro ao atualizar estabelecimento. Tente novamente.');
      toast.error('Erro ao atualizar estabelecimento.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="text-center p-4">Carregando formulário...</div>;
  }
  if (error) {
    return <div className="text-center p-4 text-red-600">Erro: {error}</div>;
  }
  if (!currentUser || !isMasterAdmin) {
    return null; // Acesso negado já é tratado pelo useEffect
  }
  if (!estabelecimento) {
    return <div className="text-center p-4">Estabelecimento não encontrado.</div>; // Mensagem se o ID for inválido antes de erro
  }


  return (
    <div className="p-6 max-w-2xl mx-auto bg-white shadow-lg rounded-lg my-8">
      <Link to="/master/estabelecimentos" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Voltar para a Lista de Estabelecimentos
      </Link>
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Editar Estabelecimento: {estabelecimento.nome}</h1>
      
      <form onSubmit={handleUpdate} className="space-y-4">
        {/* Campo para Ativar/Desativar */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="ativo"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
          />
          <label htmlFor="ativo" className="text-lg font-medium text-gray-800">
            {ativo ? 'Estabelecimento Ativo (Pagamento em Dia)' : 'Estabelecimento INATIVO (Acesso Bloqueado)'}
          </label>
          {ativo ? (
              <span className="ml-2 text-green-600">✅</span>
          ) : (
              <span className="ml-2 text-red-600">🚫</span>
          )}
        </div>
        <hr className="my-4 border-gray-200" />

        {/* Campos de Edição - Repetição dos campos de cadastro */}
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
          {loading ? 'Atualizando...' : 'Salvar Alterações'}
        </button>
      </form>
    </div>
  );
}

export default EditarEstabelecimentoMaster;