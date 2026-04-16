import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore'; 
import { db } from '../firebase';
import { toast } from 'react-toastify';
import { auditLogger } from '../utils/auditLogger';
import { uploadFile } from '../utils/firebaseStorageService'; 

export function useAdminEstabelecimentoCadastroData(currentUser, isMasterAdmin, authLoading, navigate) {
    const [formData, setFormData] = useState({
        nome: '',
        slug: '',
        chavePix: '',
        imageUrl: '',
        rating: 0,
        adminUID: '',
        ativo: true,
        currentPlanId: '',
        endereco: { rua: '', numero: '', bairro: '', cidade: '' },
        informacoes_contato: { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' },
        tipoNegocio: 'restaurante'
    });

    const [logoImage, setLogoImage] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [availableAdmins, setAvailableAdmins] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [loadingForm, setLoadingForm] = useState(false);
    const [loadingAdmins, setLoadingAdmins] = useState(true);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [formError, setFormError] = useState('');
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    const slugify = useCallback((text) =>
        text.toString().toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-'),
    []);

    useEffect(() => {
        if (!authLoading && (!currentUser || !isMasterAdmin)) {
            toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
            navigate('/master-dashboard');
            return;
        }

        if (isMasterAdmin && currentUser) {
            const fetchAdmins = async () => {
                try {
                    const q = query(collection(db, 'usuarios'), where('isAdmin', '==', true), orderBy('nome', 'asc'));
                    const querySnapshot = await getDocs(q);
                    const admins = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome, email: doc.data().email }));
                    setAvailableAdmins(admins);
                } catch (err) {
                    console.error("Erro ao carregar administradores:", err);
                    setFormError("Erro ao carregar lista de administradores. Crie o índice (usuarios: isAdmin, nome).");
                } finally {
                    setLoadingAdmins(false);
                }
            };
            fetchAdmins();

            const fetchPlans = async () => {
                try {
                    const q = query(collection(db, 'plans'), where('isActive', '==', true), orderBy('price', 'asc'));
                    const querySnapshot = await getDocs(q);
                    const plans = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
                    setAvailablePlans(plans);
                } catch (err) {
                    console.error("Erro ao carregar planos:", err);
                } finally {
                    setLoadingPlans(false);
                }
            };
            fetchPlans();
        }
    }, [currentUser, isMasterAdmin, authLoading, navigate]);

    useEffect(() => {
        if (formData.nome && !slugManuallyEdited) {
            setFormData(prev => ({ ...prev, slug: slugify(prev.nome) }));
        }
    }, [formData.nome, slugManuallyEdited, slugify]);

    const handleInputChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (name === 'slug') setSlugManuallyEdited(true);

        if (type === 'file') {
            const file = files[0];
            setLogoImage(file);
            if (file) setLogoPreview(URL.createObjectURL(file));
            else setLogoPreview('');
        } else if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: { ...prev[parent], [child]: type === 'checkbox' ? checked : value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoadingForm(true);
        setFormError('');

        if (!formData.nome) {
            setFormError('O nome do estabelecimento é obrigatório.');
            setLoadingForm(false);
            return;
        }

        if (!formData.adminUID) {
            setFormError('É necessário selecionar um Administrador responsável.');
            setLoadingForm(false);
            return;
        }

        let finalLogoUrl = formData.imageUrl;

        try {
            if (logoImage) {
                const logoName = `establishment_logos/${formData.slug || Date.now()}_${logoImage.name}`;
                finalLogoUrl = await uploadFile(logoImage, logoName);
                toast.success('Logo enviado com sucesso!');
            }

            const slugQuery = query(collection(db, 'estabelecimentos'), where('slug', '==', formData.slug));
            const slugSnapshot = await getDocs(slugQuery);
            if (!slugSnapshot.empty) {
                setFormError('Este slug (URL) já está em uso. Por favor, escolha outro.');
                setLoadingForm(false);
                return;
            }

            const newEstabRef = doc(collection(db, 'estabelecimentos'));
            const newEstabId = newEstabRef.id; 

            const nextBilling = new Date();
            nextBilling.setMonth(nextBilling.getMonth() + 1);

            const planIdToSave = formData.currentPlanId === '' ? null : formData.currentPlanId;

            await setDoc(newEstabRef, {
                ...formData,
                id: newEstabId,
                imageUrl: finalLogoUrl,
                currentPlanId: planIdToSave,
                criadoEm: new Date(),
                rating: Number(formData.rating),
                nextBillingDate: nextBilling,
            });

            if (formData.adminUID) {
                const adminRef = doc(db, 'usuarios', formData.adminUID);
                const adminSnap = await getDoc(adminRef);

                if (adminSnap.exists()) {
                    const adminData = adminSnap.data();

                    let currentManagedEstabs = adminData.estabelecimentosGerenciados;
                    if (!Array.isArray(currentManagedEstabs)) {
                        currentManagedEstabs = [];
                    }

                    if (!currentManagedEstabs.includes(newEstabId)) {
                        await updateDoc(adminRef, {
                            estabelecimentosGerenciados: [...currentManagedEstabs, newEstabId]
                        });
                        toast.info('Vínculo de estabelecimento com admin atualizado.');
                    }
                }
            }

            auditLogger(
                'ESTABELECIMENTO_CRIADO', 
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, 
                { type: 'estabelecimento', id: newEstabId, name: formData.nome }, 
                { ...formData, rating: Number(formData.rating), imageUrl: finalLogoUrl }
            );

            toast.success('Estabelecimento cadastrado com sucesso!');

            setFormData({ 
                nome: '', slug: '', chavePix: '', imageUrl: '', rating: 0, 
                adminUID: '', ativo: true, currentPlanId: '', nextBillingDate: null, 
                endereco: { rua: '', numero: '', bairro: '', cidade: '' }, 
                informacoes_contato: { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' },
                tipoNegocio: 'restaurante'
            });
            setLogoImage(null);
            setLogoPreview('');

            navigate('/master/estabelecimentos');

        } catch (err) {
            console.error("Erro ao cadastrar estabelecimento:", err);
            setFormError(`Erro ao cadastrar: ${err.message}`);
            toast.error(`Erro ao cadastrar: ${err.message}`);
        } finally {
            setLoadingForm(false);
        }
    };

    return {
        formData, handleInputChange, logoPreview,
        availableAdmins, availablePlans,
        loadingForm, loadingAdmins, loadingPlans, formError,
        handleSubmit
    };
}
