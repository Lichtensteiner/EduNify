import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp, 
  doc, 
  setDoc,
  deleteDoc,
  updateDoc 
} from 'firebase/firestore';
import { 
  Coins, 
  Calendar, 
  FileText, 
  Printer, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Percent, 
  CreditCard, 
  Layers, 
  Clock, 
  User, 
  BookOpen, 
  X, 
  Filter, 
  Building2, 
  Grid, 
  ListFilter,
  Check,
  TrendingUp,
  Download,
  Notebook
} from 'lucide-react';

interface FeeConfig {
  id: string;
  name: string;
  category: 'registration' | 'tuition' | 'exam' | 'transport' | 'canteen' | 'uniform' | 'activities' | 'custom';
  amount: number;
  periodType: 'annual' | 'monthly';
  periodValue: string; // e.g. "2026-2027" or "Octobre 2026"
  classe: string; // "Toutes" or class name
  niveau: string; // "Toutes" or Level
  filiere: string; // "Toutes" or Branch
  establishmentId: string;
  deadlines: { label: string; dueDate: string; amount: number }[];
  createdAt?: any;
}

interface StudentFeesMgmtProps {
  students: any[];
  allClasses?: any[];
  currentEstablishment: any;
  payments: any[];
  setPayments: React.Dispatch<React.SetStateAction<any[]>>;
}

