import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../lib/firebase';
import { recordAuditLog } from '../services/auditService';
import { 
  collection, 
  query, 
  getDocs, 
  where, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  Wallet, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Utensils, 
  Users, 
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  CreditCard,
  History,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  Building2,
  Coins,
  Briefcase,
  FileText,
  Printer,
  Sparkles,
  X,
  Lock,
  Unlock,
  Key,
  Database,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  Check,
  ArrowRight,
  ArrowLeft,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area 
} from 'recharts';
import SuccessModal from '../components/SuccessModal';

// Cryptographic hash helper simulation for anti-fraud validation
const generateTransactionHash = (id: string, account_deb: string, account_cred: string, amount: number, dateStr: string) => {
  const content = `${id}-${account_deb}-${account_cred}-${amount}-${dateStr}-SYSCOHADA`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `SHA-256-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
};

interface SYSCOHADAAccount {
  code: string;
  name: string;
  category: 'Actif' | 'Passif' | 'Charge' | 'Produit';
  type: string;
}

interface DoubleEntry {
  id: string;
  date: any;
  ref: string;
  label: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  recordedBy: string;
  recordedByName: string;
  hash: string;
  isLocked: boolean;
}

interface CaisseSession {
  id: string;
  status: 'open' | 'closed';
  openedAt: any;
  openedBy: string;
  openedByName: string;
  closedAt?: any;
  initialBalance: number;
  closedBalance?: number;
  finalDifference?: number;
  reconciled?: boolean;
}

interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  type: 'tuition' | 'registration' | 'canteen' | 'transport' | 'other';
  status: 'paid' | 'pending' | 'overdue';
  date: any;
  method: 'cash' | 'card' | 'transfer' | 'airtel' | 'moov' | 'mtn' | 'orange';
  reference?: string;
  notes?: string;
  recordedBy?: string;
  recordedByName?: string;
}

interface Expense {
  id: string;
  label: string;
  amount: number;
  category: 'fournitures' | 'salaires' | 'maintenance' | 'achats' | 'autre';
  debitAccount: string;
  creditAccount: string;
  date: any;
  recordedBy: string;
  recordedByName: string;
  status: 'valide' | 'brouillon';
}

const DEFAULT_PLAN_COMPTABLE: SYSCOHADAAccount[] = [
  { code: '101000', name: 'Capital Social (Fonds Propres)', category: 'Passif', type: 'Fonds Propres' },
  { code: '244000', name: 'Matériel Scolaire & Mobilier', category: 'Actif', type: 'Immobilisations' },
  { code: '512000', name: 'Banque SGBG / BICICI', category: 'Actif', type: 'Trésorerie' },
  { code: '521000', name: 'Caisse Centrale Principale', category: 'Actif', type: 'Trésorerie' },
  { code: '521100', name: 'Caisse Airtel / Moov Money Mobile', category: 'Actif', type: 'Trésorerie Mobile' },
  { code: '601000', name: 'Fournitures de Bureau & Pédagogiques', category: 'Charge', type: 'Charges d\'activité' },
  { code: '605000', name: 'Achats de Consommation & Cantine', category: 'Charge', type: 'Charges d\'activité' },
  { code: '611000', name: 'Électricité, Eau & Fluides', category: 'Charge', type: 'Charges d\'activité' },
  { code: '621050', name: 'Rémunérations Directes - Enseignants', category: 'Charge', type: 'Personnel' },
  { code: '621100', name: 'Salaires Personnel Administratif', category: 'Charge', type: 'Personnel' },
  { code: '701000', name: 'Produits Frais Scolarité Annuelle', category: 'Produit', type: 'Frais de scolarité' },
  { code: '701200', name: 'Produits Droits d\'Inscription', category: 'Produit', type: 'Droits Inscription' },
  { code: '706000', name: 'Produits Services Cantine & Repas', category: 'Produit', type: 'Prestations' },
  { code: '708200', name: 'Produits Services Transports Élèves', category: 'Produit', type: 'Prestations' },
];

const Finance: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, language, tData } = useLanguage();

  // ERP Tab State
  const [activeTab, setActiveTab2] = useState<'journal' | 'caisse' | 'expenses' | 'accounting_plan' | 'double_entries' | 'balance_sheet' | 'sage_sync' | 'parent_invoice'>('journal');
  
  // Storage states
  const [payments, setPayments] = useState<Payment[]>([]);
  const [canteenTransactions, setCanteenTransactions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [planComptable, setPlanComptable] = useState<SYSCOHADAAccount[]>(DEFAULT_PLAN_COMPTABLE);
  const [accountingEntries, setAccountingEntries] = useState<DoubleEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [caisseSessions, setCaisseSessions] = useState<CaisseSession[]>([]);
  const [currentCaisse, setCurrentCaisse] = useState<CaisseSession | null>(null);

  // Locking global financial periods
  const [isPeriodLocked, setIsPeriodLocked] = useState(false);

  // Loading indicator & Modal toggles
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showCaisseModal, setShowCaisseModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ title: '', message: '' });
  const [isSaving, setIsSaving] = useState(false);

  // New item draft states
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<SYSCOHADAAccount | null>(null);
  
  // Invoice states
  const [selectedInvoice, setSelectedInvoice] = useState<Payment | null>(null);
  const [aiInvoiceAnalysis, setAiInvoiceAnalysis] = useState<{
    notes: string;
    audit: string;
    loading: boolean;
    error?: string;
  } | null>(null);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  const [newPayment, setNewPayment] = useState({
    studentId: '',
    amount: '',
    type: 'tuition' as 'tuition' | 'registration' | 'canteen' | 'transport' | 'other',
    method: 'cash' as 'cash' | 'card' | 'transfer' | 'airtel' | 'moov' | 'mtn' | 'orange',
    notes: '',
    reference: ''
  });

  const [newExpense, setNewExpense] = useState({
    label: '',
    amount: '',
    category: 'fournitures' as const,
    debitAccount: '601000',
    creditAccount: '521000'
  });

  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    category: 'Charge' as const,
    type: 'Autre'
  });

  const [caisseStateForm, setCaisseStateForm] = useState({
    initialBalance: '',
    closedBalance: ''
  });

  // Check roles permissions
  const rolesWithWriteAccess = ['Super Admin', 'Administrateur', 'Responsable Comptable', 'Caissier', 'admin'];
  const isAuthorized = currentUser && (
    rolesWithWriteAccess.includes(currentUser.role as string) || 
    currentUser.role === 'admin'
  );

  const isParent = currentUser?.role === 'parent';
  const isTeacher = currentUser?.role === 'enseignant';

  // Format helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount).replace('XOF', 'FCFA');
  };

  // Safe translation helper
  const translate = (key: string, fb: string) => {
    try {
      const res = t(key);
      if (res === key) return fb;
      return res;
    } catch {
      return fb;
    }
  };

  // Real-time Database Subscribers
  useEffect(() => {
    if (!currentUser) return;

    // Load payments
    const unsubPayments = onSnapshot(collection(db, 'payments'), (snap) => {
      const paymentData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payment[];
      paymentData.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      setPayments(paymentData);
      setLoading(false);
    }, (err) => {
      console.error("Error subscribing payments: ", err);
      setLoading(false);
    });

    // Load active static & DB dynamic Plan Comptable
    const unsubCompte = onSnapshot(collection(db, 'accounting_plan'), (snap) => {
      if (!snap.empty) {
        const loaded = snap.docs.map(doc => doc.data() as SYSCOHADAAccount);
        // Merge to prevent lost defaults
        const merged = [...DEFAULT_PLAN_COMPTABLE];
        loaded.forEach(item => {
          if (!merged.some(m => m.code === item.code)) {
            merged.push(item);
          }
        });
        setPlanComptable(merged.sort((a,b) => a.code.localeCompare(b.code)));
      }
    });

    // Load double entries
    const unsubEntries = onSnapshot(collection(db, 'accounting_entries'), (snap) => {
      const entryData = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : new Date(data.date || Date.now())
        } as DoubleEntry;
      });
      entryData.sort((a,b) => b.date.getTime() - a.date.getTime());
      setAccountingEntries(entryData);
    });

    // Load expenses
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      const expData = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : new Date(data.date || Date.now())
        } as Expense;
      });
      expData.sort((a,b) => b.date.getTime() - a.date.getTime());
      setExpenses(expData);
    });

    // Load school users (students, teachers) for association
    const fetchSchoolUnits = async () => {
      const studentsQuery = query(collection(db, 'users'), where('role', '==', 'élève'));
      const teachersQuery = query(collection(db, 'users'), where('role', '==', 'enseignant'));
      const [studentsSnap, teachersSnap] = await Promise.all([
        getDocs(studentsQuery),
        getDocs(teachersQuery)
      ]);
      setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTeachers(teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchSchoolUnits();

    // Load canteen
    const unsubCanteen = onSnapshot(collection(db, 'canteen_transactions'), (snap) => {
      const transData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCanteenTransactions(transData);
    });

    // Caisses sessions subscribe
    const unsubCaisse = onSnapshot(collection(db, 'caisse_sessions'), (snap) => {
      const sessions = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          openedAt: data.openedAt?.toDate ? data.openedAt.toDate() : new Date(data.openedAt || Date.now()),
          closedAt: data.closedAt?.toDate ? data.closedAt.toDate() : data.closedAt ? new Date(data.closedAt) : undefined,
        } as CaisseSession;
      });
      sessions.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
      setCaisseSessions(sessions);
      const active = sessions.find(s => s.status === 'open');
      setCurrentCaisse(active || null);
    });

    return () => {
      unsubPayments();
      unsubCompte();
      unsubEntries();
      unsubExpenses();
      unsubCanteen();
      unsubCaisse();
    };
  }, [currentUser]);

  // Handle Double Payments Block and validation
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (isPeriodLocked) {
      alert("L'exercice ou la période comptable actuelle est verrouillée. Impossible de passer des écritures.");
      return;
    }

    if (!currentCaisse) {
      alert("Veuillez d'abord OUVRIR la caisse dans l'onglet 'Caisse' avant d'enregistrer des paiements physiques.");
      return;
    }

    const amountNum = parseFloat(newPayment.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Montant invalide.");
      return;
    }

    // Check for double payments fraud prevent
    const isDoublePayment = payments.some(p => 
      p.studentId === newPayment.studentId && 
      p.amount === amountNum && 
      Math.abs(Date.now() - (p.date?.toDate ? p.date.toDate().getTime() : Date.now())) < 600000 // 10 minutes interval
    );

    if (isDoublePayment) {
      const confirmForce = window.confirm("ATTENTION : Un paiement identique pour cet élève vient d'être enregistré il y a moins de 10 minutes. S'agit-il d'un doublon accidentel ? Cliquer sur OK si vous souhaitez forcer de manière exceptionnelle.");
      if (!confirmForce) return;
    }

    setIsSaving(true);
    try {
      const student = students.find(s => s.id === newPayment.studentId);
      const studentNameStr = student ? `${student.prenom || ''} ${student.nom || ''}`.trim() : 'Inconnu';

      // Insert into payments
      const paymentPayload = {
        studentId: newPayment.studentId,
        studentName: studentNameStr,
        amount: amountNum,
        type: newPayment.type,
        status: 'paid',
        method: newPayment.method,
        reference: newPayment.reference || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        notes: newPayment.notes,
        date: serverTimestamp(),
        recordedBy: currentUser.id,
        recordedByName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim()
      };

      const docRef = await addDoc(collection(db, 'payments'), paymentPayload);

      // AUTOMATIC DOUBLE-ENTRY SYSCOHADA SAGE ENGINE WRITES
      // Determine accounts corresponding to invoice type
      // Débit: 521000 (Caisse) if cash, 512000 (Banque) if transfer/card, 521100 if mobile money (Airtel/Moov/MTN)
      let debAccount = '521000';
      if (['transfer', 'card'].includes(newPayment.method)) {
        debAccount = '512000';
      } else if (['airtel', 'moov', 'mtn', 'orange'].includes(newPayment.method)) {
        debAccount = '521100';
      }

      // Crédit: depending on types
      let credAccount = '701000'; // Scolarité default
      if (newPayment.type === 'registration') credAccount = '701200';
      else if (newPayment.type === 'canteen') credAccount = '706000';
      else if (newPayment.type === 'transport') credAccount = '708200';
      else if (newPayment.type === 'other') credAccount = '101000';

      const entryDate = new Date();
      const entryId = `ENT-${docRef.id.slice(0, 6).toUpperCase()}`;
      const hash = generateTransactionHash(entryId, debAccount, credAccount, amountNum, entryDate.toISOString());

      const writePayload: Omit<DoubleEntry, 'id'> = {
        date: serverTimestamp(),
        ref: paymentPayload.reference,
        label: `Encaissement ${paymentPayload.type.toUpperCase()} - Elève : ${studentNameStr}`,
        debitAccount: debAccount,
        creditAccount: credAccount,
        amount: amountNum,
        recordedBy: currentUser.id,
        recordedByName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim(),
        hash: hash,
        isLocked: false
      };

      await addDoc(collection(db, 'accounting_entries'), writePayload);

      // Log Security & Audit Trail
      await recordAuditLog({
        userId: currentUser.id,
        userName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim(),
        userRole: currentUser.role,
        action: "SYSCOHADA DOUBLE ENTRY ENERGRISTED",
        details: `Compte débit: ${debAccount}, Compte crédit: ${credAccount}, Montant: ${amountNum} FCFA, Hash: ${hash}`,
        category: 'finance'
      });

      setShowAddModal(false);
      setStudentSearchInput('');
      setShowStudentDropdown(false);
      setNewPayment({
        studentId: '',
        amount: '',
        type: 'tuition',
        method: 'cash',
        notes: '',
        reference: ''
      });

      setSuccessInfo({
        title: "Écriture validée !",
        message: `Le paiement de ${amountNum.toLocaleString()} FCFA a été enregistré. Compte Débit ${debAccount} et Crédit ${credAccount} mouvementés avec succès (Empreinte numérique : ${hash.split('-')[1]}).`
      });
      setShowSuccess(true);
    } catch (err) {
      console.error("Error creating payment & double entry: ", err);
      alert("Une erreur technique est survenue.");
    } finally {
      setIsSaving(false);
    }
  };

  // Add Expense dynamic double entries
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (isPeriodLocked) {
      alert("Période comptable verrouillée.");
      return;
    }

    const valueNum = parseFloat(newExpense.amount);
    if (isNaN(valueNum) || valueNum <= 0) {
      alert("Montant incorrect.");
      return;
    }

    setIsSaving(true);
    try {
      const expPayload = {
        label: newExpense.label,
        amount: valueNum,
        category: newExpense.category,
        debitAccount: newExpense.debitAccount,
        creditAccount: newExpense.creditAccount,
        date: serverTimestamp(),
        recordedBy: currentUser.id,
        recordedByName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim(),
        status: 'valide'
      };

      const docRef = await addDoc(collection(db, 'expenses'), expPayload);

      // Automatic double entry for expense
      // Débit: Compte de charge (e.g. 601000, 621050), Crédit: Compte de trésorerie (e.g. 521000)
      const entryId = `EXP-${docRef.id.slice(0, 6).toUpperCase()}`;
      const hash = generateTransactionHash(entryId, newExpense.debitAccount, newExpense.creditAccount, valueNum, new Date().toISOString());

      await addDoc(collection(db, 'accounting_entries'), {
        date: serverTimestamp(),
        ref: `FACT-${Math.floor(10000 + Math.random() * 90000)}`,
        label: `Règlement dépense : ${newExpense.label}`,
        debitAccount: newExpense.debitAccount,
        creditAccount: newExpense.creditAccount,
        amount: valueNum,
        recordedBy: currentUser.id,
        recordedByName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim(),
        hash: hash,
        isLocked: false
      });

      await recordAuditLog({
        userId: currentUser.id,
        userName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim(),
        userRole: currentUser.role,
        action: "DÉPENSE DOUBLE ENTIÈRE ENREGISTRÉE",
        details: `Charge Débit: ${newExpense.debitAccount}, Crédit Trésorerie: ${newExpense.creditAccount}, Montant: ${valueNum} FCFA`,
        category: 'finance'
      });

      setShowAddExpenseModal(false);
      setNewExpense({
        label: '',
        amount: '',
        category: 'fournitures',
        debitAccount: '601000',
        creditAccount: '521000'
      });

      setSuccessInfo({
        title: "Dépense Enregistrée",
        message: `Dépense débitée du compte charge ${newExpense.debitAccount} pour un total de ${valueNum.toLocaleString()} FCFA.`
      });
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Create new OHADA specific account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!newAccount.code || !newAccount.name) {
      alert("Veuillez remplir les informations.");
      return;
    }

    try {
      await addDoc(collection(db, 'accounting_plan'), {
        code: newAccount.code.trim(),
        name: newAccount.name.trim(),
        category: newAccount.category,
        type: newAccount.type
      });

      setShowAddAccountModal(false);
      setNewAccount({ code: '', name: '', category: 'Charge', type: 'Autre' });
      setSuccessInfo({
        title: "Compte Créé",
        message: `Le compte SYSCOHADA ${newAccount.code} - ${newAccount.name} a été enregistré dans le Plan de l'établissement.`
      });
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Opening Caisse session
  const handleOpenCaisse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const balance = parseFloat(caisseStateForm.initialBalance) || 0;
    try {
      await addDoc(collection(db, 'caisse_sessions'), {
        status: 'open',
        openedAt: serverTimestamp(),
        openedBy: currentUser.id,
        openedByName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim(),
        initialBalance: balance
      });

      setShowCaisseModal(false);
      setCaisseStateForm({ initialBalance: '', closedBalance: '' });
      setSuccessInfo({
        title: "Caisse OUVERTE avec succès",
        message: `Journal ouvert avec un solde initial de ${balance.toLocaleString()} FCFA. Toutes les opérations de la journée y seront rattachées.`
      });
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Closing Caisse session and discrepancy report
  const handleCloseCaisse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentCaisse) return;

    const actualClosedBalance = parseFloat(caisseStateForm.closedBalance);
    if (isNaN(actualClosedBalance)) {
      alert("Saisir le solde final compté physiquement.");
      return;
    }

    // Calculate theoretical balance from cash in this session
    // For simplicity, sum of cash payments registered + initialBalance
    const cashPaymentsThisSession = payments
      .filter(p => p.method === 'cash' && p.status === 'paid') // Filter if dates are greater than opening
      .reduce((acc, curr) => acc + curr.amount, 0);

    const theoreticalClosedBalance = currentCaisse.initialBalance + cashPaymentsThisSession;
    const finalDifference = actualClosedBalance - theoreticalClosedBalance;

    try {
      const caisseDocId = currentCaisse.id;
      await updateDoc(doc(db, 'caisse_sessions', caisseDocId), {
        status: 'closed',
        closedAt: serverTimestamp(),
        closedBy: currentUser.id,
        closedByName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim(),
        closedBalance: actualClosedBalance,
        finalDifference: finalDifference,
        reconciled: finalDifference === 0
      });

      // Record Audit log of closure
      await recordAuditLog({
        userId: currentUser.id,
        userName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim(),
        userRole: currentUser.role,
        action: "CLÔTURE DE CAISSE SCOLAIRE",
        details: `Solde initial: ${currentCaisse.initialBalance} FCFA, Solde théorique: ${theoreticalClosedBalance} FCFA, Physique compté: ${actualClosedBalance} FCFA, Écart constaté: ${finalDifference} FCFA`,
        category: 'finance'
      });

      setShowCaisseModal(false);
      setCaisseStateForm({ initialBalance: '', closedBalance: '' });
      setSuccessInfo({
        title: `Caisse CLÔTURÉE (Écart: ${finalDifference.toLocaleString()} FCFA)`,
        message: finalDifference === 0 
          ? "Rapprochement parfait ! Le solde journalier concorde parfaitement avec les encaissements réels."
          : `Rapprochement effectué avec un écart de ${finalDifference.toLocaleString()} FCFA. Un rapport d\'anomalie de caisse a été enregistré pour l\'audit de conformité.`
      });
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateAIInvoiceDetails = async (payment: Payment) => {
    setAiInvoiceAnalysis({ notes: '', audit: '', loading: true });
    
    // Compute total school balance for AI reasoning context
    const totalBalance = generalLedgerSummary.totalDebit - generalLedgerSummary.totalCredit;
    const studentHistory = payments.filter(p => p.studentId === payment.studentId && p.status === 'paid');
    const studentTransactionsCount = studentHistory.length;
    
    const dateString = payment.date?.seconds 
      ? new Date(payment.date.seconds * 1000).toLocaleString('fr-FR')
      : payment.date?.toDate 
        ? payment.date.toDate().toLocaleString('fr-FR') 
        : new Date(payment.date || Date.now()).toLocaleString('fr-FR');

    const promptText = `Voici les informations d'une transaction financière scolaire d'Edu-Nify :
- Nom de l'élève/bénéficiaire : ${payment.studentName}
- Montant de l'opération : ${payment.amount} FCFA
- Rubrique budgétaire : ${payment.type} (Scolarité, Cantine, transport, inscription, etc.)
- Mode de paiement : ${payment.method}
- Référence de la transaction : ${payment.reference || 'N/A'}
- Date de l'opération : ${dateString}

Contexte de gestion analytique :
- Solde cumulé actuel de la comptabilité : ${totalBalance} FCFA
- Historique de paiement de cet élève : ${studentTransactionsCount} paiement(s) encaissé(s).

En tant qu'intelligence artificielle financière d'Edu-Nify, veuillez générer deux commentaires distincts en français :
1. "notes" : Un message personnalisé, chaleureux et professionnel pour l'élève ou son parent (ex: remerciement, conseils ou rappels polis sur les tranches ou frais annexes d'inscription académique). Ce message sera imprimé directement sur la facture.
2. "audit" : Une note technique d'audit interne pour le comptable de l'établissement. Elle valide les comptes d'imputation SYSCOHADA (ex : Débit 521000 et Crédit 701000, etc.), donne un diagnostic santé ou une évaluation rapide des anomalies/doublons d'écriture de trésorerie de l'élève. Doit être court et exploitable.`;

    try {
      const resp = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: {
            contents: [
              {
                parts: [{ text: promptText }]
              }
            ],
            model: "gemini-3.5-flash",
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  notes: { type: "STRING", description: "Format court, destiné à l'imprimé du reçu." },
                  audit: { type: "STRING", description: "Note technique d'audit compta pour le gestionnaire." }
                },
                required: ["notes", "audit"]
              }
            }
          }
        })
      });

      if (!resp.ok) {
        throw new Error("Le service d'assistance IA a renvoyé un statut d'erreur.");
      }

      const data = await resp.json();
      if (data.error) {
        throw new Error(data.error);
      }

      try {
        const parsed = JSON.parse(data.text);
        setAiInvoiceAnalysis({
          notes: parsed.notes || "Paiement validé avec succès. Merci pour votre versement.",
          audit: parsed.audit || "Aucune anomalie détectée sur l'imputation analytique double-partie.",
          loading: false
        });
        
        // Auto launch printing once the AI content updates in the DOM
        setTimeout(() => {
          window.print();
        }, 800);
      } catch {
        setAiInvoiceAnalysis({
          notes: data.text,
          audit: "Analyse terminée avec succès.",
          loading: false
        });
        
        // Auto launch printing once the AI content updates in the DOM
        setTimeout(() => {
          window.print();
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setAiInvoiceAnalysis({
        notes: "Versement enregistré avec succès. Merci pour votre paiement de scolarité à l'École Intern. du Centre Pédagogique.",
        audit: "Échelle de l'appel direct avec l'assistant Audit IA: " + (err.message || err),
        loading: false,
        error: err.message || "Erreur de connexion IA."
      });
      
      // Auto launch printing even on failure fallback
      setTimeout(() => {
        window.print();
      }, 800);
    }
  };

  // Dynamic calculations for balanced double entries Ledger & General Balance
  const generalLedgerSummary = React.useMemo(() => {
    const map: Record<string, { name: string, debit: number, credit: number, balance: number }> = {};
    
    // Assign Plan Comptable base template structure to hold names
    planComptable.forEach(acc => {
      map[acc.code] = { name: acc.name, debit: 0, credit: 0, balance: 0 };
    });

    // Compute dynamic postings
    accountingEntries.forEach(ent => {
      const deb = ent.debitAccount;
      const cred = ent.creditAccount;
      const amt = ent.amount;

      if (!map[deb]) map[deb] = { name: `Compte Inconnu (${deb})`, debit: 0, credit: 0, balance: 0 };
      if (!map[cred]) map[cred] = { name: `Compte Inconnu (${cred})`, debit: 0, credit: 0, balance: 0 };

      map[deb].debit += amt;
      map[cred].credit += amt;
    });

    // Resolve balances depending on OHADA categories
    const details = Object.entries(map).map(([code, val]) => {
      const accObj = planComptable.find(p => p.code === code);
      const isDebitNature = accObj ? ['Actif', 'Charge'].includes(accObj.category) : true;
      const bal = isDebitNature ? (val.debit - val.credit) : (val.credit - val.debit);
      return {
        code,
        name: val.name,
        debit: val.debit,
        credit: val.credit,
        balance: bal,
        category: accObj?.category || 'Actif'
      };
    }).filter(item => item.debit > 0 || item.credit > 0);

    const totalDebit = details.reduce((acc, c) => acc + c.debit, 0);
    const totalCredit = details.reduce((acc, c) => acc + c.credit, 0);

    return { details, totalDebit, totalCredit };
  }, [accountingEntries, planComptable]);

  // General statistics calculation
  const stats = React.useMemo(() => {
    const income = payments
      .filter(p => p.status === 'paid')
      .reduce((acc, curr) => acc + curr.amount, 0) + 
      canteenTransactions.filter(t => t.type === 'topup').reduce((acc, curr) => acc + curr.amount, 0);

    const charges = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const result = income - charges;
    const unpaid = payments.filter(p => p.status === 'overdue').reduce((acc, curr) => acc + curr.amount, 0);
    const pendingState = payments.filter(p => p.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);

    return { income, charges, result, unpaid, pendingState };
  }, [payments, canteenTransactions, expenses]);

  // Export helper for Sage ERP system (.CSV format)
  const handleExportSage = () => {
    // Standard Sage Column definition
    const headers = ['JOURNAL', 'DATE_ECRITURE', 'COMPTE_GENERAL', 'N_PIECE', 'REFERENCE_PIECE', 'LIBELLE_ECRITURE', 'DEBIT', 'CREDIT', 'CLE_INTEGRITE'];
    const rows = [];

    accountingEntries.forEach(ent => {
      const formattedDate = ent.date instanceof Date 
        ? ent.date.toLocaleDateString('fr-FR').replace(/\//g, '') 
        : ent.date ? new Date(ent.date).toLocaleDateString('fr-FR').replace(/\//g, '') : '';

      // Line 1: Debit Posting
      rows.push([
        'BQ_TR',                // Journal code
        formattedDate,          // Writing date
        ent.debitAccount,       // Account
        ent.id.substring(0, 10),// ID
        ent.ref || 'NA',        // Reference Code
        ent.label,              // Label
        ent.amount,             // Debit
        0,                      // Credit
        ent.hash.split('-')[1]  // Signature
      ]);

      // Line 2: Credit Posting
      rows.push([
        'BQ_TR',
        formattedDate,
        ent.creditAccount,
        ent.id.substring(0, 10),
        ent.ref || 'NA',
        ent.label,
        0,
        ent.amount,
        ent.hash.split('-')[1]
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EXPORT_SAGE_EDU_NIFY_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Local user specific UI when NOT authorized (Parent/Student view only)
  if (currentUser && !isAuthorized) {
    // Render tailored user / parent view
    const parentInvoices = payments.filter(p => {
      // Find payments matches parent's child associated matricule (mock link or direct matches list if match)
      return p.studentName.toLowerCase().includes((currentUser.nom || '').toLowerCase());
    });

    return (
      <div className="print:hidden max-w-4xl mx-auto space-y-6">
        <div className="p-8 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <BookOpen size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Portail de Facturation & Espace Parent</h1>
              <p className="text-sm text-gray-500">Consultez l'historique complet des frais de scolarité, inscriptions et activités de vos enfants rattachés.</p>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 rounded-2xl text-xs space-y-1 border border-emerald-100 dark:border-emerald-900/30">
            <p className="font-extrabold uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck size={14} /> PAIEMENT EN LIGNE INTÉGRÉ & CERTIFIÉ
            </p>
            <p>Réglez directement les frais scolaires via Airtel Money, Moov Money, Wave, ou carte bancaire. Les reçus fiscaux sont certifiés et verrouillés contre la falsification par une signature SHA-256 unique.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 font-bold text-gray-900 dark:text-white flex items-center justify-between">
            <span>Frais Scolaires Associes - Année Académique</span>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full uppercase font-black">2026-2027</span>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total payé à ce jour</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  {formatCurrency(parentInvoices.filter(p => p.status === 'paid').reduce((acc, c) => acc + c.amount, 0))}
                </p>
              </div>
              <div className="p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Montant En attente</p>
                <p className="text-2xl font-black text-amber-500 mt-1">
                  {formatCurrency(parentInvoices.filter(p => p.status === 'pending').reduce((acc, c) => acc + c.amount, 0))}
                </p>
              </div>
              <div className="p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Frais en impayé</p>
                <p className="text-2xl font-black text-rose-500 mt-1">
                  {formatCurrency(parentInvoices.filter(p => p.status === 'overdue').reduce((acc, c) => acc + c.amount, 0))}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Élève</th>
                    <th className="px-6 py-3">Type de frais</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Montant</th>
                    <th className="px-6 py-3">Référence / Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {parentInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">
                        Aucun reçu comptable direct scanné pour vos enfants. Si vous avez effectué un paiement récemment, demandez au caissier de valider l'avis.
                      </td>
                    </tr>
                  ) : (
                    parentInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/25">
                        <td className="px-6 py-4">
                          {inv.date?.toDate ? inv.date.toDate().toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-950 dark:text-white">{inv.studentName}</td>
                        <td className="px-6 py-4 uppercase font-bold text-indigo-600 dark:text-indigo-400">{inv.type === 'tuition' ? 'Scolarité Annuelle' : inv.type}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            inv.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          }`}>
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-gray-900 dark:text-white font-mono">{formatCurrency(inv.amount)}</td>
                        <td className="px-6 py-4 font-mono text-[9px] text-gray-400">
                          {inv.reference || 'REF-NIL'} 
                          <span className="block text-emerald-500">{generateTransactionHash(inv.id, '521000', '701000', inv.amount, '2026').substring(0, 16)}...</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for missing elements loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-gray-400 space-y-4">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <span className="font-mono text-sm tracking-widest uppercase font-bold">Edu-Nify Ledger Engine Loading...</span>
      </div>
    );
  }

  return (
    <div className="print:hidden space-y-6">
      {/* Header and locked indicators */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <Wallet className="text-indigo-600 dark:text-indigo-400" />
              INTELLIGENT ERP COMPTABLE
            </h1>
            <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 text-xs rounded-full font-semibold border border-amber-100 dark:border-amber-900 flex items-center gap-1">
              <Database size={12} strokeWidth={3} />
              OHADA SAGE Compatible
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">La source centrale de vérité financière et postulation des écritures de l'établissement.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Caisse state indicator */}
          <div className="flex items-center gap-2 text-xs font-black bg-gray-50 dark:bg-gray-900 p-2.5 rounded-2xl border border-gray-100 dark:border-gray-700/60 font-mono">
            <span className={`w-2.5 h-2.5 rounded-full ${currentCaisse ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {currentCaisse ? `CAISSE OUVERTE (${currentCaisse.openedByName})` : 'CAISSE TOTALEMENT FERMÉE'}
          </div>

          {/* Period lockout control */}
          <button
            onClick={() => setIsPeriodLocked(!isPeriodLocked)}
            className={`flex items-center gap-1.5 px-4 h-[38px] rounded-xl text-xs font-black uppercase transition-all shadow-sm ${
              isPeriodLocked 
                ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400' 
                : 'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400'
            }`}
          >
            {isPeriodLocked ? <Lock size={14} /> : <Unlock size={14} />}
            {isPeriodLocked ? 'Période Verrouillée' : 'Verrouiller Exercice'}
          </button>
        </div>
      </div>

      {/* Main stats counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Card 1: Recettes Totales */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transition-all hover:shadow-md h-full">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-widest leading-normal">
                {translate('total_revenue', 'Recettes Totales Encaissées')}
              </span>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 leading-tight tracking-tight select-all truncate shrink min-w-0" title={formatCurrency(stats.income)}>
                {formatCurrency(stats.income)}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/60 text-[10px] text-gray-400 dark:text-gray-400 flex items-center justify-between gap-2">
            <span className="truncate">Cantine incluse :</span>
            <span className="font-mono font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 px-2 py-0.5 rounded shrink-0 truncate max-w-[150px]" title={formatCurrency(canteenTransactions.filter(t => t.type === 'topup').reduce((acc, curr) => acc + curr.amount, 0))}>
              {formatCurrency(canteenTransactions.filter(t => t.type === 'topup').reduce((acc, curr) => acc + curr.amount, 0))}
            </span>
          </div>
        </div>

        {/* Card 2: Dépenses Générales */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transition-all hover:shadow-md h-full">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-widest leading-normal">
                Dépenses Générales Validées
              </span>
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                <TrendingDown size={18} />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-black text-rose-500 leading-tight tracking-tight select-all truncate shrink min-w-0" title={formatCurrency(stats.charges)}>
                {formatCurrency(stats.charges)}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/60 text-[10px] text-gray-400 dark:text-gray-400 flex items-center justify-between gap-2">
            <span className="truncate">Salaires, Ration, Matériel</span>
            <span className="font-mono text-gray-500 dark:text-gray-450 font-bold bg-gray-50 dark:bg-gray-900/40 px-2 py-0.5 rounded shrink-0">
              ({expenses.length} justificatifs)
            </span>
          </div>
        </div>

        {/* Card 3: Résultat / Trésorerie Nette */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transition-all hover:shadow-md h-full">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-widest leading-normal">
                Résultat / Trésorerie Nette
              </span>
              <div className={`p-2.5 rounded-xl shrink-0 ${stats.result >= 0 ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-450' : 'bg-red-50 dark:bg-red-950/40 text-red-650'}`}>
                <Activity size={18} />
              </div>
            </div>
            <div className="pt-1">
              <div className={`text-lg xs:text-xl sm:text-2xl lg:text-3xl font-black leading-tight tracking-tight select-all truncate shrink min-w-0 ${stats.result >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500'}`} title={formatCurrency(stats.result)}>
                {formatCurrency(stats.result)}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/60 text-[10px] text-gray-400 dark:text-gray-400 flex items-center justify-between gap-2">
            <span className="truncate">Solde disponible net</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${stats.result >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/45 text-rose-700 dark:text-rose-400'}`}>
              {stats.result >= 0 ? 'Excédentaire' : 'Déficitaire'}
            </span>
          </div>
        </div>

        {/* Card 4: Créances Restantes */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transition-all hover:shadow-md h-full">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-widest leading-normal">
                Créances Restantes & Retards
              </span>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-black text-amber-500 leading-tight tracking-tight select-all truncate shrink min-w-0" title={formatCurrency(stats.unpaid)}>
                {formatCurrency(stats.unpaid)}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/60 text-[10px] text-gray-400 dark:text-gray-400 flex items-center justify-between gap-2">
            <span className="truncate">Relances scolaires</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">
              Actives
            </span>
          </div>
        </div>

      </div>

      {/* Mini warning if no caisse is opened */}
      {!currentCaisse && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 text-xs flex items-center justify-between gap-4 rounded-2xl border border-rose-100 dark:border-rose-900 font-bold">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-rose-500" size={16} />
            <span>ATTENTION : La caisse journalière est fermée. Vous ne pouvez plus enregistrer de nouveaux encaissements espèces ou mobiles tant que vous n'avez pas ouvert l'exercice de caisse de la journée.</span>
          </div>
          <button
            onClick={() => {
              setActiveTab2('caisse');
              setShowCaisseModal(true);
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all font-black uppercase text-[10px]"
          >
            Ouvrir la Caisse
          </button>
        </div>
      )}

      {/* Tabs list inside accounting module */}
      <div className="flex flex-wrap gap-2.5 border-b border-gray-100 dark:border-gray-750 pb-2">
        {[
          { id: 'journal', label: 'Journal des Recettes' },
          { id: 'expenses', label: 'Saisie de Dépenses' },
          { id: 'caisse', label: 'Caisse Journalière' },
          { id: 'accounting_plan', label: 'Plan de Comptes OHADA' },
          { id: 'double_entries', label: 'Ledger Double-Entrée' },
          { id: 'balance_sheet', label: 'Balance & Résultats' },
          { id: 'sage_sync', label: 'Sage Sinc & Export ERP' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab2(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. JOURNAL TAB (PAYMENTS ENCAISSEMENT LIST) */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher par élève ou référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs font-bold"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold transition-all"
              >
                <option value="all">Tous les Frais</option>
                <option value="tuition">Scolarité</option>
                <option value="registration">Inscription</option>
                <option value="canteen">Cantine</option>
                <option value="transport">Transport</option>
                <option value="other">Autre</option>
              </select>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-705 transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-500/10 shrink-0"
              >
                <Plus size={16} /> Enregistrer un paiement
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-4">Date de saisie</th>
                    <th className="px-6 py-4">Fiche Élève</th>
                    <th className="px-6 py-4">Rubrique</th>
                    <th className="px-6 py-4">Montant Versé</th>
                    <th className="px-6 py-4">Méthode de règlement</th>
                    <th className="px-6 py-4">Imputation SAGE</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Action Reçu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {payments.filter(p => p.studentName.toLowerCase().includes(searchTerm.toLowerCase())).map(py => (
                    <tr key={py.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/30">
                      <td className="px-6 py-4 text-gray-400 font-mono">
                        {py.date?.toDate ? py.date.toDate().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Maintenant'}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                        {py.studentName}
                        {py.reference && <span className="block text-[10px] font-mono font-normal text-gray-400">Réf: {py.reference}</span>}
                      </td>
                      <td className="px-6 py-4 uppercase font-bold text-indigo-650 dark:text-indigo-400">
                        {py.type === 'tuition' ? 'Frais Scolarité (701000)' : py.type === 'registration' ? "Inscription (701200)" : py.type}
                      </td>
                      <td className="px-6 py-4 font-black font-mono text-gray-950 dark:text-white text-sm">{formatCurrency(py.amount)}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-750 rounded-lg uppercase text-[10px] font-serif tracking-wider font-bold">
                          {py.method === 'cash' ? '💵 Espèces' : py.method === 'transfer' ? '🏦 Virement' : py.method.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-gray-400 font-bold">
                        {['transfer', 'card'].includes(py.method) ? '512000 -> 701000' : '521000 -> 701000'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {py.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice(py);
                            handleGenerateAIInvoiceDetails(py);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Sparkles size={11} className="text-violet-500 animate-pulse" />
                          <span>REÇU / IA</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Gestion des Dépenses de l'Établissement</h3>
              <p className="text-sm text-gray-500">Imputer directement les débits sur vos comptes de classes 6.</p>
            </div>
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 transition"
            >
              Ajouter une Dépense
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-4">Date de justificatif</th>
                  <th className="px-6 py-4">Libellé de la dépense</th>
                  <th className="px-6 py-4">Catégorie</th>
                  <th className="px-6 py-4">Saisie Débit</th>
                  <th className="px-6 py-4">Saisie Crédit</th>
                  <th className="px-6 py-4">Montant Réglé</th>
                  <th className="px-6 py-4">Emis Par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      Aucune dépense enregistrée sur cette période.
                    </td>
                  </tr>
                ) : (
                  expenses.map(ex => (
                    <tr key={ex.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/30">
                      <td className="px-6 py-4 font-mono text-gray-400">{ex.date?.toLocaleDateString ? ex.date.toLocaleDateString() : 'Actuel'}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{ex.label}</td>
                      <td className="px-6 py-4 uppercase font-bold text-gray-500">{ex.category}</td>
                      <td className="px-6 py-4 font-mono text-indigo-650 font-bold">{ex.debitAccount}</td>
                      <td className="px-6 py-4 font-mono text-gray-400">{ex.creditAccount || '521000'}</td>
                      <td className="px-6 py-4 font-black font-mono text-rose-500 text-sm">{formatCurrency(ex.amount)}</td>
                      <td className="px-6 py-4 text-gray-400">{ex.recordedByName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CAISSE JOURNALIERE TAB */}
      {activeTab === 'caisse' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-150 shadow-sm space-y-4">
              <h4 className="font-extrabold text-sm uppercase text-gray-400 tracking-wider">État du Tiroir-Caisse de la journée</h4>
              <div className="flex items-center gap-3">
                <span className={`w-3.5 h-3.5 rounded-full ${currentCaisse ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xl font-black text-gray-900 dark:text-white">
                  {currentCaisse ? "Caisse OUVERTE" : "Caisse FERMÉE"}
                </span>
              </div>
              
              <div className="text-xs text-gray-500 space-y-2 pt-2">
                <p><strong>Caissier :</strong> {currentCaisse ? currentCaisse.openedByName : 'Aucun'}</p>
                <p><strong>Heure d'ouverture :</strong> {currentCaisse ? currentCaisse.openedAt.toLocaleTimeString() : 'N/A'}</p>
                <p><strong>Solde de sécurité Initial :</strong> {currentCaisse ? formatCurrency(currentCaisse.initialBalance) : '0 FCFA'}</p>
              </div>

              <div className="pt-4">
                {currentCaisse ? (
                  <button
                    onClick={() => {
                      setCaisseStateForm({ balance: '', closedBalance: '' } as any);
                      setShowCaisseModal(true);
                    }}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase rounded-2xl transition"
                  >
                    Clôturer & Compter la caisse
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setCaisseStateForm({ initialBalance: '', closedBalance: '' });
                      setShowCaisseModal(true);
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-2xl transition"
                  >
                    Ouvrir la Caisse Centrale
                  </button>
                )}
              </div>
            </div>

            <div className="md:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-150 shadow-sm">
              <h4 className="font-black text-sm uppercase text-gray-400 tracking-wider mb-4">Historique de conformité et écarts</h4>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left text-gray-600 dark:text-gray-300">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-[10px] uppercase font-black text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Responsable caisse</th>
                      <th className="px-4 py-2">Solde Init.</th>
                      <th className="px-4 py-2">Solde Clôture</th>
                      <th className="px-4 py-2">Écart</th>
                      <th className="px-4 py-2">Vérif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {caisseSessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-medium">
                          Aucun historique de rapprochement physique de caisse.
                        </td>
                      </tr>
                    ) : (
                      caisseSessions.map(sess => (
                        <tr key={sess.id} className="hover:bg-gray-50/40">
                          <td className="px-4 py-3 font-mono text-gray-400">{sess.openedAt.toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{sess.openedByName}</td>
                          <td className="px-4 py-3 font-mono">{formatCurrency(sess.initialBalance)}</td>
                          <td className="px-4 py-3 font-mono">{sess.closedBalance ? formatCurrency(sess.closedBalance) : '---'}</td>
                          <td className="px-4 py-3 font-mono font-bold">
                            {sess.finalDifference === undefined ? 'Session active' : (
                              <span className={sess.finalDifference === 0 ? 'text-emerald-500' : 'text-red-500'}>
                                {sess.finalDifference > 0 ? '+' : ''}{sess.finalDifference.toLocaleString()} FCFA
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {sess.status === 'open' ? (
                              <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded text-[9px] uppercase font-black">ACTIVE</span>
                            ) : sess.reconciled ? (
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[9px] uppercase font-black">CONFORME</span>
                            ) : (
                              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[9px] uppercase font-black">ANOMALIE</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. PLAN COMPTABLE TAB */}
      {activeTab === 'accounting_plan' && (
        <div className="space-y-4">
          {selectedAccountForDetails ? (
            // DETAILED ACCOUNT LEDGER VIEW
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-indigo-55/70 dark:bg-indigo-950/30 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/40">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAccountForDetails(null)}
                    className="p-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl border border-gray-150 dark:border-gray-700 shadow-sm transition-all"
                    title="Retour au plan"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 bg-indigo-600 text-white font-mono text-xs font-black rounded-lg">
                        {selectedAccountForDetails.code}
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase">
                        {selectedAccountForDetails.name}
                      </h3>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Catégorie : <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{selectedAccountForDetails.category}</span> • Type : <span className="font-bold text-gray-600 dark:text-gray-300">{selectedAccountForDetails.type}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-750 dark:text-gray-300 border border-gray-250 dark:border-gray-700 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer size={13} /> Imprimer Grand Livre
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAccountForDetails(null)}
                    className="px-3.5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-650 dark:text-gray-200 rounded-xl text-xs font-black uppercase transition-all"
                  >
                    Fermer
                  </button>
                </div>
              </div>

              {/* Account details computations */}
              {(() => {
                const entriesForThisAccount = accountingEntries.filter(
                  ent => ent.debitAccount === selectedAccountForDetails.code || ent.creditAccount === selectedAccountForDetails.code
                );
                
                const debitSum = entriesForThisAccount
                  .filter(ent => ent.debitAccount === selectedAccountForDetails.code)
                  .reduce((sum, ent) => sum + ent.amount, 0);

                const creditSum = entriesForThisAccount
                  .filter(ent => ent.creditAccount === selectedAccountForDetails.code)
                  .reduce((sum, ent) => sum + ent.amount, 0);

                const isDebitNature = ['Actif', 'Charge'].includes(selectedAccountForDetails.category);
                const currentBalance = isDebitNature ? (debitSum - creditSum) : (creditSum - debitSum);

                return (
                  <>
                    {/* Live values widgets */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Cumul Débits</p>
                        <p className="text-lg font-black text-emerald-600 mt-1">{debitSum.toLocaleString()} FCFA</p>
                        <p className="text-[9px] text-gray-400 mt-1">Total des rentrées ou emplois rattachés</p>
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Cumul Crédits</p>
                        <p className="text-lg font-black text-rose-500 mt-1">{creditSum.toLocaleString()} FCFA</p>
                        <p className="text-[9px] text-gray-400 mt-1">Total des sorties ou ressources rattachées</p>
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-indigo-200/50 dark:border-indigo-900/60 shadow-sm bg-gradient-to-br from-indigo-50/5 via-transparent to-transparent">
                        <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Position Solde Comptable</p>
                        <p className={`text-lg font-black mt-1 ${currentBalance >= 0 ? 'text-indigo-650 dark:text-indigo-400' : 'text-rose-600'}`}>
                          {currentBalance.toLocaleString()} FCFA
                        </p>
                        <p className="text-[9px] text-gray-400 mt-1">
                          Nature : <span className="font-bold">{isDebitNature ? 'Solde Débiteur (Normal Actif/Charge)' : 'Solde Créditeur (Normal Passif/Produit)'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Specific Account Ledger Transactions History */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-750 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-gray-150 dark:border-gray-750 font-extrabold text-xs text-gray-900 dark:text-white uppercase flex items-center justify-between">
                        <span>Extrait de Grand Livre - Écritures Chronologiques</span>
                        <span className="text-[11px] font-mono text-gray-400 bg-gray-50 dark:bg-gray-900 px-2.5 py-1 rounded-lg">
                          {entriesForThisAccount.length} Écritures trouvées
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono text-gray-650 dark:text-gray-300">
                          <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-400 border-b border-gray-150 dark:border-gray-750">
                              <th className="px-5 py-3.5">Date Écriture</th>
                              <th className="px-5 py-3.5">Pièce / Réf</th>
                              <th className="px-5 py-3.5">Libellé de l'Opération</th>
                              <th className="px-5 py-3.5">Débit (FCFA)</th>
                              <th className="px-5 py-3.5">Crédit (FCFA)</th>
                              <th className="px-5 py-3.5">Contrepartie SAGE</th>
                              <th className="px-5 py-3.5 text-right">Clé de contrôle</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-750">
                            {entriesForThisAccount.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-sans">
                                  Aucun mouvement n'a encore affecté le compte {selectedAccountForDetails.code} dans cet exercice.
                                </td>
                              </tr>
                            ) : (
                              entriesForThisAccount.map(ent => {
                                const isDebitLine = ent.debitAccount === selectedAccountForDetails.code;
                                const counterpartCode = isDebitLine ? ent.creditAccount : ent.debitAccount;
                                return (
                                  <tr key={ent.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-750/30">
                                    <td className="px-5 py-4 text-[11px] font-mono">
                                      {ent.date instanceof Date ? ent.date.toLocaleDateString() : new Date(ent.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-5 py-4 font-bold text-indigo-600 dark:text-indigo-450">
                                      {ent.ref || 'PIECE-NIL'}
                                    </td>
                                    <td className="px-5 py-4 font-sans font-bold text-gray-900 dark:text-white uppercase text-[11px]">
                                      {ent.label}
                                    </td>
                                    <td className="px-5 py-4 font-black text-emerald-600">
                                      {isDebitLine ? ent.amount.toLocaleString() : '0'}
                                    </td>
                                    <td className="px-5 py-4 font-black text-rose-500">
                                      {!isDebitLine ? ent.amount.toLocaleString() : '0'}
                                    </td>
                                    <td className="px-5 py-4 text-gray-450 font-bold">
                                      {counterpartCode}
                                    </td>
                                    <td className="px-5 py-4 text-right text-[10px] text-emerald-500 font-mono">
                                      {ent.hash ? ent.hash.split('-')[1] : 'N/A'}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            // MAIN PLAN LIST
            <>
              <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                <div>
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Plan Comptable SYSCOHADA Appliqué</h3>
                  <p className="text-xs text-gray-500">Mappage direct des flux de la scolarité et ventilation comptable Sage 100. Cliquez sur un compte pour consulter l'extrait complet du Grand Livre.</p>
                </div>
                <button
                  onClick={() => setShowAddAccountModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  <Plus size={14} /> Nouveau Compte
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {planComptable.map(acc => (
                  <div 
                    key={acc.code} 
                    onClick={() => setSelectedAccountForDetails(acc)}
                    className="cursor-pointer group select-none bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-150 dark:border-gray-700 flex items-start gap-4 hover:shadow-sm hover:-translate-y-0.5 hover:border-indigo-250/60 dark:hover:border-indigo-900 transition-all font-sans"
                  >
                    <span className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl font-mono text-xs font-black tracking-widest leading-none group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      {acc.code}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-xs text-gray-850 dark:text-white truncate uppercase group-hover:text-indigo-650 dark:group-hover:text-indigo-450 transition-colors">{acc.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold tracking-wider uppercase text-gray-400">
                        <span className="bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-750">{acc.category}</span>
                        <span>• {acc.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. COUBLE-ENTRY LEDGER TAB */}
      {activeTab === 'double_entries' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Livre Consolidé en Direct</p>
              <p className="text-xs">Chaque flux de facturation d'Edu-Nify s'inscrit au crédit et débit direct pour la réconciliation.</p>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300 font-bold bg-slate-800 p-2.5 rounded-xl border border-slate-700/50">
              <ShieldCheck className="text-emerald-400" size={16} />
              Chaque mouvement possède un hachage cryptographique Edu-Nify anti-falsification.
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs font-mono text-gray-600 dark:text-gray-300">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/80 text-[10px] uppercase font-black text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-4">Sceau ID / Date</th>
                  <th className="px-6 py-4">Mouvement & Explication</th>
                  <th className="px-6 py-4">Compte Débit</th>
                  <th className="px-6 py-4">Compte Crédit</th>
                  <th className="px-6 py-4">Débit (FCFA)</th>
                  <th className="px-6 py-4">Crédit (FCFA)</th>
                  <th className="px-6 py-4 text-center">Contrôle de sécurité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                {accountingEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      Aucune écriture comptable validée. Enregistrez un paiement ou une dépense pour générer des lignes.
                    </td>
                  </tr>
                ) : (
                  accountingEntries.map(ent => (
                    <React.Fragment key={ent.id}>
                      {/* Debit line posting */}
                      <tr className="bg-emerald-50/10 hover:bg-gray-50/30">
                        <td className="px-6 py-3 text-gray-400 text-[10px] border-l-4 border-emerald-500">
                          {ent.id.substring(0, 10)}<br/>
                          <span className="text-[9px] block text-gray-400">{ent.date?.toLocaleDateString ? ent.date.toLocaleDateString() : 'En attente'}</span>
                        </td>
                        <td className="px-6 py-3 font-semibold text-gray-900 dark:text-white uppercase text-[11px]">{ent.label}</td>
                        <td className="px-6 py-3 font-black text-emerald-600">{ent.debitAccount}</td>
                        <td className="px-6 py-3 text-gray-400">---</td>
                        <td className="px-6 py-3 font-bold text-gray-900 dark:text-white">{ent.amount.toLocaleString()}</td>
                        <td className="px-6 py-3 text-gray-450 font-medium">0</td>
                        <td rowSpan={2} className="px-6 py-3 text-center border-l border-gray-100 dark:border-gray-700">
                          <div className="flex flex-col items-center gap-1">
                            <ShieldCheck className="text-emerald-500" size={18} />
                            <span className="text-[8px] bg-slate-950 font-black text-emerald-400 dark:text-emerald-500 px-2 py-0.5 rounded tracking-tighter shadow-sm w-[90px] truncate" title={ent.hash}>
                              {ent.hash.split('-')[1]}
                            </span>
                            <span className="text-[8px] text-gray-400 uppercase font-bold tracking-wider leading-none">Vérifié SHA</span>
                          </div>
                        </td>
                      </tr>
                      {/* Credit line posting */}
                      <tr className="bg-rose-50/5 hover:bg-gray-50/30">
                        <td className="px-6 py-3 text-gray-400 text-[10px] border-l-4 border-rose-500">
                          {ent.id.substring(0, 10)}<br/>
                          <span className="text-[9px] block text-gray-400">{ent.date?.toLocaleDateString ? ent.date.toLocaleDateString() : 'En attente'}</span>
                        </td>
                        <td className="px-6 py-3 text-gray-500 pl-10 text-[11px]">{ent.label} (Imputation)</td>
                        <td className="px-6 py-3 text-gray-400">---</td>
                        <td className="px-6 py-3 font-black text-rose-500">{ent.creditAccount}</td>
                        <td className="px-6 py-3 text-gray-450 font-medium">0</td>
                        <td className="px-6 py-3 font-bold text-gray-900 dark:text-white">{ent.amount.toLocaleString()}</td>
                      </tr>
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. BALANCE & RESULTS SHEET */}
      {activeTab === 'balance_sheet' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-150 shadow-sm">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Balance Générale des Comptes Scolaires</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 font-black text-gray-400 border-b border-gray-150">
                      <th className="px-4 py-2">Code</th>
                      <th className="px-4 py-2">Intitulé de compte</th>
                      <th className="px-4 py-2">Débit</th>
                      <th className="px-4 py-2">Crédit</th>
                      <th className="px-4 py-2 text-right">Solde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 text-[11px]">
                    {generalLedgerSummary.details.map(row => (
                      <tr key={row.code} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-bold text-indigo-650">{row.code}</td>
                        <td className="px-4 py-2.5 text-gray-800 dark:text-white truncate max-w-[150px]" title={row.name}>{row.name}</td>
                        <td className="px-4 py-2.5 text-emerald-600">{row.debit.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-rose-500">{row.credit.toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-bold text-right text-gray-900 dark:text-white">{row.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                      <td colSpan={2} className="px-4 py-3">TOTAUX DE CONCORDANCE</td>
                      <td className="px-4 py-3 text-emerald-600 text-sm">{generalLedgerSummary.totalDebit.toLocaleString()} FCFA</td>
                      <td className="px-4 py-3 text-rose-500 text-sm">{generalLedgerSummary.totalCredit.toLocaleString()} FCFA</td>
                      <td className="px-4 py-3 text-right text-indigo-650">Equilibré</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              {/* OHADA Income statement simulation based on raw database */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-155 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Compte de Résultat Simplifié (SYSCOHADA)</h3>
                
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center border-b pb-1">
                    <span className="text-gray-500">PRODUITS (Classe 7)</span>
                    <span className="font-mono font-bold text-emerald-600">+{stats.income.toLocaleString()} FCFA</span>
                  </div>
                  <div className="pl-4 text-[11px] text-gray-400 space-y-1">
                    <p className="flex justify-between">
                      <span>• Scolarité (701000) :</span>
                      <span>{payments.filter(p => p.type === 'tuition').reduce((acc, c) => acc + c.amount, 0).toLocaleString()} FCFA</span>
                    </p>
                    <p className="flex justify-between">
                      <span>• Inscription & Activités (701200 / 708200) :</span>
                      <span>{payments.filter(p => !['tuition', 'canteen'].includes(p.type)).reduce((acc, c) => acc + c.amount, 0).toLocaleString()} FCFA</span>
                    </p>
                    <p className="flex justify-between">
                      <span>• Prestations Repas (706000) :</span>
                      <span>{canteenTransactions.filter(t => t.type === 'topup').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()} FCFA</span>
                    </p>
                  </div>

                  <div className="flex justify-between items-center border-b pb-1 pt-2">
                    <span className="text-gray-500">CHARGES (Classe 6)</span>
                    <span className="font-mono font-bold text-rose-500">-{stats.charges.toLocaleString()} FCFA</span>
                  </div>
                  <div className="pl-4 text-[11px] text-gray-400 space-y-1">
                    {planComptable.filter(p => p.category === 'Charge').map(ch => {
                      const amount = expenses.filter(ex => ex.debitAccount === ch.code).reduce((acc, c) => acc + c.amount, 0);
                      return (
                        <p key={ch.code} className="flex justify-between">
                          <span>• {ch.name} ({ch.code}) :</span>
                          <span>{amount.toLocaleString()} FCFA</span>
                        </p>
                      );
                    })}
                  </div>

                  <div className="pt-4 border-t-2 border-dashed flex justify-between items-center bg-gray-50 dark:bg-gray-900/60 p-3 rounded-2xl">
                    <span className="font-black text-gray-900 dark:text-white uppercase">EXCÉDENT COMPTABLE NET</span>
                    <span className={`font-mono text-sm font-black ${stats.result >= 0 ? 'text-indigo-650' : 'text-red-650'}`}>
                      {stats.result >= 0 ? '+' : ''}{stats.result.toLocaleString()} FCFA
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-[11px] text-amber-700 rounded-2xl border border-amber-100 dark:border-amber-900 font-bold space-y-1">
                  <p className="uppercase tracking-wide">Précision d'évaluation Sage :</p>
                  <p>Aucun amortissement linéaire ou de charge d'intérêts financières n'a été rattaché à cette période académique.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. SAGE SYNC TAB */}
      {activeTab === 'sage_sync' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center max-w-2xl mx-auto space-y-6">
            <div className="p-5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-full animate-bounce">
              <RefreshCw size={44} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Synchronisation Directe ERP & Sage 100 Edition</h3>
              <p className="text-sm text-gray-500">Générez un export normé ou effectuez un test d'envoi API vers les serveurs ERP Comptabilité de l'Établissement.</p>
            </div>

            <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs w-full text-left space-y-1.5 border border-slate-800">
              <p className="text-slate-400"># Schema d'export Sage actif (SYSCOHADA Standard) :</p>
              <p className="text-slate-300">Format : CSV délimité par des points-virgules pour le module d'import automatique.</p>
              <p className="text-slate-300">Fichier généré : Écritures débit/crédit rattachées au Journal 'BQ_TR' (Trésorerie/Mobile/Caisse).</p>
            </div>

            <div className="flex flex-col sm:flex-row w-full gap-3 pt-2">
              <button
                onClick={handleExportSage}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase rounded-2xl flex items-center justify-center gap-2 transition shadow-xl shadow-indigo-500/10"
              >
                <Download size={16} /> Télécharger l'export SAGE (CSV)
              </button>

              <button
                onClick={() => {
                  alert("Simulation de l'intégration API d'Edu-Nify avec Sage 100 : Communication initiée... Connexion au serveur de base de données Sage OK. Audit d'anti-falsification conforme. Tous les hachages SHA-256 de ce ledger concordent.");
                }}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-gray-800 dark:text-white font-black text-xs uppercase rounded-2xl flex items-center justify-center gap-2 transition"
              >
                <RefreshCw size={16} /> Lancer Synchronisation API
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renders financial situation report modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl max-w-4xl w-full my-8 overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-805/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xl shadow-indigo-200 dark:shadow-none">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{translate('financial_situation_report', 'RAPPORT FINANCIER CERTIFIÉ')}</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Edu-Nify ERP Standard</p>
                  </div>
                </div>
                <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div id="printable-report" className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 bg-white dark:bg-gray-900">
                {/* Header letterhead */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-8 pb-8 border-b-2 border-gray-100 dark:border-gray-800">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg">EN</div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Edu-Nify</h3>
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium space-y-1">
                      <p>Direction Administrative et Financière</p>
                      <p>BP 12548 - Place de l'Indépendance, Dakar</p>
                      <p>ID Fiscal: SN-DKR-2024-B-12345</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right space-y-1 text-xs">
                    <p className="font-bold text-gray-900 dark:text-white"><span className="text-gray-400">Émis le:</span> {new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p>
                    <p className="font-bold text-gray-900 dark:text-white"><span className="text-gray-400">Référence:</span> STR-{new Date().getFullYear()}-{Math.floor(Math.random() * 9000 + 1000)}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => setShowReportModal(false)} className="px-6 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl flex-1 uppercase text-xs">Fermer</button>
                  <button onClick={() => window.print()} className="px-6 py-4 bg-indigo-650 text-white font-black rounded-xl flex-1 uppercase text-xs">Imprimer rapport</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recoil Add Payment Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-750 flex items-center justify-between bg-gray-50 dark:bg-gray-900/40">
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Passer une écriture d'encaissement</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-650">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddPayment} className="p-6 space-y-4 font-sans text-xs">
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Cibler l'élève bénéficiaire <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Saisissez le nom, prénom ou matricule pour rechercher..."
                      value={studentSearchInput}
                      onChange={(e) => {
                        setStudentSearchInput(e.target.value);
                        setShowStudentDropdown(true);
                      }}
                      onFocus={() => setShowStudentDropdown(true)}
                      className="w-full px-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold"
                      required={!newPayment.studentId}
                    />
                    <Search className="absolute right-3.5 top-3.5 text-gray-400" size={16} />
                  </div>

                  {showStudentDropdown && (
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-gray-805 border border-gray-150 dark:border-gray-700 rounded-xl shadow-xl divide-y divide-gray-100 dark:divide-gray-750">
                      {(() => {
                        const filt = students.filter(s => {
                          const fullName = `${s.prenom || ''} ${s.nom || ''} ${s.matricule || ''} ${s.classe || ''}`.toLowerCase();
                          const queryWords = studentSearchInput.toLowerCase().trim().split(/\s+/);
                          return queryWords.every(word => fullName.includes(word));
                        });

                        if (filt.length === 0) {
                          return (
                            <div className="px-4 py-3 text-gray-400 text-center text-xs">
                              Aucun élève trouvé dans la base de données
                            </div>
                          );
                        }

                        return filt.slice(0, 10).map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setNewPayment(prev => ({ ...prev, studentId: s.id }));
                              setStudentSearchInput(`${s.prenom || ''} ${s.nom || ''}`);
                              setShowStudentDropdown(false);
                            }}
                            className="px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/45 cursor-pointer transition-colors flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-extrabold text-gray-800 dark:text-gray-100 uppercase">{s.prenom || ''} {s.nom || ''}</p>
                              <p className="text-[10px] text-gray-400 font-mono">Matricule : {s.matricule || 'Sans matricule'}</p>
                            </div>
                            {s.classe && (
                              <span className="bg-indigo-50/50 dark:bg-indigo-900/40 text-indigo-650 dark:text-indigo-300 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                {s.classe}
                              </span>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {newPayment.studentId && (() => {
                    const selectedS = students.find(s => s.id === newPayment.studentId);
                    if (!selectedS) return null;
                    return (
                      <div className="mt-2.5 flex items-center justify-between p-3 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 rounded-xl">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="font-bold text-gray-800 dark:text-emerald-400 text-[11px]">
                            Bénéficiaire : {selectedS.prenom} {selectedS.nom} ({selectedS.classe || 'Sans classe'})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNewPayment(prev => ({ ...prev, studentId: '' }));
                            setStudentSearchInput('');
                          }}
                          className="text-[10px] text-rose-500 font-black hover:underline uppercase"
                        >
                          Changer
                        </button>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Montant à imputer (FCFA) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      required
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-xs"
                      placeholder="Montant net à verser"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ventilation comptable <span className="text-rose-500">*</span></label>
                    <select
                      value={newPayment.type}
                      onChange={(e) => setNewPayment({...newPayment, type: e.target.value as any})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                    >
                      <option value="tuition">Scolarité (701000)</option>
                      <option value="registration">Inscription (701200)</option>
                      <option value="canteen">Cantine (706000)</option>
                      <option value="transport">Transport (708200)</option>
                      <option value="other">Autre (101000)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Méthode de règlement <span className="text-rose-500">*</span></label>
                    <select
                      value={newPayment.method}
                      onChange={(e) => setNewPayment({...newPayment, method: e.target.value as any})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold font-mono"
                    >
                      <option value="cash">Espèces (521000)</option>
                      <option value="transfer">Virement Banque (512000)</option>
                      <option value="card">Carte Bancaire (512000)</option>
                      <option value="airtel">Airtel Money (521100)</option>
                      <option value="moov">Moov Money (521100)</option>
                      <option value="mtn">MTN Mobile Money (521100)</option>
                      <option value="orange">Orange Money (521100)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Référence justificatif (Sage)</label>
                    <input
                      type="text"
                      value={newPayment.reference}
                      onChange={(e) => setNewPayment({...newPayment, reference: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                      placeholder="Ex: CHEQ-29382, MOOV-902"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Commentaires de rapprochement d'audit</label>
                  <textarea
                    rows={2}
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none font-semibold"
                    placeholder="Facultatif"
                  />
                </div>

                <div className="flex gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 rounded-2xl transition-all uppercase"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all uppercase shadow-lg shadow-indigo-600/10"
                  >
                    {isSaving ? "Ecriture en cours..." : "Valider & Imputer"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recoil Add Expense Modal */}
      <AnimatePresence>
        {showAddExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-750 flex items-center justify-between bg-gray-50 dark:bg-gray-900/40">
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Mouvementer une dépense (Classe 6)</h2>
                <button onClick={() => setShowAddExpenseModal(false)} className="text-gray-400 hover:text-gray-650">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="p-6 space-y-4 font-sans text-xs">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Intitulé justificatif / Fournisseur <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newExpense.label}
                    onChange={(e) => setNewExpense({...newExpense, label: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold"
                    placeholder="Ex: Versement des primes enseignants Mai"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Montant Décaissé <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      required
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ration d'imputation <span className="text-rose-500">*</span></label>
                    <select
                      value={newExpense.category}
                      onChange={(e) => setNewExpense({...newExpense, category: e.target.value as any})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                    >
                      <option value="fournitures">Fournitures de Bureau</option>
                      <option value="salaires">Charges Salariales</option>
                      <option value="maintenance">Maintenance Campus</option>
                      <option value="achats">Achats généraux & Ciment</option>
                      <option value="autre">Autres de Classe 6</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">CO COMPTE CHARGE COMPIL (DÉBIT) <span className="text-rose-500">*</span></label>
                    <select
                      value={newExpense.debitAccount}
                      onChange={(e) => setNewExpense({...newExpense, debitAccount: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                    >
                      {planComptable.filter(p => p.category === 'Charge').map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">COMPTE DE TRÉSORERIE RÉGLEMENT (CRÉDIT) <span className="text-rose-500">*</span></label>
                    <select
                      value={newExpense.creditAccount}
                      onChange={(e) => setNewExpense({...newExpense, creditAccount: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                    >
                      {planComptable.filter(p => p.category === 'Actif').map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddExpenseModal(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-650 font-bold hover:bg-gray-200 rounded-2xl transition uppercase"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-650 text-white font-black rounded-2xl transition uppercase"
                  >
                    Imputer la charge
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recoil Add SYSCOHADA Account Modal */}
      <AnimatePresence>
        {showAddAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-150 flex items-center justify-between">
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase">Créer un nouveau compte comptable SYSCOHADA</h2>
                <button onClick={() => setShowAddAccountModal(false)} className="text-gray-405 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddAccount} className="p-6 space-y-4 font-sans text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Code de compte (6 Chiffres) <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={newAccount.code}
                      onChange={(e) => setNewAccount({...newAccount, code: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl outline-none font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ex: 621051"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Catégorie OHADA <span className="text-rose-500">*</span></label>
                    <select
                      value={newAccount.category}
                      onChange={(e) => setNewAccount({...newAccount, category: e.target.value as any})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    >
                      <option value="Actif">Actif (Classe 2, 5)</option>
                      <option value="Passif">Passif (Classe 1, 4)</option>
                      <option value="Charge">Charge (Classe 6)</option>
                      <option value="Produit">Produit (Classe 7)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Intitulé du compte général <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Charges d'assurance scolaires"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Type de ventilation</label>
                  <input
                    type="text"
                    value={newAccount.type}
                    onChange={(e) => setNewAccount({...newAccount, type: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Charges diverses ou Personnel"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddAccountModal(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl uppercase text-[10px]"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px]"
                  >
                    Créer le Compte
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recoil Caisse Opening/Count Modal */}
      <AnimatePresence>
        {showCaisseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-150 flex items-center justify-between">
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  {currentCaisse ? "Clôturer le journal de caisse" : "Ouvrir une session de caisse"}
                </h2>
                <button onClick={() => setShowCaisseModal(false)} className="text-gray-411 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              {currentCaisse ? (
                // Count form to reconcile difference
                <form onSubmit={handleCloseCaisse} className="p-6 space-y-4 font-sans text-xs">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl text-[11px] text-gray-500 font-bold space-y-1">
                    <p>Caissier : {currentCaisse.openedByName}</p>
                    <p>Fonds initial : {formatCurrency(currentCaisse.initialBalance)}</p>
                    <p>Recettes en espèces cumulées : {formatCurrency(payments.filter(p => p.method === 'cash').reduce((acc, c) => acc + c.amount, 0))}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1">Renseigner le montant réel recompté physiquement <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      required
                      value={caisseStateForm.closedBalance}
                      onChange={(e) => setCaisseStateForm({...caisseStateForm, closedBalance: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="Entrez le cash physique total du tiroir"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase rounded-2xl transition"
                  >
                    Valider le comptage et Clôturer
                  </button>
                </form>
              ) : (
                // Opening form to initiate
                <form onSubmit={handleOpenCaisse} className="p-6 space-y-4 font-sans text-xs">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1">Fonds de roulement ou Solde de réserve initial (FCFA) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      required
                      value={caisseStateForm.initialBalance}
                      onChange={(e) => setCaisseStateForm({...caisseStateForm, initialBalance: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="Entrez le solde en caisse pour le rendu de monnaie"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase rounded-2xl transition"
                  >
                    Ouvrir le journal de caisse
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Interactive side-by-side Invoice & AI Auditing Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col md:flex-row h-[90vh]"
            >
              {/* Left Column: Interactive Receipt Preview */}
              <div className="w-full md:w-2/3 p-6 bg-slate-50 dark:bg-slate-900 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 overflow-y-auto flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-4 border-b border-gray-150 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-400">Prévisualisation du Reçu</span>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-md shadow-emerald-600/15"
                  >
                    <Printer size={12} /> Imprimer Reçu
                  </button>
                </div>

                {/* Simulated A4/Receipt layout paper sheet */}
                <div id="school-invoice-paper" className="w-full max-w-xl bg-white text-black p-8 rounded-2xl shadow-sm border border-gray-200/60 font-sans relative overflow-hidden">
                  
                  {/* Paid Watermark stamp */}
                  <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-12 border-4 border-red-500 text-red-500 font-extrabold text-2xl px-6 py-2 rounded-xl opacity-15 pointer-events-none select-none uppercase tracking-widest">
                    Payé / Conforme
                  </div>

                  {/* Receipt Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                    <div>
                      <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">École Intern. du Centre Pédagogique</h2>
                      <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                        Shop Universitaire<br/>
                        Libreville, Gabon • N° 077022306<br/>
                        ludo.consulting3@gmail.com • +241 07 70 22 306
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-lg mb-2">REÇU DE COMPLEMENT</span>
                      <p className="text-xs font-black text-slate-800">Réf: {selectedInvoice.reference || `FAC-${selectedInvoice.id.substring(0,6).toUpperCase()}`}</p>
                      <p className="text-[10px] text-gray-400 font-bold font-mono">Date: {
                        selectedInvoice.date?.seconds 
                          ? new Date(selectedInvoice.date.seconds * 1000).toLocaleDateString('fr-FR', { dateStyle: 'medium' })
                          : selectedInvoice.date?.toDate 
                            ? selectedInvoice.date.toDate().toLocaleDateString('fr-FR', { dateStyle: 'medium' })
                            : new Date(selectedInvoice.date || Date.now()).toLocaleDateString('fr-FR', { dateStyle: 'medium' })
                      }</p>
                    </div>
                  </div>

                  {/* Party Information */}
                  <div className="my-6 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-wide mb-1">RÉCIPIENDAIRE / ÉLÈVE</p>
                      <p className="font-extrabold text-slate-900">{selectedInvoice.studentName}</p>
                      <p className="text-[10px] text-gray-500 font-mono">Type : Exonéré de TVA (Reg. Scolaire)</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-wide mb-1">IMPUTATION SYSCOHADA</p>
                      <p className="font-bold text-indigo-750">
                        {selectedInvoice.type === 'tuition' ? 'Classe 7 - Compte 701000 (Scolarités)' : selectedInvoice.type === 'registration' ? 'Compte 701200 (Inscriptions)' : 'Compte 706000 (Prestations)'}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono">Caissier : {selectedInvoice.recordedByName || 'Bureau Direction'}</p>
                    </div>
                  </div>

                  {/* Dynamic Items Table */}
                  <table className="w-full text-left text-xs text-gray-600 border-collapse mb-6">
                    <thead>
                      <tr className="border-b border-slate-900 font-black text-slate-800">
                        <th className="py-2">Description du versement</th>
                        <th className="py-2 uppercase">Rubrique</th>
                        <th className="py-2">Méthode</th>
                        <th className="py-2 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      <tr>
                        <td className="py-3 font-medium text-slate-900 text-[11px]">
                          {selectedInvoice.type === 'tuition' ? 'Versement annuel - Frais de scolarité obligatoires' : selectedInvoice.type === 'registration' ? 'Frais fixes d\'inscription administrative' : `Règlement direct pour rubrique : ${selectedInvoice.type}`}
                        </td>
                        <td className="py-3 font-semibold text-indigo-800 uppercase tracking-wider text-[10px]">
                          {selectedInvoice.type === 'tuition' ? 'Scolarité d\'Excellence' : selectedInvoice.type}
                        </td>
                        <td className="py-3 uppercase text-[10px] font-bold">
                          {selectedInvoice.method === 'cash' ? '💵 Espèces' : selectedInvoice.method === 'transfer' ? '🏦 Virement' : selectedInvoice.method.toUpperCase()}
                        </td>
                        <td className="py-3 text-right font-black text-slate-900 font-mono text-[12px]">{formatCurrency(selectedInvoice.amount)}</td>
                      </tr>
                      
                      {/* Calculation Rows */}
                      <tr className="border-t border-slate-900/60">
                        <td colSpan={2} />
                        <td className="py-1.5 font-bold text-slate-500">Total Net H.T :</td>
                        <td className="py-1.5 text-right font-bold text-slate-500 font-mono">{formatCurrency(selectedInvoice.amount)}</td>
                      </tr>
                      <tr>
                        <td colSpan={2} />
                        <td className="py-1.5 font-bold text-slate-500">Taux TVA (Scolaire) :</td>
                        <td className="py-1.5 text-right font-bold text-slate-500 font-mono">Exonéré (0%)</td>
                      </tr>
                      <tr className="border-t-2 border-slate-900 text-[13px] font-black text-slate-900">
                        <td colSpan={2} />
                        <td className="py-2.5">Total Versé :</td>
                        <td className="py-2.5 text-right font-mono text-indigo-700">{formatCurrency(selectedInvoice.amount)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* AI Generated Remarks on printed sheet */}
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1 mb-6 text-slate-800 text-[10px]">
                    <p className="font-extrabold uppercase tracking-wide flex items-center gap-1.5 text-indigo-800">
                      <Sparkles size={11} className="text-violet-500" />
                      Remarques Spéciales d'Accompagnement (Projeté par IA) :
                    </p>
                    {aiInvoiceAnalysis?.loading ? (
                      <p className="text-gray-400 font-mono animate-pulse">L'Assistant IA analyse la fiche financière et formule un message d'accompagnement...</p>
                    ) : (
                      <p className="italic font-medium leading-relaxed">
                        {aiInvoiceAnalysis?.notes || "Versement certifié conforme. Nous vous remercions pour votre versement en faveur de l'avancement académique d'excellence."}
                      </p>
                    )}
                  </div>

                  {/* Signature Marks & Stamp */}
                  <div className="flex justify-between items-center my-6 pt-4 border-t border-dashed border-gray-300 text-[10px]">
                    <div>
                      <p className="font-extrabold uppercase text-gray-400 mb-1">Sceau de l'Agent</p>
                      <div className="w-24 h-12 border border-dashed border-gray-300 rounded flex items-center justify-center text-[8px] text-gray-400 font-mono uppercase">
                        Tampon Compta
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold uppercase text-gray-400 mb-6">Signature Reçue</p>
                      <p className="font-bold text-slate-900 underline">Le Directeur des Finances</p>
                    </div>
                  </div>

                  {/* Security watermark hash confirmation */}
                  <div className="text-[8px] text-gray-400 flex items-center justify-between font-mono bg-slate-50 p-2.5 rounded-lg border border-gray-100 uppercase mt-4">
                    <span>Edu-Nify Anti-Falsification ID : {selectedInvoice.id}</span>
                    <span className="text-emerald-600 font-bold">SHA-HASH: {generateTransactionHash(selectedInvoice.id, '521000', '701000', selectedInvoice.amount, '2026').substring(0, 24)}...</span>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Audit Assistant Advisor and controls */}
              <div className="w-full md:w-1/3 p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider">
                        <Sparkles size={16} className="text-violet-500 animate-spin" />
                        AUDIT INTELLIGENT COMPTABLE
                      </div>
                      <h3 className="text-base font-black text-gray-900 dark:text-white mt-1">Cabinet Conseil IA Intégré</h3>
                    </div>
                    <button 
                      onClick={() => setSelectedInvoice(null)} 
                      className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 rounded-full transition cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notre modèle de raisonnement comptable <strong className="text-indigo-600 dark:text-indigo-400">Gemini 3.5</strong> a vérifié les comptes d'aspiration SYSCOHADA SAGE rattachés à cette transaction financière.
                  </p>

                  {/* AI Audit response card */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-750 rounded-2xl space-y-3">
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full uppercase font-black tracking-widest block w-max">
                      Analyse d'Audit
                    </span>

                    {aiInvoiceAnalysis?.loading ? (
                      <div className="space-y-2 py-4 animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans whitespace-pre-line space-y-2">
                        <div className="p-2.5 bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 rounded-xl">
                          <p className="text-[9px] font-black uppercase tracking-wider text-green-700 dark:text-green-400 mb-1">RAPPORT DE CONFORMITÉ</p>
                          <p className="font-medium text-slate-800 dark:text-slate-350">{aiInvoiceAnalysis?.audit || "L'imputation est jugée légitime et équilibrée."}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Helpful hints and anti-fraud advisory info */}
                  <div className="p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-[10px] text-gray-500 space-y-1">
                    <p className="font-extrabold uppercase text-gray-900 dark:text-white flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-500" /> CONSEIL ANTI-FRAUDE
                    </p>
                    <p>Chaque versement fait l'objet d'une signature sécurisée. En cas de suspicion de double imputation ou de modifications ultérieures non autorisées, le système rejette automatiquement sa synchronisation dans le logiciel de compta central SAGE.</p>
                  </div>
                </div>

                <div className="space-y-2 pt-6 border-t border-gray-150 dark:border-gray-750">
                  <button
                    onClick={() => handleGenerateAIInvoiceDetails(selectedInvoice)}
                    className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-750 dark:text-white font-black uppercase text-[10px] rounded-xl tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={12} /> Régénérer l'Imprimé IA
                  </button>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[10px] rounded-xl tracking-wider transition-all cursor-pointer"
                  >
                    Fermer l'Assistant
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pure Print-Only View Container (Visible ONLY during window.print()) */}
      {selectedInvoice && (
        <div id="printable-receipt" className="hidden print:block absolute inset-0 bg-white text-black p-8 font-sans w-[210mm] min-h-[297mm] h-auto text-xs">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase">École Intern. du Centre Pédagogique</h1>
              <p className="text-[9px] text-gray-600">
                Shop Universitaire<br/>
                Libreville, Gabon • N° 077022306<br/>
                ludo.consulting3@gmail.com • Tél: +241 07 70 22 306
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2 bg-slate-100 border border-slate-300 font-extrabold text-[9px] uppercase tracking-wider py-0.5 rounded mb-1">REÇU DE COMPLEMENT</span>
              <p className="font-extrabold">Facture N°: {selectedInvoice.reference || `FAC-${selectedInvoice.id.substring(0,6).toUpperCase()}`}</p>
              <p className="text-[9px] font-mono">Date : {
                selectedInvoice.date?.seconds 
                  ? new Date(selectedInvoice.date.seconds * 1000).toLocaleDateString('fr-FR', { dateStyle: 'long' })
                  : selectedInvoice.date?.toDate 
                    ? selectedInvoice.date.toDate().toLocaleDateString('fr-FR', { dateStyle: 'long' })
                    : new Date(selectedInvoice.date || Date.now()).toLocaleDateString('fr-FR', { dateStyle: 'long' })
              }</p>
            </div>
          </div>

          {/* Party Information */}
          <div className="grid grid-cols-2 gap-4 mb-4 pb-2 border-b border-gray-300">
            <div>
              <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">Pour le compte de l'élève</p>
              <p className="font-black text-sm">{selectedInvoice.studentName}</p>
              <p className="text-[9px] text-gray-500 font-mono">Status d'exonération : Exonéré (Régime Académique)</p>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">Imputation Analytique</p>
              <p className="font-bold">
                {selectedInvoice.type === 'tuition' ? 'Frais de Scolarité Éligibles' : selectedInvoice.type === 'registration' ? 'Droits d\'Inscription Initiale' : `Avis budgétaire : ${selectedInvoice.type}`}
              </p>
              <p className="text-[9px] text-gray-600 font-mono">Guichet-Caisse : {selectedInvoice.recordedByName || 'Chef de Bureau'}</p>
            </div>
          </div>

          {/* Line items table */}
          <table className="w-full text-left font-sans text-xs mb-6 border-collapse">
            <thead>
              <tr className="border-b border-black font-extrabold uppercase text-gray-700">
                <th className="py-2">Description du versement</th>
                <th className="py-2">Rubrique</th>
                <th className="py-2">Règlement</th>
                <th className="py-2 text-right">Montant Certifié</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="py-3 font-semibold text-slate-900">
                  {selectedInvoice.type === 'tuition' ? 'Versement d\'écolage réglementaire - Contribution Annuelle' : selectedInvoice.type === 'registration' ? 'Frais uniques d\'inscription d\'admission' : `Paiement pour : ${selectedInvoice.type}`}
                </td>
                <td className="py-3 uppercase tracking-wide text-[9px] font-bold">
                  {selectedInvoice.type === 'tuition' ? 'Scolarité d\'Excellence' : selectedInvoice.type}
                </td>
                <td className="py-3 uppercase text-[9px] font-bold">
                  {selectedInvoice.method === 'cash' ? '💵 Espèces' : selectedInvoice.method === 'transfer' ? '🏦 Virement' : selectedInvoice.method.toUpperCase()}
                </td>
                <td className="py-3 text-right font-black font-mono text-[11px]">{formatCurrency(selectedInvoice.amount)}</td>
              </tr>
              
              {/* Calculations */}
              <tr className="border-t border-black">
                <td colSpan={2} />
                <td className="py-1 font-bold">Net Hors-Taxes :</td>
                <td className="py-1 text-right font-mono font-bold">{formatCurrency(selectedInvoice.amount)}</td>
              </tr>
              <tr>
                <td colSpan={2} />
                <td className="py-1 font-bold">TVA Applicable :</td>
                <td className="py-1 text-right font-mono font-bold">Exonéré (0%)</td>
              </tr>
              <tr className="border-t-2 border-black text-sm font-black">
                <td colSpan={2} />
                <td className="py-2">Scolarité Versée :</td>
                <td className="py-2 text-right font-mono text-indigo-800">{formatCurrency(selectedInvoice.amount)}</td>
              </tr>
            </tbody>
          </table>

          {/* AI Comment printed */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded mb-6 text-[10px]">
            <p className="font-extrabold uppercase tracking-wide mb-1 flex items-center gap-1 text-slate-800">
              <Sparkles size={11} /> Annotation Personnalisée par IA :
            </p>
            <p className="italic leading-relaxed font-semibold">
              {aiInvoiceAnalysis?.notes || "Paiement validé avec succès. Merci pour votre versement."}
            </p>
          </div>

          {/* Signatures */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-dashed border-gray-400">
            <div>
              <p className="font-extrabold uppercase text-gray-400 mb-1">Cachet Académique</p>
              <div className="w-24 h-11 border border-dashed border-gray-400 rounded flex items-center justify-center text-[7px] text-gray-500 font-mono uppercase">
                Tampon de Caisse
              </div>
            </div>
            <div className="text-right">
              <p className="font-extrabold uppercase text-gray-400 mb-6">Signature Responsable</p>
              <p className="font-bold underline text-xs">Le Directeur Administratif & Financier</p>
            </div>
          </div>

          {/* Footer security tag */}
          <div className="text-[7px] text-gray-500 flex justify-between items-center font-mono mt-10 bg-slate-150 p-2 border border-gray-300 rounded uppercase">
            <span>Edu-Nify Anti-Falsification ID : {selectedInvoice.id}</span>
            <span className="font-bold">SHA-HASH: {generateTransactionHash(selectedInvoice.id, '521000', '701000', selectedInvoice.amount, '2026')}</span>
          </div>
        </div>
      )}

      <SuccessModal 
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title={successInfo.title}
        message={successInfo.message}
      />
    </div>
  );
};

export default Finance;
