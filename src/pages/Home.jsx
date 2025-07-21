// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import logo from '../assets/logo-deufome.png';
import { toast } from 'react-toastify';

// Componente para o Modal de Autenticação, para manter o código limpo
function AuthModal({ onClose, onSwitchToRegister, onSwitchToLogin, isRegistering, handleLogin, handleRegister }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isRegistering) {
            handleRegister({ email, password, nome, telefone });
        } else {
            handleLogin({ email, password });
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[1000]">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full relative text-center">
                <button onClick={onClose} className="absolute top-3 right-4 text-gray-400 hover:text-red-600 text-2xl">&times;</button>
                <img src={logo} alt="Logo DeuFome" className="w-24 mx-auto mb-4"/>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">{isRegistering ? 'Crie sua Conta' : 'Acesse sua Conta'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegistering && (
                        <>
                            <input type="text" placeholder="Seu Nome Completo *" className="w-full border-slate-300 rounded-lg p-3" value={nome} onChange={(e) => setNome(e.target.value)} required />
                            <input type="tel" placeholder="Seu Telefone (com DDD) *" className="w-full border-slate-300 rounded-lg p-3" value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
                        </>
                    )}
                    <input type="email" placeholder="Email *" className="w-full border-slate-300 rounded-lg p-3" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <input type="password" placeholder="Senha *" className="w-full border-slate-300 rounded-lg p-3" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors">
                        {isRegistering ? 'Cadastrar e Entrar' : 'Entrar'}
                    </button>
                    <p className="text-sm text-slate-600">
                        {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
                        <button type="button" onClick={isRegistering ? onSwitchToLogin : onSwitchToRegister} className="text-red-600 font-semibold underline ml-1">
                            {isRegistering ? 'Faça Login' : 'Cadastre-se'}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
}


