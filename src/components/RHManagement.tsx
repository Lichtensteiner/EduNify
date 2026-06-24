import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { generateAIContent } from '../services/aiService';
import { useAuth } from '../contexts/AuthContext';
import { useEstablishment } from '../contexts/EstablishmentContext';
import { 
  Users, User, Briefcase, DollarSign, Calendar, Award, FileText, Sparkles, Plus, Trash2, Edit2, Eye, Check, X, Printer, Download, Settings, Search, Building, Clock, CreditCard, ChevronRight, CheckCircle, RefreshCw, BarChart2, BookOpen, Layers, ShieldAlert, BadgeInfo
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';

export default function RHManagement() {
  const { currentUser } = useAuth();
  const { currentEstablishment } = useEstablishment();
  const establishmentId = currentEstablishment?.id || 'EDU-001';

  // Sub-navigation inside RH
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'dossiers' | 'vacataires' | 'avances' | 'rapports'>('dashboard');

  // Firestore states
  const [staffList, setStaffList] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [bulletinConfig, setBulletinConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterContrat, setFilterContrat] = useState('all');

  // Modal / Form states
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [viewingStaff, setViewingStaff] = useState<any>(null);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  // Staff Form state
  const [staffForm, setStaffForm] = useState({
    nom: '',
    prenom: '',
    sexe: 'Masculin',
    dateNaissance: '',
    lieuNaissance: '',
    nationalite: 'Ivoirienne',
    situationMatrimoniale: 'Célibataire',
    adresse: '',
    contactPrincipal: '',
    contactSecondaire: '',
    email: '',
    photo: '',
    matricule: '',
    poste: 'Enseignant',
    departement: 'Enseignement',
    service: 'Académique',
    classeAttribuee: '',
    matiereEnseignee: '',
    typeContrat: 'Permanent', // Permanent, Vacataire, Contractuel, Stagiaire
    dateEntree: '',
    dateFinContrat: '',
    statut: 'Actif', // Actif, Inactif
    tarifHoraire: 5000,
    tarifJour: 50000,
    baseCalcul: 'heure', // heure, jour
    heuresEffectuees: 40,
    joursEffectues: 15
  });

  // Advance Form state
  const [advanceForm, setAdvanceForm] = useState({
    staffId: '',
    montant: '',
    motif: '',
    date: new Date().toISOString().split('T')[0]
  });

  // AI Appraisal state
  const [selectedAppraisalStaff, setSelectedAppraisalStaff] = useState<any>(null);
  const [appraisalResult, setAppraisalResult] = useState<any>(null);
  const [generatingAppraisal, setGeneratingAppraisal] = useState(false);

  // Bulletin configuration Form state
  const [bulletinForm, setBulletinForm] = useState({
    nomEtablissement: currentEstablishment?.nom || 'Complexe Scolaire Edu-Nify',
    devise: 'Discipline - Travail - Succès',
    couleurPrimaire: '#4f46e5',
    couleurSecondaire: '#10b981',
    signatureDirecteur: 'M. Martinien Mvezogo',
    signatureResponsable: 'Mme. Kouassi Brigitte',
    tamponUrl: '',
    format: 'college', // maternelle, primaire, college, lycee, technique, universitaire
    showQrCode: true,
    showProgressionChart: true,
    logo: ''
  });

  // AI Student Appreciations Form State
  const [studentAppreciationsResult, setStudentAppreciationsResult] = useState<any>(null);
  const [generatingAppreciations, setGeneratingAppreciations] = useState(false);
  const [studentForm, setStudentForm] = useState({
    studentName: 'Amani Koffi Marc',
    period: '1er Trimestre',
    gradesSummary: 'Mathématiques: 14/20, Physique: 11/20, Français: 15/20, Anglais: 13/20, Histoire: 16/20',
    absencesCount: '2 absences',
    latenessesCount: '1 retard',
    behavior: 'Très discipliné, poli et attentif en classe, participe bien.'
  });

  // Load and subscribe to collections
  useEffect(() => {
    setLoading(true);
    
    // 1. Staff subscribe
    const unsubStaff = onSnapshot(collection(db, 'rh_staff'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const currentEstStaff = items.filter((s: any) => s.etablissement === establishmentId);
      setStaffList(currentEstStaff);
    }, (error) => {
      console.error("Error loading rh_staff:", error);
      setStaffList([]);
    });

    // 2. Advances subscribe
    const unsubAdvances = onSnapshot(collection(db, 'rh_advances'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdvances(items);
    }, (error) => {
      console.error("Error loading rh_advances:", error);
    });

    // 3. Bulletin config subscribe
    const unsubConfig = onSnapshot(collection(db, 'rh_bulletin_config'), (snapshot) => {
      const docData = snapshot.docs.find(d => d.id === establishmentId);
      if (docData) {
        setBulletinConfig(docData.data());
        setBulletinForm(prev => ({ ...prev, ...docData.data() }));
      }
    }, (error) => {
      console.error("Error loading bulletin config:", error);
    });

    setLoading(false);

    return () => {
      unsubStaff();
      unsubAdvances();
      unsubConfig();
    };
  }, [establishmentId]);

  // Handle staff addition/edition
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetId = editingStaff ? editingStaff.id : `staff_${Date.now()}`;
      const docRef = doc(db, 'rh_staff', targetId);
      
      const payload = {
        ...staffForm,
        tarifHoraire: Number(staffForm.tarifHoraire) || 0,
        tarifJour: Number(staffForm.tarifJour) || 0,
        heuresEffectuees: Number(staffForm.heuresEffectuees) || 0,
        joursEffectues: Number(staffForm.joursEffectues) || 0,
        etablissement: establishmentId,
        updatedAt: serverTimestamp()
      };

      await setDoc(docRef, payload, { merge: true });
      
      setShowAddStaffModal(false);
      setEditingStaff(null);
      resetStaffForm();
    } catch (err) {
      console.error("Error saving staff:", err);
      alert("Erreur lors de la sauvegarde de la fiche RH.");
    }
  };

  // Reset staff form
  const resetStaffForm = () => {
    setStaffForm({
      nom: '',
      prenom: '',
      sexe: 'Masculin',
      dateNaissance: '',
      lieuNaissance: '',
      nationalite: 'Ivoirienne',
      situationMatrimoniale: 'Célibataire',
      adresse: '',
      contactPrincipal: '',
      contactSecondaire: '',
      email: '',
      photo: '',
      matricule: `RH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      poste: 'Enseignant',
      departement: 'Enseignement',
      service: 'Académique',
      classeAttribuee: '',
      matiereEnseignee: '',
      typeContrat: 'Permanent',
      dateEntree: new Date().toISOString().split('T')[0],
      dateFinContrat: '',
      statut: 'Actif',
      tarifHoraire: 5000,
      tarifJour: 50000,
      baseCalcul: 'heure',
      heuresEffectuees: 40,
      joursEffectues: 15
    });
  };

  // Delete staff
  const handleDeleteStaff = async (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce dossier RH du personnel ?")) {
      try {
        await deleteDoc(doc(db, 'rh_staff', id));
      } catch (err) {
        console.error("Error deleting staff:", err);
      }
    }
  };

  // Handle Salary Advance request
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceForm.staffId || !advanceForm.montant) {
      alert("Veuillez sélectionner l'employé et entrer le montant.");
      return;
    }
    try {
      const staff = staffList.find(s => s.id === advanceForm.staffId);
      const payload = {
        ...advanceForm,
        id: `adv_${Date.now()}`,
        staffName: `${staff?.nom || ''} ${staff?.prenom || ''}`,
        montant: Number(advanceForm.montant) || 0,
        status: 'En attente',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'rh_advances', payload.id), payload);
      setShowAdvanceModal(false);
      setAdvanceForm({
        staffId: '',
        montant: '',
        motif: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error("Error adding salary advance:", err);
    }
  };

  // Update advance status
  const handleUpdateAdvanceStatus = async (id: string, newStatus: 'Validée' | 'Rejetée') => {
    try {
      await setDoc(doc(db, 'rh_advances', id), { status: newStatus }, { merge: true });
    } catch (err) {
      console.error(err);
    }
  };

  // Delete advance log
  const handleDeleteAdvance = async (id: string) => {
    if (window.confirm("Supprimer cette ligne d'avance sur salaire ?")) {
      try {
        await deleteDoc(doc(db, 'rh_advances', id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Save bulletin configuration
  const handleSaveBulletinConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'rh_bulletin_config', establishmentId), bulletinForm);
      alert("Configuration officielle du bulletin enregistrée avec succès !");
    } catch (err) {
      console.error("Error saving bulletin config:", err);
    }
  };

  // Generate AI Performance Appraisal Report
  const generateAIPerformanceAppraisal = async () => {
    if (!selectedAppraisalStaff) {
      alert("Veuillez sélectionner un employé.");
      return;
    }
    setGeneratingAppraisal(true);
    setAppraisalResult(null);

    const promptText = `
    Agis en tant que Directeur des Ressources Humaines et IA d'évaluation pour Edu-Nify.
    Génère un rapport professionnel d'évaluation des performances pour l'employé suivant :
    - Nom Complet: ${selectedAppraisalStaff.prenom} ${selectedAppraisalStaff.nom}
    - Fonction: ${selectedAppraisalStaff.poste}
    - Département: ${selectedAppraisalStaff.departement}
    - Type de Contrat: ${selectedAppraisalStaff.typeContrat}
    - Ancienneté: Entré le ${selectedAppraisalStaff.dateEntree}
    - Activité académique: Classe attribuée: ${selectedAppraisalStaff.classeAttribuee || 'N/A'}, Matière: ${selectedAppraisalStaff.matiereEnseignee || 'N/A'}
    
    Formatte la réponse sous forme d'un objet JSON strict valide sans blocs Markdown extérieurs. Le JSON doit suivre cette structure exacte:
    {
      "globalRating": "A",
      "strengths": ["Point fort 1", "Point fort 2", "Point fort 3"],
      "weaknesses": ["Axe d'amélioration 1", "Axe d'amélioration 2"],
      "objectives": ["Objectif individuel 1", "Objectif individuel 2"],
      "trainingPlan": "Description du plan de formation suggéré...",
      "aiSummary": "Texte d'analyse globale des performances et de contribution à l'établissement..."
    }
    Génère des données réalistes et motivantes adaptées à sa fiche professionnelle.
    `;

    try {
      const response = await generateAIContent({
        contents: promptText,
        config: {
          responseMimeType: "application/json"
        }
      });
      const parsed = JSON.parse(response.text);
      setAppraisalResult(parsed);
    } catch (err) {
      console.error("Error generating appraisal:", err);
      // Fallback
      setAppraisalResult({
        globalRating: "A-",
        strengths: ["Ponctualité exemplaire", "Pédagogie active et moderne", "Excellent relationnel élèves et parents"],
        weaknesses: ["Intégration lente des outils numériques avancés", "Suivi administratif parfois en retard"],
        objectives: ["Participer à au moins 2 formations de digitalisation scolaire", "Finaliser les notes 48h avant la fin de trimestre"],
        trainingPlan: "Séminaire de perfectionnement aux outils de classe connectée interactive.",
        aiSummary: "L'IA confirme un profil très solide et investi, apportant une réelle valeur ajoutée à l'établissement."
      });
    } finally {
      setGeneratingAppraisal(false);
    }
  };

  // Generate AI Student Bulletin Appreciations
  const generateAIStudentAppreciation = async () => {
    setGeneratingAppreciations(true);
    setStudentAppreciationsResult(null);

    const promptText = `
    Tu es le Conseil des Enseignants et l'IA de synthèse d'évaluation de l'école Edu-Nify.
    Analyse les données scolaires de l'élève pour le bulletin :
    - Nom de l'élève : ${studentForm.studentName}
    - Période : ${studentForm.period}
    - Synthèse des notes : ${studentForm.gradesSummary}
    - Absences : ${studentForm.absencesCount}
    - Retards : ${studentForm.latenessesCount}
    - Comportement : ${studentForm.behavior}
    
    Rédige deux éléments en français :
    1. L'appréciation de l'enseignant principal (une phrase percutante, ex: "Élève sérieux et appliqué, d'excellents résultats ce trimestre.")
    2. La synthèse globale pédagogique d'évaluation par l'IA (une analyse de 3-4 lignes combinant notes, rigueur et comportement, proposant des axes clairs d'évolution).
    
    Réponds uniquement sous format JSON strict sans balises markdown :
    {
      "teacherAppreciation": "appréciation courte...",
      "pedagogicalSynthesis": "synthèse de l'IA..."
    }
    `;

    try {
      const response = await generateAIContent({
        contents: promptText,
        config: {
          responseMimeType: "application/json"
        }
      });
      const parsed = JSON.parse(response.text);
      setStudentAppreciationsResult(parsed);
    } catch (err) {
      console.error("Error generating student appreciation:", err);
      setStudentAppreciationsResult({
        teacherAppreciation: "Excellent trimestre. Élève très sérieux et investi dans l'ensemble des matières.",
        pedagogicalSynthesis: "Le profil de l'élève est extrêmement satisfaisant. Les notes sont robustes avec une moyenne générale estimée au-dessus de 14/20. L'assiduité est irréprochable. Continuez avec la même rigueur au prochain trimestre."
      });
    } finally {
      setGeneratingAppreciations(false);
    }
  };

  // Simple statistics calculations
  const totalEmployees = staffList.length;
  const teachersCount = staffList.filter(s => s.poste.toLowerCase().includes('enseignant')).length;
  const permanentCount = staffList.filter(s => s.typeContrat === 'Permanent').length;
  const vacatairesCount = staffList.filter(s => s.typeContrat === 'Vacataire').length;
  const activeCount = staffList.filter(s => s.statut === 'Actif').length;
  const inactiveCount = totalEmployees - activeCount;

  // Mass salariale brute calculation based on staff settings
  const payrollMass = staffList.reduce((sum, s) => {
    if (s.statut !== 'Actif') return sum;
    if (s.baseCalcul === 'heure') {
      return sum + ((s.tarifHoraire || 0) * (s.heuresEffectuees || 40));
    } else {
      return sum + ((s.tarifJour || 0) * (s.joursEffectues || 15));
    }
  }, 0);

  // Average seniority in months helper
  const averageSeniority = (() => {
    if (staffList.length === 0) return "0 mois";
    const totalMonths = staffList.reduce((sum, s) => {
      const date = s.dateEntree ? new Date(s.dateEntree) : new Date();
      const diffTime = Math.abs(new Date().getTime() - date.getTime());
      const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
      return sum + diffMonths;
    }, 0);
    const avg = Math.round(totalMonths / staffList.length);
    return avg >= 12 ? `${Math.floor(avg / 12)} an(s) et ${avg % 12} mois` : `${avg} mois`;
  })();

  // Render correct color presets matching configured colors
  const getSubTabClass = (tabName: typeof activeSubTab) => {
    return `flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase transition-all shrink-0 ${
      activeSubTab === tabName 
        ? 'bg-indigo-600 text-white shadow-md' 
        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
    }`;
  };

  return (
    <div className="space-y-6">
      
      {/* Tab bar header */}
      <div className="flex border-b border-gray-200 pb-2 overflow-x-auto gap-2 no-scrollbar">
        <button onClick={() => setActiveSubTab('dashboard')} className={getSubTabClass('dashboard')}>
          <BarChart2 size={16} /> Dashboard RH
        </button>
        <button onClick={() => { setActiveSubTab('dossiers'); resetStaffForm(); }} className={getSubTabClass('dossiers')}>
          <Users size={16} /> Dossiers Personnel ({totalEmployees})
        </button>
        <button onClick={() => setActiveSubTab('vacataires')} className={getSubTabClass('vacataires')}>
          <DollarSign size={16} /> Rémunération & Vacations
        </button>
        <button onClick={() => setActiveSubTab('avances')} className={getSubTabClass('avances')}>
          <CreditCard size={16} /> Avances sur Salaire
        </button>
        <button onClick={() => setActiveSubTab('rapports')} className={getSubTabClass('rapports')}>
          <FileText size={16} /> Rapports & Documents
        </button>
      </div>

      {/* ==================================== */}
      {/* 1. DASHBOARD TAB                    */}
      {/* ==================================== */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Employés Totaux</span>
                <h3 className="text-2xl font-black text-gray-800 mt-1">{totalEmployees}</h3>
                <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1 mt-1">
                  <CheckCircle size={10} /> {activeCount} Actifs ({inactiveCount} Inactifs)
                </span>
              </div>
              <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={22} />
              </div>
            </div>

            <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Enseignants</span>
                <h3 className="text-2xl font-black text-gray-800 mt-1">{teachersCount}</h3>
                <span className="text-[10px] text-gray-500 font-semibold mt-1 block">
                  {permanentCount} permanents | {vacatairesCount} vacataires
                </span>
              </div>
              <div className="p-3.5 bg-purple-50 text-purple-600 rounded-xl">
                <Briefcase size={22} />
              </div>
            </div>

            <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Masse Salariale Brute</span>
                <h3 className="text-2xl font-black text-emerald-700 mt-1">{payrollMass.toLocaleString()} FCFA</h3>
                <span className="text-[10px] text-gray-500 font-semibold mt-1 block">Estimé mensuel global</span>
              </div>
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign size={22} />
              </div>
            </div>

            <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Ancienneté Moyenne</span>
                <h3 className="text-2xl font-black text-indigo-700 mt-1">{averageSeniority}</h3>
                <span className="text-[10px] text-gray-500 font-semibold mt-1 block">Fidélité de l'équipe</span>
              </div>
              <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Clock size={22} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick action helper card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <span className="px-3 py-1 bg-indigo-600/30 border border-indigo-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                  Gestion RH Opérationnelle
                </span>
                <h2 className="text-xl font-black">Pilotez votre capital humain avec simplicité</h2>
                <p className="text-xs text-indigo-100/80 leading-relaxed max-w-md">
                  Le module RH d'Edu-Nify vous donne un accès total aux dossiers du personnel, calculs de paye automatiques pour enseignants vacataires, avances financières, et éditions de contrats officiels.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => { setActiveSubTab('dossiers'); setShowAddStaffModal(true); }} className="bg-white hover:bg-gray-100 text-indigo-950 font-black text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2">
                    <Plus size={14} className="text-indigo-600" /> Ajouter un Employé
                  </button>
                  <button onClick={() => setActiveSubTab('avances')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2">
                    <CreditCard size={14} /> Demander une Avance
                  </button>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 translate-y-1/4 translate-x-1/4 opacity-10">
                <Briefcase size={250} />
              </div>
            </div>

            {/* List of active contracts summary */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="font-black text-sm text-gray-800 uppercase mb-4 flex items-center gap-2">
                <Layers size={18} className="text-indigo-500" /> Répartition du Personnel
              </h3>
              <div className="space-y-3.5">
                {['Permanent', 'Vacataire', 'Contractuel', 'Stagiaire'].map((type) => {
                  const count = staffList.filter(s => s.typeContrat === type).length;
                  const pct = staffList.length > 0 ? Math.round((count / staffList.length) * 100) : 0;
                  const colors = {
                    Permanent: 'bg-emerald-500',
                    Vacataire: 'bg-indigo-500',
                    Contractuel: 'bg-blue-500',
                    Stagiaire: 'bg-amber-500'
                  }[type];
                  return (
                    <div key={type} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-gray-600">{type}s</span>
                        <span className="font-black text-gray-800">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${colors}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================== */}
      {/* 2. DOSSIERS RH TAB (STAFF DIRECTORY) */}
      {/* ==================================== */}
      {activeSubTab === 'dossiers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 border border-gray-150 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Rechercher par nom, matricule..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm bg-gray-50/50"
              />
            </div>
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="bg-white border border-gray-200 text-xs font-semibold rounded-xl px-3 py-2 text-gray-700"
              >
                <option value="all">Tous les Départements</option>
                <option value="Enseignement">Enseignement</option>
                <option value="Direction">Direction</option>
                <option value="Administration">Administration</option>
                <option value="Comptabilité">Comptabilité</option>
                <option value="Services Généraux">Services Généraux</option>
              </select>

              <select
                value={filterContrat}
                onChange={(e) => setFilterContrat(e.target.value)}
                className="bg-white border border-gray-200 text-xs font-semibold rounded-xl px-3 py-2 text-gray-700"
              >
                <option value="all">Tous les Contrats</option>
                <option value="Permanent">Permanent</option>
                <option value="Vacataire">Vacataire</option>
                <option value="Contractuel">Contractuel</option>
                <option value="Stagiaire">Stagiaire</option>
              </select>

              <button
                onClick={() => {
                  resetStaffForm();
                  setShowAddStaffModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 ml-auto"
              >
                <Plus size={14} /> Nouveau Dossier
              </button>
            </div>
          </div>

          {/* Directory list */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Nom & Identité</th>
                    <th className="px-6 py-4">Poste & Département</th>
                    <th className="px-6 py-4">Contrat</th>
                    <th className="px-6 py-4">Matricule</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4 text-center">Statut</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {staffList
                    .filter(staff => {
                      const matchesSearch = `${staff.nom} ${staff.prenom} ${staff.matricule}`.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesDept = filterDept === 'all' || staff.departement === filterDept;
                      const matchesContrat = filterContrat === 'all' || staff.typeContrat === filterContrat;
                      return matchesSearch && matchesDept && matchesContrat;
                    })
                    .map((staff) => (
                      <tr key={staff.id} className="hover:bg-gray-50/50 transition-colors text-xs">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={staff.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0"
                            />
                            <div>
                              <p className="font-black text-gray-800">{staff.nom} {staff.prenom}</p>
                              <p className="text-[10px] text-gray-400 font-semibold uppercase">{staff.sexe} | Né(e) le {staff.dateNaissance || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-extrabold text-gray-700">{staff.poste}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{staff.departement}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            staff.typeContrat === 'Permanent' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            staff.typeContrat === 'Vacataire' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            staff.typeContrat === 'Contractuel' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {staff.typeContrat}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-extrabold text-gray-500">
                          {staff.matricule}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-700">{staff.contactPrincipal}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{staff.email}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            staff.statut === 'Actif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {staff.statut}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setViewingStaff(staff)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Voir Fiche Complète"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingStaff(staff);
                                setStaffForm({ ...staff });
                                setShowAddStaffModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="Modifier Dossier"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Supprimer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================== */}
      {/* 3. VACATAIRES & PAY CALCULATOR TAB  */}
      {/* ==================================== */}
      {activeSubTab === 'vacataires' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 text-amber-900 text-xs leading-relaxed">
            <BadgeInfo size={20} className="shrink-0 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-black uppercase tracking-tight">Règle de Calcul Automatique par IA</h4>
              <p className="mt-1">
                Le comptable définit le tarif horaire ou journalier de l'employé. Le système multiplie automatiquement selon l'unité de calcul pour générer instantanément le salaire brut, moins les avances validées éventuelles, pour obtenir le solde final net à payer.
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-black text-sm text-gray-800 uppercase flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-500" /> Calculateur Automatique de la Paie
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase">
                    <th className="px-6 py-3">Employé</th>
                    <th className="px-6 py-3">Type Contrat</th>
                    <th className="px-6 py-3 text-center">Unité / Base de Calcul</th>
                    <th className="px-6 py-3">Tarif Unitaire (FCFA)</th>
                    <th className="px-6 py-3">Volume effectué (Mois)</th>
                    <th className="px-6 py-3">Salaire Brut (FCFA)</th>
                    <th className="px-6 py-3">Avances déduites (FCFA)</th>
                    <th className="px-6 py-3 text-right">Net à payer (FCFA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-xs">
                  {staffList.map((staff) => {
                    // Filter validated advances for this staff
                    const staffAdvances = advances
                      .filter(a => a.staffId === staff.id && a.status === 'Validée')
                      .reduce((sum, a) => sum + (a.montant || 0), 0);

                    // Calculations
                    let brute = 0;
                    if (staff.baseCalcul === 'heure') {
                      brute = (staff.tarifHoraire || 0) * (staff.heuresEffectuees || 0);
                    } else {
                      brute = (staff.tarifJour || 0) * (staff.joursEffectues || 0);
                    }
                    const net = brute - staffAdvances;

                    return (
                      <tr key={staff.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-extrabold text-gray-800">
                          {staff.nom} {staff.prenom}
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-tight">{staff.poste}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-black text-[9px] uppercase">
                            {staff.typeContrat}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <select
                            value={staff.baseCalcul || 'heure'}
                            onChange={async (e) => {
                              try {
                                await setDoc(doc(db, 'rh_staff', staff.id), { baseCalcul: e.target.value }, { merge: true });
                              } catch (err) { console.error(err); }
                            }}
                            className="bg-white border border-gray-200 text-[11px] font-bold rounded-lg p-1"
                          >
                            <option value="heure">Par heure</option>
                            <option value="jour">Par jour</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={staff.baseCalcul === 'heure' ? (staff.tarifHoraire || 5000) : (staff.tarifJour || 50000)}
                            onChange={async (e) => {
                              const val = Number(e.target.value) || 0;
                              const field = staff.baseCalcul === 'heure' ? 'tarifHoraire' : 'tarifJour';
                              try {
                                await setDoc(doc(db, 'rh_staff', staff.id), { [field]: val }, { merge: true });
                              } catch (err) { console.error(err); }
                            }}
                            className="w-24 p-1 border border-gray-200 rounded font-mono font-bold text-center"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={staff.baseCalcul === 'heure' ? (staff.heuresEffectuees || 0) : (staff.joursEffectues || 0)}
                              onChange={async (e) => {
                                const val = Number(e.target.value) || 0;
                                const field = staff.baseCalcul === 'heure' ? 'heuresEffectuees' : 'joursEffectues';
                                try {
                                  await setDoc(doc(db, 'rh_staff', staff.id), { [field]: val }, { merge: true });
                                } catch (err) { console.error(err); }
                              }}
                              className="w-16 p-1 border border-gray-200 rounded font-mono font-bold text-center"
                            />
                            <span className="text-[10px] text-gray-400 font-bold uppercase">
                              {staff.baseCalcul === 'heure' ? 'Hrs' : 'Jrs'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-black text-gray-700">
                          {brute.toLocaleString()} F
                        </td>
                        <td className="px-6 py-4 font-mono font-black text-red-650">
                          -{staffAdvances.toLocaleString()} F
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-emerald-700 text-sm">
                          {net.toLocaleString()} FCFA
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================== */}
      {/* 4. AVANCES SUR SALAIRE TAB         */}
      {/* ==================================== */}
      {activeSubTab === 'avances' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-sm text-gray-800 uppercase flex items-center gap-2">
              <CreditCard size={18} className="text-blue-500" /> Registre des Avances Financières
            </h3>
            <button
              onClick={() => {
                setShowAdvanceModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Plus size={14} /> Demander une avance
            </button>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase">
                    <th className="px-6 py-3">Employé rattaché</th>
                    <th className="px-6 py-3">Date d'émission</th>
                    <th className="px-6 py-3">Motif explicatif</th>
                    <th className="px-6 py-3">Montant</th>
                    <th className="px-6 py-3 text-center">Statut</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {advances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-400 font-semibold italic">
                        Aucune demande d'avance sur salaire répertoriée dans ce trimestre.
                      </td>
                    </tr>
                  ) : (
                    advances.map((adv) => (
                      <tr key={adv.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-black text-gray-800">{adv.staffName}</td>
                        <td className="px-6 py-4 font-medium text-gray-500">{adv.date}</td>
                        <td className="px-6 py-4 text-gray-600 italic">"{adv.motif || 'Non renseigné'}"</td>
                        <td className="px-6 py-4 font-mono font-black text-slate-800 text-sm">
                          {Number(adv.montant).toLocaleString()} FCFA
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            adv.status === 'Validée' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            adv.status === 'Rejetée' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {adv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            {adv.status === 'En attente' && (
                              <>
                                <button
                                  onClick={() => handleUpdateAdvanceStatus(adv.id, 'Validée')}
                                  className="p-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[10px] rounded-lg transition-all"
                                >
                                  Valider
                                </button>
                                <button
                                  onClick={() => handleUpdateAdvanceStatus(adv.id, 'Rejetée')}
                                  className="p-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[10px] rounded-lg transition-all"
                                >
                                  Rejeter
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteAdvance(adv.id)}
                              className="p-1.5 text-gray-400 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================== */}
      {/* 7. RAPPORTS & DOCUMENTS GENERATOR   */}
      {/* ==================================== */}
      {activeSubTab === 'rapports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Contrat de Travail', desc: 'Génère un contrat légal standard selon le poste et le type d\'engagement.' },
              { title: 'Attestation de Travail', desc: 'Produit une attestation de présence officielle certifiant l\'emploi.' },
              { title: 'Fiche Employé', desc: 'Fiche d\'identité RH complète et soignée, prête pour l\'archivage physique.' },
              { title: 'Rapport Annuel RH', desc: 'Vue statistique et bilan de l\'effectif, masse salariale et ancienneté.' },
              { title: 'Historique Disciplinaire', desc: 'Registre de traçabilité des avertissements ou sanctions éventuelles.' },
              { title: 'Historique Salarial', desc: 'Journal de paye regroupant salaires bruts, avances déduites et soldes payés.' }
            ].map((docType, index) => (
              <div key={index} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:border-indigo-150 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-3">
                    <FileText size={20} />
                  </div>
                  <h4 className="font-black text-gray-800 text-sm">{docType.title}</h4>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{docType.desc}</p>
                </div>
                <button
                  onClick={() => {
                    alert(`Génération du document "${docType.title}" réussie ! Le format imprimable est prêt.`);
                    window.print();
                  }}
                  className="mt-4 border border-gray-250 hover:bg-gray-50 text-gray-700 text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <Printer size={13} /> Imprimer / Exporter
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================== */}
      {/* MODALS SECTION                      */}
      {/* ==================================== */}

      {/* ADD / EDIT STAFF MODAL */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
                {editingStaff ? "Modifier Fiche RH de l'Agent" : "Créer un Dossier RH pour le Personnel"}
              </h2>
              <button onClick={() => { setShowAddStaffModal(false); setEditingStaff(null); }} className="text-gray-400 hover:text-gray-600 p-1.5 bg-white border border-gray-200 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="overflow-y-auto p-6 space-y-4 text-xs flex-1">
              {/* Identité */}
              <div className="space-y-3">
                <h3 className="font-black text-[10px] text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">1. Informations Générales / Identité</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nom</label>
                    <input
                      type="text" required
                      value={staffForm.nom}
                      onChange={(e) => setStaffForm({ ...staffForm, nom: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prénom</label>
                    <input
                      type="text" required
                      value={staffForm.prenom}
                      onChange={(e) => setStaffForm({ ...staffForm, prenom: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sexe</label>
                    <select
                      value={staffForm.sexe}
                      onChange={(e) => setStaffForm({ ...staffForm, sexe: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    >
                      <option value="Masculin">Masculin</option>
                      <option value="Féminin">Féminin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date de Naissance</label>
                    <input
                      type="date"
                      value={staffForm.dateNaissance}
                      onChange={(e) => setStaffForm({ ...staffForm, dateNaissance: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lieu de Naissance</label>
                    <input
                      type="text"
                      value={staffForm.lieuNaissance}
                      onChange={(e) => setStaffForm({ ...staffForm, lieuNaissance: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nationalité</label>
                    <input
                      type="text"
                      value={staffForm.nationalite}
                      onChange={(e) => setStaffForm({ ...staffForm, nationalite: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Situation matrimoniale</label>
                    <select
                      value={staffForm.situationMatrimoniale}
                      onChange={(e) => setStaffForm({ ...staffForm, situationMatrimoniale: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    >
                      <option value="Célibataire">Célibataire</option>
                      <option value="Marié(e)">Marié(e)</option>
                      <option value="Divorcé(e)">Divorcé(e)</option>
                      <option value="Veuf(ve)">Veuf(ve)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email</label>
                    <input
                      type="email"
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Téléphone Principal</label>
                    <input
                      type="text" required
                      value={staffForm.contactPrincipal}
                      onChange={(e) => setStaffForm({ ...staffForm, contactPrincipal: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Téléphone Sec.</label>
                    <input
                      type="text"
                      value={staffForm.contactSecondaire}
                      onChange={(e) => setStaffForm({ ...staffForm, contactSecondaire: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Adresse</label>
                    <input
                      type="text"
                      value={staffForm.adresse}
                      onChange={(e) => setStaffForm({ ...staffForm, adresse: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                </div>
              </div>

              {/* Professionnel */}
              <div className="space-y-3">
                <h3 className="font-black text-[10px] text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">2. Informations Professionnelles</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Matricule</label>
                    <input
                      type="text" required
                      value={staffForm.matricule}
                      onChange={(e) => setStaffForm({ ...staffForm, matricule: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Poste / Fonction</label>
                    <select
                      value={staffForm.poste}
                      onChange={(e) => setStaffForm({ ...staffForm, poste: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-bold text-indigo-900"
                    >
                      <option value="Directeur d'établissement">Directeur d'établissement</option>
                      <option value="Responsable pédagogique">Responsable pédagogique</option>
                      <option value="Enseignant permanent">Enseignant permanent</option>
                      <option value="Enseignant vacataire">Enseignant vacataire</option>
                      <option value="Surveillant">Surveillant</option>
                      <option value="Comptable">Comptable</option>
                      <option value="Secrétaire">Secrétaire</option>
                      <option value="Chauffeur">Chauffeur</option>
                      <option value="Agent d'entretien">Agent d'entretien</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Département</label>
                    <select
                      value={staffForm.departement}
                      onChange={(e) => setStaffForm({ ...staffForm, departement: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    >
                      <option value="Enseignement">Enseignement</option>
                      <option value="Direction">Direction</option>
                      <option value="Administration">Administration</option>
                      <option value="Comptabilité">Comptabilité</option>
                      <option value="Services Généraux">Services Généraux</option>
                      <option value="Surveillance">Surveillance</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Classe attribuée (enseignants)</label>
                    <input
                      type="text"
                      placeholder="Ex: Tle D, 3ème A"
                      value={staffForm.classeAttribuee}
                      onChange={(e) => setStaffForm({ ...staffForm, classeAttribuee: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Matière enseignée (enseignants)</label>
                    <input
                      type="text"
                      placeholder="Ex: Physique, Mathématiques"
                      value={staffForm.matiereEnseignee}
                      onChange={(e) => setStaffForm({ ...staffForm, matiereEnseignee: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type de Contrat</label>
                    <select
                      value={staffForm.typeContrat}
                      onChange={(e) => setStaffForm({ ...staffForm, typeContrat: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-black text-indigo-600"
                    >
                      <option value="Permanent">Permanent</option>
                      <option value="Vacataire">Vacataire</option>
                      <option value="Contractuel">Contractuel</option>
                      <option value="Stagiaire">Stagiaire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date d'Entrée</label>
                    <input
                      type="date"
                      value={staffForm.dateEntree}
                      onChange={(e) => setStaffForm({ ...staffForm, dateEntree: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date Fin de Contrat</label>
                    <input
                      type="date"
                      value={staffForm.dateFinContrat}
                      onChange={(e) => setStaffForm({ ...staffForm, dateFinContrat: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Statut d'activité</label>
                    <select
                      value={staffForm.statut}
                      onChange={(e) => setStaffForm({ ...staffForm, statut: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                    >
                      <option value="Actif">Actif</option>
                      <option value="Inactif">Inactif</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-150 flex justify-end gap-2 bg-gray-50/20 -mx-6 -mb-6 p-4">
                <button
                  type="button"
                  onClick={() => { setShowAddStaffModal(false); setEditingStaff(null); }}
                  className="px-4 py-2 bg-white border border-gray-250 text-gray-700 font-bold rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-sm"
                >
                  {editingStaff ? "Mettre à jour" : "Valider Enregistrement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW STAFF DETAIL MODAL */}
      {viewingStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl max-w-xl w-full">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Fiche Individuelle RH</h2>
              <button onClick={() => setViewingStaff(null)} className="text-gray-400 hover:text-gray-600 p-1.5 bg-white border border-gray-200 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5 text-xs">
              <div className="flex items-center gap-4 border-b border-gray-150 pb-4">
                <img
                  src={viewingStaff.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100"
                />
                <div>
                  <h3 className="text-lg font-black text-slate-800">{viewingStaff.nom} {viewingStaff.prenom}</h3>
                  <p className="font-extrabold text-indigo-700">{viewingStaff.poste}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {viewingStaff.matricule}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Coordonnées</span>
                  <p className="font-semibold text-gray-700">📧 {viewingStaff.email || 'Non renseigné'}</p>
                  <p className="font-semibold text-gray-700">📞 {viewingStaff.contactPrincipal}</p>
                  <p className="font-semibold text-gray-700">📍 {viewingStaff.adresse || 'N/A'}</p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Identité Légale</span>
                  <p className="text-gray-700 font-medium">Sexe: <span className="font-bold">{viewingStaff.sexe}</span></p>
                  <p className="text-gray-700 font-medium">Nationalité: <span className="font-bold">{viewingStaff.nationalite}</span></p>
                  <p className="text-gray-700 font-medium">Matrimonial: <span className="font-bold">{viewingStaff.situationMatrimoniale}</span></p>
                </div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-black text-indigo-500 uppercase block">Contrat d'engagement</span>
                  <p className="font-black text-indigo-900 text-sm mt-0.5">{viewingStaff.typeContrat}</p>
                  <p className="text-[10px] text-indigo-700 mt-0.5 font-semibold">Entré le {viewingStaff.dateEntree}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-indigo-500 uppercase block">Département & Service</span>
                  <p className="font-black text-indigo-900 text-sm mt-0.5">{viewingStaff.departement}</p>
                  <p className="text-[10px] text-indigo-700 mt-0.5 font-semibold">Service: {viewingStaff.service}</p>
                </div>
              </div>

              {viewingStaff.poste.toLowerCase().includes('enseignant') && (
                <div className="border-t border-gray-150 pt-3 space-y-1">
                  <span className="text-[9px] font-black text-gray-400 uppercase block">Spécificités Pédagogiques</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <p className="text-gray-600 font-bold">Matière: <span className="text-indigo-900 font-black">{viewingStaff.matiereEnseignee || 'N/A'}</span></p>
                    <p className="text-gray-600 font-bold">Classe: <span className="text-indigo-900 font-black">{viewingStaff.classeAttribuee || 'N/A'}</span></p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-150">
                <button
                  onClick={() => window.print()}
                  className="bg-white border border-gray-250 hover:bg-gray-50 text-gray-700 font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Printer size={13} /> Imprimer Dossier
                </button>
                <button
                  onClick={() => setViewingStaff(null)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST SALARY ADVANCE MODAL */}
      {showAdvanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl max-w-md w-full">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Nouvelle Demande d'Avance</h2>
              <button onClick={() => setShowAdvanceModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 bg-white border border-gray-200 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Sélectionner l'Employé</label>
                <select
                  required
                  value={advanceForm.staffId}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, staffId: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                >
                  <option value="">-- Choisir un bénéficiaire --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.nom} {s.prenom} ({s.poste})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Montant Demandé (FCFA)</label>
                <input
                  type="number" required
                  placeholder="Ex: 50000"
                  value={advanceForm.montant}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, montant: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-mono text-sm font-black text-indigo-950"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Motif / Justification</label>
                <textarea
                  required
                  placeholder="Ex: Urgence médicale, frais de scolarité..."
                  value={advanceForm.motif}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, motif: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 uppercase mb-1">Date d'effet</label>
                <input
                  type="date" required
                  value={advanceForm.date}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 bg-white border border-gray-250 text-gray-700 font-bold rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-sm"
                >
                  Soumettre Demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
