import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../lib/firebase';
import { recordAuditLog } from '../services/auditService';
import { collection, query, getDocs, where, addDoc, serverTimestamp, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Plus, 
  AlertTriangle, 
  Ban, 
  Clock, 
  User, 
  Calendar,
  Trash2,
  FileText,
  CheckCircle2,
  XCircle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SuccessModal from '../components/SuccessModal';

interface Sanction {
  id: string;
  studentId: string;
  studentName: string;
  type: 'warning' | 'detention' | 'exclusion' | 'expulsion' | 'other';
  reason: string;
  date: any;
  duration?: string;
  status: 'active' | 'completed' | 'cancelled';
  recordedBy: string;
  recordedByName: string;
}

// Real-time French Keyword and Gravity scoring engine for School Discipline
const analyzeIncident = (reason: string) => {
  const text = reason.toLowerCase();
  
  // Keyword databases curated by severity
  const criticalKeywords = ['agression', 'drogue', 'arme', 'couteau', 'voler', 'vols', 'racisme', 'harcèlement', 'raciste', 'violences', 'frapper', 'frappé', 'frappe', 'violence', 'physique', 'menace de mort', 'menacer de mort'];
  const highKeywords = ['tricherie', 'triche', 'tricher', 'bagarre', 'injures', 'insulter', 'insulte', 'vandalisme', 'dégradation', 'dégrader', 'fumer', 'menaces', 'menace', 'complot', 'vandaliser', 'mensonge grave'];
  const mediumKeywords = ['insolence', 'dispute', 'insolent', 'absence', 'bruit', 'chahut', 'bavardages', 'non-respect', 'respect', 'téléphone', 'portable', 'copier', 'copie', 'menacer', 'désobéissance', 'désobéir'];
  const lowKeywords = ['retard', 'bavardage', 'oublis', 'oubli', 'matériel', 'devoir', 'devoirs', 'sommeil', 'dormir', 'distrait', 'distraction', 'bavarder', 'discuter'];

  let score = 0;
  let matches: string[] = [];

  criticalKeywords.forEach(k => {
    if (text.includes(k)) {
      score += 45;
      if (!matches.includes(k)) matches.push(k);
    }
  });

  highKeywords.forEach(k => {
    if (text.includes(k)) {
      score += 25;
      if (!matches.includes(k)) matches.push(k);
    }
  });

  mediumKeywords.forEach(k => {
    if (text.includes(k)) {
      score += 15;
      if (!matches.includes(k)) matches.push(k);
    }
  });

  lowKeywords.forEach(k => {
    if (text.includes(k)) {
      score += 5;
      if (!matches.includes(k)) matches.push(k);
    }
  });

  // Base score for simply writing extensively
  if (text.length > 15 && score === 0) {
    score = 5;
  }
  if (text.length > 50 && score < 15) {
    score = 15;
  }

  score = Math.min(100, score);

  let recommendation: {
    type: 'warning' | 'detention' | 'exclusion' | 'expulsion' | 'other';
    duration: string;
    gravity: 'Minime' | 'Moyenne' | 'Élevée' | 'Critique';
    color: string;
    bgColor: string;
    textColor: string;
    description: string;
  };

  if (score >= 60) {
    recommendation = {
      type: 'expulsion',
      duration: 'Dossier Conseil Discipline',
      gravity: 'Critique',
      color: 'bg-red-600',
      bgColor: 'bg-red-50/70 dark:bg-red-950/25',
      textColor: 'text-red-700 dark:text-red-400',
      description: 'Atteinte physique, harcèlement ou danger grave. Exclusion définitive fortement recommandée.'
    };
  } else if (score >= 30) {
    recommendation = {
      type: 'exclusion',
      duration: '3 jours',
      gravity: 'Élevée',
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50/70 dark:bg-orange-950/25',
      textColor: 'text-orange-700 dark:text-orange-400',
      description: 'Tricherie, bagarre, insulte ou vandalisme. Suggère une exclusion temporaire.'
    };
  } else if (score >= 12) {
    recommendation = {
      type: 'detention',
      duration: '2 heures',
      gravity: 'Moyenne',
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50/70 dark:bg-amber-950/25',
      textColor: 'text-amber-700 dark:text-amber-400',
      description: 'Insolence récurrente, chahut ou désobéissance obstinée. Suggère des heures de retenue.'
    };
  } else {
    recommendation = {
      type: 'warning',
      duration: 'Aucune',
      gravity: 'Minime',
      color: 'bg-teal-500',
      bgColor: 'bg-teal-50/70 dark:bg-teal-950/25',
      textColor: 'text-teal-700 dark:text-teal-400',
      description: 'Bavardage, oubli ponctuel ou retard. Un avertissement formel ou rappel à l\'ordre suffit.'
    };
  }

  return { score, recommendation, matches };
};

const SANCTION_RULES = {
  warning: {
    title: "Avertissement / Rappel à l'ordre",
    guidelines: "Sanctionne les fautes légères (bavardages fréquents, retards récurrents, premier oubli de matériel, ou distraction passagère).",
    consequence: "Enregistré au registre de vie scolaire. Sert d'alerte pédagogique formelle à destination des parents."
  },
  detention: {
    title: "Heure(s) de Retenue / Heure de colle",
    guidelines: "S'applique en cas de manquements répétés aux avertissements précédents, insolence caractérisée ou refus caractérisé d'accomplir un travail scolaire.",
    consequence: "Heures supplémentaires gratuites planifiées en dehors du temps habituel des cours. Travail écrit ou révision obligatoire exigé."
  },
  exclusion: {
    title: "Exclusion Temporaire (1 à 8 jours)",
    guidelines: "Sanctionne les infractions graves (tricheries avérées aux examens, dégradation ou vandalisme de matériel, altercation physique moyenne ou disrespect grave).",
    consequence: "L'élève est privé d'accès à sa classe. Devoirs à distance obligatoires et évaluation au retour. Passage possible en commission éducative."
  },
  expulsion: {
    title: "Exclusion Définitive / Conseil de Discipline",
    guidelines: "Réservé aux atteintes criminelles ou d'une gravité absolue (agression corporelle, vandalisme majeur volontaire, port d'objet dangereux ou harcèlement systématique).",
    consequence: "Convocation immédiate devant le Conseil de discipline souverain de l'établissement. Exclusion totale définitive possible."
  },
  other: {
    title: "Mesure Alternative Éducative",
    guidelines: "Sanction réparatrice visant la responsabilisation (travaux d'intérêt collectif au sein de l'école, excuses rédigées ou réparation de matériel).",
    consequence: "Visée purement éducative visant à faire prendre conscience des conséquences de ses actes de manière active."
  }
};

const Discipline: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ title: '', message: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [newSanction, setNewSanction] = useState<{
    studentId: string;
    type: 'warning' | 'detention' | 'exclusion' | 'expulsion' | 'other';
    reason: string;
    duration: string;
  }>({
    studentId: '',
    type: 'warning',
    reason: '',
    duration: '',
  });

  useEffect(() => {
    if (!currentUser || !['admin', 'enseignant', 'personnel administratif'].includes(currentUser.role)) return;

    const unsubscribe = onSnapshot(collection(db, 'sanctions'), (snap) => {
      const sanctionData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sanction[];
      
      sanctionData.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      
      setSanctions(sanctionData);
      setLoading(false);
    });

    const fetchStudents = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'élève'));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchStudents();
    return () => unsubscribe();
  }, [currentUser]);

  const filteredSanctions = sanctions.filter(s => {
    const matchesSearch = s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || s.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleAddSanction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);

    try {
      const student = students.find(s => s.id === newSanction.studentId);
      await addDoc(collection(db, 'sanctions'), {
        ...newSanction,
        studentName: student ? `${student.prenom} ${student.nom}` : 'Inconnu',
        date: serverTimestamp(),
        status: 'active',
        recordedBy: currentUser.id,
        recordedByName: `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim()
      });

      await recordAuditLog({
        userId: currentUser.id,
        userName: `${currentUser.prenom} ${currentUser.nom}`,
        userRole: currentUser.role,
        action: "Ajout de sanction",
        details: `Élève: ${student ? student.prenom + ' ' + student.nom : 'Inconnu'}, Type: ${newSanction.type}, Motif: ${newSanction.reason}`,
        category: 'discipline'
      });

      setShowAddModal(false);
      setNewSanction({
        studentId: '',
        type: 'warning',
        reason: '',
        duration: '',
      });
      setSuccessInfo({
        title: t('sanction_recorded_success'),
        message: t('sanction_recorded_success_msg')
      });
      setShowSuccess(true);
    } catch (error) {
      console.error("Error saving sanction:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSanction = async (id: string) => {
    if (window.confirm(t('delete_sanction_confirm'))) {
      try {
        const sanctionToDelete = sanctions.find(s => s.id === id);
        await deleteDoc(doc(db, 'sanctions', id));

        if (currentUser) {
          await recordAuditLog({
            userId: currentUser.id,
            userName: `${currentUser.prenom} ${currentUser.nom}`,
            userRole: currentUser.role,
            action: "Suppression de sanction",
            details: `Élève: ${sanctionToDelete?.studentName || id}, Type: ${sanctionToDelete?.type}`,
            category: 'discipline'
          });
        }
      } catch (error) {
        console.error("Error deleting sanction:", error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelled': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
      case 'detention': return <Clock size={16} className="text-orange-500" />;
      case 'exclusion': return <Ban size={16} className="text-red-500" />;
      case 'expulsion': return <XCircle size={16} className="text-red-700" />;
      default: return <ShieldAlert size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="text-red-600" />
            {t('discipline')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">{t('discipline_desc')}</p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
        >
          <Plus size={18} />
          {t('new_sanction')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={t('search_discipline_placeholder')}
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
            <option value="all">{t('all_sanctions')}</option>
            <option value="warning">{t('warning_type')}</option>
            <option value="detention">{t('detention_type')}</option>
            <option value="exclusion">{t('exclusion_type')}</option>
            <option value="expulsion">{t('expulsion_type')}</option>
            <option value="other">{t('other_type')}</option>
          </select>
        </div>
      </div>

      {/* Sanctions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Chargement...</div>
        ) : filteredSanctions.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-dashed border-gray-300 dark:border-gray-700">
            <ShieldAlert size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('no_sanctions')}</h3>
            <p className="text-gray-500 dark:text-gray-400">{t('no_sanctions_desc')}</p>
          </div>
        ) : (
          filteredSanctions.map((sanction) => (
            <motion.div
              key={sanction.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${getStatusColor(sanction.status)}`}>
                  {getTypeIcon(sanction.type)}
                  {t(`${sanction.type}_type`)}
                </div>
                <button 
                  onClick={() => handleDeleteSanction(sanction.id)}
                  className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                  {sanction.studentName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{sanction.studentName}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar size={12} />
                    {sanction.date?.toDate ? sanction.date.toDate().toLocaleDateString(language) : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{sanction.reason}"</p>
              </div>

              {sanction.duration && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Clock size={14} />
                  <span>{t('duration_label').split(' (')[0]}: {sanction.duration}</span>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <User size={10} />
                  <span>{t('by_recorded')} {sanction.recordedByName}</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                  {t(`${sanction.status}_status`)}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Sanction Modal */}
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('new_sanction')}</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAddSanction} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('student_label')}</label>
                  <select
                    required
                    value={newSanction.studentId}
                    onChange={(e) => setNewSanction({...newSanction, studentId: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">{t('select_student')}</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.prenom} {s.nom} ({s.classe})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('type_label')}</label>
                    <select
                      value={newSanction.type}
                      onChange={(e) => setNewSanction({...newSanction, type: e.target.value as any})}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="warning">{t('warning_type')}</option>
                      <option value="detention">{t('detention_type')}</option>
                      <option value="exclusion">{t('exclusion_type')}</option>
                      <option value="expulsion">{t('expulsion_type')}</option>
                      <option value="other">{t('other_type')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('duration_label')}</label>
                    <input
                      type="text"
                      value={newSanction.duration}
                      onChange={(e) => setNewSanction({...newSanction, duration: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={t('duration_placeholder')}
                    />
                  </div>
                </div>

                {/* Display official rules for the selected discipline/sanction type */}
                <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/40 rounded-2xl space-y-2 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                    <p className="font-extrabold text-indigo-800 dark:text-indigo-300 text-xs uppercase tracking-wider">
                      Règlement & Barème : {SANCTION_RULES[newSanction.type].title}
                    </p>
                  </div>
                  <p className="text-[12px] text-gray-600 dark:text-gray-300 leading-relaxed font-semibold">
                    {SANCTION_RULES[newSanction.type].guidelines}
                  </p>
                  <div className="pt-1.5 border-t border-indigo-100/30 dark:border-indigo-900/30 flex items-start gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400 uppercase text-[9px] mt-0.5 shrink-0">Conséquence :</span>
                    <span className="leading-relaxed font-medium">{SANCTION_RULES[newSanction.type].consequence}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('reason_detailed_label')}</label>
                  <textarea
                    required
                    rows={4}
                    value={newSanction.reason}
                    onChange={(e) => setNewSanction({...newSanction, reason: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none mb-3"
                    placeholder={t('reason_placeholder')}
                  />
                </div>

                {newSanction.reason.trim().length > 0 && (() => {
                  const { score, recommendation, matches } = analyzeIncident(newSanction.reason);
                  return (
                    <div className={`p-4 rounded-2xl border ${recommendation.bgColor} border-black/5 dark:border-white/5 transition-all duration-300 space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-500">
                          <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400 animate-pulse shrink-0" />
                          <span>Moteur d'Évaluation de Gravité</span>
                        </div>
                        <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white rounded-md ${recommendation.color}`}>
                          {recommendation.gravity}
                        </span>
                      </div>

                      {/* Gravity Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                          <span>Niveau de sévérité</span>
                          <span>{score}/100</span>
                        </div>
                        <div className="h-2 w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${recommendation.color} transition-all duration-500`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-xs space-y-2">
                        <p className="font-semibold text-gray-700 dark:text-gray-300">
                          <span className="font-extrabold text-gray-900 dark:text-white mr-1">Sanction Suggérée :</span>
                          {t(`${recommendation.type}_type`)} {recommendation.duration ? `(${recommendation.duration})` : ''}
                        </p>
                        <p className="text-[11px] text-gray-500/90 leading-relaxed font-semibold">
                          {recommendation.description}
                        </p>
                        {matches.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mots clés :</span>
                            {matches.map((m, id) => (
                              <span key={id} className="px-1.5 py-0.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[9px] text-gray-600 dark:text-gray-300 font-mono rounded font-bold">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setNewSanction(prev => ({
                            ...prev,
                            type: recommendation.type,
                            duration: recommendation.duration
                          }));
                        }}
                        className="w-full py-2.5 bg-white dark:bg-gray-950 text-gray-950 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] shadow-sm"
                      >
                        <CheckCircle2 size={13} className="text-emerald-500 animate-bounce" />
                        Appliquer la recommandation
                      </button>
                    </div>
                  );
                })()}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50"
                  >
                    {isSaving ? t('saving_status') : t('save_sanction')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Success Modal */}
      <SuccessModal 
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title={successInfo.title}
        message={successInfo.message}
      />
    </div>
  );
};

export default Discipline;
