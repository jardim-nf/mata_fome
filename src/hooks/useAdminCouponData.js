import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-toastify';

export function useAdminCouponData(estabelecimentoIdPrincipal) {
    const [cupons, setCupons] = useState([]);
    const [loading, setLoading] = useState(true);

    const [codigo, setCodigo] = useState('');
    const [tipoDesconto, setTipoDesconto] = useState('percentual');
    const [valorDesconto, setValorDesconto] = useState('');
    const [minimoPedido, setMinimoPedido] = useState('');
    const [validadeInicio, setValidadeInicio] = useState('');
    const [validadeFim, setValidadeFim] = useState('');
    const [usosMaximos, setUsosMaximos] = useState('');
    const [ativo, setAtivo] = useState(true);
    const [editingCouponId, setEditingCouponId] = useState(null);
    const [formLoading, setFormLoading] = useState(false);

    // --- FUNÇÕES AUXILIARES DE STATUS ---
    const isExpirado = useCallback((validadeFim) => {
        if (!validadeFim) return false;
        return validadeFim.toDate() < new Date(); 
    }, []);

    const isAtivo = useCallback((cupom) => {
        return cupom.ativo && !isExpirado(cupom.validadeFim);
    }, [isExpirado]);

    const formatarDesconto = useCallback((cupom) => {
        switch(cupom.tipoDesconto) {
            case 'percentual':
                return `${cupom.valorDesconto}% OFF`;
            case 'valorFixo':
                return `R$ ${cupom.valorDesconto.toFixed(2).replace('.', ',')} OFF`;
            case 'freteGratis':
                return '🛵 Frete Grátis';
            default:
                return cupom.tipoDesconto;
        }
    }, []);

    // --- ESTATÍSTICAS ---
    const estatisticas = useMemo(() => ({
        total: cupons.length,
        ativos: cupons.filter(c => isAtivo(c)).length,
        expirados: cupons.filter(c => isExpirado(c.validadeFim)).length,
        usosTotais: cupons.reduce((acc, c) => acc + (c.usosAtuais || 0), 0)
    }), [cupons, isAtivo, isExpirado]);

    // Busca os cupons em tempo real
    useEffect(() => {
        if (!estabelecimentoIdPrincipal) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const cuponsCollectionRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'cupons');
        const q = query(cuponsCollectionRef, orderBy('codigo'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const cuponsData = querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            setCupons(cuponsData);
            setLoading(false);
        }, (err) => {
            console.error("Erro ao buscar cupons:", err);
            toast.error("❌ Erro ao carregar cupons. Permissão ou conexão falhou.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [estabelecimentoIdPrincipal]);

    const resetForm = useCallback(() => {
        setCodigo('');
        setTipoDesconto('percentual');
        setValorDesconto('');
        setMinimoPedido('');
        setValidadeInicio('');
        setValidadeFim('');
        setUsosMaximos('');
        setAtivo(true);
        setEditingCouponId(null);
    }, []);

    const handleSaveCoupon = async (e) => {
        e.preventDefault();
        
        if (!estabelecimentoIdPrincipal) {
            toast.error('❌ Estabelecimento não identificado.');
            return;
        }

        if (!codigo || (tipoDesconto !== 'freteGratis' && !valorDesconto) || !validadeInicio || !validadeFim) {
            toast.warn('⚠️ Preencha os campos obrigatórios: Código, Valor (se aplicável) e Datas de Validade.');
            return;
        }

        const inicio = new Date(validadeInicio);
        const fim = new Date(validadeFim);
        if (inicio >= fim) {
            toast.warn('⚠️ A data de fim deve ser posterior à data de início.');
            return;
        }

        setFormLoading(true);
        try {
            const cuponsCollectionRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'cupons');
            
            const valorDesc = tipoDesconto === 'freteGratis' ? 0 : Number(valorDesconto);
            const minPedido = minimoPedido ? Number(minimoPedido) : null;
            const usosMax = usosMaximos ? Number(usosMaximos) : null;

            if (isNaN(valorDesc) || (minPedido !== null && isNaN(minPedido)) || (usosMax !== null && isNaN(usosMax))) {
                 toast.error('❌ Erro: Por favor, verifique se os valores numéricos estão corretos.');
                 setFormLoading(false);
                 return;
            }

            const newCouponData = {
                codigo: codigo.toUpperCase().trim(),
                tipoDesconto,
                valorDesconto: valorDesc,
                minimoPedido: minPedido,
                validadeInicio: Timestamp.fromDate(inicio),
                validadeFim: Timestamp.fromDate(fim),
                usosMaximos: usosMax,
                usosAtuais: editingCouponId ? cupons.find(c => c.id === editingCouponId)?.usosAtuais || 0 : 0,
                ativo,
                estabelecimentoId: estabelecimentoIdPrincipal,
                atualizadoEm: new Date()
            };

            if (editingCouponId) {
                const couponRef = doc(cuponsCollectionRef, editingCouponId);
                await updateDoc(couponRef, newCouponData);
                toast.success('✅ Cupom atualizado com sucesso!');
            } else {
                const q = query(cuponsCollectionRef, where('codigo', '==', newCouponData.codigo));
                const existingCoupons = await getDocs(q); 
                
                if (!existingCoupons.empty) {
                    toast.error(`❌ Já existe um cupom com o código ${newCouponData.codigo} para este estabelecimento.`);
                    setFormLoading(false);
                    return;
                }
                
                await addDoc(cuponsCollectionRef, { 
                    ...newCouponData, 
                    criadoEm: new Date() 
                });
                toast.success('✅ Cupom criado com sucesso!');
            }
            resetForm();
        } catch (err) {
            console.error("ERRO NO SALVAMENTO DO CUPOM:", err);
            if (err.code === 'permission-denied') {
                toast.error("🔒 Permissão negada! Verifique as Regras de Segurança do Firestore.");
            } else if (err.code === 'unavailable') {
                 toast.error("🌐 Erro de conexão. Tente novamente.");
            } else {
                toast.error(`❌ Erro ao salvar cupom: ${err.message}`);
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleEditClick = useCallback((coupon) => {
        setEditingCouponId(coupon.id);
        setCodigo(coupon.codigo);
        setTipoDesconto(coupon.tipoDesconto);
        setValorDesconto(coupon.valorDesconto?.toString() || '');
        setMinimoPedido(coupon.minimoPedido?.toString() || '');
        
        const toLocalDatetimeString = (timestamp) => {
            if (!timestamp) return '';
            const d = timestamp.toDate();
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        
        setValidadeInicio(toLocalDatetimeString(coupon.validadeInicio));
        setValidadeFim(toLocalDatetimeString(coupon.validadeFim));
        setUsosMaximos(coupon.usosMaximos?.toString() || '');
        setAtivo(coupon.ativo);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const performDeleteCoupon = async (id) => {
        if (!estabelecimentoIdPrincipal) return;
        try {
            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'cupons', id));
            toast.success('✅ Cupom excluído com sucesso!');
        } catch (err) {
            console.error("Erro ao excluir cupom:", err);
            toast.error("❌ Erro ao excluir cupom.");
        }
    };

    return {
        cupons, loading, formLoading,
        codigo, setCodigo,
        tipoDesconto, setTipoDesconto,
        valorDesconto, setValorDesconto,
        minimoPedido, setMinimoPedido,
        validadeInicio, setValidadeInicio,
        validadeFim, setValidadeFim,
        usosMaximos, setUsosMaximos,
        ativo, setAtivo,
        editingCouponId,
        
        isExpirado, isAtivo, formatarDesconto,
        estatisticas,
        
        handleSaveCoupon,
        handleEditClick,
        performDeleteCoupon,
        resetForm
    };
}
