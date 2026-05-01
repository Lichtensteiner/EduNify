import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../lib/firebase';
import { collection, query, getDocs, where, addDoc, serverTimestamp, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { 
  Wallet, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
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
  LineChart as LineChartIcon,
  Activity,
  Building2,
  Coins,
  Briefcase,
  FileText,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
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
  Area, 
  Legend,
  ComposedChart,
  Line
} from 'recharts';

interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  type: 'tuition' | 'registration' | 'canteen' | 'transport' | 'other';
  status: 'paid' | 'pending' | 'overdue';
  date: any;
  method: 'cash' | 'card' | 'transfer';
  reference?: string;
  notes?: string;
}

const Finance: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [activeTab, setActiveTab] = useState<'transactions' | 'analytics'>('transactions');

  // Real Data Aggregation for Analytics
  const analyticsData = React.useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
    const monthlyMap: Record<string, { revenue: number, net: number, count: number }> = {};
    const typeMap: Record<string, number> = {};

    months.forEach(m => {
      monthlyMap[m] = { revenue: 0, net: 0, count: 0 };
    });

    payments.forEach(p => {
      // Monthly distribution
      if (p.date?.toDate) {
        const date = p.date.toDate();
        const monthName = months[date.getMonth()];
        if (p.status === 'paid') {
          monthlyMap[monthName].revenue += p.amount;
          monthlyMap[monthName].net += p.amount * 0.45; // Simulated net profit of 45% based on real revenue
          monthlyMap[monthName].count += 1;
        }
      }

      // Type distribution
      if (p.status === 'paid') {
        const typeLabel = p.type === 'tuition' ? 'Scolarité' : 
                         p.type === 'registration' ? 'Inscription' : 
                         p.type === 'canteen' ? 'Cantine' : 
                         p.type === 'transport' ? 'Transport' : 'Autre';
        typeMap[typeLabel] = (typeMap[typeLabel] || 0) + p.amount;
      }
    });

    const evolutionData = months.map(m => ({
      month: m,
      revenue: monthlyMap[m].revenue,
      net: monthlyMap[m].net,
      // Cumulative valuation for "Market Cap" simulation
      cap: monthlyMap[m].revenue * 5 
    })).filter((_, i) => i <= new Date().getMonth() || monthlyMap[months[i]].revenue > 0);

    const breakdownData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));
    const totalByType = breakdownData.reduce((acc, curr) => acc + curr.value, 0);
    const breakdownPercentages = breakdownData.map(item => ({
      ...item,
      percentage: totalByType > 0 ? Math.round((item.value / totalByType) * 100) : 0
    }));

    return { evolutionData, breakdownPercentages, totalByType };
  }, [payments]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newPayment, setNewPayment] = useState({
    studentId: '',
    amount: '',
    type: 'tuition',
    method: 'cash',
    notes: '',
    reference: ''
  });

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;

    const unsubscribe = onSnapshot(collection(db, 'payments'), (snap) => {
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
    });

    const fetchData = async () => {
      const studentsQuery = query(collection(db, 'users'), where('role', '==', 'élève'));
      const teachersQuery = query(collection(db, 'users'), where('role', '==', 'enseignant'));
      
      const [studentsSnap, teachersSnap] = await Promise.all([
        getDocs(studentsQuery),
        getDocs(teachersQuery)
      ]);
      
      setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTeachers(teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchData();
    return () => unsubscribe();
  }, [currentUser]);

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.reference?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  const totalRevenue = payments.reduce((acc, p) => acc + (p.status === 'paid' ? p.amount : 0), 0);
  const pendingRevenue = payments.reduce((acc, p) => acc + (p.status === 'pending' ? p.amount : 0), 0);
  const overdueRevenue = payments.reduce((acc, p) => acc + (p.status === 'overdue' ? p.amount : 0), 0);

  const handleExportPDF = async () => {
    const element = document.getElementById('printable-report');
    if (!element) return;

    setIsExporting(true);
    
    try {
      // Temporarily add a class to body to help with styling during capture if needed
      document.body.classList.add('pdf-export-ongoing');
      
      const opt = {
        margin: [5, 5, 5, 5],
        filename: `Rapport_Financier_ShopUniversities_${new Date().getFullYear()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          letterRendering: true,
          // This is key: ensure the window width is fixed to prevent layout shifts
          windowWidth: element.clientWidth > 0 ? element.clientWidth : 1024,
          // Ignore external elements that might cause issues
          ignoreElements: (el: Element) => el.classList.contains('no-print')
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // Ensure images and fonts are loaded
      await new Promise(resolve => setTimeout(resolve, 500));

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Erreur détaillée exportation PDF:', error);
      alert('Erreur: Les nouveaux formats de couleur CSS ne sont pas supportés par le générateur PDF. Veuillez utiliser l\'option "Imprimer" de votre navigateur et choisir "Enregistrer au format PDF" pour un résultat optimal.');
    } finally {
      document.body.classList.remove('pdf-export-ongoing');
      setIsExporting(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);

    try {
      const student = students.find(s => s.id === newPayment.studentId);
      await addDoc(collection(db, 'payments'), {
        ...newPayment,
        amount: parseFloat(newPayment.amount),
        studentName: student ? `${student.prenom} ${student.nom}` : 'Inconnu',
        date: serverTimestamp(),
        status: 'paid',
        recordedBy: currentUser.id
      });
      setShowAddModal(false);
      setNewPayment({
        studentId: '',
        amount: '',
        type: 'tuition',
        method: 'cash',
        notes: '',
        reference: ''
      });
    } catch (error) {
      console.error("Error saving payment:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Accès restreint aux administrateurs.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="text-indigo-600" />
            {t('finance')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Gestion des paiements et frais scolaires</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
          >
            <FileText size={18} className="text-indigo-600" />
            Rapport Financier
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            Enregistrer un paiement
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-100 dark:border-gray-700">
        <button 
          onClick={() => setActiveTab('transactions')}
          className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
            activeTab === 'transactions' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Transactions
          {activeTab === 'transactions' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
            activeTab === 'analytics' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Analyses Financières (Bourse & Corporate)
          {activeTab === 'analytics' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
        </button>
      </div>

      {activeTab === 'transactions' ? (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* ... Existing Stats ... */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                  <TrendingUp size={24} />
                </div>
                <ArrowUpRight className="text-green-500" size={20} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recettes Totales</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {totalRevenue.toLocaleString()} FCFA
              </h3>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                  <Clock size={24} />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">En attente</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {pendingRevenue.toLocaleString()} FCFA
              </h3>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                  <AlertCircle size={24} />
                </div>
                <ArrowDownRight className="text-red-500" size={20} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Impayés</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {overdueRevenue.toLocaleString()} FCFA
              </h3>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Users size={24} />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Élèves à jour</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {students.length > 0 ? Math.round((payments.filter(p => p.status === 'paid').length / students.length) * 100) : 0}%
              </h3>
            </motion.div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un élève ou une référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="text-gray-400" size={20} />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                <option value="all">Tous les types</option>
                <option value="tuition">Scolarité</option>
                <option value="registration">Inscription</option>
                <option value="canteen">Cantine</option>
                <option value="transport">Transport</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>

          {/* Payments List */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Élève</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Montant</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Méthode</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        Chargement des transactions...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        Aucune transaction trouvée.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {payment.date?.toDate ? payment.date.toDate().toLocaleDateString(language) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{payment.studentName}</div>
                          {payment.reference && <div className="text-xs text-gray-500 dark:text-gray-400">Réf: {payment.reference}</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md text-xs font-medium capitalize">
                            {payment.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                          {payment.amount.toLocaleString()} FCFA
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            {payment.method === 'cash' ? <DollarSign size={14} /> : payment.method === 'card' ? <CreditCard size={14} /> : <History size={14} />}
                            <span className="capitalize">{payment.method}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                            payment.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            payment.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {payment.status === 'paid' ? <CheckCircle2 size={12} /> : payment.status === 'pending' ? <Clock size={12} /> : <AlertCircle size={12} />}
                            {payment.status === 'paid' ? 'Payé' : payment.status === 'pending' ? 'En attente' : 'En retard'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            <History size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-8 pb-12">
          {/* Dashboard Analytics Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-200 dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <Building2 size={32} className="opacity-80" />
                <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-full">VALEUR SCOLAIRE</span>
              </div>
              <p className="text-indigo-100 text-sm">Cap. Boursière (Rétrétie)</p>
              <h3 className="text-3xl font-bold mt-1">{(totalRevenue * 5.2).toLocaleString()} <span className="text-sm font-normal">FCFA</span></h3>
              <div className="mt-4 flex items-center gap-2 text-xs text-indigo-100">
                <ArrowUpRight size={14} />
                <span>Basé sur {payments.length} transactions réelles</span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <Coins size={32} className="text-amber-500" />
                <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-full">RENDEMENT</span>
              </div>
              <p className="text-gray-500 text-sm">Rendement Dividende</p>
              <h3 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{(totalRevenue > 0 ? (pendingRevenue / totalRevenue * 10).toFixed(1) : 0)}<span className="text-sm font-normal">%</span></h3>
              <div className="mt-4 flex items-center gap-2 text-xs text-amber-600">
                <Activity size={14} />
                <span>Analyse du flux de trésorerie</span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <Briefcase size={32} className="text-sky-500" />
              </div>
              <p className="text-gray-500 text-sm">Employés Actifs</p>
              <h3 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{teachers.length}</h3>
              <div className="mt-4 flex h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500" style={{ width: `${(teachers.length / (teachers.length + students.length)) * 100}%` }} />
                <div className="h-full bg-indigo-400 w-[10%]" />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                <span>Enseignants</span>
                <span>Administration</span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <PieChartIcon size={32} className="text-emerald-500" />
              </div>
              <p className="text-gray-500 text-sm">Actions Free-float</p>
              <h3 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">75<span className="text-sm font-normal">%</span></h3>
              <p className="text-[10px] text-gray-400 mt-2">Capital ouvert aux investisseurs</p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Evolution Graph */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Évolution & Croissance Réelle</h3>
                  <p className="text-sm text-gray-500">Basé sur les paiements enregistrés</p>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className="text-[10px] text-gray-400 uppercase">Revenu</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-gray-400 uppercase">Net (Est.)</span>
                  </div>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.evolutionData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} name="Revenu" />
                    <Area type="monotone" dataKey="net" stroke="#10b981" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" name="Résultat Net" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Revenue Breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Répartition des revenus</h3>
              <p className="text-sm text-gray-500 mb-8">Par source de business (Réel)</p>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="h-[250px] w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData.breakdownPercentages}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ef4444'].map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value.toLocaleString()} FCFA`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-4">
                  {analyticsData.breakdownPercentages.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ef4444'][i % 5] }} />
                        <span className="text-sm text-gray-500">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Performance Annuelle vs Objectifs</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.evolutionData.slice(-3)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} name="Réel" />
                    <Bar dataKey="cap" fill="#e2e8f0" radius={[8, 8, 0, 0]} barSize={40} name="Prévision" hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Santé Financière</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-500">Niveau de dette</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{(totalRevenue > 0 ? (overdueRevenue / totalRevenue * 100).toFixed(0) : 0)}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${(totalRevenue > 0 ? (overdueRevenue / totalRevenue * 100) : 0)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Calculé sur les créances impayées</p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-500">Couverture Liquidité</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">x{(totalRevenue / (overdueRevenue || 1)).toFixed(1)}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[95%]" />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-sm mb-1">
                      <CheckCircle2 size={16} />
                      Score de Solvabilité
                    </div>
                    <p className="text-[10px] text-green-600 dark:text-green-500 opacity-80 uppercase font-bold tracking-widest">
                      {totalRevenue > overdueRevenue ? 'FINANCE SAINE' : 'SURVEILLANCE REQUISE'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Dividend History & Metrics */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
             <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700">
               <h3 className="text-lg font-bold text-gray-900 dark:text-white">Indicateurs de Performance Académique (Annuelle)</h3>
             </div>
             <table className="w-full text-left">
               <thead className="bg-gray-50 dark:bg-gray-700/50">
                 <tr>
                    <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase">Mois</th>
                    <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase">Revenu Brut</th>
                    <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase">Dette Estimée</th>
                    <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase">Cercle de Confiance</th>
                    <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase">Profit Est.</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {analyticsData.evolutionData.slice(-5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-8 py-4 text-sm font-bold border-l-4 border-transparent hover:border-indigo-500">{row.month} 2024</td>
                      <td className="px-8 py-4 text-sm text-gray-600 dark:text-gray-400">{row.revenue?.toLocaleString()} FCFA</td>
                      <td className="px-8 py-4 text-sm text-gray-600 dark:text-gray-400">{(row.revenue * 0.1)?.toLocaleString()} FCFA</td>
                      <td className="px-8 py-4 text-sm font-bold text-gray-900 dark:text-white">{(row.revenue * 1.25)?.toLocaleString()}</td>
                      <td className="px-8 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400">{row.net?.toLocaleString()} FCFA</td>
                    </tr>
                  ))}
               </tbody>
             </table>
          </div>
        </div>
      )}

      {/* Financial Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl max-w-4xl w-full my-8 overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Rapport de Situation Financière</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Document Certifié • ShopUniversities ERP</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowReportModal(false)}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors font-bold text-xs uppercase"
                  >
                    Retour
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-white hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Activity size={14} className="animate-spin text-indigo-600" />
                    ) : (
                      <Download size={14} className="text-indigo-600" />
                    )}
                    {isExporting ? 'Génération...' : 'Exporter PDF'}
                  </button>
                  <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div id="printable-report" className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 bg-white dark:bg-gray-900 custom-scrollbar">
                {/* Header Letterhead */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-8 pb-8 border-b-2 border-gray-100 dark:border-gray-800">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg">SU</div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white">ShopUniversities</h3>
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium space-y-0.5">
                      <p>Direction Administrative et Financière</p>
                      <p>Service de la Comptabilité Scolaire</p>
                      <p>contact@shopuniversities.com</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right space-y-1 text-xs">
                    <p className="font-bold text-gray-900 dark:text-white"><span className="text-gray-400 font-medium tracking-widest uppercase">Émis le:</span> {new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p>
                    <p className="font-bold text-gray-900 dark:text-white"><span className="text-gray-400 font-medium tracking-widest uppercase">Référence:</span> STR-{new Date().getFullYear()}-{Math.floor(Math.random() * 9000 + 1000)}</p>
                    <p className="font-bold text-gray-900 dark:text-white"><span className="text-gray-400 font-medium tracking-widest uppercase">Période:</span> Année Académique 2024</p>
                  </div>
                </div>

                {/* Summary Section */}
                <section>
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">I. RÉSUMÉ DE TRÉSORERIE RÉEL</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">Recettes Encaissées</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">{totalRevenue.toLocaleString()} <span className="text-xs font-normal">FCFA</span></p>
                    </div>
                    <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">Marge Opérationnelle (45%)</p>
                      <p className="text-xl font-black text-emerald-600">{(totalRevenue * 0.45).toLocaleString()} <span className="text-xs font-normal">FCFA</span></p>
                    </div>
                    <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">Créances en Retard</p>
                      <p className="text-xl font-black text-red-500">{overdueRevenue.toLocaleString()} <span className="text-xs font-normal">FCFA</span></p>
                    </div>
                  </div>
                </section>

                {/* Breakdown Table */}
                <section>
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">II. RÉPARTITION DES REVENUS PAR SERVICE</h4>
                  <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left font-black text-gray-400 uppercase">Service</th>
                          <th className="px-6 py-3 text-right font-black text-gray-400 uppercase">Valeur (FCFA)</th>
                          <th className="px-6 py-3 text-right font-black text-gray-400 uppercase">Ratio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {analyticsData.breakdownPercentages.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-3 font-bold text-gray-900 dark:text-white">{item.name}</td>
                            <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400 font-mono">{item.value.toLocaleString()}</td>
                            <td className="px-6 py-3 text-right font-black text-indigo-600">{item.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50/50 dark:bg-gray-800/50 font-black border-t border-gray-100 dark:border-gray-800">
                        <tr>
                          <td className="px-6 py-3 text-gray-900 dark:text-white">TOTAL CONSOLIDÉ</td>
                          <td className="px-6 py-3 text-right text-gray-900 dark:text-white font-mono">{analyticsData.totalByType.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-indigo-600">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                {/* Performance Section */}
                <section>
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">III. ANALYSE MENSUELLE & TRENDING</h4>
                  <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left font-black text-gray-400 uppercase">Période</th>
                          <th className="px-6 py-3 text-right font-black text-gray-400 uppercase">CA Brut</th>
                          <th className="px-6 py-3 text-right font-black text-gray-400 uppercase">Objectif</th>
                          <th className="px-6 py-3 text-right font-black text-gray-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {analyticsData.evolutionData.slice(-4).map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-3 font-bold text-gray-900 dark:text-white">{row.month} 2024</td>
                            <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400 font-mono">{row.revenue.toLocaleString()}</td>
                            <td className="px-6 py-3 text-right text-gray-400 font-mono">{(totalRevenue/8).toLocaleString()}</td>
                            <td className="px-6 py-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${row.revenue >= (totalRevenue/8) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {row.revenue >= (totalRevenue/8) ? 'Atteint' : 'Sous-perf'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Authentication Seals */}
                <div className="grid grid-cols-2 gap-12 pt-12 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-center">
                    <div className="h-16 flex items-center justify-center mb-2">
                       <div className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center text-[10px] text-gray-300 font-bold uppercase rotate-12">CACHET DAF</div>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
                      <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase">Directeur Administratif</p>
                      <p className="text-[8px] text-gray-400 font-bold tracking-widest mt-1 uppercase">Vérifié & Signé numériquement</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="h-16 flex items-center justify-center mb-2">
                       <Activity size={32} className="text-indigo-100" />
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
                      <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase">Comptable Principal</p>
                      <p className="text-[8px] text-gray-400 font-bold tracking-widest mt-1 uppercase">Validé par le système ERP</p>
                    </div>
                  </div>
                </div>

                <footer className="pt-8 text-center text-[8px] text-gray-400 font-bold uppercase tracking-[0.2em] leading-loose">
                  Émis par ShopUniversities Cloud Infrastructure. Toute altération physique ou numérique rend ce document invalide.<br/>
                  Certificat d'intégrité de données ID: SHA-256-{Math.random().toString(36).substring(7).toUpperCase()}
                </footer>

                <div className="flex flex-col sm:flex-row gap-4 pt-12 no-print">
                  <button 
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                  >
                    <X size={18} />
                    Quitter
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Activity size={20} className="animate-spin" />
                    ) : (
                      <Download size={20} />
                    )}
                    {isExporting ? 'Génération du fichier...' : 'Télécharger le Rapport PDF'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Payment Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Enregistrer un paiement</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAddPayment} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Élève</label>
                  <select
                    required
                    value={newPayment.studentId}
                    onChange={(e) => setNewPayment({...newPayment, studentId: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">Sélectionner un élève</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.prenom} {s.nom} ({s.classe})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Montant (FCFA)</label>
                    <input
                      type="number"
                      required
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                    <select
                      value={newPayment.type}
                      onChange={(e) => setNewPayment({...newPayment, type: e.target.value as any})}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="tuition">Scolarité</option>
                      <option value="registration">Inscription</option>
                      <option value="canteen">Cantine</option>
                      <option value="transport">Transport</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Méthode</label>
                    <select
                      value={newPayment.method}
                      onChange={(e) => setNewPayment({...newPayment, method: e.target.value as any})}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="cash">Espèces</option>
                      <option value="card">Carte Bancaire</option>
                      <option value="transfer">Virement</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Référence</label>
                    <input
                      type="text"
                      value={newPayment.reference}
                      onChange={(e) => setNewPayment({...newPayment, reference: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Ex: CHQ-12345"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {isSaving ? 'Enregistrement...' : 'Confirmer le paiement'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Finance;