export const StudentFeesMgmt: React.FC<StudentFeesMgmtProps> = ({
  students,
  allClasses = [],
  currentEstablishment,
  payments,
  setPayments
}) => {
  const { currentUser } = useAuth();
  const currentEstId = currentEstablishment?.id || 'EDU-001';

  // --- STATE ---
  const [feeConfigs, setFeeConfigs] = useState<FeeConfig[]>([]);
  const [selectedTab, setSelectedTab] = useState<'tracker' | 'config' | 'deadlines' | 'past_tx'>('tracker');
  const [loading, setLoading] = useState(false);

  // Filters for Fee Configuration List
  const [configCategoryFilter, setConfigCategoryFilter] = useState<string>('all');
  const [configClassFilter, setConfigClassFilter] = useState<string>('all');

  // Search/Filters for Student tracker
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // New Fee Configuration Form State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newConfig, setNewConfig] = useState({
    name: '',
    category: 'tuition' as FeeConfig['category'],
    amount: '',
    periodType: 'annual' as 'annual' | 'monthly',
    periodValue: '2026-2027',
    classe: 'Toutes',
    niveau: 'Toutes',
    filiere: 'Toutes',
  });
  const [customDeadlines, setCustomDeadlines] = useState<{ label: string; dueDate: string; amount: number }[]>([
    { label: 'Tranche 1 (Acompte)', dueDate: '2026-10-15', amount: 0 },
    { label: 'Tranche 2', dueDate: '2027-01-15', amount: 0 },
  ]);

  // Payment Execution Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeFeeForPayment, setActiveFeeForPayment] = useState<FeeConfig | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'airtel' | 'moov' | 'mtn' | 'orange'>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Receipt Modal State for instant voucher printing
  const [receiptPayment, setReceiptPayment] = useState<any | null>(null);

  // --- RECOVERY/PRESETS DATA FOR BULLETPROOF RUN ---
  const DEFAULT_FEE_CONFIGS: FeeConfig[] = [
    {
      id: "preset-reg",
      name: "Frais d'inscription de base",
      category: "registration",
      amount: 45000,
      periodType: "annual",
      periodValue: "2026-2027",
      classe: "Toutes",
      niveau: "Toutes",
      filiere: "Toutes",
      establishmentId: currentEstId,
      deadlines: [{ label: "À l'inscription", dueDate: "2026-09-30", amount: 45000 }]
    },
    {
      id: "preset-tuition-prim",
      name: "Scolarité Annuelle Primaire",
      category: "tuition",
      amount: 320000,
      periodType: "annual",
      periodValue: "2026-2027",
      classe: "Toutes",
      niveau: "Toutes",
      filiere: "Toutes",
      establishmentId: currentEstId,
      deadlines: [
        { label: "Tranche 1 (Rentrée)", dueDate: "2026-10-10", amount: 160000 },
        { label: "Tranche 2 (Janvier)", dueDate: "2027-01-15", amount: 160000 }
      ]
    },
    {
      id: "preset-exam-9",
      name: "Inscriptions d'Examen BEPC/BAC",
      category: "exam",
      amount: 15000,
      periodType: "annual",
      periodValue: "2026-2027",
      classe: "Toutes",
      niveau: "Toutes",
      filiere: "Toutes",
      establishmentId: currentEstId,
      deadlines: [{ label: "Clôture d'inscription", dueDate: "2026-11-30", amount: 15000 }]
    },
    {
      id: "preset-canteen-monthly",
      name: "Cantine mensuelle",
      category: "canteen",
      amount: 25000,
      periodType: "monthly",
      periodValue: "Octobre 2026",
      classe: "Toutes",
      niveau: "Toutes",
      filiere: "Toutes",
      establishmentId: currentEstId,
      deadlines: [{ label: "Début de mois", dueDate: "2026-10-05", amount: 25000 }]
    }
  ];

  // --- LOADER FOR CONFIGURATIONS ---
  useEffect(() => {
    const qFee = query(collection(db, 'fee_configurations'), where('establishmentId', '==', currentEstId));
    const unsubscribe = onSnapshot(qFee, (snap) => {
      if (!snap.empty) {
        setFeeConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeConfig)));
      } else {
        // Fallback to presets or local storage
        const local = localStorage.getItem(`fee_configs_${currentEstId}`);
        if (local) {
          setFeeConfigs(JSON.parse(local));
        } else {
          setFeeConfigs(DEFAULT_FEE_CONFIGS);
          localStorage.setItem(`fee_configs_${currentEstId}`, JSON.stringify(DEFAULT_FEE_CONFIGS));
        }
      }
    }, (err) => {
      console.warn("Fee configurations fetch restricted, utilizing fallback cache.", err);
      const local = localStorage.getItem(`fee_configs_${currentEstId}`);
      if (local) setFeeConfigs(JSON.parse(local));
      else setFeeConfigs(DEFAULT_FEE_CONFIGS);
    });

    return () => unsubscribe();
  }, [currentEstId]);

  // Handle custom dynamic deadline splitting
  useEffect(() => {
    const amt = parseFloat(newConfig.amount) || 0;
    if (amt > 0) {
      if (newConfig.periodType === 'monthly') {
        setCustomDeadlines([
          { label: 'Paiement Unique Mensuel', dueDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-05`, amount: amt }
        ]);
      } else {
        // Set standard 50-50 splitting as helpers
        setCustomDeadlines([
          { label: 'Tranche 1 (Acompte)', dueDate: '2026-10-15', amount: Math.floor(amt * 0.5) },
          { label: 'Tranche 2', dueDate: '2027-01-15', amount: Math.ceil(amt * 0.5) },
        ]);
      }
    }
  }, [newConfig.amount, newConfig.periodType]);

  // --- CORE LOGIC METHODS ---

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(newConfig.amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      alert("Le montant doit être supérieur à zéro.");
      return;
    }

    const totalDeadlineAmt = customDeadlines.reduce((sum, d) => sum + d.amount, 0);
    if (totalDeadlineAmt !== amtNum) {
      const confirmForce = window.confirm(
        `Le total des échéances (${totalDeadlineAmt.toLocaleString()} FCFA) ne correspond pas au montant global (${amtNum.toLocaleString()} FCFA). Voulez-vous ajuster automatiquement la première échéance ?`
      );
      if (confirmForce) {
        const adjusted = [...customDeadlines];
        const diff = amtNum - adjusted.slice(1).reduce((sum, d) => sum + d.amount, 0);
        adjusted[0].amount = diff;
        setCustomDeadlines(adjusted);
        return;
      } else {
        return;
      }
    }

    try {
      setLoading(true);
      const confData: Omit<FeeConfig, 'id'> = {
        name: newConfig.name,
        category: newConfig.category,
        amount: amtNum,
        periodType: newConfig.periodType,
        periodValue: newConfig.periodValue,
        classe: newConfig.classe,
        niveau: newConfig.niveau,
        filiere: newConfig.filiere,
        establishmentId: currentEstId,
        deadlines: customDeadlines
      };

      // Add to Firestore
      const docRef = await addDoc(collection(db, 'fee_configurations'), confData);
      
      const updated = [...feeConfigs, { id: docRef.id, ...confData }];
      setFeeConfigs(updated);
      localStorage.setItem(`fee_configs_${currentEstId}`, JSON.stringify(updated));

      // Reset form Form
      setNewConfig({
        name: '',
        category: 'tuition',
        amount: '',
        periodType: 'annual',
        periodValue: '2026-2027',
        classe: 'Toutes',
        niveau: 'Toutes',
        filiere: 'Toutes',
      });
      setShowConfigModal(false);
      alert("Configuration de frais créée et imputée avec succès !");
    } catch (err: any) {
      console.error("Error creating fee config in Firestore:", err);
      // Fallback local save
      const localId = `local-${Date.now()}`;
      const updated = [...feeConfigs, { id: localId, name: newConfig.name, category: newConfig.category, amount: amtNum, periodType: newConfig.periodType, periodValue: newConfig.periodValue, classe: newConfig.classe, niveau: newConfig.niveau, filiere: newConfig.filiere, establishmentId: currentEstId, deadlines: customDeadlines }];
      setFeeConfigs(updated);
      localStorage.setItem(`fee_configs_${currentEstId}`, JSON.stringify(updated));
      setShowConfigModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce tarif ? Les trackers de paiement associés devront se calibrer sur d'autres tarifs.")) return;
    try {
      await deleteDoc(doc(db, 'fee_configurations', id));
      const updated = feeConfigs.filter(f => f.id !== id);
      setFeeConfigs(updated);
      localStorage.setItem(`fee_configs_${currentEstId}`, JSON.stringify(updated));
    } catch (err) {
      console.warn("Firestore delete restricted, updating local cache", err);
      const updated = feeConfigs.filter(f => f.id !== id);
      setFeeConfigs(updated);
      localStorage.setItem(`fee_configs_${currentEstId}`, JSON.stringify(updated));
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !activeFeeForPayment) return;
    const payAmtNum = parseFloat(paymentAmount);
    if (isNaN(payAmtNum) || payAmtNum <= 0) {
      alert("Le montant à régler doit être strictement positif.");
      return;
    }

    try {
      setLoading(true);
      const uniqueRef = paymentRef || `REÇU-${activeFeeForPayment.category.substring(0,3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const newPaymentDoc = {
        studentId: selectedStudent.id,
        studentName: `${selectedStudent.prenom || ''} ${selectedStudent.nom || ''}`.trim(),
        amount: payAmtNum,
        type: (['tuition', 'registration', 'canteen', 'transport'].includes(activeFeeForPayment.category) ? activeFeeForPayment.category : 'other') as any,
        status: 'paid' as const,
        date: paymentDate,
        method: paymentMethod,
        reference: uniqueRef,
        notes: paymentNotes || `Règlement partiel/échelonné de : ${activeFeeForPayment.name}`,
        recordedBy: currentUser?.id || 'comptable',
        recordedByName: currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : 'Comptable Principal',
        etablissement: currentEstId,
        feeConfigId: activeFeeForPayment.id // Link reference!
      };

      // Add document to main payments collection
      const docRef = await addDoc(collection(db, 'payments'), newPaymentDoc);
      const fullPaymentWithId = { id: docRef.id, ...newPaymentDoc };
      
      // Update local context payments
      setPayments(prev => [fullPaymentWithId, ...prev]);

      // Open Voucher Receipt Modal for the Accountant
      setReceiptPayment(fullPaymentWithId);

      // Clean up inputs
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
    } catch (err) {
      console.error("Error creating payment:", err);
      // Fallback manual local store insertion
      const localId = `pay-local-${Date.now()}`;
      const dummyObj = {
        id: localId,
        studentId: selectedStudent.id,
        studentName: `${selectedStudent.prenom || ''} ${selectedStudent.nom || ''}`.trim(),
        amount: payAmtNum,
        type: (['tuition', 'registration', 'canteen', 'transport'].includes(activeFeeForPayment.category) ? activeFeeForPayment.category : 'other') as any,
        status: 'paid' as const,
        date: paymentDate,
        method: paymentMethod,
        reference: paymentRef || `REÇU-LCL-${Math.floor(100000 + Math.random() * 900000)}`,
        notes: paymentNotes || `Règlement : ${activeFeeForPayment.name}`,
        recordedBy: 'comptable',
        recordedByName: 'Comptable Principal',
        etablissement: currentEstId,
        feeConfigId: activeFeeForPayment.id
      };
      setPayments(prev => [dummyObj, ...prev]);
      setReceiptPayment(dummyObj);
      setShowPaymentModal(false);
    } finally {
      setLoading(false);
    }
  };

  // --- RESOLUTION FORMULAS ---

  // Determine which configurations apply to a student's profile (Rules engine)
  const getApplicableFeesForStudent = (student: any): FeeConfig[] => {
    if (!student) return [];
    return feeConfigs.filter(fee => {
      // Must match establishment
      if (fee.establishmentId !== currentEstId) return false;
      
      // Check level filter
      if (fee.niveau !== 'Toutes') {
        const studentNiveau = (student.niveau || '').toLowerCase();
        const feeNiveau = fee.niveau.toLowerCase();
        if (!studentNiveau.includes(feeNiveau) && !feeNiveau.includes(studentNiveau)) return false;
      }
      
      // Check class filter
      if (fee.classe !== 'Toutes') {
        const studentClasse = (student.classe || '').toLowerCase().trim();
        const feeClasse = fee.classe.toLowerCase().trim();
        if (studentClasse !== feeClasse) return false;
      }

      // Check filiere filter
      if (fee.filiere !== 'Toutes') {
        const studentFiliere = (student.filiere || '').toLowerCase().trim();
        const feeFiliere = fee.filiere.toLowerCase().trim();
        if (studentFiliere !== feeFiliere) return false;
      }

      return true;
    });
  };

  // Calculate sum of payments for a specific student & fee config combination
  const getPaidAmountForFee = (studentId: string, fee: FeeConfig): number => {
    // 1. Try matching by designated foreign key id
    const matchIdPayments = payments.filter(p => p.studentId === studentId && p.feeConfigId === fee.id);
    if (matchIdPayments.length > 0) {
      return matchIdPayments.reduce((sum, p) => sum + p.amount, 0);
    }
    
    // 2. Backward compatibility fallback: match by student and payment category
    const categoryFallbackPayments = payments.filter(p => {
      if (p.studentId !== studentId) return false;
      
      // Map main payment types back to fee categories
      const mainType = p.type; // tuition, registration, canteen, transport, other
      const feeCat = fee.category; // registration, tuition, exam, transport, canteen, uniform, activities, custom
      
      if (mainType === 'tuition' && feeCat === 'tuition') return true;
      if (mainType === 'registration' && feeCat === 'registration') return true;
      if (mainType === 'canteen' && feeCat === 'canteen') return true;
      if (mainType === 'transport' && feeCat === 'transport') return true;
      if (mainType === 'other' && !['tuition', 'registration', 'canteen', 'transport'].includes(feeCat)) return true;
      
      return false;
    });

    return categoryFallbackPayments.reduce((sum, p) => sum + p.amount, 0);
  };

  // Quick helper to translate categories nicely
  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'registration': return 'Frais d\'inscription';
      case 'tuition': return 'Frais de scolarité';
      case 'exam': return 'Frais d\'examen';
      case 'transport': return 'Frais de transport';
      case 'canteen': return 'Scolarité Cantine';
      case 'uniform': return 'Uniforme & Tenues';
      case 'activities': return 'Activités scolaires';
      default: return 'Frais Personnalisés / Divers';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'registration': return 'bg-teal-50 border-teal-150 text-teal-700 dark:bg-teal-950/40 dark:border-teal-900 dark:text-teal-400';
      case 'tuition': return 'bg-indigo-50 border-indigo-150 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400';
      case 'exam': return 'bg-purple-50 border-purple-150 text-purple-700 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-400';
      case 'transport': return 'bg-amber-50 border-amber-150 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400';
      case 'canteen': return 'bg-rose-50 border-rose-150 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400';
      case 'uniform': return 'bg-emerald-50 border-emerald-150 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400';
      default: return 'bg-gray-50 border-gray-150 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300';
    }
  };

  // --- DERIVED METRICS FOR MAIN SCREEN BLOCKS ---
  const activeEstablishmentStudents = students.filter(s => s.etablissement === currentEstId);
  
  // Calculate general financial stats for this module
  const statsOverview = (() => {
    let globalExpected = 0;
    let globalPaid = 0;

    activeEstablishmentStudents.forEach(student => {
      const studentFees = getApplicableFeesForStudent(student);
      studentFees.forEach(fee => {
        globalExpected += fee.amount;
        globalPaid += getPaidAmountForFee(student.id, fee);
      });
    });

    const pending = globalExpected - globalPaid;
    const rate = globalExpected > 0 ? (globalPaid / globalExpected) * 100 : 0;

    return {
      expected: globalExpected,
      paid: globalPaid,
      pending,
      rate
    };
  })();

  // Filter Configurations list
  const filteredConfigs = feeConfigs.filter(f => {
    if (configCategoryFilter !== 'all' && f.category !== configCategoryFilter) return false;
    if (configClassFilter !== 'all' && f.classe !== configClassFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header section with KPIs */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-slate-700">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-widest">ECOLE & COMPTABILITE</span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-widest">OHADA ECO</span>
            </div>
            <h1 className="text-xl font-bold uppercase tracking-tight">Configuration & Gestion de la Scolarité</h1>
            <p className="text-xs text-gray-400 mt-1">
              Pilotez les catégories de frais de scolarité, gérez les échéanciers par classe/filière, encaissez les versements échelonnés et suivez les reliquats d'impayés en temps réel.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setNewConfig(prev => ({ ...prev, amount: '' }));
                setShowConfigModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-bold uppercase text-[10px] flex items-center gap-1.5 shadow-md shadow-indigo-900/40"
            >
              <Plus size={14} />
              Définir un Nouveau Tarif
            </button>
          </div>
        </div>

        {/* Dynamic statistics overview panel */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="p-3.5 bg-slate-850/60 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Montant Global Attendu</p>
            <p className="text-lg font-black text-white mt-1">{(statsOverview.expected).toLocaleString()} <span className="text-[10px] text-slate-400 font-extrabold font-mono">FCFA</span></p>
          </div>
          <div className="p-3.5 bg-slate-850/60 rounded-xl border border-slate-800">
            <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest">Total Déjà Encaissé</p>
            <p className="text-lg font-black text-emerald-400 mt-1">{(statsOverview.paid).toLocaleString()} <span className="text-[10px] font-mono">FCFA</span></p>
          </div>
          <div className="p-3.5 bg-slate-850/60 rounded-xl border border-slate-800">
            <p className="text-[10px] text-rose-400 uppercase font-black tracking-widest">Reliquats / Restant Dû</p>
            <p className="text-lg font-black text-rose-400 mt-1">{(statsOverview.pending).toLocaleString()} <span className="text-[10px] font-mono">FCFA</span></p>
          </div>
          <div className="p-3.5 bg-indigo-950/50 rounded-xl border border-indigo-900/55">
            <p className="text-[10px] text-indigo-300 uppercase font-black tracking-widest">Taux d'Épurement</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-lg font-black text-indigo-200">{statsOverview.rate.toFixed(1)}%</p>
              <div className="flex-1 bg-slate-850 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-400 h-full" style={{ width: `${Math.min(100, statsOverview.rate)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tab Bar inside this extra module */}
      <div className="flex border-b border-gray-100 dark:border-gray-750 gap-4">
        {[
          { id: 'tracker', label: '👤 Encaissements & Fiche Élève', icon: User },
          { id: 'config', label: '🛠️ Grille des Tarifs par Classe', icon: Layers },
          { id: 'deadlines', label: '📅 Suivi Échéancier & Impayés', icon: Clock },
          { id: 'past_tx', label: '📊 Historique des Reçus de Scolarité', icon: FileText },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`pb-2 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 px-1 ${
                selectedTab === tab.id 
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 1. STUDENT TRACKER VIEW */}
      {/* ======================================================== */}
      {selectedTab === 'tracker' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-805 rounded-xl border border-gray-150 dark:border-gray-750 p-5 shadow-sm">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Recherche rapide et imputation élève</h2>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Insérez le nom, prénom ou n° matricule de l'élève à débiter..."
                value={studentSearchQuery}
                onChange={(e) => {
                  setStudentSearchQuery(e.target.value);
                  setShowStudentDropdown(true);
                }}
                onFocus={() => setShowStudentDropdown(true)}
                className="pl-10 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
              />

              {/* Autocomplete Dropdown list of students in the chosen establishment */}
              {showStudentDropdown && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-805 border border-gray-150 dark:border-gray-700 rounded-xl shadow-xl divide-y divide-gray-100 dark:divide-gray-750">
                  {(() => {
                    const searchResults = activeEstablishmentStudents.filter(s => {
                      const fullName = `${s.prenom || ''} ${s.nom || ''} ${s.matricule || ''} ${s.classe || ''}`.toLowerCase();
                      const queryClean = studentSearchQuery.toLowerCase().trim();
                      return queryClean === '' || fullName.includes(queryClean);
                    });

                    if (searchResults.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-gray-400">
                          Aucun élève trouvé pour "{studentSearchQuery}". Vérifiez la base de données ou affectez l'établissement.
                        </div>
                      );
                    }

                    return searchResults.slice(0, 10).map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedStudent(s);
                          setStudentSearchQuery(`${s.prenom || ''} ${s.nom || ''}`);
                          setShowStudentDropdown(false);
                        }}
                        className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <p className="font-extrabold text-slate-800 dark:text-slate-100 uppercase">{s.prenom || ''} {s.nom || ''}</p>
                          <p className="text-[10px] text-gray-400 font-mono">Matricule : {s.matricule || 'Non assigné'}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {s.classe && (
                            <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                              {s.classe}
                            </span>
                          )}
                          {s.niveau && (
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] px-2 py-0.5 rounded">
                              {s.niveau}
                            </span>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {selectedStudent && (
              <div className="mt-4 flex items-center justify-between p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-600 text-white font-extrabold rounded-full flex items-center justify-center text-sm uppercase">
                    {(selectedStudent.prenom || 'E')[0]}{(selectedStudent.nom || 'S')[0]}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase">{selectedStudent.prenom} {selectedStudent.nom}</h3>
                    <p className="text-[10px] text-gray-400 font-mono">Matricule : {selectedStudent.matricule || 'N/A'} • Filière : {selectedStudent.filiere || 'Générale'} • Classe : <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedStudent.classe || 'N/A'}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentSearchQuery('');
                  }}
                  className="p-1 px-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-slate-205 dark:hover:bg-slate-700 text-xs font-bold rounded-lg text-gray-500 transition-colors"
                >
                  Effacer la Sélection
                </button>
              </div>
            )}
          </div>

          {selectedStudent ? (
            <div>
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Frais scolaires affectés à cet élève</h2>
              {(() => {
                const applicable = getApplicableFeesForStudent(selectedStudent);
                if (applicable.length === 0) {
                  return (
                    <div className="bg-white dark:bg-gray-805 p-8 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                      <AlertCircle className="mx-auto text-gray-400 mb-2" size={24} />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Aucun tarif n'est configuré pour le profil de cet élève.</p>
                      <p className="text-xs text-gray-400 mt-1">Rendez-vous dans l'onglet "Grille des Tarifs" pour configurer des frais globaux, ou filtrez pour sa classe ({selectedStudent.classe}).</p>
                    </div>
                  );
                }

                return (
                  <div className="grid md:grid-cols-2 gap-6">
                    {applicable.map(fee => {
                      const paid = getPaidAmountForFee(selectedStudent.id, fee);
                      const remaining = fee.amount - paid;
                      const isFullyPaid = remaining <= 0;
                      const percentPaid = Math.min(100, (paid / fee.amount) * 100);

                      return (
                        <div key={fee.id} className="bg-white dark:bg-gray-850 rounded-2xl border border-gray-150 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                          <div className="p-5 border-b border-gray-100 dark:border-gray-750">
                            {/* Card Header Type */}
                            <div className="flex items-center justify-between mb-3">
                              <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getCategoryColor(fee.category)}`}>
                                {getCategoryLabel(fee.category)}
                              </span>
                              <span className="text-[10px] text-gray-400 font-extrabold uppercase bg-gray-50 dark:bg-gray-800 px-2.5 py-0.5 rounded-md">
                                {fee.periodValue}
                              </span>
                            </div>

                            {/* Fee Title & Amount */}
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{fee.name}</h3>
                            <div className="flex items-baseline mt-2 gap-3">
                              <p className="text-xl font-black text-slate-900 dark:text-indigo-300">{fee.amount.toLocaleString()} <span className="text-xs font-extrabold">FCFA</span></p>
                              <span className="text-[10px] font-mono text-gray-400">Total Obligatoire</span>
                            </div>

                            {/* Meter Bar */}
                            <div className="mt-4 space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-gray-400">Avancement des paiements</span>
                                <span className={isFullyPaid ? 'text-emerald-500' : 'text-slate-600 dark:text-slate-300'}>
                                  {percentPaid.toFixed(0)}% réglé
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${isFullyPaid ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                  style={{ width: `${percentPaid}%` }}
                                />
                              </div>
                            </div>

                            {/* Key Financial breakdown */}
                            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-50 dark:border-gray-800 text-xs">
                              <div>
                                <p className="text-[9px] text-gray-400 uppercase font-black">Déjà Réglé</p>
                                <p className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                                  {paid.toLocaleString()} <span className="text-[10px]">FCFA</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-400 uppercase font-black">Restant en Caisse</p>
                                <p className={`font-extrabold text-sm mt-0.5 ${remaining > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                  {remaining.toLocaleString()} <span className="text-[10px]">FCFA</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Installments and Deadlines Section */}
                          <div className="p-4 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-750">
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-2 flex items-center gap-1">
                              <Clock size={11} /> Échéancier de Facturation
                            </p>
                            <div className="space-y-2">
                              {fee.deadlines && fee.deadlines.map((dead, idx) => {
                                // Determine if this specific tranche is partially or fully paid based on cumulative paid
                                let accumBefore = fee.deadlines.slice(0, idx).reduce((sum, d) => sum + d.amount, 0);
                                let coveredAmount = Math.max(0, Math.min(dead.amount, paid - accumBefore));
                                let isTranchePaid = coveredAmount >= dead.amount;
                                let isTranchePartial = coveredAmount > 0 && coveredAmount < dead.amount;

                                return (
                                  <div key={idx} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-150 dark:border-gray-700 shadow-xs">
                                    <div>
                                      <p className="font-bold text-gray-800 dark:text-gray-200">{dead.label}</p>
                                      <p className="text-[9px] text-gray-400">Date limite : {new Date(dead.dueDate).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-mono text-[11px] font-black text-gray-800 dark:text-gray-100">{dead.amount.toLocaleString()} FCFA</p>
                                      <div className="mt-0.5">
                                        {isTranchePaid ? (
                                          <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 text-[8px] font-black uppercase px-2 py-0.5 rounded block text-center border border-emerald-100/50 dark:border-emerald-900/40">PAYÉ / SOLDÉ</span>
                                        ) : isTranchePartial ? (
                                          <span className="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 text-[8px] font-black uppercase px-2 py-0.5 rounded block text-center border border-amber-100/50 dark:border-amber-900/40">PARTIEL : -{(dead.amount - coveredAmount).toLocaleString()}</span>
                                        ) : (
                                          <span className="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-[8px] font-black uppercase px-2 py-0.5 rounded block text-center border border-rose-100/50 dark:border-rose-900/40">A PAYER (REF : DU)</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Action Bottom Section */}
                          <div className="p-4 bg-white dark:bg-gray-850 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 italic">
                              Enregistré sous OHADA Classe 7
                            </span>
                            
                            <button
                              disabled={isFullyPaid}
                              onClick={() => {
                                setActiveFeeForPayment(fee);
                                setPaymentAmount(String(remaining));
                                setPaymentNotes(`Règlement pour : ${fee.name} de l'élève ${selectedStudent.prenom} ${selectedStudent.nom}`);
                                setShowPaymentModal(true);
                              }}
                              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                                isFullyPaid 
                                  ? 'bg-emerald-50 text-emerald-500 border border-emerald-200 cursor-not-allowed dark:bg-emerald-950/45 dark:border-emerald-900' 
                                  : 'bg-indigo-650 hover:bg-indigo-750 text-white shadow-sm hover:shadow-md'
                              }`}
                            >
                              {isFullyPaid ? 'Intégralement Soldé ✓' : 'Saisir un Encaissement'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-805 p-12 text-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 select-none">
              <User className="mx-auto text-indigo-500 mb-3 animate-pulse" size={32} />
              <h3 className="text-sm font-black text-slate-805 dark:text-white uppercase">Sélectionnez un élève pour encaisser</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                La recherche prend en charge le prénom, le nom de famille ou la classe de l'élève. Sélectionnez un élève pour visualiser sa balance de scolarité personnalisée et générer des reçus sécurisés.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CONFIGURATIONS GRIDS VIEW */}
      {/* ======================================================== */}
      {selectedTab === 'config' && (
        <div className="space-y-4">
          {/* Quick Config Filter header */}
          <div className="bg-white dark:bg-gray-805 rounded-xl border border-gray-150 dark:border-gray-750 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold uppercase">
                <Filter size={14} /> Filtrer les Tarifs :
              </div>
              <select
                value={configCategoryFilter}
                onChange={(e) => setConfigCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="all">Toutes Catégories</option>
                <option value="registration">Frais d'inscription</option>
                <option value="tuition">Scolarité d'Enseignement</option>
                <option value="exam">Frais d'examen</option>
                <option value="transport">Transport scolaire</option>
                <option value="canteen">Scolarité Cantine</option>
                <option value="uniform">Uniforme & Tenues</option>
                <option value="activities">Activités parascolaires</option>
                <option value="custom">Autres Frais</option>
              </select>

              <select
                value={configClassFilter}
                onChange={(e) => setConfigClassFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="all">Toutes Classes</option>
                <option value="Toutes">Globale / Toutes Classes</option>
                {allClasses.map(c => (
                  <option key={c.id} value={c.nom || c.id}>{c.nom || c.id}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setNewConfig(prev => ({ ...prev, amount: '' }));
                setShowConfigModal(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-lg transition-all text-xs font-black uppercase flex items-center gap-1"
            >
              <Plus size={13} /> Nouveau Tarif
            </button>
          </div>

          {/* Cards Display Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConfigs.map(fee => (
              <div key={fee.id} className="bg-white dark:bg-gray-805 rounded-xl border border-gray-150 dark:border-gray-750 p-4.5 flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider border ${getCategoryColor(fee.category)}`}>
                      {getCategoryLabel(fee.category)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {fee.periodValue}
                    </span>
                  </div>

                  <h3 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-tight leading-tight">{fee.name}</h3>
                  
                  {/* Scope criteria badge list */}
                  <div className="flex flex-wrap gap-1 mt-2 mb-3">
                    <span className="bg-gray-100 dark:bg-gray-900 text-[8.5px] font-mono text-gray-400 px-1.5 py-0.5 rounded">Classe : {fee.classe}</span>
                    <span className="bg-gray-100 dark:bg-gray-900 text-[8.5px] font-mono text-gray-400 px-1.5 py-0.5 rounded">Niveau : {fee.niveau}</span>
                    <span className="bg-gray-100 dark:bg-gray-900 text-[8.5px] font-mono text-gray-400 px-1.5 py-0.5 rounded">Filière : {fee.filiere}</span>
                  </div>

                  <p className="text-base font-black text-slate-900 dark:text-indigo-400">{fee.amount.toLocaleString()} <span className="text-[10px]">FCFA</span></p>

                  <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
                    <p className="text-[9px] text-gray-400 uppercase font-bold mb-1.5">Tranches d'Échéance :</p>
                    <div className="space-y-1">
                      {fee.deadlines && fee.deadlines.map((d, index) => (
                        <div key={index} className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                          <span>{d.label} :</span>
                          <span className="font-bold">{d.amount.toLocaleString()} FCFA ({new Date(d.dueDate).toLocaleDateString('fr')})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-800 flex justify-end">
                  <button
                    onClick={() => handleDeleteConfig(fee.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg dark:hover:bg-rose-950/20 transition-colors flex items-center gap-1 text-[10px] uppercase font-black"
                  >
                    <Trash2 size={13} />
                    Retirer
                  </button>
                </div>
              </div>
            ))}

            {filteredConfigs.length === 0 && (
              <div className="col-span-full bg-white dark:bg-gray-805 p-12 text-center rounded-xl border border-dashed text-gray-400">
                Aucune configuration de scolarité ne correspond aux critères de filtre.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. DEADLINES & OUTSTANDING VIEW */}
      {/* ======================================================== */}
      {selectedTab === 'deadlines' && (
        <div className="bg-white dark:bg-gray-805 rounded-xl border border-gray-150 dark:border-gray-750 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-850">
            <h2 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Contrôle des Impayés & Épuration des tranches</h2>
            <p className="text-[10.5px] text-gray-450 mt-0.5">Retrouvez la liste complète des élèves redevables d'un solde de scolarité ou de frais annexes au sein de l'établissement principal.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-400 uppercase font-black tracking-widest text-[9.5px] border-b border-slate-205 dark:border-slate-800">
                  <th className="px-5 py-3">Élève & Classe</th>
                  <th className="px-5 py-3">Frais Applicables</th>
                  <th className="px-5 py-3">Montant Requis</th>
                  <th className="px-5 py-3 text-emerald-600">Total Encaissé</th>
                  <th className="px-5 py-3 text-rose-500">Montant Restant Dû</th>
                  <th className="px-5 py-3">Taux de Recouvrement</th>
                  <th className="px-5 py-3 text-center">Statut Global</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(() => {
                  let debtorCount = 0;
                  const rows = activeEstablishmentStudents.map(student => {
                    const applicable = getApplicableFeesForStudent(student);
                    if (applicable.length === 0) return null;

                    return applicable.map(fee => {
                      const paid = getPaidAmountForFee(student.id, fee);
                      const remaining = fee.amount - paid;
                      
                      if (remaining <= 0) return null; // No debt

                      debtorCount++;
                      const percent = (paid / fee.amount) * 100;

                      return (
                        <tr key={`${student.id}-${fee.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-extrabold text-slate-800 dark:text-gray-100 uppercase">{student.prenom} {student.nom}</p>
                            <p className="text-[9.5px] text-gray-400 font-mono">Classe : <span className="font-bold text-indigo-500">{student.classe || 'N/A'}</span></p>
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-bold text-gray-700 dark:text-gray-350">{fee.name}</span>
                          </td>
                          <td className="px-5 py-3 font-mono font-bold">{fee.amount.toLocaleString()} FCFA</td>
                          <td className="px-5 py-3 font-mono font-bold text-emerald-600">{paid.toLocaleString()} FCFA</td>
                          <td className="px-5 py-3 font-mono font-black text-rose-500">{remaining.toLocaleString()} FCFA</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-bold">{percent.toFixed(0)}%</span>
                              <div className="w-16 bg-gray-100 dark:bg-gray-750 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-600 h-full" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
                                setSelectedTab('tracker');
                                setTimeout(() => {
                                  // Open direct trigger
                                  setActiveFeeForPayment(fee);
                                  setPaymentAmount(String(remaining));
                                  setPaymentNotes(`Règlement de régularisation pour : ${fee.name}`);
                                  setShowPaymentModal(true);
                                }, 150);
                              }}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900 rounded-lg text-[9.5px] font-black uppercase transition-colors"
                            >
                              Relancer / Encaisser
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  }).flat().filter(Boolean);

                  if (debtorCount === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                          Parfait ! Aucun élève n'accuse de retard d'impayé ou de reliquat de scolarité pour le moment.
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. PAST PAYMENTS JOURNAL HISTORY */}
      {/* ======================================================== */}
      {selectedTab === 'past_tx' && (
        <div className="bg-white dark:bg-gray-805 rounded-xl border border-gray-150 dark:border-gray-750 shadow-sm overflow-hidden text-xs">
          <div className="p-4 border-b border-gray-100 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-850 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Journal des encaissements scolarité</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Historique complet des ordonnances et factures libératoires émises par la caisse.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-400 uppercase font-black tracking-widest text-[9px] border-b border-gray-200 dark:border-gray-800">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Référence / Reçu</th>
                  <th className="px-5 py-3">Élève</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3">Explications</th>
                  <th className="px-5 py-3 text-right">Montant Réglé</th>
                  <th className="px-5 py-3 text-center">Bordereau PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(() => {
                  // Only filter payments related to active establishment and fee profiles
                  const feePayments = payments.filter(p => p.etablissement === currentEstId);
                  if (feePayments.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                          Aucun encaissement scolarité enregistré pour cet exercice.
                        </td>
                      </tr>
                    );
                  }

                  return feePayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-[10.5px] text-gray-500 whitespace-nowrap">
                        {new Date(p.date?.seconds ? p.date.seconds * 1000 : p.date).toLocaleDateString('fr-FR', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono bg-indigo-50/50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded text-[10px] font-bold border border-indigo-150/50">
                          {p.reference || 'REF-N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-extrabold uppercase text-slate-800 dark:text-slate-250">
                        {p.studentName || 'Élève inconnu'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-[9.5px] uppercase font-bold">
                          {p.method}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-405 italic truncate max-w-xs">
                        {p.notes || 'Versement'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-black text-gray-900 dark:text-emerald-400 text-sm">
                        {p.amount?.toLocaleString()} <span className="text-[10px]">FCFA</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => setReceiptPayment(p)}
                          className="p-1 px-2.5 bg-gray-50 hover:bg-slate-205 dark:bg-gray-800 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white rounded-lg border border-gray-200 dark:border-gray-700 text-[10px] font-bold transition-all flex items-center gap-1 mx-auto"
                        >
                          <Printer size={11} /> Reçu
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL : CREATE CONFIGURATION OF FEE */}
      {/* ======================================================== */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-805 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-150 dark:border-gray-750 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 dark:border-gray-750 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850">
              <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-600" />
                Définition de Tarif de Scolarité
              </h3>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateConfig} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Désignation du tarif <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="EX: Scolarité Terminale S1, Inscription Maternelle..."
                  value={newConfig.name}
                  onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Catégorie de Frais <span className="text-rose-500">*</span></label>
                  <select
                    value={newConfig.category}
                    onChange={(e) => setNewConfig({ ...newConfig, category: e.target.value as any })}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="registration">Frais d'inscription</option>
                    <option value="tuition">Frais de scolarité</option>
                    <option value="exam">Frais d'examen</option>
                    <option value="transport">Frais de transport</option>
                    <option value="canteen">Frais de cantine</option>
                    <option value="uniform">Frais d'uniforme / canut</option>
                    <option value="activities">Activités scolaires</option>
                    <option value="custom">Frais personnalisé</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Montant Intégral (FCFA) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    required
                    placeholder="EX: 280000"
                    value={newConfig.amount}
                    onChange={(e) => setNewConfig({ ...newConfig, amount: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Périodicité <span className="text-rose-500">*</span></label>
                  <select
                    value={newConfig.periodType}
                    onChange={(e) => setNewConfig({ ...newConfig, periodType: e.target.value as any })}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="annual">Annuelle / Scolaire</option>
                    <option value="monthly">Mensuel (Mois)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Valeur de la Période <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder={newConfig.periodType === 'monthly' ? 'Ex: Octobre 2026' : 'Ex: 2026-2027'}
                    value={newConfig.periodValue}
                    onChange={(e) => setNewConfig({ ...newConfig, periodValue: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="border-t border-dashed border-gray-100 dark:border-gray-750 pt-3">
                <p className="font-extrabold text-[10px] text-indigo-600 dark:text-indigo-400 mb-2 uppercase">Configuration de l'Échéancier / Tranches de Paiements</p>
                
                <div className="space-y-2">
                  {customDeadlines.map((deadline, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-gray-50/50 dark:bg-gray-900 p-2 rounded-xl border border-gray-150 dark:border-gray-750">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={deadline.label}
                          placeholder={`Echéance ${idx + 1}`}
                          onChange={(e) => {
                            const updated = [...customDeadlines];
                            updated[idx].label = e.target.value;
                            setCustomDeadlines(updated);
                          }}
                          className="w-full bg-transparent font-bold outline-none text-gray-950 dark:text-white py-0.5 border-b border-transparent hover:border-gray-300"
                        />
                      </div>
                      <div className="w-28 text-right">
                        <input
                          type="number"
                          value={deadline.amount || ''}
                          placeholder="Montant FCFA"
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = [...customDeadlines];
                            updated[idx].amount = val;
                            setCustomDeadlines(updated);
                          }}
                          className="w-full text-right bg-transparent outline-none font-mono font-bold text-gray-950 dark:text-white hover:border-gray-300 border-b border-transparent"
                        />
                      </div>
                      <div className="w-28">
                        <input
                          type="date"
                          value={deadline.dueDate}
                          onChange={(e) => {
                            const updated = [...customDeadlines];
                            updated[idx].dueDate = e.target.value;
                            setCustomDeadlines(updated);
                          }}
                          className="w-full text-right bg-transparent outline-none font-mono text-[10px]"
                        />
                      </div>
                      {customDeadlines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomDeadlines(customDeadlines.filter((_, i) => i !== idx));
                          }}
                          className="p-1 hover:bg-rose-100 rounded-lg text-rose-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomDeadlines([...customDeadlines, { 
                        label: `Tranche ${customDeadlines.length + 1}`, 
                        dueDate: '2027-01-01', 
                        amount: 0 
                      }]);
                    }}
                    className="mt-2.5 py-1 px-3 text-[10px] bg-slate-150 hover:bg-slate-205 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-indigo-650 dark:text-indigo-400 flex items-center gap-1 mx-auto"
                  >
                    <Plus size={12} /> Ajouter une Échéance / Tranche
                  </button>
                </div>
              </div>

              {/* Advanced rules targets tags filter */}
              <div className="grid grid-cols-3 gap-2.5 border-t border-gray-100 dark:border-gray-750 pt-3">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">Classe Cible</label>
                  <select
                    value={newConfig.classe}
                    onChange={(e) => setNewConfig({ ...newConfig, classe: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-1.5 px-2"
                  >
                    <option value="Toutes">Toutes</option>
                    {allClasses.map(c => (
                      <option key={c.id} value={c.nom || c.id}>{c.nom || c.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">Niveau Cible</label>
                  <select
                    value={newConfig.niveau}
                    onChange={(e) => setNewConfig({ ...newConfig, niveau: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-1.5 px-2"
                  >
                    <option value="Toutes">Tous les niveaux</option>
                    <option value="Maternelle">Maternelle</option>
                    <option value="Primaire">Primaire</option>
                    <option value="Collège">Collège</option>
                    <option value="Lycée">Lycée</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">Filière Cible</label>
                  <select
                    value={newConfig.filiere}
                    onChange={(e) => setNewConfig({ ...newConfig, filiere: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-1.5 px-2"
                  >
                    <option value="Toutes">Toutes</option>
                    <option value="S">Scientifique (S)</option>
                    <option value="L">Littéraire (L)</option>
                    <option value="G">Gestion & Eco (G)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold uppercase tracking-wider text-[10px]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl font-black uppercase tracking-wider text-[10px] disabled:opacity-50"
                >
                  {loading ? 'Imputation en cours...' : 'Enregistrer le Tarif'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL : EXECUTE STUDENT FEE PAYMENT */}
      {/* ======================================================== */}
      {showPaymentModal && activeFeeForPayment && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-805 rounded-2xl w-full max-w-md shadow-2xl border border-gray-150 dark:border-gray-750">
            <div className="p-4 border-b border-gray-100 dark:border-gray-750 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850">
              <h3 className="text-xs font-black text-slate-850 dark:text-white uppercase tracking-widest flex items-center gap-1.5">
                <Coins size={14} className="text-emerald-500" />
                Saisie d'Encaissement de Scolarité
              </h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="p-1 hover:bg-gray-205 dark:hover:bg-gray-700 rounded-full text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4 text-xs font-sans">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-3 rounded-xl space-y-1">
                <p className="text-[9.5px] text-gray-400 font-extrabold uppercase tracking-wide">Élève Bénéficiaire</p>
                <p className="font-extrabold text-indigo-750 dark:text-indigo-400 text-xs uppercase">{selectedStudent.prenom} {selectedStudent.nom}</p>
                <p className="text-[10px] text-gray-400">Classe : <span className="font-bold">{selectedStudent.classe}</span> • Tarif affecté : <strong>{activeFeeForPayment.name}</strong></p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Montant Versement (FCFA) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="EX: 100000"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold text-gray-900 dark:text-white text-sm"
                />
                <p className="text-[9px] text-gray-400 mt-1 italic">
                  Vous pouvez imputer un versement partiel libre, ou le versement intégral.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date Facturation <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Mode de Versement <span className="text-rose-500">*</span></label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="cash">Espèces Directes (Caisse)</option>
                    <option value="transfer">Virement Bancaire (UBA)</option>
                    <option value="card">Carte Bleue (Visa/MC)</option>
                    <option value="airtel">Airtel Money</option>
                    <option value="moov">Moov Money / Flooz</option>
                    <option value="orange">Orange Money</option>
                    <option value="mtn">MTN Mobile Money</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">N° de Référence de la transaction (Optionnel)</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="EX: TG-836B-2026, CHQ-758, etc."
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none font-mono tracking-widest text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Notes administratives sur le bordereau</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Notes imprimables à destination des parents..."
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2 px-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-950 dark:text-white"
                />
              </div>

              <div className="pt-3 flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-205 text-gray-700 rounded-xl font-bold uppercase text-[10px]"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[10px] disabled:opacity-40"
                >
                  {loading ? 'Passage en Écritures...' : 'Valider l\'Encaissement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PRINT RECEIPT POPUP (MODERN INVOICE VOUCHER) */}
      {/* ======================================================== */}
      {receiptPayment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 relative">
            <button 
              onClick={() => setReceiptPayment(null)}
              className="absolute right-4 top-4 p-1 hover:bg-slate-100 rounded-full text-slate-400"
            >
              <X size={18} />
            </button>

            {/* Printable Area Wrapper */}
            <div id="school-voucher" className="space-y-4 font-sans text-xs">
              <div className="text-center pb-4 border-b border-dashed border-slate-200">
                <h2 className="text-sm font-black uppercase text-indigo-900">{currentEstablishment?.nom || 'ÉTABLISSEMENT RÈGLEMENTAIRE'}</h2>
                <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">Ministère de l'Éducation Nationale • République Gabonaise / CG</p>
                <p className="text-[9px] text-indigo-650 font-black tracking-widest mt-1">BORDEREAU DE PAIEMENT ACADÉMIQUE</p>
              </div>

              <div className="grid grid-cols-2 text-[10px] gap-2 pt-2 text-slate-600">
                <div>
                  <p className="text-[8px] text-slate-400 uppercase font-black">Référence Pièce</p>
                  <p className="font-mono font-bold text-slate-900">{receiptPayment.reference}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-slate-400 uppercase font-black">Date Valeur</p>
                  <p className="font-mono font-bold text-slate-900">{receiptPayment.date}</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-1 text-[10px] text-slate-700">
                <p className="text-[7.5px] text-slate-400 uppercase font-black">Élève Apprenant</p>
                <p className="font-black text-slate-900 uppercase">{receiptPayment.studentName}</p>
                <p className="text-[8.5px]">Etablissement ID : <span className="font-bold">{receiptPayment.etablissement}</span></p>
              </div>

              <div className="pt-2">
                <div className="flex justify-between font-black text-xs text-slate-800 pb-2 border-b border-dashed border-slate-200">
                  <span>Nature de l'imputation :</span>
                  <span className="uppercase text-indigo-750">{getCategoryLabel(receiptPayment.type)}</span>
                </div>
                
                <div className="flex justify-between items-baseline pt-3 pb-3 bg-indigo-50/50 px-3 rounded-xl mt-2 text-slate-900">
                  <span className="text-[10px] font-bold text-indigo-900 uppercase">Versement Encaissé :</span>
                  <span className="text-lg font-black text-indigo-900 font-mono">{(receiptPayment.amount || 0).toLocaleString()} FCFA</span>
                </div>
              </div>

              <div className="text-[9.5px] text-slate-500 leading-relaxed border-t border-dashed border-slate-200 pt-3 italic">
                <strong>Notes :</strong> {receiptPayment.notes || 'Règlement de scolarité valide.'}
              </div>

              <div className="grid grid-cols-2 text-[8.5px] gap-2 text-slate-400 pt-3 text-center border-t border-neutral-100">
                <div>
                  <p className="font-extrabold uppercase">Le Guichetier / Caissier</p>
                  <p className="text-slate-900 font-bold mt-6">{receiptPayment.recordedByName || 'Comptable Principal'}</p>
                </div>
                <div>
                  <p className="font-extrabold uppercase">Signature & Date</p>
                  <p className="text-[8px] font-mono mt-6">Certifié SAGE 2026</p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setReceiptPayment(null)}
                className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] uppercase transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white font-black rounded-lg text-[10px] uppercase transition-all flex items-center justify-center gap-1 shadow-md shadow-indigo-100"
              >
                <Printer size={12} /> Imprimer Reçu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
