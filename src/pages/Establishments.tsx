import React, { useState, useEffect } from 'react';
import { useEstablishment, Establishment } from '../contexts/EstablishmentContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building2, Plus, Edit2, ShieldAlert, CheckCircle, RefreshCw, 
  MapPin, Phone, Mail, Globe, Calendar, Key, Award, 
  Sliders, Search, Layout, Check, Palette, CreditCard, Ban,
  Users, UserPlus, Shield, Clipboard, Eye, EyeOff, Lock, Trash2, CheckCircle2,
  Upload, Image
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, firebaseConfig, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { resizeImage } from '../lib/imageUtils';

export default function Establishments() {
  const { currentUser } = useAuth();
  const { 
    establishments, 
    createEstablishment, 
    updateEstablishment, 
    toggleEstablishmentStatus,
    activeEstablishmentId,
    changeActiveEstablishment,
    isSuperAdmin
  } = useEstablishment();

  // Selected Section: 'establishments' | 'admins'
  const [activeSection, setActiveSection] = useState<'establishments' | 'admins'>('establishments');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEst, setEditingEst] = useState<Establishment | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formId, setFormId] = useState('');
  const [formNom, setFormNom] = useState('');
  const [formLogo, setFormLogo] = useState('');
  const [formBanner, setFormBanner] = useState('');
  const [formDevise, setFormDevise] = useState('');
  const [formAdresse, setFormAdresse] = useState('');
  const [formTelephone, setFormTelephone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSiteWeb, setFormSiteWeb] = useState('');
  const [formLicence, setFormLicence] = useState('');
  const [formPlan, setFormPlan] = useState<'Basic' | 'Standard' | 'Premium' | 'Enterprise'>('Standard');
  const [formPrimaryColor, setFormPrimaryColor] = useState('#4f46e5');
  const [formSecondaryColor, setFormSecondaryColor] = useState('#ea580c');
  const [formActiveSchoolYear, setFormActiveSchoolYear] = useState('2025-2026');

  // Representative (Proviseur/Principal) state fields
  const [formResponsableCivility, setFormResponsableCivility] = useState<'M.' | 'Mme' | 'Dr' | 'Pr'>('M.');
  const [formResponsableNom, setFormResponsableNom] = useState('');
  const [formResponsablePrenom, setFormResponsablePrenom] = useState('');
  const [formResponsableEmail, setFormResponsableEmail] = useState('');
  const [formResponsableTelephone, setFormResponsableTelephone] = useState('');

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingLogo(true);
      try {
        // Step 1: Resize the image to keep size minuscule (300x300 is perfect for a logo)
        const resizedBlob = await resizeImage(file, 300, 300);
        
        // Step 2: Try to upload to Firebase Storage
        try {
          const estId = formId.trim() || 'temp';
          const storageRef = ref(storage, `etablissements/${estId}_logo_${Date.now()}.jpg`);
          await uploadBytes(storageRef, resizedBlob);
          const downloadURL = await getDownloadURL(storageRef);
          setFormLogo(downloadURL);
          console.log("Logo successfully uploaded to Firebase Storage:", downloadURL);
        } catch (uploadErr) {
          console.warn("Storage upload failed or disabled, falling back to lightweight resized base64:", uploadErr);
          // Fallback to small base64
          const reader = new FileReader();
          reader.readAsDataURL(resizedBlob);
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              setFormLogo(reader.result);
            }
          };
        }
      } catch (err) {
        console.error("Error processing logo:", err);
        alert("Une erreur s'est produite lors du traitement du logo.");
      } finally {
        setIsUploadingLogo(false);
      }
    }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingBanner(true);
      try {
        // Step 1: Resize the banner (1200x400 max)
        const resizedBlob = await resizeImage(file, 1200, 400);
        
        // Step 2: Try to upload to Firebase Storage
        try {
          const estId = formId.trim() || 'temp';
          const storageRef = ref(storage, `etablissements/${estId}_banner_${Date.now()}.jpg`);
          await uploadBytes(storageRef, resizedBlob);
          const downloadURL = await getDownloadURL(storageRef);
          setFormBanner(downloadURL);
          console.log("Banner successfully uploaded to Firebase Storage:", downloadURL);
        } catch (uploadErr) {
          console.warn("Storage upload failed or disabled, falling back to lightweight resized base64:", uploadErr);
          // Fallback to small base64
          const reader = new FileReader();
          reader.readAsDataURL(resizedBlob);
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              setFormBanner(reader.result);
            }
          };
        }
      } catch (err) {
        console.error("Error processing banner:", err);
        alert("Une erreur s'est produite lors du traitement de la bannière.");
      } finally {
        setIsUploadingBanner(false);
      }
    }
  };

  // Administrator state fields (role === 'admin')
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Admin creator form fields
  const [adminNom, setAdminNom] = useState('');
  const [adminPrenom, setAdminPrenom] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEtablissement, setAdminEtablissement] = useState('');
  const [adminContact, setAdminContact] = useState('');
  const [showPasswordRaw, setShowPasswordRaw] = useState(false);

  // Generated credentials block to display in a modal after successful creation
  const [generatedCreds, setGeneratedCreds] = useState<{
    email: string;
    password: string;
    establishmentId: string;
    establishmentName: string;
    fullName: string;
  } | null>(null);

  // Load Administrator profiles in real-time
  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'admin'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAdminsList(list);
    }, (err) => {
      console.error("Error listening to administrator accounts:", err);
    });
    return () => unsub();
  }, []);

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    let length = 12;
    let pwd = '';
    for (let i = 0; i < length; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAdminPassword(pwd);
  };

  const handleOpenCreateAdminModal = () => {
    setAdminNom('');
    setAdminPrenom('');
    setAdminEmail('');
    setAdminPassword('');
    setAdminEtablissement(establishments[0]?.id || '');
    setAdminContact('');
    setAdminError('');
    setGeneratedCreds(null);
    setIsAdminModalOpen(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim() || !adminNom.trim() || !adminPrenom.trim()) {
      setAdminError('Tous les champs obligatoires doivent être renseignés.');
      return;
    }
    if (adminPassword.length < 6) {
      setAdminError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (!adminEtablissement) {
      setAdminError('Veuillez sélectionner ou créer un établissement d\'abord.');
      return;
    }

    setIsAdminSubmitting(true);
    setAdminError('');

    try {
      // Prevent conflicts by initializing a separate app instance
      const secondaryApp = getApps().find(app => app.name === 'SecondaryAdminApp') || initializeApp(firebaseConfig, 'SecondaryAdminApp');
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, adminEmail, adminPassword);
      
      const selectedEst = establishments.find(e => e.id === adminEtablissement);
      const estName = selectedEst ? selectedEst.nom : 'Etablissement non référencé';

      // Record profile back in 'users' collection with precise tenant link
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        nom: adminNom,
        prenom: adminPrenom,
        email: adminEmail,
        role: 'admin',
        etablissement: adminEtablissement,
        contact: adminContact || null,
        photo: '',
        cover: '',
        gender: 'not_specified',
        date_creation: new Date().toISOString()
      }, { merge: true });

      await signOut(secondaryAuth);

      setGeneratedCreds({
        email: adminEmail,
        password: adminPassword,
        establishmentId: adminEtablissement,
        establishmentName: estName,
        fullName: `${adminPrenom} ${adminNom}`
      });

    } catch (err: any) {
      console.error("Error creating establishment admin:", err);
      setAdminError(err.message || 'Une erreur est survenue lors de la création de l\'administrateur.');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir révoquer les accès de cet administrateur ? Il perdra immédiatement l'accès à son interface d'établissement.")) {
      try {
        await deleteDoc(doc(db, 'users', adminId));
      } catch (err) {
        console.error("Failed to delete admin document:", err);
      }
    }
  };

  const copyCredsToClipboard = () => {
    if (!generatedCreds) return;
    const textToCopy = `💻 IDENTIFIANTS DE CONNEXION RESPONSABLE :
👤 Responsable : ${generatedCreds.fullName}
🏫 Établissement : ${generatedCreds.establishmentName} (${generatedCreds.establishmentId})
🔗 Plateforme URL : ${window.location.origin}
📧 Adresse Email : ${generatedCreds.email}
🔑 Mot de Passe : ${generatedCreds.password}

Veuillez conserver et remettre ces données de manière sécurisée uniquement au responsable concerné.`;
    
    navigator.clipboard.writeText(textToCopy);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  const plansList = ['Basic', 'Standard', 'Premium', 'Enterprise'];
  const planPrices = {
    Basic: 99,
    Standard: 249,
    Premium: 499,
    Enterprise: 999
  };

  const handleOpenCreate = () => {
    setEditingEst(null);
    setFormId(`EDU-00${establishments.length + 1}`);
    setFormNom('');
    setFormLogo('https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=120&auto=format&fit=crop&q=60');
    setFormBanner('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=60');
    setFormDevise('Discipline, Excellence, Avenir');
    setFormAdresse('');
    setFormTelephone('');
    setFormEmail('');
    setFormSiteWeb('');
    setFormLicence(`EDUNIFY-LUDO-NEW-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormPlan('Standard');
    setFormPrimaryColor('#4f46e5');
    setFormSecondaryColor('#ea580c');
    setFormActiveSchoolYear('2025-2026');
    setFormResponsableCivility('M.');
    setFormResponsableNom('');
    setFormResponsablePrenom('');
    setFormResponsableEmail('');
    setFormResponsableTelephone('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (est: Establishment) => {
    setEditingEst(est);
    setFormId(est.id);
    setFormNom(est.nom);
    setFormLogo(est.logo || '');
    setFormBanner(est.banner || '');
    setFormDevise(est.devise || '');
    setFormAdresse(est.adresse || '');
    setFormTelephone(est.telephone || '');
    setFormEmail(est.email || '');
    setFormSiteWeb(est.siteWeb || '');
    setFormLicence(est.licence || '');
    setFormPlan(est.plan || 'Standard');
    setFormPrimaryColor(est.primaryColor || '#4f46e5');
    setFormSecondaryColor(est.secondaryColor || '#ea580c');
    setFormActiveSchoolYear(est.activeSchoolYear || '2025-2026');
    setFormResponsableCivility(est.responsableCivility || 'M.');
    setFormResponsableNom(est.responsableNom || '');
    setFormResponsablePrenom(est.responsablePrenom || '');
    setFormResponsableEmail(est.responsableEmail || '');
    setFormResponsableTelephone(est.responsableTelephone || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formNom.trim()) {
      setFormError('L\'identifiant unique et le nom de l\'établissement sont requis.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingEst) {
        await updateEstablishment(editingEst.id, {
          nom: formNom,
          logo: formLogo,
          banner: formBanner,
          devise: formDevise,
          adresse: formAdresse,
          telephone: formTelephone,
          email: formEmail,
          siteWeb: formSiteWeb,
          licence: formLicence,
          plan: formPlan,
          primaryColor: formPrimaryColor,
          secondaryColor: formSecondaryColor,
          activeSchoolYear: formActiveSchoolYear,
          responsableCivility: formResponsableCivility,
          responsableNom: formResponsableNom.trim(),
          responsablePrenom: formResponsablePrenom.trim(),
          responsableEmail: formResponsableEmail.trim(),
          responsableTelephone: formResponsableTelephone.trim()
        });
      } else {
        // Enforce uniqueness of ID for creation
        if (establishments.some(e => e.id.toLowerCase() === formId.toLowerCase())) {
          throw new Error('Cet Identifiant unique d\'établissement est déjà utilisé.');
        }
        await createEstablishment({
          id: formId.toUpperCase().trim(),
          code: formId.toUpperCase().trim(),
          nom: formNom,
          logo: formLogo,
          banner: formBanner,
          devise: formDevise,
          adresse: formAdresse,
          telephone: formTelephone,
          email: formEmail,
          siteWeb: formSiteWeb,
          active: true,
          licence: formLicence,
          plan: formPlan,
          primaryColor: formPrimaryColor,
          secondaryColor: formSecondaryColor,
          activeSchoolYear: formActiveSchoolYear,
          responsableCivility: formResponsableCivility,
          responsableNom: formResponsableNom.trim(),
          responsablePrenom: formResponsablePrenom.trim(),
          responsableEmail: formResponsableEmail.trim(),
          responsableTelephone: formResponsableTelephone.trim()
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SaaS Statistics aggregations
  const totalCampuses = establishments.length;
  const activeCampuses = establishments.filter(e => e.active).length;
  const suspendedCampuses = totalCampuses - activeCampuses;
  
  // Calculate dynamic SaaS monthly recurring revenue (MRR)
  const estimatedMRR = establishments
    .filter(e => e.active)
    .reduce((sum, e) => sum + (planPrices[e.plan] || 0), 0);

  // Filters
  const filteredList = establishments.filter(est => {
    if (!isSuperAdmin) {
      return est.id === currentUser?.etablissement;
    }
    const matchesSearch = est.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          est.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          est.devise.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'all' || est.plan === filterPlan;
    const matchesStatus = filterStatus === 'all' || 
                          (filterStatus === 'active' && est.active) || 
                          (filterStatus === 'inactive' && !est.active);
    return matchesSearch && matchesPlan && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Banner Title */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl font-sans">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center justify-center pointer-events-none p-5">
          <Building2 size={180} />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] bg-indigo-500/30 text-indigo-300 font-extrabold uppercase px-2.5 py-1 rounded-full border border-indigo-400/25 tracking-wider">
            {isSuperAdmin ? "SaaS Platform - Centre de Contrôle Général" : "Configuration de l'Établissement - Portail SaaS"}
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight" id="main-saas-title">
            {isSuperAdmin ? "Edu-Nify Multi-Tenancy Core" : "Identité & Configuration du Campus"}
          </h1>
          <p className="text-gray-300 text-xs md:text-sm font-medium max-w-2xl">
            {isSuperAdmin 
              ? "Supervisez tous les campus rattachés en temps réel. Créez des instances isolées, configurez leur charte graphique unique et générez des accès sécurisés pour les responsables administratifs de chaque établissement."
              : "Consultez et ajustez la charte graphique, les coordonnées de contact, le logo et la bannière de votre établissement scolaire en temps réel pour configurer instantanément votre portail personnalisé."}
          </p>
        </div>
      </div>

      {/* Modern Tab Selector */}
      {isSuperAdmin && (
        <div className="flex border-b border-gray-200 dark:border-gray-800 pb-px" id="saas-tab-navigation">
          <button
            id="tab-btn-establishments"
            onClick={() => setActiveSection('establishments')}
            className={`px-6 py-3.5 border-b-2 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2.5 cursor-pointer ${
              activeSection === 'establishments'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold'
                : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Building2 size={16} />
            Gérer les Établissements ({totalCampuses})
          </button>
          <button
            id="tab-btn-admins"
            onClick={() => setActiveSection('admins')}
            className={`px-6 py-3.5 border-b-2 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2.5 cursor-pointer ${
              activeSection === 'admins'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold'
                : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Users size={16} />
            Comptes des Responsables ({adminsList.length})
          </button>
        </div>
      )}

      {activeSection === 'admins' && isSuperAdmin ? (
        <div className="space-y-6" id="admins-manager-section">
          {/* Admin Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="admins-stats-grid">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 flex items-center gap-4 shadow-sm" id="stat-admins-total">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Shield size={24} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">Total Responsables</span>
                <span className="text-xl font-black text-gray-800 dark:text-white">{adminsList.length} administrateurs</span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 flex items-center gap-4 shadow-sm" id="stat-campus-connected">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CheckCircle size={24} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">Campus Reliés</span>
                <span className="text-xl font-black text-emerald-600">
                  {Array.from(new Set(adminsList.map(a => a.etablissement))).length} établissements couverts
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 shadow-sm flex items-center gap-4" id="stat-tenant-isolation">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                <Lock size={24} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">Isolation SaaS</span>
                <span className="text-xl font-black text-gray-800 dark:text-gray-150">Multi-tenant Sécurisé</span>
              </div>
            </div>
          </div>

          {/* Search bar and create triggers */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-850 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm" id="admins-action-panel">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="search-admins-input"
                type="text"
                placeholder="Rechercher par nom, email ou code campus..."
                value={adminSearchTerm}
                onChange={(e) => setAdminSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-55 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold outline-none text-gray-855 dark:text-white"
              />
            </div>

            {isSuperAdmin && (
              <button
                id="btn-create-admin-trigger"
                onClick={handleOpenCreateAdminModal}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-100 dark:shadow-none"
              >
                <UserPlus size={15} />
                Nouveau Compte Responsable
              </button>
            )}
          </div>

          {/* Admins Data Table */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-150 dark:border-gray-855 overflow-hidden shadow-sm" id="admins-list-container">
            <div className="overflow-x-auto font-sans">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-150 dark:border-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <th className="p-4 pl-6">Responsable d'Établissement</th>
                    <th className="p-4">Identifiants</th>
                    <th className="p-4">Campus Rattachement</th>
                    <th className="p-4">Date de Création</th>
                    <th className="p-4 text-right pr-6">Révocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-850 text-xs font-bold text-gray-750 dark:text-gray-300">
                  {adminsList
                    .filter(adm => {
                      const searchStr = `${adm.nom} ${adm.prenom} ${adm.email} ${adm.etablissement}`.toLowerCase();
                      return searchStr.includes(adminSearchTerm.toLowerCase());
                    })
                    .map((adm) => {
                      const attachedEst = establishments.find(e => e.id === adm.etablissement);
                      return (
                        <tr key={adm.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/10 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black border border-indigo-100/50 dark:border-indigo-900/30 font-mono">
                                {adm.nom ? adm.nom.slice(0, 2).toUpperCase() : 'AD'}
                              </div>
                              <div>
                                <span className="font-extrabold text-sm text-gray-900 dark:text-white block">
                                  {adm.prenom} {adm.nom}
                                </span>
                                <span className="text-[9px] text-gray-400 font-extrabold uppercase bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded tracking-wide">
                                  Administrateur Client
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="space-y-0.5 font-semibold">
                              <span className="block text-gray-850 dark:text-gray-100 font-black font-mono">{adm.email}</span>
                              <span className="block text-gray-400 text-[10px]/normal font-mono">{adm.contact || 'Aucun numéro inscrit'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            {attachedEst ? (
                              <div className="inline-flex flex-col">
                                <span className="font-extrabold text-gray-900 dark:text-white">{attachedEst.nom}</span>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[9px] rounded font-mono font-black text-gray-550">
                                    {attachedEst.id}
                                  </span>
                                  <span className={`w-1.5 h-1.5 rounded-full ${attachedEst.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  <span className="text-[9px] text-gray-400 uppercase font-black">{attachedEst.active ? 'Actif' : 'Suspendu'}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[9px] px-2.5 py-1 bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400 rounded-lg uppercase tracking-wide">
                                Campus non trouvé ({adm.etablissement})
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-gray-450 font-bold">
                            {adm.date_creation ? new Date(adm.date_creation).toLocaleDateString('fr-FR', {
                              day: 'numeric', month: 'long', year: 'numeric'
                            }) : 'Origine'}
                          </td>
                          <td className="p-4 text-right pr-6">
                            {isSuperAdmin && (
                              <button
                                onClick={() => handleDeleteAdmin(adm.id)}
                                className="p-2 aspect-square rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 dark:text-rose-400 transition-all cursor-pointer inline-flex items-center justify-center border border-transparent hover:border-rose-150"
                                title="Révoquer le responsable et couper les accès"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                  {adminsList.filter(adm => {
                    const searchStr = `${adm.nom} ${adm.prenom} ${adm.email} ${adm.etablissement}`.toLowerCase();
                    return searchStr.includes(adminSearchTerm.toLowerCase());
                  }).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-gray-400 font-bold">
                        <Users size={36} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-xs uppercase tracking-wider font-extrabold text-gray-450">Aucun gestionnaire d'établissement répertorié</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* SaaS Statistics Metrics Panel */}
          {isSuperAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="saas-statistics-metrics">
              {/* Total subscription campus count */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 shadow-sm flex items-center gap-4" id="met-total-campuses">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Building2 size={24} />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">Total Campus</span>
                  <span className="text-xl font-black text-gray-800 dark:text-gray-100">{totalCampuses} Établissements</span>
                </div>
              </div>

              {/* Active systems count */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 shadow-sm flex items-center gap-4" id="met-active-campuses">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">SaaS Académiques Actifs</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-450">{activeCampuses} opérationnels</span>
                </div>
              </div>

              {/* Suspended systems count */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 shadow-sm flex items-center gap-4" id="met-suspended-campuses">
                <div className="p-3 bg-red-50 dark:bg-red-950/45 text-red-650 dark:text-red-400 rounded-xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">Campus Suspendus</span>
                  <span className="text-xl font-black text-red-600 dark:text-red-400">{suspendedCampuses} hors-ligne</span>
                </div>
              </div>

              {/* Financial MRR from subscription plans */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/60 shadow-sm flex items-center gap-4" id="met-financial-mrr font-sans">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                  <CreditCard size={24} />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">SaaS MRR récurrent</span>
                  <span className="text-xl font-black text-gray-850 dark:text-white font-mono">{estimatedMRR.toLocaleString("fr-FR")} € / mois</span>
                </div>
              </div>
            </div>
          )}

          {/* Control Actions & Searching */}
          {isSuperAdmin && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-850 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm font-sans" id="campus-filtering-container">
              {/* Search Input bar */}
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="search-campus-input"
                  type="text"
                  placeholder="Rechercher par nom d'établissement, code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-55 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold outline-none text-gray-855 dark:text-white"
                />
              </div>

              {/* Selection Dropdowns for filtering */}
              <div className="flex flex-wrap items-center gap-2.5 font-sans">
                {/* Plan Filter */}
                <select
                  id="select-filter-plan"
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-905 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-black text-gray-800 dark:text-gray-300"
                >
                  <option value="all">Tous les abonnements</option>
                  {plansList.map(plan => (
                    <option key={plan} value={plan}>{plan}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  id="select-filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-905 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-black text-gray-800 dark:text-gray-300"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="active">Actif</option>
                  <option value="inactive">Suspendu</option>
                </select>

                {/* Create action button */}
                <button
                  id="btn-create-campus-trigger"
                  onClick={handleOpenCreate}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-100 dark:shadow-none font-sans"
                >
                  <Plus size={15} />
                  Nouveau Campus
                </button>
              </div>
            </div>
          )}

          {/* Grid of establishments cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="campus-cards-grid">
            {filteredList.map((est) => {
              const isCurrentActive = activeEstablishmentId === est.id;

              return (
                <div 
                  id={`campus-card-${est.id}`}
                  key={est.id} 
                  className={`bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border transition-all duration-300 relative shadow-sm hover:shadow-md ${
                    isCurrentActive 
                      ? 'border-indigo-600 dark:border-indigo-500 shadow-indigo-200/50 dark:shadow-none' 
                      : 'border-gray-150 dark:border-gray-850'
                  }`}
                >
                  {/* Banner Cover picture */}
                  <div className="h-28 relative overflow-hidden bg-slate-900">
                    {est.banner ? (
                      <img src={est.banner} alt={est.nom} className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-slate-950" />
                    )}
                    
                    {/* ID and Status badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-md text-[10px] font-black text-white uppercase tracking-wider font-mono">
                        {est.id}
                      </span>
                      
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider uppercase flex items-center gap-1 ${
                        est.active 
                          ? 'bg-emerald-500 text-white shadow-md' 
                          : 'bg-rose-600 text-white shadow-md'
                      }`}>
                        {est.active ? 'Actif' : 'Suspendu'}
                      </span>
                    </div>

                    {/* Sub Plan badge */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide flex items-center gap-1 ${
                        est.plan === 'Enterprise' ? 'bg-indigo-605 text-white' :
                        est.plan === 'Premium' ? 'bg-cyan-600 text-white' :
                        est.plan === 'Standard' ? 'bg-amber-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        <Award size={10} />
                        {est.plan} ({planPrices[est.plan]}€/m)
                      </span>
                    </div>
                  </div>

                  {/* Logo icon & Title */}
                  <div className="p-6 pt-0 relative flex flex-col font-sans">
                    {/* Floating Logo sphere */}
                    <div className="-mt-9 mb-3 ml-2 flex items-end justify-between">
                      {est.logo ? (
                        <img 
                          src={est.logo} 
                          alt="Logo" 
                          className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-900 border-2 border-white dark:border-gray-800 shadow-md object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900 border-2 border-white dark:border-gray-800 shadow-md flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-lg">
                          {est.id.slice(0, 3)}
                        </div>
                      )}

                      {/* Switch Active simulation context */}
                      {isSuperAdmin && est.active && (
                        <button
                          onClick={() => changeActiveEstablishment(est.id)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                            isCurrentActive 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900 dark:text-indigo-400' 
                              : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-900 dark:hover:bg-gray-850 dark:border-gray-800 dark:text-gray-450'
                          }`}
                        >
                          {isCurrentActive ? '● Charte active' : 'Visualiser le campus'}
                        </button>
                      )}
                    </div>

                    {/* College Information text */}
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">
                        {est.nom}
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold italic line-clamp-1">
                        « {est.devise || 'Pas de devise configurée'} »
                      </p>
                    </div>

                    {/* Institutional Colors Scheme Preview */}
                    <div className="mt-4 flex items-center gap-3 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-100 dark:border-gray-850/80">
                      <Palette size={14} className="text-gray-400" />
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-0">Charte graphique :</span>
                      <div className="flex gap-1.5 items-center">
                        <span 
                          className="w-4 h-4 rounded-full border border-white dark:border-gray-900" 
                          style={{ backgroundColor: est.primaryColor }}
                          title="Couleur Principale"
                        />
                        <span 
                          className="w-4 h-4 rounded-full border border-white dark:border-gray-900" 
                          style={{ backgroundColor: est.secondaryColor }}
                          title="Couleur Secondaire"
                        />
                      </div>
                    </div>

                    {/* Meta list of details */}
                    <div className="mt-4 border-t border-gray-150 dark:border-gray-850 pt-4 space-y-2 text-[11px] text-gray-650 dark:text-gray-300 font-bold">
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-gray-400 shrink-0" />
                        <span className="line-clamp-1">{est.adresse || 'Adresse non spécifiée'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-gray-400" />
                        <span className="font-mono">{est.telephone || 'Téléphone non spécifié'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="text-gray-400 font-mono" />
                        <span className="line-clamp-1 font-mono">{est.email || 'Email non spécifié'}</span>
                      </div>

                      {/* Proviseur / Principal profile display */}
                      <div className="mt-3.5 pt-3.5 border-t border-dashed border-gray-150 dark:border-gray-800 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-sans">
                          <Shield size={12} />
                          <span>Direction / Responsable</span>
                        </div>
                        {est.responsableNom ? (
                          <div className="space-y-1.5 bg-gray-50/70 dark:bg-gray-900/45 p-2.5 rounded-xl border border-gray-100 dark:border-gray-850 animate-fade-in">
                            <span className="text-[11px] font-black text-gray-800 dark:text-gray-200 block">
                              {est.responsableCivility || 'M.'} {est.responsablePrenom} {est.responsableNom}
                            </span>
                            {(est.responsableEmail || est.responsableTelephone) && (
                              <div className="flex flex-col gap-1 text-[10px] text-gray-400 font-bold font-mono">
                                {est.responsableEmail && (
                                  <span className="flex items-center gap-1">
                                    <Mail size={10} className="shrink-0 text-gray-400" />
                                    <span className="truncate">{est.responsableEmail}</span>
                                  </span>
                                )}
                                {est.responsableTelephone && (
                                  <span className="flex items-center gap-1">
                                    <Phone size={10} className="shrink-0 text-gray-400" />
                                    <span>{est.responsableTelephone}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] italic text-gray-400 dark:text-gray-500 font-medium">
                            Aucun proviseur ou principal configuré.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 bg-indigo-50/20 dark:bg-indigo-950/10 p-2 rounded-xl mt-3 text-xs border border-dashed border-indigo-150/40 dark:border-indigo-900/30">
                        <div className="flex items-center gap-1.5 font-bold text-gray-500 dark:text-gray-400 text-[10px] font-mono">
                          <Key size={12} />
                          LICENCE : {est.licence ? `${est.licence.slice(0, 12)}...` : 'N/A'}
                        </div>
                        <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-extrabold uppercase">
                          Année {est.activeSchoolYear}
                        </span>
                      </div>
                    </div>

                    {/* Edit & Suspension actions */}
                    <div className="mt-5 pt-4 border-t border-gray-150 dark:border-gray-800 flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(est)}
                        className="flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400"
                        title="Modifier les réglages et design"
                      >
                        <Edit2 size={12} />
                        Modifier la Configuration
                      </button>

                      {isSuperAdmin && (
                        <button
                          onClick={() => toggleEstablishmentStatus(est.id)}
                          className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            est.active 
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 dark:text-rose-455' 
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/40 dark:text-emerald-400'
                          }`}
                        >
                          {est.active ? (
                            <>
                              <Ban size={12} />
                              Suspendre
                            </>
                          ) : (
                            <>
                              <CheckCircle size={12} />
                              Réactiver campus
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredList.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl text-gray-400">
                <Building2 size={40} className="mx-auto mb-3" />
                <p className="text-xs font-black uppercase tracking-wider">Aucun campus ne correspond à vos filtres.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* CAMPUS CREATION / MODIFICATION DIALOG MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans" id="modal-campus">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  {editingEst ? "Modifier l'établissement" : "Enregistrer un nouvel établissement"}
                </h3>
              </div>
              <button
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="p-1 text-gray-450 hover:text-gray-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error banner */}
            {formError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/30 text-red-650 dark:text-red-400 text-xs font-bold text-center">
                {formError}
              </div>
            )}

            {/* Form body */}
            <form onSubmit={handleSave} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* ID Input */}
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">ID Unique (tenant ID)</label>
                  <input
                    id="input-campus-id"
                    type="text"
                    disabled={!!editingEst}
                    placeholder="EDU-001"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold tracking-wider disabled:opacity-50 text-gray-850 dark:text-white font-mono"
                  />
                </div>

                {/* Target Name */}
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nom de l'établissement</label>
                  <input
                    id="input-campus-name"
                    type="text"
                    placeholder="e.g. Institut Polytechnique"
                    value={formNom}
                    onChange={(e) => setFormNom(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-850 dark:text-white"
                  />
                </div>
              </div>

              {/* Moto / Devise */}
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Devise / Slogan institutionnel</label>
                <input
                  id="input-campus-devise"
                  type="text"
                  placeholder="e.g. Discipline, Travail, Succès"
                  value={formDevise}
                  onChange={(e) => setFormDevise(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-bold text-gray-850 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in" id="logo-banner-upload-grid">
                {/* Logo Section */}
                <div className="p-4 bg-gray-55 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-850 rounded-2xl space-y-3 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest block font-sans">
                      Logo de l'Établissement
                    </span>
                    {formLogo && (
                      <button
                        type="button"
                        onClick={() => setFormLogo('')}
                        className="text-[9px] font-black text-red-500 hover:text-red-650 uppercase tracking-wider cursor-pointer"
                      >
                        Retirer
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Visual Preview */}
                    <div className="relative w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-855 bg-white dark:bg-gray-950 flex items-center justify-center overflow-hidden shrink-0">
                      {isUploadingLogo ? (
                        <RefreshCw className="animate-spin text-indigo-600" size={20} />
                      ) : formLogo ? (
                        <img 
                          src={formLogo} 
                          alt="Logo Preview" 
                          className="w-full h-full object-contain p-1"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Building2 className="text-gray-300 dark:text-gray-700" size={24} />
                      )}
                    </div>

                    <div className="flex-1">
                      <label 
                        htmlFor="logo-file-input"
                        className={`inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400 rounded-xl text-xs font-extrabold cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all font-sans ${isUploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <Upload size={14} />
                        {isUploadingLogo ? 'Chargement...' : 'Charger un fichier'}
                      </label>
                      <input 
                        id="logo-file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        disabled={isUploadingLogo}
                        className="hidden"
                      />
                      <p className="text-[9px] text-gray-400 font-medium mt-1">PNG, JPG ou SVG. Max 2Mo.</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-150 dark:border-gray-800">
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-mono">Ou adresse URL directe (optionnel)</label>
                    <input
                      id="input-campus-logo"
                      type="url"
                      placeholder="https://exemples.com/logo.png"
                      value={formLogo.startsWith('data:') ? '' : formLogo}
                      onChange={(e) => setFormLogo(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs text-gray-700 dark:text-white font-mono font-semibold"
                    />
                  </div>
                </div>

                {/* Banner Section */}
                <div className="p-4 bg-gray-55 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-850 rounded-2xl space-y-3 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block font-sans">
                      Bannière d'accueil
                    </span>
                    {formBanner && (
                      <button
                        type="button"
                        onClick={() => setFormBanner('')}
                        className="text-[9px] font-black text-red-500 hover:text-red-650 uppercase tracking-wider cursor-pointer"
                      >
                        Retirer
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Visual Preview */}
                    <div className="relative w-24 h-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-855 bg-white dark:bg-gray-950 flex items-center justify-center overflow-hidden shrink-0 font-sans">
                      {isUploadingBanner ? (
                        <RefreshCw className="animate-spin text-indigo-600" size={20} />
                      ) : formBanner ? (
                        <img 
                          src={formBanner} 
                          alt="Banner Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Image className="text-gray-300 dark:text-gray-700" size={24} />
                      )}
                    </div>

                    <div className="flex-1">
                      <label 
                        htmlFor="banner-file-input"
                        className={`inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400 rounded-xl text-xs font-extrabold cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all font-sans ${isUploadingBanner ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <Upload size={14} />
                        {isUploadingBanner ? 'Chargement...' : 'Charger un fichier'}
                      </label>
                      <input 
                        id="banner-file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleBannerFileChange}
                        disabled={isUploadingBanner}
                        className="hidden"
                      />
                      <p className="text-[9px] text-gray-400 font-medium mt-1">Format paysage. Max 2Mo.</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-150 dark:border-gray-800 font-sans">
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-mono">Ou adresse URL directe (optionnel)</label>
                    <input
                      id="input-campus-banner"
                      type="url"
                      placeholder="https://exemples.com/banner.png"
                      value={formBanner.startsWith('data:') ? '' : formBanner}
                      onChange={(e) => setFormBanner(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs text-gray-700 dark:text-white font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Branding Custom Colors */}
              <div className="p-4 bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-850 rounded-2xl" id="campus-branding-pnl">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 font-sans">
                  Couleurs institutionnelles (Charte graphique)
                </span>
                <div className="grid grid-cols-2 gap-4 animate-fade-in font-sans">
                  <div>
                    <label className="block text-[9px] font-extrabold text-gray-400 uppercase mb-1">Couleur Principale</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border-0 cursor-pointer overflow-hidden p-0"
                      />
                      <input
                        type="text"
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none text-xs font-mono font-black"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-gray-400 uppercase mb-1">Couleur Secondaire</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formSecondaryColor}
                        onChange={(e) => setFormSecondaryColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border-0 cursor-pointer overflow-hidden p-0"
                      />
                      <input
                        type="text"
                        value={formSecondaryColor}
                        onChange={(e) => setFormSecondaryColor(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none text-xs font-mono font-black"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* License, Plan and active school year */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="campus-licencing-row">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-sans">Plan de souscription</label>
                  <select
                    id="input-campus-plan"
                    value={formPlan}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setFormPlan(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-gray-55 dark:bg-gray-955 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-bold text-gray-800 dark:text-white disabled:opacity-60"
                  >
                    {plansList.map(plan => (
                      <option key={plan} value={plan}>{plan} ({planPrices[plan]}€/mois)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Licence Edu-Nify</label>
                  <input
                    id="input-campus-licence"
                    type="text"
                    value={formLicence}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setFormLicence(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-955 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-mono font-bold text-gray-855 dark:text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-sans">Année Active</label>
                  <input
                    id="input-campus-year"
                    type="text"
                    placeholder="2025-2026"
                    value={formActiveSchoolYear}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setFormActiveSchoolYear(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-855 rounded-xl outline-none text-xs font-black text-gray-855 dark:text-white font-mono disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="campus-contacts-row">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-sans">Téléphone d'accueil</label>
                  <input
                    id="input-campus-tel"
                    type="text"
                    placeholder="+241 ..."
                    value={formTelephone}
                    onChange={(e) => setFormTelephone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-855 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Email global</label>
                  <input
                    id="input-campus-email"
                    type="email"
                    placeholder="direction@..."
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-855 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-mono">Site Web</label>
                  <input
                    id="input-campus-web"
                    type="url"
                    placeholder="https://..."
                    value={formSiteWeb}
                    onChange={(e) => setFormSiteWeb(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-855 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-sans">Adresse Physique complète</label>
                <input
                  id="input-campus-address"
                  type="text"
                  placeholder="Quartier Sablière, face à la plage, Libreville"
                  value={formAdresse}
                  onChange={(e) => setFormAdresse(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-955 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-bold text-gray-850 dark:text-white"
                />
              </div>

              {/* Proviseur / Principal Profile Section */}
              <div className="p-4 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl space-y-3 font-sans" id="rep-profile-form-container">
                <div className="flex items-center gap-2 border-b border-indigo-150/50 dark:border-indigo-900/20 pb-2">
                  <Shield size={14} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest block">
                    Direction (Proviseur ou Principal de l'établissement)
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Civilité</label>
                    <select
                      id="input-resp-civility"
                      value={formResponsableCivility}
                      onChange={(e) => setFormResponsableCivility(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-bold text-gray-800 dark:text-white"
                    >
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                      <option value="Dr">Dr</option>
                      <option value="Pr">Pr</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Prénom du Responsable</label>
                    <input
                      id="input-resp-prenom"
                      type="text"
                      placeholder="e.g. Martinien"
                      value={formResponsablePrenom}
                      onChange={(e) => setFormResponsablePrenom(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-850 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Nom du Responsable</label>
                    <input
                      id="input-resp-nom"
                      type="text"
                      placeholder="e.g. MVEZOGO"
                      value={formResponsableNom}
                      onChange={(e) => setFormResponsableNom(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-850 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Email Direct</label>
                    <input
                      id="input-resp-email"
                      type="email"
                      placeholder="mvezogo@direction.edu"
                      value={formResponsableEmail}
                      onChange={(e) => setFormResponsableEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-semibold text-gray-800 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Téléphone Direct</label>
                    <input
                      id="input-resp-tel"
                      type="text"
                      placeholder="+241 66 12 34 56"
                      value={formResponsableTelephone}
                      onChange={(e) => setFormResponsableTelephone(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-semibold text-gray-800 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-150 dark:border-gray-850 font-sans">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingLogo || isUploadingBanner}
                  className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-200 dark:shadow-none animate-pulse-slow disabled:opacity-50"
                >
                  {isSubmitting 
                    ? 'Enregistrement...' 
                    : (isUploadingLogo || isUploadingBanner) 
                      ? 'Téléchargement...' 
                      : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESTABLISHMENT RESPONSIBLE / ADMIN CREATION MODAL */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans" id="modal-new-admin">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isAdminSubmitting && !generatedCreds && setIsAdminModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in border border-indigo-100/10">
            {/* Header */}
            <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={20} className="text-indigo-650 dark:text-indigo-400 animate-pulse-slow" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  {generatedCreds ? "Compte créé avec succès !" : "Créer le Compte d'un Responsable"}
                </h3>
              </div>
              <button
                onClick={() => !isAdminSubmitting && setIsAdminModalOpen(false)}
                className="p-1 text-gray-450 hover:text-gray-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error dialog */}
            {adminError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/25 border-b border-red-100/30 text-red-650 dark:text-red-400 text-xs font-extrabold text-center">
                {adminError}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {generatedCreds ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-550/20 rounded-2xl text-center space-y-1">
                    <CheckCircle2 size={36} className="text-emerald-500 mx-auto animate-bounce-slow" />
                    <h4 className="text-sm font-extrabold text-emerald-700 dark:text-emerald-450">Raccordement SaaS Réussi !</h4>
                    <p className="text-[11px] text-gray-500">L'administrateur a été enregistré dans le système central et raccordé à son campus.</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-2xl p-5 space-y-4 font-mono text-xs">
                    <div className="border-b border-dashed border-gray-200 dark:border-gray-800 pb-3 flex justify-between items-center">
                      <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">INFORMATIONS D'ACCÈS</span>
                      <button
                        id="btn-copy-creds"
                        onClick={copyCredsToClipboard}
                        className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 cursor-pointer"
                      >
                        <Clipboard size={11} />
                        {copiedNotification ? 'Copié !' : 'Tout Copier'}
                      </button>
                    </div>

                    <div className="space-y-3 font-semibold text-gray-800 dark:text-gray-200">
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase block mb-0.5 font-sans">NOM DU RESPONSABLE</span>
                        <div className="font-extrabold text-gray-900 dark:text-white font-sans">{generatedCreds.fullName}</div>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase block mb-0.5 font-bold font-sans">CAMPUS DE RATTACHEMENT</span>
                        <div className="font-extrabold text-indigo-650 dark:text-indigo-400 font-sans">{generatedCreds.establishmentName} (ID: {generatedCreds.establishmentId})</div>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase block mb-0.5 font-sans">ADRESSE DE SÉCURITÉ (EMAIL)</span>
                        <div className="font-mono bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 p-2.5 rounded-lg text-xs break-all text-indigo-600 dark:text-indigo-350">{generatedCreds.email}</div>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase block mb-0.5 font-sans">MOT DE PASSE TEMPORAIRE</span>
                        <div className="font-mono bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 p-2.5 rounded-lg text-xs tracking-wider font-extrabold text-amber-600">{generatedCreds.password}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150/35 rounded-2xl flex gap-3 text-xs text-indigo-700 dark:text-indigo-300 font-medium leading-normal">
                    <ShieldAlert size={20} className="shrink-0 text-indigo-500" />
                    <span>
                      Veuillez transmettre **uniquement** ces clés de connexion au responsable. Pour des raisons de cybersécurité, ce mot de passe ne s'affichera qu'une seule fois.
                    </span>
                  </div>

                  <button
                    onClick={() => setIsAdminModalOpen(false)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    Fermer le guichet
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateAdmin} className="space-y-4 font-sans">
                  <div className="p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/50 rounded-xl flex gap-3 text-xs text-indigo-650 dark:text-indigo-400 font-medium leading-normal">
                    <Building2 size={18} className="shrink-0 text-indigo-500" />
                    <span>
                      Remplissez le formulaire de raccordement. Le système créera une identité cloud reliée de manière cryptographique à la base de données isolée et aux critères de ce campus.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Prénom</label>
                      <input
                        id="input-admin-prenom"
                        type="text"
                        placeholder="e.g. Jean"
                        value={adminPrenom}
                        onChange={(e) => setAdminPrenom(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-bold text-gray-850 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nom de Famille</label>
                      <input
                        id="input-admin-nom"
                        type="text"
                        placeholder="e.g. Dupont"
                        value={adminNom}
                        onChange={(e) => setAdminNom(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-bold text-gray-855 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Établissement rattaché (SaaS Sub-Tenant)</label>
                    <select
                      id="input-admin-establishment"
                      value={adminEtablissement}
                      onChange={(e) => setAdminEtablissement(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-black text-gray-850 dark:text-white"
                    >
                      {establishments.length === 0 ? (
                        <option value="">Aucun campus disponible</option>
                      ) : (
                        establishments.map(est => (
                          <option key={est.id} value={est.id}>
                            {est.nom} ({est.id})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-bold">Adresse de Connexion (Login Email)</label>
                    <input
                      id="input-admin-email"
                      type="email"
                      placeholder="e.g. responsable.polytech@edu-nify.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-mono font-bold text-gray-850 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-bold">Mot de Passe de Sécurité</label>
                    <div className="relative">
                      <input
                        id="input-admin-pwd"
                        type={showPasswordRaw ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••••••••"
                        className="w-full pl-3 pr-24 py-2.5 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-mono font-extrabold text-gray-850 dark:text-white"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5" id="pwd-actions">
                        <button
                          type="button"
                          onClick={() => setShowPasswordRaw(!showPasswordRaw)}
                          className="p-1 text-gray-450 hover:text-gray-600 cursor-pointer"
                        >
                          {showPasswordRaw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          id="btn-admin-pwd-gen"
                          onClick={generateRandomPassword}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950 text-[9px] font-black uppercase rounded-lg border border-indigo-200/50 cursor-pointer"
                          title="Générer aléatoirement"
                        >
                          Générer
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Numéro de Contact (Facultatif)</label>
                    <input
                      id="input-admin-phone"
                      type="tel"
                      placeholder="e.g. +241 77 12 34 56"
                      value={adminContact}
                      onChange={(e) => setAdminContact(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl outline-none text-xs font-extrabold text-gray-850 dark:text-white font-mono"
                    />
                  </div>

                  {/* Submission triggers */}
                  <div className="flex gap-3 pt-4 border-t border-gray-150 dark:border-gray-850">
                    <button
                      type="button"
                      disabled={isAdminSubmitting}
                      onClick={() => setIsAdminModalOpen(false)}
                      className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-850 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isAdminSubmitting}
                      className="flex-1 py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer"
                    >
                      {isAdminSubmitting ? "Création..." : "Enregistrer Responsable"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