function Home() {
    const { currentUser, authLoading } = useAuth();
    const navigate = useNavigate();

    const [estabelecimentos, setEstabelecimentos] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => {
        const fetchEstabelecimentos = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'estabelecimentos'));
                setEstabelecimentos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (err) {
                toast.error("Erro ao carregar estabelecimentos.");
            } finally {
                setLoading(false);
            }
        };
        fetchEstabelecimentos();
    }, []);

    const openModal = (register = false) => {
        setIsRegistering(register);
        setShowAuthModal(true);
    };

    const handleLogin = async ({ email, password }) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            toast.success('Login realizado com sucesso!');
            setShowAuthModal(false);
        } catch (error) {
            toast.error('Erro ao fazer login. Verifique suas credenciais.');
        }
    };

    const handleRegister = async ({ email, password, nome, telefone }) => {
        if (!nome.trim() || !telefone.trim()) {
            toast.warn('Por favor, preencha todos os campos.');
            return;
        }
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'usuarios', cred.user.uid), {
                nome, telefone, email, isAdmin: false, isMasterAdmin: false, criadoEm: Timestamp.now()
            });
            await setDoc(doc(db, 'clientes', cred.user.uid), {
                nome, telefone, email, criadoEm: Timestamp.now()
            });
            toast.success('Cadastro realizado com sucesso!');
            setShowAuthModal(false);
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                toast.error('Este email já está cadastrado.');
            } else {
                toast.error('Erro ao cadastrar.');
            }
        }
    };

    const scrollTo = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    if (authLoading) return <div className="flex justify-center items-center h-screen"><p>Carregando...</p></div>;

    return (
        <div className="bg-white min-h-screen font-sans">
            {showAuthModal && (
                <AuthModal
                    onClose={() => setShowAuthModal(false)}
                    isRegistering={isRegistering}
                    onSwitchToRegister={() => setIsRegistering(true)}
                    onSwitchToLogin={() => setIsRegistering(false)}
                    handleLogin={handleLogin}
                    handleRegister={handleRegister}
                />
            )}

            {/* Cabeçalho Fixo */}
            <header className="bg-white/80 backdrop-blur-lg fixed top-0 left-0 right-0 z-50 shadow-sm">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <img src={logo} alt="Logo DeuFome" className="w-28"/>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
                        <button onClick={() => scrollTo('restaurantes')} className="hover:text-red-600 transition-colors">Restaurantes</button>
                        <button onClick={() => scrollTo('como-funciona')} className="hover:text-red-600 transition-colors">Como Funciona</button>
                        <button onClick={() => scrollTo('seja-parceiro')} className="hover:text-red-600 transition-colors">Seja um Parceiro</button>
                    </nav>
                    <div className="flex items-center gap-2">
                        <button onClick={() => openModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-red-600">Entrar</button>
                        <button onClick={() => openModal(true)} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-full hover:bg-red-700 transition-colors">Cadastre-se</button>
                    </div>
                </div>
            </header>

            <main>
                {/* Seção Hero */}
                <section className="h-screen bg-cover bg-center flex items-center justify-center text-white" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=2000')" }}>
                    <div className="absolute inset-0 bg-black/60"></div>
                    <div className="relative text-center p-4">
                        <h1 className="text-4xl md:text-6xl font-extrabold drop-shadow-lg">A sua fome pede, a gente entrega.</h1>
                        <p className="mt-4 text-lg md:text-xl max-w-2xl mx-auto drop-shadow-md">Encontre os melhores restaurantes, lanchonetes e açaís da sua região em um só lugar.</p>
                        <button onClick={() => scrollTo('restaurantes')} className="mt-8 px-8 py-3 bg-red-600 font-bold rounded-full hover:bg-red-700 transition-transform hover:scale-105 shadow-lg">Ver Restaurantes</button>
                    </div>
                </section>

                {/* Seção Restaurantes em Destaque */}
                <section id="restaurantes" className="container mx-auto my-16 px-6">
                    <h2 className="text-3xl font-bold text-slate-800 mb-8 text-center">Nossos Restaurantes</h2>
                    {loading ? <p>Carregando...</p> : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                            {estabelecimentos.map((est) => (
                                <Link to={`/cardapios/${est.slug}`} key={est.id} className="block bg-white rounded-xl shadow-md overflow-hidden hover:shadow-2xl transition-shadow duration-300 transform hover:-translate-y-1">
                                    <img src={est.imageUrl || '/default-img.jpg'} alt={est.nome} className="w-full h-40 object-cover" />
                                    <div className="p-4">
                                        <h3 className="text-lg font-bold text-slate-800 truncate">{est.nome}</h3>
                                        <div className="flex items-center gap-1 text-amber-500 text-sm mt-1">
                                            <span>⭐</span>
                                            <span className="text-slate-600 font-semibold">{est.rating?.toFixed(1) || 'Novo'}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
                
                {/* Seção Como Funciona */}
                <section id="como-funciona" className="bg-slate-50 py-16">
                    <div className="container mx-auto px-6 text-center">
                        <h2 className="text-3xl font-bold text-slate-800 mb-12">Pedir nunca foi tão fácil</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                            <div className="flex flex-col items-center"><div className="bg-red-100 text-red-600 text-3xl p-5 rounded-full mb-4">📍</div><h3 className="text-xl font-bold text-slate-800">1. Encontre</h3><p className="text-slate-600 mt-2">Escolha seu restaurante favorito na nossa lista.</p></div>
                            <div className="flex flex-col items-center"><div className="bg-red-100 text-red-600 text-3xl p-5 rounded-full mb-4">🍔</div><h3 className="text-xl font-bold text-slate-800">2. Peça</h3><p className="text-slate-600 mt-2">Navegue pelo cardápio e adicione seus itens ao carrinho.</p></div>
                            <div className="flex flex-col items-center"><div className="bg-red-100 text-red-600 text-3xl p-5 rounded-full mb-4">🛵</div><h3 className="text-xl font-bold text-slate-800">3. Receba</h3><p className="text-slate-600 mt-2">Finalize o pedido e aguarde sua comida chegar quentinha.</p></div>
                        </div>
                    </div>
                </section>

                {/* Seção Seja um Parceiro */}
                <section id="seja-parceiro" className="container mx-auto my-16 px-6">
                    <div className="bg-slate-800 text-white rounded-2xl p-12 text-center flex flex-col items-center">
                        <h2 className="text-3xl font-bold">Quer aumentar suas vendas?</h2>
                        <p className="mt-4 max-w-2xl">Junte-se à nossa plataforma e alcance milhares de novos clientes na sua região. O cadastro é rápido e fácil.</p>
                        <button onClick={() => navigate('/login-admin')} className="mt-8 px-8 py-3 bg-white text-slate-800 font-bold rounded-full hover:bg-slate-200 transition-colors">Cadastre seu Restaurante</button>
                    </div>
                </section>
            </main>

        </div>
    );
}

export default Home;